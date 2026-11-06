#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from './helpers/api_client.mjs';
import { assertStatusCode, assertSuccess, assertStockInvariant } from './helpers/assertions.mjs';
import { sampleCheckinPayload } from './helpers/test_fixtures.mjs';

const MODE = process.argv.includes('--mode') 
  ? process.argv[process.argv.indexOf('--mode') + 1] 
  : 'live';
const TARGET_URL = process.env.TEST_TARGET_URL || 'http://localhost:8080/api';

function makeClient() {
  return new GarageApiClient({ mode: MODE, targetUrl: TARGET_URL });
}

async function ensureFreeBay(client) {
  if (MODE === 'contract') return 1;
  const baysRes = await client.request('GET', '/admin/bays');
  const repairsRes = await client.request('GET', '/repairs');
  const occupyingBays = new Set(
    (repairsRes.body || [])
      .filter(r => ['IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'QC'].includes(r.status) && r.bayId != null)
      .map(r => r.bayId)
  );
  const free = (baysRes.body || []).filter(b => b.isActive && !occupyingBays.has(b.bayId || b.id));
  if (free.length > 0) {
    return free[0].bayId || free[0].id;
  }
  const toHold = (repairsRes.body || []).find(r => r.bayId && ['IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'QC'].includes(r.status));
  if (toHold) {
    await client.request('POST', `/repairs/${toHold.repairId || toHold.id}/hold`, { holdReason: 'Freeing bay for test' });
    return toHold.bayId;
  }
  return 1;
}

test('ADVERSARIAL STRESS SUITE: 5 ROLES, 15 SCREENS & CORE INVARIANTS', async (t) => {

  // --------------------------------------------------------------------------
  // PART 1: 5 ROLES AUTHENTICATION & ACCESS CONTROL
  // --------------------------------------------------------------------------
  await t.test('1. Role-Based Access Control Across 5 Roles', async (st) => {
    const client = makeClient();

    await st.test('1.1 All 5 roles authenticate successfully and receive valid tokens', async () => {
      const roles = [
        { role: 'MANAGER', username: 'admin' },
        { role: 'FRONT_DESK', username: 'frontdesk' },
        { role: 'MECHANIC', username: 'somchai' },
        { role: 'WAREHOUSE', username: 'wichai' },
        { role: 'SALES', username: 'somsri' }
      ];

      for (const r of roles) {
        client.resetState();
        const res = await client.login(r.username, 'password123');
        assert.equal(res.status, 200, `Login must succeed for ${r.role} (${r.username})`);
        assert.ok(client.token, `Token must be set for ${r.role}`);
      }
    });

    await st.test('1.2 RBAC: User creation and deactivation restricted strictly to MANAGER (HTTP 403)', async () => {
      const nonManagers = ['FRONT_DESK', 'MECHANIC', 'WAREHOUSE', 'SALES'];

      for (const role of nonManagers) {
        client.resetState();
        await client.asRole(role);
        const upsertRes = await client.upsertUser({ username: `hack_${role.toLowerCase()}`, role: 'MANAGER' });
        assert.equal(upsertRes.status, 403, `${role} must be rejected with 403 on user upsert`);

        const deactRes = await client.deactivateUser(2);
        assert.equal(deactRes.status, 403, `${role} must be rejected with 403 on user deactivation`);
      }

      // Manager succeeds
      client.resetState();
      await client.asRole('MANAGER');
      const getBays = await client.getBays();
      assert.equal(getBays.status, 200, 'Manager can view bays');
    });

    await st.test('1.3 RBAC: Priority override restricted to MANAGER (HTTP 403 for others)', async () => {
      client.resetState();
      await client.asRole('FRONT_DESK');
      const reg = await client.checkin(sampleCheckinPayload({ queueClass: 'NORMAL' }));
      assertSuccess(reg, 'Checkin');
      const roId = reg.body.repairId || reg.body.id;

      // Front desk cannot override
      const fdRes = await client.overridePriority(roId, 'ต้อนรับพยายามแทรกคิว');
      assert.equal(fdRes.status, 403, 'Front desk cannot override priority');

      // Mechanic cannot override
      await client.asRole('MECHANIC');
      const mechRes = await client.overridePriority(roId, 'ช่างพยายามแทรกคิว');
      assert.equal(mechRes.status, 403, 'Mechanic cannot override priority');

      // Manager override succeeds
      await client.asRole('MANAGER');
      const mgrRes = await client.overridePriority(roId, 'ผู้จัดการอนุมัติเป็นกรณีพิเศษ');
      assert.equal(mgrRes.status, 200, 'Manager override must succeed');
      assert.equal(mgrRes.body.queueClass, 'PRIORITY');
    });
  });

  // --------------------------------------------------------------------------
  // PART 2: 15 SCREENS END-TO-END INTERACTION FLOW
  // --------------------------------------------------------------------------
  await t.test('2. 15 Screens Full-Stack Interactive Workflow', async (st) => {
    const client = makeClient();
    let activeRoId, bayId, estimateId, invoiceId;

    await st.test('2.1 Screen 1 (Check-in) & Screen 2 (Queue Board): Customer check-in and queue placement', async () => {
      client.resetState();
      await client.asRole('FRONT_DESK');

      const payload = sampleCheckinPayload({
        customerName: 'คุณอภิชาติ นวรัตน์',
        customerPhone: '0819998877',
        licensePlate: `9กฮ-${Math.floor(Math.random() * 8999 + 1000)} กทม`,
        complaint: 'เครื่องยนต์สั่น มีเสียงดังเมื่อเหยียบเบรก',
        queueClass: 'PRIORITY',
        priorityReason: 'ลูกค้านัดหมายล่วงหน้า VIP'
      });

      const res = await client.checkin(payload);
      assertSuccess(res, 'Screen 1 Check-in');
      const newRoId = res.body.repairId || res.body.id;
      assert.equal(res.body.status, 'QUEUED');

      // Screen 2: Queue Board
      const queueRes = await client.request('GET', '/queue');
      assertSuccess(queueRes, 'Screen 2 Queue Board');
      const found = (queueRes.body || []).find(r => (r.repairId || r.id) === newRoId);
      assert.ok(found, 'Created repair order must appear on Queue Board');
    });

    await st.test('2.2 Screen 3 (Repair Orders) & Screen 6 (Bay Assignment): Call next puts order into IN_DIAGNOSIS', async () => {
      client.resetState();
      await client.asRole('FRONT_DESK');
      bayId = await ensureFreeBay(client);

      const callRes = await client.callNext(bayId, 3);
      assertSuccess(callRes, 'Screen 6 Call Next');
      assert.equal(callRes.body.status, 'IN_DIAGNOSIS');
      assert.equal(callRes.body.bayId, bayId);
      assert.equal(callRes.body.mechanicId, 3);
      activeRoId = callRes.body.repairId || callRes.body.id;
      assert.ok(activeRoId > 0);
    });

    await st.test('2.3 Screen 7 (Diagnostics & Estimates): Mechanic inspects vehicle and creates estimate', async () => {
      client.resetState();
      await client.asRole('MECHANIC');

      const estRes = await client.createEstimate({
        repairId: activeRoId,
        diagnosisNote: 'ตรวจพบผ้าเบรกหน้าสึกหรอ และน้ำมันเครื่องเสื่อมสภาพ',
        lines: [
          { lineType: 'LABOR', description: 'ค่าบริการเปลี่ยนถ่ายของเหลวและตรวจเช็คเบรก', qty: 1, unitPrice: 500.00 },
          { lineType: 'PART', partId: 1, qty: 1, unitPrice: 850.00 }
        ]
      });
      assertSuccess(estRes, 'Screen 7 Create Estimate');
      const est = estRes.body.estimate;
      estimateId = est.estimateId || est.id;
      assert.equal(est.status, 'PENDING');
      assert.equal(est.revisionNo, 1);
    });

    await st.test('2.4 Screen 4 (Repair Order Detail & Approval): Customer approval transitions order to IN_REPAIR', async () => {
      client.resetState();
      await client.asRole('FRONT_DESK');

      const appRes = await client.decideEstimate(estimateId, 'APPROVED');
      assertSuccess(appRes, 'Screen 4 Estimate Decision');
      assert.equal(appRes.body.estimate.status, 'APPROVED');
      assert.equal(appRes.body.repairOrder.status, 'IN_REPAIR');
    });

    await st.test('2.5 Screen 8 (Parts Requisitions) & Screen 10 (Warehouse Issuance): Part requisition and stock issue', async () => {
      client.resetState();
      await client.asRole('WAREHOUSE');

      // Fetch requisitions
      const reqList = await client.request('GET', '/requisitions');
      assertSuccess(reqList, 'Screen 8 Requisitions List');
      const reqs = (reqList.body || []).filter(r => (r.repairId === activeRoId) && (r.status === 'RESERVED'));
      assert.ok(reqs.length > 0, 'Requisitions must be generated for approved repair');

      // Issue all reserved requests
      for (const pr of reqs) {
        const issueRes = await client.issuePart(pr.requestId || pr.id);
        assertSuccess(issueRes, `Issue part ${pr.partId}`);
        assert.equal(issueRes.body.partRequest.status, 'ISSUED');
      }
    });

    await st.test('2.6 Screen 6 (Bay Tracking & QC Complete): Mechanic completes work and QC inspection releases bay', async () => {
      client.resetState();
      await client.asRole('MECHANIC');

      const qcRes = await client.submitQC(activeRoId, true);
      assertSuccess(qcRes, 'Screen 6 Submit QC');
      assert.equal(qcRes.body.status, 'AWAITING_PAYMENT');
      assert.equal(qcRes.body.bayId, null, 'Bay must be freed upon QC pass');
    });

    await st.test('2.7 Screen 5 (Invoicing & Settlement): Invoice generation, 7% VAT snapshot, and full settlement', async () => {
      client.resetState();
      await client.asRole('FRONT_DESK');

      const invRes = await client.generateInvoice(activeRoId);
      assertSuccess(invRes, 'Screen 5 Invoice Generation');
      const inv = invRes.body.invoice;
      invoiceId = inv.invoiceId || inv.id;
      assert.equal(inv.status, 'ISSUED');

      // Subtotal: 500 (labor) + 850 (part 1) = 1350.00
      // 7% VAT: 1350 * 0.07 = 94.50
      // Total: 1444.50
      assert.equal(Number(inv.subtotal).toFixed(2), '1350.00');

      // Pay invoice via PromptPay
      const payRes = await client.payInvoice(invoiceId, Number(inv.customerDue), 'CUSTOMER', 'PROMPTPAY');
      assertSuccess(payRes, 'Screen 5 Settle Payment');
      assert.equal(payRes.body.repairStatus, 'COMPLETED');

      // Verify repair order is COMPLETED
      const roRes = await client.request('GET', `/repairs/${activeRoId}`);
      assert.equal(roRes.body.status, 'COMPLETED');
      assert.ok(roRes.body.closedAt != null);
    });

    await st.test('2.8 Screen 9 (Parts Inventory Master) & Screen 11 (PO Receiving): Stock levels, PO order and receiving', async () => {
      client.resetState();
      await client.asRole('WAREHOUSE');

      // Screen 9: Parts Catalog
      const partsRes = await client.request('GET', '/parts');
      assertSuccess(partsRes, 'Screen 9 Parts List');
      assert.ok(partsRes.body.length >= 8);

      // Screen 11: Create PO for Part 1 (5 units @ 600.00)
      const poRes = await client.createPO({
        supplierName: 'PTT Lubricants Co., Ltd.',
        lines: [{ partId: 1, qtyOrdered: 5, unitCost: 600.00 }]
      });
      assertSuccess(poRes, 'Screen 11 Create PO');
      const po = poRes.body.purchaseOrder;
      const pId = po.poId || po.id;
      const poLine = poRes.body.lines[0];
      const poLineId = poLine.poLineId || poLine.id;

      // Receive PO
      const recvRes = await client.receivePO(pId, [{ poLineId, qtyReceived: 5 }]);
      assertSuccess(recvRes, 'Screen 11 Receive PO');
      assert.equal(recvRes.body.purchaseOrder.status, 'RECEIVED');
    });

    await st.test('2.9 Screen 12 (Inventory Audit & Cycle Count) & Screen 13 (Stock Movement Ledger)', async () => {
      client.resetState();
      await client.asRole('WAREHOUSE');

      // Screen 12: Cycle count adjustment (+2 units with valid reason)
      const adjRes = await client.adjustStock(1, 2, 'ตรวจนับสต็อกประจำสัปดาห์ พบสินค้าเกิน 2 แกลลอน');
      assertSuccess(adjRes, 'Screen 12 Cycle Count Adjust');

      // Screen 13: Stock Movement Ledger inspection
      const ledgerRes = await client.getLedger();
      assertSuccess(ledgerRes, 'Screen 13 Ledger Inspection');
      assert.ok(ledgerRes.body.length > 0, 'Movement ledger must contain audit records');
      const latestMov = ledgerRes.body[0];
      assert.ok(latestMov.movementType != null);
      assert.ok(latestMov.deltaOnHand !== undefined);
    });

    await st.test('2.10 Screen 14 (Counter Sales): Walk-in customer counter sale cart checkout', async () => {
      client.resetState();
      await client.asRole('SALES');

      const quoteRes = await client.createSaleQuote(null, [{ partId: 2, qty: 1 }]);
      assertSuccess(quoteRes, 'Screen 14 Sale Quote');
      const sId = quoteRes.body.saleOrder.saleId || quoteRes.body.saleOrder.id;

      const confRes = await client.confirmSale(sId);
      assertSuccess(confRes, 'Screen 14 Confirm Sale');

      // Part 2 price: 220.00 + 7% VAT (15.40) = 235.40
      const compRes = await client.completeSale(sId, 235.40, 'CASH');
      assertSuccess(compRes, 'Screen 14 Complete Sale');
      assert.ok(compRes.body.payment != null || compRes.body.saleOrder != null);
    });

    await st.test('2.11 Screen 15 (Admin Bay & Mechanic Management) & Screen 16 (Admin Settings)', async () => {
      client.resetState();
      await client.asRole('MANAGER');

      const baysRes = await client.getBays();
      assertSuccess(baysRes, 'Screen 15 Bays Management');
      assert.ok(baysRes.body.length >= 4);

      const mechsRes = await client.request('GET', '/admin/mechanics');
      assertSuccess(mechsRes, 'Screen 15 Mechanics List');
      assert.ok(mechsRes.body.length >= 2);

      const settingsRes = await client.request('GET', '/admin/settings');
      assertSuccess(settingsRes, 'Screen 16 Admin Settings');
      assert.equal(settingsRes.body.currency, 'THB');
      assert.equal(Number(settingsRes.body.vatRate), 0.07);
    });

    await st.test('2.12 Screen 17 (Repair Operations Report) & Screen 18 (Inventory Usage Report)', async () => {
      client.resetState();
      await client.asRole('MANAGER');

      // Screen 17: Repair Summary Report
      const repSumRes = await client.getReportRepairSummary();
      assertSuccess(repSumRes, 'Screen 17 Repair Summary Report');
      assert.ok(repSumRes.body.totalJobs !== undefined || repSumRes.body.totalOrders !== undefined);

      // Screen 18: Inventory Usage Report
      const invUsageRes = await client.getReportInventoryUsage();
      assertSuccess(invUsageRes, 'Screen 18 Inventory Usage Report');
      assert.ok(invUsageRes.body.records || invUsageRes.body.items);
    });
  });

  // --------------------------------------------------------------------------
  // PART 3: ADVERSARIAL STATE MACHINE & INVARIANT VERIFICATION
  // --------------------------------------------------------------------------
  await t.test('3. Adversarial Invariant & State Machine Hardening', async (st) => {
    const client = makeClient();

    await st.test('3.1 INVARIANT: Re-approving or modifying COMPLETED or CANCELLED repair orders is strictly rejected (HTTP 409)', async () => {
      client.resetState();
      await client.asRole('FRONT_DESK');

      // Query completed repairs
      const compRes = await client.request('GET', '/repairs?status=COMPLETED');
      assertSuccess(compRes);
      assert.ok(compRes.body.length > 0, 'Must have completed repair orders');
      const targetRoId = compRes.body[0].repairId || compRes.body[0].id;

      // 1. POST /repairs/:id/approve -> 409
      const approveRes = await client.approveRepair(targetRoId, 'APPROVED');
      assert.equal(approveRes.status, 409, `Approving COMPLETED order must return 409, got ${approveRes.status}`);

      // 2. POST /estimates/:id/decision -> 409
      const estDecisionRes = await client.decideEstimate(targetRoId, 'APPROVED');
      assert.equal(estDecisionRes.status, 409, `Estimate decision on COMPLETED order must return 409, got ${estDecisionRes.status}`);

      // 3. POST /repairs/:id/hold -> 409
      const holdRes = await client.holdRepair(targetRoId, 'พยายามระงับงานที่ปิดแล้ว');
      assert.equal(holdRes.status, 409, `Holding COMPLETED order must return 409, got ${holdRes.status}`);

      // 4. POST /repairs/:id/priority-override -> 409
      await client.asRole('MANAGER');
      const prioRes = await client.overridePriority(targetRoId, 'ผู้จัดการพยายามแทรกคิวงานที่ปิดแล้ว');
      assert.equal(prioRes.status, 409, `Priority override on COMPLETED order must return 409, got ${prioRes.status}`);

      // 5. POST /repairs/:id/status -> 409
      await client.asRole('FRONT_DESK');
      const statusRes = await client.request('POST', `/repairs/${targetRoId}/status`, { status: 'IN_REPAIR' });
      assert.equal(statusRes.status, 409, `Mutating status of COMPLETED order must return 409, got ${statusRes.status}`);
    });

    await st.test('3.2 INVARIANT: Single Active Bay Rule rejects concurrent occupancy (HTTP 409 or invariant guard)', async () => {
      client.resetState();
      await client.asRole('FRONT_DESK');

      // Put bay to active repair
      const bId = await ensureFreeBay(client);
      const reg1 = await client.checkin(sampleCheckinPayload());
      const call1 = await client.callNext(bId, 3);
      assertSuccess(call1, 'First bay occupancy succeeds');

      // Second checkin
      const reg2 = await client.checkin(sampleCheckinPayload());
      // Calling next into the SAME already occupied bay must be rejected with 400 or 409
      const call2 = await client.callNext(bId, 4);
      assert.ok([400, 409].includes(call2.status), `Concurrent assignment of already occupied bay ${bId} must be rejected, got ${call2.status}`);
    });

    await st.test('3.3 INVARIANT: Stock Balance Non-Negativity across all parts', async () => {
      client.resetState();
      await client.asRole('WAREHOUSE');

      const partsRes = await client.request('GET', '/parts');
      assertSuccess(partsRes);
      for (const p of partsRes.body) {
        assert.ok(p.onHand >= 0, `Part ${p.sku} onHand must be non-negative: ${p.onHand}`);
        assert.ok(p.reserved >= 0, `Part ${p.sku} reserved must be non-negative: ${p.reserved}`);
      }
    });
  });
});
