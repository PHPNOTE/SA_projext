import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertNetIssuedBilling, assertSingleActiveInvoice } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 1: Billing, Invoicing & Settlement (R6)', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-8.1: Generate immutable invoice with net-issued parts formula', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-8100 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [
        { lineType: 'LABOR', description: 'ค่าแรงเปลี่ยนน้ำมันเครื่อง', qty: 1, unitPrice: 350.00 },
        { lineType: 'PART', partId: 1, qty: 1, unitPrice: 850.00 }
      ]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 1);
    await client.asRole('WAREHOUSE');
    await client.issuePart(req.requestId);

    await client.asRole('MECHANIC');
    await client.submitQC(reg.body.repairId, true);

    // Front desk generates invoice
    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(reg.body.repairId);
    assertStatusCode(invRes, 200, 'TC-8.1');
    assert.equal(invRes.body.invoice.status, 'ISSUED');
    assert.equal(invRes.body.invoice.subtotal, 1200.00, '350 labor + 850 part = 1200');
    assert.equal(invRes.body.invoice.customerDue, 1200.00);

    assertNetIssuedBilling(server.partRequests, invRes.body.lines);
    assertSingleActiveInvoice(server.invoices, reg.body.repairId);
  });

  await t.test('TC-8.2: Customer payment settlement: full payment -> COMPLETED', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-8200 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'ตั้งศูนย์ถ่วงล้อ', qty: 1, unitPrice: 500.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    await client.asRole('MECHANIC');
    await client.submitQC(reg.body.repairId, true);

    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(reg.body.repairId);
    const invoiceId = invRes.body.invoice.invoiceId;

    // Full payment
    const payRes = await client.payInvoice(invoiceId, 500.00, 'CUSTOMER', 'TRANSFER');
    assertStatusCode(payRes, 200, 'TC-8.2');
    assert.equal(payRes.body.repairStatus, 'COMPLETED');

    const server = client.getServer();
    const repair = server.repairOrders.find(r => r.repairId === reg.body.repairId);
    assert.equal(repair.status, 'COMPLETED');
    assert.ok(repair.closedAt !== null, 'closedAt must be populated');
  });

  await t.test('TC-8.3: Split insurance and customer billing', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');

    // Insurance covers 3,000 baht
    const reg = await client.checkin(sampleCheckinPayload({
      licensePlate: '3งจ-8300 กทม',
      insurerName: 'กรุงเทพประกันภัย',
      claimNo: 'CLM-7700',
      insuranceDocsReceived: true,
      insuranceCoveredAmount: 3000.00
    }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [
        { lineType: 'LABOR', description: 'ทำสีตัวถัง', qty: 1, unitPrice: 4000.00 },
        { lineType: 'PART', partId: 5, qty: 1, unitPrice: 420.00 }
      ]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');

    const server = client.getServer();
    const req = server.partRequests.find(pr => pr.partId === 5);
    await client.asRole('WAREHOUSE');
    await client.issuePart(req.requestId);

    await client.asRole('MECHANIC');
    await client.submitQC(reg.body.repairId, true);

    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(reg.body.repairId);
    assertSuccess(invRes);

    const inv = invRes.body.invoice;
    assert.equal(inv.subtotal, 4420.00, 'Subtotal: 4000 + 420 = 4420');
    assert.equal(inv.insuranceCovered, 3000.00, 'Covered: 3000');
    assert.equal(inv.customerDue, 1420.00, 'Customer due: 4420 - 3000 = 1420');
  });

  await t.test('TC-8.4: Partial payment leaves order in AWAITING_PAYMENT', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '4ฉช-8400 กทม' }));
    await client.callNext(1, 3);

    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'ล้างลิ้นปีกผีเสื้อ', qty: 1, unitPrice: 800.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');
    await client.asRole('MECHANIC');
    await client.submitQC(reg.body.repairId, true);

    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(reg.body.repairId);
    const invoiceId = invRes.body.invoice.invoiceId;

    // Customer makes partial payment of 300 (due 800)
    const payRes = await client.payInvoice(invoiceId, 300.00, 'CUSTOMER', 'CASH');
    assertSuccess(payRes);
    assert.equal(payRes.body.repairStatus, 'AWAITING_PAYMENT', 'Order must not complete on partial payment');
  });

  await t.test('TC-8.5: Insurer direct settlement recorded against invoice', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({
      licensePlate: '5ชซ-8500 กทม',
      insurerName: 'วิริยะประกันภัย',
      insuranceDocsReceived: true,
      insuranceCoveredAmount: 1000.00
    }));
    await client.callNext(1, 3);
    await client.asRole('MECHANIC');
    const est = await client.createEstimate({
      repairId: reg.body.repairId,
      lines: [{ lineType: 'LABOR', description: 'ซ่อมแซมสี', qty: 1, unitPrice: 1000.00 }]
    });
    await client.asRole('FRONT_DESK');
    await client.decideEstimate(est.body.estimate.estimateId, 'APPROVED');
    await client.asRole('MECHANIC');
    await client.submitQC(reg.body.repairId, true);

    await client.asRole('FRONT_DESK');
    const invRes = await client.generateInvoice(reg.body.repairId);
    const invoiceId = invRes.body.invoice.invoiceId;

    // Insurer pays 1000 direct
    const payRes = await client.payInvoice(invoiceId, 1000.00, 'INSURER', 'INSURANCE_DIRECT');
    assertSuccess(payRes);

    const server = client.getServer();
    const payment = server.payments.find(p => p.invoiceId === invoiceId && p.payerType === 'INSURER');
    assert.ok(payment);
    assert.equal(payment.amount, 1000.00);
  });
});
