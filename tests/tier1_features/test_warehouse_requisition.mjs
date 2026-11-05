import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertStockInvariant } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 1: Warehouse Requisition & Parts Issuance (W1, W2, W3)', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-4.1: Upsert spare part master record (SKU, name, price, ROP)', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    const newPartPayload = {
      sku: 'BAT-12V-GS01',
      name: 'แบตเตอรี่ GS Maintenance Free 12V 45Ah',
      sellPrice: 2200.00,
      reorderLevel: 3
    };

    const res = await client.upsertPart(newPartPayload);
    assertStatusCode(res, 201, 'TC-4.1');
    assert.equal(res.body.sku, 'BAT-12V-GS01');
    assert.equal(res.body.sellPrice, 2200.00);
    assert.equal(res.body.reorderLevel, 3);
  });

  await t.test('TC-4.2: Whole-line part reservation when stock available -> RESERVED', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-4200 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 1, qty: 2, unitPrice: 850.00 }] // Oil in stock = 20
    });

    await client.asRole('FRONT_DESK');
    const appRes = await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');
    assertSuccess(appRes);

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 1);
    assert.ok(req);
    assert.equal(req.status, 'RESERVED');
    assert.equal(req.qty, 2);

    const part = server.parts.find(p => p.id === 1);
    assert.equal(part.reserved, 2);
    assertStockInvariant(part, server.stockMovements);
  });

  await t.test('TC-4.3: Whole-line part backorder when stock insufficient -> BACKORDERED', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-4300 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    // Part 7 (Alternator) has onHand = 0
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }]
    });

    await client.asRole('FRONT_DESK');
    const appRes = await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');
    assertSuccess(appRes);

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 7);
    assert.equal(req.status, 'BACKORDERED');
    assert.equal(appRes.body.repairOrder.status, 'ON_HOLD', 'Repair order must hold when backordered');
    assert.equal(appRes.body.repairOrder.bayId, null, 'Bay must be released when on hold');
  });

  await t.test('TC-4.4: Warehouse clerk issues reserved parts to mechanic -> ISSUED', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-4400 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 2, qty: 1, unitPrice: 220.00 }] // Filter onHand: 15
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 2);
    assert.equal(req.status, 'RESERVED');

    // Warehouse issues part
    await client.asRole('WAREHOUSE');
    const issueRes = await client.issuePart(req.requestId);
    assertStatusCode(issueRes, 200, 'TC-4.4');
    assert.equal(issueRes.body.partRequest.status, 'ISSUED');
    assert.equal(issueRes.body.partRequest.qtyIssued, 1);

    const part = server.parts.find(p => p.id === 2);
    assert.equal(part.onHand, 14, 'onHand decremented: 15 - 1 = 14');
    assert.equal(part.reserved, 0, 'reserved decremented: 1 - 1 = 0');
    assertStockInvariant(part, server.stockMovements);
  });

  await t.test('TC-4.5: Mechanic returns unused parts to warehouse -> restocks inventory', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '4ฉช-4500 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    // Issue 2 spark plugs (part 4, onHand=6)
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 4, qty: 2, unitPrice: 980.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 4);

    await client.asRole('WAREHOUSE');
    await client.issuePart(req.requestId); // onHand now 4, qtyIssued=2

    // Return 1 spark plug unused
    const returnRes = await client.returnPart(req.requestId, 1);
    assertStatusCode(returnRes, 200, 'TC-4.5');
    assert.equal(returnRes.body.partRequest.qtyReturned, 1);

    const part = server.parts.find(p => p.id === 4);
    assert.equal(part.onHand, 5, 'onHand restocked: 4 + 1 = 5');
    assertStockInvariant(part, server.stockMovements);
  });
});
