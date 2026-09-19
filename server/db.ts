import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

export interface QueryResult<T = any> {
  rows: T[];
  rowCount?: number;
}

export interface DbClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
}

let pgliteInstance: PGlite | null = null;
let pgPoolInstance: pg.Pool | null = null;
let pgliteInitPromise: Promise<PGlite> | null = null;

function ensurePostgresDirs(dataDir: string) {
  const dirs = [
    dataDir,
    path.join(dataDir, 'pg_notify'),
    path.join(dataDir, 'pg_tblspc'),
    path.join(dataDir, 'pg_twophase'),
    path.join(dataDir, 'pg_snapshots'),
    path.join(dataDir, 'pg_stat'),
    path.join(dataDir, 'pg_stat_tmp'),
    path.join(dataDir, 'pg_commit_ts'),
    path.join(dataDir, 'pg_replslot'),
    path.join(dataDir, 'pg_serial'),
    path.join(dataDir, 'pg_subtrans'),
    path.join(dataDir, 'pg_wal', 'archive_status'),
    path.join(dataDir, 'pg_wal', 'summaries'),
    path.join(dataDir, 'pg_logical', 'snapshots'),
    path.join(dataDir, 'pg_logical', 'mappings'),
  ];
  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      try {
        fs.mkdirSync(d, { recursive: true });
      } catch {
        // ignore
      }
    }
  }
}

function cleanPidFile(dataDir: string) {
  const pidFile = path.join(dataDir, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
    } catch {
      // ignore
    }
  }
}

async function initPGlite(): Promise<PGlite> {
  const dataDir = path.join(process.cwd(), 'data', 'postgres');
  
  try {
    ensurePostgresDirs(dataDir);
    cleanPidFile(dataDir);
    
    const instance = new PGlite(dataDir);
    await instance.waitReady;
    return instance;
  } catch (err: any) {
    console.warn('Initial PGlite disk startup failed:', err?.message || err);
    console.log('Attempting clean reset of data directory...');

    // If corrupted or failed to resume, clean up and re-initialize
    try {
      if (fs.existsSync(dataDir)) {
        try {
          fs.rmSync(dataDir, { recursive: true, force: true });
        } catch {
          // If rmSync fails, try moving
          const backupDir = path.join(process.cwd(), 'data', `postgres_backup_${Date.now()}`);
          try { fs.renameSync(dataDir, backupDir); } catch {}
        }
      }
      ensurePostgresDirs(dataDir);
      cleanPidFile(dataDir);

      const freshInstance = new PGlite(dataDir);
      await freshInstance.waitReady;
      return freshInstance;
    } catch (resetErr: any) {
      console.error('Disk reset failed, falling back to in-memory PGlite engine:', resetErr?.message || resetErr);
      const memInstance = new PGlite();
      await memInstance.waitReady;
      return memInstance;
    }
  }
}

