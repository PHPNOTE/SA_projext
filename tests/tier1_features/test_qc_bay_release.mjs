import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertErrorStatus } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 1: Physical QC Inspection & Bay Release (R5)', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-7.1: Submit physical QC pass when all parts issued -> AWAITING_PAYMENT, bay freed', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-7100 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 1, qty: 1, unitPrice: 850.00 }]
    });

    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 1);

    // Issue part
    await client.asRole('WAREHOUSE');
    await client.issuePart(req.requestId);

    // Mechanic submits QC pass
    await client.asRole('MECHANIC');
    const qcRes = await client.submitQC(reg.body.repairId, true);
    assertStatusCode(qcRes, 200, 'TC-7.1');
    assert.equal(qcRes.body.status, 'AWAITING_PAYMENT');
    assert.equal(qcRes.body.bayId, null, 'Bay must be released upon QC completion');
  });

  await t.test('TC-7.2: Submit physical QC fail -> rework required, order remains IN_REPAIR in bay', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-7200 กทม' }));
    await client.callNext(2, 4);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'ปรับตั้งระยะเบรก', qty: 1, unitPrice: 300.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    // QC Failed (e.g. brake pedal spongy)
    await client.asRole('MECHANIC');
    const qcRes = await client.submitQC(reg.body.repairId, false);
    assertStatusCode(qcRes, 200, 'TC-7.2');
    assert.equal(qcRes.body.status, 'IN_REPAIR', 'Must remain IN_REPAIR for rework');
    assert.equal(qcRes.body.bayId, 2, 'Bay must still be held during rework');
  });

  await t.test('TC-7.3: Submit QC blocked if any part request is still RESERVED (not issued)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-7300 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 2, qty: 1, unitPrice: 220.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    // Part is RESERVED but NOT issued!
    await client.asRole('MECHANIC');
    const qcRes = await client.submitQC(reg.body.repairId, true);
    assertErrorStatus(qcRes, 409, 'PENDING_PART_REQUEST', 'TC-7.3');
  });

  await t.test('TC-7.4: Verify bay is released and immediately reassignable post-QC', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Job 1 in Bay 1
    const job1 = await client.checkin(sampleCheckinPayload({ licensePlate: '4ฉช-7400 กทม' }));
    await client.callNext(1, 3);

    // Job 2 queued
    const job2 = await client.checkin(sampleCheckinPayload({ licensePlate: '5ชซ-7500 กทม' }));

    // Job 1 finishes repair & passes QC
    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: job1.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'ตรวจเช็คไฟหน้า', qty: 1, unitPrice: 150.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');
    await client.asRole('MECHANIC');
    await client.submitQC(job1.body.repairId, true);

    // Now Bay 1 should be immediately assignable to Job 2
    await client.asRole('FRONT_DESK');
    const callRes = await client.callNext(1, 4);
    assertSuccess(callRes, 'TC-7.4: Bay 1 reassigned');
    assert.equal(callRes.body.repairId, job2.body.repairId);
    assert.equal(callRes.body.bayId, 1);
  });

  await t.test('TC-7.5: Verify audit log records QC state transition to status_log', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '6ฌญ-7600 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'ถ่ายน้ำมันเกียร์', qty: 1, unitPrice: 400.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    await client.asRole('MECHANIC');
    await client.submitQC(reg.body.repairId, true);

    const server = client.getServer();
    const qcLog = server.statusLogs.find(l => l.entityId === reg.body.repairId && l.toStatus === 'QC');
    assert.ok(qcLog, 'QC entry must exist in status_log');
    assert.equal(qcLog.note, 'QC Passed');
  });
});
