import {
  User,
  UserRole,
  RepairBay,
  Part,
  RepairOrder,
  PurchaseOrder,
  SaleOrder,
  Invoice,
  StockMovement,
  RepairSummaryReport,
  InventoryUsageReport,
} from './types';
import {
  INITIAL_USERS,
  INITIAL_BAYS,
  INITIAL_PARTS,
  INITIAL_REPAIR_ORDERS,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_INVOICES,
} from './mock-data';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// In-browser local storage state fallback
class LocalStorageStore {
  private users: User[] = [...INITIAL_USERS];
  private bays: RepairBay[] = [...INITIAL_BAYS];
  private parts: Part[] = [...INITIAL_PARTS];
  private repairs: RepairOrder[] = [...INITIAL_REPAIR_ORDERS];
  private purchaseOrders: PurchaseOrder[] = [...INITIAL_PURCHASE_ORDERS];
  private sales: SaleOrder[] = [];
  private invoices: Invoice[] = [...INITIAL_INVOICES];
  private movements: StockMovement[] = [...INITIAL_STOCK_MOVEMENTS];

  getUsers() { return this.users; }
  getBays() { return this.bays; }
  getParts() { return this.parts; }
  getRepairs() { return this.repairs; }
  getPurchaseOrders() { return this.purchaseOrders; }
  getSales() { return this.sales; }
  getInvoices() { return this.invoices; }
  getMovements() { return this.movements; }

  updatePart(id: number, deltaOnHand: number, deltaReserved: number) {
    const p = this.parts.find((x) => x.id === id);
    if (p) {
      p.onHand += deltaOnHand;
      p.reserved += deltaReserved;
    }
  }

  addMovement(mov: Omit<StockMovement, 'id' | 'createdAt'>) {
    const newMov: StockMovement = {
      ...mov,
      id: this.movements.length + 1,
      createdAt: new Date().toISOString(),
    };
    this.movements.unshift(newMov);
    return newMov;
  }
}

const localStore = new LocalStorageStore();

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('garage_auth_token');
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('garage_auth_token', token);
  } else {
    localStorage.removeItem('garage_auth_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errorBody.message || `HTTP ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  } catch (err: any) {
    // If backend is unreachable, gracefully log and fall back to local store
    console.warn(`[API] Fallback for ${endpoint}:`, err.message);
    throw err;
  }
}

// ---------------- AUTH API ----------------
export async function apiLogin(username: string, password: string, role?: UserRole): Promise<{ token: string; user: User }> {
  try {
    return await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });
  } catch {
    // Fallback authentication
    const user = localStore.getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase()) || {
      id: 99,
      username,
      fullName: `${username} (Demo Staff)`,
      role: role || 'FRONT_DESK',
      isActive: true,
    };
    const token = `mock-token-${user.role}-${Date.now()}`;
    setStoredToken(token);
    return { token, user };
  }
}

// ---------------- QUEUE & REPAIR API ----------------
export async function apiGetQueue(): Promise<RepairOrder[]> {
  try {
    return await request<RepairOrder[]>('/queue');
  } catch {
    return localStore.getRepairs().filter((r) => r.status === 'QUEUED' || r.status === 'IN_DIAGNOSIS' || r.status === 'ON_HOLD');
  }
}

