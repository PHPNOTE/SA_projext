import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertNetIssuedBilling, assertStockInvariant } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 4 Scenario 4: Multi-Revision Extra Damage Discovery & Part Return Lifecycle', async () => {
  const client = new GarageApiClient();
  client.resetState();
  const server = client.getServer();

  // === STEP 1: Walk-in Check-in ===
  await client.asRole('FRONT_DESK');
  const regRes = await client.checkin(sampleCheckinPayload({
    customerName: 'คุณศิริพร บุญมี',
    customerPhone: '0841112222',
    licensePlate: '4ฉช-3456 ชลบุรี',
    make: 'Mazda',
    model: 'Mazda 3 SkyActiv',
    complaint: 'เช็คระยะ 60,000 กม. เปลี่ยนน้ำมันเครื่อง'
  }));
  assertStatusCode(regRes, 200, 'Step 1: Check-in');
  const repairId = regRes.body.repairId;

  // === STEP 2: Call Next & Assign Bay 1 ===
  const callRes = await client.callNext(1, 3);
  assertStatusCode(callRes, 200, 'Step 2: Call Next');

  // === STEP 3: Initial Estimate Revision 1 ===
  await client.asRole('MECHANIC');
  const rev1Res = await client.createEstimate({
    repairId,
    diagnosisNote: 'เปลี่ยนถ่ายน้ำมันเครื่องสังเคราะห์แท้',
    lines: [
      { lineType: 'LABOR', description: 'ค่าบริการเปลี่ยนน้ำมันเครื่อง', qty: 1, unitPrice: 400.00 },
      { lineType: 'PART', partId: 1, description: 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4L)', qty: 1, unitPrice: 850.00 }
    ]
  });
  assertStatusCode(rev1Res, 200, 'Step 3: Estimate Rev 1');
  const rev1Id = rev1Res.body.estimate.estimateId;

  // Customer Approves Rev 1
  await client.asRole('FRONT_DESK');
  await client.decideEstimate(rev1Id, 'APPROVED');

  // Warehouse issues Rev 1 oil
  await client.asRole('WAREHOUSE');
  const reqOil = server.partRequests.find(pr => pr.partId === 1 && pr.estimateLineId !== null);
  await client.issuePart(reqOil.requestId);

  // === STEP 4: Extra Damage Discovered During Repair (Estimate Revision 2) ===
  await client.asRole('MECHANIC');
  // Part 3 (Brake Pads) unitPrice = 1450.00
  const rev2Res = await client.createEstimate({
    repairId,
    diagnosisNote: 'ตรวจพบผ้าเบรกหน้าสึกหรอถึงแผ่นเตือน ต้องเปลี่ยนเพิ่ม',
    lines: [
      { lineType: 'LABOR', description: 'ค่าแรงเปลี่ยนผ้าเบรกและเจียรจาน', qty: 1, unitPrice: 300.00 },
      { lineType: 'PART', partId: 3, description: 'ผ้าเบรกหน้า Ceramic Premium', qty: 2, unitPrice: 1450.00 }
    ]
  });
  assertStatusCode(rev2Res, 200, 'Step 4: Estimate Rev 2');
  const rev2Id = rev2Res.body.estimate.estimateId;
  assert.equal(rev2Res.body.estimate.revisionNo, 2);

  // Customer Approves Rev 2 Extra Damage
  await client.asRole('FRONT_DESK');
  await client.decideEstimate(rev2Id, 'APPROVED');

  // Warehouse issues Rev 2 parts (2 brake pads)
  await client.asRole('WAREHOUSE');
  const reqBrake = server.partRequests.find(pr => pr.partId === 3 && pr.status === 'RESERVED');
  assert.ok(reqBrake);
  await client.issuePart(reqBrake.requestId);

  // === STEP 5: Mechanic Returns 1 Unused Brake Pad ===
  // Mechanic realizes only 1 set was needed, returns 1 set
  const returnRes = await client.returnPart(reqBrake.requestId, 1);
  assertStatusCode(returnRes, 200, 'Step 5: Return Unused Part');
  assert.equal(returnRes.body.partRequest.qtyReturned, 1);

  // === STEP 6: Physical QC Passed & Bay Released ===
  await client.asRole('MECHANIC');
  const qcRes = await client.submitQC(repairId, true);
  assertStatusCode(qcRes, 200, 'Step 6: QC Passed');
  assert.equal(qcRes.body.status, 'AWAITING_PAYMENT');
  assert.equal(qcRes.body.bayId, null, 'Bay 1 released');

  // === STEP 7: Net-Issued Invoice Generation ===
  await client.asRole('FRONT_DESK');
  const invRes = await client.generateInvoice(repairId);
  assertStatusCode(invRes, 200, 'Step 7: Generate Invoice');
  const inv = invRes.body.invoice;

  // Expected subtotal:
  // Rev 1 labor: 400
  // Rev 1 oil (1 net): 850
  // Rev 2 labor: 300
  // Rev 2 brake pad (2 issued - 1 returned = 1 net): 1450
  // Total = 400 + 850 + 300 + 1450 = 3000.00
  assert.equal(inv.subtotal, 3000.00, 'Expected net billed subtotal 3000');
  assert.equal(inv.customerDue, 3000.00);

  const brakeLine = invRes.body.lines.find(l => l.partId === 3);
  assert.ok(brakeLine);
  assert.equal(brakeLine.qty, 1, 'Billed quantity for brake pad must be exactly net 1');
  assert.equal(brakeLine.lineTotal, 1450.00);

  assertNetIssuedBilling(server.partRequests, invRes.body.lines);

  // === STEP 8: Customer Pays Full Settlement ===
  const payRes = await client.payInvoice(inv.invoiceId, 3000.00, 'CUSTOMER', 'TRANSFER');
  assertStatusCode(payRes, 200, 'Step 8: Payment Settlement');
  assert.equal(payRes.body.repairStatus, 'COMPLETED');

  const finalRepair = server.repairOrders.find(r => r.repairId === repairId);
  assert.equal(finalRepair.status, 'COMPLETED');
  assert.ok(finalRepair.closedAt !== null);
});
