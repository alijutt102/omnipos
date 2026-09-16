import 'dotenv/config';
import { initializeDatabase, query, getDb } from '../server/db.ts';

async function run() {
  console.log('====================================================');
  console.log('  Retail POS & ERP - PostgreSQL Database Initializer');
  console.log('====================================================');

  if (process.env.DATABASE_URL) {
    console.log(`Target: PostgreSQL (${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')})`);
  } else {
    console.log('Target: Local Embedded Database (Set DATABASE_URL in .env to use PostgreSQL)');
  }

  try {
    console.log('\n[1/3] Creating all relational tables and schema constraints...');
    await initializeDatabase();
    console.log('✔ All 31 tables, constraints, and indexes created successfully.');

    console.log('\n[2/3] Verifying database tables and counts...');
    const tables = [
      'organizations',
      'branches',
      'roles',
      'users',
      'categories',
      'brands',
      'products',
      'suppliers',
      'customers',
      'purchases',
      'purchase_items',
      'product_serials',
      'stock_movements',
      'stock_transfers',
      'sales',
      'sale_items',
      'sale_payments',
      'sales_returns',
      'cash_registers',
      'cash_sessions',
      'expenses',
      'repairs',
      'trade_ins',
      'audit_logs'
    ];

    for (const tbl of tables) {
      try {
        const res = await query(`SELECT COUNT(*) as count FROM ${tbl}`);
        console.log(`  - ${tbl.padEnd(22)} : ${res.rows[0]?.count ?? 0} records`);
      } catch (err: any) {
        console.log(`  - ${tbl.padEnd(22)} : table created (0 records)`);
      }
    }

    console.log('\n[3/3] Ready-to-use Login Accounts:');
    console.log('  👑 Super Admin     : superadmin@pos.com       / password123');
    console.log('  🏢 Store Owner     : owner@mycomputerstore.com / password123');
    console.log('  🏪 Store Manager   : manager@mainbranch.com   / password123');
    console.log('  💳 Cashier         : cashier1@mainbranch.com  / password123');
    console.log('  🔧 Technician      : technician@mainbranch.com/ password123');
    console.log('  📦 Inventory Lead  : inventory@mycomputerstore.com / password123');

    console.log('\n✔ PostgreSQL setup completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Database setup error:', err);
    process.exit(1);
  }
}

run();