export async function apiCheckIn(data: {
  customerName: string;
  phone: string;
  licensePlate: string;
  brand: string;
  model: string;
  mileage: number;
  symptoms: string;
  queueClass: 'NORMAL' | 'PRIORITY';
  priorityReason?: string;
  insurerName?: string;
  insuranceClaimNo?: string;
}): Promise<RepairOrder> {
  try {
    return await request<RepairOrder>('/repairs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch {
    const count = localStore.getRepairs().length + 1;
    const pad = String(count).padStart(4, '0');
    const newOrder: RepairOrder = {
      id: count,
      roNumber: `RO-20261105-${pad}`,
      ticketNumber: `Q-20261105-${String(count).padStart(3, '0')}`,
      queueClass: data.queueClass,
      status: 'QUEUED',
      customerId: 100 + count,
      customerName: data.customerName,
      customerPhone: data.phone,
      vehicleId: 200 + count,
      licensePlate: data.licensePlate,
      vehicleModel: `${data.brand} ${data.model}`,
      mileage: Number(data.mileage) || 0,
      symptoms: data.symptoms,
      priorityReason: data.priorityReason,
      insurerName: data.insurerName,
      insuranceClaimNo: data.insuranceClaimNo,
      queuedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    localStore.getRepairs().unshift(newOrder);
    return newOrder;
  }
}

export async function apiCallNext(bayId: number, mechanicId: number): Promise<RepairOrder | null> {
  try {
    return await request<RepairOrder>('/repairs/queue/call-next', {
      method: 'POST',
      body: JSON.stringify({ bayId, mechanicId }),
    });
  } catch {
    const queued = localStore.getRepairs().find((r) => r.status === 'QUEUED');
    if (!queued) return null;

    queued.status = 'IN_DIAGNOSIS';
    queued.assignedBayId = bayId;
    const bay = localStore.getBays().find((b) => b.id === bayId);
    if (bay) {
      queued.assignedBayNumber = bay.bayNumber;
      bay.isOccupied = true;
      bay.currentRepairId = queued.id;
    }
    queued.assignedMechanicId = mechanicId;
    return queued;
  }
}

export async function apiGetRepairs(): Promise<RepairOrder[]> {
  try {
    return await request<RepairOrder[]>('/repairs');
  } catch {
    return localStore.getRepairs();
  }
}

export async function apiGetRepairById(id: number): Promise<RepairOrder | null> {
  try {
    return await request<RepairOrder>(`/repairs/${id}`);
  } catch {
    return localStore.getRepairs().find((r) => r.id === id) || null;
  }
}

export async function apiUpdateRepairStatus(
  id: number,
  status: RepairOrder['status'],
  note?: string
): Promise<RepairOrder> {
  try {
    return await request<RepairOrder>(`/repairs/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    });
  } catch {
    const ro = localStore.getRepairs().find((r) => r.id === id);
    if (!ro) throw new Error('Repair order not found');
    ro.status = status;
    if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'AWAITING_PAYMENT') {
      if (ro.assignedBayId) {
        const bay = localStore.getBays().find((b) => b.id === ro.assignedBayId);
        if (bay) {
          bay.isOccupied = false;
          bay.currentRepairId = null;
        }
        ro.assignedBayId = null;
      }
      if (status === 'COMPLETED') {
        ro.completedAt = new Date().toISOString();
      }
    }
    return ro;
  }
}

export async function apiSubmitEstimate(
  repairId: number,
  lines: { lineType: 'LABOR' | 'PART'; partId?: number; description: string; qty: number; unitPrice: number }[]
): Promise<any> {
  try {
    return await request('/estimates', {
      method: 'POST',
      body: JSON.stringify({ repairId, lines }),
    });
  } catch {
    const ro = localStore.getRepairs().find((r) => r.id === repairId);
    if (ro) {
      ro.status = 'AWAITING_APPROVAL';
      const laborTotal = lines.filter((l) => l.lineType === 'LABOR').reduce((acc, l) => acc + l.qty * l.unitPrice, 0);
      const partsTotal = lines.filter((l) => l.lineType === 'PART').reduce((acc, l) => acc + l.qty * l.unitPrice, 0);
      ro.laborTotal = laborTotal;
      ro.partsTotal = partsTotal;
      ro.subtotal = laborTotal + partsTotal;
    }
    return { success: true };
  }
}

export async function apiApproveEstimate(
  repairId: number,
  decision: 'APPROVED' | 'DECLINED',
  docsReceived?: boolean
): Promise<any> {
  try {
    return await request(`/repairs/${repairId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ decision, insuranceDocsReceived: docsReceived }),
    });
  } catch {
    const ro = localStore.getRepairs().find((r) => r.id === repairId);
    if (!ro) throw new Error('Repair order not found');
    if (decision === 'APPROVED') {
      ro.status = 'IN_REPAIR';
      if (docsReceived !== undefined) ro.insuranceDocsReceived = docsReceived;
    } else {
      ro.status = 'CANCELLED';
      if (ro.assignedBayId) {
        const bay = localStore.getBays().find((b) => b.id === ro.assignedBayId);
        if (bay) {
          bay.isOccupied = false;
          bay.currentRepairId = null;
        }
        ro.assignedBayId = null;
      }
    }
    return { success: true };
  }
}

// ---------------- WAREHOUSE & PARTS API ----------------
export async function apiGetParts(): Promise<Part[]> {
  try {
    return await request<Part[]>('/parts');
  } catch {
    return localStore.getParts();
  }
}

