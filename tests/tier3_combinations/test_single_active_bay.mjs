import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertSingleBayOccupancy } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 3: Single-Active-Bay Invariant & Concurrency (Bay Constraint)', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-C1.1: Assigning job to already-occupied bay rejected (409 NoFreeBayException)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Register Job 1 and assign to Bay 1
    const job1 = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-0001 กทม' }));
    const call1 = await client.callNext(1, 3);
    assertSuccess(call1);
    assert.equal(call1.body.bayId, 1);

    // Register Job 2 and attempt to assign to Bay 1
    await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-0002 กทม' }));
    const call2 = await client.callNext(1, 4); // Attempting to assign Bay 1 again
    assertStatusCode(call2, 409, 'TC-C1.1 bay occupied');
    assert.equal(call2.body.code, 'NO_FREE_BAY');

    const server = client.getServer();
    assertSingleBayOccupancy(server.repairOrders, 1);
  });

  await t.test('TC-C1.2: Moving job to ON_HOLD releases bay; bay immediately assignable', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const job1 = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-0003 กทม' }));
    await client.callNext(1, 3); // Job 1 in Bay 1

    const job2 = await client.checkin(sampleCheckinPayload({ licensePlate: '4ฉช-0004 กทม' }));

    // Hold Job 1 -> bay 1 freed
    await client.holdRepair(job1.body.repairId, 'รออะไหล่พิเศษ');

    // Now Bay 1 should be assignable to Job 2
    const call2 = await client.callNext(1, 4);
    assertSuccess(call2, 'TC-C1.2: Bay 1 reassigned after hold');
    assert.equal(call2.body.repairId, job2.body.repairId);
    assert.equal(call2.body.bayId, 1);

    const server = client.getServer();
    assertSingleBayOccupancy(server.repairOrders, 1);
  });

  await t.test('TC-C1.3: Cancelling job in IN_DIAGNOSIS releases bay immediately', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const job1 = await client.checkin(sampleCheckinPayload({ licensePlate: '5ชซ-0005 กทม' }));
    await client.callNext(2, 3); // Job 1 in Bay 2

    const job2 = await client.checkin(sampleCheckinPayload({ licensePlate: '6ฌญ-0006 กทม' }));

    // Cancel Job 1
    await client.cancelRepair(job1.body.repairId, 'ลูกค้ายกเลิกการซ่อม');

    // Bay 2 should be assignable to Job 2
    const call2 = await client.callNext(2, 4);
    assertSuccess(call2, 'TC-C1.3: Bay 2 reassigned after cancel');
    assert.equal(call2.body.repairId, job2.body.repairId);
    assert.equal(call2.body.bayId, 2);

    const server = client.getServer();
    assertSingleBayOccupancy(server.repairOrders, 2);
  });

  await t.test('TC-C1.4: QC completion releases bay; moves to AWAITING_PAYMENT, bay assignable', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const job1 = await client.checkin(sampleCheckinPayload({ licensePlate: '7ฎฏ-0007 กทม' }));
    await client.callNext(3, 3); // Job 1 in Bay 3

    const job2 = await client.checkin(sampleCheckinPayload({ licensePlate: '8ฐฑ-0008 กทม' }));

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: job1.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'งานด่วน', qty: 1, unitPrice: 200.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    await client.asRole('MECHANIC');
    const qcRes = await client.submitQC(job1.body.repairId, true);
    assertSuccess(qcRes);
    assert.equal(qcRes.body.bayId, null, 'Bay 3 released');

    // Bay 3 is now free for Job 2
    await client.asRole('FRONT_DESK');
    const call2 = await client.callNext(3, 4);
    assertSuccess(call2, 'TC-C1.4: Bay 3 reassigned after QC');
    assert.equal(call2.body.bayId, 3);

    const server = client.getServer();
    assertSingleBayOccupancy(server.repairOrders, 3);
  });
});
