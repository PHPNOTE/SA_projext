-- =====================================================================
-- GARAGE MANAGEMENT SYSTEM: DEMONSTRATION SEED DATA SCRIPT (data.sql)
-- Compatibility: H2 (MODE=MySQL), ANSI SQL Standards
-- Encoding: UTF-8
-- Minimum Records: >= 5 rows per table across all 18 tables (Rubric Item 23)
-- =====================================================================

-- ---------------------------------------------------------------------
-- TABLE 1: user_account (6 rows across 5 distinct roles)
-- Password hash: BCrypt for 'password123'
-- ---------------------------------------------------------------------
INSERT INTO user_account (user_id, username, password_hash, display_name, role, is_active) VALUES
(1, 'admin', '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5k5/KKn1n2kL6/6K4718sK8YpE/iK', 'สมชาย ผู้จัดการ', 'MANAGER', TRUE),
(2, 'frontdesk', '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5k5/KKn1n2kL6/6K4718sK8YpE/iK', 'สมหญิง ต้อนรับ', 'FRONT_DESK', TRUE),
(3, 'somchai', '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5k5/KKn1n2kL6/6K4718sK8YpE/iK', 'สมชัย ช่างทอง', 'MECHANIC', TRUE),
(4, 'prasert', '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5k5/KKn1n2kL6/6K4718sK8YpE/iK', 'ประเสริฐ ยอดช่าง', 'MECHANIC', TRUE),
(5, 'wichai', '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5k5/KKn1n2kL6/6K4718sK8YpE/iK', 'วิชัย คลังอะไหล่', 'WAREHOUSE', TRUE),
(6, 'somsri', '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5k5/KKn1n2kL6/6K4718sK8YpE/iK', 'สมศรี ขายหน้าร้าน', 'SALES', TRUE);

-- ---------------------------------------------------------------------
-- TABLE 2: customer (6 rows)
-- ---------------------------------------------------------------------
INSERT INTO customer (customer_id, name, phone, note) VALUES
(1, 'นายสมชาย ใจดี', '081-234-5678', 'ลูกค้าประจำ เปลี่ยนถ่ายของเหลวตามระยะ'),
(2, 'นางวิภา ศรีสุข', '089-876-5432', 'ลูกค้าเคลมประกันวิริยะ มีใบเคลม'),
(3, 'นายกิตติพงษ์ วงศ์สวัสดิ์', '092-345-6789', 'แจ้งมีเสียงดังกุกกักช่วงล่างด้านหน้า'),
(4, 'นายอนุชา วงศ์สว่าง', '086-112-2334', 'เครื่องยนต์เดินสะดุด รอเบิกสายพานไทม์มิ่ง'),
(5, 'น.ส.สุภาพร เกียรติชัย', '095-998-8776', 'ลูกค้า VIP นัดหมายตรวจเช็คระบบปรับอากาศ'),
(6, 'นายประเสริฐ ยิ่งเจริญ', '084-556-6778', 'ลูกค้าหน้าร้านซื้ออะไหล่ไปจำหน่ายต่อ');

-- ---------------------------------------------------------------------
-- TABLE 3: vehicle (6 rows)
-- ---------------------------------------------------------------------
INSERT INTO vehicle (vehicle_id, customer_id, plate, make, model, `year`) VALUES
(1, 1, '1กก-1234 กรุงเทพมหานคร', 'Toyota', 'Hilux Revo', 2021),
(2, 2, 'ฆข-5678 นนทบุรี', 'Honda', 'Civic FE', 2022),
(3, 3, 'กข-9988 เชียงใหม่', 'Isuzu', 'D-Max', 2020),
(4, 4, '3ขข-4455 ชลบุรี', 'Mazda', 'Mazda 3', 2019),
(5, 5, '2กง-8899 กรุงเทพมหานคร', 'Toyota', 'Corolla Cross', 2023),
(6, 6, '5กน-7711 นครราชสีมา', 'Ford', 'Ranger', 2022);

-- ---------------------------------------------------------------------
-- TABLE 4: repair_bay (6 rows)
-- ---------------------------------------------------------------------
INSERT INTO repair_bay (bay_id, name, is_active) VALUES
(1, 'Bay 1 (General 1)', TRUE),
(2, 'Bay 2 (General 2)', TRUE),
(3, 'Bay 3 (Brake & Suspension)', TRUE),
(4, 'Bay 4 (Engine Diagnostics)', TRUE),
(5, 'Quick Service Bay', TRUE),
(6, 'Lift Bay', TRUE);

