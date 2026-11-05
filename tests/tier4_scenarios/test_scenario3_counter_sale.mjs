import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertStockInvariant } from '../helpers/assertions.mjs';

test('Tier 4 Scenario 3: Walk-in Counter Sale with Stock Deduction & Direct Checkout', async () => {
  const client = new GarageApiClient();
  client.resetState();
  const server = client.getServer();

  // Part 5 (Coolant) onHand=12, sellPrice=420.00
  // Part 8 (Air Filter) onHand=10, sellPrice=380.00

  // === STEP 1: Walk-in Customer Quotation ===
  await client.asRole('SALES');
  const quoteRes = await client.createSaleQuote(null, [
    { partId: 5, qty: 2, unitPrice: 420.00 },
    { partId: 8, qty: 1, unitPrice: 380.00 }
  ]);
  assertStatusCode(quoteRes, 200, 'Step 1: Create Quote');
  const saleId = quoteRes.body.saleOrder.saleId;
  assert.equal(quoteRes.body.saleOrder.status, 'QUOTED');
  assert.equal(quoteRes.body.lines.length, 2);

  // === STEP 2: Confirm Order & Reserve Physical Stock ===
  const confirmRes = await client.confirmSale(saleId);
  assertStatusCode(confirmRes, 200, 'Step 2: Confirm Sale');
  assert.equal(confirmRes.body.status, 'CONFIRMED');

  const coolant = server.parts.find(p => p.id === 5);
  const airFilter = server.parts.find(p => p.id === 8);
  assert.equal(coolant.reserved, 2);
  assert.equal(airFilter.reserved, 1);
  assertStockInvariant(coolant, server.stockMovements);
  assertStockInvariant(airFilter, server.stockMovements);

  // === STEP 3: Complete Sale with Cash Payment ===
  const totalDue = (2 * 420.00) + (1 * 380.00); // 840 + 380 = 1220.00
  const completeRes = await client.completeSale(saleId, totalDue, 'CASH');
  assertStatusCode(completeRes, 200, 'Step 3: Complete Sale');

  assert.equal(completeRes.body.saleOrder.status, 'COMPLETED');
  assert.equal(completeRes.body.invoice.status, 'ISSUED');
  assert.equal(completeRes.body.invoice.subtotal, totalDue);
  assert.equal(completeRes.body.payment.amount, totalDue);

  // Verify stock decremented
  assert.equal(coolant.onHand, 10, 'Coolant onHand: 12 - 2 = 10');
  assert.equal(coolant.reserved, 0, 'Coolant reserved cleared');
  assert.equal(airFilter.onHand, 9, 'Air Filter onHand: 10 - 1 = 9');
  assert.equal(airFilter.reserved, 0, 'Air Filter reserved cleared');

  assertStockInvariant(coolant, server.stockMovements);
  assertStockInvariant(airFilter, server.stockMovements);

  // === STEP 4: Ledger & Report Inspection ===
  await client.asRole('WAREHOUSE');
  const ledgerRes = await client.getLedger({ movementType: 'ISSUE' });
  assertSuccess(ledgerRes, 'Step 4a: Movement Ledger');
  const coolantMovement = ledgerRes.body.find(m => m.partId === 5 && m.deltaOnHand === -2);
  assert.ok(coolantMovement, 'Ledger must record ISSUE of 2 coolants');

  await client.asRole('MANAGER');
  const revRes = await client.getReportRevenue();
  assertSuccess(revRes, 'Step 4b: Revenue Report');
  assert.ok(revRes.body.grossRevenue >= totalDue);
});
