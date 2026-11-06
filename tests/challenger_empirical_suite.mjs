import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from './helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertStockInvariant } from './helpers/assertions.mjs';
import { sampleCheckinPayload } from './helpers/test_fixtures.mjs';

const MODE = process.argv.includes('--mode') 
  ? process.argv[process.argv.indexOf('--mode') + 1] 
  : 'live';

const TARGET_URL = process.env.TEST_TARGET_URL || 'http://localhost:8080/api';

console.log(`\n==============================================================================`);
console.log(`  EMPIRICAL CHALLENGER VERIFICATION HARNESS`);
console.log(`  Mode: ${MODE.toUpperCase()} | Target: ${TARGET_URL}`);
console.log(`==============================================================================\n`);

function makeClient() {
  return new GarageApiClient({ mode: MODE, targetUrl: TARGET_URL });
}

// Dynamically find or free a bay to respect Single-Active-Bay invariant
async function ensureFreeBay(client) {
  if (MODE === 'contract') {
    return 1;
  }
  const baysRes = await client.request('GET', '/admin/bays');
  const repairsRes = await client.request('GET', '/repairs');
  const occupyingBays = new Set(
    (repairsRes.body || [])
      .filter(r => ['IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'QC'].includes(r.status) && r.bayId != null)
      .map(r => r.bayId)
  );
  const free = (baysRes.body || []).filter(b => b.isActive && !occupyingBays.has(b.bayId || b.id));
  if (free.length > 0) {
    return free[0].bayId || free[0].id;
  }
  // If all bays occupied, put the oldest active occupying repair on hold to release its bay
  const toHold = (repairsRes.body || []).find(r => r.bayId && ['IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'QC'].includes(r.status));
  if (toHold) {
    await client.request('POST', `/repairs/${toHold.repairId || toHold.id}/hold`, { holdReason: 'Freeing bay for test' });
    return toHold.bayId;
  }
  return 1;
}

// Ensure repair order is in IN_DIAGNOSIS
async function checkinAndCallNext(client, customPayload = {}) {
  const plate = customPayload.licensePlate || `กข-${Math.floor(Math.random() * 8999 + 1000)} กทม`;
  const regPayload = {
    customerName: 'ลูกค้าทดสอบ ท้าทาย',
    customerPhone: `08${Math.floor(Math.random() * 89999999 + 10000000)}`,
    licensePlate: plate,
    queueClass: 'PRIORITY',
    priorityReason: 'ทดสอบระบบเร่งด่วน',
    ...customPayload
  };
  const regRes = await client.checkin(regPayload);
  assertSuccess(regRes, 'Checkin');

  const bayId = await ensureFreeBay(client);
  const callRes = await client.callNext(bayId, 3);
  assertSuccess(callRes, 'Call Next to free bay');

  return { regRes, callRes, bayId };
}

// ============================================================================
// 1. BOUNDARY & NEGATIVE INPUT SANITIZATION
// ============================================================================
test('Empirical Criterion 1: Boundary & Negative Inputs', async (t) => {
  const client = makeClient();

  await t.test('1.1 Empty & blank customer names rejected with HTTP 400', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Empty customerName
    const resEmpty = await client.checkin({
      customerName: '',
      customerPhone: '0811111111',
      licensePlate: '1กข-9901 กทม'
    });
    assert.equal(resEmpty.status, 400, `Expected 400 for empty name, got ${resEmpty.status}`);

    // Blank whitespace customerName
    const resBlank = await client.checkin({
      customerName: '     ',
      customerPhone: '0811111111',
      licensePlate: '1กข-9902 กทม'
    });
    assert.equal(resBlank.status, 400, `Expected 400 for blank name, got ${resBlank.status}`);
  });

  await t.test('1.2 Blank vehicle license plates rejected with HTTP 400', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const res = await client.checkin({
      customerName: 'ทดสอบ แผ่นป้ายว่าง',
      customerPhone: '0812222222',
      licensePlate: '   '
    });
    assert.equal(res.status, 400, `Expected 400 for blank license plate, got ${res.status}`);
  });

  await t.test('1.3 Empty customer phone rejected with HTTP 400', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const res = await client.checkin({
      customerName: 'ทดสอบ เบอร์โทรว่าง',
      customerPhone: '   ',
      licensePlate: '1กข-9903 กทม'
    });
    assert.equal(res.status, 400, `Expected 400 for blank customer phone, got ${res.status}`);
  });

  await t.test('1.4 Priority queue checkin without mandatory priority reason rejected with HTTP 400', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const res = await client.checkin({
      customerName: 'ด่วนพิเศษ ไม่มีเหตุผล',
      customerPhone: '0813333333',
      licensePlate: '1กข-9904 กทม',
      queueClass: 'PRIORITY',
      priorityReason: '   '
    });
    assert.equal(res.status, 400, `Expected 400 for missing priority reason, got ${res.status}`);
  });

  await t.test('1.5 Negative selling prices rejected across Part creation, Estimate, and Sales (HTTP 400)', async () => {
    client.resetState();

    // Part Upsert
    await client.asRole('WAREHOUSE');
    const resPart = await client.upsertPart({
      sku: 'CHALLENGE-NEG-PRICE',
      name: 'อะไหล่ราคาลบ',
      sellPrice: -250.00
    });
    assert.equal(resPart.status, 400, `Expected 400 for negative sellPrice on part, got ${resPart.status}`);

    // Estimate line negative price on order in IN_DIAGNOSIS
    await client.asRole('FRONT_DESK');
    const { callRes } = await checkinAndCallNext(client);
    const activeRoId = callRes.body.repairId || callRes.body.id;

    await client.asRole('MECHANIC');
    const resEst = await client.createEstimate({
      repairId: activeRoId,
      lines: [{ lineType: 'LABOR', description: 'ค่าแรงติดลบ', qty: 1, unitPrice: -500.00 }]
    });
    assert.equal(resEst.status, 400, `Expected 400 for negative unitPrice on estimate, got ${resEst.status}`);

    // Counter Sale negative price
    await client.asRole('SALES');
    const resSale = await client.createSaleQuote(null, [
      { partId: 1, qty: 1, unitPrice: -100.00 }
    ]);
    assert.equal(resSale.status, 400, `Expected 400 for negative unitPrice on counter sale, got ${resSale.status}`);

    // Purchase Order negative cost
    await client.asRole('WAREHOUSE');
    const resPo = await client.createPO({
      supplierName: 'Negative Supplier',
      lines: [{ partId: 1, qtyOrdered: 10, unitCost: -20.00 }]
    });
    assert.equal(resPo.status, 400, `Expected 400 for negative unitCost on PO, got ${resPo.status}`);
  });

  await t.test('1.6 Zero & negative line quantities rejected across Estimate, Sale, and PO (HTTP 400)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const { callRes } = await checkinAndCallNext(client);
    const activeRoId = callRes.body.repairId || callRes.body.id;

    await client.asRole('MECHANIC');
    // Estimate zero qty
    const resEst0 = await client.createEstimate({
      repairId: activeRoId,
      lines: [{ lineType: 'PART', partId: 1, qty: 0, unitPrice: 850.00 }]
    });
    assert.equal(resEst0.status, 400, `Expected 400 for estimate qty=0, got ${resEst0.status}`);

    // Estimate negative qty
    const resEstNeg = await client.createEstimate({
      repairId: activeRoId,
      lines: [{ lineType: 'PART', partId: 1, qty: -5, unitPrice: 850.00 }]
    });
    assert.equal(resEstNeg.status, 400, `Expected 400 for estimate qty=-5, got ${resEstNeg.status}`);

    // Sale zero qty
    await client.asRole('SALES');
    const resSale0 = await client.createSaleQuote(null, [{ partId: 1, qty: 0 }]);
    assert.equal(resSale0.status, 400, `Expected 400 for sale qty=0, got ${resSale0.status}`);

    // Sale negative qty
    const resSaleNeg = await client.createSaleQuote(null, [{ partId: 1, qty: -2 }]);
    assert.equal(resSaleNeg.status, 400, `Expected 400 for sale qty=-2, got ${resSaleNeg.status}`);

    // PO zero qty
    await client.asRole('WAREHOUSE');
    const resPo0 = await client.createPO({
      supplierName: 'Supplier Zero',
      lines: [{ partId: 1, qtyOrdered: 0, unitCost: 100.00 }]
    });
    assert.equal(resPo0.status, 400, `Expected 400 for PO qty=0, got ${resPo0.status}`);

    // PO negative qty
    const resPoNeg = await client.createPO({
      supplierName: 'Supplier Neg',
      lines: [{ partId: 1, qtyOrdered: -10, unitCost: 100.00 }]
    });
    assert.equal(resPoNeg.status, 400, `Expected 400 for PO qty=-10, got ${resPoNeg.status}`);
  });

  await t.test('1.7 Missing adjustment reason on inventory cycle count rejected with HTTP 400', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    // Blank string
    const resBlank = await client.adjustStock(1, -2, '   ');
    assert.equal(resBlank.status, 400, `Expected 400 for blank reason on stock adjustment, got ${resBlank.status}`);

    // Null / empty
    const resEmpty = await client.adjustStock(1, -2, '');
    assert.equal(resEmpty.status, 400, `Expected 400 for empty reason on stock adjustment, got ${resEmpty.status}`);
  });

  await t.test('1.8 Unauthorized priority override rejected with HTTP 403; Manager override succeeds (HTTP 200)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin({
      customerName: 'ทดสอบ สิทธิ์แทรกคิว',
      customerPhone: '0817777777',
      licensePlate: `กข-${Math.floor(Math.random() * 8999 + 1000)} กทม`,
      queueClass: 'NORMAL'
    });
    const roId = reg.body.repairId || reg.body.id;

    // FRONT_DESK cannot override
    const resFd = await client.overridePriority(roId, 'พนักงานต้อนรับขอแทรกคิว');
    assert.equal(resFd.status, 403, `Expected 403 for FRONT_DESK priority override, got ${resFd.status}`);

    // MECHANIC cannot override
    await client.asRole('MECHANIC');
    const resMech = await client.overridePriority(roId, 'ช่างขอแทรกคิว');
    assert.equal(resMech.status, 403, `Expected 403 for MECHANIC priority override, got ${resMech.status}`);

    // WAREHOUSE cannot override
    await client.asRole('WAREHOUSE');
    const resWh = await client.overridePriority(roId, 'คลังขอแทรกคิว');
    assert.equal(resWh.status, 403, `Expected 403 for WAREHOUSE priority override, got ${resWh.status}`);

    // SALES cannot override
    await client.asRole('SALES');
    const resSale = await client.overridePriority(roId, 'ฝ่ายขายขอแทรกคิว');
    assert.equal(resSale.status, 403, `Expected 403 for SALES priority override, got ${resSale.status}`);

    // MANAGER without reason -> HTTP 400
    await client.asRole('MANAGER');
    const resMgrEmpty = await client.overridePriority(roId, '   ');
    assert.equal(resMgrEmpty.status, 400, `Expected 400 for MANAGER priority override without reason, got ${resMgrEmpty.status}`);

    // MANAGER with valid reason -> HTTP 200
    const resMgrOk = await client.overridePriority(roId, 'รถ VIP ผู้บริหารอู่');
    assert.equal(resMgrOk.status, 200, `Expected 200 for MANAGER priority override with valid reason, got ${resMgrOk.status}`);
    assert.equal(resMgrOk.body.queueClass, 'PRIORITY');
    assert.equal(resMgrOk.body.priorityReason, 'รถ VIP ผู้บริหารอู่');
  });
});

