import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertStockInvariant } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 3: Multi-Part Requisition & Whole-Line Rule Interactions', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-C3.1: Mixed availability: in-stock part RESERVED, out-of-stock BACKORDERED', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-3100 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    // Part 1 (Oil) has onHand=20; Part 7 (Alternator) has onHand=0
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [
        { lineType: 'PART', partId: 1, qty: 1, unitPrice: 850.00 },
        { lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }
      ]
    });

    await client.asRole('FRONT_DESK');
    const decRes = await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');
    assertSuccess(decRes);

    const server = client.getServer();
    const reqOil = server.partRequests.find(pr => pr.partId === 1);
    const reqAlt = server.partRequests.find(pr => pr.partId === 7);

    assert.equal(reqOil.status, 'RESERVED', 'Available part must be reserved');
    assert.equal(reqAlt.status, 'BACKORDERED', 'Unavailable part must be backordered');

    // Repair order must hold because of the backordered part
    assert.equal(decRes.body.repairOrder.status, 'ON_HOLD');
    assert.equal(decRes.body.repairOrder.bayId, null, 'Bay must be released while holding');
  });

  await t.test('TC-C3.2: Whole-line rule enforced: 5 requested, 4 available -> all 5 BACKORDERED', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-3200 กทม' }));
    await client.callNext(1, 3);

    // Part 6 (Timing Belt) has onHand=4, reserved=0
    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 6, qty: 5, unitPrice: 1850.00 }] // Request 5 units (short by 1)
    });

    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 6);
    assert.equal(req.status, 'BACKORDERED', 'Whole line must be backordered (no partial split)');

    const belt = server.parts.find(p => p.id === 6);
    assert.equal(belt.reserved, 0, 'No partial reservation allowed; reserved must remain 0');
    assertStockInvariant(belt, server.stockMovements);
  });

  await t.test('TC-C3.3: Repair order enters ON_HOLD until all backordered parts are received', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-3300 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }] // Alternator
    });
    await client.asRole('FRONT_DESK');
    const appRes = await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');
    assert.equal(appRes.body.repairOrder.status, 'ON_HOLD');

    // Supplier delivers alternator
    await client.asRole('WAREHOUSE');
    const poRes = await client.createPO({
      supplierName: 'Denso Direct',
      lines: [{ partId: 7, qtyOrdered: 1, unitCost: 3500.00 }]
    });
    await client.receivePO(poRes.body.purchaseOrder.poId, [
      { poLineId: poRes.body.lines[0].poLineId, qtyReceived: 1 }
    ]);

    const server = client.getServer();
    const repair = server.repairOrders.find(r => r.repairId === reg.body.repairId);
    assert.equal(repair.status, 'QUEUED', 'Resumed to QUEUED once backorder resolved');
  });
});
