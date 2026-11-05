import test from 'node:test';
import assert from 'node:assert/strict';
import { GarageApiClient } from '../helpers/api_client.mjs';
import { assertStatusCode, assertErrorStatus } from '../helpers/assertions.mjs';
import { sampleCheckinPayload } from '../helpers/test_fixtures.mjs';

test('Tier 2: Role-Based Access Control (RBAC) & Auth Boundaries', async (t) => {
  const client = new GarageApiClient();

  await t.test('TC-B5.1: Non-manager attempting to override queue priority rejected (403)', async () => {
    client.resetState();
    await client.asRole('FRONT_DESK');
    const reg = await client.checkin(sampleCheckinPayload({ licensePlate: '1กข-5678 กทม' }));

    // Front desk staff attempts to call priority override
    const overrideRes = await client.overridePriority(reg.body.repairId, 'ต้องการลัดคิว');
    assertErrorStatus(overrideRes, 403, 'ACCESS_DENIED', 'TC-B5.1');
  });

  await t.test('TC-B5.2: Non-manager attempting to create staff user account rejected (403)', async () => {
    client.resetState();
    // Mechanic attempts user creation
    await client.asRole('MECHANIC');
    const res = await client.upsertUser({
      username: 'hacker_user',
      role: 'MANAGER'
    });
    assertErrorStatus(res, 403, 'ACCESS_DENIED', 'TC-B5.2');
  });

  await t.test('TC-B5.3: Non-manager attempting to deactivate staff account rejected (403)', async () => {
    client.resetState();
    // Sales clerk attempts account deactivation
    await client.asRole('SALES');
    const res = await client.deactivateUser(2);
    assertErrorStatus(res, 403, 'ACCESS_DENIED', 'TC-B5.3');
  });

  await t.test('TC-B5.4: Unregistered username login rejected (401)', async () => {
    client.resetState();
    const res = await client.login('nonexistent_user', 'password123');
    assertStatusCode(res, 401, 'TC-B5.4 unknown user');
  });

  await t.test('TC-B5.5: Empty login credentials rejected (400)', async () => {
    client.resetState();
    const res = await client.login('', '');
    assertStatusCode(res, 400, 'TC-B5.5 empty credentials');
  });
});
