import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertErrorStatus, assertSuccess } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 2: Stock Exhaustion & Over-Transaction Boundaries', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-B3.1: Requesting part with 0 stock on shelf sets status BACKORDERED', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-6666 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    // Part 7 (Alternator) has 0 onHand
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }]
    });

    await client.asRole('FRONT_DESK');
    const decRes = await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');
    assertSuccess(decRes);

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 7);
    assert.equal(req.status, 'BACKORDERED', 'Must trigger backorder when stock exhausted');
  });

  await t.test('TC-B3.2: Stock adjustment reducing on_hand below reserved rejected (409)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-7777 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    // Reserve 5 units of Part 1 (Oil onHand=20)
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 1, qty: 5, unitPrice: 850.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const part = server.parts.find(p => p.id === 1);
    assert.equal(part.reserved, 5);

    // Warehouse tries to adjust physical onHand from 20 down to 3 (which is < reserved 5) -> delta -17
    await client.asRole('WAREHOUSE');
    const adjRes = await client.adjustStock(1, -17, 'ปรับลดยอดสต็อกต่ำกว่าที่จองไว้');
    assertErrorStatus(adjRes, 409, 'INVALID_STOCK', 'TC-B3.2');
  });

  await t.test('TC-B3.3: Over-receipt on PO line (qty_received > qty_ordered) rejected (409)', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    const poRes = await client.createPO({
      supplierName: 'Supplier Fast',
      lines: [{ partId: 1, qtyOrdered: 10, unitCost: 600.00 }]
    });
    const poId = poRes.body.purchaseOrder.poId;
    const poLineId = poRes.body.lines[0].poLineId;

    // Attempt to receive 15 (ordered 10)
    const recRes = await client.receivePO(poId, [
      { poLineId, qtyReceived: 15 }
    ]);
    assertErrorStatus(recRes, 409, 'OVER_RECEIPT', 'TC-B3.3');
  });

  await t.test('TC-B3.4: Over-return of parts (qty > qty_issued - qty_returned) rejected (409)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-8888 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 2, qty: 2, unitPrice: 220.00 }] // Filter
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 2);

    await client.asRole('WAREHOUSE');
    await client.issuePart(req.requestId); // Issued 2

    // Attempt to return 3 units
    const returnRes = await client.returnPart(req.requestId, 3);
    assertErrorStatus(returnRes, 409, 'INVALID_RETURN_QTY', 'TC-B3.4');
  });

  await t.test('TC-B3.5: Attempting to issue unreserved / backordered part rejected (409)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '4ฉช-9999 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    // Part 7 (Alternator) backordered
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 7, qty: 1, unitPrice: 4500.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 7);
    assert.equal(req.status, 'BACKORDERED');

    // Warehouse clerk attempts to issue a backordered part
    await client.asRole('WAREHOUSE');
    const issueRes = await client.issuePart(req.requestId);
    assertErrorStatus(issueRes, 409, 'PART_NOT_RESERVED', 'TC-B3.5');
  });
});
