import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 3: Backorder Competition: Priority Class vs FIFO Aging', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-C2.1: PO stock receipt allocates to Priority job before Normal job', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Job A: Normal queue, queued at 08:00, needs 1 Alternator (Part 7, onHand=0)
    const jobA = await client.checkin(sampleCheckinPayload({
      licensePlate: '1กข-1000 กทม',
      queueClass: 'NORMAL',
      queuedAt: new Date('2026-11-05T08:00:00Z').toISOString()
    }));
    await client.callNext(1, 3);
    await client.asRole('MECHANIC');
    const estA = await client.createEstimate({
      repairId: jobA.body.repairId,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(estA.body.estimate.estimateId, 'APPROVED');

    // Job B: Priority queue, queued at 09:00 (later than A), needs 1 Alternator
    const jobB = await client.checkin(sampleCheckinPayload({
      licensePlate: '2ขค-2000 กทม',
      queueClass: 'PRIORITY',
      priorityReason: 'รถพยาบาลฉุกเฉิน',
      queuedAt: new Date('2026-11-05T09:00:00Z').toISOString()
    }));
    await client.callNext(1, 4); // Bay 1 is free because Job A is ON_HOLD
    await client.asRole('MECHANIC');
    const estB = await client.createEstimate({
      repairId: jobB.body.repairId,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(estB.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const reqA = server.partRequests.find(pr => {
      const line = server.estimateLines.find(l => l.lineId === pr.estimateLineId);
      return line && line.estimateId === estA.body.estimate.estimateId;
    });
    const reqB = server.partRequests.find(pr => {
      const line = server.estimateLines.find(l => l.lineId === pr.estimateLineId);
      return line && line.estimateId === estB.body.estimate.estimateId;
    });
    assert.equal(reqA.status, 'BACKORDERED');
    assert.equal(reqB.status, 'BACKORDERED');

    // Warehouse receives 1 unit of Alternator
    await client.asRole('WAREHOUSE');
    const poRes = await client.createPO({
      supplierName: 'Denso Thailand',
      lines: [{ partId: 7, qtyOrdered: 1, unitCost: 3500.00 }]
    });
    await client.receivePO(poRes.body.purchaseOrder.poId, [
      { poLineId: poRes.body.lines[0].poLineId, qtyReceived: 1 }
    ]);

    // Priority Job B must be allocated the 1 received unit! Job A remains BACKORDERED
    assert.equal(reqB.status, 'RESERVED', 'Priority job must receive stock first');
    assert.equal(reqA.status, 'BACKORDERED', 'Normal job remains backordered');
  });

  await t.test('TC-C2.2: PO stock receipt allocates between two Normal jobs in FIFO order', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Job 1: Queued at 08:00
    const job1 = await client.checkin(sampleCheckinPayload({
      licensePlate: '3งจ-3000 กทม',
      queuedAt: new Date('2026-11-05T08:00:00Z').toISOString()
    }));
    await client.callNext(1, 3);
    await client.asRole('MECHANIC');
    const est1 = await client.createEstimate({
      repairId: job1.body.repairId,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est1.body.estimate.estimateId, 'APPROVED');

    // Job 2: Queued at 08:30 (later)
    const job2 = await client.checkin(sampleCheckinPayload({
      licensePlate: '4ฉช-4000 กทม',
      queuedAt: new Date('2026-11-05T08:30:00Z').toISOString()
    }));
    await client.callNext(1, 4);
    await client.asRole('MECHANIC');
    const est2 = await client.createEstimate({
      repairId: job2.body.repairId,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est2.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req1 = server.partRequests.find(pr => {
      const line = server.estimateLines.find(l => l.lineId === pr.estimateLineId);
      return line && line.estimateId === est1.body.estimate.estimateId;
    });
    const req2 = server.partRequests.find(pr => {
      const line = server.estimateLines.find(l => l.lineId === pr.estimateLineId);
      return line && line.estimateId === est2.body.estimate.estimateId;
    });

    // Supplier delivers 1 unit
    await client.asRole('WAREHOUSE');
    const poRes = await client.createPO({
      supplierName: 'Denso Thailand',
      lines: [{ partId: 7, qtyOrdered: 1, unitCost: 3500.00 }]
    });
    await client.receivePO(poRes.body.purchaseOrder.poId, [
      { poLineId: poRes.body.lines[0].poLineId, qtyReceived: 1 }
    ]);

    // FIFO: Job 1 (earlier queuedAt) gets reserved, Job 2 remains backordered
    assert.equal(req1.status, 'RESERVED', 'Earlier queued job must get stock (FIFO)');
    assert.equal(req2.status, 'BACKORDERED', 'Later queued job remains backordered');
  });

  await t.test('TC-C2.3: Partial PO receipt fulfills first backorder in full; leaves second backordered', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Both jobs need 1 alternator each
    const j1 = await client.checkin(sampleCheckinPayload({ licensePlate: '5ชซ-5000 กทม', queuedAt: '2026-11-05T08:00:00Z' }));
    await client.callNext(1, 3);
    await client.asRole('MECHANIC');
    const e1 = await client.createEstimate({ repairId: j1.body.repairId, lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }] });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(e1.body.estimate.estimateId, 'APPROVED');

    const j2 = await client.checkin(sampleCheckinPayload({ licensePlate: '6ฌญ-6000 กทม', queuedAt: '2026-11-05T08:15:00Z' }));
    await client.callNext(1, 4);
    await client.asRole('MECHANIC');
    const e2 = await client.createEstimate({ repairId: j2.body.repairId, lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }] });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(e2.body.estimate.estimateId, 'APPROVED');

    // PO ordered for 5 units, supplier delivers partial shipment of 1 unit
    await client.asRole('WAREHOUSE');
    const poRes = await client.createPO({
      supplierName: 'Denso Thailand',
      lines: [{ partId: 7, qtyOrdered: 5, unitCost: 3500.00 }]
    });
    const poId = poRes.body.purchaseOrder.poId;
    const poLineId = poRes.body.lines[0].poLineId;

    await client.receivePO(poId, [{ poLineId, qtyReceived: 1 }]);

    const server = client.getServer();
    const r1 = server.partRequests.find(pr => {
      const line = server.estimateLines.find(l => l.lineId === pr.estimateLineId);
      return line && line.estimateId === e1.body.estimate.estimateId;
    });
    const r2 = server.partRequests.find(pr => {
      const line = server.estimateLines.find(l => l.lineId === pr.estimateLineId);
      return line && line.estimateId === e2.body.estimate.estimateId;
    });

    assert.equal(r1.status, 'RESERVED');
    assert.equal(r2.status, 'BACKORDERED');
  });
});
