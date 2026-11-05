import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 2: Negative & Zero Value Boundaries', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-B2.1: Part creation with negative sell price rejected (400)', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    const res = await client.upsertPart({
      sku: 'TEST-NEG-PRICE',
      name: 'อะไหล่ราคาติดลบ',
      sellPrice: -150.00
    });
    assertStatusCode(res, 400, 'TC-B2.1 negative sell price');
    assert.equal(res.body.code, 'INVALID_PRICE');
  });

  await t.test('TC-B2.2: Estimate line with 0 or negative quantity rejected (400)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-3333 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    // 0 quantity
    const res0 = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 1, qty: 0, unitPrice: 850.00 }]
    });
    assertStatusCode(res0, 400, 'TC-B2.2 zero qty');

    // Negative quantity
    const resNeg = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'PART', partId: 1, qty: -2, unitPrice: 850.00 }]
    });
    assertStatusCode(resNeg, 400, 'TC-B2.2 negative qty');
  });

  await t.test('TC-B2.3: Purchase order with negative unit cost rejected (400)', async () => {
    client.resetState();
    await client.asRole('WAREHOUSE');

    const res = await client.createPO({
      supplierName: 'Supplier Bad',
      lines: [{ partId: 1, qtyOrdered: 10, unitCost: -50.00 }]
    });
    assertStatusCode(res, 400, 'TC-B2.3 negative unit cost');
  });

  await t.test('TC-B2.4: Payment recording with 0 or negative amount rejected (400)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-4444 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'แรงงาน', qty: 1, unitPrice: 500.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');
    await client.asRole('MECHANIC');
    await client.submitQC(reg.body.repairId, true);

    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(reg.body.repairId);
    const invoiceId = invRes.body.invoice.invoiceId;

    // 0 amount
    const payRes0 = await client.payInvoice(invoiceId, 0, 'CUSTOMER');
    assertStatusCode(payRes0, 400, 'TC-B2.4 zero payment');

    // Negative amount
    const payResNeg = await client.payInvoice(invoiceId, -100.00, 'CUSTOMER');
    assertStatusCode(payResNeg, 400, 'TC-B2.4 negative payment');
  });

  await t.test('TC-B2.5: Estimate line with negative unit price rejected (400)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '3งจ-5555 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const res = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'ค่าแรงติดลบ', qty: 1, unitPrice: -200.00 }]
    });
    assertStatusCode(res, 400, 'TC-B2.5 negative labor price');
  });
});