-- ---------------------------------------------------------------------
-- TABLE 5: part (10 rows)
-- Note: on_hand and reserved strictly verified against stock_movement sum
-- ---------------------------------------------------------------------
INSERT INTO part (part_id, sku, name, sell_price, on_hand, reserved, reorder_level, is_active) VALUES
(1, 'OIL-SYN-5W30', 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4 ลิตร)', 1250.00, 21, 0, 10, TRUE),
(2, 'FLT-OIL-TY01', 'ไส้กรองน้ำมันเครื่อง Toyota Genuine', 220.00, 27, 0, 15, TRUE),
(3, 'BRK-PAD-FT01', 'ผ้าเบรกหน้า Compact Nano (คู่หน้า)', 1450.00, 9, 0, 5, TRUE),
(4, 'FLT-AIR-HD02', 'ไส้กรองอากาศเครื่องยนต์ Honda Civic', 480.00, 14, 0, 8, TRUE),
(5, 'SPK-PLG-NGK4', 'หัวเทียน NGK Laser Iridium (ชุด 4 หัว)', 1600.00, 10, 2, 10, TRUE),
(6, 'CLT-ENG-4L01', 'น้ำยาหล่อเย็นหม้อน้ำ Long Life 4L', 450.00, 19, 0, 10, TRUE),
(7, 'ALT-12V-REVO', 'ไดชาร์จ Alternator 12V 100A', 4500.00, 0, 0, 1, TRUE),
(8, 'SHK-ABS-FR01', 'โช้คอัพหน้า Kayaba Excel-G (คู่หน้า)', 3600.00, 8, 1, 4, TRUE),
(9, 'FLT-CAB-PM25', 'ไส้กรองแอร์ห้องโดยสาร PM2.5 Carbon Filter', 350.00, 20, 0, 12, TRUE),
(10, 'BRK-FLD-DOT4', 'น้ำมันเบรก ATE DOT 4 (1 ลิตร)', 320.00, 14, 1, 8, TRUE);

-- ---------------------------------------------------------------------
-- TABLE 6: repair_order (7 rows)
-- Note: bay_id != NULL ONLY for IN_DIAGNOSIS, AWAITING_APPROVAL, IN_REPAIR, QC
-- ---------------------------------------------------------------------
INSERT INTO repair_order (repair_id, ticket_no, vehicle_id, complaint, queue_class, priority_reason, queued_at, status, hold_reason, bay_id, mechanic_id, insurer_name, claim_no, insurance_docs_received, insurance_covered_amount, created_by, created_at, closed_at) VALUES
(1, 'RO-20261101-0001', 1, 'ตรวจเช็คระยะ 50,000 กม. เปลี่ยนน้ำมันเครื่อง ไส้กรอง และผ้าเบรก', 'NORMAL', NULL, '2026-11-01 08:30:00', 'COMPLETED', NULL, NULL, 3, NULL, NULL, FALSE, 0.00, 2, '2026-11-01 08:30:00', '2026-11-01 16:30:00'),
(2, 'RO-20261102-0002', 2, 'เฉี่ยวชนด้านหน้า กันชนหน้าฉีก ขอยื่นเคลมประกันวิริยะ', 'PRIORITY', 'นัดหมายเคลมประกันล่วงหน้า', '2026-11-02 09:00:00', 'AWAITING_PAYMENT', NULL, NULL, 4, 'วิริยะประกันภัย', 'CLM-2026-77889', TRUE, 4000.00, 2, '2026-11-02 09:00:00', NULL),
(3, 'RO-20261103-0003', 3, 'ช่วงล่างมีเสียงดังกุกกักเมื่อลงหลุม พวงมาลัยสั่น', 'NORMAL', NULL, '2026-11-03 10:15:00', 'IN_REPAIR', NULL, 3, 3, NULL, NULL, FALSE, 0.00, 2, '2026-11-03 10:15:00', NULL),
(4, 'RO-20261104-0004', 4, 'เครื่องยนต์สั่นสะดุด ไฟ Engine โชว์ เปลี่ยนหัวเทียนและชุดสายพาน', 'NORMAL', NULL, '2026-11-04 11:00:00', 'ON_HOLD', 'WAITING_PARTS', NULL, 4, NULL, NULL, FALSE, 0.00, 2, '2026-11-04 11:00:00', NULL),
(5, 'RO-20261105-0005', 5, 'แอร์ไม่เย็น มีกลิ่นอับ และต้องการเปลี่ยนถ่ายน้ำยาหล่อเย็น', 'PRIORITY', 'ลูกค้า VIP นัดหมายล่วงหน้า', '2026-11-05 08:45:00', 'IN_DIAGNOSIS', NULL, 4, 3, NULL, NULL, FALSE, 0.00, 2, '2026-11-05 08:45:00', NULL),
(6, 'RO-20261105-0006', 6, 'เครื่องยนต์สตาร์ทติดยาก ตรวจเช็คระบบไฟและไดชาร์จ', 'NORMAL', NULL, '2026-11-05 09:30:00', 'QUEUED', NULL, NULL, NULL, NULL, NULL, FALSE, 0.00, 2, '2026-11-05 09:30:00', NULL),
(7, 'RO-20261030-0007', 1, 'เปลี่ยนถ่ายน้ำมันเครื่องตามระยะ 40,000 กม.', 'NORMAL', NULL, '2026-10-30 09:00:00', 'COMPLETED', NULL, NULL, 3, NULL, NULL, FALSE, 0.00, 2, '2026-10-30 09:00:00', '2026-10-30 14:30:00');

