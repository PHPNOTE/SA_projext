-- =============================================================================
-- Database Schema: Car Repair Queue and Order Management System
-- Database Engine: H2 Database (MODE=MySQL) / MySQL 8.0+
-- Total Tables: 18 relational tables
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Clean Drop (Reverse Dependency Order)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS status_log CASCADE;
DROP TABLE IF EXISTS stock_movement CASCADE;
DROP TABLE IF EXISTS part_request CASCADE;
DROP TABLE IF EXISTS payment CASCADE;
DROP TABLE IF EXISTS invoice_line CASCADE;
DROP TABLE IF EXISTS invoice CASCADE;
DROP TABLE IF EXISTS estimate_line CASCADE;
DROP TABLE IF EXISTS estimate CASCADE;
DROP TABLE IF EXISTS sale_order_line CASCADE;
DROP TABLE IF EXISTS sale_order CASCADE;
DROP TABLE IF EXISTS po_line CASCADE;
DROP TABLE IF EXISTS purchase_order CASCADE;
DROP TABLE IF EXISTS repair_order CASCADE;
DROP TABLE IF EXISTS vehicle CASCADE;
DROP TABLE IF EXISTS part CASCADE;
DROP TABLE IF EXISTS repair_bay CASCADE;
DROP TABLE IF EXISTS customer CASCADE;
DROP TABLE IF EXISTS user_account CASCADE;

-- -----------------------------------------------------------------------------
-- 1. user_account: Staff credentials and RBAC roles
-- -----------------------------------------------------------------------------
CREATE TABLE user_account (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_user_role CHECK (role IN ('FRONT_DESK', 'MECHANIC', 'WAREHOUSE', 'SALES', 'MANAGER'))
);

CREATE INDEX idx_user_role ON user_account(role, is_active);

-- -----------------------------------------------------------------------------
-- 2. customer: Customer contact records
-- -----------------------------------------------------------------------------
CREATE TABLE customer (
    customer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    note TEXT NULL
);

CREATE INDEX idx_customer_phone ON customer(phone);
CREATE INDEX idx_customer_name ON customer(name);

-- -----------------------------------------------------------------------------
-- 3. vehicle: Vehicle details and customer link
-- -----------------------------------------------------------------------------
CREATE TABLE vehicle (
    vehicle_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    plate VARCHAR(50) NOT NULL UNIQUE,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    `year` INT NOT NULL,
    CONSTRAINT fk_vehicle_customer FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE RESTRICT
);

CREATE INDEX idx_vehicle_customer ON vehicle(customer_id);

-- -----------------------------------------------------------------------------
-- 4. repair_bay: Physical workshop bays
-- -----------------------------------------------------------------------------
CREATE TABLE repair_bay (
    bay_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_bay_active ON repair_bay(is_active);

-- -----------------------------------------------------------------------------
-- 5. part: Spare parts catalog, pricing, and shelf counters
-- -----------------------------------------------------------------------------
CREATE TABLE part (
    part_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    sell_price DECIMAL(10,2) NOT NULL,
    on_hand INT NOT NULL DEFAULT 0,
    reserved INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_part_stock CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand),
    CONSTRAINT chk_part_price CHECK (sell_price >= 0.00),
    CONSTRAINT chk_part_reorder CHECK (reorder_level >= 0)
);

CREATE INDEX idx_part_reorder_alert ON part(on_hand, reorder_level);
CREATE INDEX idx_part_active ON part(is_active);

