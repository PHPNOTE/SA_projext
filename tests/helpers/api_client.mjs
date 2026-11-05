import { MockGarageServer } from './mock_server.mjs';

/**
 * Unified Test API Client.
 * Routes to either:
 *  1. Live HTTP REST API at baseURL (e.g. http://localhost:8080/api) using native fetch
 *  2. Embedded MockGarageServer contract oracle when running in 'contract' mode.
 */
export class GarageApiClient {
  constructor(options = {}) {
    this.mode = options.mode || 'contract';
    this.targetUrl = options.targetUrl || 'http://localhost:8080/api';
    this.currentUser = null;
    this.token = null;
    this.mockServer = new MockGarageServer();
  }

  setMode(mode) {
    this.mode = mode;
  }

  resetState() {
    this.mockServer.reset();
    this.currentUser = null;
    this.token = null;
  }

  getServer() {
    return this.mockServer;
  }

  async login(username, password = 'password123') {
    if (this.mode === 'contract') {
      const res = this.mockServer.handleLogin({ username, password });
      if (res.status === 200) {
        this.token = res.body.token;
        this.currentUser = res.body.user;
      }
      return res;
    }

    try {
      const response = await fetch(`${this.targetUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (response.ok) {
        this.token = data.token;
        this.currentUser = data.user;
      }
      return { status: response.status, body: data };
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
  }

  async asRole(role) {
    const roleUserMap = {
      FRONT_DESK: 'frontdesk',
      MECHANIC: 'somchai',
      WAREHOUSE: 'wichai',
      SALES: 'somsri',
      MANAGER: 'admin'
    };
    const username = roleUserMap[role] || 'admin';
    return await this.login(username, 'password123');
  }

  // Generic request dispatcher
  async request(method, path, body = null, query = null) {
    if (this.mode === 'contract') {
      return this.dispatchMock(method, path, body, query);
    }

    let url = `${this.targetUrl}${path}`;
    if (query) {
      const params = new URLSearchParams(query);
      url += `?${params.toString()}`;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const reqOpts = { method, headers };
      if (body) reqOpts.body = JSON.stringify(body);
      const res = await fetch(url, reqOpts);
      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
      return { status: res.status, body: parsed };
    } catch (err) {
      return { status: 500, body: { error: err.message } };
    }
  }

  dispatchMock(method, path, body, query) {
    const user = this.currentUser;

    // Route matching
    if (path === '/auth/login' && method === 'POST') return this.mockServer.handleLogin(body);

    // Queue & Checkin
    if (path === '/repairs' && method === 'POST') return this.mockServer.handleCheckin(body, user);
    if (path === '/repairs/queue/call-next' && method === 'POST') return this.mockServer.handleCallNext(body, user);
    if (path.match(/^\/repairs\/(\d+)\/hold$/) && method === 'POST') {
      const id = path.match(/^\/repairs\/(\d+)\/hold$/)[1];
      return this.mockServer.handleHoldRepair(id, body || {}, user);
    }
    if (path.match(/^\/repairs\/(\d+)\/cancel$/) && method === 'POST') {
      const id = path.match(/^\/repairs\/(\d+)\/cancel$/)[1];
      return this.mockServer.handleCancelRepair(id, body || {}, user);
    }
    if (path.match(/^\/repairs\/(\d+)\/priority-override$/) && method === 'POST') {
      const id = path.match(/^\/repairs\/(\d+)\/priority-override$/)[1];
      return this.mockServer.handlePriorityOverride(id, body || {}, user);
    }

    // Diagnostics & Estimates
    if (path === '/estimates' && method === 'POST') return this.mockServer.handleCreateEstimate(body, user);
    if (path.match(/^\/estimates\/(\d+)\/decision$/) && method === 'POST') {
      const id = path.match(/^\/estimates\/(\d+)\/decision$/)[1];
      return this.mockServer.handleEstimateDecision(id, body, user);
    }

    // Warehouse & Stock
    if (path === '/warehouse/parts' && method === 'POST') return this.mockServer.handleUpsertPart(body, user);
    if (path === '/warehouse/issue' && method === 'POST') return this.mockServer.handleIssuePart(body, user);
    if (path === '/warehouse/return' && method === 'POST') return this.mockServer.handleReturnPart(body, user);
    if (path === '/warehouse/pos' && method === 'POST') return this.mockServer.handleCreatePO(body, user);
    if (path.match(/^\/warehouse\/pos\/(\d+)\/receive$/) && method === 'POST') {
      const id = path.match(/^\/warehouse\/pos\/(\d+)\/receive$/)[1];
      return this.mockServer.handleReceivePO(id, body, user);
    }
    if (path === '/warehouse/adjust' && method === 'POST') return this.mockServer.handleStockAdjust(body, user);
    if (path === '/warehouse/ledger' && method === 'GET') return this.mockServer.handleGetLedger(query);
    if (path === '/warehouse/low-stock' && method === 'GET') return this.mockServer.handleGetLowStock();

    // QC
    if (path.match(/^\/repairs\/(\d+)\/qc$/) && method === 'POST') {
      const id = path.match(/^\/repairs\/(\d+)\/qc$/)[1];
      return this.mockServer.handleSubmitQC(id, body, user);
    }

    // Invoicing & Payments
    if (path === '/invoices' && method === 'POST') return this.mockServer.handleGenerateInvoice(body, user);
    if (path.match(/^\/invoices\/(\d+)\/pay$/) && method === 'POST') {
      const id = path.match(/^\/invoices\/(\d+)\/pay$/)[1];
      return this.mockServer.handlePayInvoice(id, body, user);
    }

    // Counter Sales
    if (path === '/sales' && method === 'POST') return this.mockServer.handleCreateSaleQuote(body, user);
    if (path.match(/^\/sales\/(\d+)\/confirm$/) && method === 'POST') {
      const id = path.match(/^\/sales\/(\d+)\/confirm$/)[1];
      return this.mockServer.handleConfirmSale(id, user);
    }
    if (path.match(/^\/sales\/(\d+)\/complete$/) && method === 'POST') {
      const id = path.match(/^\/sales\/(\d+)\/complete$/)[1];
      return this.mockServer.handleCompleteSale(id, body, user);
    }

    // Reports
    if (path === '/admin/reports/repair-summary' && method === 'GET') return this.mockServer.handleReportRepairSummary(query);
    if (path === '/admin/reports/inventory-usage' && method === 'GET') return this.mockServer.handleReportInventoryUsage(query);
    if (path === '/admin/reports/revenue' && method === 'GET') return this.mockServer.handleReportRevenue(query);

    // Admin Users & Bays
    if (path === '/admin/users' && method === 'POST') return this.mockServer.handleUpsertUser(body, user);
    if (path.match(/^\/admin\/users\/(\d+)\/deactivate$/) && method === 'POST') {
      const id = path.match(/^\/admin\/users\/(\d+)\/deactivate$/)[1];
      return this.mockServer.handleDeactivateUser(id, user);
    }
    if (path === '/admin/bays' && method === 'GET') return this.mockServer.handleGetBays();

    return { status: 404, body: { error: `Endpoint ${method} ${path} not found in mock server` } };
  }

  // --- High level helper methods ---
  async checkin(payload) { return this.request('POST', '/repairs', payload); }
  async callNext(bayId, mechanicId) { return this.request('POST', '/repairs/queue/call-next', { bayId, mechanicId }); }
  async holdRepair(id, holdReason) { return this.request('POST', `/repairs/${id}/hold`, { holdReason }); }
  async cancelRepair(id, reason) { return this.request('POST', `/repairs/${id}/cancel`, { reason }); }
  async overridePriority(id, priorityReason) { return this.request('POST', `/repairs/${id}/priority-override`, { priorityReason }); }
  async createEstimate(payload) { return this.request('POST', '/estimates', payload); }
  async decideEstimate(id, decision, insuranceDocsReceived) { return this.request('POST', `/estimates/${id}/decision`, { decision, insuranceDocsReceived }); }
  async upsertPart(payload) { return this.request('POST', '/warehouse/parts', payload); }
  async issuePart(requestId) { return this.request('POST', '/warehouse/issue', { requestId }); }
  async returnPart(requestId, qty) { return this.request('POST', '/warehouse/return', { requestId, qty }); }
  async createPO(payload) { return this.request('POST', '/warehouse/pos', payload); }
  async receivePO(poId, lines) { return this.request('POST', `/warehouse/pos/${poId}/receive`, { lines }); }
  async adjustStock(partId, delta, reason) { return this.request('POST', '/warehouse/adjust', { partId, delta, reason }); }
  async getLedger(query) { return this.request('GET', '/warehouse/ledger', null, query); }
  async getLowStock() { return this.request('GET', '/warehouse/low-stock'); }
  async submitQC(repairId, passed) { return this.request('POST', `/repairs/${repairId}/qc`, { passed }); }
  async generateInvoice(repairIdOrSaleId) {
    const payload = typeof repairIdOrSaleId === 'object' ? repairIdOrSaleId : { repairId: repairIdOrSaleId };
    return this.request('POST', '/invoices', payload);
  }
  async payInvoice(id, amount, payerType = 'CUSTOMER', method = 'TRANSFER') {
    return this.request('POST', `/invoices/${id}/pay`, { amount, payerType, method });
  }
  async createSaleQuote(customerId, lines) { return this.request('POST', '/sales', { customerId, lines }); }
  async confirmSale(id) { return this.request('POST', `/sales/${id}/confirm`); }
  async completeSale(id, amountPaid, paymentMethod = 'CASH') { return this.request('POST', `/sales/${id}/complete`, { amountPaid, paymentMethod }); }
  async getReportRepairSummary(query) { return this.request('GET', '/admin/reports/repair-summary', null, query); }
  async getReportInventoryUsage(query) { return this.request('GET', '/admin/reports/inventory-usage', null, query); }
  async getReportRevenue(query) { return this.request('GET', '/admin/reports/revenue', null, query); }
  async upsertUser(payload) { return this.request('POST', '/admin/users', payload); }
  async deactivateUser(id) { return this.request('POST', `/admin/users/${id}/deactivate`); }
  async getBays() { return this.request('GET', '/admin/bays'); }
}
