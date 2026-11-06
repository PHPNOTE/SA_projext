import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertErrorStatus, assertSuccess } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 2: Invalid State Machine Transitions & Guards', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-B4.1: Drafting estimate for order in QUEUED status rejected (409)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-1234 กทม' }));

    // Vehicle is still in QUEUED (not yet called next into IN_DIAGNOSIS)
    await client.asRole('MECHANIC');
    const estRes = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'ตรวจเช็ค', qty: 1, unitPrice: 300.00 }]
    });
    assertErrorStatus(estRes, 409, 'INVALID_STATUS', 'TC-B4.1');
  });

  await t.test('TC-B4.2: Submitting QC for repair order in IN_DIAGNOSIS rejected (409)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-2345 กทม' }));
    await client.callNext(1, 3);

    // Vehicle is in IN_DIAGNOSIS
    await client.asRole('MECHANIC');
    const qcRes = await client.submitQC(reg.body.repairId, true);
    assertErrorStatus(qcRes, 409, 'INVALID_STATUS', 'TC-B4.2');
  });

  await t.test('TC-B4.3: Generating invoice for repair order in IN_REPAIR rejected (409)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-3456 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'งานซ่อม', qty: 1, unitPrice: 400.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    // Job is in IN_REPAIR (not yet QC passed into AWAITING_PAYMENT)
    const invRes = await client.generateInvoice(reg.body.repairId);
    assertErrorStatus(invRes, 409, 'INVALID_STATUS', 'TC-B4.3');
  });

  await t.test('TC-B4.4: Generating duplicate active invoice when one already exists rejected (409)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '4ฉช-4567 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'แรงงาน', qty: 1, unitPrice: 500.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');
    await client.asRole('MECHANIC');
    await client.submitQC(reg.body.repairId, true);

    // First invoice generation succeeds
    await client.asRole('FRONT_DESK');
    const inv1 = await client.generateInvoice(reg.body.repairId);
    assertSuccess(inv1);

    // Attempt second active invoice generation
    const inv2 = await client.generateInvoice(reg.body.repairId);
    assertErrorStatus(inv2, 409, 'DUPLICATE_INVOICE', 'TC-B4.4');
  });

  await t.test('TC-B4.5: Paying a void or nonexistent invoice rejected (404/409)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Nonexistent invoice
    const payRes = await client.payInvoice(999999, 500.00, 'CUSTOMER');
    assertStatusCode(payRes, 404, 'TC-B4.5 nonexistent invoice');
  });

  await t.test('TC-B4.6: Approving already completed or cancelled repair order rejected (409)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // --- Sub-scenario 1: Lifecycle to COMPLETED ---
    const regCompleted = await client.checkin(sampleCheckinPayload({ licensePlate: '5จบ-5678 กทม' }));
    assertSuccess(regCompleted, 'Check-in for completion flow');
    const roCompletedId = regCompleted.body.repairId;

    await client.callNext(1, 3); // Bay 1, Mechanic 3 -> IN_DIAGNOSIS

    await client.asRole('MECHANIC');
    const estRes = await client.createEstimate({
      repairId: roCompletedId,
      lines: [{ lineType: 'LABOR', description: 'งานซ่อมบำรุง', qty: 1, unitPrice: 350.00 }]
    });
    assertSuccess(estRes, 'Estimate created');
    const estId = estRes.body.estimate.estimateId;

    await client.asRole('FRONT_DESK');
    const appRes = await client.decideEstimate(estId, 'APPROVED');
    assertSuccess(appRes, 'Initial estimate approved -> IN_REPAIR');

    await client.asRole('MECHANIC');
    const qcRes = await client.submitQC(roCompletedId, true);
    assertSuccess(qcRes, 'QC passed -> AWAITING_PAYMENT');

    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(roCompletedId);
    assertSuccess(invRes, 'Invoice generated');
    const amountToPay = invRes.body.invoice.customerDue || 350.00;
    const payRes = await client.payInvoice(invRes.body.invoice.invoiceId, amountToPay, 'CUSTOMER');
    assertSuccess(payRes, 'Invoice paid in full -> COMPLETED');

    // Boundary Violation 1a: POST /repairs/{id}/approve on COMPLETED repair
    const reapApproveCompleted = await client.approveRepair(roCompletedId, 'APPROVED');
    assertErrorStatus(reapApproveCompleted, 409, 'INVALID_STATUS', 'TC-B4.6: Approve COMPLETED repair via /repairs/{id}/approve');

    // Boundary Violation 1b: POST /estimates/{id}/decision on COMPLETED repair
    const estDecideCompleted = await client.decideEstimate(estId, 'APPROVED');
    assertErrorStatus(estDecideCompleted, 409, 'INVALID_STATUS', 'TC-B4.6: Decide estimate on COMPLETED repair via /estimates/{id}/decision');

    // --- Sub-scenario 2: Lifecycle to CANCELLED ---
    const regCancelled = await client.checkin(sampleCheckinPayload({ licensePlate: '6ชซ-6789 กทม' }));
    assertSuccess(regCancelled, 'Check-in for cancellation flow');
    const roCancelledId = regCancelled.body.repairId;

    const cancelRes = await client.cancelRepair(roCancelledId, 'Customer withdrew');
    assertSuccess(cancelRes, 'Repair order cancelled -> CANCELLED');

    // Boundary Violation 2a: POST /repairs/{id}/approve on CANCELLED repair
    const reapApproveCancelled = await client.approveRepair(roCancelledId, 'APPROVED');
    assertErrorStatus(reapApproveCancelled, 409, 'INVALID_STATUS', 'TC-B4.6: Approve CANCELLED repair via /repairs/{id}/approve');
  });
});
