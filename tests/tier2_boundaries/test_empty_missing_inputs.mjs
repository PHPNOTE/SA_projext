import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 2: Empty & Missing Input Validation Boundaries', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-B1.1: Check-in with empty customer phone or name rejected (400)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Missing phone
    const res1 = await client.checkin({
      customerName: 'สมชาย',
      customerPhone: '',
      licensePlate: '1กข-1111 กทม'
    });
    assertStatusCode(res1, 400, 'TC-B1.1 empty phone');

    // Missing name
    const res2 = await client.checkin({
      customerName: '',
      customerPhone: '0812345678',
      licensePlate: '1กข-1111 กทม'
    });
    assertStatusCode(res2, 400, 'TC-B1.1 empty name');
  });

  await t.test('TC-B1.2: Check-in with blank vehicle license plate rejected (400)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const res = await client.checkin(sampleCheckinPayload({ licensePlate: '   ' }));
    assertStatusCode(res, 400, 'TC-B1.2 blank plate');
  });

  await t.test('TC-B1.3: Priority check-in with empty priority_reason rejected (400)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const res = await client.checkin(sampleCheckinPayload({
      queueClass: 'PRIORITY',
      priorityReason: '   ' // Blank reason
    }));
    assertStatusCode(res, 400, 'TC-B1.3 blank priority reason');
    assert.equal(res.body.code, 'VALIDATION_ERROR');
  });

  await t.test('TC-B1.4: Estimate creation with empty line items list rejected (400 EmptyEstimateException)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-2222 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const res = await client.createEstimate({
      repairId: reg.body.repairId,
      diagnosisNote: 'ตรวจเช็คไม่มีรายการ',
      lines: [] // Empty lines!
    });
    assertStatusCode(res, 400, 'TC-B1.4 empty lines');
    assert.equal(res.body.code, 'EMPTY_ESTIMATE');
  });

  await t.test('TC-B1.5: Stock count adjustment with blank reason rejected (400 ValidationException)', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    const res = await client.adjustStock(1, -5, '');
    assertStatusCode(res, 400, 'TC-B1.5 blank reason');
    assert.equal(res.body.code, 'VALIDATION_ERROR');
  });
});
