import { INITIAL_USERS, INITIAL_BAYS, INITIAL_PARTS, INITIAL_CUSTOMERS, INITIAL_VEHICLES, uniqueId } from './test_fixtures.mjs';

/**
 * High-fidelity in-memory state engine and contract simulator.
 * Strictly implements the 18-table relational data model, 17 use cases (R1-R6, W1-W7, S1-S2, A1-A2),
 * state machines, and invariants specified in diagram_specs.md and PROJECT.md.
 */
export class MockGarageServer {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.bays = JSON.parse(JSON.stringify(INITIAL_BAYS));
    this.parts = JSON.parse(JSON.stringify(INITIAL_PARTS));
    this.customers = JSON.parse(JSON.stringify(INITIAL_CUSTOMERS));
    this.vehicles = JSON.parse(JSON.stringify(INITIAL_VEHICLES));

    this.repairOrders = [];
    this.estimates = [];
    this.estimateLines = [];
    this.partRequests = [];
    this.stockMovements = [];
    this.purchaseOrders = [];
    this.poLines = [];
    this.saleOrders = [];
    this.saleOrderLines = [];
    this.invoices = [];
    this.invoiceLines = [];
    this.payments = [];
    this.statusLogs = [];

    // Seed initial stock movements for baseline invariant tracking
    for (const p of this.parts) {
      if (p.onHand > 0) {
        this.stockMovements.push({
          movementId: uniqueId('MOV'),
          partId: p.id,
          movementType: 'RECEIPT',
          deltaOnHand: p.onHand,
          deltaReserved: 0,
          reason: 'Initial Opening Stock',
          userId: 1,
          createdAt: new Date().toISOString()
        });
      }
    }

