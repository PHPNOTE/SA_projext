import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertStockInvariant } from '../helpers/assertions.mjs';

test('Tier 1: Stock Adjustments & Movement Ledger (W6, W7)', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-6.1: Physical stock audit count adjustment with mandatory reason', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    // Part 1 (Oil) initial onHand = 20
    const adjRes = await client.adjustStock(1, -2, 'นับสต็อกจริงประจำสัปดาห์ พบชำรุด 2 แกลลอน');
    assertStatusCode(adjRes, 200, 'TC-6.1');
    assert.equal(adjRes.body.onHand, 18);

    const server = client.getServer();
    const part = server.parts.find(p => p.id === 1);
    assertStockInvariant(part, server.stockMovements);
  });

  await t.test('TC-6.2: Query stock movement ledger filtered by part SKU and movement type', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    // Make an adjustment
    await client.adjustStock(2, 5, 'ตรวจนับสินค้าเกิน');

    const ledgerRes = await client.getLedger({ partId: 2, movementType: 'ADJUST' });
    assertSuccess(ledgerRes, 'TC-6.2');
    assert.ok(Array.isArray(ledgerRes.body));
    assert.ok(ledgerRes.body.length >= 1);
    const item = ledgerRes.body.find(m => m.movementType === 'ADJUST');
    assert.ok(item);
    assert.equal(item.deltaOnHand, 5);
    assert.equal(item.reason, 'ตรวจนับสินค้าเกิน');
  });

  await t.test('TC-6.3: Query low-stock replenishment alert list (on_hand <= reorder_level)', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    // Part 7 (Alternator) onHand = 0, reorderLevel = 1 -> Low stock
    const lowRes = await client.getLowStock();
    assertSuccess(lowRes, 'TC-6.3');
    assert.ok(Array.isArray(lowRes.body));
    const alt = lowRes.body.find(p => p.id === 7);
    assert.ok(alt, 'Part 7 with onHand 0 must appear in low-stock list');
  });

  await t.test('TC-6.4: Validate nightly stock ledger balance invariant', async () => {
    client.resetState();
    const server = client.getServer();

    for (const part of server.parts) {
      assertStockInvariant(part, server.stockMovements);
    }
  });

  await t.test('TC-6.5: Stock count adjustment rejected if reason is blank (400 validation error)', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    // Attempt adjustment with blank reason
    const failRes = await client.adjustStock(1, -1, '   ');
    assertStatusCode(failRes, 400, 'TC-6.5');
    assert.equal(failRes.body.code, 'VALIDATION_ERROR');
  });
});
