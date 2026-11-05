import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertStockInvariant } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 3: Stock Movement Ledger Balance & Concurrency Invariants', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-C5.1: Mathematical check: on_hand == SUM(delta_on_hand) across entire catalog', async () => {
    client.resetState();
    const server = client.getServer();

    // Perform a series of stock mutations: receipt, reserve, issue, return, adjust
    await client.asRole('WAREHOUSE');
    await client.adjustStock(1, 10, 'Audit Surplus'); // Part 1
    await client.adjustStock(2, -3, 'Audit Scrapped'); // Part 2

    // PO receipt
    const po = await client.createPO({ supplierName: 'Siam Parts', lines: [{ partId: 3, qtyOrdered: 5, unitCost: 1000.00 }] });
    await client.receivePO(po.body.purchaseOrder.poId, [{ poLineId: po.body.lines[0].poLineId, qtyReceived: 5 }]);

    // For every part, check on_hand equals sum(delta_on_hand)
    for (const part of server.parts) {
      const partMovements = server.stockMovements.filter(m => m.partId === part.id);
      const sumDelta = partMovements.reduce((acc, m) => acc + m.deltaOnHand, 0);
      assert.equal(
        part.onHand,
        sumDelta,
        `Part [${part.sku}] onHand (${part.onHand}) != sum(delta_on_hand) (${sumDelta})`
      );
    }
  });

  await t.test('TC-C5.2: Mathematical check: reserved == SUM(delta_reserved) across entire catalog', async () => {
    client.resetState();
    const server = client.getServer();

    await client.asRole('FRONT_DESK');
    const j1 = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-5100 กทม' }));
    await client.callNext(1, 3);
    await client.asRole('MECHANIC');
    const e1 = await client.createEstimate({
      repairId: j1.body.repairId,
      lines: [
        { lineType: 'PART', partId: 1, qty: 3, unitPrice: 850.00 },
        { lineType: 'PART', partId: 2, qty: 2, unitPrice: 220.00 }
      ]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(e1.body.estimate.estimateId, 'APPROVED');

    // Check reserved counters
    for (const part of server.parts) {
      const partMovements = server.stockMovements.filter(m => m.partId === part.id);
      const sumReserved = partMovements.reduce((acc, m) => acc + m.deltaReserved, 0);
      assert.equal(
        part.reserved,
        sumReserved,
        `Part [${part.sku}] reserved (${part.reserved}) != sum(delta_reserved) (${sumReserved})`
      );
      assertStockInvariant(part, server.stockMovements);
    }
  });

  await t.test('TC-C5.3: Concurrency simulation on call-next: zero duplicate ticket claims', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Register 4 jobs in queue
    const j1 = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-5301 กทม' }));
    const j2 = await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-5302 กทม' }));
    const j3 = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-5303 กทม' }));
    const j4 = await client.checkin(sampleCheckinPayload({ licensePlate: '4ฉช-5304 กทม' }));

    // Simulate 4 calls to callNext for 4 distinct bays
    const calls = await Promise.all([
      client.callNext(1, 3),
      client.callNext(2, 4),
      client.callNext(3, 3),
      client.callNext(4, 4)
    ]);

    const claimedTicketIds = calls.map(c => c.body.repairId);
    const uniqueTicketIds = new Set(claimedTicketIds);

    assert.equal(
      uniqueTicketIds.size,
      4,
      'Every concurrent call-next must claim a strictly unique ticket without duplicate assignment'
    );
  });
});