export async function getDb(): Promise<DbClient> {
  if (process.env.DATABASE_URL) {
    if (!pgPoolInstance) {
      const isLocalHost =
        process.env.DATABASE_URL.includes('localhost') ||
        process.env.DATABASE_URL.includes('127.0.0.1') ||
        process.env.DATABASE_URL.includes('sslmode=disable');

      pgPoolInstance = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isLocalHost ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
        connectionTimeoutMillis: 10000,
      });

      pgPoolInstance.on('error', (err) => {
        console.error('Unexpected error on idle PostgreSQL client pool:', err);
      });

      console.log(`[Database] Connecting to PostgreSQL instance: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
    }
    return {
      query: async <T = any>(text: string, params?: any[]): Promise<QueryResult<T>> => {
        const res = await pgPoolInstance!.query(text, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
      },
    };
  }

  if (process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start') {
    throw new Error('DATABASE_URL is required in production. Attach a Railway PostgreSQL service and expose its DATABASE_URL variable.');
  }

  if (!pgliteInstance) {
    if (!pgliteInitPromise) {
      pgliteInitPromise = initPGlite().then(async (inst) => {
        pgliteInstance = inst;
        return inst;
      }).finally(() => {
        pgliteInitPromise = null;
      });
    }
    await pgliteInitPromise;
  }

  return {
    query: async <T = any>(text: string, params?: any[]): Promise<QueryResult<T>> => {
      try {
        if (!pgliteInstance) {
          pgliteInstance = await initPGlite();
        }
        const res = await pgliteInstance.query(text, params);
        return { rows: (res.rows || []) as T[], rowCount: res.rows?.length || 0 };
      } catch (err: any) {
        if (err?.message?.includes('Aborted') || err?.name === 'RuntimeError' || err?.message?.includes('failed to initialize')) {
          console.warn('PGlite query error encountered. Re-establishing instance...');
          try {
            pgliteInstance = await initPGlite();
            const res = await pgliteInstance.query(text, params);
            return { rows: (res.rows || []) as T[], rowCount: res.rows?.length || 0 };
          } catch (retryErr) {
            throw retryErr;
          }
        }
        throw err;
      }
    },
  };
}

export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const db = await getDb();
  return db.query<T>(text, params);
}

export async function transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
  const db = await getDb();
  if (pgPoolInstance) {
    const client = await pgPoolInstance.connect();
    try {
      await client.query('BEGIN');
      const wrapper: DbClient = {
        query: async <R = any>(text: string, params?: any[]) => {
          const res = await client.query(text, params);
          return { rows: res.rows as R[], rowCount: res.rowCount ?? 0 };
        },
      };
      const result = await callback(wrapper);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // PGlite transaction
  if (pgliteInstance) {
    return await pgliteInstance.transaction(async (tx) => {
      const wrapper: DbClient = {
        query: async <R = any>(text: string, params?: any[]) => {
          const res = await tx.query(text, params);
          return { rows: (res.rows || []) as R[], rowCount: res.rows?.length || 0 };
        },
      };
      return await callback(wrapper);
    });
  }

  return await callback(db);
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDb();

  // 1. Organizations
  await db.query(`
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
  `);

  // 2. Branches
  await db.query(`
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
      status TEXT DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, branch_code)
    );
  `);

  // 3. Roles and Permissions
  await db.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT false,
      permissions TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Users
  await db.query(`
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
  `);

  // 5. Categories
  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, name)
    );
  `);

  // 6. Brands
  await db.query(`
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, name)
    );
  `);

  // 7. Products
  await db.query(`
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
  `);

  // 8. Suppliers
  await db.query(`
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
  `);

  // 9. Customers
  await db.query(`
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
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 10. Purchases
  await db.query(`
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
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 11. Purchase Items
  await db.query(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity NUMERIC NOT NULL,
      unit_price NUMERIC NOT NULL,
      total_price NUMERIC NOT NULL
    );
  `);

  // 12. Product Serials
  await db.query(`
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
  `);

  // 13. Stock Movements
  await db.query(`
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
  `);

  // 14. Stock Transfers
  await db.query(`
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
  `);

  // 15. Stock Transfer Items
  await db.query(`
    CREATE TABLE IF NOT EXISTS stock_transfer_items (
      id TEXT PRIMARY KEY,
      transfer_id TEXT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      quantity NUMERIC NOT NULL,
      serial_numbers TEXT[] DEFAULT '{}'
    );
  `);

  // 16. Sales
  await db.query(`
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
  `);

  // 17. Sale Items
  await db.query(`
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
  `);

  // 18. Sale Payments
  await db.query(`
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
  `);

  // 19. Sales Returns
  await db.query(`
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
  `);

  // 20. Sales Return Items
  await db.query(`
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
  `);

  // 21. Cash Registers
  await db.query(`
    CREATE TABLE IF NOT EXISTS cash_registers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
      register_name TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 22. Cash Sessions (Shifts)
  await db.query(`
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
  `);

  // 23. Cash Transactions
  await db.query(`
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
  `);

  // 24. Expenses
  await db.query(`
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
  `);

  // 25. Repairs & Service Tickets
  await db.query(`
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
  `);

  // 26. Repair Parts Used
  await db.query(`
    CREATE TABLE IF NOT EXISTS repair_parts (
      id TEXT PRIMARY KEY,
      repair_id TEXT NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      part_name TEXT NOT NULL,
      quantity NUMERIC NOT NULL,
      cost NUMERIC DEFAULT 0,
      price NUMERIC DEFAULT 0
    );
  `);

  // 27. Customer Payments (Direct account payments/settlements)
  await db.query(`
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
  `);

  // 28. Supplier Payments (Settling outstanding payables)
  await db.query(`
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
  `);

  // 29. Audit Logs
  await db.query(`
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
  `);

  // 30. Trade-ins & Buy-Backs
  await db.query(`
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
  `);

  // 31. Staff Sales Targets & Technician Commissions
  await db.query(`
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
  `);

  // 32. Promotions & Discount Vouchers
  await db.query(`
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
  `);

  // Schema alterations for existing tables
  try {
    await db.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS store_credit NUMERIC DEFAULT 0;`);
  } catch {}
  try {
    await db.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS po_status TEXT DEFAULT 'ORDERED';`);
  } catch {}
  try {
    await db.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMPTZ;`);
  } catch {}
  try {
    await db.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS coupon_code TEXT;`);
  } catch {}

  // Indexes for high performance
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);`,
    `CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);`,
    `CREATE INDEX IF NOT EXISTS idx_products_org_sku ON products(organization_id, sku);`,
    `CREATE INDEX IF NOT EXISTS idx_serials_search ON product_serials(organization_id, serial_number);`,
    `CREATE INDEX IF NOT EXISTS idx_stock_movements_prod_branch ON stock_movements(organization_id, branch_id, product_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sales_org_branch ON sales(organization_id, branch_id, sale_date);`,
    `CREATE INDEX IF NOT EXISTS idx_purchases_org_branch ON purchases(organization_id, branch_id, purchase_date);`,
    `CREATE INDEX IF NOT EXISTS idx_repairs_org_branch ON repairs(organization_id, branch_id, status);`,
    `CREATE INDEX IF NOT EXISTS idx_tradeins_org_branch ON trade_ins(organization_id, branch_id, status);`,
    `CREATE INDEX IF NOT EXISTS idx_promotions_org_code ON promotions(organization_id, code);`,
  ];
  for (const idx of indexes) {
    try {
      await db.query(idx);
    } catch {}
  }

  const allowDemoData = process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_DATA === 'true';

  // Only seed demo data when explicitly enabled outside production.
  try {
    const orgCheck = await db.query(`SELECT COUNT(*) as count FROM organizations;`);
    const userCheck = await db.query(`SELECT COUNT(*) as count FROM users;`);
    if (allowDemoData && (parseInt(orgCheck.rows[0]?.count || '0', 10) === 0 || parseInt(userCheck.rows[0]?.count || '0', 10) === 0)) {
      await seedDemoData(db);
    }
  } catch (seedErr) {
    console.warn('Seed check notice:', seedErr);
  }

  if (allowDemoData) {
    try {
      await ensureDefaultUsers(db);
    } catch (usrErr) {
      console.warn('Default users verification notice:', usrErr);
    }
  }

  if (allowDemoData) {
    try {
      await ensurePCBuilderComponents(db);
    } catch (pcbErr) {
      console.warn('PC Builder catalog init notice:', pcbErr);
    }
  }

  if (allowDemoData) {
    try {
      await ensureDefaultPromotions(db);
    } catch (promoErr) {
      console.warn('Default promotions check notice:', promoErr);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    await ensureProductionAdmin(db);
  }
}

async function ensureProductionAdmin(db: DbClient): Promise<void> {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const name = process.env.INITIAL_ADMIN_NAME?.trim() || 'Administrator';
  const organizationName = process.env.INITIAL_ORGANIZATION_NAME?.trim() || 'My Store';

  if (!email || !password) {
    console.warn('Production admin was not created. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD.');
    return;
  }
  if (password.length < 12) {
    throw new Error('INITIAL_ADMIN_PASSWORD must be at least 12 characters long.');
  }

  const orgId = 'org-production';
  const userId = 'usr-production-admin';
  const passwordHash = bcrypt.hashSync(password, 12);

  await db.query(`
    INSERT INTO organizations (id, name, business_name, currency)
    VALUES ($1, $2, $2, '$')
    ON CONFLICT (id) DO NOTHING
  `, [orgId, organizationName]);

  await db.query(`
    INSERT INTO users (id, organization_id, branch_id, name, email, password_hash, role_name, status)
    VALUES ($1, $2, NULL, $3, $4, $5, 'TENANT_OWNER', 'ACTIVE')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, status = 'ACTIVE'
  `, [userId, orgId, name, email, passwordHash]);
}

async function ensurePCBuilderComponents(db: DbClient): Promise<void> {
  try {
    const orgs = await db.query(`SELECT id FROM organizations`);
    for (const org of orgs.rows) {
      const orgId = org.id;

      // Ensure Components category
      let compCatId = 'cat-components';
      const catCheck = await db.query(`SELECT id FROM categories WHERE organization_id = $1 AND (id = $2 OR name = 'Components')`, [orgId, compCatId]);
      if (catCheck.rows.length === 0) {
        await db.query(`INSERT INTO categories (id, organization_id, name, description) VALUES ($1, $2, 'Components', 'CPUs, Motherboards, RAM, GPUs, Cases, PSUs') ON CONFLICT DO NOTHING`, [compCatId, orgId]);
      } else {
        compCatId = catCheck.rows[0].id;
      }

      // Brand checks
      const brandsToAdd = [
        { id: 'brd-amd', name: 'AMD' },
        { id: 'brd-intel', name: 'Intel' },
        { id: 'brd-msi', name: 'MSI' },
        { id: 'brd-nzxt', name: 'NZXT' },
        { id: 'brd-seasonic', name: 'Seasonic' },
        { id: 'brd-lianli', name: 'Lian Li' },
      ];
      for (const b of brandsToAdd) {
        await db.query(`INSERT INTO brands (id, organization_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [b.id, orgId, b.name]);
      }

      // List of PC builder components to ensure
      const pcComponents = [
        {
          id: 'prod-cpu-ryzen-7800x3d',
          sku: 'CPU-AMD-7800X3D',
          barcode: '730143314930',
          name: 'AMD Ryzen 7 7800X3D (8-Core 16-Thread, Up to 5.0GHz)',
          brand: 'brd-amd',
          model: 'Ryzen 7 7800X3D',
          desc: 'Socket AM5, 120W TDP, 96MB 3D V-Cache, Ultimate Gaming Processor',
          type: 'CPU',
          pur: 320,
          sell: 399,
          warranty: 1095,
          serial: true,
          stockBranch1: 8,
        },
        {
          id: 'prod-cpu-intel-14700k',
          sku: 'CPU-INT-14700K',
          barcode: '735858546942',
          name: 'Intel Core i7-14700K (20-Core, Up to 5.6GHz, LGA1700)',
          brand: 'brd-intel',
          model: 'i7-14700K',
          desc: 'Socket LGA1700, 253W Max TDP, 33MB Cache, Intel UHD Graphics 770',
          type: 'CPU',
          pur: 340,
          sell: 419,
          warranty: 1095,
          serial: true,
          stockBranch1: 6,
        },
        {
          id: 'prod-mobo-asus-b650e',
          sku: 'MB-ASUS-B650E-F',
          barcode: '195553945821',
          name: 'ASUS ROG Strix B650E-F Gaming WiFi Motherboard',
          brand: 'brd-asus',
          model: 'ROG Strix B650E-F',
          desc: 'Socket AM5, DDR5, PCIe 5.0, ATX Form Factor, WiFi 6E',
          type: 'Motherboard',
          pur: 210,
          sell: 279,
          warranty: 1095,
          serial: true,
          stockBranch1: 5,
        },
        {
          id: 'prod-mobo-msi-z790',
          sku: 'MB-MSI-Z790-TOMA',
          barcode: '824142301948',
          name: 'MSI MAG Z790 Tomahawk WiFi Motherboard',
          brand: 'brd-msi',
          model: 'MAG Z790 Tomahawk',
          desc: 'Socket LGA1700, DDR5, PCIe 5.0, ATX Form Factor, WiFi 6E',
          type: 'Motherboard',
          pur: 220,
          sell: 289,
          warranty: 1095,
          serial: true,
          stockBranch1: 7,
        },
        {
          id: 'prod-gpu-rtx-4080s',
          sku: 'GPU-RTX-4080S',
          barcode: '835168003425',
          name: 'NVIDIA GeForce RTX 4080 Super 16GB GDDR6X',
          brand: 'brd-nvidia',
          model: 'RTX 4080S Founders',
          desc: '320W TDP, 10240 CUDA Cores, DLSS 3.5, 4K High Refresh Gaming',
          type: 'GPU',
          pur: 820,
          sell: 999,
          warranty: 1095,
          serial: true,
          stockBranch1: 4,
        },
        {
          id: 'prod-psu-corsair-rm850x',
          sku: 'PSU-COR-RM850X',
          barcode: '840006603418',
          name: 'Corsair RM850x 850W 80+ Gold Fully Modular Power Supply',
          brand: 'brd-corsair',
          model: 'CP-9020200-NA',
          desc: '850 Watt, 80 PLUS Gold, Low-noise Magnetic Levitation Fan',
          type: 'Power Supply',
          pur: 105,
          sell: 149,
          warranty: 3650,
          serial: false,
          stockBranch1: 12,
        },
        {
          id: 'prod-case-lianli-o11d',
          sku: 'CASE-LL-O11DEVO',
          barcode: '840353040182',
          name: 'Lian Li O11 Dynamic EVO Mid-Tower Case (Tempered Glass)',
          brand: 'brd-lianli',
          model: 'O11D EVO Black',
          desc: 'ATX / Micro-ATX / Mini-ITX dual chamber design with dual glass panels',
          type: 'Case',
          pur: 125,
          sell: 169,
          warranty: 730,
          serial: false,
          stockBranch1: 9,
        },
        {
          id: 'prod-cooler-aio-360',
          sku: 'CLR-NZXT-KRAKEN360',
          barcode: '810074842918',
          name: 'NZXT Kraken 360 RGB AIO Liquid CPU Cooler',
          brand: 'brd-nzxt',
          model: 'RL-KR360-B1',
          desc: '360mm Radiator, 3x 120mm RGB Core Fans, LCD Display, AM5 & LGA1700 ready',
          type: 'Cooler',
          pur: 165,
          sell: 219,
          warranty: 2190,
          serial: false,
          stockBranch1: 7,
        },
      ];

      // Fetch first branch for initial stock movements
      const brRes = await db.query(`SELECT id FROM branches WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 1`, [orgId]);
      const branchId = brRes.rows[0]?.id;

      for (const comp of pcComponents) {
        const prodCheck = await db.query(`SELECT id FROM products WHERE organization_id = $1 AND (id = $2 OR sku = $3)`, [orgId, comp.id, comp.sku]);
        if (prodCheck.rows.length === 0) {
          await db.query(`
            INSERT INTO products (id, organization_id, sku, barcode, product_name, category_id, brand_id, model, description, unit, purchase_price, selling_price, wholesale_price, minimum_selling_price, tax_rate, warranty_period, reorder_level, product_type, serial_tracking_enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pcs', $10, $11, $12, $13, 8.25, $14, 3, $15, $16)
            ON CONFLICT DO NOTHING
          `, [
            comp.id, orgId, comp.sku, comp.barcode, comp.name, compCatId, comp.brand, comp.model, comp.desc,
            comp.pur, comp.sell, Math.round(comp.sell * 0.9), Math.round(comp.sell * 0.85), comp.warranty, comp.type, comp.serial
          ]);

          if (branchId && comp.stockBranch1 > 0) {
            await db.query(`
              INSERT INTO stock_movements (id, organization_id, branch_id, product_id, quantity, movement_type, reference_type, notes)
              VALUES ($1, $2, $3, $4, $5, 'INITIAL', 'SYSTEM_SEED', 'Stock intake for PC Builder catalog')
            `, [`mov-pcb-${Date.now()}-${Math.random()}`, orgId, branchId, comp.id, comp.stockBranch1]);

            if (comp.serial) {
              for (let i = 1; i <= Math.min(3, comp.stockBranch1); i++) {
                const sn = `SN-${comp.sku.replace(/-/g, '')}-0${i}`;
                await db.query(`
                  INSERT INTO product_serials (id, organization_id, branch_id, product_id, serial_number, status, current_location)
                  VALUES ($1, $2, $3, $4, $5, 'In Stock', 'Display Shelf')
                  ON CONFLICT DO NOTHING
                `, [`ser-${comp.id}-${i}`, orgId, branchId, comp.id, sn]);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('PC Builder components check notice:', err);
  }
}

async function ensureDefaultUsers(db: DbClient): Promise<void> {
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('password123', salt);
  const orgAId = 'org-tenant-a-compstore';
  const branchA1Id = 'br-main-branch-01';

  await db.query(`
    INSERT INTO organizations (id, name, business_name, logo, phone, email, address, city, country, currency, timezone, tax_number)
    VALUES ($1, 'My Computer Store', 'My Computer Store LLC', '/logo-tech.png', '+1 (555) 482-9011', 'contact@mycomputerstore.com', '742 Tech Boulevard, Silicon District', 'San Jose', 'United States', '$', 'America/Los_Angeles', 'US-TAX-8829104')
    ON CONFLICT (id) DO NOTHING;
  `, [orgAId]);

  const defaultUsers = [
    { id: 'usr-superadmin', email: 'superadmin@pos.com', name: 'Super Admin', role: 'SUPER_ADMIN', branch: null },
    { id: 'usr-admin-comp', email: 'admin@computeruniverse.io', name: 'System Admin', role: 'SUPER_ADMIN', branch: null },
    { id: 'usr-owner-a', email: 'owner@mycomputerstore.com', name: 'David Vance (Owner)', role: 'TENANT_OWNER', branch: null },
    { id: 'usr-mgr-a1', email: 'manager@mainbranch.com', name: 'Robert Sterling (Branch Mgr)', role: 'BRANCH_MANAGER', branch: branchA1Id },
    { id: 'usr-cashier-a1', email: 'cashier1@mainbranch.com', name: 'Sarah Connor (Cashier BR01)', role: 'CASHIER', branch: branchA1Id },
    { id: 'usr-cashier-a2', email: 'cashier2@secondbranch.com', name: 'Alex Mercer (Cashier BR02)', role: 'CASHIER', branch: 'br-second-branch-02' },
    { id: 'usr-tech-a', email: 'technician@mainbranch.com', name: 'Tony Stark (Lead Tech)', role: 'TECHNICIAN', branch: branchA1Id },
    { id: 'usr-inv-a', email: 'inventory@mycomputerstore.com', name: 'Harvey Dent (Inventory Mgr)', role: 'INVENTORY_MANAGER', branch: null },
  ];

  for (const u of defaultUsers) {
    await db.query(`
      INSERT INTO users (id, organization_id, branch_id, name, email, password_hash, role_name, phone, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, '+1 555-0000', 'ACTIVE')
      ON CONFLICT (id) DO UPDATE SET password_hash = $6, status = 'ACTIVE';
    `, [u.id, orgAId, u.branch, u.name, u.email, passwordHash, u.role]);
  }
}

async function ensureDefaultPromotions(db: DbClient): Promise<void> {
  const orgAId = 'org-tenant-a-compstore';
  const defaultPromos = [
    {
      id: 'promo-gaming10',
      code: 'GAMING10',
      description: '10% off high-end gaming hardware & rigs (Min $100)',
      discount_type: 'PERCENTAGE',
      discount_value: 10,
      min_order_amount: 100,
      max_discount_amount: 150,
      usage_limit: 100,
      status: 'ACTIVE'
    },
    {
      id: 'promo-save50',
      code: 'SAVE50',
      description: '$50 instant discount on orders over $500',
      discount_type: 'FIXED',
      discount_value: 50,
      min_order_amount: 500,
      max_discount_amount: 50,
      usage_limit: 50,
      status: 'ACTIVE'
    },
    {
      id: 'promo-student5',
      code: 'STUDENT5',
      description: '5% student discount on accessories and peripherals',
      discount_type: 'PERCENTAGE',
      discount_value: 5,
      min_order_amount: 20,
      max_discount_amount: 40,
      usage_limit: 200,
      status: 'ACTIVE'
    },
    {
      id: 'promo-welcome20',
      code: 'WELCOME20',
      description: '$20 voucher for first-time workstation purchases (Min $200)',
      discount_type: 'FIXED',
      discount_value: 20,
      min_order_amount: 200,
      max_discount_amount: 20,
      usage_limit: 50,
      status: 'ACTIVE'
    }
  ];

  for (const p of defaultPromos) {
    await db.query(`
      INSERT INTO promotions (id, organization_id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (organization_id, code) DO NOTHING;
    `, [p.id, orgAId, p.code, p.description, p.discount_type, p.discount_value, p.min_order_amount, p.max_discount_amount, p.usage_limit, p.status]);
  }
}

async function seedDemoData(db: DbClient): Promise<void> {
  console.log('Seeding initial multi-tenant retail ERP demo data...');
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('password123', salt);

  // 1. Tenant A: "My Computer Store"
  const orgAId = 'org-tenant-a-compstore';
  await db.query(`
    INSERT INTO organizations (id, name, business_name, logo, phone, email, address, city, country, currency, timezone, tax_number)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (id) DO NOTHING;
  `, [
    orgAId,
    'My Computer Store',
    'My Computer Store LLC',
    '/logo-tech.png',
    '+1 (555) 482-9011',
    'contact@mycomputerstore.com',
    '742 Tech Boulevard, Silicon District',
    'San Jose',
    'United States',
    '$',
    'America/Los_Angeles',
    'US-TAX-8829104',
  ]);

  // 2. Tenant B: "Apex Hardware Systems" (for multi-tenant isolation testing)
  const orgBId = 'org-tenant-b-apex';
  await db.query(`
    INSERT INTO organizations (id, name, business_name, logo, phone, email, address, city, country, currency, timezone, tax_number)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (id) DO NOTHING;
  `, [
    orgBId,
    'Apex Hardware Systems',
    'Apex Hardware Systems Corp',
    '/logo-apex.png',
    '+1 (555) 919-4400',
    'info@apexhardware.com',
    '120 Industrial Parkway',
    'Austin',
    'United States',
    '$',
    'America/Chicago',
    'US-TAX-3391081',
  ]);

  // Branches for Tenant A
  const branchA1Id = 'br-main-branch-01';
  const branchA2Id = 'br-second-branch-02';
  await db.query(`
    INSERT INTO branches (id, organization_id, branch_name, branch_code, phone, email, address, city, manager_name, opening_cash)
    VALUES
    ($1, $2, 'Main Branch (Downtown)', 'BR01', '+1 555-482-9012', 'main@mycomputerstore.com', '742 Tech Blvd, Suite 100', 'San Jose', 'Robert Sterling', 500),
    ($3, $2, 'Second Branch (Mall Arcade)', 'BR02', '+1 555-482-9015', 'mall@mycomputerstore.com', '2100 Valley Fair Mall, Unit 4B', 'Santa Clara', 'Elena Rostova', 300)
    ON CONFLICT (id) DO NOTHING;
  `, [branchA1Id, orgAId, branchA2Id]);

  // Branch for Tenant B
  const branchB1Id = 'br-apex-north-01';
  await db.query(`
    INSERT INTO branches (id, organization_id, branch_name, branch_code, phone, email, address, city, manager_name, opening_cash)
    VALUES ($1, $2, 'Apex North Hub', 'AP01', '+1 555-919-4401', 'north@apexhardware.com', '120 Industrial Parkway #1', 'Austin', 'Marcus Vance', 400)
    ON CONFLICT (id) DO NOTHING;
  `, [branchB1Id, orgBId]);

  // Users for Tenant A
  await db.query(`
    INSERT INTO users (id, organization_id, branch_id, name, email, password_hash, role_name, phone)
    VALUES
    ('usr-superadmin', $1, NULL, 'Super Admin', 'superadmin@pos.com', $2, 'SUPER_ADMIN', '+1 555-0001'),
    ('usr-admin-comp', $1, NULL, 'System Admin', 'admin@computeruniverse.io', $2, 'SUPER_ADMIN', '+1 555-0000'),
    ('usr-owner-a', $1, NULL, 'David Vance (Owner)', 'owner@mycomputerstore.com', $2, 'TENANT_OWNER', '+1 555-0002'),
    ('usr-mgr-a1', $1, $3, 'Robert Sterling (Branch Mgr)', 'manager@mainbranch.com', $2, 'BRANCH_MANAGER', '+1 555-0003'),
    ('usr-cashier-a1', $1, $3, 'Sarah Connor (Cashier BR01)', 'cashier1@mainbranch.com', $2, 'CASHIER', '+1 555-0004'),
    ('usr-cashier-a2', $1, $4, 'Alex Mercer (Cashier BR02)', 'cashier2@secondbranch.com', $2, 'CASHIER', '+1 555-0005'),
    ('usr-inv-a', $1, NULL, 'Harvey Dent (Inventory Mgr)', 'inventory@mycomputerstore.com', $2, 'INVENTORY_MANAGER', '+1 555-0006'),
    ('usr-acct-a', $1, NULL, 'Laura Croft (Accountant)', 'accountant@mycomputerstore.com', $2, 'ACCOUNTANT', '+1 555-0007'),
    ('usr-tech-a', $1, $3, 'Tony Stark (Lead Tech)', 'technician@mainbranch.com', $2, 'TECHNICIAN', '+1 555-0008'),
    ('usr-aud-a', $1, NULL, 'Gordon Freeman (Auditor)', 'auditor@mycomputerstore.com', $2, 'AUDITOR', '+1 555-0009')
    ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE';
  `, [orgAId, passwordHash, branchA1Id, branchA2Id]);

  // User for Tenant B
  await db.query(`
    INSERT INTO users (id, organization_id, branch_id, name, email, password_hash, role_name, phone)
    VALUES
    ('usr-owner-b', $1, NULL, 'Victor Apex (Owner B)', 'owner@apexhardware.com', $2, 'TENANT_OWNER', '+1 555-9999')
    ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'ACTIVE';
  `, [orgBId, passwordHash]);

  // Cash registers
  await db.query(`
    INSERT INTO cash_registers (id, organization_id, branch_id, register_name, status)
    VALUES
    ('reg-main-1', $1, $2, 'Main Counter Register 1', 'ACTIVE'),
    ('reg-second-1', $1, $3, 'Mall Front Register 1', 'ACTIVE'),
    ('reg-apex-1', $4, $5, 'Apex Register A', 'ACTIVE')
    ON CONFLICT (id) DO NOTHING;
  `, [orgAId, branchA1Id, branchA2Id, orgBId, branchB1Id]);

  // Open cash session for cashier1 at Main Branch
  await db.query(`
    INSERT INTO cash_sessions (id, organization_id, branch_id, register_id, user_id, opening_amount, status, opened_at, notes)
    VALUES ('sess-main-01', $1, $2, 'reg-main-1', 'usr-cashier-a1', 500, 'OPEN', CURRENT_TIMESTAMP, 'Morning opening shift')
    ON CONFLICT (id) DO NOTHING;
  `, [orgAId, branchA1Id]);

  // Categories for Tenant A
  const catLaptop = 'cat-laptop';
  const catDesktop = 'cat-desktop';
  const catMonitor = 'cat-monitor';
  const catComponents = 'cat-components';
  const catPeripherals = 'cat-peripherals';
  const catPrinters = 'cat-printers';
  const catNetworking = 'cat-networking';
  const catCables = 'cat-cables';

  await db.query(`
    INSERT INTO categories (id, organization_id, name, description)
    VALUES
    ($1, $9, 'Laptops', 'Ultrabooks, business notebooks, and high-performance gaming laptops'),
    ($2, $9, 'Desktops', 'Workstations, pre-built gaming rigs, and mini PCs'),
    ($3, $9, 'Monitors', 'High-refresh IPS, OLED, 4K, and ultra-wide displays'),
    ($4, $9, 'Components', 'CPUs, GPUs, Motherboards, RAM, NVMe SSDs, and Power Supplies'),
    ($5, $9, 'Peripherals', 'Keyboards, mice, headsets, webcams, and mousepads'),
    ($6, $9, 'Printers', 'Laser printers, inkjets, multifunction scanners'),
    ($7, $9, 'Networking', 'Routers, access points, gigabit switches, and Wi-Fi adapters'),
    ($8, $9, 'Cables & Accessories', 'HDMI, DisplayPort, USB-C adapters, surge protectors')
    ON CONFLICT (id) DO NOTHING;
  `, [catLaptop, catDesktop, catMonitor, catComponents, catPeripherals, catPrinters, catNetworking, catCables, orgAId]);

  // Brands for Tenant A
  await db.query(`
    INSERT INTO brands (id, organization_id, name)
    VALUES
    ('brd-dell', $1, 'Dell'),
    ('brd-hp', $1, 'HP'),
    ('brd-lenovo', $1, 'Lenovo'),
    ('brd-asus', $1, 'ASUS ROG'),
    ('brd-samsung', $1, 'Samsung'),
    ('brd-logitech', $1, 'Logitech'),
    ('brd-corsair', $1, 'Corsair'),
    ('brd-nvidia', $1, 'NVIDIA'),
    ('brd-tplink', $1, 'TP-Link'),
    ('brd-canon', $1, 'Canon')
    ON CONFLICT (id) DO NOTHING;
  `, [orgAId]);

  // Suppliers for Tenant A
  const sup1 = 'sup-global-tech';
  const sup2 = 'sup-silicon-direct';
  const sup3 = 'sup-pacific-periph';
  await db.query(`
    INSERT INTO suppliers (id, organization_id, name, company, phone, email, address, tax_number, balance)
    VALUES
    ($1, $4, 'Global Tech Distributors', 'Global Tech Logistics Ltd', '+1 800-555-0182', 'orders@globaltech.com', '400 Logistics Way, Fremont CA', 'TAX-GT-1192', 4500),
    ($2, $4, 'Silicon Direct Wholesale', 'Silicon Component Supply Inc', '+1 800-555-0193', 'sales@silicondirect.com', '880 Chipset Ave, Austin TX', 'TAX-SD-9921', 1200),
    ($3, $4, 'Pacific Peripheral Supply', 'Pacific Hardware & Cables', '+1 800-555-0144', 'b2b@pacificperiph.com', '120 Portview Blvd, Seattle WA', 'TAX-PP-4428', 0)
    ON CONFLICT (id) DO NOTHING;
  `, [sup1, sup2, sup3, orgAId]);

  // Customers for Tenant A
  const cust1 = 'cust-cybercore';
  const cust2 = 'cust-john-doe';
  const cust3 = 'cust-apex-studio';
  const cust4 = 'cust-maria-garcia';
  const cust5 = 'cust-walkin-cash';

  await db.query(`
    INSERT INTO customers (id, organization_id, branch_id, name, phone, email, address, city, customer_type, credit_limit, balance)
    VALUES
    ($1, $6, $7, 'CyberCore Solutions (B2B)', '+1 555-443-1234', 'procurement@cybercore.io', '55 Innovation Way', 'San Jose', 'CORPORATE', 15000, 1850),
    ($2, $6, $7, 'John Doe (Regular)', '+1 555-223-9988', 'johndoe@gmail.com', '144 Maple St', 'Santa Clara', 'RETAIL', 1000, 250),
    ($3, $6, $8, 'Apex Media Studio', '+1 555-888-7711', 'studio@apexmedia.design', '88 Creative Lane', 'Santa Clara', 'CORPORATE', 10000, 0),
    ($4, $6, $7, 'Maria Garcia', '+1 555-901-3322', 'm.garcia@outlook.com', '320 Cypress Ave', 'San Jose', 'RETAIL', 500, 0),
    ($5, $6, $7, 'Walk-in Retail Customer', '+1 555-000-0000', 'cashier@pos.local', 'In-Store', 'San Jose', 'WALK_IN', 0, 0)
    ON CONFLICT (id) DO NOTHING;
  `, [cust1, cust2, cust3, cust4, cust5, orgAId, branchA1Id, branchA2Id]);

  // Products
  const pDellXps = 'prod-dell-xps-15';
  const pHpOmen = 'prod-hp-omen-16';
  const pThinkpad = 'prod-thinkpad-t14';
  const pGamingPc = 'prod-gaming-pc-rtx4080';
  const pAsusMonitor = 'prod-asus-rog-27';
  const pSamsungSsd = 'prod-samsung-990-2tb';
  const pKingstonRam = 'prod-kingston-ddr5-32gb';
  const pRtx4070 = 'prod-rtx-4070-super';
  const pMxMaster = 'prod-logitech-mx-master';
  const pCorsairK70 = 'prod-corsair-k70';
  const pCanonPrinter = 'prod-canon-mf445dw';
  const pTpLinkRouter = 'prod-tplink-axe5400';
  const pCat6Cable = 'prod-cat6-10m';
  const pUsbCAdapter = 'prod-usbc-hdmi-adapter';

  await db.query(`
    INSERT INTO products (id, organization_id, sku, barcode, product_name, category_id, brand_id, model, description, unit, purchase_price, selling_price, wholesale_price, minimum_selling_price, tax_rate, warranty_period, reorder_level, product_type, serial_tracking_enabled)
    VALUES
    ($1, $15, 'LAP-DELL-XPS15', '884116390112', 'Dell XPS 15 (Core i9, 32GB RAM, 1TB SSD, RTX 4070)', $16, 'brd-dell', 'XPS 9530', '15.6 inch 3.5K OLED Touch Laptop with Platinum Silver chassis', 'pcs', 1850, 2399, 2150, 2050, 8.25, 365, 3, 'Laptop', true),
    ($2, $15, 'LAP-HP-OMEN16', '196548201994', 'HP Omen 16 Gaming Laptop (Ryzen 7 7840HS, 16GB, RTX 4060)', $16, 'brd-hp', '16-xf0033dx', '16.1 inch QHD 240Hz Gaming Laptop with Shadow Black Finish', 'pcs', 1100, 1499, 1350, 1280, 8.25, 365, 3, 'Laptop', true),
    ($3, $15, 'LAP-LEN-T14', '197529402118', 'Lenovo ThinkPad T14 Gen 4 (Core i7, 16GB, 512GB SSD)', $16, 'brd-lenovo', '21HD000UUS', 'Business Workhorse Laptop with MIL-STD durability and biometric reader', 'pcs', 980, 1299, 1180, 1120, 8.25, 730, 4, 'Laptop', true),
    ($4, $15, 'DSK-PRO-GAMING', '742918402841', 'Custom Rig: Pro Gaming Desktop (i7-14700K, RTX 4080 Super, 32GB)', $17, 'brd-asus', 'RIG-CR-01', 'Liquid cooled high-end gaming station with 850W Gold PSU and Lian Li glass case', 'pcs', 2100, 2799, 2550, 2400, 8.25, 730, 2, 'Desktop', true),
    ($5, $15, 'MON-ASUS-27', '192876543210', 'ASUS ROG Swift 27" 240Hz Fast-IPS Gaming Monitor', $18, 'brd-asus', 'PG27AQDM', 'QHD 2560x1440 0.03ms G-Sync Compatible esports gaming display', 'pcs', 450, 649, 580, 540, 8.25, 365, 3, 'Monitor', true),
    ($6, $15, 'SSD-SAM-990-2TB', '887276701838', 'Samsung 990 PRO 2TB NVMe PCIe 4.0 Internal SSD', $19, 'brd-samsung', 'MZ-V9P2T0B', 'Speeds up to 7450 MB/s read, ideal for workstations and gaming PS5', 'pcs', 120, 179, 155, 145, 8.25, 1825, 10, 'SSD', false),
    ($7, $15, 'RAM-KNG-DDR5-32', '740617329182', 'Kingston Fury Beast 32GB (2x16GB) DDR5 6000MHz CL36', $19, 'brd-corsair', 'KF560C36BBEK2-32', 'High-performance RGB DDR5 memory kit with Intel XMP 3.0 & AMD EXPO', 'pcs', 85, 129, 110, 100, 8.25, 1825, 8, 'RAM', false),
    ($8, $15, 'GPU-RTX-4070S', '835168003418', 'NVIDIA GeForce RTX 4070 Super 12GB GDDR6X', $19, 'brd-nvidia', 'RTX4070S-FE', 'DLSS 3.5, Ada Lovelace architecture, dual-slot compact card', 'pcs', 480, 629, 570, 540, 8.25, 1095, 3, 'GPU', true),
    ($9, $15, 'ACC-LOG-MX3S', '097855174312', 'Logitech MX Master 3S Wireless Performance Mouse', $20, 'brd-logitech', '910-006556', '8K DPI any-surface tracking, quiet clicks, MagSpeed electromagnetic scroll', 'pcs', 65, 99, 85, 80, 8.25, 365, 6, 'Mouse', false),
    ($10, $15, 'ACC-COR-K70', '840006654210', 'Corsair K70 RGB PRO Mechanical Gaming Keyboard', $20, 'brd-corsair', 'CH-9109410-NA', 'Cherry MX Speed switches, 8000Hz polling rate, aluminum frame', 'pcs', 110, 169, 145, 135, 8.25, 730, 4, 'Keyboard', false),
    ($11, $15, 'PRN-CAN-MF445', '013803318921', 'Canon imageCLASS MF445dw All-in-One Laser Printer', $21, 'brd-canon', '3514C005', 'High-speed 40 ppm monochrome laser printer with duplex auto-feed', 'pcs', 260, 379, 330, 310, 8.25, 365, 2, 'Printer', true),
    ($12, $15, 'NET-TPL-AXE5400', '840460105821', 'TP-Link Archer AXE5400 Tri-Band WiFi 6E Router', $22, 'brd-tplink', 'Archer AXE75', 'Gigabit speeds up to 5.4 Gbps with new 6GHz clean frequency band', 'pcs', 130, 199, 175, 160, 8.25, 730, 4, 'Networking Equipment', false),
    ($13, $15, 'CBL-CAT6-10M', '712849021943', 'Cat6 Shielded RJ45 Gigabit Ethernet Cable (10m)', $23, NULL, 'C6-10M-BLU', 'Snagless gold plated connectors, 550MHz bandwidth, pure bare copper', 'pcs', 4.5, 14.99, 9, 8, 8.25, 90, 15, 'Cable', false),
    ($14, $15, 'CBL-USBC-HDMI4K', '712849021950', 'Aluminum USB-C to 4K@60Hz HDMI Adapter Cable (2m)', $23, NULL, 'UCH-4K60', 'Braided high flex cable supporting HDR and HDCP 2.2', 'pcs', 7.5, 24.99, 16, 14, 8.25, 180, 12, 'Adapter', false)
    ON CONFLICT (id) DO NOTHING;
  `, [
    pDellXps, pHpOmen, pThinkpad, pGamingPc, pAsusMonitor, pSamsungSsd, pKingstonRam,
    pRtx4070, pMxMaster, pCorsairK70, pCanonPrinter, pTpLinkRouter, pCat6Cable, pUsbCAdapter,
    orgAId, catLaptop, catDesktop, catMonitor, catComponents, catPeripherals, catPrinters, catNetworking, catCables
  ]);

  // Initial stock movements & Serials for Main Branch (BR01) and Second Branch (BR02)
  // Let's create initial purchases and inventory movements
  const purchA1 = 'pur-init-main-001';
  await db.query(`
    INSERT INTO purchases (id, organization_id, branch_id, supplier_id, invoice_number, purchase_date, subtotal, discount, tax, total, paid_amount, balance_due, payment_status, created_by)
    VALUES ($1, $2, $3, $4, 'INV-SUP-8910', CURRENT_TIMESTAMP - INTERVAL '10 days', 28500, 500, 2310, 30310, 30310, 0, 'PAID', 'usr-inv-a')
    ON CONFLICT (id) DO NOTHING;
  `, [purchA1, orgAId, branchA1Id, sup1]);

  // Serials for Dell XPS 15 in Branch A1
  const serials = [
    { sn: 'SN-DXP-9530-01', prod: pDellXps, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-DXP-9530-02', prod: pDellXps, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-DXP-9530-03', prod: pDellXps, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-DXP-9530-04', prod: pDellXps, br: branchA2Id, status: 'In Stock' },
    { sn: 'SN-HPOM-16-01', prod: pHpOmen, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-HPOM-16-02', prod: pHpOmen, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-HPOM-16-03', prod: pHpOmen, br: branchA2Id, status: 'In Stock' },
    { sn: 'SN-TPAD-T14-01', prod: pThinkpad, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-TPAD-T14-02', prod: pThinkpad, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-TPAD-T14-03', prod: pThinkpad, br: branchA2Id, status: 'In Stock' },
    { sn: 'SN-DSK-CR-01', prod: pGamingPc, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-DSK-CR-02', prod: pGamingPc, br: branchA2Id, status: 'In Stock' },
    { sn: 'SN-ASUS-27-01', prod: pAsusMonitor, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-ASUS-27-02', prod: pAsusMonitor, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-ASUS-27-03', prod: pAsusMonitor, br: branchA2Id, status: 'In Stock' },
    { sn: 'SN-RTX4070S-01', prod: pRtx4070, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-RTX4070S-02', prod: pRtx4070, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-RTX4070S-03', prod: pRtx4070, br: branchA2Id, status: 'In Stock' },
    { sn: 'SN-CAN-MF445-01', prod: pCanonPrinter, br: branchA1Id, status: 'In Stock' },
    { sn: 'SN-CAN-MF445-02', prod: pCanonPrinter, br: branchA2Id, status: 'In Stock' },
  ];

  for (let i = 0; i < serials.length; i++) {
    const s = serials[i];
    const sId = `ser-${i + 1}`;
    await db.query(`
      INSERT INTO product_serials (id, organization_id, branch_id, product_id, serial_number, purchase_id, purchase_date, supplier_id, status, current_location)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP - INTERVAL '10 days', $7, $8, $9)
      ON CONFLICT (id) DO NOTHING;
    `, [sId, orgAId, s.br, s.prod, s.sn, purchA1, sup1, s.status, s.br === branchA1Id ? 'Main Showroom Shelf A' : 'Mall Display Rack B']);

    // Record stock movement for serialized unit
    await db.query(`
      INSERT INTO stock_movements (id, organization_id, branch_id, product_id, serial_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
      VALUES ($1, $2, $3, $4, $5, 1, 'OPENING_STOCK', 'PURCHASE', $6, 'usr-inv-a', 'Initial inventory batch')
      ON CONFLICT (id) DO NOTHING;
    `, [`mov-ser-${i + 1}`, orgAId, s.br, s.prod, sId, purchA1]);
  }

  // Non-serialized stock movements (SSDs, RAM, Cables, Mice, Keyboards)
  const nonSerials = [
    { prod: pSamsungSsd, qtyA: 25, qtyB: 12 },
    { prod: pKingstonRam, qtyA: 30, qtyB: 15 },
    { prod: pMxMaster, qtyA: 20, qtyB: 10 },
    { prod: pCorsairK70, qtyA: 14, qtyB: 6 },
    { prod: pTpLinkRouter, qtyA: 16, qtyB: 8 },
    { prod: pCat6Cable, qtyA: 50, qtyB: 25 },
    { prod: pUsbCAdapter, qtyA: 40, qtyB: 20 },
  ];

  for (let i = 0; i < nonSerials.length; i++) {
    const item = nonSerials[i];
    await db.query(`
      INSERT INTO stock_movements (id, organization_id, branch_id, product_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
      VALUES
      ($1, $2, $3, $4, $5, 'OPENING_STOCK', 'PURCHASE', $6, 'usr-inv-a', 'Initial opening stock'),
      ($7, $2, $8, $4, $9, 'OPENING_STOCK', 'PURCHASE', $6, 'usr-inv-a', 'Initial opening stock')
      ON CONFLICT (id) DO NOTHING;
    `, [
      `mov-ns-a-${i}`, orgAId, branchA1Id, item.prod, item.qtyA, purchA1,
      `mov-ns-b-${i}`, branchA2Id, item.qtyB
    ]);
  }

  // Sample Completed Sales in Main Branch
  const sale1Id = 'sale-br01-0001';
  await db.query(`
    INSERT INTO sales (id, organization_id, branch_id, customer_id, invoice_number, sale_date, subtotal, discount, tax, total, paid_amount, balance_due, payment_status, sale_status, cashier_id, notes)
    VALUES ($1, $2, $3, $4, 'BR01-2026-000001', CURRENT_TIMESTAMP - INTERVAL '2 days', 3077, 50, 249.73, 3276.73, 3276.73, 0, 'PAID', 'COMPLETED', 'usr-cashier-a1', 'Customer requested warranty card attached')
    ON CONFLICT (id) DO NOTHING;
  `, [sale1Id, orgAId, branchA1Id, cust2]);

  // Sale items
  await db.query(`
    INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, cost_price, discount, tax, total_price, serial_numbers)
    VALUES
    ('si-1', $1, $2, 1, 2399, 1850, 50, 193.79, 2542.79, ARRAY['SN-DXP-9530-01']),
    ('si-2', $1, $3, 1, 649, 450, 0, 53.54, 702.54, ARRAY['SN-ASUS-27-01']),
    ('si-3', $1, $4, 2, 14.99, 4.5, 0, 2.40, 31.40, '{}')
    ON CONFLICT (id) DO NOTHING;
  `, [sale1Id, pDellXps, pAsusMonitor, pCat6Cable]);

  // Update serial statuses to Sold
  await db.query(`
    UPDATE product_serials SET status = 'Sold', sale_id = $1, customer_id = $2, selling_price = 2399, warranty_start = CURRENT_TIMESTAMP - INTERVAL '2 days', warranty_end = CURRENT_TIMESTAMP + INTERVAL '363 days' WHERE serial_number = 'SN-DXP-9530-01'
  `, [sale1Id, cust2]);
  await db.query(`
    UPDATE product_serials SET status = 'Sold', sale_id = $1, customer_id = $2, selling_price = 649, warranty_start = CURRENT_TIMESTAMP - INTERVAL '2 days', warranty_end = CURRENT_TIMESTAMP + INTERVAL '363 days' WHERE serial_number = 'SN-ASUS-27-01'
  `, [sale1Id, cust2]);

  // Deduct stock via SALE movements
  await db.query(`
    INSERT INTO stock_movements (id, organization_id, branch_id, product_id, serial_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
    VALUES
    ('mov-sale-1', $1, $2, $3, (SELECT id FROM product_serials WHERE serial_number = 'SN-DXP-9530-01'), -1, 'SALE', 'INVOICE', $4, 'usr-cashier-a1', 'Sold on invoice BR01-2026-000001'),
    ('mov-sale-2', $1, $2, $5, (SELECT id FROM product_serials WHERE serial_number = 'SN-ASUS-27-01'), -1, 'SALE', 'INVOICE', $4, 'usr-cashier-a1', 'Sold on invoice BR01-2026-000001'),
    ('mov-sale-3', $1, $2, $6, NULL, -2, 'SALE', 'INVOICE', $4, 'usr-cashier-a1', 'Sold on invoice BR01-2026-000001')
    ON CONFLICT (id) DO NOTHING;
  `, [orgAId, branchA1Id, pDellXps, sale1Id, pAsusMonitor, pCat6Cable]);

  // Split payment example
  await db.query(`
    INSERT INTO sale_payments (id, sale_id, organization_id, branch_id, payment_method, amount, reference_number)
    VALUES
    ('sp-1', $1, $2, $3, 'Cash', 1276.73, 'CASH-REC-01'),
    ('sp-2', $1, $2, $3, 'Card', 2000.00, 'VISA-9941')
    ON CONFLICT (id) DO NOTHING;
  `, [sale1Id, orgAId, branchA1Id]);

  // Credit Sale for CyberCore Solutions
  const sale2Id = 'sale-br01-0002';
  await db.query(`
    INSERT INTO sales (id, organization_id, branch_id, customer_id, invoice_number, sale_date, subtotal, discount, tax, total, paid_amount, balance_due, payment_status, sale_status, cashier_id, notes)
    VALUES ($1, $2, $3, $4, 'BR01-2026-000002', CURRENT_TIMESTAMP - INTERVAL '1 day', 2799, 0, 230.92, 3029.92, 1179.92, 1850, 'PARTIAL', 'COMPLETED', 'usr-cashier-a1', 'Net 30 corporate payment agreement')
    ON CONFLICT (id) DO NOTHING;
  `, [sale2Id, orgAId, branchA1Id, cust1]);

  await db.query(`
    INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, cost_price, discount, tax, total_price, serial_numbers)
    VALUES ('si-4', $1, $2, 1, 2799, 2100, 0, 230.92, 3029.92, ARRAY['SN-DSK-CR-01'])
    ON CONFLICT (id) DO NOTHING;
  `, [sale2Id, pGamingPc]);

  await db.query(`
    UPDATE product_serials SET status = 'Sold', sale_id = $1, customer_id = $2, selling_price = 2799, warranty_start = CURRENT_TIMESTAMP - INTERVAL '1 day', warranty_end = CURRENT_TIMESTAMP + INTERVAL '729 days' WHERE serial_number = 'SN-DSK-CR-01';
  `, [sale2Id, cust1]);

  await db.query(`
    INSERT INTO stock_movements (id, organization_id, branch_id, product_id, serial_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
    VALUES ('mov-sale-4', $1, $2, $3, (SELECT id FROM product_serials WHERE serial_number = 'SN-DSK-CR-01'), -1, 'SALE', 'INVOICE', $4, 'usr-cashier-a1', 'Credit sale invoice BR01-2026-000002')
    ON CONFLICT (id) DO NOTHING;
  `, [orgAId, branchA1Id, pGamingPc, sale2Id]);

  await db.query(`
    INSERT INTO sale_payments (id, sale_id, organization_id, branch_id, payment_method, amount, reference_number)
    VALUES
    ('sp-3', $1, $2, $3, 'Bank Transfer', 1179.92, 'WIRE-CC-9021')
    ON CONFLICT (id) DO NOTHING;
  `, [sale2Id, orgAId, branchA1Id]);

  // Expenses in Main Branch
  await db.query(`
    INSERT INTO expenses (id, organization_id, branch_id, category, amount, payment_method, expense_date, description, created_by)
    VALUES
    ('exp-1', $1, $2, 'Rent', 3200, 'Bank Transfer', CURRENT_DATE - INTERVAL '5 days', 'Monthly showroom lease payment', 'usr-mgr-a1'),
    ('exp-2', $1, $2, 'Electricity', 420, 'Card', CURRENT_DATE - INTERVAL '3 days', 'HVAC and commercial display power bill', 'usr-mgr-a1'),
    ('exp-3', $1, $2, 'Internet', 150, 'Card', CURRENT_DATE - INTERVAL '4 days', 'Gigabit business fiber connection', 'usr-mgr-a1')
    ON CONFLICT (id) DO NOTHING;
  `, [orgAId, branchA1Id]);

  // Expense in Second Branch
  await db.query(`
    INSERT INTO expenses (id, organization_id, branch_id, category, amount, payment_method, expense_date, description, created_by)
    VALUES
    ('exp-4', $1, $2, 'Rent', 2400, 'Bank Transfer', CURRENT_DATE - INTERVAL '5 days', 'Mall kiosk space lease payment', 'usr-owner-a'),
    ('exp-5', $1, $2, 'Advertising', 350, 'Card', CURRENT_DATE - INTERVAL '2 days', 'Mall hallway banner promotion', 'usr-owner-a')
    ON CONFLICT (id) DO NOTHING;
  `, [orgAId, branchA2Id]);

  // Sample Repair Ticket
  await db.query(`
    INSERT INTO repairs (id, organization_id, branch_id, ticket_number, customer_id, device, brand, model, serial_number, problem_description, technician_id, diagnosis, repair_notes, parts_cost, labor_cost, customer_cost, status)
    VALUES
    ('rep-001', $1, $2, 'REP-2026-001', $3, 'Laptop', 'Dell', 'XPS 13 9310', 'SN-CUST-REP-01', 'Display flickering and battery swelling after thermal throttling', 'usr-tech-a', 'Swollen lithium pack pressing into chassis; ribbon cable damaged', 'Replaced battery pack with OEM Dell 52Wh cell and installed new eDP flex cable', 90, 75, 195, 'REPAIRING')
    ON CONFLICT (id) DO NOTHING;
  `, [orgAId, branchA1Id, cust2]);

  // Audit Logs
  await db.query(`
    INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
    VALUES
    ('aud-1', $1, NULL, 'usr-superadmin', 'Super Admin', 'INITIALIZE', 'SYSTEM', 'SYS-ROOT', 'Initialized multi-tenant retail system'),
    ('aud-2', $1, $2, 'usr-cashier-a1', 'Sarah Connor', 'SALE_COMPLETED', 'SALE', $3, 'Completed invoice BR01-2026-000001 ($3276.73)'),
    ('aud-3', $1, $2, 'usr-cashier-a1', 'Sarah Connor', 'CREDIT_SALE', 'SALE', $4, 'Issued credit sale BR01-2026-000002 ($3029.92)')
    ON CONFLICT (id) DO NOTHING;
  `, [orgAId, branchA1Id, sale1Id, sale2Id]);

  console.log('Demo data seeded successfully!');
}