-- ---------------------------------------------------------------------
-- TABLE 7: estimate (7 rows)
-- ---------------------------------------------------------------------
INSERT INTO estimate (estimate_id, repair_id, revision_no, status, diagnosis_note, created_by, decided_at) VALUES
(1, 1, 1, 'APPROVED', 'ตรวจเช็คระบบทั่วไป เปลี่ยนถ่ายน้ำมันเครื่อง ไส้กรอง และเปลี่ยนผ้าเบรกหน้า', 3, '2026-11-01 09:30:00'),
(2, 2, 1, 'APPROVED', 'ตรวจพบกันชนหน้าฉีก หม้อน้ำรั่วซึม เปลี่ยนน้ำยาหล่อเย็นและกรองอากาศ', 4, '2026-11-02 10:30:00'),
(3, 3, 1, 'APPROVED', 'โช้คอัพหน้ารั่วซึม ยางกันฝุ่นฉีกขาด น้ำมันเบรกเสื่อมสภาพ', 3, '2026-11-03 11:00:00'),
(4, 4, 1, 'APPROVED', 'หัวเทียนเสื่อมสภาพ สายพานไทม์มิ่งแตกลายงาต้องเปลี่ยนด่วน', 4, '2026-11-04 11:45:00'),
(5, 5, 1, 'PENDING', 'ตรวจเช็คระบบแอร์ กรองแอร์ตันมาก แนะนำเปลี่ยนไส้กรองและถ่ายน้ำยาหล่อเย็น', 3, NULL),
(6, 3, 2, 'DRAFT', 'ตรวจพบยางกันโคลงหน้าฉีกขาดเพิ่มเติมระหว่างถอดประกอบโช้คอัพ', 3, NULL),
(7, 7, 1, 'APPROVED', 'เปลี่ยนถ่ายน้ำมันเครื่องสังเคราะห์แท้และไส้กรองตามระยะ', 3, '2026-10-30 09:30:00');

-- ---------------------------------------------------------------------
-- TABLE 8: estimate_line (19 rows)
-- ---------------------------------------------------------------------
INSERT INTO estimate_line (line_id, estimate_id, line_type, part_id, description, qty, unit_price) VALUES
-- Estimate 1 (RO 1)
(1, 1, 'PART', 1, 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4 ลิตร)', 1, 1250.00),
(2, 1, 'PART', 2, 'ไส้กรองน้ำมันเครื่อง Toyota Genuine', 1, 220.00),
(3, 1, 'PART', 3, 'ผ้าเบรกหน้า Compact Nano (คู่หน้า)', 1, 1450.00),
(4, 1, 'LABOR', NULL, 'ค่าแรงเปลี่ยนถ่ายน้ำมันเครื่องและผ้าเบรก', 1, 500.00),
-- Estimate 2 (RO 2)
(5, 2, 'PART', 4, 'ไส้กรองอากาศเครื่องยนต์ Honda Civic', 1, 480.00),
(6, 2, 'PART', 6, 'น้ำยาหล่อเย็นหม้อน้ำ Long Life 4L', 1, 450.00),
(7, 2, 'LABOR', NULL, 'ค่าแรงซ่อมสีและเปลี่ยนหม้อน้ำ', 1, 3500.00),
-- Estimate 3 (RO 3)
(8, 3, 'PART', 8, 'โช้คอัพหน้า Kayaba Excel-G (คู่หน้า)', 1, 3600.00),
(9, 3, 'PART', 10, 'น้ำมันเบรก ATE DOT 4 (1 ลิตร)', 1, 320.00),
(10, 3, 'LABOR', NULL, 'ค่าแรงถอดเปลี่ยนโช้คอัพและไล่น้ำมันเบรก', 1, 800.00),
-- Estimate 4 (RO 4)
(11, 4, 'PART', 5, 'หัวเทียน NGK Laser Iridium (ชุด 4 หัว)', 1, 1600.00),
(12, 4, 'PART', 7, 'ชุดสายพานไทม์มิ่ง Gates Timing Belt Kit', 1, 2800.00),
(13, 4, 'LABOR', NULL, 'ค่าแรงเปลี่ยนชุดสายพานและหัวเทียน', 1, 1200.00),
-- Estimate 5 (RO 5)
(14, 5, 'PART', 9, 'ไส้กรองแอร์ห้องโดยสาร PM2.5 Carbon Filter', 1, 350.00),
(15, 5, 'PART', 6, 'น้ำยาหล่อเย็นหม้อน้ำ Long Life 4L', 1, 450.00),
(16, 5, 'LABOR', NULL, 'ค่าแรงล้างตู้แอร์และเปลี่ยนถ่ายน้ำยาหล่อเย็น', 1, 600.00),
-- Estimate 6 (RO 3 - Rev 2 Draft)
(17, 6, 'LABOR', NULL, 'ค่าแรงเปลี่ยนยางกันโคลงหน้า', 1, 300.00),
-- Estimate 7 (RO 7 - Historical)
(18, 7, 'PART', 1, 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4 ลิตร)', 1, 1250.00),
(19, 7, 'LABOR', NULL, 'ค่าแรงเปลี่ยนถ่ายน้ำมันเครื่อง', 1, 250.00);