-- -----------------------------------------------------------------------------
-- 6. repair_order: Queue ticket, repair lifecycle, and bay assignment
-- -----------------------------------------------------------------------------
CREATE TABLE repair_order (
    repair_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_no VARCHAR(50) NOT NULL UNIQUE,
    vehicle_id BIGINT NOT NULL,
    complaint TEXT NOT NULL,
    queue_class VARCHAR(20) NOT NULL,
    priority_reason VARCHAR(255) NULL,
    queued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) NOT NULL,
    hold_reason VARCHAR(255) NULL,
    bay_id BIGINT NULL,
    mechanic_id BIGINT NULL,
    insurer_name VARCHAR(100) NULL,
    claim_no VARCHAR(50) NULL,
    insurance_docs_received BOOLEAN NOT NULL DEFAULT FALSE,
    insurance_covered_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    active_bay_hold BIGINT GENERATED ALWAYS AS (
        CASE WHEN status IN ('IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'QC') THEN bay_id ELSE NULL END
    ),
    CONSTRAINT uk_ro_single_active_bay UNIQUE (active_bay_hold),
    CONSTRAINT chk_ro_queue_class CHECK (queue_class IN ('NORMAL', 'PRIORITY')),
    CONSTRAINT chk_ro_status CHECK (status IN ('QUEUED', 'IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'ON_HOLD', 'QC', 'AWAITING_PAYMENT', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT chk_ro_priority_reason CHECK (queue_class <> 'PRIORITY' OR (priority_reason IS NOT NULL AND LENGTH(TRIM(priority_reason)) > 0)),
    CONSTRAINT chk_ro_insurance_amount CHECK (insurance_covered_amount >= 0.00),
    CONSTRAINT fk_ro_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicle(vehicle_id) ON DELETE RESTRICT,
    CONSTRAINT fk_ro_bay FOREIGN KEY (bay_id) REFERENCES repair_bay(bay_id) ON DELETE SET NULL,
    CONSTRAINT fk_ro_mechanic FOREIGN KEY (mechanic_id) REFERENCES user_account(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_ro_created_by FOREIGN KEY (created_by) REFERENCES user_account(user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_ro_vehicle ON repair_order(vehicle_id);
CREATE INDEX idx_ro_status ON repair_order(status);
CREATE INDEX idx_ro_queue_dispatch ON repair_order(status, queue_class, queued_at);
CREATE INDEX idx_ro_bay ON repair_order(bay_id);
CREATE INDEX idx_ro_mechanic ON repair_order(mechanic_id);
CREATE INDEX idx_ro_created_at ON repair_order(created_at);

-- -----------------------------------------------------------------------------
-- 7. estimate: Diagnostic quotation scope and revisions
-- -----------------------------------------------------------------------------
CREATE TABLE estimate (
    estimate_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    repair_id BIGINT NOT NULL,
    revision_no INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    diagnosis_note TEXT NULL,
    created_by BIGINT NOT NULL,
    decided_at TIMESTAMP NULL,
    CONSTRAINT chk_estimate_status CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'DECLINED')),
    CONSTRAINT chk_estimate_rev CHECK (revision_no >= 1),
    CONSTRAINT uq_estimate_repair_rev UNIQUE (repair_id, revision_no),
    CONSTRAINT fk_estimate_repair FOREIGN KEY (repair_id) REFERENCES repair_order(repair_id) ON DELETE CASCADE,
    CONSTRAINT fk_estimate_created_by FOREIGN KEY (created_by) REFERENCES user_account(user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_estimate_status ON estimate(status);
CREATE INDEX idx_estimate_created_by ON estimate(created_by);

-- -----------------------------------------------------------------------------
-- 8. estimate_line: Individual part or labor item in an estimate revision
-- -----------------------------------------------------------------------------
CREATE TABLE estimate_line (
    line_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    estimate_id BIGINT NOT NULL,
    line_type VARCHAR(10) NOT NULL,
    part_id BIGINT NULL,
    description VARCHAR(255) NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    CONSTRAINT chk_estimate_line_type CHECK (line_type IN ('PART', 'LABOR')),
    CONSTRAINT chk_estimate_line_part CHECK (line_type = 'LABOR' OR part_id IS NOT NULL),
    CONSTRAINT chk_estimate_line_qty CHECK (qty > 0),
    CONSTRAINT chk_estimate_line_price CHECK (unit_price >= 0.00),
    CONSTRAINT fk_est_line_estimate FOREIGN KEY (estimate_id) REFERENCES estimate(estimate_id) ON DELETE CASCADE,
    CONSTRAINT fk_est_line_part FOREIGN KEY (part_id) REFERENCES part(part_id) ON DELETE RESTRICT
);

CREATE INDEX idx_est_line_estimate ON estimate_line(estimate_id);
CREATE INDEX idx_est_line_part ON estimate_line(part_id);

-- -----------------------------------------------------------------------------
-- 9. purchase_order: Supplier procurement order header
-- -----------------------------------------------------------------------------
CREATE TABLE purchase_order (
    po_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    po_no VARCHAR(50) NOT NULL UNIQUE,
    supplier_name VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL,
    expected_date DATE NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ordered_at TIMESTAMP NULL,
    CONSTRAINT chk_po_status CHECK (status IN ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
    CONSTRAINT fk_po_created_by FOREIGN KEY (created_by) REFERENCES user_account(user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_po_status ON purchase_order(status);
CREATE INDEX idx_po_created_at ON purchase_order(created_at);

-- -----------------------------------------------------------------------------
-- 10. po_line: Line items in supplier purchase orders
-- -----------------------------------------------------------------------------
CREATE TABLE po_line (
    po_line_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    po_id BIGINT NOT NULL,
    part_id BIGINT NOT NULL,
    qty_ordered INT NOT NULL,
    qty_received INT NOT NULL DEFAULT 0,
    unit_cost DECIMAL(10,2) NOT NULL,
    CONSTRAINT chk_po_line_receipt CHECK (qty_received <= qty_ordered),
    CONSTRAINT chk_po_line_quantities CHECK (qty_ordered > 0 AND qty_received >= 0),
    CONSTRAINT chk_po_line_cost CHECK (unit_cost >= 0.00),
    CONSTRAINT fk_po_line_po FOREIGN KEY (po_id) REFERENCES purchase_order(po_id) ON DELETE CASCADE,
    CONSTRAINT fk_po_line_part FOREIGN KEY (part_id) REFERENCES part(part_id) ON DELETE RESTRICT
);

CREATE INDEX idx_po_line_po ON po_line(po_id);
CREATE INDEX idx_po_line_part ON po_line(part_id);

-- -----------------------------------------------------------------------------
-- 11. sale_order: Direct walk-in counter sales order header
-- -----------------------------------------------------------------------------
CREATE TABLE sale_order (
    sale_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_no VARCHAR(50) NOT NULL UNIQUE,
    customer_id BIGINT NULL,
    status VARCHAR(20) NOT NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_sale_status CHECK (status IN ('QUOTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT fk_sale_customer FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE SET NULL,
    CONSTRAINT fk_sale_created_by FOREIGN KEY (created_by) REFERENCES user_account(user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_sale_customer ON sale_order(customer_id);
CREATE INDEX idx_sale_status ON sale_order(status);

-- -----------------------------------------------------------------------------
-- 12. sale_order_line: Line items in walk-in sales orders
-- -----------------------------------------------------------------------------
CREATE TABLE sale_order_line (
    line_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    part_id BIGINT NOT NULL,
    qty INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    CONSTRAINT chk_sale_line_qty CHECK (qty > 0),
    CONSTRAINT chk_sale_line_price CHECK (unit_price >= 0.00),
    CONSTRAINT fk_sale_line_sale FOREIGN KEY (sale_id) REFERENCES sale_order(sale_id) ON DELETE CASCADE,
    CONSTRAINT fk_sale_line_part FOREIGN KEY (part_id) REFERENCES part(part_id) ON DELETE RESTRICT
);

CREATE INDEX idx_sale_line_sale ON sale_order_line(sale_id);
CREATE INDEX idx_sale_line_part ON sale_order_line(part_id);

-- -----------------------------------------------------------------------------
-- 13. part_request: Stock reservation and issuance tracking
-- -----------------------------------------------------------------------------
CREATE TABLE part_request (
    request_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    estimate_line_id BIGINT NULL,
    sale_order_line_id BIGINT NULL,
    part_id BIGINT NOT NULL,
    qty INT NOT NULL,
    qty_issued INT NOT NULL DEFAULT 0,
    qty_returned INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_part_req_source CHECK ((estimate_line_id IS NOT NULL) <> (sale_order_line_id IS NOT NULL)),
    CONSTRAINT chk_part_req_status CHECK (status IN ('RESERVED', 'BACKORDERED', 'ISSUED', 'RETURNED', 'CANCELLED')),
    CONSTRAINT chk_part_req_quantities CHECK (qty > 0 AND qty_issued >= 0 AND qty_returned >= 0 AND qty_returned <= qty_issued),
    CONSTRAINT fk_part_req_est_line FOREIGN KEY (estimate_line_id) REFERENCES estimate_line(line_id) ON DELETE CASCADE,
    CONSTRAINT fk_part_req_so_line FOREIGN KEY (sale_order_line_id) REFERENCES sale_order_line(line_id) ON DELETE CASCADE,
    CONSTRAINT fk_part_req_part FOREIGN KEY (part_id) REFERENCES part(part_id) ON DELETE RESTRICT
);

CREATE INDEX idx_part_req_est_line ON part_request(estimate_line_id);
CREATE INDEX idx_part_req_so_line ON part_request(sale_order_line_id);
CREATE INDEX idx_part_req_part_status ON part_request(part_id, status);
CREATE INDEX idx_part_req_status ON part_request(status);

-- -----------------------------------------------------------------------------
-- 14. stock_movement: Append-only physical and reserved inventory ledger
-- -----------------------------------------------------------------------------
CREATE TABLE stock_movement (
    movement_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    part_id BIGINT NOT NULL,
    movement_type VARCHAR(20) NOT NULL,
    delta_on_hand INT NOT NULL,
    delta_reserved INT NOT NULL,
    part_request_id BIGINT NULL,
    po_line_id BIGINT NULL,
    reason VARCHAR(255) NULL,
    user_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_sm_type CHECK (movement_type IN ('RECEIPT', 'RESERVE', 'RELEASE', 'ISSUE', 'RETURN', 'ADJUST')),
    CONSTRAINT chk_sm_adjust_reason CHECK (movement_type <> 'ADJUST' OR (reason IS NOT NULL AND LENGTH(TRIM(reason)) > 0)),
    CONSTRAINT fk_sm_part FOREIGN KEY (part_id) REFERENCES part(part_id) ON DELETE RESTRICT,
    CONSTRAINT fk_sm_part_request FOREIGN KEY (part_request_id) REFERENCES part_request(request_id) ON DELETE SET NULL,
    CONSTRAINT fk_sm_po_line FOREIGN KEY (po_line_id) REFERENCES po_line(po_line_id) ON DELETE SET NULL,
    CONSTRAINT fk_sm_user FOREIGN KEY (user_id) REFERENCES user_account(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_sm_part_created ON stock_movement(part_id, created_at);
CREATE INDEX idx_sm_type ON stock_movement(movement_type);
CREATE INDEX idx_sm_part_request ON stock_movement(part_request_id);
CREATE INDEX idx_sm_po_line ON stock_movement(po_line_id);
CREATE INDEX idx_sm_created_at ON stock_movement(created_at);

-- -----------------------------------------------------------------------------
-- 15. invoice: Commercial invoice for repairs or retail counter sales
-- -----------------------------------------------------------------------------
CREATE TABLE invoice (
    invoice_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(50) NOT NULL UNIQUE,
    repair_id BIGINT NULL,
    sale_id BIGINT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    insurance_covered DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    customer_due DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    issued_by BIGINT NOT NULL,
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_invoice_source CHECK ((repair_id IS NOT NULL) <> (sale_id IS NOT NULL)),
    CONSTRAINT chk_invoice_status CHECK (status IN ('ISSUED', 'VOID')),
    CONSTRAINT chk_invoice_financials CHECK (subtotal >= 0.00 AND insurance_covered >= 0.00 AND customer_due >= 0.00),
    CONSTRAINT fk_invoice_repair FOREIGN KEY (repair_id) REFERENCES repair_order(repair_id) ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_sale FOREIGN KEY (sale_id) REFERENCES sale_order(sale_id) ON DELETE RESTRICT,
    CONSTRAINT fk_invoice_issued_by FOREIGN KEY (issued_by) REFERENCES user_account(user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_invoice_repair ON invoice(repair_id);
CREATE INDEX idx_invoice_sale ON invoice(sale_id);
CREATE INDEX idx_invoice_status ON invoice(status);
CREATE INDEX idx_invoice_issued_at ON invoice(issued_at);

-- -----------------------------------------------------------------------------
-- 16. invoice_line: Immutable price and quantity snapshot of billed items
-- -----------------------------------------------------------------------------
CREATE TABLE invoice_line (
    line_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    part_id BIGINT NULL,
    description VARCHAR(255) NOT NULL,
    qty INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    CONSTRAINT chk_inv_line_qty CHECK (qty > 0),
    CONSTRAINT chk_inv_line_prices CHECK (unit_price >= 0.00 AND line_total >= 0.00),
    CONSTRAINT fk_inv_line_invoice FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_line_part FOREIGN KEY (part_id) REFERENCES part(part_id) ON DELETE RESTRICT
);

CREATE INDEX idx_inv_line_invoice ON invoice_line(invoice_id);
CREATE INDEX idx_inv_line_part ON invoice_line(part_id);

-- -----------------------------------------------------------------------------
-- 17. payment: Financial settlements from customer or insurer
-- -----------------------------------------------------------------------------
CREATE TABLE payment (
    payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT NOT NULL,
    payer_type VARCHAR(20) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    received_by BIGINT NOT NULL,
    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_payment_payer CHECK (payer_type IN ('CUSTOMER', 'INSURER')),
    CONSTRAINT chk_payment_amount CHECK (amount > 0.00),
    CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES invoice(invoice_id) ON DELETE RESTRICT,
    CONSTRAINT fk_payment_received_by FOREIGN KEY (received_by) REFERENCES user_account(user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_payment_invoice ON payment(invoice_id);
CREATE INDEX idx_payment_paid_at ON payment(paid_at);
CREATE INDEX idx_payment_payer ON payment(payer_type);

-- -----------------------------------------------------------------------------
-- 18. status_log: Append-only audit trail of lifecycle status transitions
-- -----------------------------------------------------------------------------
CREATE TABLE status_log (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(30) NOT NULL,
    entity_id BIGINT NOT NULL,
    from_status VARCHAR(50) NULL,
    to_status VARCHAR(50) NOT NULL,
    user_id BIGINT NULL,
    note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_status_log_type CHECK (entity_type IN ('REPAIR', 'ESTIMATE', 'PART_REQUEST', 'SALE', 'PO', 'PART', 'STOCK', 'USER', 'BAY')),
    CONSTRAINT fk_status_log_user FOREIGN KEY (user_id) REFERENCES user_account(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_status_log_entity ON status_log(entity_type, entity_id);
CREATE INDEX idx_status_log_created_at ON status_log(created_at);
CREATE INDEX idx_status_log_user ON status_log(user_id);
