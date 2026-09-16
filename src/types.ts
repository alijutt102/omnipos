export type UserRole =
  | 'SUPER_ADMIN'
  | 'TENANT_OWNER'
  | 'ADMIN'
  | 'BRANCH_MANAGER'
  | 'CASHIER'
  | 'INVENTORY_MANAGER'
  | 'ACCOUNTANT'
  | 'TECHNICIAN'
  | 'AUDITOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role_name: UserRole;
  organization_id: string;
  organization_name: string;
  currency: string;
  branch_id: string | null;
  branch_name: string | null;
  branch_code: string | null;
  phone?: string;
  status?: string;
}

export interface Organization {
  id: string;
  name: string;
  business_name: string;
  logo?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  currency: string;
  timezone?: string;
  tax_number?: string;
  status?: string;
}

export interface Branch {
  id: string;
  organization_id: string;
  branch_name: string;
  branch_code: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  manager_name?: string;
  opening_cash: number;
  status: string;
  staff_count?: number;
  created_at?: string;
}

export interface Product {
  id: string;
  organization_id: string;
  sku: string;
  barcode?: string;
  product_name: string;
  category_id?: string;
  category_name?: string;
  brand_id?: string;
  brand_name?: string;
  model?: string;
  description?: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  wholesale_price?: number;
  minimum_selling_price?: number;
  tax_rate: number;
  warranty_period: number;
  reorder_level: number;
  product_type: string;
  serial_tracking_enabled: boolean;
  barcode_tracking_enabled?: boolean;
  active_status: boolean;
  current_stock: number;
  created_at?: string;
}

export interface ProductSerial {
  id: string;
  serial_number: string;
  product_id: string;
  product_name: string;
  sku: string;
  product_type: string;
  branch_name: string;
  branch_code: string;
  status: 'In Stock' | 'Sold' | 'Reserved' | 'Transferred' | 'Under Repair' | 'Returned' | 'Warranty Claim' | 'Damaged' | 'Lost';
  current_location?: string;
  purchase_date?: string;
  supplier_name?: string;
  selling_price?: number;
  customer_name?: string;
  warranty_start?: string;
  warranty_end?: string;
  sale_invoice_number?: string;
  created_at?: string;
}

export interface StockMovement {
  id: string;
  quantity: number;
  movement_type: string;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_at: string;
  product_name: string;
  sku: string;
  unit: string;
  branch_name: string;
  branch_code: string;
  staff_name?: string;
  serial_number?: string;
}

export interface StockTransfer {
  id: string;
  transfer_number: string;
  status: 'REQUESTED' | 'APPROVED' | 'DISPATCHED' | 'RECEIVED' | 'COMPLETED' | 'CANCELLED';
  source_branch_name: string;
  source_branch_code: string;
  destination_branch_name: string;
  destination_branch_code: string;
  requested_by_name?: string;
  approved_by_name?: string;
  received_by_name?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  items: {
    id: string;
    product_id: string;
    product_name: string;
    sku: string;
    quantity: number;
    serial_numbers?: string[];
  }[];
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  customer_type: string;
  credit_limit: number;
  opening_balance: number;
  balance: number;
  notes?: string;
  branch_name?: string;
  sales_count?: number;
  total_spent?: number;
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_number?: string;
  payment_terms?: string;
  opening_balance: number;
  balance: number;
  notes?: string;
  purchases_count?: number;
  total_purchased?: number;
  created_at?: string;
}

export interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  cost_price?: number;
  discount: number;
  tax: number;
  total_price: number;
  serial_numbers?: string[];
  warranty_period?: number;
}

export interface SalePayment {
  id: string;
  payment_method: string;
  amount: number;
  reference_number?: string;
  transaction_date?: string;
}

export interface Sale {
  id: string;
  invoice_number: string;
  sale_date: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  balance_due: number;
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID';
  sale_status: 'COMPLETED' | 'CANCELLED';
  branch_name: string;
  branch_code: string;
  branch_phone?: string;
  branch_address?: string;
  cashier_name?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  notes?: string;
  business_name?: string;
  currency?: string;
  org_tax_number?: string;
}