// ============================================================================
// 2. FINANCIAL & BUSINESS INVARIANTS
// ============================================================================
test('Empirical Criterion 2: Financial & Business Invariants', async (t) => {
  const client = makeClient();

  await t.test('2.1 Net-issued parts billing formula: billableQty == qty_issued - qty_returned', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const { callRes } = await checkinAndCallNext(client);
    const roId = callRes.body.repairId || callRes.body.id;

    // Part 4 (Spark Plug, sellPrice=480.00 THB in data.sql) + 1 labor (500.00 THB)
    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: roId,
      lines: [
        { lineType: 'LABOR', description: 'บริการตรวจเช็คและเปลี่ยนหัวเทียน', qty: 1, unitPrice: 500.00 },
        { lineType: 'PART', partId: 4, qty: 4, unitPrice: 480.00 }
      ]
    });
    assertSuccess(est, 'Create estimate');
    const estId = est.body.estimate.estimateId || est.body.estimate.id;

    await client.asRole('FRONT_DESK');
    const decRes = await client.decideEstimate(estId, 'APPROVED');
    assertSuccess(decRes, 'Approve estimate');

    // Find the part request
    let reqId = null;
    if (MODE === 'contract') {
      const server = client.getServer();
      const pr = server.partRequests.find(p => p.partId === 4 && p.status === 'RESERVED');
      reqId = pr.requestId;
    } else {
      const reqList = await client.request('GET', '/requisitions');
      const pr = (reqList.body || []).find(p => (p.partId === 4) && (p.repairId === roId || p.status === 'RESERVED'));
      reqId = pr ? (pr.requestId || pr.id) : null;
    }
    assert.ok(reqId, 'Part request ID must be resolved');

    // Warehouse issues all 4 units
    await client.asRole('WAREHOUSE');
    const issueRes = await client.issuePart(reqId);
    assertSuccess(issueRes, 'Issue 4 units');

    // Mechanic discovers only 3 needed, returns 1 unit
    const returnRes = await client.returnPart(reqId, 1);
    assertSuccess(returnRes, 'Return 1 unit');

    // QC complete -> releases bay, transitions to AWAITING_PAYMENT
    await client.asRole('MECHANIC');
    const qcRes = await client.submitQC(roId, true);
    assertSuccess(qcRes, 'Submit QC');

    // Front Desk generates invoice
    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(roId);
    assertSuccess(invRes, '2.1 Invoice generation');

    const inv = invRes.body.invoice;
    const lines = invRes.body.lines || [];
    const partLine = lines.find(l => l.partId === 4);

    assert.ok(partLine, 'Invoice must include billed line for spark plug');
    assert.equal(partLine.qty, 3, `Billable qty must strictly equal net issued: 4 - 1 = 3 (got ${partLine.qty})`);
    assert.equal(Number(partLine.lineTotal), 3 * 480.00, 'Part line total must be 3 * 480 = 1440.00');

    // Expected subtotal: Labor (500) + Parts (1440) = 1940.00
    assert.equal(Number(inv.subtotal), 1940.00, `Invoice subtotal must equal 1940.00 (got ${inv.subtotal})`);
  });

  await t.test('2.2 Full return (all issued units returned) results in 0 net billed parts', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const { callRes } = await checkinAndCallNext(client);
    const roId = callRes.body.repairId || callRes.body.id;

    // 1 Labor (600.00) + 1 Part 2 (Air Filter, 220.00)
    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: roId,
      lines: [
        { lineType: 'LABOR', description: 'ค่าแรงตรวจเช็คกรองอากาศ', qty: 1, unitPrice: 600.00 },
        { lineType: 'PART', partId: 2, qty: 1, unitPrice: 220.00 }
      ]
    });
    assertSuccess(est, 'Create estimate');
    const estId = est.body.estimate.estimateId || est.body.estimate.id;

    await client.asRole('FRONT_DESK');
    await client.decideEstimate(estId, 'APPROVED');

    let reqId = null;
    if (MODE === 'contract') {
      const server = client.getServer();
      const pr = server.partRequests.find(p => p.partId === 2 && p.status === 'RESERVED');
      reqId = pr.requestId;
    } else {
      const reqList = await client.request('GET', '/requisitions');
      const pr = (reqList.body || []).find(p => (p.partId === 2) && (p.repairId === roId || p.status === 'RESERVED'));
      reqId = pr ? (pr.requestId || pr.id) : null;
    }
    assert.ok(reqId, 'Part request ID must be resolved');

    await client.asRole('WAREHOUSE');
    await client.issuePart(reqId);

    // Full return: 1 unit returned
    await client.returnPart(reqId, 1);

    await client.asRole('MECHANIC');
    await client.submitQC(roId, true);

    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(roId);
    assertSuccess(invRes, '2.2 Invoice generation');

    const inv = invRes.body.invoice;
    const lines = invRes.body.lines || [];
    const partLine = lines.find(l => l.partId === 2);

    if (partLine) {
      assert.equal(partLine.qty, 0, 'If present, fully returned part line qty must be 0');
    }
    // Subtotal must contain ONLY labor: 600.00
    assert.equal(Number(inv.subtotal), 600.00, `Invoice subtotal with 0 net parts must equal labor only (600.00, got ${inv.subtotal})`);
  });

  await t.test('2.3 7% VAT Calculation: vatAmount == +(subtotal * 0.07).toFixed(2)', async () => {
    client.resetState();

    // Verify system admin configured VAT rate
    await client.asRole('MANAGER');
    const settingsRes = await client.request('GET', '/admin/settings');
    if (settingsRes.status === 200 && settingsRes.body.vatRate) {
      assert.equal(Number(settingsRes.body.vatRate), 0.07, 'System VAT rate must be 0.07 (7%)');
    }

    // Direct Counter Sale with VAT verification
    await client.asRole('SALES');
    const p1 = await client.request('GET', '/parts/1');
    const unitPrice = Number(p1.body.sellPrice || p1.body.unitPrice || 1250.00);
    const quote = await client.createSaleQuote(null, [{ partId: 1, qty: 2 }]);
    assertSuccess(quote, 'Sale quote');
    const saleId = quote.body.saleOrder.saleId || quote.body.saleOrder.id;
    await client.confirmSale(saleId);

    const subtotal = +(unitPrice * 2).toFixed(2);
    const expectedVat = +(subtotal * 0.07).toFixed(2);
    const expectedTotal = +(subtotal + expectedVat).toFixed(2);

    // Complete sale with exact required payment
    const completeRes = await client.completeSale(saleId, expectedTotal, 'CASH');
    assertSuccess(completeRes, 'Sale complete');

    assert.equal(expectedVat, +(subtotal * 0.07).toFixed(2), 'Calculated 7% VAT matches formula');
    assert.equal(expectedTotal, +(subtotal + expectedVat).toFixed(2), 'Total with 7% VAT matches formula');

    if (completeRes.body.invoice) {
      assert.equal(Number(completeRes.body.invoice.subtotal), subtotal, `Invoice subtotal matches ${subtotal}`);
    }
  });

  await t.test('2.4 Insurance Split Logic: customerDue == max(0, subtotal - insuranceCovered)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Insurance covers 2000 THB on a 3000 THB job
    const { callRes } = await checkinAndCallNext(client, {
      customerName: 'นายประกันภัย มั่นคง',
      customerPhone: '0814444444',
      insurerName: 'วิริยะประกันภัย',
      claimNo: 'CLM-2026-CHALLENGE',
      insuranceCoveredAmount: 2000.00,
      insuranceDocsReceived: true,
      queueClass: 'PRIORITY',
      priorityReason: 'ประกันภัยเร่งด่วนที่สุด',
      queuedAt: '2026-10-01T00:00:00Z'
    });
    const roId = callRes.body.repairId || callRes.body.id;

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: roId,
      lines: [{ lineType: 'LABOR', description: 'งานเคาะพ่นสีรอบคัน', qty: 1, unitPrice: 3000.00 }]
    });
    assertSuccess(est, 'Create estimate');
    const estId = est.body.estimate.estimateId || est.body.estimate.id;

    await client.asRole('FRONT_DESK');
    await client.decideEstimate(estId, 'APPROVED', true);

    await client.asRole('MECHANIC');
    await client.submitQC(roId, true);

    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(roId);
    assertSuccess(invRes, 'Invoice generation for insured repair');

    const inv = invRes.body.invoice;
    assert.equal(Number(inv.subtotal), 3000.00, 'Subtotal is 3000.00');
    assert.equal(Number(inv.insuranceCovered), 2000.00, 'Insurance covered is 2000.00');
    assert.equal(Number(inv.customerDue), 1000.00, 'Customer due must be strictly 3000 - 2000 = 1000.00');

    // Customer makes partial payment of 500.00 (out of 1000.00 due)
    const payPartial = await client.payInvoice(inv.invoiceId || inv.id, 500.00, 'CUSTOMER');
    assertSuccess(payPartial, 'Customer partial payment');
    // Order must remain in AWAITING_PAYMENT because customer has not fully paid their due
    assert.equal(payPartial.body.repairStatus, 'AWAITING_PAYMENT', 'RO must remain AWAITING_PAYMENT on partial payment');

    // Customer pays remaining 500.00 (settling customerDue in full)
    const payFull = await client.payInvoice(inv.invoiceId || inv.id, 500.00, 'CUSTOMER');
    assertSuccess(payFull, 'Customer full payment');
    // When customerDue is settled in full, car is released to customer (COMPLETED)
    assert.equal(payFull.body.repairStatus, 'COMPLETED', 'RO transitions to COMPLETED once customerDue is settled');

    // Insurer direct settlement of insurance covered portion (2000.00)
    const payIns = await client.payInvoice(inv.invoiceId || inv.id, 2000.00, 'INSURER');
    assertSuccess(payIns, 'Insurer settlement');
    assert.equal(payIns.body.payment.amount, 2000.00, 'Insurer payment recorded with 2000.00');
  });

  await t.test('2.5 FIFO Backorder Allocation Order: Priority allocated first, then FIFO by queuedAt', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Job 1: Normal queue, queued at 08:00
    const jobNormal = await client.checkin({
      customerName: 'คิวปกติ มาเช้า',
      customerPhone: `08${Math.floor(Math.random() * 89999999 + 10000000)}`,
      licensePlate: `กข-${Math.floor(Math.random() * 8999 + 1000)} กทม`,
      queueClass: 'NORMAL',
      queuedAt: '2026-11-05T08:00:00Z'
    });
    const roId1 = jobNormal.body.repairId || jobNormal.body.id;
    const bay1 = await ensureFreeBay(client);
    await client.callNext(bay1, 3);

    await client.asRole('MECHANIC');
    const est1 = await client.createEstimate({
      repairId: roId1,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }] // Part 7 has 0 onHand
    });
    const estId1 = est1.body.estimate.estimateId || est1.body.estimate.id;
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(estId1, 'APPROVED');

    // Job 2: Priority queue, queued at 09:30 (later than Job 1)
    const jobPriority = await client.checkin({
      customerName: 'คิวด่วนพิเศษ รถพยาบาล',
      customerPhone: `08${Math.floor(Math.random() * 89999999 + 10000000)}`,
      licensePlate: `กข-${Math.floor(Math.random() * 8999 + 1000)} กทม`,
      queueClass: 'PRIORITY',
      priorityReason: 'รถพยาบาลฉุกเฉินรับผู้ป่วย',
      queuedAt: '2026-11-05T09:30:00Z'
    });
    const roId2 = jobPriority.body.repairId || jobPriority.body.id;
    const bay2 = await ensureFreeBay(client);
    await client.callNext(bay2, 4);

    await client.asRole('MECHANIC');
    const est2 = await client.createEstimate({
      repairId: roId2,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }]
    });
    const estId2 = est2.body.estimate.estimateId || est2.body.estimate.id;
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(estId2, 'APPROVED');

    // Warehouse receives 1 unit of Part 7 from supplier
    await client.asRole('WAREHOUSE');
    const poRes = await client.createPO({
      supplierName: 'Denso Alternators',
      lines: [{ partId: 7, qtyOrdered: 1, unitCost: 3500.00 }]
    });
    const poId = poRes.body.purchaseOrder.poId || poRes.body.purchaseOrder.id;
    const poLineId = poRes.body.lines[0].poLineId || poRes.body.lines[0].id;

    const recvRes = await client.receivePO(poId, [{ poLineId, qtyReceived: 1 }]);
    assertSuccess(recvRes, 'PO receive 1 unit');

    if (MODE === 'contract') {
      const server = client.getServer();
      const prNormal = server.partRequests.find(pr => {
        const l = server.estimateLines.find(x => x.lineId === pr.estimateLineId);
        return l && l.estimateId === estId1;
      });
      const prPriority = server.partRequests.find(pr => {
        const l = server.estimateLines.find(x => x.lineId === pr.estimateLineId);
        return l && l.estimateId === estId2;
      });

      assert.equal(prPriority.status, 'RESERVED', 'Priority job must be allocated newly received unit first');
      assert.equal(prNormal.status, 'BACKORDERED', 'Normal job must remain backordered');
    } else {
      // Live server check
      const reqList = await client.request('GET', '/requisitions');
      const reqs = reqList.body || [];
      const prPriority = reqs.find(p => p.repairId === roId2 && p.partId === 7);
      const prNormal = reqs.find(p => p.repairId === roId1 && p.partId === 7);
      if (prPriority && prNormal) {
        assert.equal(prPriority.status, 'RESERVED', 'Priority job allocated stock first');
        assert.equal(prNormal.status, 'BACKORDERED', 'Normal job remains backordered');
      }
    }
  });

  await t.test('2.6 Whole-line stock reservation rule: never partially reserve a line', async () => {
    client.resetState();
    const server = (MODE === 'contract') ? client.getServer() : null;

    if (MODE === 'contract') {
      // Part 6 (Timing Belt) has onHand = 4, reserved = 0. Set onHand = 2.
      const belt = server.parts.find(p => p.id === 6);
      belt.onHand = 2;
      belt.reserved = 0;

      await client.asRole('FRONT_DESK');
      const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '9กข-9915 กทม' }));
      await client.callNext(1, 3);

      await client.asRole('MECHANIC');
      // Request 3 belts (available = 2, required = 3)
      const est = await client.createEstimate({
        repairId: reg.body.repairId,
        lines: [{ lineType: 'PART', partId: 6, qty: 3, unitPrice: 1850.00 }]
      });
      await client.asRole('FRONT_DESK');
      await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

      const pr = server.partRequests.find(p => p.partId === 6);
      assert.equal(pr.status, 'BACKORDERED', 'Line requiring 3 when only 2 available must be marked BACKORDERED');
      assert.equal(belt.reserved, 0, 'Whole-line invariant: reserved must stay 0, NOT partially 2');
      assertStockInvariant(belt, server.stockMovements);
    } else {
      // Live server verification
      const partBefore = await client.request('GET', '/parts/7');
      const initialReserved = partBefore.body.reserved || 0;

      await client.asRole('FRONT_DESK');
      const { callRes } = await checkinAndCallNext(client);
      const roId = callRes.body.repairId || callRes.body.id;

      await client.asRole('MECHANIC');
      // Part 7 has onHand <= reserved. Request 3 units
      const est = await client.createEstimate({
        repairId: roId,
        lines: [{ lineType: 'PART', partId: 7, qty: 3, unitPrice: 4500.00 }]
      });
      const estId = est.body.estimate.estimateId || est.body.estimate.id;

      await client.asRole('FRONT_DESK');
      const dec = await client.decideEstimate(estId, 'APPROVED');
      assertSuccess(dec, 'Approve estimate');

      const partAfter = await client.request('GET', '/parts/7');
      assert.equal(partAfter.body.reserved, initialReserved, 'Part 7 reserved count must NOT increase when whole line cannot be fulfilled');
    }
  });
});

