import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, transaction, initializeDatabase } from './db.ts';
import { authenticate, requireRole, getAuthorizedBranchId, signToken, AuthRequest } from './auth.ts';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & DEMO USERS
// ==========================================

apiRouter.post('/auth/login', async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    let userRes = await query(`
      SELECT 
        u.id, u.organization_id, u.branch_id, u.name, u.email, u.password_hash, u.role_name, u.status,
        o.name as organization_name, o.currency,
        b.branch_name, b.branch_code
      FROM users u
      JOIN organizations o ON o.id = u.organization_id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE LOWER(u.email) = LOWER($1)
    `, [email.trim()]);

    // Self-healing check if no user found
    if (userRes.rows.length === 0) {
      try {
        const countRes = await query('SELECT COUNT(*) as count FROM users');
        if (parseInt(countRes.rows[0]?.count || '0', 10) === 0) {
          console.log('Self-healing triggered: 0 users found in database. Initializing & seeding demo data...');
          await initializeDatabase();
          userRes = await query(`
            SELECT 
              u.id, u.organization_id, u.branch_id, u.name, u.email, u.password_hash, u.role_name, u.status,
              o.name as organization_name, o.currency,
              b.branch_name, b.branch_code
            FROM users u
            JOIN organizations o ON o.id = u.organization_id
            LEFT JOIN branches b ON b.id = u.branch_id
            WHERE LOWER(u.email) = LOWER($1)
          `, [email.trim()]);
        }
      } catch (checkErr) {
        console.warn('Self-heal check error:', checkErr);
      }
    }

    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user = userRes.rows[0];
    if (user.status !== 'ACTIVE') {
      res.status(403).json({ error: 'This user account is suspended or inactive.' });
      return;
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signToken({
      id: user.id,
      organization_id: user.organization_id,
      branch_id: user.branch_id,
      name: user.name,
      email: user.email,
      role_name: user.role_name,
      organization_name: user.organization_name,
      currency: user.currency || '$',
      branch_name: user.branch_name,
      branch_code: user.branch_code,
    });

    // Record login audit log
    await query(`
      INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
      VALUES ($1, $2, $3, $4, $5, 'LOGIN', 'AUTH', $4, 'User logged in successfully')
    `, [`aud-log-${Date.now()}`, user.organization_id, user.branch_id, user.id, user.name]);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role_name: user.role_name,
        organization_id: user.organization_id,
        organization_name: user.organization_name,
        currency: user.currency || '$',
        branch_id: user.branch_id,
        branch_name: user.branch_name,
        branch_code: user.branch_code,
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Authentication failed. Please try again.' });
  }
});

apiRouter.get('/auth/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

// ==========================================
// 2. DASHBOARD ANALYTICS & KPIS
// ==========================================

apiRouter.get('/dashboard', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const range = (req.query.range as string) || 'this_month';

    let dateFilter = `s.sale_date >= CURRENT_DATE - INTERVAL '30 days'`;
    let expDateFilter = `e.expense_date >= CURRENT_DATE - INTERVAL '30 days'`;
    let purDateFilter = `p.purchase_date >= CURRENT_DATE - INTERVAL '30 days'`;

    if (range === 'today') {
      dateFilter = `s.sale_date >= CURRENT_DATE`;
      expDateFilter = `e.expense_date >= CURRENT_DATE`;
      purDateFilter = `p.purchase_date >= CURRENT_DATE`;
    } else if (range === 'yesterday') {
      dateFilter = `s.sale_date >= CURRENT_DATE - INTERVAL '1 day' AND s.sale_date < CURRENT_DATE`;
      expDateFilter = `e.expense_date >= CURRENT_DATE - INTERVAL '1 day' AND e.expense_date < CURRENT_DATE`;
      purDateFilter = `p.purchase_date >= CURRENT_DATE - INTERVAL '1 day' AND p.purchase_date < CURRENT_DATE`;
    } else if (range === 'this_week') {
      dateFilter = `s.sale_date >= DATE_TRUNC('week', CURRENT_DATE)`;
      expDateFilter = `e.expense_date >= DATE_TRUNC('week', CURRENT_DATE)`;
      purDateFilter = `p.purchase_date >= DATE_TRUNC('week', CURRENT_DATE)`;
    } else if (range === 'this_year') {
      dateFilter = `s.sale_date >= DATE_TRUNC('year', CURRENT_DATE)`;
      expDateFilter = `e.expense_date >= DATE_TRUNC('year', CURRENT_DATE)`;
      purDateFilter = `p.purchase_date >= DATE_TRUNC('year', CURRENT_DATE)`;
    }

    const branchClause = branchId ? `AND s.branch_id = '${branchId}'` : '';
    const expBranchClause = branchId ? `AND e.branch_id = '${branchId}'` : '';
    const purBranchClause = branchId ? `AND p.branch_id = '${branchId}'` : '';
    const stockBranchClause = branchId ? `AND sm.branch_id = '${branchId}'` : '';

    // Sales and Gross Profit
    const salesRes = await query(`
      SELECT 
        COALESCE(SUM(s.total), 0) as total_sales,
        COALESCE(SUM(s.subtotal), 0) as total_subtotal,
        COALESCE(SUM(s.discount), 0) as total_discount,
        COALESCE(SUM(s.tax), 0) as total_tax,
        COALESCE(SUM(s.paid_amount), 0) as total_collected,
        COALESCE(SUM(s.balance_due), 0) as total_receivables,
        COUNT(s.id) as sales_count
      FROM sales s
      WHERE s.organization_id = $1 AND s.sale_status = 'COMPLETED' ${branchClause} AND ${dateFilter}
    `, [orgId]);

    // Cost of Goods Sold (COGS)
    const cogsRes = await query(`
      SELECT 
        COALESCE(SUM(si.quantity * si.cost_price), 0) as total_cogs
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.organization_id = $1 AND s.sale_status = 'COMPLETED' ${branchClause} AND ${dateFilter}
    `, [orgId]);

    // Expenses
    const expRes = await query(`
      SELECT COALESCE(SUM(e.amount), 0) as total_expenses
      FROM expenses e
      WHERE e.organization_id = $1 ${expBranchClause} AND ${expDateFilter}
    `, [orgId]);

    // Purchases
    const purRes = await query(`
      SELECT 
        COALESCE(SUM(p.total), 0) as total_purchases,
        COALESCE(SUM(p.balance_due), 0) as total_payables
      FROM purchases p
      WHERE p.organization_id = $1 ${purBranchClause} AND ${purDateFilter}
    `, [orgId]);

    // Inventory Valuation & Low Stock
    const lowStockThreshold = Number(req.query.low_stock_threshold) > 0 ? Number(req.query.low_stock_threshold) : 5;

    const invRes = await query(`
      WITH stock_summary AS (
        SELECT 
          p.id, p.product_name, p.sku, p.purchase_price, p.reorder_level,
          COALESCE(SUM(sm.quantity), 0) as current_stock
        FROM products p
        LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.organization_id = p.organization_id ${stockBranchClause}
        WHERE p.organization_id = $1 AND p.active_status = true
        GROUP BY p.id, p.product_name, p.sku, p.purchase_price, p.reorder_level
      )
      SELECT 
        COALESCE(SUM(current_stock * purchase_price), 0) as inventory_value,
        COUNT(CASE WHEN current_stock <= $2 THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN current_stock <= 0 THEN 1 END) as out_of_stock_count
      FROM stock_summary
    `, [orgId, lowStockThreshold]);

    const lowStockItemsRes = await query(`
      WITH stock_summary AS (
        SELECT 
          p.id, p.product_name, p.sku, p.reorder_level, p.unit,
          COALESCE(SUM(sm.quantity), 0) as current_stock
        FROM products p
        LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.organization_id = p.organization_id ${stockBranchClause}
        WHERE p.organization_id = $1 AND p.active_status = true
        GROUP BY p.id, p.product_name, p.sku, p.reorder_level, p.unit
      )
      SELECT id, product_name, sku, reorder_level, unit, current_stock
      FROM stock_summary
      WHERE current_stock <= $2
      ORDER BY current_stock ASC
      LIMIT 12
    `, [orgId, lowStockThreshold]);

    // Top Selling Products
    const topProdRes = await query(`
      SELECT 
        p.id, p.product_name, p.sku, p.product_type,
        SUM(si.quantity) as units_sold,
        SUM(si.total_price) as revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.organization_id = $1 AND s.sale_status = 'COMPLETED' ${branchClause} AND ${dateFilter}
      GROUP BY p.id, p.product_name, p.sku, p.product_type
      ORDER BY revenue DESC
      LIMIT 5
    `, [orgId]);

    // Sales Trend by Day (last 7 days or points)
    const trendRes = await query(`
      SELECT 
        TO_CHAR(s.sale_date, 'YYYY-MM-DD') as date_label,
        COUNT(s.id) as transactions,
        SUM(s.total) as daily_sales
      FROM sales s
      WHERE s.organization_id = $1 AND s.sale_status = 'COMPLETED' ${branchClause}
        AND s.sale_date >= CURRENT_DATE - INTERVAL '14 days'
      GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM-DD')
      ORDER BY date_label ASC
    `, [orgId]);

    // Branch Comparison (if Owner / Super Admin)
    let branchComparison: any[] = [];
    if (!branchId || req.user!.role_name === 'TENANT_OWNER' || req.user!.role_name === 'SUPER_ADMIN') {
      const brRes = await query(`
        SELECT 
          b.id, b.branch_name, b.branch_code,
          COALESCE(SUM(s.total), 0) as total_sales,
          COUNT(s.id) as sales_count
        FROM branches b
        LEFT JOIN sales s ON s.branch_id = b.id AND s.sale_status = 'COMPLETED' AND ${dateFilter}
        WHERE b.organization_id = $1
        GROUP BY b.id, b.branch_name, b.branch_code
        ORDER BY total_sales DESC
      `, [orgId]);
      branchComparison = brRes.rows;
    }

    const totalSales = Number(salesRes.rows[0].total_sales);
    const totalCogs = Number(cogsRes.rows[0].total_cogs);
    const grossProfit = totalSales - totalCogs;
    const totalExpenses = Number(expRes.rows[0].total_expenses);
    const netProfit = grossProfit - totalExpenses;

    res.json({
      metrics: {
        totalSales,
        totalCogs,
        grossProfit,
        totalExpenses,
        netProfit,
        salesCount: Number(salesRes.rows[0].sales_count),
        totalReceivables: Number(salesRes.rows[0].total_receivables),
        totalPurchases: Number(purRes.rows[0].total_purchases),
        totalPayables: Number(purRes.rows[0].total_payables),
        inventoryValue: Number(invRes.rows[0].inventory_value),
        lowStockCount: Number(invRes.rows[0].low_stock_count),
        outOfStockCount: Number(invRes.rows[0].out_of_stock_count),
      },
      lowStockItems: lowStockItemsRes.rows,
      lowStockThreshold,
      topProducts: topProdRes.rows,
      salesTrend: trendRes.rows,
      branchComparison,
      scopedBranchId: branchId,
    });
  } catch (err: any) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard analytics.' });
  }
});

// ==========================================
// 3. BRANCH MANAGEMENT
// ==========================================

apiRouter.get('/branches', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req);
    const branches = await query(`
      SELECT 
        b.id, b.organization_id, b.branch_name, b.branch_code, b.phone, b.email,
        b.address, b.city, b.manager_name, b.opening_cash, b.status, b.created_at,
        COUNT(DISTINCT u.id) as staff_count
      FROM branches b
      LEFT JOIN users u ON u.branch_id = b.id
      WHERE b.organization_id = $1 AND ($2::text IS NULL OR b.id = $2)
      GROUP BY b.id
      ORDER BY b.branch_code ASC
    `, [orgId, branchId]);
    res.json({ branches: branches.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch branches.' });
  }
});

