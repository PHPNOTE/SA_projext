import test from 'node:test';
import assert from 'node:assert/strict';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:8080/api';

async function request(path, options = {}) {
  const url = `${TARGET_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {})
  };
  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };
  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, fetchOptions);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

test('Challenger 3 Adversarial State Machine Stress Suite', async (t) => {
  // Login as front desk & mechanic
  const loginFrontDesk = await request('/auth/login', {
    method: 'POST',
    body: { username: 'frontdesk', password: 'password123' }
  });
  assert.equal(loginFrontDesk.status, 200, 'Front desk login failed');
  const frontDeskToken = loginFrontDesk.body.token;

  const loginMechanic = await request('/auth/login', {
    method: 'POST',
    body: { username: 'somchai', password: 'password123' }
  });
  assert.equal(loginMechanic.status, 200, 'Mechanic login failed');
  const mechanicToken = loginMechanic.body.token;

  const loginAdmin = await request('/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'password123' }
  });
  assert.equal(loginAdmin.status, 200, 'Admin login failed');
  const adminToken = loginAdmin.body.token;

  // --------------------------------------------------------------------------
  // INVARIANT 1: Terminal COMPLETED orders strictly reject approval & estimate decisions
  // --------------------------------------------------------------------------
  await t.test('1. Verify POST /api/repairs/1/approve on COMPLETED repair is strictly rejected (409 INVALID_STATUS)', async () => {
    const ro1Res = await request('/repairs/1', { token: frontDeskToken });
    assert.equal(ro1Res.status, 200);
    assert.equal(ro1Res.body.status, 'COMPLETED', 'Order 1 must be COMPLETED in database');

    // Attempt approve
    const approveRes = await request('/repairs/1/approve', {
      method: 'POST',
      token: frontDeskToken,
      body: { decision: 'APPROVED', insuranceDocsReceived: false }
    });
    console.log('[1] /repairs/1/approve -> Status:', approveRes.status, approveRes.body);
    assert.equal(approveRes.status, 409, 'Expected HTTP 409');
    assert.equal(approveRes.body.code, 'INVALID_STATUS', 'Expected error code INVALID_STATUS');
    assert.match(approveRes.body.error, /Cannot approve COMPLETED repair order/i);

    // Attempt decline
    const declineRes = await request('/repairs/1/approve', {
      method: 'POST',
      token: frontDeskToken,
      body: { decision: 'DECLINED' }
    });
    assert.equal(declineRes.status, 409, 'Expected HTTP 409 on decline');
    assert.equal(declineRes.body.code, 'INVALID_STATUS');

    // Confirm RO 1 status was not mutated
    const ro1After = await request('/repairs/1', { token: frontDeskToken });
    assert.equal(ro1After.body.status, 'COMPLETED', 'RO 1 status must remain COMPLETED');
    assert.equal(ro1After.body.bayId, null, 'RO 1 bay must remain null');
  });

  await t.test('2. Verify POST /api/estimates/1/decision on COMPLETED repair is strictly rejected (409 INVALID_STATUS)', async () => {
    // Attempt decision on estimate 1 (belongs to RO 1)
    const decideRes = await request('/estimates/1/decision', {
      method: 'POST',
      token: frontDeskToken,
      body: { decision: 'APPROVED', insuranceDocsReceived: false }
    });
    console.log('[2] /estimates/1/decision -> Status:', decideRes.status, decideRes.body);
    assert.equal(decideRes.status, 409, 'Expected HTTP 409');
    assert.equal(decideRes.body.code, 'INVALID_STATUS', 'Expected error code INVALID_STATUS');
    assert.match(decideRes.body.error, /Cannot decide estimate for COMPLETED repair order/i);

    // Confirm RO 1 status remains COMPLETED
    const ro1After = await request('/repairs/1', { token: frontDeskToken });
    assert.equal(ro1After.body.status, 'COMPLETED', 'RO 1 status must remain COMPLETED');
  });

  // --------------------------------------------------------------------------
  // INVARIANT 2: Terminal CANCELLED orders strictly reject approval & estimate decisions
  // --------------------------------------------------------------------------
  await t.test('3. Verify approving CANCELLED repair orders is strictly rejected (409 INVALID_STATUS)', async () => {
    // Checkin and immediately cancel
    const checkin = await request('/repairs', {
      method: 'POST',
      token: frontDeskToken,
      body: {
        customerName: 'นายทดสอบ ยกเลิกคำสั่ง',
        phone: '089-111-9999',
        serviceType: 'ตรวจเช็ค',
        licensePlate: `9ฮฮ-${Date.now() % 10000}`,
        carBrand: 'Honda',
        carModel: 'City',
        modelYear: 2020,
        complaint: 'ขอยกเลิกคำสั่งซ่อม',
        queueClass: 'NORMAL'
      }
    });
    assert.equal(checkin.status, 200);
    const cancelRoId = checkin.body.repairId;

    const cancelRes = await request(`/repairs/${cancelRoId}/cancel`, {
      method: 'POST',
      token: frontDeskToken,
      body: { reason: 'Customer changed mind' }
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.status, 'CANCELLED');

    // Attempt approve via /repairs/{id}/approve
    const approveCancelRes = await request(`/repairs/${cancelRoId}/approve`, {
      method: 'POST',
      token: frontDeskToken,
      body: { decision: 'APPROVED' }
    });
    console.log('[3] /repairs/{id}/approve on CANCELLED -> Status:', approveCancelRes.status, approveCancelRes.body);
    assert.equal(approveCancelRes.status, 409, 'Expected HTTP 409');
    assert.equal(approveCancelRes.body.code, 'INVALID_STATUS', 'Expected error code INVALID_STATUS');
    assert.match(approveCancelRes.body.error, /Cannot approve CANCELLED repair order/i);

    // Confirm status remains CANCELLED
    const roAfter = await request(`/repairs/${cancelRoId}`, { token: frontDeskToken });
    assert.equal(roAfter.body.status, 'CANCELLED');
  });

  await t.test('4. Verify deciding estimate on CANCELLED repair orders is strictly rejected (409 INVALID_STATUS)', async () => {
    // Create checkin -> call next to Bay 5 (free) -> draft estimate -> cancel repair -> attempt estimate decision
    // First, ensure Bay 5 is free
    const allRepairs = await request('/repairs', { token: frontDeskToken });
    const bay5Occupier = allRepairs.body.find(r => r.bayId === 5 && !['COMPLETED', 'CANCELLED'].includes(r.status));
    if (bay5Occupier) {
      await request(`/repairs/${bay5Occupier.repairId}/hold`, {
        method: 'POST',
        token: frontDeskToken,
        body: { holdReason: 'Freeing Bay 5 for test' }
      });
    }

    const checkin = await request('/repairs', {
      method: 'POST',
      token: frontDeskToken,
      body: {
        customerName: 'นายทดสอบ ยกเลิกหลังใบประเมิน',
        phone: '089-222-8888',
        serviceType: 'ตรวจเช็ค',
        licensePlate: `8กก-${(Date.now() + 1) % 10000}`,
        carBrand: 'Toyota',
        carModel: 'Altis',
        modelYear: 2021,
        complaint: 'ทดสอบยกเลิกหลังใบประเมิน',
        queueClass: 'PRIORITY',
        priorityReason: 'ด่วน'
      }
    });
    assert.equal(checkin.status, 200, `Checkin 4 failed: ${JSON.stringify(checkin.body)}`);
    const roId = checkin.body.repairId;

    // Call next to Bay 5
    const callNext = await request('/queue/call-next', {
      method: 'POST',
      token: frontDeskToken,
      body: { bayId: 5, mechanicId: 3 }
    });
    assert.equal(callNext.status, 200, `Call next failed: ${JSON.stringify(callNext.body)}`);
    const activeRoId = callNext.body.repairId;
    assert.equal(callNext.body.status, 'IN_DIAGNOSIS');

    // Create estimate
    const estRes = await request('/estimates', {
      method: 'POST',
      token: mechanicToken,
      body: {
        repairId: activeRoId,
        diagnosisNote: 'ตรวจเช็คระบบเบรก',
        lines: [
          { lineType: 'LABOR', description: 'ค่าแรง', qty: 1, unitPrice: 350.00 }
        ]
      }
    });
    assert.equal(estRes.status, 200, `Estimate creation failed: ${JSON.stringify(estRes.body)}`);
    const estId = estRes.body.estimate.estimateId;

    // Cancel repair order
    const cancelRes = await request(`/repairs/${activeRoId}/cancel`, {
      method: 'POST',
      token: frontDeskToken,
      body: { reason: 'Customer rejected estimate completely' }
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.status, 'CANCELLED');

    // Attempt decide estimate via POST /api/estimates/{id}/decision
    const decideRes = await request(`/estimates/${estId}/decision`, {
      method: 'POST',
      token: frontDeskToken,
      body: { decision: 'APPROVED' }
    });
    console.log('[4] /estimates/{id}/decision on CANCELLED -> Status:', decideRes.status, decideRes.body);
    assert.equal(decideRes.status, 409, 'Expected HTTP 409');
    assert.equal(decideRes.body.code, 'INVALID_STATUS', 'Expected error code INVALID_STATUS');
    assert.match(decideRes.body.error, /Cannot decide estimate for CANCELLED repair order/i);

    // Attempt approve via POST /api/repairs/{id}/approve
    const approveRes = await request(`/repairs/${activeRoId}/approve`, {
      method: 'POST',
      token: frontDeskToken,
      body: { decision: 'APPROVED' }
    });
    assert.equal(approveRes.status, 409);
    assert.equal(approveRes.body.code, 'INVALID_STATUS');
    assert.match(approveRes.body.error, /Cannot approve CANCELLED repair order/i);
  });

  // --------------------------------------------------------------------------
  // INVARIANT 3: Positive lifecycle path remains actionable
  // --------------------------------------------------------------------------
  await t.test('5. Verify orders in AWAITING_APPROVAL and IN_DIAGNOSIS remain validly actionable', async () => {
    // Ensure Bay 5 is free
    const allRepairs = await request('/repairs', { token: frontDeskToken });
    const bay5Occupier = allRepairs.body.find(r => r.bayId === 5 && !['COMPLETED', 'CANCELLED'].includes(r.status));
    if (bay5Occupier) {
      await request(`/repairs/${bay5Occupier.repairId}/hold`, {
        method: 'POST',
        token: frontDeskToken,
        body: { holdReason: 'Freeing Bay 5 for test 5' }
      });
    }

    // Check in a new vehicle
    const checkin = await request('/repairs', {
      method: 'POST',
      token: frontDeskToken,
      body: {
        customerName: 'นางสาวทดสอบ อนุมัติสำเร็จจริง',
        phone: '081-777-1234',
        serviceType: 'เปลี่ยนถ่ายน้ำมันเครื่อง',
        licensePlate: `7ขข-${(Date.now() + 2) % 10000}`,
        carBrand: 'Mazda',
        carModel: 'CX-3',
        modelYear: 2022,
        complaint: 'เช็คระยะ 30,000 กม.',
        queueClass: 'PRIORITY',
        priorityReason: 'VIP ด่วน'
      }
    });
    assert.equal(checkin.status, 200, `Checkin 5 failed: ${JSON.stringify(checkin.body)}`);
    const roId = checkin.body.repairId;

    // Call next to Bay 5 -> moves to IN_DIAGNOSIS
    const callNext = await request('/queue/call-next', {
      method: 'POST',
      token: frontDeskToken,
      body: { bayId: 5, mechanicId: 3 }
    });
    assert.equal(callNext.status, 200, `Call next failed: ${JSON.stringify(callNext.body)}`);
    const activeRoId = callNext.body.repairId;
    assert.equal(callNext.body.status, 'IN_DIAGNOSIS');

    // Create estimate -> moves to AWAITING_APPROVAL
    const estRes = await request('/estimates', {
      method: 'POST',
      token: mechanicToken,
      body: {
        repairId: activeRoId,
        diagnosisNote: 'เปลี่ยนน้ำมันเครื่องและกรอง',
        lines: [
          { lineType: 'LABOR', description: 'ค่าแรงบริการ', qty: 1, unitPrice: 350.00 },
          { lineType: 'PART', partId: 1, description: 'น้ำมันเครื่อง 5W-30', qty: 1, unitPrice: 1250.00 }
        ]
      }
    });
    assert.equal(estRes.status, 200, `Create estimate failed: ${JSON.stringify(estRes.body)}`);
    const estId = estRes.body.estimate.estimateId;

    // Verify order is now in AWAITING_APPROVAL
    const roCheck = await request(`/repairs/${activeRoId}`, { token: frontDeskToken });
    assert.equal(roCheck.body.status, 'AWAITING_APPROVAL');

    // Approve the order via POST /api/repairs/{id}/approve
    const approveRes = await request(`/repairs/${activeRoId}/approve`, {
      method: 'POST',
      token: frontDeskToken,
      body: { decision: 'APPROVED' }
    });
    console.log('[5] /repairs/{id}/approve in AWAITING_APPROVAL -> Status:', approveRes.status, approveRes.body.repairOrder?.status);
    assert.equal(approveRes.status, 200, 'Approval of AWAITING_APPROVAL order must succeed');
    assert.equal(approveRes.body.estimate.status, 'APPROVED');
    assert.equal(approveRes.body.repairOrder.status, 'IN_REPAIR');

    // Verify DB state matches
    const roFinal = await request(`/repairs/${activeRoId}`, { token: frontDeskToken });
    assert.equal(roFinal.body.status, 'IN_REPAIR');
    assert.equal(roFinal.body.bayId, 5);
  });

  // --------------------------------------------------------------------------
  // INVARIANT 4: Terminal orders reject status update and priority override
  // --------------------------------------------------------------------------
  await t.test('6. Verify terminal COMPLETED orders reject status update and priority override', async () => {
    // 6a. POST /api/repairs/1/status
    const statusRes = await request('/repairs/1/status', {
      method: 'POST',
      token: frontDeskToken,
      body: { status: 'IN_REPAIR', note: 'Attempt resurrect' }
    });
    console.log('[6a] /repairs/1/status -> Status:', statusRes.status, statusRes.body);
    assert.equal(statusRes.status, 409);
    assert.equal(statusRes.body.code, 'INVALID_STATUS');
    assert.match(statusRes.body.error, /Cannot update status of COMPLETED repair order/i);

    // 6b. POST /api/repairs/1/priority-override
    const prioRes = await request('/repairs/1/priority-override', {
      method: 'POST',
      token: adminToken,
      body: { priorityReason: 'Attempt resurrect priority' }
    });
    console.log('[6b] /repairs/1/priority-override -> Status:', prioRes.status, prioRes.body);
    assert.equal(prioRes.status, 409);
    assert.equal(prioRes.body.code, 'INVALID_STATUS');
    assert.match(prioRes.body.error, /Cannot override priority for COMPLETED repair order/i);
  });
});
