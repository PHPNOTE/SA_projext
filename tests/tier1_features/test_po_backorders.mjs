import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertStockInvariant } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 1: Purchase Orders & Backorder Auto-Allocation (W4, W5)', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-5.1: Warehouse generates supplier Purchase Order -> ORDERED', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    const poPayload = {
      supplierName: 'บริษัท ไทย ออโต้พาร์ทส์ จำกัด',
      expectedDate: '2026-11-20',
      lines: [
        { partId: 7, qtyOrdered: 5, unitCost: 3500.00 }, // Alternators
        { partId: 6, qtyOrdered: 10, unitCost: 1200.00 } // Timing Belts
      ]
    };

    const res = await client.createPO(poPayload);
    assertStatusCode(res, 200, 'TC-5.1');
    assert.equal(res.body.purchaseOrder.status, 'ORDERED');
    assert.ok(res.body.purchaseOrder.poNo.startsWith('PO-'));
    assert.equal(res.body.lines.length, 2);
  });

  await t.test('TC-5.2: Partial receipt of supplier PO lines -> PARTIALLY_RECEIVED', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    const poRes = await client.createPO({
      supplierName: 'บริษัท สยาม อะไหล่ยนต์ จำกัด',
      lines: [{ partId: 7, qtyOrdered: 5, unitCost: 3500.00 }]
    });
    const po = poRes.body.purchaseOrder;
    const poLine = poRes.body.lines[0];

    // Receive 2 out of 5
    const recRes = await client.receivePO(po.poId, [
      { poLineId: poLine.poLineId, qtyReceived: 2 }
    ]);

    assertStatusCode(recRes, 200, 'TC-5.2');
    assert.equal(recRes.body.purchaseOrder.status, 'PARTIALLY_RECEIVED');

    const server = client.getServer();
    const part = server.parts.find(p => p.id === 7);
    assert.equal(part.onHand, 2, 'Part 7 onHand increased by 2');
    assertStockInvariant(part, server.stockMovements);
  });

  await t.test('TC-5.3: Full receipt of supplier PO lines -> RECEIVED', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    const poRes = await client.createPO({
      supplierName: 'บริษัท สยาม อะไหล่ยนต์ จำกัด',
      lines: [{ partId: 6, qtyOrdered: 4, unitCost: 1200.00 }] // Belts
    });
    const po = poRes.body.purchaseOrder;
    const poLine = poRes.body.lines[0];

    // Receive all 4
    const recRes = await client.receivePO(po.poId, [
      { poLineId: poLine.poLineId, qtyReceived: 4 }
    ]);

    assertStatusCode(recRes, 200, 'TC-5.3');
    assert.equal(recRes.body.purchaseOrder.status, 'RECEIVED');

    const server = client.getServer();
    const part = server.parts.find(p => p.id === 6);
    assert.equal(part.onHand, 8, 'Initial 4 + Received 4 = 8');
    assertStockInvariant(part, server.stockMovements);
  });

  await t.test('TC-5.4: Automatic FIFO allocation of received stock to backorders', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Job 1 creates backorder for Part 7 (Alternator onHand=0)
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-5400 กทม' }));
    await client.callNext(1, 3);
    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 7);
    assert.equal(req.status, 'BACKORDERED');

    // Warehouse orders and receives 2 units of Part 7
    await client.asRole('WAREHOUSE');
    const poRes = await client.createPO({
      supplierName: 'Supplier Fast',
      lines: [{ partId: 7, qtyOrdered: 2, unitCost: 3500.00 }]
    });
    await client.receivePO(poRes.body.purchaseOrder.poId, [
      { poLineId: poRes.body.lines[0].poLineId, qtyReceived: 2 }
    ]);

    // Backorder must now be auto-promoted to RESERVED!
    assert.equal(req.status, 'RESERVED');
    const part = server.parts.find(p => p.id === 7);
    assert.equal(part.onHand, 2);
    assert.equal(part.reserved, 1);
    assertStockInvariant(part, server.stockMovements);
  });

  await t.test('TC-5.5: Auto-resume repair order from ON_HOLD to QUEUED when all parts ready', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    const originalTime = new Date('2026-11-05T08:00:00Z').toISOString();
    const reg = await client.checkin(sampleCheckinPayload({
      licensePlate: '2ขค-5500 กทม',
      queuedAt: originalTime
    }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }]
    });
    await client.asRole('FRONT_DESK');
    const appRes = await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');
    assert.equal(appRes.body.repairOrder.status, 'ON_HOLD');

    // Receive PO
    await client.asRole('WAREHOUSE');
    const poRes = await client.createPO({
      supplierName: 'Supplier ABC',
      lines: [{ partId: 7, qtyOrdered: 1, unitCost: 3500.00 }]
    });
    await client.receivePO(poRes.body.purchaseOrder.poId, [
      { poLineId: poRes.body.lines[0].poLineId, qtyReceived: 1 }
    ]);

    // Repair order must automatically transition ON_HOLD -> QUEUED
    const server = client.getServer();
    const repair = server.repairOrders.find(r => r.repairId === reg.body.repairId);
    assert.equal(repair.status, 'QUEUED', 'Resumed to QUEUED');
    assert.equal(repair.queuedAt, originalTime, 'Original queuedAt timestamp must be preserved');
  });
});
