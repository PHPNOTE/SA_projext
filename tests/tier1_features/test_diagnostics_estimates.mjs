import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 1: Diagnostics & Estimates (R2, R3)', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-2.1: Assign bay and mechanic to queued order -> IN_DIAGNOSIS', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-2222 กทม' }));
    const callRes = await client.callNext(1, 3); // Bay 1, Mechanic 3 (Somchai)

    assertStatusCode(callRes, 200, 'TC-2.1');
    assert.equal(callRes.body.status, 'IN_DIAGNOSIS');
    assert.equal(callRes.body.bayId, 1);
    assert.equal(callRes.body.mechanicId, 3);
  });

  await t.test('TC-2.2: Mechanic drafts Estimate Revision 1 with labor & parts snapshot lines', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-3333 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const estPayload = {
      repairId: reg.body.repairId,
      diagnosisNote: 'ระบบเบรกสึกหรอ และน้ำมันเครื่องหมดสภาพ',
      lines: [
        { lineType: 'LABOR', description: 'ค่าแรงเปลี่ยนน้ำมันเครื่องและไส้กรอง', qty: 1, unitPrice: 350.00 },
        { lineType: 'PART', partId: 1, description: 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4L)', qty: 1, unitPrice: 850.00 },
        { lineType: 'PART', partId: 2, description: 'ไส้กรองน้ำมันเครื่อง', qty: 1, unitPrice: 220.00 }
      ]
    };

    const estRes = await client.createEstimate(estPayload);
    assertStatusCode(estRes, 200, 'TC-2.2');
    assert.equal(estRes.body.estimate.revisionNo, 1);
    assert.equal(estRes.body.estimate.status, 'PENDING');
    assert.equal(estRes.body.lines.length, 3);

    // Verify repair order status moved to AWAITING_APPROVAL
    const server = client.getServer();
    const repair = server.repairOrders.find(r => r.repairId === reg.body.repairId);
    assert.equal(repair.status, 'AWAITING_APPROVAL');
  });

  await t.test('TC-2.3: Query estimate details and calculate totals', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-4444 กทม' }));
    await client.callNext(2, 4);

    await client.asRole('MECHANIC');
    const estRes = await client.createEstimate({
      repairId: reg.body.repairId,
      diagnosisNote: 'เปลี่ยนผ้าเบรกคู่หน้า',
      lines: [
        { lineType: 'LABOR', description: 'ค่าแรงเจียรจานและเปลี่ยนผ้าเบรก', qty: 2, unitPrice: 400.00 },
        { lineType: 'PART', partId: 3, description: 'ผ้าเบรกหน้า Ceramic Premium', qty: 1, unitPrice: 1450.00 }
      ]
    });
    assertSuccess(estRes);

    const lines = estRes.body.lines;
    const laborTotal = lines.filter(l => l.lineType === 'LABOR').reduce((acc, l) => acc + (l.qty * l.unitPrice), 0);
    const partsTotal = lines.filter(l => l.lineType === 'PART').reduce((acc, l) => acc + (l.qty * l.unitPrice), 0);

    assert.equal(laborTotal, 800.00, 'Labor total: 2 * 400 = 800');
    assert.equal(partsTotal, 1450.00, 'Parts total: 1 * 1450 = 1450');
    assert.equal(laborTotal + partsTotal, 2250.00, 'Combined estimate subtotal = 2250');
  });

  await t.test('TC-2.4: Mechanic drafts Estimate Revision 2 for extra damage discovered during repair', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '4ฉช-5555 กทม' }));
    await client.callNext(1, 3);

    // Rev 1
    await client.asRole('MECHANIC');
    const rev1 = await client.createEstimate({
      repairId: reg.body.repairId,
      diagnosisNote: 'เปลี่ยนน้ำมันเครื่อง',
      lines: [{ lineType: 'PART', partId: 1, qty: 1, unitPrice: 850.00 }]
    });
    assertSuccess(rev1);

    // Customer approves Rev 1 -> moves to IN_REPAIR
    await client.asRole('FRONT_DESK');
    const appRes = await client.decideEstimate(rev1.body.estimate.estimateId, 'APPROVED');
    assertSuccess(appRes);
    assert.equal(appRes.body.repairOrder.status, 'IN_REPAIR');

    // While in repair, extra damage discovered (radiator leak) -> Rev 2
    await client.asRole('MECHANIC');
    const rev2 = await client.createEstimate({
      repairId: reg.body.repairId,
      diagnosisNote: 'ตรวจพบหม้อน้ำรั่วซึมเพิ่มเติม',
      lines: [
        { lineType: 'LABOR', description: 'ค่าแรงเปลี่ยนน้ำยาหล่อเย็น', qty: 1, unitPrice: 200.00 },
        { lineType: 'PART', partId: 5, qty: 1, unitPrice: 420.00 }
      ]
    });
    assertStatusCode(rev2, 200, 'TC-2.4');
    assert.equal(rev2.body.estimate.revisionNo, 2);
    assert.equal(rev2.body.estimate.status, 'PENDING');
  });

  await t.test('TC-2.5: Update diagnostic symptoms and estimated turnaround time', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '5ชซ-6666 กทม' }));
    await client.callNext(3, 3);

    await client.asRole('MECHANIC');
    const estRes = await client.createEstimate({
      repairId: reg.body.repairId,
      diagnosisNote: 'ตรวจเช็คละเอียด: แร็คพวงมาลัยหลวม ต้องตั้งศูนย์ล่วงหน้า คาดใช้เวลา 3 ชั่วโมง',
      lines: [{ lineType: 'LABOR', description: 'ตรวจเช็คช่วงล่าง', qty: 1, unitPrice: 500.00 }]
    });
    assertSuccess(estRes);
    assert.ok(estRes.body.estimate.diagnosisNote.includes('3 ชั่วโมง'));
  });
});
