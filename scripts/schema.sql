-- ==========================================================
-- Retail POS & Inventory Management System
-- Complete PostgreSQL Database Schema & Initial Data
-- ==========================================================

-- 1. Organizations (Multi-tenant isolation)
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  logo TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'US',
  currency TEXT DEFAULT '$',
  timezone TEXT DEFAULT 'UTC',
  tax_number TEXT,
  invoice_settings JSONB DEFAULT '{"prefix":"INV","footerText":"Thank you for your business!","terms":"30 days return on unopened items.","showWarranty":true}'::jsonb,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Retail Branches (Store Locations)
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  branch_code TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  manager_name TEXT,
  opening_cash NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 8.25,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, branch_code)
);

-- 3. Roles and Permissions
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Users (Staff & Authentication)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role_name TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, name)
);

-- 6. Brands
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, name)
);

-- 7. Products (Catalog & SKU)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  barcode TEXT,
  product_name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  model TEXT,
  description TEXT,
  unit TEXT DEFAULT 'pcs',
  purchase_price NUMERIC DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  wholesale_price NUMERIC DEFAULT 0,
  minimum_selling_price NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  warranty_period INT DEFAULT 0,
  reorder_level INT DEFAULT 5,
  product_type TEXT DEFAULT 'Other Accessories',
  serial_tracking_enabled BOOLEAN DEFAULT false,
  barcode_tracking_enabled BOOLEAN DEFAULT true,
  image TEXT,
  active_status BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, sku)
);

-- 8. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  payment_terms TEXT DEFAULT 'Net 30',
  opening_balance NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  customer_type TEXT DEFAULT 'RETAIL',
  credit_limit NUMERIC DEFAULT 0,
  opening_balance NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  store_credit NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. Purchases (Supplier Purchase Orders)
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  purchase_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  subtotal NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'PAID',
  po_status TEXT DEFAULT 'ORDERED',
  expected_delivery_date TIMESTAMPTZ,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL
);

-- 12. Product Serials (Individual Unit Tracking)
CREATE TABLE IF NOT EXISTS product_serials (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  serial_number TEXT NOT NULL,
  purchase_id TEXT REFERENCES purchases(id) ON DELETE SET NULL,
  purchase_date TIMESTAMPTZ,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  selling_price NUMERIC,
  sale_id TEXT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  warranty_start TIMESTAMPTZ,
  warranty_end TIMESTAMPTZ,
  status TEXT DEFAULT 'In Stock',
  current_location TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, product_id, serial_number)
);

-- 13. Stock Movements (Audit Ledger)
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  serial_id TEXT REFERENCES product_serials(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL,
  movement_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. Stock Transfers (Inter-Branch Transfers)
CREATE TABLE IF NOT EXISTS stock_transfers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  source_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  destination_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status TEXT DEFAULT 'REQUESTED',
  requested_by TEXT REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  dispatched_by TEXT REFERENCES users(id),
  received_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. Stock Transfer Items
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id TEXT PRIMARY KEY,
  transfer_id TEXT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  serial_numbers TEXT[] DEFAULT '{}'
);

-- 16. Sales (POS Invoices & Bills)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  sale_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  subtotal NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'PAID',
  sale_status TEXT DEFAULT 'COMPLETED',
  return_status TEXT DEFAULT 'NONE',
  cashier_id TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, invoice_number)
);

-- 17. Sale Items (Line items on bill)
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  cost_price NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total_price NUMERIC NOT NULL,
  serial_numbers TEXT[] DEFAULT '{}'
);

-- 18. Sale Payments
CREATE TABLE IF NOT EXISTS sale_payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  payment_method TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reference_number TEXT,
  transaction_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 19. Sales Returns (RMA)
CREATE TABLE IF NOT EXISTS sales_returns (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  return_number TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  refund_amount NUMERIC NOT NULL,
  refund_method TEXT NOT NULL,
  return_reason TEXT NOT NULL,
  processed_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 20. Sales Return Items
CREATE TABLE IF NOT EXISTS sales_return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
  sale_item_id TEXT REFERENCES sale_items(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  serial_numbers TEXT[] DEFAULT '{}',
  restocked BOOLEAN DEFAULT true
);

-- 21. Cash Registers
CREATE TABLE IF NOT EXISTS cash_registers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  register_name TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 22. Cash Sessions (Register Shifts)
CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  register_id TEXT NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  opening_amount NUMERIC NOT NULL DEFAULT 0,
  closing_amount NUMERIC,
  expected_amount NUMERIC,
  difference NUMERIC,
  status TEXT DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMPTZ,
  notes TEXT
);