export async function apiCreatePart(part: Omit<Part, 'id' | 'onHand' | 'reserved'>): Promise<Part> {
  try {
    return await request<Part>('/parts', {
      method: 'POST',
      body: JSON.stringify(part),
    });
  } catch {
    const count = localStore.getParts().length + 1;
    const newPart: Part = {
      ...part,
      id: count,
      onHand: 0,
      reserved: 0,
    };
    localStore.getParts().push(newPart);
    return newPart;
  }
}

export async function apiIssueParts(requestId: number, partId: number, qty: number): Promise<any> {
  try {
    return await request('/warehouse/issue', {
      method: 'POST',
      body: JSON.stringify({ requestId, partId, qty }),
    });
  } catch {
    localStore.updatePart(partId, -qty, -qty);
    const p = localStore.getParts().find((x) => x.id === partId);
    localStore.addMovement({
      partId,
      partCode: p?.partCode || 'PART',
      partName: p?.name || 'อะไหล่',
      movementType: 'ISSUE',
      deltaOnHand: -qty,
      deltaReserved: -qty,
      reason: `จ่ายอะไหล่ตามใบขอเบิก #${requestId}`,
      userName: 'ประสิทธิ์ (คลัง)',
    });
    return { success: true };
  }
}

export async function apiReturnParts(requestId: number, partId: number, qty: number, reason: string): Promise<any> {
  try {
    return await request('/warehouse/return', {
      method: 'POST',
      body: JSON.stringify({ requestId, partId, qty, reason }),
    });
  } catch {
    localStore.updatePart(partId, qty, 0);
    const p = localStore.getParts().find((x) => x.id === partId);
    localStore.addMovement({
      partId,
      partCode: p?.partCode || 'PART',
      partName: p?.name || 'อะไหล่',
      movementType: 'RETURN',
      deltaOnHand: qty,
      deltaReserved: 0,
      reason: reason || `รับคืนอะไหล่จากงานซ่อม`,
      userName: 'ประสิทธิ์ (คลัง)',
    });
    return { success: true };
  }
}

export async function apiAdjustStock(partId: number, deltaOnHand: number, reason: string): Promise<any> {
  try {
    return await request('/warehouse/adjust', {
      method: 'POST',
      body: JSON.stringify({ partId, deltaOnHand, reason }),
    });
  } catch {
    localStore.updatePart(partId, deltaOnHand, 0);
    const p = localStore.getParts().find((x) => x.id === partId);
    localStore.addMovement({
      partId,
      partCode: p?.partCode || 'PART',
      partName: p?.name || 'อะไหล่',
      movementType: 'ADJUST',
      deltaOnHand,
      deltaReserved: 0,
      reason,
      userName: 'ประสิทธิ์ (คลัง)',
    });
    return { success: true };
  }
}

export async function apiGetStockLedger(): Promise<StockMovement[]> {
  try {
    return await request<StockMovement[]>('/warehouse/ledger');
  } catch {
    return localStore.getMovements();
  }
}

export async function apiGetLowStock(): Promise<Part[]> {
  try {
    return await request<Part[]>('/warehouse/low-stock');
  } catch {
    return localStore.getParts().filter((p) => p.onHand <= p.reorderLevel);
  }
}

// ---------------- PURCHASE ORDER API ----------------
export async function apiGetPurchaseOrders(): Promise<PurchaseOrder[]> {
  try {
    return await request<PurchaseOrder[]>('/purchase-orders');
  } catch {
    return localStore.getPurchaseOrders();
  }
}

export async function apiCreatePurchaseOrder(supplierName: string, lines: { partId: number; qtyOrdered: number; unitCost: number }[]): Promise<PurchaseOrder> {
  try {
    return await request<PurchaseOrder>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({ supplierName, lines }),
    });
  } catch {
    const count = localStore.getPurchaseOrders().length + 1;
    const totalCost = lines.reduce((acc, l) => acc + l.qtyOrdered * l.unitCost, 0);
    const newPO: PurchaseOrder = {
      id: count,
      poNumber: `PO-20261105-${String(count).padStart(3, '0')}`,
      supplierName,
      status: 'ORDERED',
      totalCost,
      createdAt: new Date().toISOString(),
      lines: lines.map((l, idx) => {
        const p = localStore.getParts().find((x) => x.id === l.partId);
        return {
          id: idx + 1,
          poId: count,
          partId: l.partId,
          partCode: p?.partCode || '',
          partName: p?.name || '',
          qtyOrdered: l.qtyOrdered,
          qtyReceived: 0,
          unitCost: l.unitCost,
        };
      }),
    };
    localStore.getPurchaseOrders().unshift(newPO);
    return newPO;
  }
}

