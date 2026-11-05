import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertNetIssuedBilling, assertStockInvariant } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 4 Scenario 1: Standard Walk-in Repair Full Lifecycle Workflow', async () => {
  const client = new GarageApiClient();
  client.resetState();
  const server = client.getServer();

  // === STEP 1: Customer Walk-in Check-in ===
  await client.asRole('FRONT_DESK');
  const checkinPayload = sampleCheckinPayload({
    customerName: 'คุณสมเกียรติ พงษ์ไพศาล',
    customerPhone: '0812345678',
    licensePlate: '1กข-9988 กทม',
    make: 'Toyota',
    model: 'Hilux Revo 2.8',
    complaint: 'เช็คระยะ 40,000 กม. เปลี่ยนน้ำมันเครื่องและไส้กรอง',
    queueClass: 'NORMAL'
  });

  const checkinRes = await client.checkin(checkinPayload);
  assertStatusCode(checkinRes, 200, 'Step 1: Check-in');
  const repairId = checkinRes.body.repairId;
  assert.equal(checkinRes.body.status, 'QUEUED');
  assert.equal(checkinRes.body.bayId, null);

  // === STEP 2: Front Desk Calls Next Ticket ===
  // Assign Bay 1 and Mechanic Somchai (id: 3)
  const callRes = await client.callNext(1, 3);
  assertStatusCode(callRes, 200, 'Step 2: Call Next');
  assert.equal(callRes.body.repairId, repairId);
  assert.equal(callRes.body.status, 'IN_DIAGNOSIS');
  assert.equal(callRes.body.bayId, 1);
  assert.equal(callRes.body.mechanicId, 3);

  // === STEP 3: Mechanic Diagnoses & Drafts Estimate Revision 1 ===
  await client.asRole('MECHANIC');
  const estRes = await client.createEstimate({
    repairId,
    diagnosisNote: 'ตรวจเช็คตามระยะ: เปลี่ยนถ่ายน้ำมันเครื่องและไส้กรอง ตรวจเช็คเบรกทั่วไป',
    lines: [
      { lineType: 'LABOR', description: 'ค่าแรงบริการเปลี่ยนถ่ายของเหลว', qty: 1, unitPrice: 500.00 },
      { lineType: 'PART', partId: 1, description: 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4L)', qty: 1, unitPrice: 850.00 },
      { lineType: 'PART', partId: 2, description: 'ไส้กรองน้ำมันเครื่อง Toyota', qty: 1, unitPrice: 220.00 }
    ]
  });
  assertStatusCode(estRes, 200, 'Step 3: Estimate Drafted');
  const estimateId = estRes.body.estimate.estimateId;
  assert.equal(estRes.body.estimate.revisionNo, 1);
  assert.equal(estRes.body.estimate.status, 'PENDING');

  // Verify repair order status transitioned to AWAITING_APPROVAL
  const repairAfterEst = server.repairOrders.find(r => r.repairId === repairId);
  assert.equal(repairAfterEst.status, 'AWAITING_APPROVAL');
  assert.equal(repairAfterEst.bayId, 1, 'Bay remains held during customer approval');

  // === STEP 4: Customer Approves Estimate ===
  await client.asRole('FRONT_DESK');
  const appRes = await client.decideEstimate(estimateId, 'APPROVED');
  assertStatusCode(appRes, 200, 'Step 4: Customer Approval');
  assert.equal(appRes.body.estimate.status, 'APPROVED');
  assert.equal(appRes.body.repairOrder.status, 'IN_REPAIR');

  // Verify stock was locked in reserved counter
  const oil = server.parts.find(p => p.id === 1);
  const filter = server.parts.find(p => p.id === 2);
  assert.equal(oil.reserved, 1);
  assert.equal(filter.reserved, 1);
  assertStockInvariant(oil, server.stockMovements);
  assertStockInvariant(filter, server.stockMovements);

  // === STEP 5: Warehouse Issues Reserved Parts to Mechanic ===
  await client.asRole('WAREHOUSE');
  const reqOil = server.partRequests.find(pr => pr.partId === 1 && pr.estimateLineId !== null);
  const reqFilter = server.partRequests.find(pr => pr.partId === 2 && pr.estimateLineId !== null);

  const issueOilRes = await client.issuePart(reqOil.requestId);
  assertStatusCode(issueOilRes, 200, 'Step 5a: Issue Oil');
  assert.equal(issueOilRes.body.partRequest.status, 'ISSUED');

  const issueFilterRes = await client.issuePart(reqFilter.requestId);
  assertStatusCode(issueFilterRes, 200, 'Step 5b: Issue Filter');
  assert.equal(issueFilterRes.body.partRequest.status, 'ISSUED');

  assert.equal(oil.reserved, 0, 'Oil reserved cleared after issue');
  assert.equal(filter.reserved, 0, 'Filter reserved cleared after issue');
  assertStockInvariant(oil, server.stockMovements);
  assertStockInvariant(filter, server.stockMovements);

  // === STEP 6: Mechanic Completes Work & Physical QC Pass ===
  await client.asRole('MECHANIC');
  const qcRes = await client.submitQC(repairId, true);
  assertStatusCode(qcRes, 200, 'Step 6: QC Passed');
  assert.equal(qcRes.body.status, 'AWAITING_PAYMENT');
  assert.equal(qcRes.body.bayId, null, 'Bay 1 released after QC pass');

  // === STEP 7: Front Desk Generates Immutable Invoice ===
  await client.asRole('FRONT_DESK');
  const invRes = await client.generateInvoice(repairId);
  assertStatusCode(invRes, 200, 'Step 7: Invoicing');
  const invoice = invRes.body.invoice;
  assert.equal(invoice.status, 'ISSUED');
  assert.equal(invoice.subtotal, 1570.00, '500 labor + 850 oil + 220 filter = 1570');
  assert.equal(invoice.insuranceCovered, 0.00);
  assert.equal(invoice.customerDue, 1570.00);

  assertNetIssuedBilling(server.partRequests, invRes.body.lines);

  // === STEP 8: Customer Pays Full Due via QR PromptPay / Transfer ===
  const payRes = await client.payInvoice(invoice.invoiceId, 1570.00, 'CUSTOMER', 'TRANSFER');
  assertStatusCode(payRes, 200, 'Step 8: Payment Settlement');
  assert.equal(payRes.body.repairStatus, 'COMPLETED');

  const finalRepair = server.repairOrders.find(r => r.repairId === repairId);
  assert.equal(finalRepair.status, 'COMPLETED');
  assert.ok(finalRepair.closedAt !== null);

  // === STEP 9: Verify Operational Reports ===
  await client.asRole('MANAGER');
  const rep1Res = await client.getReportRepairSummary({ startDate: '2026-11-01', endDate: '2026-11-30' });
  assertSuccess(rep1Res, 'Step 9a: Repair Summary Report');
  const repItem = rep1Res.body.items.find(i => i.repairId === repairId);
  assert.ok(repItem);
  assert.equal(repItem.status, 'COMPLETED');
  assert.equal(repItem.subtotal, 1570.00);

  const rep2Res = await client.getReportInventoryUsage();
  assertSuccess(rep2Res, 'Step 9b: Inventory Usage Report');
  const usedOil = rep2Res.body.items.find(p => p.sku === 'OIL-5W30-4L');
  assert.ok(usedOil);
  assert.equal(usedOil.netConsumed, 1);
});