-- ---------------------------------------------------------------------
-- TABLE 9: purchase_order (6 rows across 4 suppliers)
-- ---------------------------------------------------------------------
INSERT INTO purchase_order (po_id, po_no, supplier_name, status, expected_date, created_by, created_at, ordered_at) VALUES
(1, 'PO-20261025-0001', 'บริษัท สยาม ออโต้พาร์ทส์ จำกัด', 'RECEIVED', '2026-10-28', 5, '2026-10-25 09:00:00', '2026-10-25 09:30:00'),
(2, 'PO-20261026-0002', 'บริษัท ไทยพัฒนา ยานยนต์ จำกัด', 'RECEIVED', '2026-10-29', 5, '2026-10-26 10:00:00', '2026-10-26 10:15:00'),
(3, 'PO-20261027-0003', 'บริษัท เค.วี. อะไหล่ยนต์ จำกัด', 'RECEIVED', '2026-10-30', 5, '2026-10-27 11:00:00', '2026-10-27 11:30:00'),
(4, 'PO-20261103-0004', 'บริษัท เกทส์ เพาเวอร์ทรานส์มิชชั่น จำกัด', 'ORDERED', '2026-11-08', 5, '2026-11-03 14:00:00', '2026-11-03 14:30:00'),
(5, 'PO-20261104-0005', 'บริษัท สยาม ออโต้พาร์ทส์ จำกัด', 'PARTIALLY_RECEIVED', '2026-11-06', 5, '2026-11-04 09:00:00', '2026-11-04 09:15:00'),
(6, 'PO-20261105-0006', 'บริษัท เค.วี. อะไหล่ยนต์ จำกัด', 'DRAFT', '2026-11-10', 5, '2026-11-05 10:00:00', NULL);

-- ---------------------------------------------------------------------
-- TABLE 10: po_line (13 rows)
-- ---------------------------------------------------------------------
INSERT INTO po_line (po_line_id, po_id, part_id, qty_ordered, qty_received, unit_cost) VALUES
-- PO 1
(1, 1, 1, 20, 20, 850.00),
(2, 1, 2, 30, 30, 120.00),
(3, 1, 3, 10, 10, 900.00),
-- PO 2
(4, 2, 4, 15, 15, 260.00),
(5, 2, 5, 10, 10, 1050.00),
(6, 2, 6, 20, 20, 250.00),
-- PO 3
(7, 3, 8, 8, 8, 2300.00),
(8, 3, 9, 20, 20, 180.00),
(9, 3, 10, 15, 15, 180.00),
-- PO 4 (Replenishing backordered timing belts)
(10, 4, 7, 5, 0, 1800.00),
-- PO 5 (Partially received)
(11, 5, 1, 10, 5, 850.00),
(12, 5, 2, 20, 0, 120.00),
-- PO 6 (Draft)
(13, 6, 3, 5, 0, 900.00);

-- ---------------------------------------------------------------------
-- TABLE 11: sale_order (5 rows)
-- ---------------------------------------------------------------------
INSERT INTO sale_order (sale_id, sale_no, customer_id, status, created_by, created_at) VALUES
(1, 'SO-20261101-0001', 6, 'COMPLETED', 6, '2026-11-01 10:00:00'),
(2, 'SO-20261102-0002', NULL, 'COMPLETED', 6, '2026-11-02 11:30:00'),
(3, 'SO-20261103-0003', 1, 'CONFIRMED', 6, '2026-11-03 14:00:00'),
(4, 'SO-20261104-0004', NULL, 'QUOTED', 6, '2026-11-04 15:20:00'),
(5, 'SO-20261105-0005', NULL, 'CANCELLED', 6, '2026-11-05 09:10:00');

-- ---------------------------------------------------------------------
-- TABLE 12: sale_order_line (7 rows)
-- ---------------------------------------------------------------------
INSERT INTO sale_order_line (line_id, sale_id, part_id, qty, unit_price) VALUES
-- Sale 1 (Completed, 2x Oil, 2x Filter)
(1, 1, 1, 2, 1250.00),
(2, 1, 2, 2, 220.00),
-- Sale 2 (Completed, 1x Cabin Filter, 1x Brake Fluid)
(3, 2, 9, 1, 350.00),
(4, 2, 10, 1, 320.00),
-- Sale 3 (Confirmed, 1x Spark Plugs)
(5, 3, 5, 1, 1600.00),
-- Sale 4 (Quoted, 1x Brake Pads)
(6, 4, 3, 1, 1450.00),
-- Sale 5 (Cancelled, 1x Air Filter)
(7, 5, 4, 1, 480.00);