export async function apiReceivePurchaseOrder(poId: number, receivedLines: { poLineId: number; qtyReceived: number }[]): Promise<any> {
  try {
    return await request(`/purchase-orders/${poId}/receive`, {
      method: 'POST',
      body: JSON.stringify({ receivedLines }),
    });
  } catch {
    const po = localStore.getPurchaseOrders().find((x) => x.id === poId);
    if (po) {
      po.status = 'RECEIVED';
      for (const line of po.lines) {
        line.qtyReceived = line.qtyOrdered;
        localStore.updatePart(line.partId, line.qtyOrdered, 0);
        localStore.addMovement({
          partId: line.partId,
          partCode: line.partCode,
          partName: line.partName,
          movementType: 'RECEIPT',
          deltaOnHand: line.qtyOrdered,
          deltaReserved: 0,
          reason: `รับสินค้าตามใบสั่งซื้อ ${po.poNumber}`,
          poLineId: line.id,
          userName: 'ประสิทธิ์ (คลัง)',
        });
      }
    }
    return { success: true };
  }
}

// ---------------- SALES & COUNTER API ----------------
export async function apiCompleteCounterSale(
  customerName: string,
  customerPhone: string,
  items: { partId: number; qty: number; unitPrice: number }[],
  paymentMethod: string
): Promise<{ invoice: Invoice }> {
  try {
    return await request<{ invoice: Invoice }>('/sales/complete', {
      method: 'POST',
      body: JSON.stringify({ customerName, customerPhone, items, paymentMethod }),
    });
  } catch {
    const subtotal = items.reduce((acc, it) => acc + it.qty * it.unitPrice, 0);
    const vat = +(subtotal * 0.07).toFixed(2);
    const total = +(subtotal + vat).toFixed(2);

    const invCount = localStore.getInvoices().length + 1;
    const inv: Invoice = {
      id: invCount,
      invoiceNumber: `INV-20261105-${String(invCount).padStart(4, '0')}`,
      customerName: customerName || 'ลูกค้าทั่วไป (Walk-in)',
      customerPhone: customerPhone || '-',
      subtotal,
      vatAmount: vat,
      totalWithVat: total,
      insuranceCovered: 0,
      customerDue: total,
      status: 'ISSUED',
      issuedAt: new Date().toISOString(),
      lines: items.map((it, i) => {
        const p = localStore.getParts().find((x) => x.id === it.partId);
        return {
          id: i + 1,
          invoiceId: invCount,
          partId: it.partId,
          description: p?.name || 'อะไหล่',
          qty: it.qty,
          unitPrice: it.unitPrice,
          lineTotal: it.qty * it.unitPrice,
        };
      }),
      payments: [
        {
          id: Date.now(),
          invoiceId: invCount,
          payerType: 'CUSTOMER',
          amount: total,
          method: paymentMethod,
          paidAt: new Date().toISOString(),
          receiptNumber: `RCP-CS-${invCount}`,
        },
      ],
    };

    // Deduct stock
    for (const it of items) {
      localStore.updatePart(it.partId, -it.qty, 0);
      const p = localStore.getParts().find((x) => x.id === it.partId);
      localStore.addMovement({
        partId: it.partId,
        partCode: p?.partCode || 'PART',
        partName: p?.name || 'อะไหล่',
        movementType: 'ISSUE',
        deltaOnHand: -it.qty,
        deltaReserved: 0,
        reason: `ขายหน้าร้าน ${inv.invoiceNumber}`,
        userName: 'กมล (หน้าร้าน)',
      });
    }

    localStore.getInvoices().unshift(inv);
    return { invoice: inv };
  }
}

// ---------------- INVOICES & BILLING API ----------------
export async function apiGetInvoices(): Promise<Invoice[]> {
  try {
    return await request<Invoice[]>('/invoices');
  } catch {
    return localStore.getInvoices();
  }
}

export async function apiGetInvoiceById(id: number): Promise<Invoice | null> {
  try {
    return await request<Invoice>(`/invoices/${id}`);
  } catch {
    return localStore.getInvoices().find((x) => x.id === id) || null;
  }
}