-- 23. Cash Transactions (Petty Cash Movements)
CREATE TABLE IF NOT EXISTS cash_transactions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  session_id TEXT REFERENCES cash_sessions(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 24. Expenses (Store Operational Costs)
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'Cash',
  expense_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 25. Repairs & Service Tickets
CREATE TABLE IF NOT EXISTS repairs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  ticket_number TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  device TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  problem_description TEXT NOT NULL,
  received_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  estimated_completion TIMESTAMPTZ,
  technician_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  diagnosis TEXT,
  repair_notes TEXT,
  parts_cost NUMERIC DEFAULT 0,
  labor_cost NUMERIC DEFAULT 0,
  customer_cost NUMERIC DEFAULT 0,
  warranty_days INT DEFAULT 30,
  status TEXT DEFAULT 'RECEIVED',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, ticket_number)
);

-- 26. Repair Parts Used
CREATE TABLE IF NOT EXISTS repair_parts (
  id TEXT PRIMARY KEY,
  repair_id TEXT NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  part_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  cost NUMERIC DEFAULT 0,
  price NUMERIC DEFAULT 0
);

-- 27. Customer Payments (Account Receivables)
CREATE TABLE IF NOT EXISTS customer_payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  reference_number TEXT,
  notes TEXT,
  payment_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 28. Supplier Payments (Account Payables)
CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_id TEXT REFERENCES purchases(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  reference_number TEXT,
  notes TEXT,
  payment_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 29. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 30. Trade-ins & Buy-Backs
CREATE TABLE IF NOT EXISTS trade_ins (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  trade_number TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_id_number TEXT,
  device_type TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number_imei TEXT,
  specs TEXT,
  condition_grade TEXT DEFAULT 'B',
  checklist JSONB DEFAULT '{}'::jsonb,
  valuation_amount NUMERIC DEFAULT 0,
  resell_estimate NUMERIC DEFAULT 0,
  payout_type TEXT DEFAULT 'STORE_CREDIT',
  status TEXT DEFAULT 'RECEIVED',
  refurbished_product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  technician_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 31. Staff Sales Targets & Commissions
CREATE TABLE IF NOT EXISTS staff_targets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_period TEXT NOT NULL,
  sales_target NUMERIC DEFAULT 10000,
  sales_commission_rate NUMERIC DEFAULT 2,
  repair_commission_rate NUMERIC DEFAULT 15,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, user_id, month_period)
);

-- 32. Promotions & Discount Vouchers
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'PERCENTAGE',
  discount_value NUMERIC NOT NULL DEFAULT 10,
  min_order_amount NUMERIC NOT NULL DEFAULT 0,
  max_discount_amount NUMERIC,
  valid_from TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMPTZ,
  usage_limit INT,
  times_used INT DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, code)
);