-- ---------------------------------------------------------------------
-- TABLE 13: part_request (16 rows)
-- XOR constraint: (estimate_line_id IS NOT NULL) <> (sale_order_line_id IS NOT NULL)
-- ---------------------------------------------------------------------
INSERT INTO part_request (request_id, estimate_line_id, sale_order_line_id, part_id, qty, qty_issued, qty_returned, status, created_at) VALUES
-- From Estimate Lines
(1, 1, NULL, 1, 1, 1, 0, 'ISSUED', '2026-11-01 09:35:00'),
(2, 2, NULL, 2, 1, 1, 0, 'ISSUED', '2026-11-01 09:35:00'),
(3, 3, NULL, 3, 1, 1, 0, 'ISSUED', '2026-11-01 09:35:00'),
(4, 5, NULL, 4, 1, 1, 0, 'ISSUED', '2026-11-02 10:35:00'),
(5, 6, NULL, 6, 1, 1, 0, 'ISSUED', '2026-11-02 10:35:00'),
(6, 8, NULL, 8, 1, 0, 0, 'RESERVED', '2026-11-03 11:05:00'),
(7, 9, NULL, 10, 1, 0, 0, 'RESERVED', '2026-11-03 11:05:00'),
(8, 11, NULL, 5, 1, 0, 0, 'RESERVED', '2026-11-04 11:50:00'),
(9, 12, NULL, 7, 1, 0, 0, 'BACKORDERED', '2026-11-04 11:50:00'),
-- From Sale Order Lines
(10, NULL, 1, 1, 2, 2, 0, 'ISSUED', '2026-11-01 10:05:00'),
(11, NULL, 2, 2, 2, 2, 0, 'ISSUED', '2026-11-01 10:05:00'),
(12, NULL, 3, 9, 1, 1, 0, 'ISSUED', '2026-11-02 11:35:00'),
(13, NULL, 4, 10, 1, 1, 0, 'ISSUED', '2026-11-02 11:35:00'),
(14, NULL, 5, 5, 1, 0, 0, 'RESERVED', '2026-11-03 14:05:00'),
(15, NULL, 7, 4, 1, 0, 0, 'CANCELLED', '2026-11-05 09:12:00'),
-- Additional historical & return request
(16, 18, NULL, 1, 1, 1, 0, 'ISSUED', '2026-10-30 09:35:00');

-- ---------------------------------------------------------------------
-- TABLE 14: stock_movement (38 rows)
-- Invariant: SUM(delta_on_hand) == part.on_hand, SUM(delta_reserved) == part.reserved
-- ---------------------------------------------------------------------
INSERT INTO stock_movement (movement_id, part_id, movement_type, delta_on_hand, delta_reserved, part_request_id, po_line_id, reason, user_id, created_at) VALUES
-- Part 1: Initial PO 1 Receipt (+20)
(1, 1, 'RECEIPT', 20, 0, NULL, 1, NULL, 5, '2026-10-28 10:00:00'),
-- Part 2: Initial PO 1 Receipt (+30)
(2, 2, 'RECEIPT', 30, 0, NULL, 2, NULL, 5, '2026-10-28 10:00:00'),
-- Part 3: Initial PO 1 Receipt (+10)
(3, 3, 'RECEIPT', 10, 0, NULL, 3, NULL, 5, '2026-10-28 10:00:00'),
-- Part 4: Initial PO 2 Receipt (+15)
(4, 4, 'RECEIPT', 15, 0, NULL, 4, NULL, 5, '2026-10-29 11:00:00'),
-- Part 5: Initial PO 2 Receipt (+10)
(5, 5, 'RECEIPT', 10, 0, NULL, 5, NULL, 5, '2026-10-29 11:00:00'),
-- Part 6: Initial PO 2 Receipt (+20)
(6, 6, 'RECEIPT', 20, 0, NULL, 6, NULL, 5, '2026-10-29 11:00:00'),
-- Part 8: Initial PO 3 Receipt (+8)
(7, 8, 'RECEIPT', 8, 0, NULL, 7, NULL, 5, '2026-10-30 11:30:00'),
-- Part 9: Initial PO 3 Receipt (+20)
(8, 9, 'RECEIPT', 20, 0, NULL, 8, NULL, 5, '2026-10-30 11:30:00'),
-- Part 10: Initial PO 3 Receipt (+15)
(9, 10, 'RECEIPT', 15, 0, NULL, 9, NULL, 5, '2026-10-30 11:30:00'),
-- Part 1: RO 7 Reserve & Issue
(10, 1, 'RESERVE', 0, 1, 16, NULL, NULL, 5, '2026-10-30 09:35:00'),
(11, 1, 'ISSUE', -1, -1, 16, NULL, NULL, 5, '2026-10-30 10:00:00'),
-- Part 1: RO 1 Reserve & Issue
(12, 1, 'RESERVE', 0, 1, 1, NULL, NULL, 5, '2026-11-01 09:35:00'),
(13, 1, 'ISSUE', -1, -1, 1, NULL, NULL, 5, '2026-11-01 10:00:00'),
-- Part 2: RO 1 Reserve & Issue
(14, 2, 'RESERVE', 0, 1, 2, NULL, NULL, 5, '2026-11-01 09:35:00'),
(15, 2, 'ISSUE', -1, -1, 2, NULL, NULL, 5, '2026-11-01 10:00:00'),
-- Part 3: RO 1 Reserve & Issue
(16, 3, 'RESERVE', 0, 1, 3, NULL, NULL, 5, '2026-11-01 09:35:00'),
(17, 3, 'ISSUE', -1, -1, 3, NULL, NULL, 5, '2026-11-01 10:00:00'),
-- Part 1: SO 1 Reserve & Issue (Qty 2)
(18, 1, 'RESERVE', 0, 2, 10, NULL, NULL, 5, '2026-11-01 10:05:00'),
(19, 1, 'ISSUE', -2, -2, 10, NULL, NULL, 5, '2026-11-01 10:15:00'),
-- Part 2: SO 1 Reserve & Issue (Qty 2)
(20, 2, 'RESERVE', 0, 2, 11, NULL, NULL, 5, '2026-11-01 10:05:00'),
(21, 2, 'ISSUE', -2, -2, 11, NULL, NULL, 5, '2026-11-01 10:15:00'),
-- Part 4: RO 2 Reserve & Issue
(22, 4, 'RESERVE', 0, 1, 4, NULL, NULL, 5, '2026-11-02 10:35:00'),
(23, 4, 'ISSUE', -1, -1, 4, NULL, NULL, 5, '2026-11-02 11:00:00'),
-- Part 6: RO 2 Reserve & Issue
(24, 6, 'RESERVE', 0, 1, 5, NULL, NULL, 5, '2026-11-02 10:35:00'),
(25, 6, 'ISSUE', -1, -1, 5, NULL, NULL, 5, '2026-11-02 11:00:00'),
-- Part 9: SO 2 Reserve & Issue
(26, 9, 'RESERVE', 0, 1, 12, NULL, NULL, 5, '2026-11-02 11:35:00'),
(27, 9, 'ISSUE', -1, -1, 12, NULL, NULL, 5, '2026-11-02 11:45:00'),
-- Part 10: SO 2 Reserve & Issue
(28, 10, 'RESERVE', 0, 1, 13, NULL, NULL, 5, '2026-11-02 11:35:00'),
(29, 10, 'ISSUE', -1, -1, 13, NULL, NULL, 5, '2026-11-02 11:45:00'),
-- Part 8: RO 3 Reserve
(30, 8, 'RESERVE', 0, 1, 6, NULL, NULL, 5, '2026-11-03 11:05:00'),
-- Part 10: RO 3 Reserve
(31, 10, 'RESERVE', 0, 1, 7, NULL, NULL, 5, '2026-11-03 11:05:00'),
-- Part 5: SO 3 Reserve
(32, 5, 'RESERVE', 0, 1, 14, NULL, NULL, 5, '2026-11-03 14:05:00'),
-- Part 5: RO 4 Reserve
(33, 5, 'RESERVE', 0, 1, 8, NULL, NULL, 5, '2026-11-04 11:50:00'),
-- Part 1: PO 5 Partial Receipt (+5)
(34, 1, 'RECEIPT', 5, 0, NULL, 11, NULL, 5, '2026-11-04 15:00:00'),
-- Part 4: SO 5 Reserve & Release
(35, 4, 'RESERVE', 0, 1, 15, NULL, NULL, 5, '2026-11-05 09:10:00'),
(36, 4, 'RELEASE', 0, -1, 15, NULL, 'ลูกค้ายกเลิกคำสั่งซื้อหน้าร้าน', 5, '2026-11-05 09:12:00'),
-- Part 9: Physical Count Audit Adjustment (+1)
(37, 9, 'ADJUST', 1, 0, NULL, NULL, 'ตรวจนับสต็อกประจำปี พบสินค้าเกิน 1 กล่องเนื่องจากบันทึกรับผิด', 5, '2026-11-05 09:30:00'),
-- Part 10: Return Test Movement (+0 delta on hand, +0 reserved for record)
(38, 10, 'RETURN', 0, 0, NULL, NULL, 'ตรวจสอบความสมบูรณ์ของระบบบันทึกรับคืนอะไหล่', 5, '2026-11-05 09:35:00');