    this.nextId = 100;
  }

  logStatus(entityType, entityId, fromStatus, toStatus, userId = 1, note = null) {
    this.statusLogs.push({
      logId: ++this.nextId,
      entityType,
      entityId,
      fromStatus,
      toStatus,
      userId,
      note,
      createdAt: new Date().toISOString()
    });
  }

  // --- Auth & RBAC ---
  handleLogin(body) {
    const { username, password } = body;
    if (!username || !password) {
      return { status: 400, body: { error: 'Username and password required' } };
    }
    const user = this.users.find(u => u.username === username && u.isActive);
    if (!user) {
      return { status: 401, body: { error: 'Invalid credentials or inactive account' } };
    }
    const token = `mock-token-${user.id}-${user.role}`;
    return {
      status: 200,
      body: {
        token,
        user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role }
      }
    };
  }

  // --- R1: Check-in & Queue ---
  handleCheckin(body, user) {
    if (!body.customerPhone || !body.customerName) {
      return { status: 400, body: { error: 'Customer name and phone required', code: 'VALIDATION_ERROR' } };
    }
    if (!body.licensePlate || body.licensePlate.trim() === '') {
      return { status: 400, body: { error: 'License plate required', code: 'VALIDATION_ERROR' } };
    }
    if (body.queueClass === 'PRIORITY' && (!body.priorityReason || body.priorityReason.trim() === '')) {
      return { status: 400, body: { error: 'Priority reason mandatory for PRIORITY queue', code: 'VALIDATION_ERROR' } };
    }

    let customer = this.customers.find(c => c.phone === body.customerPhone);
    if (!customer) {
      customer = { id: ++this.nextId, name: body.customerName, phone: body.customerPhone, note: body.customerNote || null };
      this.customers.push(customer);
    }

    let vehicle = this.vehicles.find(v => v.plate === body.licensePlate);
    if (!vehicle) {
      vehicle = {
        id: ++this.nextId,
        customerId: customer.id,
        plate: body.licensePlate,
        make: body.make || 'Toyota',
        model: body.model || 'Unknown',
        year: body.year || 2022
      };
      this.vehicles.push(vehicle);
    }

    // Check active ticket duplicate constraint
    const activeTicket = this.repairOrders.find(
      r => r.vehicleId === vehicle.id && !['COMPLETED', 'CANCELLED'].includes(r.status)
    );
    if (activeTicket) {
      return { status: 409, body: { error: 'Active repair order already exists for vehicle', code: 'DUPLICATE_TICKET' } };
    }

    const queuedAt = body.queuedAt ? new Date(body.queuedAt) : new Date();
    const repairId = ++this.nextId;
    const ticketNo = `TICK-${Date.now()}-${repairId}`;
    const repair = {
      repairId,
      ticketNo,
      vehicleId: vehicle.id,
      complaint: body.complaint || 'ตรวจเช็คตามระยะ',
      queueClass: body.queueClass || 'NORMAL',
      priorityReason: body.queueClass === 'PRIORITY' ? body.priorityReason : null,
      queuedAt: queuedAt.toISOString(),
      status: 'QUEUED',
      holdReason: null,
      bayId: null,
      mechanicId: null,
      insurerName: body.insurerName || null,
      claimNo: body.claimNo || null,
      insuranceDocsReceived: Boolean(body.insuranceDocsReceived),
      insuranceCoveredAmount: Number(body.insuranceCoveredAmount || 0),
      createdBy: user?.id || 2,
      createdAt: new Date().toISOString(),
      closedAt: null
    };

    this.repairOrders.push(repair);
    this.logStatus('REPAIR', repairId, null, 'QUEUED', user?.id || 2, 'Registered & Queued');

    return { status: 200, body: repair };
  }

  // --- R2: Queue Call Next (Algorithm 1) ---
  handleCallNext(body, user) {
    const { bayId, mechanicId } = body;
    if (!bayId || !mechanicId) {
      return { status: 400, body: { error: 'bayId and mechanicId required', code: 'VALIDATION_ERROR' } };
    }

    // Single-active-bay invariant guard
    const HOLDING_STATUSES = ['IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'QC'];
    const bayOccupied = this.repairOrders.some(r => r.bayId === bayId && HOLDING_STATUSES.includes(r.status));
    if (bayOccupied) {
      return { status: 409, body: { error: 'Selected bay is currently occupied by active job', code: 'NO_FREE_BAY' } };
    }

    // Algorithm 1: Priority + 120-minute aging
    const now = Date.now();
    const queuedOrders = this.repairOrders.filter(r => r.status === 'QUEUED');
    if (queuedOrders.length === 0) {
      return { status: 409, body: { error: 'Queue is currently empty', code: 'EMPTY_QUEUE' } };
    }

    queuedOrders.sort((a, b) => {
      const aWaitingMin = (now - new Date(a.queuedAt).getTime()) / (1000 * 60);
      const bWaitingMin = (now - new Date(b.queuedAt).getTime()) / (1000 * 60);

      const aTier = (a.queueClass === 'PRIORITY' || aWaitingMin >= 120) ? 0 : 1;
      const bTier = (b.queueClass === 'PRIORITY' || bWaitingMin >= 120) ? 0 : 1;

      if (aTier !== bTier) return aTier - bTier;
      return new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime();
    });

    const chosen = queuedOrders[0];
    const fromStatus = chosen.status;

    // Check if resuming an approved job whose parts are all reserved
    const approvedEst = this.estimates.find(e => e.repairId === chosen.repairId && e.status === 'APPROVED');
    const hasApprovedLines = approvedEst && this.estimateLines.some(el => el.estimateId === approvedEst.estimateId);
    const targetStatus = hasApprovedLines ? 'IN_REPAIR' : 'IN_DIAGNOSIS';

    chosen.status = targetStatus;
    chosen.bayId = bayId;
    chosen.mechanicId = mechanicId;
    chosen.holdReason = null;

    this.logStatus('REPAIR', chosen.repairId, fromStatus, targetStatus, user?.id || 2, `Called next: Bay ${bayId}`);
    return { status: 200, body: chosen };
  }

  // --- R2: Hold & Cancel & Priority Override ---
  handleHoldRepair(id, body, user) {
    const repair = this.repairOrders.find(r => r.repairId === Number(id));
    if (!repair) return { status: 404, body: { error: 'Repair order not found' } };
    if (!['IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR'].includes(repair.status)) {
      return { status: 409, body: { error: `Cannot hold from status ${repair.status}`, code: 'INVALID_STATUS' } };
    }
    const fromStatus = repair.status;
    repair.status = 'ON_HOLD';
    repair.holdReason = body.holdReason || 'WAITING_PARTS';
    repair.bayId = null; // Bay is released!
    this.logStatus('REPAIR', repair.repairId, fromStatus, 'ON_HOLD', user?.id || 2, repair.holdReason);
    return { status: 200, body: repair };
  }

  handleCancelRepair(id, body, user) {
    const repair = this.repairOrders.find(r => r.repairId === Number(id));
    if (!repair) return { status: 404, body: { error: 'Repair order not found' } };
    if (['COMPLETED', 'CANCELLED'].includes(repair.status)) {
      return { status: 409, body: { error: 'Order already finished', code: 'INVALID_STATUS' } };
    }
    const fromStatus = repair.status;
    repair.status = 'CANCELLED';
    repair.bayId = null;

    // Release any reserved stock
    const requests = this.partRequests.filter(pr => {
      const line = this.estimateLines.find(el => el.lineId === pr.estimateLineId);
      return line && this.estimates.some(e => e.estimateId === line.estimateId && e.repairId === repair.repairId);
    });
    for (const pr of requests) {
      if (pr.status === 'RESERVED') {
        const part = this.parts.find(p => p.id === pr.partId);
        if (part) {
          part.reserved -= pr.qty;
          this.stockMovements.push({
            movementId: uniqueId('MOV'),
            partId: part.id,
            movementType: 'RELEASE',
            deltaOnHand: 0,
            deltaReserved: -pr.qty,
            reason: 'Repair Order Cancelled',
            userId: user?.id || 2,
            createdAt: new Date().toISOString()
          });
        }
        pr.status = 'CANCELLED';
      }
    }

    this.logStatus('REPAIR', repair.repairId, fromStatus, 'CANCELLED', user?.id || 2, body.reason || 'Cancelled');
    return { status: 200, body: repair };
  }

  handlePriorityOverride(id, body, user) {
    if (user?.role !== 'MANAGER') {
      return { status: 403, body: { error: 'Only MANAGER can override queue priority', code: 'ACCESS_DENIED' } };
    }
    const repair = this.repairOrders.find(r => r.repairId === Number(id));
    if (!repair) return { status: 404, body: { error: 'Repair order not found' } };
    if (!body.priorityReason) {
      return { status: 400, body: { error: 'Priority reason required', code: 'VALIDATION_ERROR' } };
    }
    repair.queueClass = 'PRIORITY';
    repair.priorityReason = body.priorityReason;
    this.logStatus('REPAIR', repair.repairId, repair.status, repair.status, user.id, `Priority Override: ${body.priorityReason}`);
    return { status: 200, body: repair };
  }

  // --- R3: Diagnostics & Estimates ---
  handleCreateEstimate(body, user) {
    const { repairId, diagnosisNote, lines } = body;
    if (!repairId || !lines || !Array.isArray(lines) || lines.length === 0) {
      return { status: 400, body: { error: 'Repair order ID and at least one line item required', code: 'EMPTY_ESTIMATE' } };
    }
    const repair = this.repairOrders.find(r => r.repairId === Number(repairId));
    if (!repair) return { status: 404, body: { error: 'Repair order not found' } };

    if (!['IN_DIAGNOSIS', 'IN_REPAIR'].includes(repair.status)) {
      return { status: 409, body: { error: `Cannot draft estimate when order is in ${repair.status}`, code: 'INVALID_STATUS' } };
    }

    // Check line validity (negative or zero check)
    for (const l of lines) {
      if (l.qty <= 0) {
        return { status: 400, body: { error: 'Line quantity must be greater than zero', code: 'INVALID_QUANTITY' } };
      }
      if (l.unitPrice !== undefined && l.unitPrice < 0) {
        return { status: 400, body: { error: 'Unit price cannot be negative', code: 'INVALID_PRICE' } };
      }
    }

    const existingRevs = this.estimates.filter(e => e.repairId === repair.repairId);
    const revisionNo = existingRevs.length + 1;

    const estimateId = ++this.nextId;
    const est = {
      estimateId,
      repairId: repair.repairId,
      revisionNo,
      status: 'PENDING',
      diagnosisNote: diagnosisNote || 'การตรวจเช็คระบบ',
      createdBy: user?.id || 3,
      createdAt: new Date().toISOString(),
      decidedAt: null
    };
    this.estimates.push(est);

    const savedLines = [];
    for (const l of lines) {
      let unitPrice = l.unitPrice;
      if (l.lineType === 'PART') {
        const part = this.parts.find(p => p.id === l.partId);
        if (!part) return { status: 404, body: { error: `Part ${l.partId} not found` } };
        unitPrice = unitPrice !== undefined ? unitPrice : part.sellPrice;
      }
      const el = {
        lineId: ++this.nextId,
        estimateId,
        lineType: l.lineType,
        partId: l.lineType === 'PART' ? l.partId : null,
        description: l.description,
        qty: l.qty,
        unitPrice: Number(unitPrice)
      };
      this.estimateLines.push(el);
      savedLines.push(el);
    }

    // Repair status moves to AWAITING_APPROVAL
    const fromStatus = repair.status;
    repair.status = 'AWAITING_APPROVAL';
    this.logStatus('ESTIMATE', estimateId, 'DRAFT', 'PENDING', user?.id || 3, `Drafted Revision ${revisionNo}`);
    this.logStatus('REPAIR', repair.repairId, fromStatus, 'AWAITING_APPROVAL', user?.id || 3, `Awaiting Approval Rev ${revisionNo}`);

    return { status: 200, body: { estimate: est, lines: savedLines } };
  }

  handleRepairApprove(id, body, user) {
    const repair = this.repairOrders.find(r => r.repairId === Number(id));
    if (!repair) return { status: 404, body: { error: 'Repair order not found' } };

    if (repair.status === 'COMPLETED' || repair.status === 'CANCELLED') {
      return { status: 409, body: { error: `Cannot approve ${repair.status} repair order`, code: 'INVALID_STATUS' } };
    }
    if (!['AWAITING_APPROVAL', 'IN_DIAGNOSIS'].includes(repair.status)) {
      return { status: 409, body: { error: `Repair order must be in AWAITING_APPROVAL status to approve, current status is ${repair.status}`, code: 'INVALID_STATUS' } };
    }

    const ests = this.estimates.filter(e => e.repairId === repair.repairId);
    const target = ests.find(e => e.status === 'PENDING')
      || ests.slice().sort((a, b) => b.revisionNo - a.revisionNo)[0];
    if (!target) {
      return { status: 404, body: { error: 'Estimate not found for repair order', code: 'NOT_FOUND' } };
    }

    return this.handleEstimateDecision(target.estimateId, body, user);
  }

  // --- R4: Customer Decision & Insurance Gate (Algorithm 2) ---
  handleEstimateDecision(id, body, user) {
    const est = this.estimates.find(e => e.estimateId === Number(id));
    if (!est) return { status: 404, body: { error: 'Estimate not found' } };
    const repair = this.repairOrders.find(r => r.repairId === est.repairId);
    if (!repair) return { status: 404, body: { error: 'Repair order not found' } };

    // Invariant Guard: Prevent mutating terminal or non-awaiting repair orders
    if (repair.status === 'COMPLETED' || repair.status === 'CANCELLED') {
      return { status: 409, body: { error: `Cannot decide estimate for ${repair.status} repair order`, code: 'INVALID_STATUS' } };
    }
    if (!['AWAITING_APPROVAL', 'IN_DIAGNOSIS'].includes(repair.status)) {
      return { status: 409, body: { error: `Repair order must be awaiting approval, current status is ${repair.status}`, code: 'INVALID_STATUS' } };
    }
    if (est.status !== 'PENDING') {
      return { status: 409, body: { error: `Estimate is already decided: ${est.status}`, code: 'INVALID_STATUS' } };
    }

    const { decision, insuranceDocsReceived } = body || {}; // 'APPROVED' or 'DECLINED'
    if (!['APPROVED', 'DECLINED'].includes(decision)) {
      return { status: 400, body: { error: 'Decision must be APPROVED or DECLINED', code: 'VALIDATION_ERROR' } };
    }

    if (decision === 'APPROVED') {
      // Insurance Gatekeeper Check
      if (repair.insurerName) {
        const docs = insuranceDocsReceived !== undefined ? insuranceDocsReceived : repair.insuranceDocsReceived;
        if (!docs) {
          return {
            status: 422,
            body: { error: 'Insurance claim requires documents received before approval', code: 'INSURANCE_DOCS_MISSING' }
          };
        }
        repair.insuranceDocsReceived = true;
      }

      est.status = 'APPROVED';
      est.decidedAt = new Date().toISOString();
      this.logStatus('ESTIMATE', est.estimateId, 'PENDING', 'APPROVED', user?.id || 2, 'Customer Approved');

      // Process Whole-line stock reservations for PART lines
      const lines = this.estimateLines.filter(el => el.estimateId === est.estimateId && el.lineType === 'PART');
      let hasBackorder = false;

      for (const line of lines) {
        const part = this.parts.find(p => p.id === line.partId);
        const available = part.onHand - part.reserved;

        let reqStatus = 'RESERVED';
        if (available < line.qty) {
          reqStatus = 'BACKORDERED';
          hasBackorder = true;
        } else {
          // Reserve stock
          part.reserved += line.qty;
          this.stockMovements.push({
            movementId: uniqueId('MOV'),
            partId: part.id,
            movementType: 'RESERVE',
            deltaOnHand: 0,
            deltaReserved: line.qty,
            reason: `Reserved for Repair #${repair.ticketNo}`,
            userId: user?.id || 2,
            createdAt: new Date().toISOString()
          });
        }

        const pr = {
          requestId: ++this.nextId,
          estimateLineId: line.lineId,
          saleOrderLineId: null,
          partId: line.partId,
          qty: line.qty,
          qtyIssued: 0,
          qtyReturned: 0,
          status: reqStatus,
          createdAt: new Date().toISOString()
        };
        this.partRequests.push(pr);
      }

      const fromStatus = repair.status;
      if (hasBackorder) {
        repair.status = 'ON_HOLD';
        repair.holdReason = 'WAITING_PARTS';
        repair.bayId = null; // Bay released when on hold!
        this.logStatus('REPAIR', repair.repairId, fromStatus, 'ON_HOLD', user?.id || 2, 'Holding for Backordered Parts');
      } else {
        repair.status = 'IN_REPAIR';
        this.logStatus('REPAIR', repair.repairId, fromStatus, 'IN_REPAIR', user?.id || 2, 'All Parts Reserved - In Repair');
      }

      return { status: 200, body: { estimate: est, repairOrder: repair } };
    } else {
      // DECLINED
      est.status = 'DECLINED';
      est.decidedAt = new Date().toISOString();
      this.logStatus('ESTIMATE', est.estimateId, 'PENDING', 'DECLINED', user?.id || 2, 'Customer Declined');

      if (est.revisionNo === 1) {
        // Initial revision declined -> CANCEL repair order & release bay
        const fromStatus = repair.status;
        repair.status = 'CANCELLED';
        repair.bayId = null;
        this.logStatus('REPAIR', repair.repairId, fromStatus, 'CANCELLED', user?.id || 2, 'Revision 1 Declined');
      } else {
        // Revision N declined -> previous approved revisions remain valid, return to IN_REPAIR
        repair.status = 'IN_REPAIR';
        this.logStatus('REPAIR', repair.repairId, 'AWAITING_APPROVAL', 'IN_REPAIR', user?.id || 2, `Revision ${est.revisionNo} Declined, returning to previous scope`);
      }

      return { status: 200, body: { estimate: est, repairOrder: repair } };
    }
  }

  // --- W1: Part Catalog ---
  handleUpsertPart(body, user) {
    const { sku, name, sellPrice, reorderLevel } = body;
    if (!sku || !name || sellPrice === undefined) {
      return { status: 400, body: { error: 'SKU, name, and sellPrice required', code: 'VALIDATION_ERROR' } };
    }
    if (sellPrice < 0) {
      return { status: 400, body: { error: 'Selling price cannot be negative', code: 'INVALID_PRICE' } };
    }

    let part = this.parts.find(p => p.sku === sku);
    if (part) {
      part.name = name;
      part.sellPrice = Number(sellPrice);
      if (reorderLevel !== undefined) part.reorderLevel = Number(reorderLevel);
      return { status: 200, body: part };
    } else {
      part = {
        id: ++this.nextId,
        sku,
        name,
        sellPrice: Number(sellPrice),
        onHand: 0,
        reserved: 0,
        reorderLevel: Number(reorderLevel || 0),
        isActive: true
      };
      this.parts.push(part);
      return { status: 201, body: part };
    }
  }

  // --- W2: Issue Reserved Part ---
  handleIssuePart(body, user) {
    const { requestId } = body;
    const req = this.partRequests.find(pr => pr.requestId === Number(requestId));
    if (!req) return { status: 404, body: { error: 'Part request not found' } };

    if (req.status !== 'RESERVED') {
      return { status: 409, body: { error: `Cannot issue request in status ${req.status}`, code: 'PART_NOT_RESERVED' } };
    }

    const part = this.parts.find(p => p.id === req.partId);
    if (!part || part.onHand < req.qty || part.reserved < req.qty) {
      return { status: 409, body: { error: 'Insufficient stock to issue', code: 'INVALID_STOCK' } };
    }

    // Decrement physical and reserved stock
    part.onHand -= req.qty;
    part.reserved -= req.qty;
    req.qtyIssued = req.qty;
    req.status = 'ISSUED';

    this.stockMovements.push({
      movementId: uniqueId('MOV'),
      partId: part.id,
      movementType: 'ISSUE',
      deltaOnHand: -req.qty,
      deltaReserved: -req.qty,
      partRequestId: req.requestId,
      reason: 'Issued to Repair/Counter',
      userId: user?.id || 5,
      createdAt: new Date().toISOString()
    });

    this.logStatus('PART_REQUEST', req.requestId, 'RESERVED', 'ISSUED', user?.id || 5, 'Part Handed Over');
    return { status: 200, body: { partRequest: req, part } };
  }

  // --- W3: Return Part to Stock ---
  handleReturnPart(body, user) {
    const { requestId, qty } = body;
    if (!requestId || !qty || qty <= 0) {
      return { status: 400, body: { error: 'Valid requestId and positive qty required', code: 'VALIDATION_ERROR' } };
    }

    const req = this.partRequests.find(pr => pr.requestId === Number(requestId));
    if (!req) return { status: 404, body: { error: 'Part request not found' } };

    const maxReturnable = (req.qtyIssued || 0) - (req.qtyReturned || 0);
    if (qty > maxReturnable) {
      return {
        status: 409,
        body: { error: `Cannot return ${qty} units. Max returnable is ${maxReturnable}`, code: 'INVALID_RETURN_QTY' }
      };
    }

    const part = this.parts.find(p => p.id === req.partId);
    part.onHand += Number(qty);
    req.qtyReturned = (req.qtyReturned || 0) + Number(qty);
    if (req.qtyReturned === req.qtyIssued) {
      req.status = 'RETURNED';
    }

    this.stockMovements.push({
      movementId: uniqueId('MOV'),
      partId: part.id,
      movementType: 'RETURN',
      deltaOnHand: Number(qty),
      deltaReserved: 0,
      partRequestId: req.requestId,
      reason: 'Returned unused part to warehouse',
      userId: user?.id || 5,
      createdAt: new Date().toISOString()
    });

    this.logStatus('PART_REQUEST', req.requestId, 'ISSUED', req.status, user?.id || 5, `Returned ${qty} units`);
    return { status: 200, body: { partRequest: req, part } };
  }

  // --- W4 & W5: Supplier PO & Backorder Auto-Allocation ---
  handleCreatePO(body, user) {
    const { supplierName, lines } = body;
    if (!supplierName || !lines || lines.length === 0) {
      return { status: 400, body: { error: 'Supplier and line items required', code: 'VALIDATION_ERROR' } };
    }
    for (const l of lines) {
      if (l.unitCost < 0 || l.qtyOrdered <= 0) {
        return { status: 400, body: { error: 'Quantity must be > 0 and unitCost >= 0', code: 'VALIDATION_ERROR' } };
      }
    }

    const poId = ++this.nextId;
    const po = {
      poId,
      poNo: `PO-${Date.now()}-${poId}`,
      supplierName,
      status: 'ORDERED',
      expectedDate: body.expectedDate || null,
      createdBy: user?.id || 5,
      createdAt: new Date().toISOString(),
      orderedAt: new Date().toISOString()
    };
    this.purchaseOrders.push(po);

    const savedLines = [];
    for (const l of lines) {
      const pl = {
        poLineId: ++this.nextId,
        poId,
        partId: l.partId,
        qtyOrdered: l.qtyOrdered,
        qtyReceived: 0,
        unitCost: Number(l.unitCost)
      };
      this.poLines.push(pl);
      savedLines.push(pl);
    }

    this.logStatus('PO', poId, 'DRAFT', 'ORDERED', user?.id || 5, 'PO Created & Sent');
    return { status: 200, body: { purchaseOrder: po, lines: savedLines } };
  }

  handleReceivePO(id, body, user) {
    const po = this.purchaseOrders.find(p => p.poId === Number(id));
    if (!po) return { status: 404, body: { error: 'Purchase Order not found' } };
    const { lines } = body; // array of { poLineId, qtyReceived }
    if (!lines || lines.length === 0) {
      return { status: 400, body: { error: 'Lines to receive required', code: 'VALIDATION_ERROR' } };
    }

    for (const l of lines) {
      const pl = this.poLines.find(line => line.poLineId === l.poLineId && line.poId === po.poId);
      if (!pl) return { status: 404, body: { error: `PO line ${l.poLineId} not found` } };
      if (pl.qtyReceived + l.qtyReceived > pl.qtyOrdered) {
        return { status: 409, body: { error: `Over-receipt on line ${l.poLineId}`, code: 'OVER_RECEIPT' } };
      }

      pl.qtyReceived += l.qtyReceived;
      const part = this.parts.find(p => p.id === pl.partId);
      part.onHand += l.qtyReceived;

      this.stockMovements.push({
        movementId: uniqueId('MOV'),
        partId: part.id,
        movementType: 'RECEIPT',
        deltaOnHand: l.qtyReceived,
        deltaReserved: 0,
        poLineId: pl.poLineId,
        reason: `PO Receipt ${po.poNo}`,
        userId: user?.id || 5,
        createdAt: new Date().toISOString()
      });

      // Algorithm 2: FIFO Backorder Allocation
      this.allocateBackordersForPart(part, user);
    }

    // Check PO completion status
    const allLines = this.poLines.filter(l => l.poId === po.poId);
    const fullyReceived = allLines.every(l => l.qtyReceived === l.qtyOrdered);
    const partiallyReceived = allLines.some(l => l.qtyReceived > 0);

    const fromStatus = po.status;
    po.status = fullyReceived ? 'RECEIVED' : (partiallyReceived ? 'PARTIALLY_RECEIVED' : po.status);
    this.logStatus('PO', po.poId, fromStatus, po.status, user?.id || 5, 'Goods Received');

    return { status: 200, body: { purchaseOrder: po, lines: allLines } };
  }

  allocateBackordersForPart(part, user) {
    // Find open backordered requests for this part, ordered by Priority then queuedAt (FIFO)
    const openReqs = this.partRequests.filter(pr => pr.partId === part.id && pr.status === 'BACKORDERED');

    openReqs.sort((a, b) => {
      // Find parent repair orders
      const elA = this.estimateLines.find(el => el.lineId === a.estimateLineId);
      const roA = elA ? this.repairOrders.find(r => this.estimates.some(e => e.estimateId === elA.estimateId && e.repairId === r.repairId)) : null;

      const elB = this.estimateLines.find(el => el.lineId === b.estimateLineId);
      const roB = elB ? this.repairOrders.find(r => this.estimates.some(e => e.estimateId === elB.estimateId && e.repairId === r.repairId)) : null;

      const aPriority = roA?.queueClass === 'PRIORITY' ? 0 : 1;
      const bPriority = roB?.queueClass === 'PRIORITY' ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aTime = roA ? new Date(roA.queuedAt).getTime() : 0;
      const bTime = roB ? new Date(roB.queuedAt).getTime() : 0;
      return aTime - bTime;
    });

    for (const req of openReqs) {
      const available = part.onHand - part.reserved;
      if (available >= req.qty) {
        // Whole-line reserve
        part.reserved += req.qty;
        req.status = 'RESERVED';
        this.stockMovements.push({
          movementId: uniqueId('MOV'),
          partId: part.id,
          movementType: 'RESERVE',
          deltaOnHand: 0,
          deltaReserved: req.qty,
          partRequestId: req.requestId,
          reason: 'Auto-allocated from PO receipt',
          userId: user?.id || 5,
          createdAt: new Date().toISOString()
        });

        // Check if repair order has all parts reserved now
        const el = this.estimateLines.find(line => line.lineId === req.estimateLineId);
        if (el) {
          const est = this.estimates.find(e => e.estimateId === el.estimateId);
          if (est) {
            const ro = this.repairOrders.find(r => r.repairId === est.repairId);
            if (ro && ro.status === 'ON_HOLD') {
              const allReqsForEst = this.partRequests.filter(pr => {
                const l = this.estimateLines.find(line => line.lineId === pr.estimateLineId);
                return l && l.estimateId === est.estimateId;
              });
              const allReady = allReqsForEst.every(pr => ['RESERVED', 'ISSUED'].includes(pr.status));
              if (allReady) {
                // Resume to QUEUED while preserving original queuedAt!
                const prev = ro.status;
                ro.status = 'QUEUED';
                ro.holdReason = null;
                this.logStatus('REPAIR', ro.repairId, prev, 'QUEUED', user?.id || 5, 'All parts allocated - resumed to queue');
              }
            }
          }
        }
      }
    }
  }

  // --- W6: Physical Stock Audit Adjustment ---
  handleStockAdjust(body, user) {
    const { partId, delta, reason } = body;
    if (!partId || delta === undefined || !reason || reason.trim() === '') {
      return { status: 400, body: { error: 'partId, delta, and non-empty reason required', code: 'VALIDATION_ERROR' } };
    }

    const part = this.parts.find(p => p.id === Number(partId));
    if (!part) return { status: 404, body: { error: 'Part not found' } };

    const newOnHand = part.onHand + Number(delta);
    if (newOnHand < 0 || newOnHand < part.reserved) {
      return {
        status: 409,
        body: { error: `Cannot adjust stock below active reservations (${part.reserved})`, code: 'INVALID_STOCK' }
      };
    }

    part.onHand = newOnHand;
    this.stockMovements.push({
      movementId: uniqueId('MOV'),
      partId: part.id,
      movementType: 'ADJUST',
      deltaOnHand: Number(delta),
      deltaReserved: 0,
      reason: reason.trim(),
      userId: user?.id || 5,
      createdAt: new Date().toISOString()
    });

    return { status: 200, body: part };
  }

  // --- W7: Movement Ledger & Low Stock ---
  handleGetLedger(query) {
    let list = [...this.stockMovements];
    if (query?.partId) {
      list = list.filter(m => m.partId === Number(query.partId));
    }
    if (query?.movementType) {
      list = list.filter(m => m.movementType === query.movementType);
    }
    return { status: 200, body: list };
  }

  handleGetLowStock() {
    const low = this.parts.filter(p => p.onHand <= p.reorderLevel && p.isActive);
    return { status: 200, body: low };
  }

  // --- R5: Physical QC & Bay Release ---
  handleSubmitQC(id, body, user) {
    const repair = this.repairOrders.find(r => r.repairId === Number(id));
    if (!repair) return { status: 404, body: { error: 'Repair order not found' } };

    if (repair.status !== 'IN_REPAIR') {
      return { status: 409, body: { error: `Cannot submit QC from status ${repair.status}`, code: 'INVALID_STATUS' } };
    }

    const { passed } = body;
    if (passed === undefined) {
      return { status: 400, body: { error: 'QC result (passed: true/false) required', code: 'VALIDATION_ERROR' } };
    }

    if (passed) {
      // Guard: all part requests must be ISSUED or CANCELLED
      const ests = this.estimates.filter(e => e.repairId === repair.repairId && e.status === 'APPROVED');
      const lines = this.estimateLines.filter(el => ests.some(e => e.estimateId === el.estimateId));
      const requests = this.partRequests.filter(pr => lines.some(l => l.lineId === pr.estimateLineId));

      const unissued = requests.filter(pr => !['ISSUED', 'RETURNED', 'CANCELLED'].includes(pr.status));
      if (unissued.length > 0) {
        return {
          status: 409,
          body: { error: 'All parts must be issued before passing QC', code: 'PENDING_PART_REQUEST' }
        };
      }

      repair.status = 'AWAITING_PAYMENT';
      repair.bayId = null; // Bay is released!
      this.logStatus('REPAIR', repair.repairId, 'IN_REPAIR', 'QC', user?.id || 3, 'QC Passed');
      this.logStatus('REPAIR', repair.repairId, 'QC', 'AWAITING_PAYMENT', user?.id || 3, 'Bay Released, Awaiting Payment');
      return { status: 200, body: repair };
    } else {
      // Rework required
      this.logStatus('REPAIR', repair.repairId, 'IN_REPAIR', 'IN_REPAIR', user?.id || 3, 'QC Failed - Rework Required');
      return { status: 200, body: { ...repair, note: 'Rework needed' } };
    }
  }

  // --- R6: Invoicing & Settlement (Algorithm 3) ---
  handleGenerateInvoice(body, user) {
    const { repairId, saleId } = body;
    if ((!repairId && !saleId) || (repairId && saleId)) {
      return { status: 400, body: { error: 'Provide exactly one of repairId or saleId', code: 'VALIDATION_ERROR' } };
    }

    if (repairId) {
      const repair = this.repairOrders.find(r => r.repairId === Number(repairId));
      if (!repair) return { status: 404, body: { error: 'Repair order not found' } };
      if (repair.status !== 'AWAITING_PAYMENT') {
        return { status: 409, body: { error: 'Repair must be in AWAITING_PAYMENT status', code: 'INVALID_STATUS' } };
      }

      // Assert no active ISSUED invoice exists
      const existing = this.invoices.find(inv => inv.repairId === repair.repairId && inv.status === 'ISSUED');
      if (existing) {
        return { status: 409, body: { error: 'Active invoice already exists for this repair', code: 'DUPLICATE_INVOICE' } };
      }

      // Gather approved estimate lines
      const ests = this.estimates.filter(e => e.repairId === repair.repairId && e.status === 'APPROVED');
      const lines = this.estimateLines.filter(el => ests.some(e => e.estimateId === el.estimateId));

      const invLines = [];
      let subtotal = 0;

      for (const l of lines) {
        if (l.lineType === 'LABOR') {
          const lineTotal = l.qty * l.unitPrice;
          subtotal += lineTotal;
          invLines.push({
            lineId: ++this.nextId,
            invoiceId: null,
            partId: null,
            description: l.description,
            qty: l.qty,
            unitPrice: l.unitPrice,
            lineTotal
          });
        } else if (l.lineType === 'PART') {
          const pr = this.partRequests.find(req => req.estimateLineId === l.lineId);
          // Net-issued quantity = qty_issued - qty_returned
          const billableQty = pr ? Math.max(0, (pr.qtyIssued || 0) - (pr.qtyReturned || 0)) : 0;
          if (billableQty > 0) {
            const lineTotal = billableQty * l.unitPrice;
            subtotal += lineTotal;
            invLines.push({
              lineId: ++this.nextId,
              invoiceId: null,
              partId: l.partId,
              description: l.description,
              qty: billableQty,
              unitPrice: l.unitPrice,
              lineTotal
            });
          }
        }
      }

      const insuranceCovered = Number(repair.insuranceCoveredAmount || 0);
      const customerDue = Math.max(0, subtotal - insuranceCovered);

      const invoiceId = ++this.nextId;
      const invoice = {
        invoiceId,
        invoiceNo: `INV-${Date.now()}-${invoiceId}`,
        repairId: repair.repairId,
        saleId: null,
        subtotal,
        insuranceCovered,
        customerDue,
        status: 'ISSUED',
        issuedBy: user?.id || 2,
        issuedAt: new Date().toISOString()
      };
      this.invoices.push(invoice);

      for (const il of invLines) {
        il.invoiceId = invoiceId;
        this.invoiceLines.push(il);
      }

      return { status: 200, body: { invoice, lines: invLines } };
    }
  }

  handlePayInvoice(id, body, user) {
    const invoice = this.invoices.find(inv => inv.invoiceId === Number(id));
    if (!invoice) return { status: 404, body: { error: 'Invoice not found' } };
    if (invoice.status !== 'ISSUED') {
      return { status: 409, body: { error: 'Invoice is void or not active', code: 'INVALID_STATUS' } };
    }

    const { amount, payerType, method } = body;
    if (!amount || amount <= 0 || !payerType) {
      return { status: 400, body: { error: 'Positive amount and payerType required', code: 'VALIDATION_ERROR' } };
    }

    const payment = {
      paymentId: ++this.nextId,
      invoiceId: invoice.id || invoice.invoiceId,
      payerType,
      amount: Number(amount),
      method: method || 'TRANSFER',
      receivedBy: user?.id || 2,
      paidAt: new Date().toISOString()
    };
    this.payments.push(payment);

    // If repair invoice, check if customer due is fully settled
    if (invoice.repairId) {
      const repair = this.repairOrders.find(r => r.repairId === invoice.repairId);
      const customerPayments = this.payments.filter(p => p.invoiceId === invoice.invoiceId && p.payerType === 'CUSTOMER');
      const paidSum = customerPayments.reduce((acc, p) => acc + p.amount, 0);

      if (paidSum >= invoice.customerDue) {
        repair.status = 'COMPLETED';
        repair.closedAt = new Date().toISOString();
        this.logStatus('REPAIR', repair.repairId, 'AWAITING_PAYMENT', 'COMPLETED', user?.id || 2, 'Settled in Full');
      }
      return { status: 200, body: { payment, repairStatus: repair.status, customerDue: invoice.customerDue, totalCustomerPaid: paidSum } };
    }

    return { status: 200, body: { payment } };
  }

  // --- S1 & S2: Counter Sales ---
  handleCreateSaleQuote(body, user) {
    const { customerId, lines } = body;
    if (!lines || lines.length === 0) {
      return { status: 400, body: { error: 'Sale lines required', code: 'VALIDATION_ERROR' } };
    }

    const saleId = ++this.nextId;
    const sale = {
      saleId,
      saleNo: `SO-${Date.now()}-${saleId}`,
      customerId: customerId || null,
      status: 'QUOTED',
      createdBy: user?.id || 6,
      createdAt: new Date().toISOString()
    };
    this.saleOrders.push(sale);

    const savedLines = [];
    for (const l of lines) {
      const part = this.parts.find(p => p.id === l.partId);
      if (!part) return { status: 404, body: { error: `Part ${l.partId} not found` } };
      const sl = {
        lineId: ++this.nextId,
        saleId,
        partId: l.partId,
        qty: l.qty,
        unitPrice: l.unitPrice !== undefined ? l.unitPrice : part.sellPrice
      };
      this.saleOrderLines.push(sl);
      savedLines.push(sl);
    }

    this.logStatus('SALE', saleId, null, 'QUOTED', user?.id || 6, 'Quoted');
    return { status: 200, body: { saleOrder: sale, lines: savedLines } };
  }

  handleConfirmSale(id, user) {
    const sale = this.saleOrders.find(s => s.saleId === Number(id));
    if (!sale) return { status: 404, body: { error: 'Sale not found' } };
    if (sale.status !== 'QUOTED') {
      return { status: 409, body: { error: `Cannot confirm from status ${sale.status}`, code: 'INVALID_STATUS' } };
    }

    const lines = this.saleOrderLines.filter(l => l.saleId === sale.saleId);
    for (const l of lines) {
      const part = this.parts.find(p => p.id === l.partId);
      if (part.onHand - part.reserved < l.qty) {
        return { status: 409, body: { error: `Insufficient stock for part ${part.sku}`, code: 'STOCKOUT' } };
      }
      part.reserved += l.qty;
      this.stockMovements.push({
        movementId: uniqueId('MOV'),
        partId: part.id,
        movementType: 'RESERVE',
        deltaOnHand: 0,
        deltaReserved: l.qty,
        reason: `Reserved for Sale ${sale.saleNo}`,
        userId: user?.id || 6,
        createdAt: new Date().toISOString()
      });

      this.partRequests.push({
        requestId: ++this.nextId,
        estimateLineId: null,
        saleOrderLineId: l.lineId,
        partId: l.partId,
        qty: l.qty,
        qtyIssued: 0,
        qtyReturned: 0,
        status: 'RESERVED',
        createdAt: new Date().toISOString()
      });
    }

    sale.status = 'CONFIRMED';
    this.logStatus('SALE', sale.saleId, 'QUOTED', 'CONFIRMED', user?.id || 6, 'Sale Confirmed & Stock Held');
    return { status: 200, body: sale };
  }

  handleCompleteSale(id, body, user) {
    const sale = this.saleOrders.find(s => s.saleId === Number(id));
    if (!sale) return { status: 404, body: { error: 'Sale not found' } };
    if (sale.status !== 'CONFIRMED') {
      return { status: 409, body: { error: `Sale must be CONFIRMED to complete`, code: 'INVALID_STATUS' } };
    }

    const lines = this.saleOrderLines.filter(l => l.saleId === sale.saleId);
    let subtotal = 0;
    const invLines = [];

    for (const l of lines) {
      const lineTotal = l.qty * l.unitPrice;
      subtotal += lineTotal;
      invLines.push({
        lineId: ++this.nextId,
        invoiceId: null,
        partId: l.partId,
        description: `Part #${l.partId}`,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal
      });

      // Deduct stock and issue
      const part = this.parts.find(p => p.id === l.partId);
      part.onHand -= l.qty;
      part.reserved -= l.qty;

      const pr = this.partRequests.find(r => r.saleOrderLineId === l.lineId);
      if (pr) {
        pr.qtyIssued = l.qty;
        pr.status = 'ISSUED';
      }

      this.stockMovements.push({
        movementId: uniqueId('MOV'),
        partId: part.id,
        movementType: 'ISSUE',
        deltaOnHand: -l.qty,
        deltaReserved: -l.qty,
        reason: `Counter Sale ${sale.saleNo}`,
        userId: user?.id || 6,
        createdAt: new Date().toISOString()
      });
    }

    const { amountPaid, paymentMethod } = body;
    if (!amountPaid || amountPaid < subtotal) {
      return { status: 400, body: { error: `Payment amount ${amountPaid} is less than subtotal ${subtotal}`, code: 'INSUFFICIENT_PAYMENT' } };
    }

    const invoiceId = ++this.nextId;
    const invoice = {
      invoiceId,
      invoiceNo: `INV-SALE-${Date.now()}-${invoiceId}`,
      repairId: null,
      saleId: sale.saleId,
      subtotal,
      insuranceCovered: 0,
      customerDue: subtotal,
      status: 'ISSUED',
      issuedBy: user?.id || 6,
      issuedAt: new Date().toISOString()
    };
    this.invoices.push(invoice);

    for (const il of invLines) {
      il.invoiceId = invoiceId;
      this.invoiceLines.push(il);
    }

    const payment = {
      paymentId: ++this.nextId,
      invoiceId,
      payerType: 'CUSTOMER',
      amount: Number(amountPaid),
      method: paymentMethod || 'CASH',
      receivedBy: user?.id || 6,
      paidAt: new Date().toISOString()
    };
    this.payments.push(payment);

    sale.status = 'COMPLETED';
    this.logStatus('SALE', sale.saleId, 'CONFIRMED', 'COMPLETED', user?.id || 6, 'Sale Completed');

    return { status: 200, body: { saleOrder: sale, invoice, payment } };
  }

  // --- Reports (A2) ---
  handleReportRepairSummary(query) {
    const list = this.repairOrders.map(ro => {
      const vehicle = this.vehicles.find(v => v.id === ro.vehicleId);
      const customer = vehicle ? this.customers.find(c => c.id === vehicle.customerId) : null;
      const invoice = this.invoices.find(i => i.repairId === ro.repairId && i.status === 'ISSUED');
      return {
        repairId: ro.repairId,
        ticketNo: ro.ticketNo,
        status: ro.status,
        queuedAt: ro.queuedAt,
        closedAt: ro.closedAt,
        plate: vehicle?.plate,
        customerName: customer?.name,
        subtotal: invoice?.subtotal || 0,
        customerDue: invoice?.customerDue || 0
      };
    });
    return {
      status: 200,
      body: {
        totalOrders: list.length,
        completedOrders: list.filter(r => r.status === 'COMPLETED').length,
        items: list
      }
    };
  }

  handleReportInventoryUsage(query) {
    const items = this.parts.map(p => {
      const partMovements = this.stockMovements.filter(m => m.partId === p.id);
      const issued = partMovements.filter(m => m.movementType === 'ISSUE').reduce((acc, m) => acc + Math.abs(m.deltaOnHand), 0);
      const returned = partMovements.filter(m => m.movementType === 'RETURN').reduce((acc, m) => acc + m.deltaOnHand, 0);
      return {
        partId: p.id,
        sku: p.sku,
        name: p.name,
        sellPrice: p.sellPrice,
        onHand: p.onHand,
        reserved: p.reserved,
        reorderLevel: p.reorderLevel,
        isLowStock: p.onHand <= p.reorderLevel,
        netConsumed: Math.max(0, issued - returned)
      };
    });
    return { status: 200, body: { totalParts: items.length, items } };
  }

  handleReportRevenue(query) {
    const validInvoices = this.invoices.filter(i => i.status === 'ISSUED');
    const grossRevenue = validInvoices.reduce((acc, i) => acc + i.subtotal, 0);
    const totalPayments = this.payments.reduce((acc, p) => acc + p.amount, 0);
    return {
      status: 200,
      body: {
        totalInvoicesIssued: validInvoices.length,
        grossRevenue,
        totalPayments
      }
    };
  }

  // --- Admin User & Bay Config (A1) ---
  handleUpsertUser(body, user) {
    if (user?.role !== 'MANAGER') {
      return { status: 403, body: { error: 'Only MANAGER can manage user accounts', code: 'ACCESS_DENIED' } };
    }
    const { username, displayName, role } = body;
    if (!username || !role) {
      return { status: 400, body: { error: 'Username and role required', code: 'VALIDATION_ERROR' } };
    }
    let u = this.users.find(acc => acc.username === username);
    if (u) {
      u.displayName = displayName || u.displayName;
      u.role = role;
      if (body.isActive !== undefined) u.isActive = Boolean(body.isActive);
      return { status: 200, body: u };
    } else {
      u = {
        id: ++this.nextId,
        username,
        passwordHash: 'bcrypt_hash_new',
        displayName: displayName || username,
        role,
        isActive: true
      };
      this.users.push(u);
      return { status: 201, body: u };
    }
  }

  handleDeactivateUser(id, user) {
    if (user?.role !== 'MANAGER') {
      return { status: 403, body: { error: 'Only MANAGER can deactivate accounts', code: 'ACCESS_DENIED' } };
    }
    const target = this.users.find(u => u.id === Number(id));
    if (!target) return { status: 404, body: { error: 'User not found' } };
    target.isActive = false; // Soft delete!
    return { status: 200, body: { message: `User ${target.username} deactivated`, user: target } };
  }

  handleGetBays() {
    return { status: 200, body: this.bays };
  }
}