-- ==========================================================
-- Performance Indexes
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_org_sku ON products(organization_id, sku);
CREATE INDEX IF NOT EXISTS idx_serials_search ON product_serials(organization_id, serial_number);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod_branch ON stock_movements(organization_id, branch_id, product_id);
CREATE INDEX IF NOT EXISTS idx_sales_org_branch ON sales(organization_id, branch_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_purchases_org_branch ON purchases(organization_id, branch_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_repairs_org_branch ON repairs(organization_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_tradeins_org_branch ON trade_ins(organization_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_promotions_org_code ON promotions(organization_id, code);

-- ==========================================================
-- Starter Seed Data
-- ==========================================================
INSERT INTO organizations (id, name, business_name, logo, phone, email, address, city, country, currency, timezone, tax_number)
VALUES ('org-tenant-a-compstore', 'Computer Universe', 'Computer Universe LLC', '/logo-tech.png', '+1 (555) 482-9011', 'contact@computeruniverse.io', '742 Tech Boulevard', 'San Jose', 'United States', '$', 'America/Los_Angeles', 'US-TAX-8829104')
ON CONFLICT (id) DO NOTHING;

INSERT INTO branches (id, organization_id, branch_name, branch_code, phone, email, address, city, manager_name, opening_cash, tax_rate)
VALUES 
('br-main-branch-01', 'org-tenant-a-compstore', 'Main Flagship (Downtown)', 'BR01', '+1 555-482-9012', 'main@computeruniverse.io', '742 Tech Blvd', 'San Jose', 'Robert Sterling', 500, 8.25),
('br-second-branch-02', 'org-tenant-a-compstore', 'Westside Mall Store', 'BR02', '+1 555-482-9015', 'mall@computeruniverse.io', '2100 Valley Fair Mall', 'Santa Clara', 'Elena Rostova', 300, 8.25)
ON CONFLICT (id) DO NOTHING;

-- Seed Users: password for all is: password123 (bcrypt: $2a$10$wY60J1fG25Z.mPqj861vfe4jT/K6KjK8n3qLpM7vI0/L6E4v3eGZ.)
INSERT INTO users (id, organization_id, branch_id, name, email, password_hash, role_name, phone)
VALUES
('usr-superadmin', 'org-tenant-a-compstore', NULL, 'Super Admin', 'superadmin@pos.com', '$2a$10$iKq1Kq1Kq1Kq1Kq1Kq1KquV2cE5.s3sQfUjHkQ3H4cI5eG6g7eK2K', 'SUPER_ADMIN', '+1 555-0001'),
('usr-admin-comp', 'org-tenant-a-compstore', NULL, 'System Admin', 'admin@computeruniverse.io', '$2a$10$iKq1Kq1Kq1Kq1Kq1Kq1KquV2cE5.s3sQfUjHkQ3H4cI5eG6g7eK2K', 'SUPER_ADMIN', '+1 555-0000'),
('usr-owner-a', 'org-tenant-a-compstore', NULL, 'David Vance (Owner)', 'owner@mycomputerstore.com', '$2a$10$iKq1Kq1Kq1Kq1Kq1Kq1KquV2cE5.s3sQfUjHkQ3H4cI5eG6g7eK2K', 'TENANT_OWNER', '+1 555-0002'),
('usr-mgr-a1', 'org-tenant-a-compstore', 'br-main-branch-01', 'Robert Sterling (Store Mgr)', 'manager@mainbranch.com', '$2a$10$iKq1Kq1Kq1Kq1Kq1Kq1KquV2cE5.s3sQfUjHkQ3H4cI5eG6g7eK2K', 'BRANCH_MANAGER', '+1 555-0003'),
('usr-cashier-a1', 'org-tenant-a-compstore', 'br-main-branch-01', 'Sarah Connor (Cashier)', 'cashier1@mainbranch.com', '$2a$10$iKq1Kq1Kq1Kq1Kq1Kq1KquV2cE5.s3sQfUjHkQ3H4cI5eG6g7eK2K', 'CASHIER', '+1 555-0004'),
('usr-tech-a', 'org-tenant-a-compstore', 'br-main-branch-01', 'Tony Stark (Technician)', 'technician@mainbranch.com', '$2a$10$iKq1Kq1Kq1Kq1Kq1Kq1KquV2cE5.s3sQfUjHkQ3H4cI5eG6g7eK2K', 'TECHNICIAN', '+1 555-0008'),
('usr-inv-a', 'org-tenant-a-compstore', NULL, 'Harvey Dent (Inventory Mgr)', 'inventory@mycomputerstore.com', '$2a$10$iKq1Kq1Kq1Kq1Kq1Kq1KquV2cE5.s3sQfUjHkQ3H4cI5eG6g7eK2K', 'INVENTORY_MANAGER', '+1 555-0006')
ON CONFLICT (id) DO NOTHING;

-- Seed Promotions
INSERT INTO promotions (id, organization_id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, status)
VALUES
('promo-gaming10', 'org-tenant-a-compstore', 'GAMING10', '10% off high-end gaming hardware & rigs (Min $100)', 'PERCENTAGE', 10, 100, 150, 100, 'ACTIVE'),
('promo-save50', 'org-tenant-a-compstore', 'SAVE50', '$50 instant discount on orders over $500', 'FIXED', 50, 500, 50, 50, 'ACTIVE'),
('promo-student5', 'org-tenant-a-compstore', 'STUDENT5', '5% student discount on accessories and peripherals', 'PERCENTAGE', 5, 20, 40, 200, 'ACTIVE'),
('promo-welcome20', 'org-tenant-a-compstore', 'WELCOME20', '$20 voucher for first-time workstation purchases (Min $200)', 'FIXED', 20, 200, 20, 50, 'ACTIVE')
ON CONFLICT (organization_id, code) DO NOTHING;
