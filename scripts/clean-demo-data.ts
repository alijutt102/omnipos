import 'dotenv/config';
import { initializeDatabase, query } from '../server/db.ts';

const DEMO_ORGANIZATIONS = ['org-tenant-a-compstore', 'org-tenant-b-apex'];

async function cleanDemoData() {
  if (process.env.CONFIRM_DEMO_DATA_DELETE !== 'YES') {
    throw new Error('Set CONFIRM_DEMO_DATA_DELETE=YES to delete demo data.');
  }

  await initializeDatabase();
  const params = [DEMO_ORGANIZATIONS];

  await query(`DELETE FROM sales_returns WHERE organization_id = ANY($1::text[])`, params);
  await query(`DELETE FROM sale_payments WHERE organization_id = ANY($1::text[])`, params);
  await query(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE organization_id = ANY($1::text[]))`, params);
  await query(`DELETE FROM sales WHERE organization_id = ANY($1::text[])`, params);
  await query(`DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE organization_id = ANY($1::text[]))`, params);
  await query(`DELETE FROM purchases WHERE organization_id = ANY($1::text[])`, params);
  await query(`DELETE FROM stock_transfer_items WHERE transfer_id IN (SELECT id FROM stock_transfers WHERE organization_id = ANY($1::text[]))`, params);
  await query(`DELETE FROM stock_transfers WHERE organization_id = ANY($1::text[])`, params);
  await query(`DELETE FROM stock_movements WHERE organization_id = ANY($1::text[])`, params);
  await query(`DELETE FROM product_serials WHERE organization_id = ANY($1::text[])`, params);
  await query(`DELETE FROM products WHERE organization_id = ANY($1::text[])`, params);
  await query(`DELETE FROM promotions WHERE organization_id = ANY($1::text[])`, params);

  console.log('Demo products and their sample sales, purchases, stock, serials, and promotions were removed.');
}

cleanDemoData().catch((error) => {
  console.error('Demo data cleanup failed:', error);
  process.exitCode = 1;
});
