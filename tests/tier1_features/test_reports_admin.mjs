import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertSuccess } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 1: Reports & Admin Management (A1, A2, Reports 1 & 2)', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-10.1: Report 1: Repair operations summary by date range & mechanic', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-9100 กทม' }));
    await client.checkin(sampleCheckinPayload({ licensePlate: '2ขค-9200 กทม' }));

    await client.asRole('MANAGER');
    const repRes = await client.getReportRepairSummary({ startDate: '2026-11-01', endDate: '2026-11-30' });
    assertStatusCode(repRes, 200, 'TC-10.1');
    assert.equal(repRes.body.totalOrders, 2);
    assert.ok(Array.isArray(repRes.body.items));
  });

  await t.test('TC-10.2: Report 2: Parts inventory usage and reorder status', async () => {
    client.resetState();
    await client.asRole('MANAGER');

    const repRes = await client.getReportInventoryUsage();
    assertStatusCode(repRes, 200, 'TC-10.2');
    assert.ok(repRes.body.totalParts >= 8);
    assert.ok(Array.isArray(repRes.body.items));

    // Check low stock indicator for Part 7 (Alternator)
    const alt = repRes.body.items.find(p => p.sku === 'ALT-12V-REVO');
    assert.ok(alt);
    assert.equal(alt.isLowStock, true, 'Alternator onHand 0 <= reorderLevel 1');
  });

  await t.test('TC-10.3: Report 3: Garage revenue & billing financial summary', async () => {
    client.resetState();
    await client.asRole('MANAGER');

    const revRes = await client.getReportRevenue({ startDate: '2026-11-01', endDate: '2026-11-30' });
    assertStatusCode(revRes, 200, 'TC-10.3');
    assert.ok(revRes.body.totalInvoicesIssued !== undefined);
    assert.ok(revRes.body.grossRevenue !== undefined);
  });

  await t.test('TC-10.4: Create staff user account with BCrypt hash and RBAC role', async () => {
    client.resetState();
    await client.asRole('MANAGER');

    const newUserPayload = {
      username: 'sompop_tech',
      displayName: 'สมภพ ช่างไฟฟ้า',
      role: 'MECHANIC'
    };

    const res = await client.upsertUser(newUserPayload);
    assertStatusCode(res, 201, 'TC-10.4');
    assert.equal(res.body.username, 'sompop_tech');
    assert.equal(res.body.role, 'MECHANIC');
    assert.equal(res.body.isActive, true);
  });

  await t.test('TC-10.5: Deactivate user account via soft delete (is_active = false)', async () => {
    client.resetState();
    await client.asRole('MANAGER');

    // Deactivate user 4 (Prasert)
    const deactRes = await client.deactivateUser(4);
    assertStatusCode(deactRes, 200, 'TC-10.5');
    assert.equal(deactRes.body.user.isActive, false, 'Account marked inactive');

    // Verify cannot login when inactive
    const loginRes = await client.login('prasert', 'password123');
    assert.equal(loginRes.status, 401, 'Inactive user cannot login');
  });

  await t.test('TC-10.6: Manager overrides queue priority class with mandatory reason', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({
      licensePlate: '3งจ-9600 กทม',
      queueClass: 'NORMAL'
    }));

    // Manager overrides priority
    await client.asRole('MANAGER');
    const overrideRes = await client.overridePriority(reg.body.repairId, 'ผู้บริหารระดับสูงมาใช้บริการ');
    assertStatusCode(overrideRes, 200, 'TC-10.6');
    assert.equal(overrideRes.body.queueClass, 'PRIORITY');
    assert.equal(overrideRes.body.priorityReason, 'ผู้บริหารระดับสูงมาใช้บริการ');
  });
});