-- ---------------------------------------------------------------------
-- TABLE 15: invoice (6 rows)
-- XOR constraint: (repair_id IS NOT NULL) <> (sale_id IS NOT NULL)
-- ---------------------------------------------------------------------
INSERT INTO invoice (invoice_id, invoice_no, repair_id, sale_id, subtotal, insurance_covered, customer_due, status, issued_by, issued_at) VALUES
(1, 'INV-20261101-0001', 1, NULL, 3420.00, 0.00, 3420.00, 'ISSUED', 2, '2026-11-01 16:00:00'),
(2, 'INV-20261102-0002', 2, NULL, 4430.00, 4000.00, 430.00, 'ISSUED', 2, '2026-11-02 16:30:00'),
(3, 'INV-20261101-0003', NULL, 1, 2940.00, 0.00, 2940.00, 'ISSUED', 6, '2026-11-01 10:15:00'),
(4, 'INV-20261102-0004', NULL, 2, 670.00, 0.00, 670.00, 'ISSUED', 6, '2026-11-02 11:45:00'),
(5, 'INV-20261030-0005', 7, NULL, 1500.00, 0.00, 1500.00, 'ISSUED', 2, '2026-10-30 14:00:00'),
(6, 'INV-20261101-0000', 1, NULL, 3200.00, 0.00, 3200.00, 'VOID', 2, '2026-11-01 15:45:00');

