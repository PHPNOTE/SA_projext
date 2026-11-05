import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertErrorStatus } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 1: Customer Approval & Insurance Claim Gate (R3, R4)', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-3.1: Customer approves Revision 1 -> locks parts, transitions to IN_REPAIR', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-1001 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const estRes = await client.createEstimate({
      repairId: reg.body.repairId,
      diagnosisNote: 'เปลี่ยนน้ำมันเครื่องและกรอง',
      lines: [
        { lineType: 'PART', partId: 1, qty: 1, unitPrice: 850.00 },
        { lineType: 'PART', partId: 2, qty: 1, unitPrice: 220.00 }
      ]
    });
    assertSuccess(estRes);

    await client.asRole('FRONT_DESK');
    const decRes = await client.decideEstimate(estRes.body.estimate.estimateId, 'APPROVED');
    assertStatusCode(decRes, 200, 'TC-3.1');
    assert.equal(decRes.body.estimate.status, 'APPROVED');
    assert.equal(decRes.body.repairOrder.status, 'IN_REPAIR');

    // Verify stock was locked in reserved counter
    const server = client.getServer();
    const oil = server.parts.find(p => p.id === 1);
    const filter = server.parts.find(p => p.id === 2);
    assert.equal(oil.reserved, 1);
    assert.equal(filter.reserved, 1);
  });

  await t.test('TC-3.2: Customer declines Revision 1 -> cancels repair order, releases bay', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-2002 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const estRes = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 3, qty: 1, unitPrice: 1450.00 }]
    });

    await client.asRole('FRONT_DESK');
    const decRes = await client.decideEstimate(estRes.body.estimate.estimateId, 'DECLINED');
    assertStatusCode(decRes, 200, 'TC-3.2');
    assert.equal(decRes.body.estimate.status, 'DECLINED');
    assert.equal(decRes.body.repairOrder.status, 'CANCELLED');
    assert.equal(decRes.body.repairOrder.bayId, null, 'Bay released immediately upon cancellation');
  });

  await t.test('TC-3.3: Customer declines Revision N -> prior approved scope stays valid', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-3003 กทม' }));
    await client.callNext(1, 3);

    // Rev 1 approved
    await client.asRole('MECHANIC');
    const rev1 = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 1, qty: 1, unitPrice: 850.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(rev1.body.estimate.estimateId, 'APPROVED');

    // Rev 2 extra damage drafted
    await client.asRole('MECHANIC');
    const rev2 = await client.createEstimate({
      repairId: reg.body.repairId,
      diagnosisNote: 'ลูกปืนล้อหน้าแตก แนะนำเปลี่ยนเพิ่ม',
      lines: [{ lineType: 'LABOR', description: 'เปลี่ยนลูกปืนล้อ', qty: 1, unitPrice: 600.00 }]
    });

    // Customer declines Rev 2 extra work
    await client.asRole('FRONT_DESK');
    const decRes = await client.decideEstimate(rev2.body.estimate.estimateId, 'DECLINED');
    assertStatusCode(decRes, 200, 'TC-3.3');
    assert.equal(decRes.body.estimate.status, 'DECLINED');
    assert.equal(decRes.body.repairOrder.status, 'IN_REPAIR', 'Must remain IN_REPAIR for Rev 1 scope');

    const server = client.getServer();
    const approvedRev1 = server.estimates.find(e => e.estimateId === rev1.body.estimate.estimateId);
    assert.equal(approvedRev1.status, 'APPROVED', 'Rev 1 remains approved');
  });

  await t.test('TC-3.4: Insurance claim approval with verified documents received', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const reg = await client.checkin(sampleCheckinPayload({
      licensePlate: '4ฉช-4004 กทม',
      insurerName: 'วิริยะประกันภัย',
      claimNo: 'CLM-2026-9901',
      insuranceDocsReceived: true,
      insuranceCoveredAmount: 5000.00
    }));
    await client.callNext(2, 4);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [
        { lineType: 'LABOR', description: 'เคาะพ่นสีกันชนหน้า', qty: 1, unitPrice: 3500.00 },
        { lineType: 'PART', partId: 5, qty: 1, unitPrice: 420.00 }
      ]
    });

    await client.asRole('FRONT_DESK');
    const decRes = await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED', true);
    assertStatusCode(decRes, 200, 'TC-3.4');
    assert.equal(decRes.body.estimate.status, 'APPROVED');
    assert.equal(decRes.body.repairOrder.status, 'IN_REPAIR');
    assert.equal(decRes.body.repairOrder.insuranceDocsReceived, true);
  });

  await t.test('TC-3.5: Insurance claim approval rejected when documents missing (HTTP 422)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const reg = await client.checkin(sampleCheckinPayload({
      licensePlate: '5ชซ-5005 กทม',
      insurerName: 'ทิพยประกันภัย',
      claimNo: 'CLM-2026-8802',
      insuranceDocsReceived: false // Documents NOT yet received!
    }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 1, qty: 1, unitPrice: 850.00 }]
    });

    await client.asRole('FRONT_DESK');
    // Attempt approval while docs received is still false
    const decRes = await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED', false);
    assertErrorStatus(decRes, 422, 'INSURANCE_DOCS_MISSING', 'TC-3.5');

    const server = client.getServer();
    const estEntity = server.estimates.find(e => e.estimateId === est.body.estimate.estimateId);
    assert.equal(estEntity.status, 'PENDING', 'Estimate must remain PENDING on 422 rejection');
  });
});