apiRouter.post('/branches', authenticate, requireRole(['TENANT_OWNER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { branch_name, branch_code, phone, email, address, city, manager_name, opening_cash } = req.body;

    if (!branch_name || !branch_code) {
      res.status(400).json({ error: 'Branch name and branch code are required.' });
      return;
    }

    const branchId = `br-${Date.now().toString(36)}`;
    await query(`
      INSERT INTO branches (id, organization_id, branch_name, branch_code, phone, email, address, city, manager_name, opening_cash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [branchId, orgId, branch_name, branch_code.toUpperCase().trim(), phone, email, address, city, manager_name, Number(opening_cash) || 0]);

    // Create default register for new branch
    await query(`
      INSERT INTO cash_registers (id, organization_id, branch_id, register_name)
      VALUES ($1, $2, $3, $4)
    `, [`reg-${Date.now().toString(36)}`, orgId, branchId, `${branch_name} Main Register`]);

    await query(`
      INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
      VALUES ($1, $2, $3, $4, $5, 'CREATE_BRANCH', 'BRANCH', $3, $6)
    `, [`aud-${Date.now()}`, orgId, branchId, req.user!.id, req.user!.name, `Created branch ${branch_name} (${branch_code})`]);

    res.status(201).json({ success: true, branchId });
  } catch (err: any) {
    if (err.message && err.message.includes('unique')) {
      res.status(400).json({ error: 'Branch code already exists in this organization.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create branch.' });
  }
});

// ==========================================
// 4. PRODUCTS & HARDWARE CATEGORIES
// ==========================================

apiRouter.get('/products', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const search = (req.query.search as string) || '';
    const categoryId = req.query.category_id as string;
    const productType = req.query.product_type as string;

    const params: any[] = [orgId];
    const branchClause = branchId ? 'AND sm.branch_id = $2' : '';
    const productBranchClause = branchId
      ? 'AND EXISTS (SELECT 1 FROM stock_movements sm_branch WHERE sm_branch.product_id = p.id AND sm_branch.organization_id = p.organization_id AND sm_branch.branch_id = $2)'
      : '';
    let searchClause = '';
    if (branchId) params.push(branchId);

    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      searchClause = `AND (LOWER(p.product_name) LIKE $${params.length} OR LOWER(p.sku) LIKE $${params.length} OR LOWER(p.barcode) LIKE $${params.length} OR LOWER(p.model) LIKE $${params.length})`;
    }

    if (categoryId) {
      params.push(categoryId);
      searchClause += ` AND p.category_id = $${params.length}`;
    }

    if (productType) {
      params.push(productType);
      searchClause += ` AND p.product_type = $${params.length}`;
    }

    const prods = await query(`
      SELECT 
        p.id, p.organization_id, p.sku, p.barcode, p.product_name, p.model,
        p.description, p.unit, p.purchase_price, p.selling_price, p.wholesale_price,
        p.minimum_selling_price, p.tax_rate, p.warranty_period, p.reorder_level,
        p.product_type, p.serial_tracking_enabled, p.barcode_tracking_enabled,
        p.active_status, p.created_at,
        c.name as category_name,
        b.name as brand_name,
        COALESCE(SUM(sm.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.organization_id = p.organization_id ${branchClause}
      WHERE p.organization_id = $1 AND p.active_status = true ${productBranchClause} ${searchClause}
      GROUP BY p.id, c.name, b.name
      ORDER BY p.product_name ASC
    `, params);

    res.json({ products: prods.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

apiRouter.delete('/products/:id', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'INVENTORY_MANAGER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { id } = req.params;

    // Check if product exists
    const prodRes = await query(`SELECT id, product_name, sku FROM products WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    if (prodRes.rows.length === 0) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const prod = prodRes.rows[0];

    // Check if there are sales records
    const salesCheck = await query(`SELECT COUNT(*) as count FROM sale_items WHERE product_id = $1`, [id]);
    const hasSales = parseInt(salesCheck.rows[0].count, 10) > 0;

    await transaction(async (tx) => {
      if (hasSales) {
        // Soft delete to protect financial audit history and sales reports
        await tx.query(`UPDATE products SET active_status = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
      } else {
        // Hard delete unreferenced product and its stock movements / serials
        await tx.query(`DELETE FROM stock_movements WHERE product_id = $1`, [id]);
        await tx.query(`DELETE FROM product_serials WHERE product_id = $1`, [id]);
        await tx.query(`DELETE FROM products WHERE id = $1`, [id]);
      }

      await tx.query(`
        INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
        VALUES ($1, $2, $3, $4, $5, 'DELETE_PRODUCT', 'PRODUCT', $6, $7)
      `, [`aud-${Date.now()}`, orgId, req.user!.branch_id, req.user!.id, req.user!.name, id, `Removed product: ${prod.product_name} (${prod.sku})`]);
    });

    res.json({ success: true, message: `Product '${prod.product_name}' successfully removed.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove product.' });
  }
});

apiRouter.post('/products', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'INVENTORY_MANAGER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const {
      sku, barcode, product_name, category_id, brand_id, model, description,
      unit, purchase_price, selling_price, wholesale_price, minimum_selling_price,
      tax_rate, warranty_period, reorder_level, product_type, serial_tracking_enabled,
      initial_stock, branch_id
    } = req.body;

    if (!sku || !product_name || selling_price === undefined) {
      res.status(400).json({ error: 'SKU, product name, and selling price are required.' });
      return;
    }

    const productId = `prod-${Date.now().toString(36)}`;
    const effectiveBranch = getAuthorizedBranchId(req, branch_id) || req.user!.branch_id;

    await transaction(async (tx) => {
      await tx.query(`
        INSERT INTO products (
          id, organization_id, sku, barcode, product_name, category_id, brand_id,
          model, description, unit, purchase_price, selling_price, wholesale_price,
          minimum_selling_price, tax_rate, warranty_period, reorder_level, product_type,
          serial_tracking_enabled
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        )
      `, [
        productId, orgId, sku.trim().toUpperCase(), barcode ? barcode.trim() : null, product_name.trim(),
        category_id || null, brand_id || null, model || null, description || null, unit || 'pcs',
        Number(purchase_price) || 0, Number(selling_price) || 0, Number(wholesale_price) || 0,
        Number(minimum_selling_price) || 0, Number(tax_rate) || 0, Number(warranty_period) || 0,
        Number(reorder_level) || 5, product_type || 'Other Accessories', Boolean(serial_tracking_enabled)
      ]);

      // If initial stock provided for non-serialized items
      if (Number(initial_stock) > 0 && effectiveBranch) {
        await tx.query(`
          INSERT INTO stock_movements (id, organization_id, branch_id, product_id, quantity, movement_type, reference_type, user_id, notes)
          VALUES ($1, $2, $3, $4, $5, 'OPENING_STOCK', 'MANUAL', $6, 'Initial stock entry upon product creation')
        `, [`mov-${Date.now().toString(36)}`, orgId, effectiveBranch, productId, Number(initial_stock), req.user!.id]);
      }

      await tx.query(`
        INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
        VALUES ($1, $2, $3, $4, $5, 'CREATE_PRODUCT', 'PRODUCT', $6, $7)
      `, [`aud-${Date.now()}`, orgId, effectiveBranch, req.user!.id, req.user!.name, productId, `Created product: ${product_name} (${sku})`]);
    });

    res.status(201).json({ success: true, productId });
  } catch (err: any) {
    if (err.message && err.message.includes('unique')) {
      res.status(400).json({ error: 'Unable to create product because SKU already exists in your organization.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create product.' });
  }
});

apiRouter.get('/categories', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const params: any[] = [req.user!.organization_id];
    let branchClause = '';
    if (branchId) {
      params.push(branchId);
      branchClause = `AND EXISTS (
        SELECT 1 FROM products p
        JOIN stock_movements sm ON sm.product_id = p.id
        WHERE p.category_id = categories.id AND sm.branch_id = $2
      )`;
    }
    const resCats = await query(`
      SELECT id, name, description FROM categories
      WHERE organization_id = $1 ${branchClause}
      ORDER BY name ASC
    `, params);
    res.json({ categories: resCats.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

apiRouter.get('/brands', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const params: any[] = [req.user!.organization_id];
    let branchClause = '';
    if (branchId) {
      params.push(branchId);
      branchClause = `AND EXISTS (
        SELECT 1 FROM products p
        JOIN stock_movements sm ON sm.product_id = p.id
        WHERE p.brand_id = brands.id AND sm.branch_id = $2
      )`;
    }
    const resBrands = await query(`
      SELECT id, name FROM brands
      WHERE organization_id = $1 ${branchClause}
      ORDER BY name ASC
    `, params);
    res.json({ brands: resBrands.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch brands.' });
  }
});

// ==========================================
// 5. SERIAL NUMBER TRACKING & AUDIT TIMELINE
// ==========================================

apiRouter.get('/serials', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const productId = req.query.product_id as string;
    const status = req.query.status as string;

    const params: any[] = [orgId];
    let sql = `
      SELECT 
        ps.id, ps.serial_number, ps.status, ps.current_location, ps.purchase_date,
        ps.selling_price, ps.warranty_start, ps.warranty_end, ps.created_at,
        p.id as product_id, p.product_name, p.sku, p.product_type,
        b.branch_name, b.branch_code,
        sup.name as supplier_name,
        cust.name as customer_name,
        s.invoice_number as sale_invoice_number
      FROM product_serials ps
      JOIN products p ON p.id = ps.product_id
      JOIN branches b ON b.id = ps.branch_id
      LEFT JOIN suppliers sup ON sup.id = ps.supplier_id
      LEFT JOIN customers cust ON cust.id = ps.customer_id
      LEFT JOIN sales s ON s.id = ps.sale_id
      WHERE ps.organization_id = $1
    `;

    if (branchId) {
      params.push(branchId);
      sql += ` AND ps.branch_id = $${params.length}`;
    }
    if (productId) {
      params.push(productId);
      sql += ` AND ps.product_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND ps.status = $${params.length}`;
    }

    sql += ` ORDER BY ps.created_at DESC LIMIT 100`;

    const resSerials = await query(sql, params);
    res.json({ serials: resSerials.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch serial numbers.' });
  }
});

// Complete lifecycle history for a serial number
apiRouter.get('/serials/history/:serialNumber', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const serial = req.params.serialNumber.trim();

    const serialRes = await query(`
      SELECT 
        ps.*,
        p.product_name, p.sku, p.product_type, p.model,
        b.branch_name, b.branch_code,
        sup.name as supplier_name,
        cust.name as customer_name, cust.phone as customer_phone,
        s.invoice_number, s.sale_date
      FROM product_serials ps
      JOIN products p ON p.id = ps.product_id
      JOIN branches b ON b.id = ps.branch_id
      LEFT JOIN suppliers sup ON sup.id = ps.supplier_id
      LEFT JOIN customers cust ON cust.id = ps.customer_id
      LEFT JOIN sales s ON s.id = ps.sale_id
      WHERE ps.organization_id = $1 AND LOWER(ps.serial_number) = LOWER($2)
    `, [orgId, serial]);

    if (serialRes.rows.length === 0) {
      res.status(404).json({ error: `Serial number '${serial}' was not found in your organization.` });
      return;
    }

    const serialRecord = serialRes.rows[0];

    // Get stock movements referencing this serial
    const movements = await query(`
      SELECT 
        sm.id, sm.quantity, sm.movement_type, sm.reference_type, sm.notes, sm.created_at,
        b.branch_name,
        u.name as staff_name
      FROM stock_movements sm
      JOIN branches b ON b.id = sm.branch_id
      LEFT JOIN users u ON u.id = sm.user_id
      WHERE sm.organization_id = $1 AND sm.serial_id = $2
      ORDER BY sm.created_at ASC
    `, [orgId, serialRecord.id]);

    // Get repair tickets referencing this serial
    const repairs = await query(`
      SELECT 
        r.id, r.ticket_number, r.status, r.problem_description, r.diagnosis,
        r.received_date, r.estimated_completion,
        u.name as technician_name
      FROM repairs r
      LEFT JOIN users u ON u.id = r.technician_id
      WHERE r.organization_id = $1 AND LOWER(r.serial_number) = LOWER($2)
      ORDER BY r.created_at ASC
    `, [orgId, serial]);

    res.json({
      serial: serialRecord,
      movements: movements.rows,
      repairs: repairs.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve serial history.' });
  }
});

// ==========================================
// 6. INVENTORY MOVEMENTS & STOCK LEDGER
// ==========================================

apiRouter.get('/inventory/movements', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const productId = req.query.product_id as string;
    const movementType = req.query.movement_type as string;

    const params: any[] = [orgId];
    let sql = `
      SELECT 
        sm.id, sm.quantity, sm.movement_type, sm.reference_type, sm.reference_id,
        sm.notes, sm.created_at,
        p.product_name, p.sku, p.unit,
        b.branch_name, b.branch_code,
        u.name as staff_name,
        ps.serial_number
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      JOIN branches b ON b.id = sm.branch_id
      LEFT JOIN users u ON u.id = sm.user_id
      LEFT JOIN product_serials ps ON ps.id = sm.serial_id
      WHERE sm.organization_id = $1
    `;

    if (branchId) {
      params.push(branchId);
      sql += ` AND sm.branch_id = $${params.length}`;
    }
    if (productId) {
      params.push(productId);
      sql += ` AND sm.product_id = $${params.length}`;
    }
    if (movementType) {
      params.push(movementType);
      sql += ` AND sm.movement_type = $${params.length}`;
    }

    sql += ` ORDER BY sm.created_at DESC LIMIT 100`;

    const resMovs = await query(sql, params);
    res.json({ movements: resMovs.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch stock movements.' });
  }
});

// Stock Adjustment (Damage, Lost, Physical Count Adjustment)
apiRouter.post('/inventory/adjustments', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'INVENTORY_MANAGER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { branch_id, product_id, serial_number, quantity, adjustment_type, movement_type, notes, reason } = req.body;

    let effectiveBranch = getAuthorizedBranchId(req, branch_id) || req.user!.branch_id;
    if (!effectiveBranch) {
      const branchRes = await query(`SELECT id FROM branches WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 1`, [orgId]);
      if (branchRes.rows.length > 0) {
        effectiveBranch = branchRes.rows[0].id;
      }
    }

    const effectiveAdjType = adjustment_type || movement_type || 'PHYSICAL_COUNT';
    const effectiveNotes = (notes || reason || 'Manual stock adjustment').trim();
    const numQty = Number(quantity);

    if (!effectiveBranch || !product_id || isNaN(numQty) || numQty === 0) {
      res.status(400).json({ error: 'Valid branch, product, and non-zero adjustment quantity are required.' });
      return;
    }

    // Determine signed quantity based on adjustment direction
    let movQty = numQty;
    if (
      effectiveAdjType === 'ADJUSTMENT_OUT' ||
      effectiveAdjType === 'DAMAGE' ||
      effectiveAdjType === 'LOST' ||
      effectiveAdjType === 'SHRINKAGE' ||
      effectiveAdjType === 'DEFECT'
    ) {
      movQty = -Math.abs(numQty);
    } else if (
      effectiveAdjType === 'ADJUSTMENT_IN' ||
      effectiveAdjType === 'FOUND' ||
      effectiveAdjType === 'PHYSICAL_COUNT_IN'
    ) {
      movQty = Math.abs(numQty);
    }

    await transaction(async (tx) => {
      let serialId: string | null = null;
      if (serial_number) {
        const serRes = await tx.query(`
          SELECT id, status FROM product_serials
          WHERE organization_id = $1 AND product_id = $2 AND LOWER(serial_number) = LOWER($3)
        `, [orgId, product_id, serial_number.trim()]);

        if (serRes.rows.length === 0) {
          throw new Error(`Serial number '${serial_number}' does not exist for this product.`);
        }
        serialId = serRes.rows[0].id;

        // Update serial status based on adjustment
        let newStatus = 'In Stock';
        if (effectiveAdjType === 'DAMAGE' || effectiveAdjType === 'ADJUSTMENT_OUT' || effectiveAdjType === 'DEFECT') newStatus = 'Damaged';
        if (effectiveAdjType === 'LOST' || effectiveAdjType === 'SHRINKAGE') newStatus = 'Lost';

        await tx.query(`
          UPDATE product_serials SET status = $1, current_location = $2 WHERE id = $3
        `, [newStatus, `Adjusted: ${effectiveNotes}`, serialId]);
      }

      await tx.query(`
        INSERT INTO stock_movements (id, organization_id, branch_id, product_id, serial_id, quantity, movement_type, reference_type, user_id, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'MANUAL_ADJUSTMENT', $8, $9)
      `, [`mov-${Date.now().toString(36)}`, orgId, effectiveBranch, product_id, serialId, movQty, effectiveAdjType, req.user!.id, effectiveNotes]);

      await tx.query(`
        INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
        VALUES ($1, $2, $3, $4, $5, 'STOCK_ADJUSTMENT', 'INVENTORY', $6, $7)
      `, [`aud-${Date.now()}`, orgId, effectiveBranch, req.user!.id, req.user!.name, product_id, `Adjusted stock by ${movQty > 0 ? '+' : ''}${movQty} (${effectiveAdjType}): ${effectiveNotes}`]);
    });

    const stockRes = await query(`
      SELECT COALESCE(SUM(quantity), 0) as current_stock 
      FROM stock_movements 
      WHERE product_id = $1 AND organization_id = $2 AND branch_id = $3
    `, [product_id, orgId, effectiveBranch]);

    res.json({ 
      success: true, 
      message: 'Stock adjustment applied successfully.',
      current_stock: Number(stockRes.rows[0]?.current_stock || 0)
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to record stock adjustment.' });
  }
});

// ==========================================
// 7. MULTI-BRANCH STOCK TRANSFERS
// ==========================================

apiRouter.get('/transfers', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);

    let branchClause = '';
    const params: any[] = [orgId];

    if (branchId) {
      params.push(branchId);
      branchClause = `AND (st.source_branch_id = $2 OR st.destination_branch_id = $2)`;
    }

    const transfers = await query(`
      SELECT 
        st.id, st.transfer_number, st.status, st.notes, st.created_at, st.updated_at,
        b1.branch_name as source_branch_name, b1.branch_code as source_branch_code,
        b2.branch_name as destination_branch_name, b2.branch_code as destination_branch_code,
        u_req.name as requested_by_name,
        u_app.name as approved_by_name,
        u_rec.name as received_by_name,
        (
          SELECT json_agg(json_build_object(
            'id', sti.id,
            'product_id', sti.product_id,
            'product_name', p.product_name,
            'sku', p.sku,
            'quantity', sti.quantity,
            'serial_numbers', sti.serial_numbers
          ))
          FROM stock_transfer_items sti
          JOIN products p ON p.id = sti.product_id
          WHERE sti.transfer_id = st.id
        ) as items
      FROM stock_transfers st
      JOIN branches b1 ON b1.id = st.source_branch_id
      JOIN branches b2 ON b2.id = st.destination_branch_id
      LEFT JOIN users u_req ON u_req.id = st.requested_by
      LEFT JOIN users u_app ON u_app.id = st.approved_by
      LEFT JOIN users u_rec ON u_rec.id = st.received_by
      WHERE st.organization_id = $1 ${branchClause}
      ORDER BY st.created_at DESC
    `, params);

    res.json({ transfers: transfers.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch stock transfers.' });
  }
});

apiRouter.post('/transfers', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'INVENTORY_MANAGER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { source_branch_id, destination_branch_id, items, notes } = req.body;

    if (!source_branch_id || !destination_branch_id || !items || !items.length) {
      res.status(400).json({ error: 'Source branch, destination branch, and at least one item are required.' });
      return;
    }

    if (source_branch_id === destination_branch_id) {
      res.status(400).json({ error: 'Source and destination branches cannot be the same.' });
      return;
    }

    const transferId = `trf-${Date.now().toString(36)}`;
    const countRes = await query(`SELECT COUNT(*) as count FROM stock_transfers WHERE organization_id = $1`, [orgId]);
    const seq = parseInt(countRes.rows[0].count, 10) + 1;
    const transferNumber = `TRF-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

    await transaction(async (tx) => {
      await tx.query(`
        INSERT INTO stock_transfers (id, organization_id, transfer_number, source_branch_id, destination_branch_id, status, requested_by, notes)
        VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6, $7)
      `, [transferId, orgId, transferNumber, source_branch_id, destination_branch_id, req.user!.id, notes]);

      for (const item of items) {
        await tx.query(`
          INSERT INTO stock_transfer_items (id, transfer_id, product_id, quantity, serial_numbers)
          VALUES ($1, $2, $3, $4, $5)
        `, [`ti-${Date.now().toString(36)}-${Math.random().toString(36).substring(7)}`, transferId, item.product_id, Number(item.quantity), item.serial_numbers || []]);
      }

      await tx.query(`
        INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
        VALUES ($1, $2, $3, $4, $5, 'CREATE_TRANSFER', 'TRANSFER', $6, $7)
      `, [`aud-${Date.now()}`, orgId, source_branch_id, req.user!.id, req.user!.name, transferId, `Requested transfer ${transferNumber}`]);
    });

    res.status(201).json({ success: true, transferId, transferNumber });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create stock transfer request.' });
  }
});

// Transition transfer status (APPROVED -> DISPATCHED -> RECEIVED)
apiRouter.put('/transfers/:id/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const transferId = req.params.id;
    const { next_status } = req.body;

    const trfRes = await query(`
      SELECT * FROM stock_transfers WHERE id = $1 AND organization_id = $2
    `, [transferId, orgId]);

    if (trfRes.rows.length === 0) {
      res.status(404).json({ error: 'Transfer not found.' });
      return;
    }

    const trf = trfRes.rows[0];
    const itemsRes = await query(`SELECT * FROM stock_transfer_items WHERE transfer_id = $1`, [transferId]);
    const items = itemsRes.rows;

    await transaction(async (tx) => {
      if (next_status === 'APPROVED') {
        await tx.query(`
          UPDATE stock_transfers SET status = 'APPROVED', approved_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [req.user!.id, transferId]);
      } else if (next_status === 'DISPATCHED') {
        // Deduct from source branch
        for (const item of items) {
          // Non-serialized or multiple items
          await tx.query(`
            INSERT INTO stock_movements (id, organization_id, branch_id, product_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
            VALUES ($1, $2, $3, $4, $5, 'TRANSFER_OUT', 'TRANSFER', $6, $7, $8)
          `, [`mov-trf-out-${Date.now()}-${Math.random()}`, orgId, trf.source_branch_id, item.product_id, -Number(item.quantity), transferId, req.user!.id, `Dispatched transfer ${trf.transfer_number}`]);

          // Update serials to 'Transferred'
          if (item.serial_numbers && item.serial_numbers.length > 0) {
            for (const sn of item.serial_numbers) {
              await tx.query(`
                UPDATE product_serials SET status = 'Transferred', current_location = 'In transit to ' || $1
                WHERE organization_id = $2 AND product_id = $3 AND LOWER(serial_number) = LOWER($4)
              `, [trf.destination_branch_id, orgId, item.product_id, sn.trim()]);
            }
          }
        }

        await tx.query(`
          UPDATE stock_transfers SET status = 'DISPATCHED', dispatched_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [req.user!.id, transferId]);
      } else if (next_status === 'RECEIVED') {
        // Add into destination branch
        for (const item of items) {
          await tx.query(`
            INSERT INTO stock_movements (id, organization_id, branch_id, product_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
            VALUES ($1, $2, $3, $4, $5, 'TRANSFER_IN', 'TRANSFER', $6, $7, $8)
          `, [`mov-trf-in-${Date.now()}-${Math.random()}`, orgId, trf.destination_branch_id, item.product_id, Number(item.quantity), transferId, req.user!.id, `Received transfer ${trf.transfer_number}`]);

          // Update serial location and branch_id to destination branch!
          if (item.serial_numbers && item.serial_numbers.length > 0) {
            for (const sn of item.serial_numbers) {
              await tx.query(`
                UPDATE product_serials 
                SET branch_id = $1, status = 'In Stock', current_location = 'Received from transfer ' || $2
                WHERE organization_id = $3 AND product_id = $4 AND LOWER(serial_number) = LOWER($5)
              `, [trf.destination_branch_id, trf.transfer_number, orgId, item.product_id, sn.trim()]);
            }
          }
        }

        await tx.query(`
          UPDATE stock_transfers SET status = 'COMPLETED', received_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `, [req.user!.id, transferId]);
      }

      await tx.query(`
        INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
        VALUES ($1, $2, $3, $4, $5, 'UPDATE_TRANSFER_STATUS', 'TRANSFER', $6, $7)
      `, [`aud-${Date.now()}`, orgId, trf.source_branch_id, req.user!.id, req.user!.name, transferId, `Updated transfer ${trf.transfer_number} to ${next_status}`]);
    });

    res.json({ success: true, status: next_status });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update transfer status.' });
  }
});

// ==========================================
// 8. POS CHECKOUT & ATOMIC SALES TRANSACTION
// ==========================================

apiRouter.post('/pos/checkout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    let effectiveBranch = getAuthorizedBranchId(req, req.body.branch_id) || req.user!.branch_id;

    if (!effectiveBranch) {
      // Fallback to first branch in the organization if cashier/owner has no branch explicitly set
      const defBranch = await query(`SELECT id FROM branches WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 1`, [orgId]);
      if (defBranch.rows.length > 0) {
        effectiveBranch = defBranch.rows[0].id;
      }
    }

    if (!effectiveBranch) {
      res.status(400).json({ error: 'No active branch available in the organization to process sales.' });
      return;
    }

    const { customer_id, items, payments, discount, notes, coupon_code } = req.body;

    if (!items || !items.length) {
      res.status(400).json({ error: 'Cart cannot be empty.' });
      return;
    }

    // Get branch code for invoice number generation
    const brRes = await query(`SELECT branch_code, branch_name FROM branches WHERE id = $1`, [effectiveBranch]);
    const branchCode = brRes.rows[0]?.branch_code || 'BR';

    // Count today's sales for this branch to generate clean sequence
    const year = new Date().getFullYear();
    const countRes = await query(`
      SELECT COUNT(*) as count FROM sales WHERE organization_id = $1 AND branch_id = $2
    `, [orgId, effectiveBranch]);
    const seq = parseInt(countRes.rows[0].count, 10) + 1;
    const invoiceNumber = `${branchCode}-${year}-${String(seq).padStart(6, '0')}`;

    const saleId = `sale-${Date.now().toString(36)}`;
    let totalSubtotal = 0;
    let totalTax = 0;

    // Calculate subtotal and tax
    for (const item of items) {
      const lineSub = Number(item.unit_price) * Number(item.quantity);
      const lineDisc = Number(item.discount) || 0;
      const netLine = lineSub - lineDisc;
      const lineTax = netLine * ((Number(item.tax_rate) || 0) / 100);
      totalSubtotal += netLine;
      totalTax += lineTax;
    }

    const overallDiscount = Number(discount) || 0;
    const finalTotal = Math.max(0, totalSubtotal - overallDiscount + totalTax);

    // Sum payments
    let paidAmount = 0;
    if (payments && Array.isArray(payments)) {
      for (const p of payments) {
        paidAmount += Number(p.amount) || 0;
      }
    }

    const balanceDue = Math.max(0, finalTotal - paidAmount);
    let paymentStatus = 'PAID';
    if (balanceDue > 0 && paidAmount > 0) paymentStatus = 'PARTIAL';
    else if (balanceDue > 0 && paidAmount === 0) paymentStatus = 'UNPAID';

    // Verify credit limit if customer has balance due
    if (balanceDue > 0 && customer_id) {
      const custCheck = await query(`SELECT credit_limit, balance FROM customers WHERE id = $1 AND organization_id = $2`, [customer_id, orgId]);
      if (custCheck.rows.length > 0) {
        const cust = custCheck.rows[0];
        const newBalance = Number(cust.balance) + balanceDue;
        if (Number(cust.credit_limit) > 0 && newBalance > Number(cust.credit_limit)) {
          res.status(400).json({ error: `Credit sale exceeds customer credit limit! Limit: $${cust.credit_limit}, Current: $${cust.balance}, Attempted new total: $${newBalance.toFixed(2)}` });
          return;
        }
      }
    }

    // Run ATOMIC transaction
    await transaction(async (tx) => {
      // 1. Create Sale
      await tx.query(`
        INSERT INTO sales (
          id, organization_id, branch_id, customer_id, invoice_number, sale_date,
          subtotal, discount, tax, total, paid_amount, balance_due, payment_status,
          sale_status, cashier_id, notes, coupon_code
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8, $9, $10, $11, $12, 'COMPLETED', $13, $14, $15)
      `, [
        saleId, orgId, effectiveBranch, customer_id || null, invoiceNumber,
        totalSubtotal, overallDiscount, totalTax, finalTotal, paidAmount, balanceDue,
        paymentStatus, req.user!.id, notes || null, coupon_code ? coupon_code.trim().toUpperCase() : null
      ]);

      if (coupon_code) {
        await tx.query(`
          UPDATE promotions 
          SET times_used = times_used + 1 
          WHERE organization_id = $1 AND UPPER(code) = UPPER($2)
        `, [orgId, coupon_code.trim()]);
      }

      // 2. Create Sale Items, Deduct Stock, and Update Serials
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const saleItemId = `si-${saleId}-${i + 1}`;

        let effectiveProductId = item.product_id;
        if (!effectiveProductId) {
          // Look up product by name or sku in this organization
          const pLookup = await tx.query(`
            SELECT id, purchase_price, warranty_period FROM products 
            WHERE organization_id = $1 AND (LOWER(product_name) = LOWER($2) OR LOWER(sku) = LOWER($2)) 
            LIMIT 1
          `, [orgId, item.product_name || 'MISC']);

          if (pLookup.rows.length > 0) {
            effectiveProductId = pLookup.rows[0].id;
          } else {
            // Find any existing active product or fallback
            const anyP = await tx.query(`SELECT id FROM products WHERE organization_id = $1 LIMIT 1`, [orgId]);
            if (anyP.rows.length > 0) {
              effectiveProductId = anyP.rows[0].id;
            } else {
              const newProdId = `prod-misc-${Date.now()}`;
              await tx.query(`
                INSERT INTO products (id, organization_id, product_name, sku, category, selling_price, purchase_price, stock_quantity)
                VALUES ($1, $2, 'General Retail Item', 'SKU-GEN', 'Accessories', $3, $4, 999)
              `, [newProdId, orgId, Number(item.unit_price) || 0, Number(item.unit_cost) || 0]);
              effectiveProductId = newProdId;
            }
          }
        }

        const prodRes = await tx.query(`SELECT purchase_price, warranty_period FROM products WHERE id = $1`, [effectiveProductId]);
        const costPrice = Number(prodRes.rows[0]?.purchase_price) || 0;
        const warrantyDays = Number(prodRes.rows[0]?.warranty_period) || 0;

        const lineSub = Number(item.unit_price) * Number(item.quantity);
        const lineDisc = Number(item.discount) || 0;
        const netLine = lineSub - lineDisc;
        const lineTax = netLine * ((Number(item.tax_rate) || 0) / 100);
        const itemTotalPrice = netLine + lineTax;

        await tx.query(`
          INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, cost_price, discount, tax, total_price, serial_numbers)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          saleItemId, saleId, effectiveProductId, Number(item.quantity),
          Number(item.unit_price), costPrice, lineDisc, lineTax, itemTotalPrice,
          item.serial_numbers || []
        ]);

        // Stock movement
        if (item.serial_numbers && item.serial_numbers.length > 0) {
          for (const sn of item.serial_numbers) {
            // Find serial id
            const serRes = await tx.query(`
              SELECT id FROM product_serials 
              WHERE organization_id = $1 AND product_id = $2 AND LOWER(serial_number) = LOWER($3)
            `, [orgId, effectiveProductId, sn.trim()]);

            const serialId = serRes.rows[0]?.id || null;

            // Update serial status to Sold and set warranty
            await tx.query(`
              UPDATE product_serials
              SET status = 'Sold', sale_id = $1, customer_id = $2, selling_price = $3,
                  warranty_start = CURRENT_TIMESTAMP,
                  warranty_end = CURRENT_TIMESTAMP + ($4 || ' days')::interval,
                  current_location = 'Sold to customer'
              WHERE id = $5
            `, [saleId, customer_id || null, Number(item.unit_price), warrantyDays, serialId]);

            // Stock movement for this serial
            await tx.query(`
              INSERT INTO stock_movements (id, organization_id, branch_id, product_id, serial_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
              VALUES ($1, $2, $3, $4, $5, -1, 'SALE', 'INVOICE', $6, $7, $8)
            `, [`mov-${Date.now()}-${Math.random()}`, orgId, effectiveBranch, effectiveProductId, serialId, saleId, req.user!.id, `Sold on invoice ${invoiceNumber} (SN: ${sn})`]);
          }
        } else {
          // Non-serialized item stock deduction
          await tx.query(`
            INSERT INTO stock_movements (id, organization_id, branch_id, product_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
            VALUES ($1, $2, $3, $4, $5, 'SALE', 'INVOICE', $6, $7, $8)
          `, [`mov-${Date.now()}-${Math.random()}`, orgId, effectiveBranch, effectiveProductId, -Number(item.quantity), saleId, req.user!.id, `Sold on invoice ${invoiceNumber}`]);
        }
      }

      // 3. Record Split Payments
      if (payments && Array.isArray(payments)) {
        for (const p of payments) {
          if (Number(p.amount) > 0) {
            await tx.query(`
              INSERT INTO sale_payments (id, sale_id, organization_id, branch_id, payment_method, amount, reference_number)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [`sp-${Date.now()}-${Math.random()}`, saleId, orgId, effectiveBranch, p.method, Number(p.amount), p.reference || null]);

            // If cash payment and active register session, log to cash transactions
            if (p.method === 'Cash') {
              const activeSession = await tx.query(`
                SELECT id FROM cash_sessions WHERE organization_id = $1 AND branch_id = $2 AND status = 'OPEN' LIMIT 1
              `, [orgId, effectiveBranch]);

              if (activeSession.rows.length > 0) {
                await tx.query(`
                  INSERT INTO cash_transactions (id, organization_id, branch_id, session_id, transaction_type, amount, reference_type, reference_id, description)
                  VALUES ($1, $2, $3, $4, 'SALE_CASH', $5, 'SALE', $6, $7)
                `, [`ct-${Date.now()}-${Math.random()}`, orgId, effectiveBranch, activeSession.rows[0].id, Number(p.amount), saleId, `Cash sale invoice ${invoiceNumber}`]);
              }
            }
          }
        }
      }

      // 4. Update Customer Balance if Credit Sale
      if (balanceDue > 0 && customer_id) {
        await tx.query(`
          UPDATE customers SET balance = balance + $1 WHERE id = $2 AND organization_id = $3
        `, [balanceDue, customer_id, orgId]);
      }

      // 5. Audit Log
      await tx.query(`
        INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
        VALUES ($1, $2, $3, $4, $5, 'SALE_COMPLETED', 'SALE', $6, $7)
      `, [`aud-${Date.now()}`, orgId, effectiveBranch, req.user!.id, req.user!.name, saleId, `Completed invoice ${invoiceNumber} ($${finalTotal.toFixed(2)})`]);
    });

    res.status(201).json({
      success: true,
      saleId,
      invoiceNumber,
      total: finalTotal,
      paidAmount,
      balanceDue,
    });
  } catch (err: any) {
    console.error('POS Checkout error:', err);
    res.status(500).json({ error: err.message || 'Failed to complete POS sale transaction.' });
  }
});

// ==========================================
// 9. SALES INVOICE VIEW & CANCELLATION
// ==========================================

apiRouter.get('/sales', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const search = (req.query.search as string) || '';

    const params: any[] = [orgId];
    let sql = `
      SELECT 
        s.id, s.invoice_number, s.sale_date, s.subtotal, s.discount, s.tax,
        s.total, s.paid_amount, s.balance_due, s.payment_status, s.sale_status,
        b.branch_name, b.branch_code,
        u.name as cashier_name,
        cust.name as customer_name, cust.phone as customer_phone
      FROM sales s
      LEFT JOIN branches b ON b.id = s.branch_id
      LEFT JOIN users u ON u.id = s.cashier_id
      LEFT JOIN customers cust ON cust.id = s.customer_id
      WHERE s.organization_id = $1
    `;

    if (branchId && branchId !== 'ALL') {
      params.push(branchId);
      sql += ` AND s.branch_id = $${params.length}`;
    }

    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(s.invoice_number) LIKE $${params.length} OR LOWER(COALESCE(cust.name, 'walk-in retail customer')) LIKE $${params.length} OR LOWER(u.name) LIKE $${params.length})`;
    }

    sql += ` ORDER BY s.sale_date DESC LIMIT 100`;

    const salesRes = await query(sql, params);
    res.json({ sales: salesRes.rows });
  } catch (err: any) {
    console.error('Failed to fetch sales records:', err);
    res.status(500).json({ error: 'Failed to fetch sales records.' });
  }
});

apiRouter.get('/sales/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const saleId = req.params.id;
    const branchId = getAuthorizedBranchId(req);

    const saleRes = await query(`
      SELECT 
        s.*,
        b.branch_name, b.branch_code, b.phone as branch_phone, b.address as branch_address, b.city as branch_city,
        o.business_name, o.currency, o.tax_number as org_tax_number, o.logo as org_logo,
        u.name as cashier_name,
        cust.name as customer_name, cust.phone as customer_phone, cust.email as customer_email, cust.address as customer_address
      FROM sales s
      LEFT JOIN branches b ON b.id = s.branch_id
      LEFT JOIN organizations o ON o.id = s.organization_id
      LEFT JOIN users u ON u.id = s.cashier_id
      LEFT JOIN customers cust ON cust.id = s.customer_id
      WHERE s.id = $1 AND s.organization_id = $2 AND ($3::text IS NULL OR s.branch_id = $3)
    `, [saleId, orgId, branchId]);

    if (saleRes.rows.length === 0) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }

    const sale = saleRes.rows[0];

    // Items
    const itemsRes = await query(`
      SELECT 
        si.*,
        p.product_name, p.sku, p.unit, p.warranty_period
      FROM sale_items si
      LEFT JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = $1
    `, [saleId]);

    // Payments
    const paymentsRes = await query(`
      SELECT * FROM sale_payments WHERE sale_id = $1 ORDER BY created_at ASC
    `, [saleId]);

    res.json({
      sale,
      items: itemsRes.rows,
      payments: paymentsRes.rows,
    });
  } catch (err: any) {
    console.error('Failed to fetch invoice details:', err);
    res.status(500).json({ error: 'Failed to fetch invoice details.' });
  }
});

// Sale Cancellation (Rule: Never delete permanently, record reversal stock & payment movements)
apiRouter.post('/sales/:id/cancel', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const saleId = req.params.id;
    const { reason } = req.body;

    const saleRes = await query(`
      SELECT * FROM sales WHERE id = $1 AND organization_id = $2
    `, [saleId, orgId]);

    if (saleRes.rows.length === 0) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }

    const sale = saleRes.rows[0];
    if (sale.sale_status === 'CANCELLED') {
      res.status(400).json({ error: 'This sale is already cancelled.' });
      return;
    }

    const itemsRes = await query(`SELECT * FROM sale_items WHERE sale_id = $1`, [saleId]);

    await transaction(async (tx) => {
      // 1. Mark sale as CANCELLED
      await tx.query(`
        UPDATE sales SET sale_status = 'CANCELLED', notes = COALESCE(notes, '') || ' [Cancelled: ' || $1 || ']'
        WHERE id = $2
      `, [reason || 'Manager cancellation', saleId]);

      // 2. Reverse stock movements and restore serial statuses
      for (const item of itemsRes.rows) {
        if (item.serial_numbers && item.serial_numbers.length > 0) {
          for (const sn of item.serial_numbers) {
            const serRes = await tx.query(`
              SELECT id FROM product_serials WHERE organization_id = $1 AND product_id = $2 AND LOWER(serial_number) = LOWER($3)
            `, [orgId, item.product_id, sn.trim()]);

            const serialId = serRes.rows[0]?.id || null;

            // Reset serial to 'In Stock'
            await tx.query(`
              UPDATE product_serials
              SET status = 'In Stock', sale_id = NULL, customer_id = NULL,
                  warranty_start = NULL, warranty_end = NULL, current_location = 'Restocked upon sale cancellation'
              WHERE id = $1
            `, [serialId]);

            // Reversal stock movement
            await tx.query(`
              INSERT INTO stock_movements (id, organization_id, branch_id, product_id, serial_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
              VALUES ($1, $2, $3, $4, $5, 1, 'STOCK_ADJUSTMENT', 'CANCELLATION', $6, $7, $8)
            `, [`mov-${Date.now()}-${Math.random()}`, orgId, sale.branch_id, item.product_id, serialId, saleId, req.user!.id, `Reversed from cancelled invoice ${sale.invoice_number}`]);
          }
        } else {
          // Reversal movement for non-serialized items
          await tx.query(`
            INSERT INTO stock_movements (id, organization_id, branch_id, product_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
            VALUES ($1, $2, $3, $4, $5, 'STOCK_ADJUSTMENT', 'CANCELLATION', $6, $7, $8)
          `, [`mov-${Date.now()}-${Math.random()}`, orgId, sale.branch_id, item.product_id, Number(item.quantity), saleId, req.user!.id, `Reversed from cancelled invoice ${sale.invoice_number}`]);
        }
      }

      // 3. Reverse customer credit balance if sale had unpaid balance
      if (Number(sale.balance_due) > 0 && sale.customer_id) {
        await tx.query(`
          UPDATE customers SET balance = balance - $1 WHERE id = $2 AND organization_id = $3
        `, [Number(sale.balance_due), sale.customer_id, orgId]);
      }

      // 4. Audit Log
      await tx.query(`
        INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
        VALUES ($1, $2, $3, $4, $5, 'CANCEL_SALE', 'SALE', $6, $7)
      `, [`aud-${Date.now()}`, orgId, sale.branch_id, req.user!.id, req.user!.name, saleId, `Cancelled sale ${sale.invoice_number}: ${reason}`]);
    });

    res.json({ success: true, message: `Invoice ${sale.invoice_number} successfully cancelled and stock restored.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to cancel invoice.' });
  }
});

// ==========================================
// 10. SALES RETURNS
// ==========================================

apiRouter.get('/returns', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);

    const params: any[] = [orgId];
    let branchClause = '';
    if (branchId) {
      params.push(branchId);
      branchClause = `AND sr.branch_id = $2`;
    }

    const returns = await query(`
      SELECT 
        sr.*,
        s.invoice_number as original_invoice,
        cust.name as customer_name,
        u.name as processed_by_name,
        b.branch_name, b.branch_code
      FROM sales_returns sr
      JOIN sales s ON s.id = sr.sale_id
      JOIN branches b ON b.id = sr.branch_id
      LEFT JOIN customers cust ON cust.id = sr.customer_id
      LEFT JOIN users u ON u.id = sr.processed_by
      WHERE sr.organization_id = $1 ${branchClause}
      ORDER BY sr.created_at DESC
    `, params);

    res.json({ returns: returns.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch returns.' });
  }
});

apiRouter.post('/returns', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { sale_id, items, refund_amount, refund_method, return_reason } = req.body;

    if (!sale_id || !items || !items.length) {
      res.status(400).json({ error: 'Original sale and returned items are required.' });
      return;
    }

    const saleRes = await query(`SELECT * FROM sales WHERE id = $1 AND organization_id = $2`, [sale_id, orgId]);
    if (saleRes.rows.length === 0) {
      res.status(404).json({ error: 'Original invoice not found.' });
      return;
    }

    const sale = saleRes.rows[0];
    const returnId = `ret-${Date.now().toString(36)}`;
    const returnNumber = `RET-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    await transaction(async (tx) => {
      await tx.query(`
        INSERT INTO sales_returns (id, organization_id, branch_id, sale_id, return_number, customer_id, refund_amount, refund_method, return_reason, processed_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [returnId, orgId, sale.branch_id, sale_id, returnNumber, sale.customer_id || null, Number(refund_amount) || 0, refund_method || 'Cash', return_reason || 'Defective', req.user!.id]);

      for (const item of items) {
        await tx.query(`
          INSERT INTO sales_return_items (id, return_id, sale_item_id, product_id, quantity, unit_price, serial_numbers, restocked)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        `, [`ri-${Date.now()}-${Math.random()}`, returnId, item.sale_item_id || null, item.product_id, Number(item.quantity), Number(item.unit_price) || 0, item.serial_numbers || []]);

        // Restock product via SALE_RETURN movement
        await tx.query(`
          INSERT INTO stock_movements (id, organization_id, branch_id, product_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
          VALUES ($1, $2, $3, $4, $5, 'SALE_RETURN', 'RETURN', $6, $7, $8)
        `, [`mov-${Date.now()}-${Math.random()}`, orgId, sale.branch_id, item.product_id, Number(item.quantity), returnId, req.user!.id, `Restocked from return ${returnNumber}`]);

        // If serialized, update serial status
        if (item.serial_numbers && item.serial_numbers.length > 0) {
          for (const sn of item.serial_numbers) {
            await tx.query(`
              UPDATE product_serials
              SET status = 'Returned', current_location = 'Returned to ' || $1
              WHERE organization_id = $2 AND product_id = $3 AND LOWER(serial_number) = LOWER($4)
            `, [sale.branch_id, orgId, item.product_id, sn.trim()]);
          }
        }
      }

      await tx.query(`
        UPDATE sales SET return_status = 'RETURNED' WHERE id = $1
      `, [sale_id]);

      // If Cash refund, log to cash_transactions if active shift session is open
      if (refund_method === 'Cash' && Number(refund_amount) > 0) {
        const activeSess = await tx.query(`
          SELECT id FROM cash_sessions WHERE organization_id = $1 AND branch_id = $2 AND status = 'OPEN' LIMIT 1
        `, [orgId, sale.branch_id]);
        if (activeSess.rows.length > 0) {
          await tx.query(`
            INSERT INTO cash_transactions (id, organization_id, branch_id, session_id, transaction_type, amount, reference_type, reference_id, description)
            VALUES ($1, $2, $3, $4, 'REFUND_CASH', $5, 'RETURN', $6, $7)
          `, [`ct-${Date.now()}-${Math.random()}`, orgId, sale.branch_id, activeSess.rows[0].id, Number(refund_amount), returnId, `Cash refund for return ${returnNumber}`]);
        }
      }

      await tx.query(`
        INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
        VALUES ($1, $2, $3, $4, $5, 'PROCESS_RETURN', 'RETURN', $6, $7)
      `, [`aud-${Date.now()}`, orgId, sale.branch_id, req.user!.id, req.user!.name, returnId, `Processed return ${returnNumber} for invoice ${sale.invoice_number}`]);
    });

    res.status(201).json({ success: true, returnNumber });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process return.' });
  }
});

// ==========================================
// 11. CASH REGISTER & SHIFT SESSIONS
// ==========================================

apiRouter.get('/cash-register/current', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req) || req.user!.branch_id;

    if (!branchId) {
      res.json({ session: null, register: null });
      return;
    }

    // Active session for this branch & user or register
    const sessionRes = await query(`
      SELECT 
        cs.*,
        cr.register_name,
        u.name as cashier_name
      FROM cash_sessions cs
      JOIN cash_registers cr ON cr.id = cs.register_id
      JOIN users u ON u.id = cs.user_id
      WHERE cs.organization_id = $1 AND cs.branch_id = $2 AND cs.status = 'OPEN'
      ORDER BY cs.opened_at DESC
      LIMIT 1
    `, [orgId, branchId]);

    let session = sessionRes.rows[0] || null;

    if (session) {
      const transRes = await query(`
        SELECT 
          COALESCE(SUM(CASE WHEN transaction_type = 'SALE_CASH' THEN amount ELSE 0 END), 0) as cash_sales,
          COALESCE(SUM(CASE WHEN transaction_type = 'DEPOSIT_CASH' THEN amount ELSE 0 END), 0) as cash_deposits,
          COALESCE(SUM(CASE WHEN transaction_type = 'EXPENSE_CASH' THEN amount ELSE 0 END), 0) as cash_expenses,
          COALESCE(SUM(CASE WHEN transaction_type = 'WITHDRAWAL_CASH' THEN amount ELSE 0 END), 0) as cash_withdrawals,
          COALESCE(SUM(CASE WHEN transaction_type = 'REFUND_CASH' THEN amount ELSE 0 END), 0) as cash_refunds
        FROM cash_transactions
        WHERE session_id = $1
      `, [session.id]);

      const cashSales = Number(transRes.rows[0]?.cash_sales || 0);
      const cashDeposits = Number(transRes.rows[0]?.cash_deposits || 0);
      const cashExpenses = Number(transRes.rows[0]?.cash_expenses || 0);
      const cashWithdrawals = Number(transRes.rows[0]?.cash_withdrawals || 0);
      const cashRefunds = Number(transRes.rows[0]?.cash_refunds || 0);

      const calculatedExpected = Number(session.opening_amount) + cashSales + cashDeposits - cashExpenses - cashWithdrawals - cashRefunds;

      session = {
        ...session,
        cash_sales: cashSales,
        cash_deposits: cashDeposits,
        cash_expenses: cashExpenses,
        cash_withdrawals: cashWithdrawals,
        cash_refunds: cashRefunds,
        calculated_expected: calculatedExpected,
      };
    }

    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch cash register status.' });
  }
});

apiRouter.get('/cash-register/sessions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);

    const params: any[] = [orgId];
    let branchClause = '';
    if (branchId) {
      params.push(branchId);
      branchClause = `AND cs.branch_id = $2`;
    }

    const sessionsRes = await query(`
      SELECT 
        cs.*,
        cr.register_name,
        u.name as cashier_name,
        b.branch_name, b.branch_code
      FROM cash_sessions cs
      JOIN cash_registers cr ON cr.id = cs.register_id
      JOIN users u ON u.id = cs.user_id
      JOIN branches b ON b.id = cs.branch_id
      WHERE cs.organization_id = $1 ${branchClause}
      ORDER BY cs.opened_at DESC
      LIMIT 100
    `, params);

    res.json({ sessions: sessionsRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch shift sessions.' });
  }
});

apiRouter.get('/cash-register/transactions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const sessionId = req.query.session_id as string;

    if (!sessionId) {
      res.status(400).json({ error: 'session_id query parameter is required.' });
      return;
    }

    const transRes = await query(`
      SELECT * FROM cash_transactions
      WHERE organization_id = $1 AND session_id = $2
      ORDER BY created_at DESC
    `, [orgId, sessionId]);

    res.json({ transactions: transRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch register transactions.' });
  }
});

apiRouter.post('/cash-register/transaction', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req) || req.user!.branch_id;
    const { session_id, type, amount, description } = req.body;

    if (!session_id || !type || !amount || Number(amount) <= 0) {
      res.status(400).json({ error: 'Session ID, valid transaction type (DEPOSIT_CASH or WITHDRAWAL_CASH), and positive amount required.' });
      return;
    }

    const sessRes = await query(`SELECT * FROM cash_sessions WHERE id = $1 AND organization_id = $2 AND status = 'OPEN'`, [session_id, orgId]);
    if (sessRes.rows.length === 0) {
      res.status(404).json({ error: 'Active open session not found.' });
      return;
    }

    const txType = type === 'WITHDRAWAL' || type === 'WITHDRAWAL_CASH' ? 'WITHDRAWAL_CASH' : 'DEPOSIT_CASH';
    const txId = `ct-${Date.now().toString(36)}`;

    await query(`
      INSERT INTO cash_transactions (id, organization_id, branch_id, session_id, transaction_type, amount, reference_type, description)
      VALUES ($1, $2, $3, $4, $5, $6, 'MANUAL_ADJUSTMENT', $7)
    `, [txId, orgId, branchId, session_id, txType, Number(amount), description || (txType === 'DEPOSIT_CASH' ? 'Cash float deposit' : 'Cash withdrawal / safe drop')]);

    await query(`
      INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
      VALUES ($1, $2, $3, $4, $5, 'CASH_DRAWER_TRANSACTION', 'CASH_SESSION', $6, $7)
    `, [`aud-${Date.now()}`, orgId, branchId, req.user!.id, req.user!.name, session_id, `${txType}: $${Number(amount).toFixed(2)} - ${description || ''}`]);

    res.status(201).json({ success: true, transactionId: txId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record cash transaction.' });
  }
});

apiRouter.post('/cash-register/open', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req) || req.user!.branch_id;
    const { opening_amount, notes } = req.body;

    if (!branchId) {
      res.status(400).json({ error: 'Active branch required to open register.' });
      return;
    }

    // Check if an open session already exists for this branch
    const existing = await query(`SELECT id FROM cash_sessions WHERE organization_id = $1 AND branch_id = $2 AND status = 'OPEN' LIMIT 1`, [orgId, branchId]);
    if (existing.rows.length > 0) {
      res.status(400).json({ error: 'There is already an active open shift session at this branch. Please close it first.' });
      return;
    }

    // Find or create active register for branch
    let regRes = await query(`SELECT id FROM cash_registers WHERE organization_id = $1 AND branch_id = $2 LIMIT 1`, [orgId, branchId]);
    let registerId: string;
    if (regRes.rows.length === 0) {
      registerId = `cr-${Date.now().toString(36)}`;
      await query(`
        INSERT INTO cash_registers (id, organization_id, branch_id, register_name, status)
        VALUES ($1, $2, $3, 'Register 01', 'ACTIVE')
      `, [registerId, orgId, branchId]);
    } else {
      registerId = regRes.rows[0].id;
    }

    const sessionId = `sess-${Date.now().toString(36)}`;

    await query(`
      INSERT INTO cash_sessions (id, organization_id, branch_id, register_id, user_id, opening_amount, status, opened_at, notes)
      VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', CURRENT_TIMESTAMP, $7)
    `, [sessionId, orgId, branchId, registerId, req.user!.id, Number(opening_amount) || 0, notes || 'Cashier shift opened']);

    await query(`
      INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
      VALUES ($1, $2, $3, $4, $5, 'OPEN_SHIFT', 'CASH_SESSION', $6, $7)
    `, [`aud-${Date.now()}`, orgId, branchId, req.user!.id, req.user!.name, sessionId, `Opened shift with opening float $${Number(opening_amount).toFixed(2)}`]);

    res.status(201).json({ success: true, sessionId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to open cash register.' });
  }
});

apiRouter.post('/cash-register/close', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { session_id, closing_amount, notes } = req.body;

    const sessRes = await query(`SELECT * FROM cash_sessions WHERE id = $1 AND organization_id = $2`, [session_id, orgId]);
    if (sessRes.rows.length === 0) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const sess = sessRes.rows[0];
    const transRes = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'SALE_CASH' THEN amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN transaction_type = 'DEPOSIT_CASH' THEN amount ELSE 0 END), 0) as cash_deposits,
        COALESCE(SUM(CASE WHEN transaction_type = 'EXPENSE_CASH' THEN amount ELSE 0 END), 0) as cash_expenses,
        COALESCE(SUM(CASE WHEN transaction_type = 'WITHDRAWAL_CASH' THEN amount ELSE 0 END), 0) as cash_withdrawals,
        COALESCE(SUM(CASE WHEN transaction_type = 'REFUND_CASH' THEN amount ELSE 0 END), 0) as cash_refunds
      FROM cash_transactions
      WHERE session_id = $1
    `, [session_id]);

    const cashSales = Number(transRes.rows[0]?.cash_sales || 0);
    const cashDeposits = Number(transRes.rows[0]?.cash_deposits || 0);
    const cashExpenses = Number(transRes.rows[0]?.cash_expenses || 0);
    const cashWithdrawals = Number(transRes.rows[0]?.cash_withdrawals || 0);
    const cashRefunds = Number(transRes.rows[0]?.cash_refunds || 0);

    const expected = Number(sess.opening_amount) + cashSales + cashDeposits - cashExpenses - cashWithdrawals - cashRefunds;
    const actual = Number(closing_amount) || 0;
    const difference = actual - expected;

    await query(`
      UPDATE cash_sessions
      SET closing_amount = $1, expected_amount = $2, difference = $3, status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, notes = COALESCE(notes, '') || ' [Closed: ' || $4 || ']'
      WHERE id = $5
    `, [actual, expected, difference, notes || 'Shift closed', session_id]);

    await query(`
      INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
      VALUES ($1, $2, $3, $4, $5, 'CLOSE_SHIFT', 'CASH_SESSION', $6, $7)
    `, [`aud-${Date.now()}`, orgId, sess.branch_id, req.user!.id, req.user!.name, session_id, `Closed shift: Actual $${actual.toFixed(2)}, Expected $${expected.toFixed(2)}, Diff: $${difference.toFixed(2)}`]);

    res.json({
      success: true,
      actual,
      expected,
      difference,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to close register.' });
  }
});

// ==========================================
// 12. EXPENSES (BRANCH-SPECIFIC)
// ==========================================

apiRouter.get('/expenses', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);

    const params: any[] = [orgId];
    let branchClause = '';
    if (branchId) {
      params.push(branchId);
      branchClause = `AND e.branch_id = $2`;
    }

    const expRes = await query(`
      SELECT 
        e.*,
        b.branch_name, b.branch_code,
        u.name as created_by_name
      FROM expenses e
      JOIN branches b ON b.id = e.branch_id
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.organization_id = $1 ${branchClause}
      ORDER BY e.expense_date DESC, e.created_at DESC
    `, params);

    res.json({ expenses: expRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch expenses.' });
  }
});

apiRouter.post('/expenses', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { branch_id, category, amount, payment_method, expense_date, description } = req.body;

    const effectiveBranch = getAuthorizedBranchId(req, branch_id) || req.user!.branch_id;
    if (!effectiveBranch || !category || !amount) {
      res.status(400).json({ error: 'Branch, expense category, and amount are required.' });
      return;
    }

    const expId = `exp-${Date.now().toString(36)}`;
    await query(`
      INSERT INTO expenses (id, organization_id, branch_id, category, amount, payment_method, expense_date, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [expId, orgId, effectiveBranch, category, Number(amount), payment_method || 'Cash', expense_date || new Date().toISOString().split('T')[0], description || null, req.user!.id]);

    // If Cash expense, log to current open shift if exists
    if (payment_method === 'Cash') {
      const sessRes = await query(`SELECT id FROM cash_sessions WHERE organization_id = $1 AND branch_id = $2 AND status = 'OPEN' LIMIT 1`, [orgId, effectiveBranch]);
      if (sessRes.rows.length > 0) {
        await query(`
          INSERT INTO cash_transactions (id, organization_id, branch_id, session_id, transaction_type, amount, reference_type, reference_id, description)
          VALUES ($1, $2, $3, $4, 'EXPENSE_CASH', $5, 'EXPENSE', $6, $7)
        `, [`ct-${Date.now()}`, orgId, effectiveBranch, sessRes.rows[0].id, Number(amount), expId, `Cash expense: ${category} - ${description || ''}`]);
      }
    }

    await query(`
      INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
      VALUES ($1, $2, $3, $4, $5, 'RECORD_EXPENSE', 'EXPENSE', $6, $7)
    `, [`aud-${Date.now()}`, orgId, effectiveBranch, req.user!.id, req.user!.name, expId, `Recorded expense $${Number(amount).toFixed(2)} (${category})`]);

    res.status(201).json({ success: true, expId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record expense.' });
  }
});

// ==========================================
// 13. CUSTOMERS & LEDGER
// ==========================================

apiRouter.get('/customers', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const search = (req.query.search as string) || '';

    const params: any[] = [orgId];
    let filterClause = '';
    if (branchId) {
      params.push(branchId);
      filterClause = 'AND c.branch_id = $2';
    }
    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const searchParam = `$${params.length}`;
      filterClause += ` AND (LOWER(c.name) LIKE ${searchParam} OR LOWER(c.phone) LIKE ${searchParam} OR LOWER(c.email) LIKE ${searchParam})`;
    }

    const custs = await query(`
      SELECT 
        c.*,
        b.branch_name,
        COUNT(s.id) as sales_count,
        COALESCE(SUM(s.total), 0) as total_spent
      FROM customers c
      LEFT JOIN branches b ON b.id = c.branch_id
      LEFT JOIN sales s ON s.customer_id = c.id AND s.sale_status = 'COMPLETED'
      WHERE c.organization_id = $1 ${filterClause}
      GROUP BY c.id, b.branch_name
      ORDER BY c.name ASC
    `, params);

    res.json({ customers: custs.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch customers.' });
  }
});

apiRouter.post('/customers', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { name, phone, email, address, city, customer_type, credit_limit, opening_balance, notes, branch_id } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Customer name is required.' });
      return;
    }

    const custId = `cust-${Date.now().toString(36)}`;
    let branch = getAuthorizedBranchId(req, branch_id) || req.user!.branch_id;
    if (!branch) {
      const defBranch = await query(`SELECT id FROM branches WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 1`, [orgId]);
      branch = defBranch.rows[0]?.id || null;
    }

    await query(`
      INSERT INTO customers (id, organization_id, branch_id, name, phone, email, address, city, customer_type, credit_limit, opening_balance, balance, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12)
    `, [
      custId, orgId, branch, name.trim(), phone || null, email || null,
      address || null, city || null, customer_type || 'RETAIL',
      Number(credit_limit) || 0, Number(opening_balance) || 0, notes || null
    ]);

    const createdCustomer = {
      id: custId,
      organization_id: orgId,
      branch_id: branch,
      name: name.trim(),
      phone: phone || null,
      email: email || null,
      address: address || null,
      city: city || null,
      customer_type: customer_type || 'RETAIL',
      credit_limit: Number(credit_limit) || 0,
      opening_balance: Number(opening_balance) || 0,
      balance: Number(opening_balance) || 0,
      notes: notes || null,
    };

    res.status(201).json({ success: true, custId, customer: createdCustomer });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create customer.' });
  }
});

// Customer Ledger (Invoices, Payments, Statement)
apiRouter.get('/customers/:id/ledger', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const custId = req.params.id;

    const custRes = await query(`SELECT * FROM customers WHERE id = $1 AND organization_id = $2`, [custId, orgId]);
    if (custRes.rows.length === 0) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    const invoices = await query(`
      SELECT id, invoice_number, sale_date as date, total, paid_amount, balance_due, payment_status, sale_status
      FROM sales
      WHERE customer_id = $1 AND organization_id = $2
      ORDER BY sale_date DESC
    `, [custId, orgId]);

    const payments = await query(`
      SELECT id, amount, payment_method, reference_number, notes, payment_date as date
      FROM customer_payments
      WHERE customer_id = $1 AND organization_id = $2
      ORDER BY payment_date DESC
    `, [custId, orgId]);

    res.json({
      customer: custRes.rows[0],
      invoices: invoices.rows,
      payments: payments.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch customer ledger.' });
  }
});

// Record customer account payment (Decreases outstanding balance)
apiRouter.post('/customers/:id/payments', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const custId = req.params.id;
    const { amount, payment_method, reference_number, notes } = req.body;

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      res.status(400).json({ error: 'Payment amount must be greater than zero.' });
      return;
    }

    const effectiveBranch = getAuthorizedBranchId(req) || req.user!.branch_id;
    if (!effectiveBranch) {
      res.status(400).json({ error: 'Branch is required to receive payment.' });
      return;
    }

    await transaction(async (tx) => {
      await tx.query(`
        INSERT INTO customer_payments (id, organization_id, branch_id, customer_id, amount, payment_method, reference_number, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [`cp-${Date.now()}`, orgId, effectiveBranch, custId, payAmount, payment_method || 'Cash', reference_number || null, notes || null, req.user!.id]);

      await tx.query(`
        UPDATE customers SET balance = balance - $1 WHERE id = $2 AND organization_id = $3
      `, [payAmount, custId, orgId]);

      await tx.query(`
        INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
        VALUES ($1, $2, $3, $4, $5, 'CUSTOMER_PAYMENT', 'CUSTOMER', $6, $7)
      `, [`aud-${Date.now()}`, orgId, effectiveBranch, req.user!.id, req.user!.name, custId, `Received customer payment of $${payAmount.toFixed(2)} (${payment_method})`]);
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record customer payment.' });
  }
});

// ==========================================
// 14. SUPPLIERS & PURCHASES
// ==========================================

apiRouter.get('/suppliers', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const params: any[] = [orgId];
    let branchClause = '';
    if (branchId) {
      params.push(branchId);
      branchClause = 'AND p.branch_id = $2';
    }
    const sups = await query(`
      SELECT 
        s.*,
        COUNT(p.id) as purchases_count,
        COALESCE(SUM(p.total), 0) as total_purchased
      FROM suppliers s
      LEFT JOIN purchases p ON p.supplier_id = s.id ${branchClause}
      WHERE s.organization_id = $1
        AND (p.id IS NOT NULL OR NOT EXISTS (
          SELECT 1 FROM purchases p_other
          WHERE p_other.supplier_id = s.id AND p_other.organization_id = $1
        ))
      GROUP BY s.id
      ORDER BY s.name ASC
    `, params);
    res.json({ suppliers: sups.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch suppliers.' });
  }
});

apiRouter.post('/suppliers', authenticate, requireRole(['TENANT_OWNER', 'INVENTORY_MANAGER', 'ACCOUNTANT', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { name, company, phone, email, address, tax_number, payment_terms, opening_balance, notes } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Supplier name is required.' });
      return;
    }

    const supId = `sup-${Date.now().toString(36)}`;
    await query(`
      INSERT INTO suppliers (id, organization_id, name, company, phone, email, address, tax_number, payment_terms, opening_balance, balance, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11)
    `, [supId, orgId, name.trim(), company || null, phone || null, email || null, address || null, tax_number || null, payment_terms || 'Net 30', Number(opening_balance) || 0, notes || null]);

    res.status(201).json({ success: true, supId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create supplier.' });
  }
});

apiRouter.get('/purchases', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);

    const params: any[] = [orgId];
    let branchClause = '';
    if (branchId) {
      params.push(branchId);
      branchClause = `AND p.branch_id = $2`;
    }

    const purs = await query(`
      SELECT 
        p.*,
        s.name as supplier_name, s.company as supplier_company,
        b.branch_name, b.branch_code,
        u.name as created_by_name
      FROM purchases p
      JOIN suppliers s ON s.id = p.supplier_id
      JOIN branches b ON b.id = p.branch_id
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.organization_id = $1 ${branchClause}
      ORDER BY p.purchase_date DESC
    `, params);

    res.json({ purchases: purs.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch purchases.' });
  }
});

apiRouter.post('/purchases', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'INVENTORY_MANAGER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { branch_id, supplier_id, invoice_number, items, discount, tax, paid_amount, notes } = req.body;

    const effectiveBranch = getAuthorizedBranchId(req, branch_id) || req.user!.branch_id;
    if (!effectiveBranch || !supplier_id || !items || !items.length) {
      res.status(400).json({ error: 'Branch, supplier, and purchase items are required.' });
      return;
    }

    const purchaseId = `pur-${Date.now().toString(36)}`;
    let subtotal = 0;
    for (const item of items) {
      subtotal += Number(item.unit_price) * Number(item.quantity);
    }

    const disc = Number(discount) || 0;
    const tx = Number(tax) || 0;
    const total = subtotal - disc + tx;
    const paid = Number(paid_amount) || 0;
    const balanceDue = Math.max(0, total - paid);
    let payStatus = 'PAID';
    if (balanceDue > 0 && paid > 0) payStatus = 'PARTIAL';
    else if (balanceDue > 0 && paid === 0) payStatus = 'UNPAID';

    await transaction(async (txClient) => {
      // 1. Create Purchase
      await txClient.query(`
        INSERT INTO purchases (id, organization_id, branch_id, supplier_id, invoice_number, purchase_date, subtotal, discount, tax, total, paid_amount, balance_due, payment_status, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [purchaseId, orgId, effectiveBranch, supplier_id, invoice_number || `PO-${Date.now()}`, subtotal, disc, tx, total, paid, balanceDue, payStatus, notes || null, req.user!.id]);

      // 2. Create Items & Stock Movements
      for (const item of items) {
        const itemTot = Number(item.unit_price) * Number(item.quantity);
        await txClient.query(`
          INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [`pi-${Date.now()}-${Math.random()}`, purchaseId, item.product_id, Number(item.quantity), Number(item.unit_price), itemTot]);

        // Serials if provided
        if (item.serials && Array.isArray(item.serials) && item.serials.length > 0) {
          for (const sn of item.serials) {
            const serId = `ser-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            await txClient.query(`
              INSERT INTO product_serials (id, organization_id, branch_id, product_id, serial_number, purchase_id, purchase_date, supplier_id, status, current_location)
              VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, 'In Stock', 'Received in purchase')
            `, [serId, orgId, effectiveBranch, item.product_id, sn.trim(), purchaseId, supplier_id]);

            await txClient.query(`
              INSERT INTO stock_movements (id, organization_id, branch_id, product_id, serial_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
              VALUES ($1, $2, $3, $4, $5, 1, 'PURCHASE', 'PURCHASE', $6, $7, $8)
            `, [`mov-${Date.now()}-${Math.random()}`, orgId, effectiveBranch, item.product_id, serId, purchaseId, req.user!.id, `Purchased (SN: ${sn})`]);
          }
        } else {
          // Non-serialized item movement
          await txClient.query(`
            INSERT INTO stock_movements (id, organization_id, branch_id, product_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
            VALUES ($1, $2, $3, $4, $5, 'PURCHASE', 'PURCHASE', $6, $7, $8)
          `, [`mov-${Date.now()}-${Math.random()}`, orgId, effectiveBranch, item.product_id, Number(item.quantity), purchaseId, req.user!.id, `Purchased from supplier invoice ${invoice_number}`]);
        }
      }

      // 3. Update Supplier Payable Balance if balance due
      if (balanceDue > 0) {
        await txClient.query(`
          UPDATE suppliers SET balance = balance + $1 WHERE id = $2 AND organization_id = $3
        `, [balanceDue, supplier_id, orgId]);
      }

      await txClient.query(`
        INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
        VALUES ($1, $2, $3, $4, $5, 'RECORD_PURCHASE', 'PURCHASE', $6, $7)
      `, [`aud-${Date.now()}`, orgId, effectiveBranch, req.user!.id, req.user!.name, purchaseId, `Created purchase order $${total.toFixed(2)}`]);
    });

    res.status(201).json({ success: true, purchaseId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record purchase order.' });
  }
});

// ==========================================
// 15. REPAIR & SERVICE TICKETS
// ==========================================

apiRouter.get('/repairs', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const status = req.query.status as string;

    const params: any[] = [orgId];
    let branchClause = '';
    if (branchId) {
      params.push(branchId);
      branchClause = `AND r.branch_id = $2`;
    }

    let statusClause = '';
    if (status) {
      params.push(status);
      statusClause = ` AND r.status = $${params.length}`;
    }

    const reps = await query(`
      SELECT 
        r.*,
        cust.name as customer_name, cust.phone as customer_phone, cust.email as customer_email,
        b.branch_name, b.branch_code,
        u.name as technician_name
      FROM repairs r
      JOIN customers cust ON cust.id = r.customer_id
      JOIN branches b ON b.id = r.branch_id
      LEFT JOIN users u ON u.id = r.technician_id
      WHERE r.organization_id = $1 ${branchClause} ${statusClause}
      ORDER BY r.created_at DESC
    `, params);

    res.json({ repairs: reps.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch repair tickets.' });
  }
});

apiRouter.post('/repairs', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { branch_id, customer_id, device, brand, model, serial_number, problem_description, estimated_completion, technician_id } = req.body;

    const effectiveBranch = getAuthorizedBranchId(req, branch_id) || req.user!.branch_id;
    if (!effectiveBranch || !customer_id || !device || !problem_description) {
      res.status(400).json({ error: 'Branch, customer, device, and problem description are required.' });
      return;
    }

    const countRes = await query(`SELECT COUNT(*) as count FROM repairs WHERE organization_id = $1`, [orgId]);
    const seq = parseInt(countRes.rows[0].count, 10) + 1;
    const ticketNumber = `REP-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
    const repairId = `rep-${Date.now().toString(36)}`;

    await query(`
      INSERT INTO repairs (id, organization_id, branch_id, ticket_number, customer_id, device, brand, model, serial_number, problem_description, estimated_completion, technician_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'RECEIVED')
    `, [repairId, orgId, effectiveBranch, ticketNumber, customer_id, device, brand || null, model || null, serial_number || null, problem_description, estimated_completion || null, technician_id || null]);

    res.status(201).json({ success: true, repairId, ticketNumber });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create repair ticket.' });
  }
});

apiRouter.put('/repairs/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const repairId = req.params.id;
    const { status, diagnosis, repair_notes, parts_cost, labor_cost, customer_cost, technician_id } = req.body;

    await query(`
      UPDATE repairs
      SET status = COALESCE($1, status),
          diagnosis = COALESCE($2, diagnosis),
          repair_notes = COALESCE($3, repair_notes),
          parts_cost = COALESCE($4, parts_cost),
          labor_cost = COALESCE($5, labor_cost),
          customer_cost = COALESCE($6, customer_cost),
          technician_id = COALESCE($7, technician_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND organization_id = $9
    `, [status, diagnosis, repair_notes, parts_cost, labor_cost, customer_cost, technician_id, repairId, orgId]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update repair ticket.' });
  }
});

// ==========================================
// 16. AUDIT LOGS
// ==========================================

apiRouter.get('/audit-logs', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'AUDITOR', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const logs = await query(`
      SELECT 
        al.*,
        b.branch_name, b.branch_code
      FROM audit_logs al
      LEFT JOIN branches b ON b.id = al.branch_id
      WHERE al.organization_id = $1 AND ($2::text IS NULL OR al.branch_id = $2)
      ORDER BY al.created_at DESC
      LIMIT 100
    `, [orgId, branchId]);
    res.json({ auditLogs: logs.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// ==========================================
// 17. USERS & STAFF MANAGEMENT
// ==========================================

apiRouter.get('/users', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const usersRes = await query(`
      SELECT 
        u.id, u.name, u.email, u.role_name, u.phone, u.status, u.created_at,
        b.id as branch_id, b.branch_name, b.branch_code
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.organization_id = $1 AND ($2::text IS NULL OR u.branch_id = $2)
      ORDER BY u.name ASC
    `, [orgId, branchId]);
    res.json({ users: usersRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

apiRouter.post('/users', authenticate, requireRole(['TENANT_OWNER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { name, email, password, role_name, branch_id, phone } = req.body;

    if (!name || !email || !password || !role_name) {
      res.status(400).json({ error: 'Name, email, password, and role are required.' });
      return;
    }

    const userId = `usr-${Date.now().toString(36)}`;
    const hash = bcrypt.hashSync(password, 10);

    await query(`
      INSERT INTO users (id, organization_id, branch_id, name, email, password_hash, role_name, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [userId, orgId, branch_id || null, name.trim(), email.trim().toLowerCase(), hash, role_name, phone || null]);

    res.status(201).json({ success: true, userId });
  } catch (err: any) {
    if (err.message && err.message.includes('unique')) {
      res.status(400).json({ error: 'Email already registered.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// ==========================================
// 18. SUPER ADMIN TENANTS OVERVIEW
// ==========================================

apiRouter.get('/tenants', authenticate, requireRole(['SUPER_ADMIN']), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgs = await query(`
      SELECT 
        o.*,
        COUNT(DISTINCT b.id) as branch_count,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT p.id) as product_count,
        COUNT(DISTINCT s.id) as sales_count,
        COALESCE(SUM(s.total), 0) as total_volume
      FROM organizations o
      LEFT JOIN branches b ON b.organization_id = o.id
      LEFT JOIN users u ON u.organization_id = o.id
      LEFT JOIN products p ON p.organization_id = o.id
      LEFT JOIN sales s ON s.organization_id = o.id AND s.sale_status = 'COMPLETED'
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    res.json({ tenants: orgs.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch tenants.' });
  }
});

// ==========================================
// 19. TRADE-INS & BUY-BACK MODULE
// ==========================================

apiRouter.get('/trade-ins', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);
    const status = req.query.status as string;

    const params: any[] = [orgId];
    let branchClause = '';
    if (branchId) {
      params.push(branchId);
      branchClause = `AND t.branch_id = $2`;
    }

    let statusClause = '';
    if (status && status !== 'ALL') {
      params.push(status);
      statusClause = ` AND t.status = $${params.length}`;
    }

    const tradeRes = await query(`
      SELECT 
        t.*,
        b.branch_name, b.branch_code,
        c.name as linked_customer_name, c.phone as linked_customer_phone, c.store_credit as customer_store_credit,
        u.name as technician_name,
        p.product_name as refurbished_product_name, p.sku as refurbished_product_sku
      FROM trade_ins t
      JOIN branches b ON b.id = t.branch_id
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN users u ON u.id = t.technician_id
      LEFT JOIN products p ON p.id = t.refurbished_product_id
      WHERE t.organization_id = $1 ${branchClause} ${statusClause}
      ORDER BY t.created_at DESC
    `, params);

    res.json({ tradeIns: tradeRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch trade-in records.' });
  }
});

apiRouter.post('/trade-ins', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const {
      branch_id, customer_id, customer_name, customer_phone, customer_id_number,
      device_type, brand, model, serial_number_imei, specs,
      condition_grade, checklist, valuation_amount, resell_estimate, payout_type, notes, technician_id
    } = req.body;

    const effectiveBranch = getAuthorizedBranchId(req, branch_id) || req.user!.branch_id;
    if (!effectiveBranch || !customer_name || !device_type) {
      res.status(400).json({ error: 'Branch, customer name, and device type are required.' });
      return;
    }

    const countRes = await query(`SELECT COUNT(*) as count FROM trade_ins WHERE organization_id = $1`, [orgId]);
    const seq = parseInt(countRes.rows[0].count, 10) + 1;
    const tradeNumber = `TRD-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
    const tradeId = `trd-${Date.now().toString(36)}`;
    const valAmt = Number(valuation_amount) || 0;
    const resEst = Number(resell_estimate) || 0;

    await transaction(async (txClient) => {
      await txClient.query(`
        INSERT INTO trade_ins (
          id, organization_id, branch_id, trade_number, customer_id, customer_name, customer_phone, customer_id_number,
          device_type, brand, model, serial_number_imei, specs, condition_grade, checklist,
          valuation_amount, resell_estimate, payout_type, status, technician_id, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, 'RECEIVED', $19, $20
        )
      `, [
        tradeId, orgId, effectiveBranch, tradeNumber, customer_id || null, customer_name.trim(), customer_phone || null, customer_id_number || null,
        device_type, brand || null, model || null, serial_number_imei || null, specs || null, condition_grade || 'B', JSON.stringify(checklist || {}),
        valAmt, resEst, payout_type || 'STORE_CREDIT', technician_id || req.user!.id, notes || null
      ]);

      // If store credit selected and customer exists, credit their account
      if (payout_type === 'STORE_CREDIT' && customer_id && valAmt > 0) {
        await txClient.query(`
          UPDATE customers
          SET store_credit = COALESCE(store_credit, 0) + $1
          WHERE id = $2 AND organization_id = $3
        `, [valAmt, customer_id, orgId]);
      }

      await txClient.query(`
        INSERT INTO audit_logs (id, organization_id, branch_id, user_id, user_name, action, entity, entity_id, new_value)
        VALUES ($1, $2, $3, $4, $5, 'CREATE_TRADE_IN', 'TRADE_IN', $6, $7)
      `, [`aud-${Date.now()}`, orgId, effectiveBranch, req.user!.id, req.user!.name, tradeId, `Intake trade-in ${tradeNumber} ($${valAmt})`]);
    });

    res.status(201).json({ success: true, tradeId, tradeNumber });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record trade-in intake.' });
  }
});

apiRouter.put('/trade-ins/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const tradeId = req.params.id;
    const { status, condition_grade, checklist, valuation_amount, resell_estimate, payout_type, notes, technician_id } = req.body;

    await query(`
      UPDATE trade_ins
      SET status = COALESCE($1, status),
          condition_grade = COALESCE($2, condition_grade),
          checklist = COALESCE($3, checklist),
          valuation_amount = COALESCE($4, valuation_amount),
          resell_estimate = COALESCE($5, resell_estimate),
          payout_type = COALESCE($6, payout_type),
          notes = COALESCE($7, notes),
          technician_id = COALESCE($8, technician_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND organization_id = $10
    `, [
      status, condition_grade, checklist ? JSON.stringify(checklist) : null,
      valuation_amount !== undefined ? Number(valuation_amount) : null,
      resell_estimate !== undefined ? Number(resell_estimate) : null,
      payout_type, notes, technician_id, tradeId, orgId
    ]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update trade-in record.' });
  }
});

// Convert trade-in to Refurbished Inventory Product
apiRouter.post('/trade-ins/:id/convert-to-product', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const tradeId = req.params.id;
    const { product_name, sku, selling_price, warranty_period, category_id, branch_id } = req.body;

    const tradeRes = await query(`SELECT * FROM trade_ins WHERE id = $1 AND organization_id = $2`, [tradeId, orgId]);
    if (tradeRes.rows.length === 0) {
      res.status(404).json({ error: 'Trade-in record not found.' });
      return;
    }

    const trade = tradeRes.rows[0];
    const effectiveBranch = branch_id || trade.branch_id;
    const prodId = `prod-refurb-${Date.now().toString(36)}`;
    const finalSku = (sku || `REF-${trade.trade_number.replace(/-/g, '')}`).toUpperCase().trim();
    const finalName = product_name || `[Refurbished Grade ${trade.condition_grade}] ${trade.brand || ''} ${trade.model || trade.device_type}`;
    const sellPrice = Number(selling_price) || Number(trade.resell_estimate) || (Number(trade.valuation_amount) * 1.35);
    const purchaseCost = Number(trade.valuation_amount) || 0;

    await transaction(async (txClient) => {
      // 1. Create Product
      await txClient.query(`
        INSERT INTO products (
          id, organization_id, sku, barcode, product_name, category_id, description,
          unit, purchase_price, selling_price, wholesale_price, minimum_selling_price,
          tax_rate, warranty_period, reorder_level, product_type, serial_tracking_enabled
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          'pcs', $8, $9, $10, $11,
          8.25, $12, 1, 'Refurbished', true
        )
      `, [
        prodId, orgId, finalSku, finalSku, finalName, category_id || null,
        `Certified Refurbished (Grade ${trade.condition_grade}). Specs: ${trade.specs || 'Tested & Inspected'}. Original Trade: ${trade.trade_number}`,
        purchaseCost, sellPrice, sellPrice * 0.95, sellPrice * 0.9,
        Number(warranty_period) || 90
      ]);

      // 2. Add 1 Stock Movement
      await txClient.query(`
        INSERT INTO stock_movements (id, organization_id, branch_id, product_id, quantity, movement_type, reference_type, reference_id, notes)
        VALUES ($1, $2, $3, $4, 1, 'TRADE_IN', 'TRADE_IN', $5, $6)
      `, [`mov-${Date.now()}-${Math.random()}`, orgId, effectiveBranch, prodId, tradeId, `Intake from Trade-in ${trade.trade_number}`]);

      // 3. Serial Number
      const serialNumber = trade.serial_number_imei || `SN-${finalSku}-01`;
      await txClient.query(`
        INSERT INTO product_serials (id, organization_id, branch_id, product_id, serial_number, status, current_location)
        VALUES ($1, $2, $3, $4, $5, 'In Stock', 'Refurbished Display')
      `, [`ser-${prodId}-01`, orgId, effectiveBranch, prodId, serialNumber]);

      // 4. Update Trade-in status to REFURBISHED and link product
      await txClient.query(`
        UPDATE trade_ins
        SET status = 'READY_FOR_SALE',
            refurbished_product_id = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND organization_id = $3
      `, [prodId, tradeId, orgId]);
    });

    res.json({ success: true, productId: prodId, sku: finalSku });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to convert trade-in to inventory product.' });
  }
});

// ==========================================
// 20. STAFF SALES TARGETS & COMMISSIONS
// ==========================================

apiRouter.get('/staff-targets', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const month = (req.query.month_period as string) || new Date().toISOString().slice(0, 7); // e.g. "2025-05"

    const targetsRes = await query(`
      SELECT 
        st.*,
        u.name as staff_name, u.email as staff_email, u.role_name as staff_role,
        b.branch_name, b.branch_code
      FROM staff_targets st
      JOIN users u ON u.id = st.user_id
      LEFT JOIN branches b ON b.id = st.branch_id
      WHERE st.organization_id = $1 AND st.month_period = $2
      ORDER BY u.name ASC
    `, [orgId, month]);

    res.json({ targets: targetsRes.rows, month_period: month });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch staff targets.' });
  }
});

apiRouter.post('/staff-targets', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { user_id, branch_id, month_period, sales_target, sales_commission_rate, repair_commission_rate, notes } = req.body;

    if (!user_id || !month_period) {
      res.status(400).json({ error: 'Staff member and month period are required.' });
      return;
    }

    const targetId = `st-${Date.now().toString(36)}`;
    await query(`
      INSERT INTO staff_targets (id, organization_id, branch_id, user_id, month_period, sales_target, sales_commission_rate, repair_commission_rate, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (organization_id, user_id, month_period)
      DO UPDATE SET
        sales_target = EXCLUDED.sales_target,
        sales_commission_rate = EXCLUDED.sales_commission_rate,
        repair_commission_rate = EXCLUDED.repair_commission_rate,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
    `, [
      targetId, orgId, branch_id || null, user_id, month_period,
      Number(sales_target) || 10000, Number(sales_commission_rate) || 2, Number(repair_commission_rate) || 15, notes || null
    ]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save staff target.' });
  }
});

apiRouter.get('/staff-performance', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const month = (req.query.month_period as string) || new Date().toISOString().slice(0, 7);

    // Fetch all active staff
    const staffRes = await query(`
      SELECT u.id, u.name, u.email, u.role_name, u.branch_id, b.branch_name, b.branch_code
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.organization_id = $1 AND u.status = 'ACTIVE'
      ORDER BY u.name ASC
    `, [orgId]);

    // Fetch targets for this month
    const targetsRes = await query(`
      SELECT * FROM staff_targets WHERE organization_id = $1 AND month_period = $2
    `, [orgId, month]);
    const targetMap = new Map();
    for (const t of targetsRes.rows) {
      targetMap.set(t.user_id, t);
    }

    // Actual sales in this month period
    const salesRes = await query(`
      SELECT 
        cashier_id as user_id,
        COUNT(id) as sale_count,
        COALESCE(SUM(total), 0) as total_sales
      FROM sales
      WHERE organization_id = $1 
        AND sale_status = 'COMPLETED'
        AND TO_CHAR(sale_date, 'YYYY-MM') = $2
        AND cashier_id IS NOT NULL
      GROUP BY cashier_id
    `, [orgId, month]);
    const salesMap = new Map();
    for (const s of salesRes.rows) {
      salesMap.set(s.user_id, s);
    }

    // Actual repair revenue in this month period
    const repairRes = await query(`
      SELECT 
        technician_id as user_id,
        COUNT(id) as repair_count,
        COALESCE(SUM(customer_cost), 0) as total_repair_revenue,
        COALESCE(SUM(labor_cost), 0) as total_labor_revenue
      FROM repairs
      WHERE organization_id = $1 
        AND status IN ('COLLECTED', 'COMPLETED', 'REPAIRED')
        AND TO_CHAR(updated_at, 'YYYY-MM') = $2
        AND technician_id IS NOT NULL
      GROUP BY technician_id
    `, [orgId, month]);
    const repairMap = new Map();
    for (const r of repairRes.rows) {
      repairMap.set(r.user_id, r);
    }

    // Build performance report
    const performance = staffRes.rows.map((user: any) => {
      const target = targetMap.get(user.id) || {
        sales_target: 10000,
        sales_commission_rate: 2,
        repair_commission_rate: 15,
      };
      const saleData = salesMap.get(user.id) || { sale_count: 0, total_sales: 0 };
      const repData = repairMap.get(user.id) || { repair_count: 0, total_repair_revenue: 0, total_labor_revenue: 0 };

      const actualSales = Number(saleData.total_sales);
      const salesTarget = Number(target.sales_target);
      const salesRate = Number(target.sales_commission_rate);
      const repairRate = Number(target.repair_commission_rate);
      const laborRev = Number(repData.total_labor_revenue);

      const salesCommission = (actualSales * salesRate) / 100;
      const repairCommission = (laborRev * repairRate) / 100;
      const totalCommission = salesCommission + repairCommission;
      const progressPercent = salesTarget > 0 ? Math.min(200, Math.round((actualSales / salesTarget) * 100)) : 0;

      return {
        user_id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name,
        branch_name: user.branch_name,
        branch_code: user.branch_code,
        month_period: month,
        sales_target: salesTarget,
        sales_commission_rate: salesRate,
        repair_commission_rate: repairRate,
        sales_count: Number(saleData.sale_count),
        actual_sales: actualSales,
        sales_commission: salesCommission,
        repair_count: Number(repData.repair_count),
        repair_revenue: Number(repData.total_repair_revenue),
        labor_revenue: laborRev,
        repair_commission: repairCommission,
        total_commission: totalCommission,
        progress_percent: progressPercent,
      };
    });

    res.json({ performance, month_period: month });
  } catch (err: any) {
    console.error('Staff performance calculation error:', err);
    res.status(500).json({ error: 'Failed to calculate staff performance.', details: err?.message || String(err) });
  }
});

// ==========================================
// 21. AUTO-REORDER SUGGESTIONS & PO MANAGEMENT
// ==========================================

apiRouter.get('/auto-reorder/suggestions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const branchId = getAuthorizedBranchId(req, req.query.branch_id as string);

    // Fetch products with their current stock calculated from stock_movements
    const prods = await query(`
      SELECT 
        p.id, p.sku, p.barcode, p.product_name, p.category_id, p.purchase_price, p.selling_price, p.reorder_level,
        c.name as category_name,
        COALESCE(SUM(sm.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stock_movements sm ON sm.product_id = p.id AND ($2::text IS NULL OR sm.branch_id = $2)
      WHERE p.organization_id = $1
      GROUP BY p.id, c.name
      HAVING COALESCE(SUM(sm.quantity), 0) <= p.reorder_level
      ORDER BY (p.reorder_level - COALESCE(SUM(sm.quantity), 0)) DESC
    `, [orgId, branchId || null]);

    // Fetch suppliers
    const sups = await query(`SELECT id, name, company FROM suppliers WHERE organization_id = $1 ORDER BY name ASC`, [orgId]);
    const defaultSupplier = sups.rows[0] || null;

    const suggestions = prods.rows.map((p: any) => {
      const stock = Number(p.current_stock);
      const reorderLevel = Number(p.reorder_level);
      // Suggested order brings stock to double reorder level, minimum 5
      const suggestedQty = Math.max(5, (reorderLevel * 2) - stock);
      const unitCost = Number(p.purchase_price);
      const estimatedTotal = suggestedQty * unitCost;

      return {
        product_id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        product_name: p.product_name,
        category_name: p.category_name,
        current_stock: stock,
        reorder_level: reorderLevel,
        suggested_quantity: suggestedQty,
        unit_price: unitCost,
        estimated_total: estimatedTotal,
        supplier_id: defaultSupplier?.id || null,
        supplier_name: defaultSupplier?.name || 'Primary Supplier',
      };
    });

    res.json({ suggestions, suppliers: sups.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate auto-reorder suggestions.' });
  }
});

// Update Purchase Order Status & Receive Stock
apiRouter.put('/purchases/:id/po-status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const purchaseId = req.params.id;
    const { po_status, expected_delivery_date, receive_all_stock } = req.body;

    const purRes = await query(`SELECT * FROM purchases WHERE id = $1 AND organization_id = $2`, [purchaseId, orgId]);
    if (purRes.rows.length === 0) {
      res.status(404).json({ error: 'Purchase order not found.' });
      return;
    }

    const purchase = purRes.rows[0];

    await transaction(async (txClient) => {
      await txClient.query(`
        UPDATE purchases
        SET po_status = COALESCE($1, po_status),
            expected_delivery_date = COALESCE($2, expected_delivery_date),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND organization_id = $4
      `, [po_status, expected_delivery_date || null, purchaseId, orgId]);

      // If user marks as RECEIVED or checks receive_all_stock, check if items already have movements
      if (po_status === 'RECEIVED' && receive_all_stock) {
        const movCheck = await txClient.query(`
          SELECT COUNT(*) as count FROM stock_movements WHERE reference_id = $1 AND reference_type = 'PURCHASE'
        `, [purchaseId]);

        if (parseInt(movCheck.rows[0].count, 10) === 0) {
          const itemsRes = await txClient.query(`SELECT * FROM purchase_items WHERE purchase_id = $1`, [purchaseId]);
          for (const item of itemsRes.rows) {
            await txClient.query(`
              INSERT INTO stock_movements (id, organization_id, branch_id, product_id, quantity, movement_type, reference_type, reference_id, user_id, notes)
              VALUES ($1, $2, $3, $4, $5, 'PURCHASE', 'PURCHASE', $6, $7, $8)
            `, [`mov-${Date.now()}-${Math.random()}`, orgId, purchase.branch_id, item.product_id, Number(item.quantity), purchaseId, req.user!.id, `Received delivery for PO ${purchase.invoice_number}`]);
          }
        }
      }
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update purchase order status.' });
  }
});

// ==========================================
// 22. PUBLIC & LIVE REPAIR TRACKING
// ==========================================

apiRouter.get('/repairs/track/:ticketNumber', async (req, res): Promise<void> => {
  try {
    const { ticketNumber } = req.params;
    if (!ticketNumber) {
      res.status(400).json({ error: 'Ticket number or repair code is required.' });
      return;
    }

    const cleanTicket = ticketNumber.trim().toUpperCase();
    const repairRes = await query(`
      SELECT 
        r.id, r.ticket_number, r.device, r.brand, r.model, r.problem_description,
        r.diagnosis, r.repair_notes, r.status, r.created_at, r.updated_at, r.estimated_completion,
        r.customer_cost,
        b.branch_name, b.branch_code,
        o.name as organization_name, o.phone as shop_phone, o.email as shop_email
      FROM repairs r
      JOIN branches b ON b.id = r.branch_id
      JOIN organizations o ON o.id = r.organization_id
      WHERE UPPER(r.ticket_number) = $1 OR r.id = $1
    `, [cleanTicket]);

    if (repairRes.rows.length === 0) {
      res.status(404).json({ error: 'Repair ticket not found. Please check your ticket code.' });
      return;
    }

    res.json({ ticket: repairRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to track repair ticket.' });
  }
});

// ==========================================
// 23. PROMOTIONS & DISCOUNT COUPONS
// ==========================================

apiRouter.get('/promotions', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { status } = req.query;

    let statusClause = '';
    const params: any[] = [orgId];

    if (status && status !== 'ALL') {
      params.push(status);
      statusClause = `AND status = $${params.length}`;
    }

    const promosRes = await query(`
      SELECT 
        id, organization_id, code, description, discount_type,
        discount_value, min_order_amount, max_discount_amount,
        valid_from, valid_until, usage_limit, times_used, status, created_at
      FROM promotions
      WHERE organization_id = $1 ${statusClause}
      ORDER BY created_at DESC
    `, params);

    res.json({ promotions: promosRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch promotions.' });
  }
});

apiRouter.post('/promotions', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const {
      code, description, discount_type, discount_value,
      min_order_amount, max_discount_amount, valid_from,
      valid_until, usage_limit, status
    } = req.body;

    if (!code || !code.trim()) {
      res.status(400).json({ error: 'Promotion code is required.' });
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    const type = discount_type === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
    const val = Number(discount_value) || 0;
    if (val <= 0) {
      res.status(400).json({ error: 'Discount value must be greater than 0.' });
      return;
    }

    if (type === 'PERCENTAGE' && val > 100) {
      res.status(400).json({ error: 'Percentage discount cannot exceed 100%.' });
      return;
    }

    // Check duplicate
    const dupCheck = await query(`SELECT id FROM promotions WHERE organization_id = $1 AND UPPER(code) = $2`, [orgId, cleanCode]);
    if (dupCheck.rows.length > 0) {
      res.status(400).json({ error: `Promotion code '${cleanCode}' already exists.` });
      return;
    }

    const promoId = `promo-${Date.now().toString(36)}`;
    await query(`
      INSERT INTO promotions (
        id, organization_id, code, description, discount_type,
        discount_value, min_order_amount, max_discount_amount,
        valid_from, valid_until, usage_limit, times_used, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12)
    `, [
      promoId, orgId, cleanCode, description || null, type,
      val, Number(min_order_amount) || 0, max_discount_amount ? Number(max_discount_amount) : null,
      valid_from || new Date().toISOString(), valid_until || null,
      usage_limit ? parseInt(usage_limit, 10) : null, status || 'ACTIVE'
    ]);

    res.json({ success: true, message: `Promotion '${cleanCode}' created successfully.`, id: promoId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create promotion.' });
  }
});

apiRouter.put('/promotions/:id', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { id } = req.params;
    const {
      description, discount_type, discount_value,
      min_order_amount, max_discount_amount, valid_from,
      valid_until, usage_limit, status
    } = req.body;

    const promoRes = await query(`SELECT * FROM promotions WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    if (promoRes.rows.length === 0) {
      res.status(404).json({ error: 'Promotion not found.' });
      return;
    }

    const cur = promoRes.rows[0];
    const type = discount_type ? (discount_type === 'FIXED' ? 'FIXED' : 'PERCENTAGE') : cur.discount_type;
    const val = discount_value !== undefined ? Number(discount_value) : Number(cur.discount_value);

    await query(`
      UPDATE promotions SET
        description = $1,
        discount_type = $2,
        discount_value = $3,
        min_order_amount = $4,
        max_discount_amount = $5,
        valid_from = $6,
        valid_until = $7,
        usage_limit = $8,
        status = $9
      WHERE id = $10 AND organization_id = $11
    `, [
      description !== undefined ? description : cur.description,
      type,
      val,
      min_order_amount !== undefined ? Number(min_order_amount) : cur.min_order_amount,
      max_discount_amount !== undefined ? (max_discount_amount ? Number(max_discount_amount) : null) : cur.max_discount_amount,
      valid_from !== undefined ? valid_from : cur.valid_from,
      valid_until !== undefined ? valid_until : cur.valid_until,
      usage_limit !== undefined ? (usage_limit ? parseInt(usage_limit, 10) : null) : cur.usage_limit,
      status || cur.status,
      id,
      orgId
    ]);

    res.json({ success: true, message: 'Promotion updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update promotion.' });
  }
});

apiRouter.delete('/promotions/:id', authenticate, requireRole(['TENANT_OWNER', 'BRANCH_MANAGER', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { id } = req.params;

    const promoRes = await query(`SELECT code FROM promotions WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    if (promoRes.rows.length === 0) {
      res.status(404).json({ error: 'Promotion not found.' });
      return;
    }

    await query(`DELETE FROM promotions WHERE id = $1 AND organization_id = $2`, [id, orgId]);
    res.json({ success: true, message: `Promotion '${promoRes.rows[0].code}' deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete promotion.' });
  }
});

apiRouter.post('/promotions/validate', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const { code, subtotal } = req.body;

    if (!code || !code.trim()) {
      res.status(400).json({ valid: false, message: 'Coupon code is required.' });
      return;
    }

    const currentSubtotal = Number(subtotal) || 0;
    const cleanCode = code.trim().toUpperCase();

    const promoRes = await query(`
      SELECT * FROM promotions
      WHERE organization_id = $1 AND UPPER(code) = $2
    `, [orgId, cleanCode]);

    if (promoRes.rows.length === 0) {
      res.status(404).json({ valid: false, message: `Promo code "${cleanCode}" is invalid.` });
      return;
    }

    const promo = promoRes.rows[0];

    // Check status
    if (promo.status !== 'ACTIVE') {
      res.status(400).json({ valid: false, message: `Promo code "${cleanCode}" is currently inactive.` });
      return;
    }

    // Check validity dates
    const now = new Date();
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      res.status(400).json({ valid: false, message: `Promo code "${cleanCode}" is not yet active.` });
      return;
    }

    if (promo.valid_until && new Date(promo.valid_until) < now) {
      res.status(400).json({ valid: false, message: `Promo code "${cleanCode}" has expired.` });
      return;
    }

    // Check usage limit
    if (promo.usage_limit && Number(promo.times_used) >= Number(promo.usage_limit)) {
      res.status(400).json({ valid: false, message: `Promo code "${cleanCode}" has reached its maximum redemptions limit.` });
      return;
    }

    // Check minimum order amount
    const minSpend = Number(promo.min_order_amount) || 0;
    if (currentSubtotal < minSpend) {
      res.status(400).json({
        valid: false,
        message: `Order subtotal ($${currentSubtotal.toFixed(2)}) is below the required minimum of $${minSpend.toFixed(2)} for this coupon.`
      });
      return;
    }

    // Calculate discount
    let discountAmount = 0;
    const val = Number(promo.discount_value);

    if (promo.discount_type === 'PERCENTAGE') {
      discountAmount = (currentSubtotal * val) / 100;
      if (promo.max_discount_amount && Number(promo.max_discount_amount) > 0) {
        discountAmount = Math.min(discountAmount, Number(promo.max_discount_amount));
      }
    } else {
      discountAmount = Math.min(currentSubtotal, val);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalSubtotal = Math.max(0, Math.round((currentSubtotal - discountAmount) * 100) / 100);

    res.json({
      valid: true,
      promotion: {
        id: promo.id,
        code: promo.code,
        description: promo.description,
        discount_type: promo.discount_type,
        discount_value: Number(promo.discount_value),
        min_order_amount: Number(promo.min_order_amount),
        max_discount_amount: promo.max_discount_amount ? Number(promo.max_discount_amount) : null,
      },
      discount_amount: discountAmount,
      final_subtotal: finalSubtotal,
      message: `Coupon "${cleanCode}" applied: Saved $${discountAmount.toFixed(2)}!`
    });
  } catch (err: any) {
    res.status(500).json({ valid: false, message: 'Failed to validate promotion.' });
  }
});