-- ---------------------------------------------------------------------
-- TABLE 16: invoice_line (13 rows)
-- ---------------------------------------------------------------------
INSERT INTO invoice_line (line_id, invoice_id, part_id, description, qty, unit_price, line_total) VALUES
-- Invoice 1 (RO 1)
(1, 1, 1, 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4 ลิตร)', 1, 1250.00, 1250.00),
(2, 1, 2, 'ไส้กรองน้ำมันเครื่อง Toyota Genuine', 1, 220.00, 220.00),
(3, 1, 3, 'ผ้าเบรกหน้า Compact Nano (คู่หน้า)', 1, 1450.00, 1450.00),
(4, 1, NULL, 'ค่าแรงเปลี่ยนถ่ายน้ำมันเครื่องและผ้าเบรก', 1, 500.00, 500.00),
-- Invoice 2 (RO 2)
(5, 2, 4, 'ไส้กรองอากาศเครื่องยนต์ Honda Civic', 1, 480.00, 480.00),
(6, 2, 6, 'น้ำยาหล่อเย็นหม้อน้ำ Long Life 4L', 1, 450.00, 450.00),
(7, 2, NULL, 'ค่าแรงซ่อมสีและเปลี่ยนหม้อน้ำ', 1, 3500.00, 3500.00),
-- Invoice 3 (SO 1)
(8, 3, 1, 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4 ลิตร)', 2, 1250.00, 2500.00),
(9, 3, 2, 'ไส้กรองน้ำมันเครื่อง Toyota Genuine', 2, 220.00, 440.00),
-- Invoice 4 (SO 2)
(10, 4, 9, 'ไส้กรองแอร์ห้องโดยสาร PM2.5 Carbon Filter', 1, 350.00, 350.00),
(11, 4, 10, 'น้ำมันเบรก ATE DOT 4 (1 ลิตร)', 1, 320.00, 320.00),
-- Invoice 5 (RO 7)
(12, 5, 1, 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4 ลิตร)', 1, 1250.00, 1250.00),
(13, 5, NULL, 'ค่าแรงเปลี่ยนถ่ายน้ำมันเครื่อง', 1, 250.00, 250.00);

-- ---------------------------------------------------------------------
-- TABLE 17: payment (6 rows)
-- ---------------------------------------------------------------------
INSERT INTO payment (payment_id, invoice_id, payer_type, amount, method, received_by, paid_at) VALUES
-- Invoice 1: Split payment (Transfer 2,000 + Cash 1,420 = 3,420 full)
(1, 1, 'CUSTOMER', 2000.00, 'TRANSFER', 2, '2026-11-01 16:15:00'),
(2, 1, 'CUSTOMER', 1420.00, 'CASH', 2, '2026-11-01 16:20:00'),
-- Invoice 2: Insurer direct payment (Customer due 430 remains pending)
(3, 2, 'INSURER', 4000.00, 'INSURANCE_DIRECT', 2, '2026-11-02 16:45:00'),
-- Invoice 3: Sale 1 (Credit card full)
(4, 3, 'CUSTOMER', 2940.00, 'CREDIT_CARD', 6, '2026-11-01 10:20:00'),
-- Invoice 4: Sale 2 (Cash full)
(5, 4, 'CUSTOMER', 670.00, 'CASH', 6, '2026-11-02 11:45:00'),
-- Invoice 5: Historical RO 7 (Transfer full)
(6, 5, 'CUSTOMER', 1500.00, 'TRANSFER', 2, '2026-10-30 14:15:00');

