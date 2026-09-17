import {
  User, Branch, Product, ProductSerial, StockMovement, StockTransfer,
  Sale, Customer, Supplier, RepairTicket, Expense, CashSession, AuditLog, DashboardMetrics
} from '../types.ts';

const TOKEN_KEY = 'omnipos_jwt_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Server request failed with status ${res.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => request<{ user: User }>('/auth/me'),

  // Dashboard
  getDashboard: (params?: { branch_id?: string; range?: string; low_stock_threshold?: number }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    if (params?.range) query.append('range', params.range);
    if (params?.low_stock_threshold !== undefined) query.append('low_stock_threshold', params.low_stock_threshold.toString());
    return request<{
      metrics: DashboardMetrics;
      lowStockItems?: any[];
      lowStockThreshold?: number;
      topProducts: any[];
      salesTrend: any[];
      branchComparison: any[];
      scopedBranchId: string | null;
    }>(`/dashboard?${query.toString()}`);
  },

  // Branches
  getBranches: () => request<{ branches: Branch[] }>('/branches'),
  createBranch: (data: any) =>
    request<{ success: boolean; branchId: string }>('/branches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Products
  getProducts: (params?: { branch_id?: string; search?: string; category_id?: string; product_type?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    if (params?.search) query.append('search', params.search);
    if (params?.category_id) query.append('category_id', params.category_id);
    if (params?.product_type) query.append('product_type', params.product_type);
    return request<{ products: Product[] }>(`/products?${query.toString()}`);
  },
  createProduct: (data: any) =>
    request<{ success: boolean; productId: string }>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteProduct: (id: string) =>
    request<{ success: boolean; message: string }>(`/products/${id}`, {
      method: 'DELETE',
    }),
  getCategories: (branch_id?: string) => request<{ categories: any[] }>(`/categories${branch_id ? `?branch_id=${encodeURIComponent(branch_id)}` : ''}`),
  getBrands: (branch_id?: string) => request<{ brands: any[] }>(`/brands${branch_id ? `?branch_id=${encodeURIComponent(branch_id)}` : ''}`),

  // Serials
  getSerials: (params?: { branch_id?: string; product_id?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    if (params?.product_id) query.append('product_id', params.product_id);
    if (params?.status) query.append('status', params.status);
    return request<{ serials: ProductSerial[] }>(`/serials?${query.toString()}`);
  },
  getSerialHistory: (serialNumber: string) =>
    request<{ serial: any; movements: any[]; repairs: any[] }>(`/serials/history/${encodeURIComponent(serialNumber)}`),

  // Inventory
  getMovements: (params?: { branch_id?: string; product_id?: string; movement_type?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    if (params?.product_id) query.append('product_id', params.product_id);
    if (params?.movement_type) query.append('movement_type', params.movement_type);
    return request<{ movements: StockMovement[] }>(`/inventory/movements?${query.toString()}`);
  },
  recordAdjustment: (data: any) =>
    request<{ success: boolean; current_stock?: number }>('/inventory/adjustments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Transfers
  getTransfers: (branch_id?: string) => request<{ transfers: StockTransfer[] }>(`/transfers${branch_id ? `?branch_id=${encodeURIComponent(branch_id)}` : ''}`),
  createTransfer: (data: any) =>
    request<{ success: boolean; transferId: string; transferNumber: string }>('/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTransferStatus: (id: string, nextStatus: string) =>
    request<{ success: boolean; status: string }>(`/transfers/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ next_status: nextStatus }),
    }),

  // POS
  posCheckout: (data: any) =>
    request<{
      success: boolean;
      saleId: string;
      invoiceNumber: string;
      total: number;
      paidAmount: number;
      balanceDue: number;
    }>('/pos/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Sales
  getSales: (params?: { branch_id?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    if (params?.search) query.append('search', params.search);
    return request<{ sales: Sale[] }>(`/sales?${query.toString()}`);
  },
  getSaleDetails: (id: string) =>
    request<{ sale: Sale; items: any[]; payments: any[] }>(`/sales/${id}`),
  cancelSale: (id: string, reason: string) =>
    request<{ success: boolean; message: string }>(`/sales/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Returns
  getReturns: (branch_id?: string) => request<{ returns: any[] }>(`/returns${branch_id ? `?branch_id=${encodeURIComponent(branch_id)}` : ''}`),
  processReturn: (data: any) =>
    request<{ success: boolean; returnNumber: string }>('/returns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Cash Register & Shifts
  getCurrentSession: () => request<{ session: CashSession | null }>('/cash-register/current'),
  getCashSessions: (params?: { branch_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    return request<{ sessions: any[] }>(`/cash-register/sessions?${query.toString()}`);
  },
  getCashTransactions: (sessionId: string) =>
    request<{ transactions: any[] }>(`/cash-register/transactions?session_id=${encodeURIComponent(sessionId)}`),
  recordCashTransaction: (data: { session_id: string; type: string; amount: number; description?: string }) =>
    request<{ success: boolean; transactionId: string }>('/cash-register/transaction', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  openShift: (opening_amount: number, notes?: string) =>
    request<{ success: boolean; sessionId: string }>('/cash-register/open', {
      method: 'POST',
      body: JSON.stringify({ opening_amount, notes }),
    }),
  closeShift: (session_id: string, closing_amount: number, notes?: string) =>
    request<{ success: boolean; actual: number; expected: number; difference: number }>('/cash-register/close', {
      method: 'POST',
      body: JSON.stringify({ session_id, closing_amount, notes }),
    }),

  // Expenses
  getExpenses: (params?: { branch_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    return request<{ expenses: Expense[] }>(`/expenses?${query.toString()}`);
  },
  createExpense: (data: any) =>
    request<{ success: boolean; expId: string }>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Customers
  getCustomers: (search?: string, branch_id?: string) => {
    const query = new URLSearchParams();
    if (search) query.append('search', search);
    if (branch_id) query.append('branch_id', branch_id);
    return request<{ customers: Customer[] }>(`/customers?${query.toString()}`);
  },
  createCustomer: (data: any) =>
    request<{ success: boolean; custId: string; customer?: Customer }>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCustomerLedger: (id: string) =>
    request<{ customer: Customer; invoices: any[]; payments: any[] }>(`/customers/${id}/ledger`),
  recordCustomerPayment: (id: string, data: any) =>
    request<{ success: boolean }>(`/customers/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Suppliers
  getSuppliers: (branch_id?: string) => request<{ suppliers: Supplier[] }>(`/suppliers${branch_id ? `?branch_id=${encodeURIComponent(branch_id)}` : ''}`),
  createSupplier: (data: any) =>
    request<{ success: boolean; supId: string }>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPurchases: (params?: { branch_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    return request<{ purchases: any[] }>(`/purchases?${query.toString()}`);
  },
  createPurchase: (data: any) =>
    request<{ success: boolean; purchaseId: string }>('/purchases', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Repairs
  getRepairs: (params?: { branch_id?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    if (params?.status) query.append('status', params.status);
    return request<{ repairs: RepairTicket[] }>(`/repairs?${query.toString()}`);
  },
  createRepair: (data: any) =>
    request<{ success: boolean; repairId: string; ticketNumber: string }>('/repairs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRepair: (id: string, data: any) =>
    request<{ success: boolean }>(`/repairs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Audit Logs
  getAuditLogs: (branch_id?: string) => request<{ auditLogs: AuditLog[] }>(`/audit-logs${branch_id ? `?branch_id=${encodeURIComponent(branch_id)}` : ''}`),

  // Staff Users
  getUsers: (branch_id?: string) => request<{ users: any[] }>(`/users${branch_id ? `?branch_id=${encodeURIComponent(branch_id)}` : ''}`),
  createUser: (data: any) =>
    request<{ success: boolean; userId: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Super Admin Tenants
  getTenants: () => request<{ tenants: any[] }>('/tenants'),

  // Trade-ins & Buy-Back
  getTradeIns: (params?: { branch_id?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    if (params?.status) query.append('status', params.status);
    return request<{ tradeIns: any[] }>(`/trade-ins?${query.toString()}`);
  },
  createTradeIn: (data: any) =>
    request<{ success: boolean; tradeId: string; tradeNumber: string }>('/trade-ins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTradeIn: (id: string, data: any) =>
    request<{ success: boolean }>(`/trade-ins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  convertTradeInToProduct: (id: string, data: any) =>
    request<{ success: boolean; productId: string; sku: string }>(`/trade-ins/${id}/convert-to-product`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Staff Targets & Performance Commissions
  getStaffTargets: (month_period?: string) => {
    const query = new URLSearchParams();
    if (month_period) query.append('month_period', month_period);
    return request<{ targets: any[]; month_period: string }>(`/staff-targets?${query.toString()}`);
  },
  saveStaffTarget: (data: any) =>
    request<{ success: boolean }>('/staff-targets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getStaffPerformance: (month_period?: string) => {
    const query = new URLSearchParams();
    if (month_period) query.append('month_period', month_period);
    return request<{ performance: any[]; month_period: string }>(`/staff-performance?${query.toString()}`);
  },

  // Auto Reorder & PO Management
  getAutoReorderSuggestions: (params?: { branch_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.branch_id) query.append('branch_id', params.branch_id);
    return request<{ suggestions: any[]; suppliers: any[] }>(`/auto-reorder/suggestions?${query.toString()}`);
  },
  updatePurchaseOrderStatus: (id: string, data: { po_status?: string; expected_delivery_date?: string; receive_all_stock?: boolean }) =>
    request<{ success: boolean }>(`/purchases/${id}/po-status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Live Repair Tracker
  trackRepairTicket: (ticketNumber: string) =>
    request<{ ticket: any }>(`/repairs/track/${encodeURIComponent(ticketNumber)}`),

  // Promotions & Coupons
  getPromotions: (status?: string) => {
    const query = new URLSearchParams();
    if (status) query.append('status', status);
    return request<{ promotions: any[] }>(`/promotions?${query.toString()}`);
  },
  createPromotion: (data: any) =>
    request<{ success: boolean; message: string; id: string }>('/promotions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePromotion: (id: string, data: any) =>
    request<{ success: boolean; message: string }>(`/promotions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePromotion: (id: string) =>
    request<{ success: boolean; message: string }>(`/promotions/${id}`, {
      method: 'DELETE',
    }),
  validatePromotion: (data: { code: string; subtotal: number }) =>
    request<{
      valid: boolean;
      promotion: any;
      discount_amount: number;
      final_subtotal: number;
      message: string;
    }>('/promotions/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};


