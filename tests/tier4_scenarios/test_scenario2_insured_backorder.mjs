import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertErrorStatus, assertStockInvariant } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 4 Scenario 2: Insured Vehicle Repair with Document Gate & Backorder Cycle', async () => {
  const client = new GarageApiClient();
  client.resetState();
  const server = client.getServer();

  // === STEP 1: Insured Priority Check-in ===
  await client.asRole('FRONT_DESK');
  const originalQueuedTime = new Date('2026-11-05T08:15:00Z').toISOString();

  const regRes = await client.checkin(sampleCheckinPayload({
    customerName: 'คุณอนันต์ ชัยเจริญ',
    customerPhone: '0898765432',
    licensePlate: '2ขค-5678 กทม',
    make: 'Honda',
    model: 'Civic FE 1.5 Turbo',
    complaint: 'ระบบไฟชาร์จไม่เข้า ไดชาร์จมีกลิ่นไหม้',
    queueClass: 'PRIORITY',
    priorityReason: 'งานเคลมประกันภัยชั้น 1',
    insurerName: 'วิริยะประกันภัย',
    claimNo: 'CLM-2026-901',
    insuranceDocsReceived: false, // Docs NOT yet received!
    insuranceCoveredAmount: 3000.00,
    queuedAt: originalQueuedTime
  }));
  assertStatusCode(regRes, 200, 'Step 1: Check-in');
  const repairId = regRes.body.repairId;
  assert.equal(regRes.body.queueClass, 'PRIORITY');

  // === STEP 2: Front Desk Calls Next & Assigns Bay ===
  const callRes = await client.callNext(1, 3);
  assertStatusCode(callRes, 200, 'Step 2: Call Next');
  assert.equal(callRes.body.repairId, repairId);
  assert.equal(callRes.body.status, 'IN_DIAGNOSIS');
  assert.equal(callRes.body.bayId, 1);

  // === STEP 3: Mechanic Drafts Estimate for Alternator (Out of Stock) ===
  await client.asRole('MECHANIC');
  // Part 7 (Alternator) has onHand = 0
  const estRes = await client.createEstimate({
    repairId,
    diagnosisNote: 'ไดชาร์จช็อตไหม้ ต้องเปลี่ยนลูกใหม่',
    lines: [
      { lineType: 'LABOR', description: 'ค่าแรงเปลี่ยนไดชาร์จและตรวจเช็คระบบไฟ', qty: 1, unitPrice: 1200.00 },
      { lineType: 'PART', partId: 7, description: 'ไดชาร์จ Alternator 12V 100A', qty: 1, unitPrice: 4500.00 }
    ]
  });
  assertStatusCode(estRes, 200, 'Step 3: Estimate Drafted');
  const estimateId = estRes.body.estimate.estimateId;

  // === STEP 4: Approval Rejected Without Insurance Documents ===
  await client.asRole('FRONT_DESK');
  const rejectedApp = await client.decideEstimate(estimateId, 'APPROVED', false);
  assertErrorStatus(rejectedApp, 422, 'INSURANCE_DOCS_MISSING', 'Step 4a: Rejection Gate');

  // === STEP 5: Documents Received & Approved -> Stockout Triggers ON_HOLD ===
  const approvedApp = await client.decideEstimate(estimateId, 'APPROVED', true);
  assertStatusCode(approvedApp, 200, 'Step 5a: Approval Succeeded');
  assert.equal(approvedApp.body.repairOrder.status, 'ON_HOLD', 'Repair moves to ON_HOLD');
  assert.equal(approvedApp.body.repairOrder.bayId, null, 'Bay 1 released when holding for parts');

  const req = server.partRequests.find(pr => pr.partId === 7);
  assert.equal(req.status, 'BACKORDERED', 'Alternator marked BACKORDERED');

  // === STEP 6: Warehouse Creates Supplier Purchase Order ===
  await client.asRole('WAREHOUSE');
  const poRes = await client.createPO({
    supplierName: 'บริษัท เด็นโซ่ เซลส์ (ประเทศไทย) จำกัด',
    lines: [{ partId: 7, qtyOrdered: 2, unitCost: 3500.00 }]
  });
  assertStatusCode(poRes, 200, 'Step 6: PO Created');
  const poId = poRes.body.purchaseOrder.poId;
  const poLineId = poRes.body.lines[0].poLineId;

  // === STEP 7: PO Received -> Auto-Allocates FIFO & Resumes Repair to QUEUED ===
  const receiveRes = await client.receivePO(poId, [
    { poLineId, qtyReceived: 2 }
  ]);
  assertStatusCode(receiveRes, 200, 'Step 7a: PO Received');

  // Check backorder auto-allocation
  assert.equal(req.status, 'RESERVED', 'Backorder auto-promoted to RESERVED');

  const resumedRepair = server.repairOrders.find(r => r.repairId === repairId);
  assert.equal(resumedRepair.status, 'QUEUED', 'Repair auto-resumed to QUEUED');
  assert.equal(resumedRepair.queuedAt, originalQueuedTime, 'Original queuedAt preserved');

  // === STEP 8: Call Next into Free Bay & Mechanic ===
  await client.asRole('FRONT_DESK');
  const callRes2 = await client.callNext(2, 4); // Bay 2, Mechanic Prasert
  assertStatusCode(callRes2, 200, 'Step 8: Reassign Bay');
  assert.equal(callRes2.body.repairId, repairId);
  assert.equal(callRes2.body.status, 'IN_REPAIR');
  assert.equal(callRes2.body.bayId, 2);

  // === STEP 9: Warehouse Issues Part & Mechanic Completes QC ===
  await client.asRole('WAREHOUSE');
  await client.issuePart(req.requestId);
  assert.equal(req.status, 'ISSUED');

  await client.asRole('MECHANIC');
  const qcRes = await client.submitQC(repairId, true);
  assertStatusCode(qcRes, 200, 'Step 9: QC Passed');
  assert.equal(qcRes.body.status, 'AWAITING_PAYMENT');
  assert.equal(qcRes.body.bayId, null, 'Bay 2 released');

  // === STEP 10: Invoicing with Insurance Split ===
  await client.asRole('FRONT_DESK');
  const invRes = await client.generateInvoice(repairId);
  assertStatusCode(invRes, 200, 'Step 10: Invoicing');
  const inv = invRes.body.invoice;

  assert.equal(inv.subtotal, 5700.00, '1200 labor + 4500 part = 5700');
  assert.equal(inv.insuranceCovered, 3000.00);
  assert.equal(inv.customerDue, 2700.00, 'Customer pays 5700 - 3000 = 2700');

  // === STEP 11: Insurer Direct Payment & Customer Settlement ===
  const payInsurerRes = await client.payInvoice(inv.invoiceId, 3000.00, 'INSURER', 'INSURANCE_DIRECT');
  assertSuccess(payInsurerRes, 'Insurer payment');
  assert.equal(payInsurerRes.body.repairStatus, 'AWAITING_PAYMENT', 'Customer due still remaining');

  const payCustomerRes = await client.payInvoice(inv.invoiceId, 2700.00, 'CUSTOMER', 'TRANSFER');
  assertSuccess(payCustomerRes, 'Customer payment');
  assert.equal(payCustomerRes.body.repairStatus, 'COMPLETED');

  assert.equal(resumedRepair.status, 'COMPLETED');
});