export async function apiCreateInvoiceForRepair(repairId: number): Promise<Invoice> {
  try {
    return await request<Invoice>('/invoices', {
      method: 'POST',
      body: JSON.stringify({ repairId }),
    });
  } catch {
    const ro = localStore.getRepairs().find((x) => x.id === repairId);
    if (!ro) throw new Error('Repair order not found');

    const subtotal = (ro.subtotal || 2500);
    const insuranceCovered = ro.insuranceCoveredAmount || 0;
    const vat = +(subtotal * 0.07).toFixed(2);
    const totalWithVat = +(subtotal + vat).toFixed(2);
    const customerDue = Math.max(0, +(totalWithVat - insuranceCovered).toFixed(2));

    const invCount = localStore.getInvoices().length + 1;
    const newInv: Invoice = {
      id: invCount,
      invoiceNumber: `INV-20261105-${String(invCount).padStart(4, '0')}`,
      repairId: ro.id,
      roNumber: ro.roNumber,
      customerName: ro.customerName,
      customerPhone: ro.customerPhone,
      subtotal,
      vatAmount: vat,
      totalWithVat,
      insuranceCovered,
      customerDue,
      status: 'ISSUED',
      issuedAt: new Date().toISOString(),
      lines: [
        {
          id: 1,
          invoiceId: invCount,
          partId: null,
          description: `ค่าแรงและบริการซ่อมบำรุง (${ro.vehicleModel})`,
          qty: 1,
          unitPrice: ro.laborTotal || 800,
          lineTotal: ro.laborTotal || 800,
        },
        {
          id: 2,
          invoiceId: invCount,
          partId: 1,
          description: `รายการอะไหล่เปลี่ยนสุทธิ (Net Issued Parts)`,
          qty: 1,
          unitPrice: ro.partsTotal || 1700,
          lineTotal: ro.partsTotal || 1700,
        },
      ],
      payments: [],
    };

    localStore.getInvoices().unshift(newInv);
    ro.status = 'AWAITING_PAYMENT';
    return newInv;
  }
}

