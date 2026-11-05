import assert from 'node:assert/strict';

/**
 * System Relational Invariant and Business Rule Assertions
 */

export function assertStatusCode(res, expectedStatus, context = '') {
  assert.equal(
    res.status,
    expectedStatus,
    `[${context}] Expected HTTP ${expectedStatus} but received HTTP ${res.status}. Body: ${JSON.stringify(res.body || {})}`
  );
}

export function assertSuccess(res, context = '') {
  assert.ok(
    res.status >= 200 && res.status < 300,
    `[${context}] Expected 2xx success status, got HTTP ${res.status}. Body: ${JSON.stringify(res.body || {})}`
  );
}

export function assertErrorStatus(res, expectedStatus, expectedErrorCode = null, context = '') {
  assert.equal(
    res.status,
    expectedStatus,
    `[${context}] Expected error HTTP ${expectedStatus}, got HTTP ${res.status}. Body: ${JSON.stringify(res.body || {})}`
  );
  if (expectedErrorCode && res.body && res.body.code) {
    assert.equal(res.body.code, expectedErrorCode, `[${context}] Expected error code ${expectedErrorCode}`);
  }
}

/**
 * Invariant 1: Stock Counters vs Ledger Balance Invariant
 * on_hand == sum(delta_on_hand), reserved == sum(delta_reserved), 0 <= reserved <= on_hand
 */
export function assertStockInvariant(part, stockMovements = []) {
  assert.ok(part.onHand >= 0, `Part [${part.sku}] on_hand must be >= 0 (got ${part.onHand})`);
  assert.ok(part.reserved >= 0, `Part [${part.sku}] reserved must be >= 0 (got ${part.reserved})`);
  assert.ok(
    part.reserved <= part.onHand,
    `Part [${part.sku}] reserved (${part.reserved}) cannot exceed on_hand (${part.onHand})`
  );

  if (stockMovements && stockMovements.length > 0) {
    const partMovements = stockMovements.filter(m => m.partId === part.id);
    const sumOnHand = partMovements.reduce((acc, m) => acc + (m.deltaOnHand || 0), 0);
    const sumReserved = partMovements.reduce((acc, m) => acc + (m.deltaReserved || 0), 0);
    // When movements track from 0, the sum must match onHand and reserved
    if (partMovements.length > 0 && partMovements[0].movementType === 'INITIAL') {
      assert.equal(part.onHand, sumOnHand, `Part [${part.sku}] onHand (${part.onHand}) != sum(deltaOnHand) (${sumOnHand})`);
      assert.equal(part.reserved, sumReserved, `Part [${part.sku}] reserved (${part.reserved}) != sum(deltaReserved) (${sumReserved})`);
    }
  }
}

/**
 * Invariant 2: Single-Active-Bay Invariant
 * At most one repair order in status ('IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'QC') per bay
 */
export function assertSingleBayOccupancy(activeRepairs, bayId) {
  const HOLDING_STATUSES = ['IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'QC'];
  const occupying = activeRepairs.filter(r => r.bayId === bayId && HOLDING_STATUSES.includes(r.status));
  assert.ok(
    occupying.length <= 1,
    `Bay [${bayId}] has ${occupying.length} active occupying repair orders: ${occupying.map(r => r.ticketNo).join(', ')}`
  );
}

/**
 * Invariant 3: Single-Active-Invoice Invariant
 * At most one active invoice with status = 'ISSUED' per repair order or sale order
 */
export function assertSingleActiveInvoice(invoices, repairId = null, saleId = null) {
  const active = invoices.filter(inv => {
    if (inv.status !== 'ISSUED') return false;
    if (repairId && inv.repairId === repairId) return true;
    if (saleId && inv.saleId === saleId) return true;
    return false;
  });
  assert.ok(
    active.length <= 1,
    `Entity [Repair:${repairId}, Sale:${saleId}] has multiple active ISSUED invoices: ${active.map(i => i.invoiceNo).join(', ')}`
  );
}

/**
 * Invariant 4: Net-Issued Parts Billing Formula
 * Billed quantity on invoice lines must equal qty_issued - qty_returned
 */
export function assertNetIssuedBilling(partRequests, invoiceLines) {
  for (const pr of partRequests) {
    if (pr.status === 'CANCELLED') continue;
    const netQty = (pr.qtyIssued || 0) - (pr.qtyReturned || 0);
    const line = invoiceLines.find(l => l.partId === pr.partId);
    if (netQty > 0) {
      assert.ok(line, `Expected invoice line for part [${pr.partId}] with net qty ${netQty}`);
      assert.equal(line.qty, netQty, `Invoice line for part [${pr.partId}] qty (${line.qty}) != net issued (${netQty})`);
    } else {
      // 0 net quantity must not be billed or line must be 0
      if (line) {
        assert.equal(line.qty, 0, `Unissued/fully returned part [${pr.partId}] must have 0 billed qty`);
      }
    }
  }
}
