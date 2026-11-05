import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertNetIssuedBilling, assertStockInvariant } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 3: Part Return & Net-Issued Invoicing Reconciliation', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-C4.1: Part issued (4 units), returned (1 unit) -> billed for 3 units', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-4100 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    // Request 4 units of Part 4 (Spark Plug, onHand=6, price=980)
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 4, qty: 4, unitPrice: 980.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 4);

    // Warehouse issues all 4
    await client.asRole('WAREHOUSE');
    await client.issuePart(req.requestId);

    // Mechanic discovers only 3 needed; returns 1 to warehouse
    await client.returnPart(req.requestId, 1);

    // Mechanic passes QC
    await client.asRole('MECHANIC');
    await client.submitQC(reg.body.repairId, true);

    // Front desk generates invoice
    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(reg.body.repairId);
    assertSuccess(invRes);

    const inv = invRes.body.invoice;
    const billedLine = invRes.body.lines.find(l => l.partId === 4);

    assert.ok(billedLine, 'Line item for spark plugs must exist');
    assert.equal(billedLine.qty, 3, 'Billed quantity must be net issued: 4 - 1 = 3');
    assert.equal(billedLine.lineTotal, 3 * 980.00, 'Line total: 3 * 980 = 2940');
    assert.equal(inv.subtotal, 2940.00, 'Invoice subtotal: 2940');

    assertNetIssuedBilling(server.partRequests, invRes.body.lines);
  });

  await t.test('TC-C4.2: Part fully returned (all units) -> excluded from billable invoice total', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-4200 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [
        { lineType: 'LABOR', description: 'ค่าแรงตรวจเช็ค', qty: 1, unitPrice: 500.00 },
        { lineType: 'PART', partId: 2, qty: 1, unitPrice: 220.00 } // Filter
      ]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 2);

    await client.asRole('WAREHOUSE');
    await client.issuePart(req.requestId);

    // Mechanic returns the filter fully (1 unit)
    await client.returnPart(req.requestId, 1);

    await client.asRole('MECHANIC');
    await client.submitQC(reg.body.repairId, true);

    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(reg.body.repairId);
    assertSuccess(invRes);

    // Part with 0 net quantity should not add to billable total
    assert.equal(invRes.body.invoice.subtotal, 500.00, 'Subtotal contains only labor (500)');
    assertNetIssuedBilling(server.partRequests, invRes.body.lines);
  });

  await t.test('TC-C4.3: Returned part immediately available for subsequent reservations', async () => {
    client.resetState();
    const server = client.getServer();

    // Part 6 (Timing Belt) has onHand = 4
    const belt = server.parts.find(p => p.id === 6);
    belt.onHand = 1; // Artificially set onHand to 1

    await client.asRole('FRONT_DESK');
    // Job 1 reserves and issues the 1 remaining belt
    const j1 = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-4300 กทม' }));
    await client.callNext(1, 3);
    await client.asRole('MECHANIC');
    const e1 = await client.createEstimate({ repairId: j1.body.repairId, lines: [{ lineType: 'PART', partId: 6, qty: 1, unitPrice: 1850.00 }] });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(e1.body.estimate.estimateId, 'APPROVED');

    const r1 = server.partRequests.find(pr => pr.partId === 6);
    await client.asRole('WAREHOUSE');
    await client.issuePart(r1.requestId); // onHand now 0

    // Job 2 attempts to reserve belt -> backordered
    await client.asRole('FRONT_DESK');
    const j2 = await client.checkin(sampleCheckinPayload({ licensePlate: '4ฉช-4400 กทม' }));
    await client.callNext(2, 4);
    await client.asRole('MECHANIC');
    const e2 = await client.createEstimate({ repairId: j2.body.repairId, lines: [{ lineType: 'PART', partId: 6, qty: 1, unitPrice: 1850.00 }] });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(e2.body.estimate.estimateId, 'APPROVED');

    const r2 = server.partRequests.find(pr => {
      const line = server.estimateLines.find(l => l.lineId === pr.estimateLineId);
      return line && line.estimateId === e2.body.estimate.estimateId;
    });
    assert.equal(r2.status, 'BACKORDERED');

    // Job 1 returns the belt unused
    await client.asRole('WAREHOUSE');
    await client.returnPart(r1.requestId, 1);
    assert.equal(belt.onHand, 1, 'Belt restocked to onHand=1');

    assertStockInvariant(belt, server.stockMovements);
  });
});