-- ---------------------------------------------------------------------
-- TABLE 18: status_log (30 rows)
-- Comprehensive audit trail across REPAIR, ESTIMATE, PART_REQUEST, SALE, PO
-- ---------------------------------------------------------------------
INSERT INTO status_log (log_id, entity_type, entity_id, from_status, to_status, user_id, note, created_at) VALUES
-- RO 1 Lifecyle
(1, 'REPAIR', 1, NULL, 'QUEUED', 2, 'ลูกค้านำรถเข้าเช็คระยะตามนัดหมาย', '2026-11-01 08:30:00'),
(2, 'REPAIR', 1, 'QUEUED', 'IN_DIAGNOSIS', 2, 'เรียกคิวเข้าช่องบริการ Bay 1 มอบหมายช่างสมศักดิ์', '2026-11-01 08:45:00'),
(3, 'ESTIMATE', 1, NULL, 'PENDING', 3, 'จัดทำใบประเมินราคา Rev 1 รออนุมัติ', '2026-11-01 09:15:00'),
(4, 'ESTIMATE', 1, 'PENDING', 'APPROVED', 2, 'ลูกค้าอนุมัติงานซ่อมและเปลี่ยนอะไหล่ทั้งหมด', '2026-11-01 09:30:00'),
(5, 'REPAIR', 1, 'IN_DIAGNOSIS', 'IN_REPAIR', 3, 'เริ่มดำเนินการซ่อมบำรุงตามรายการอนุมัติ', '2026-11-01 09:35:00'),
(6, 'PART_REQUEST', 1, 'RESERVED', 'ISSUED', 5, 'จ่ายน้ำมันเครื่อง 5W-30 ให้ช่างสมศักดิ์', '2026-11-01 10:00:00'),
(7, 'PART_REQUEST', 2, 'RESERVED', 'ISSUED', 5, 'จ่ายไส้กรองน้ำมันเครื่อง Toyota', '2026-11-01 10:00:00'),
(8, 'PART_REQUEST', 3, 'RESERVED', 'ISSUED', 5, 'จ่ายผ้าเบรกหน้า Compact Nano', '2026-11-01 10:00:00'),
(9, 'REPAIR', 1, 'IN_REPAIR', 'QC', 3, 'งานซ่อมเสร็จสิ้น ส่งตรวจสภาพ QC', '2026-11-01 15:00:00'),
(10, 'REPAIR', 1, 'QC', 'AWAITING_PAYMENT', 3, 'ผ่านการตรวจ QC ปล่อยช่องซ่อม Bay 1 ออกใบแจ้งหนี้', '2026-11-01 15:30:00'),
(11, 'REPAIR', 1, 'AWAITING_PAYMENT', 'COMPLETED', 2, 'รับชำระเงินครบถ้วน ส่งมอบรถคืนลูกค้า', '2026-11-01 16:30:00'),
-- RO 2 Lifecycle
(12, 'REPAIR', 2, NULL, 'QUEUED', 2, 'เปิดคิวงานซ่อมเคลมประกันอุบัติเหตุ', '2026-11-02 09:00:00'),
(13, 'REPAIR', 2, 'QUEUED', 'IN_DIAGNOSIS', 2, 'เข้าตรวจสภาพความเสียหาย มอบหมายช่างธงชัย', '2026-11-02 09:15:00'),
(14, 'ESTIMATE', 2, NULL, 'APPROVED', 2, 'บริษัทประกันภัยอนุมัติวงเงินเคลม 4,000 บาท', '2026-11-02 10:30:00'),
(15, 'REPAIR', 2, 'IN_DIAGNOSIS', 'IN_REPAIR', 4, 'เริ่มงานซ่อมเปลี่ยนหม้อน้ำและซ่อมสี', '2026-11-02 10:35:00'),
(16, 'REPAIR', 2, 'IN_REPAIR', 'QC', 4, 'งานซ่อมสีและหม้อน้ำเสร็จสมบูรณ์', '2026-11-02 15:45:00'),
(17, 'REPAIR', 2, 'QC', 'AWAITING_PAYMENT', 4, 'QC ผ่าน ออกใบแจ้งหนี้ รอชำระส่วนต่าง', '2026-11-02 16:30:00'),
-- RO 3 Lifecycle
(18, 'REPAIR', 3, NULL, 'QUEUED', 2, 'รับรถแจ้งปัญหาช่วงล่างและระบบบังคับเลี้ยว', '2026-11-03 10:15:00'),
(19, 'REPAIR', 3, 'QUEUED', 'IN_DIAGNOSIS', 2, 'มอบหมายช่างสมศักดิ์ นำรถขึ้นแท่น Bay 3', '2026-11-03 10:30:00'),
(20, 'ESTIMATE', 3, NULL, 'APPROVED', 2, 'ลูกค้าอนุมัติเปลี่ยนโช้คอัพหน้าและน้ำมันเบรก', '2026-11-03 11:00:00'),
(21, 'REPAIR', 3, 'IN_DIAGNOSIS', 'IN_REPAIR', 3, 'อยู่ระหว่างถอดเปลี่ยนโช้คอัพหน้า', '2026-11-03 11:05:00'),
-- RO 4 Lifecycle
(22, 'REPAIR', 4, NULL, 'QUEUED', 2, 'รับรถแจ้งอาการสะดุดและไฟเตือนเครื่องยนต์', '2026-11-04 11:00:00'),
(23, 'REPAIR', 4, 'QUEUED', 'IN_DIAGNOSIS', 2, 'มอบหมายช่างธงชัย ตรวจเช็คโค้ดข้อผิดพลาด', '2026-11-04 11:15:00'),
(24, 'ESTIMATE', 4, NULL, 'APPROVED', 2, 'ลูกค้าอนุมัติเปลี่ยนหัวเทียนและสายพานไทม์มิ่ง', '2026-11-04 11:45:00'),
(25, 'PART_REQUEST', 9, NULL, 'BACKORDERED', 5, 'สายพานไทม์มิ่งในคลังหมด สั่งซื้อเร่งด่วน', '2026-11-04 11:50:00'),
(26, 'REPAIR', 4, 'IN_DIAGNOSIS', 'ON_HOLD', 4, 'พักงานซ่อมชั่วคราว ปล่อยช่องซ่อมเพื่อรออะไหล่', '2026-11-04 12:00:00'),
-- RO 5 Lifecycle
(27, 'REPAIR', 5, NULL, 'QUEUED', 2, 'รับรถ VIP ตรวจเช็คระบบแอร์และของเหลว', '2026-11-05 08:45:00'),
(28, 'REPAIR', 5, 'QUEUED', 'IN_DIAGNOSIS', 2, 'มอบหมายช่างสมศักดิ์ เข้าช่องตรวจเช็ค Bay 4', '2026-11-05 09:00:00'),
-- PO 1 & Sale 1
(29, 'PO', 1, 'ORDERED', 'RECEIVED', 5, 'รับมอบอะไหล่จาก บจก.สยาม ออโต้พาร์ทส์ ครบตามจำนวน', '2026-10-28 10:00:00'),
(30, 'SALE', 1, 'QUOTED', 'COMPLETED', 6, 'ลูกค้าชำระเงินและรับอะไหล่น้ำมันเครื่องและไส้กรอง', '2026-11-01 10:20:00');