export interface RepairTicket {
  id: string;
  ticket_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  branch_name: string;
  branch_code: string;
  device: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  problem_description: string;
  received_date: string;
  estimated_completion?: string;
  technician_name?: string;
  technician_id?: string;
  diagnosis?: string;
  repair_notes?: string;
  parts_cost: number;
  labor_cost: number;
  customer_cost: number;
  warranty_days: number;
  status: 'RECEIVED' | 'DIAGNOSING' | 'WAITING_FOR_APPROVAL' | 'WAITING_FOR_PARTS' | 'REPAIRING' | 'READY' | 'DELIVERED' | 'CANCELLED';
}

export interface Expense {
  id: string;
  branch_id: string;
  branch_name: string;
  branch_code: string;
  category: string;
  amount: number;
  payment_method: string;
  expense_date: string;
  description?: string;
  created_by_name?: string;
  created_at?: string;
}

export interface CashSession {
  id: string;
  register_name: string;
  cashier_name: string;
  opening_amount: number;
  closing_amount?: number;
  expected_amount?: number;
  difference?: number;
  cash_sales?: number;
  cash_expenses?: number;
  calculated_expected?: number;
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  closed_at?: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  user_name?: string;
  action: string;
  entity: string;
  entity_id?: string;
  old_value?: string;
  new_value?: string;
  branch_name?: string;
  branch_code?: string;
  created_at: string;
}

export interface DashboardMetrics {
  totalSales: number;
  totalCogs: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  salesCount: number;
  totalReceivables: number;
  totalPurchases: number;
  totalPayables: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface TradeIn {
  id: string;
  organization_id: string;
  branch_id: string;
  branch_name?: string;
  branch_code?: string;
  trade_number: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  customer_id_number?: string;
  linked_customer_name?: string;
  linked_customer_phone?: string;
  customer_store_credit?: number;
  device_type: string;
  brand?: string;
  model?: string;
  serial_number_imei?: string;
  specs?: string;
  condition_grade: 'A' | 'B' | 'C' | 'D';
  checklist?: Record<string, boolean>;
  valuation_amount: number;
  resell_estimate: number;
  payout_type: 'STORE_CREDIT' | 'CASH';
  status: 'RECEIVED' | 'INSPECTING' | 'APPROVED' | 'REFURBISHING' | 'READY_FOR_SALE' | 'REJECTED' | 'PAID_OUT';
  refurbished_product_id?: string;
  refurbished_product_name?: string;
  refurbished_product_sku?: string;
  technician_id?: string;
  technician_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StaffTarget {
  id: string;
  user_id: string;
  staff_name?: string;
  staff_email?: string;
  staff_role?: string;
  branch_id?: string;
  branch_name?: string;
  branch_code?: string;
  month_period: string;
  sales_target: number;
  sales_commission_rate: number;
  repair_commission_rate: number;
  notes?: string;
  created_at?: string;
}

export interface StaffPerformance {
  user_id: string;
  name: string;
  email: string;
  role: string;
  branch_name?: string;
  branch_code?: string;
  month_period: string;
  sales_target: number;
  sales_commission_rate: number;
  repair_commission_rate: number;
  sales_count: number;
  actual_sales: number;
  sales_commission: number;
  repair_count: number;
  repair_revenue: number;
  labor_revenue: number;
  repair_commission: number;
  total_commission: number;
  progress_percent: number;
}

export interface AutoReorderSuggestion {
  product_id: string;
  sku: string;
  barcode?: string;
  product_name: string;
  category_name?: string;
  current_stock: number;
  reorder_level: number;
  suggested_quantity: number;
  unit_price: number;
  estimated_total: number;
  supplier_id?: string;
  supplier_name?: string;
}

export interface Promotion {
  id: string;
  organization_id: string;
  code: string;
  description?: string;
  discount_type: 'PERCENTAGE' | 'FIXED';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number;
  valid_from?: string;
  valid_until?: string;
  usage_limit?: number;
  times_used: number;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  created_at?: string;
}