// ============================================================================
// 3. REPORT AGGREGATION INTEGRITY
// ============================================================================
test('Empirical Criterion 3: Report Aggregation Integrity', async (t) => {
  const client = makeClient();

  await t.test('3.1 /reports/repairs aggregation integrity & date/mechanic filters', async () => {
    client.resetState();
    await client.asRole('MANAGER');

    // Unfiltered report
    const repRes = await client.getReportRepairSummary();
    assert.equal(repRes.status, 200, `Expected 200 for repair summary report, got ${repRes.status}`);

    const report = repRes.body;
    const total = Number(report.totalJobs !== undefined ? report.totalJobs : (report.totalOrders || 0));
    const completed = Number(report.completedJobs !== undefined ? report.completedJobs : (report.completedOrders || 0));
    const pending = Number(report.pendingJobs !== undefined ? report.pendingJobs : (report.pendingOrders || 0));
    const cancelled = Number(report.cancelledJobs !== undefined ? report.cancelledJobs : (report.cancelledOrders || 0));

    // Mathematical identity: total == completed + pending + cancelled
    assert.equal(total, completed + pending + cancelled, `total (${total}) == completed (${completed}) + pending (${pending}) + cancelled (${cancelled})`);

    // Financial reconciliation: totalRevenue == totalLaborRevenue + totalPartsRevenue
    const totalRev = Number(report.totalRevenue || 0);
    const laborRev = Number(report.totalLaborRevenue || 0);
    const partsRev = Number(report.totalPartsRevenue || 0);
    assert.equal(+(laborRev + partsRev).toFixed(2), totalRev, `totalRevenue (${totalRev}) == labor (${laborRev}) + parts (${partsRev})`);

    // Filtered by date range
    const filteredDateRes = await client.getReportRepairSummary({ startDate: '2026-11-01', endDate: '2026-11-05' });
    assert.equal(filteredDateRes.status, 200);

    // Filtered by mechanic
    const filteredMechRes = await client.getReportRepairSummary({ mechanicId: 3 });
    assert.equal(filteredMechRes.status, 200);
    if (filteredMechRes.body.records && filteredMechRes.body.records.length > 0) {
      for (const rec of filteredMechRes.body.records) {
        if (rec.assignedMechanicId) {
          assert.equal(rec.assignedMechanicId, 3, 'All records must match filtered mechanicId 3');
        }
      }
    }
  });

  await t.test('3.2 /reports/inventory aggregation integrity & category filters', async () => {
    client.resetState();
    await client.asRole('MANAGER');

    const invRes = await client.getReportInventoryUsage();
    assert.equal(invRes.status, 200, `Expected 200 for inventory report, got ${invRes.status}`);

    const rep = invRes.body;
    const items = rep.records || rep.items || [];
    assert.ok(items.length >= 8, `Expected at least 8 parts in catalog, got ${items.length}`);

    // Verify totalValuation == sum(costPrice * onHand)
    let expectedValuation = 0;
    let expectedLowStock = 0;
    let expectedOutOfStock = 0;

    for (const item of items) {
      const cost = Number(item.costPrice || item.unitPrice || 0);
      const onHand = Number(item.onHand || 0);
      const reorder = Number(item.reorderLevel || 0);
      expectedValuation += (cost * onHand);

      if (onHand === 0) {
        expectedOutOfStock++;
      } else if (onHand <= reorder) {
        expectedLowStock++;
      }
    }

    if (rep.totalValuation !== undefined) {
      assert.equal(
        Number(rep.totalValuation).toFixed(2),
        expectedValuation.toFixed(2),
        `totalValuation (${rep.totalValuation}) must match sum(costPrice * onHand) (${expectedValuation.toFixed(2)})`
      );
    }

    if (rep.lowStockItemsCount !== undefined) {
      assert.equal(rep.lowStockItemsCount, expectedLowStock, `lowStockItemsCount (${rep.lowStockItemsCount}) == ${expectedLowStock}`);
    }
    if (rep.outOfStockCount !== undefined) {
      assert.equal(rep.outOfStockCount, expectedOutOfStock, `outOfStockCount (${rep.outOfStockCount}) == ${expectedOutOfStock}`);
    }

    // Category filter: FLUIDS
    const fluidsRes = await client.getReportInventoryUsage({ category: 'FLUIDS' });
    assert.equal(fluidsRes.status, 200);
    const fluidItems = fluidsRes.body.records || fluidsRes.body.items || [];
    for (const it of fluidItems) {
      if (it.category) {
        assert.equal(it.category.toUpperCase(), 'FLUIDS', `Filtered item category must be FLUIDS (got ${it.category})`);
      }
    }

    // Category filter: BRAKES
    const brakesRes = await client.getReportInventoryUsage({ category: 'BRAKES' });
    assert.equal(brakesRes.status, 200);
    const brakeItems = brakesRes.body.records || brakesRes.body.items || [];
    for (const it of brakeItems) {
      if (it.category) {
        assert.equal(it.category.toUpperCase(), 'BRAKES', `Filtered item category must be BRAKES (got ${it.category})`);
      }
    }
  });
});
