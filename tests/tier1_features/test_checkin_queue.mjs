import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 1: Check-in & Queue Management (R1, R2)', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-1.1: Walk-in check-in creates QUEUED ticket', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const payload = sampleCheckinPayload({
      customerName: 'คุณสมเกียรติ พงษ์ไพศาล',
      customerPhone: '0812345678',
      licensePlate: '1กข-9999 กทม',
      complaint: 'เช็คระยะ 40,000 กม.',
      queueClass: 'NORMAL'
    });

    const res = await client.checkin(payload);
    assertStatusCode(res, 200, 'TC-1.1');
    assert.equal(res.body.status, 'QUEUED');
    assert.ok(res.body.ticketNo.startsWith('TICK-'));
    assert.equal(res.body.bayId, null);
    assert.equal(res.body.queueClass, 'NORMAL');
  });

  await t.test('TC-1.2: Priority queue check-in with mandatory justification', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const payload = sampleCheckinPayload({
      customerName: 'คุณอนันต์ ด่วนพิเศษ',
      customerPhone: '0898765432',
      licensePlate: '2ขค-8888 กทม',
      complaint: 'เครื่องยนต์สะดุด มีธุระเดินทางไกล',
      queueClass: 'PRIORITY',
      priorityReason: 'ลูกค้าเดินทางไปต่างจังหวัดด่วน'
    });

    const res = await client.checkin(payload);
    assertStatusCode(res, 200, 'TC-1.2');
    assert.equal(res.body.status, 'QUEUED');
    assert.equal(res.body.queueClass, 'PRIORITY');
    assert.equal(res.body.priorityReason, 'ลูกค้าเดินทางไปต่างจังหวัดด่วน');
  });

  await t.test('TC-1.3: Front desk calls next ticket; assigns free bay & mechanic', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Register 1 normal ticket
    const regRes = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-7777 กทม' }));
    assertSuccess(regRes);

    // Call next: Bay 1 (id: 1), Mechanic Somchai (id: 3)
    const callRes = await client.callNext(1, 3);
    assertStatusCode(callRes, 200, 'TC-1.3');
    assert.equal(callRes.body.repairId, regRes.body.repairId);
    assert.equal(callRes.body.status, 'IN_DIAGNOSIS');
    assert.equal(callRes.body.bayId, 1);
    assert.equal(callRes.body.mechanicId, 3);
  });

  await t.test('TC-1.4: 120-minute queue aging elevates older normal ticket (Algorithm 1)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Ticket 1: Normal, registered 130 minutes ago
    const olderTime = new Date(Date.now() - 130 * 60 * 1000).toISOString();
    const t1 = await client.checkin(sampleCheckinPayload({
      licensePlate: '1กข-1111 กทม',
      queuedAt: olderTime
    }));
    assertSuccess(t1);

    // Ticket 2: Priority, registered 10 minutes ago
    const priorityTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const t2 = await client.checkin(sampleCheckinPayload({
      licensePlate: '2ขค-2222 กทม',
      queueClass: 'PRIORITY',
      priorityReason: 'งานด่วน',
      queuedAt: priorityTime
    }));
    assertSuccess(t2);

    // Ticket 3: Normal, registered 5 minutes ago
    const recentTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const t3 = await client.checkin(sampleCheckinPayload({
      licensePlate: '3งจ-3333 กทม',
      queuedAt: recentTime
    }));
    assertSuccess(t3);

    // Calling next must pick older normal job or priority job ahead of recent normal job
    const call1 = await client.callNext(1, 3);
    assertSuccess(call1, 'First call');
    assert.ok(
      call1.body.repairId === t1.body.repairId || call1.body.repairId === t2.body.repairId,
      'Tier 0 tickets (aged > 120m or priority) must be selected before recent normal ticket'
    );

    const call2 = await client.callNext(2, 4);
    assertSuccess(call2, 'Second call');
    assert.ok(
      call2.body.repairId === t1.body.repairId || call2.body.repairId === t2.body.repairId,
      'Remaining Tier 0 ticket must be selected second'
    );

    const call3 = await client.callNext(3, 3);
    assertSuccess(call3, 'Third call');
    assert.equal(call3.body.repairId, t3.body.repairId, 'Recent normal ticket selected last');
  });

  await t.test('TC-1.5: Front desk places ticket ON_HOLD; releases bay', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '4ฉช-4444 กทม' }));
    await client.callNext(1, 3);

    const holdRes = await client.holdRepair(reg.body.repairId, 'รอการตัดสินใจของลูกค้า');
    assertStatusCode(holdRes, 200, 'TC-1.5');
    assert.equal(holdRes.body.status, 'ON_HOLD');
    assert.equal(holdRes.body.bayId, null, 'Bay must be freed when placed on hold');
  });

  await t.test('TC-1.6: Front desk cancels queued ticket; moves to CANCELLED', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '5ชซ-5555 กทม' }));
    const cancelRes = await client.cancelRepair(reg.body.repairId, 'ลูกค้ายกเลิกคิว');
    assertStatusCode(cancelRes, 200, 'TC-1.6');
    assert.equal(cancelRes.body.status, 'CANCELLED');
    assert.equal(cancelRes.body.bayId, null);
  });
});