export async function apiPayInvoice(
  invoiceId: number,
  amount: number,
  method: string,
  payerType: 'CUSTOMER' | 'INSURER'
): Promise<any> {
  try {
    return await request(`/invoices/${invoiceId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ amount, method, payerType }),
    });
  } catch {
    const inv = localStore.getInvoices().find((x) => x.id === invoiceId);
    if (!inv) throw new Error('Invoice not found');

    const receiptNo = `RCP-20261105-${Date.now().toString().slice(-4)}`;
    inv.payments.push({
      id: Date.now(),
      invoiceId,
      payerType,
      amount,
      method,
      paidAt: new Date().toISOString(),
      receiptNumber: receiptNo,
    });

    const totalPaidCustomer = inv.payments
      .filter((p) => p.payerType === 'CUSTOMER')
      .reduce((acc, p) => acc + p.amount, 0);

    if (totalPaidCustomer >= inv.customerDue) {
      if (inv.repairId) {
        const ro = localStore.getRepairs().find((x) => x.id === inv.repairId);
        if (ro) {
          ro.status = 'COMPLETED';
          ro.completedAt = new Date().toISOString();
        }
      }
    }

    return { success: true, receiptNumber: receiptNo };
  }
}

// ---------------- ADMIN & SETTINGS API ----------------
export async function apiGetBays(): Promise<RepairBay[]> {
  try {
    return await request<RepairBay[]>('/admin/bays');
  } catch {
    return localStore.getBays();
  }
}

export async function apiUpdateBay(id: number, data: Partial<RepairBay>): Promise<RepairBay> {
  try {
    return await request<RepairBay>(`/admin/bays/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  } catch {
    const bay = localStore.getBays().find((b) => b.id === id);
    if (bay) {
      Object.assign(bay, data);
      return bay;
    }
    throw new Error('Bay not found');
  }
}

export async function apiGetUsers(): Promise<User[]> {
  try {
    return await request<User[]>('/admin/users');
  } catch {
    return localStore.getUsers();
  }
}

export async function apiCreateUser(user: { username: string; fullName: string; role: UserRole }): Promise<User> {
  try {
    return await request<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  } catch {
    const newUser: User = {
      id: localStore.getUsers().length + 1,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      isActive: true,
    };
    localStore.getUsers().push(newUser);
    return newUser;
  }
}

export async function apiDeactivateUser(id: number): Promise<any> {
  try {
    return await request(`/admin/users/${id}/deactivate`, { method: 'POST' });
  } catch {
    const u = localStore.getUsers().find((x) => x.id === id);
    if (u) u.isActive = false;
    return { success: true };
  }
}

// ---------------- OPERATIONAL REPORTS API ----------------
export async function apiGetRepairSummaryReport(
  startDate?: string,
  endDate?: string,
  status?: string,
  mechanicId?: number
): Promise<RepairSummaryReport> {
  try {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (status) params.set('status', status);
    if (mechanicId) params.set('mechanicId', String(mechanicId));
    return await request<RepairSummaryReport>(`/reports/repair-summary?${params.toString()}`);
  } catch {
    let list = localStore.getRepairs();
    if (status && status !== 'ALL') {
      list = list.filter((r) => r.status === status);
    }
    if (mechanicId) {
      list = list.filter((r) => r.assignedMechanicId === mechanicId);
    }

    const totalJobs = list.length;
    const completedJobs = list.filter((r) => r.status === 'COMPLETED').length;
    const pendingJobs = list.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length;
    const cancelledJobs = list.filter((r) => r.status === 'CANCELLED').length;

    const totalLaborRevenue = list.reduce((acc, r) => acc + (r.laborTotal || 0), 0);
    const totalPartsRevenue = list.reduce((acc, r) => acc + (r.partsTotal || 0), 0);
    const totalRevenue = totalLaborRevenue + totalPartsRevenue;

    return {
      startDate: startDate || '2026-11-01',
      endDate: endDate || '2026-11-05',
      totalJobs,
      completedJobs,
      pendingJobs,
      cancelledJobs,
      avgTurnaroundHours: 3.8,
      totalLaborRevenue,
      totalPartsRevenue,
      totalRevenue,
      records: list,
    };
  }
}

export async function apiGetInventoryUsageReport(
  categoryFilter?: string,
  statusFilter?: string
): Promise<InventoryUsageReport> {
  try {
    const params = new URLSearchParams();
    if (categoryFilter) params.set('category', categoryFilter);
    if (statusFilter) params.set('status', statusFilter);
    return await request<InventoryUsageReport>(`/reports/inventory-usage?${params.toString()}`);
  } catch {
    let parts = localStore.getParts();
    if (categoryFilter && categoryFilter !== 'ALL') {
      parts = parts.filter((p) => p.category === categoryFilter);
    }

    const enriched = parts.map((p) => {
      let stockStatus: 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'NORMAL';
      if (p.onHand === 0) stockStatus = 'OUT_OF_STOCK';
      else if (p.onHand <= p.reorderLevel) stockStatus = 'LOW_STOCK';

      const suggestedReorderQty = Math.max(0, p.reorderLevel * 2 - p.onHand);
      return {
        ...p,
        stockStatus,
        suggestedReorderQty,
      };
    });

    const filtered = enriched.filter((p) => {
      if (!statusFilter || statusFilter === 'ALL') return true;
      return p.stockStatus === statusFilter;
    });

    const totalValuation = parts.reduce((acc, p) => acc + p.onHand * p.costPrice, 0);
    const lowStockItemsCount = enriched.filter((p) => p.stockStatus === 'LOW_STOCK').length;
    const outOfStockItemsCount = enriched.filter((p) => p.stockStatus === 'OUT_OF_STOCK').length;

    return {
      generatedAt: new Date().toISOString(),
      categoryFilter,
      statusFilter,
      totalValuation,
      totalItems: parts.length,
      lowStockItemsCount,
      outOfStockItemsCount,
      topConsumedParts: [
        { partCode: 'OIL-SYN-5W30', partName: 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30', consumedQty: 24, consumedValue: 34800 },
        { partCode: 'FLT-OIL-TY01', partName: 'ไส้กรองน้ำมันเครื่อง Toyota/Honda', consumedQty: 22, consumedValue: 4840 },
        { partCode: 'BRK-PAD-FR01', partName: 'ผ้าเบรกหน้า Ceramic Bendix', consumedQty: 10, consumedValue: 18500 },
        { partCode: 'SPK-IRID-IX04', partName: 'หัวเทียน Iridium NGK Laser', consumedQty: 8, consumedValue: 12800 },
        { partCode: 'BLT-TMG-GT01', partName: 'สายพานหน้าเครื่อง Gates Micro-V', consumedQty: 6, consumedValue: 3900 },
      ],
      records: filtered,
    };
  }
}
