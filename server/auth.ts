import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from './db.ts';

const JWT_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'super-secret-pos-jwt-key-change-in-production';

export interface AuthenticatedUser {
  id: string;
  organization_id: string;
  branch_id: string | null;
  name: string;
  email: string;
  role_name: string;
  organization_name: string;
  currency: string;
  branch_name: string | null;
  branch_code: string | null;
}

const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'TENANT_OWNER', 'ADMIN'];
const MODULE_ROLES: Record<string, string[]> = {
  pos: ['BRANCH_MANAGER', 'CASHIER'],
  'pc-builder': ['BRANCH_MANAGER', 'CASHIER', 'TECHNICIAN'],
  promotions: ['BRANCH_MANAGER', 'CASHIER'],
  'cash-register': ['BRANCH_MANAGER', 'CASHIER', 'ACCOUNTANT'],
  sales: ['BRANCH_MANAGER', 'CASHIER', 'ACCOUNTANT', 'AUDITOR'],
  inventory: ['BRANCH_MANAGER', 'CASHIER', 'INVENTORY_MANAGER', 'TECHNICIAN'],
  serials: ['BRANCH_MANAGER', 'CASHIER', 'INVENTORY_MANAGER', 'TECHNICIAN'],
  reorder: ['BRANCH_MANAGER', 'INVENTORY_MANAGER'],
  labels: ['BRANCH_MANAGER', 'CASHIER', 'INVENTORY_MANAGER'],
  transfers: ['BRANCH_MANAGER', 'INVENTORY_MANAGER'],
  repairs: ['BRANCH_MANAGER', 'CASHIER', 'TECHNICIAN'],
  'trade-in': ['BRANCH_MANAGER', 'CASHIER'],
  customers: ['BRANCH_MANAGER', 'CASHIER', 'ACCOUNTANT', 'AUDITOR'],
  suppliers: ['BRANCH_MANAGER', 'INVENTORY_MANAGER', 'ACCOUNTANT'],
  'staff-performance': ['BRANCH_MANAGER'],
  dashboard: ['BRANCH_MANAGER', 'ACCOUNTANT', 'AUDITOR'],
  expenses: ['BRANCH_MANAGER', 'ACCOUNTANT'],
  reports: ['BRANCH_MANAGER', 'ACCOUNTANT', 'AUDITOR'],
  settings: [],
};

function moduleForPath(path: string): string | null {
  if (path.startsWith('/products') || path.startsWith('/categories') || path.startsWith('/brands') || path.startsWith('/inventory')) return 'inventory';
  if (path.startsWith('/serials')) return 'serials';
  if (path.startsWith('/transfers')) return 'transfers';
  if (path.startsWith('/pos')) return 'pos';
  if (path.startsWith('/sales') || path.startsWith('/returns')) return 'sales';
  if (path.startsWith('/cash-register')) return 'cash-register';
  if (path.startsWith('/expenses')) return 'expenses';
  if (path.startsWith('/customers')) return 'customers';
  if (path.startsWith('/suppliers') || path.startsWith('/purchases') || path.startsWith('/auto-reorder')) return 'suppliers';
  if (path.startsWith('/repairs')) return 'repairs';
  if (path.startsWith('/trade-ins')) return 'trade-in';
  if (path.startsWith('/staff-')) return 'staff-performance';
  if (path.startsWith('/promotions')) return 'promotions';
  if (path.startsWith('/dashboard')) return 'dashboard';
  if (path.startsWith('/branches') || path.startsWith('/users') || path.startsWith('/audit-logs') || path.startsWith('/tenants')) return 'settings';
  return null;
}

function canAccessPath(role: string, path: string): boolean {
  if (FULL_ACCESS_ROLES.includes(role)) return true;
  if (path === '/auth/me' || path === '/branches') return true;
  const module = moduleForPath(path);
  return module !== null && (MODULE_ROLES[module] || []).includes(role);
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function signToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      organization_id: user.organization_id,
      branch_id: user.branch_id,
      name: user.name,
      email: user.email,
      role_name: user.role_name,
      organization_name: user.organization_name,
      currency: user.currency,
      branch_name: user.branch_name,
      branch_code: user.branch_code,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Always refresh latest user and branch state from database
    const userRes = await query(`
      SELECT 
        u.id, u.organization_id, u.branch_id, u.name, u.email, u.role_name, u.status,
        o.name as organization_name, o.currency,
        b.branch_name, b.branch_code
      FROM users u
      JOIN organizations o ON o.id = u.organization_id
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.id = $1 AND u.status = 'ACTIVE'
    `, [decoded.id]);

    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Session expired or user account inactive.' });
      return;
    }

    const row = userRes.rows[0];
    req.user = {
      id: row.id,
      organization_id: row.organization_id,
      branch_id: row.branch_id,
      name: row.name,
      email: row.email,
      role_name: row.role_name,
      organization_name: row.organization_name,
      currency: row.currency || '$',
      branch_name: row.branch_name,
      branch_code: row.branch_code,
    };

    if (!canAccessPath(req.user.role_name, req.path)) {
      res.status(403).json({ error: `Access denied. Role '${req.user.role_name}' cannot access this module.` });
      return;
    }

    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    if (FULL_ACCESS_ROLES.includes(req.user.role_name)) {
      return next();
    }
    if (!allowedRoles.includes(req.user.role_name)) {
      res.status(403).json({ error: `Access denied. Role '${req.user.role_name}' does not have permission for this resource.` });
      return;
    }
    next();
  };
}

/**
 * Ensures branch isolation:
 * If the user is assigned to a specific branch (Cashier, Branch Mgr, Technician),
 * they CANNOT query or operate on any other branch.
 * If the user is Tenant Owner or Super Admin, they can operate across branches or filter by branch.
 */
export function getAuthorizedBranchId(req: AuthRequest, requestedBranchId?: string | null): string | null {
  if (!req.user) return null;
  // If user is locked to a branch, strictly return their branch ID
  if (req.user.branch_id && req.user.role_name !== 'SUPER_ADMIN' && req.user.role_name !== 'TENANT_OWNER') {
    return req.user.branch_id;
  }
  // If user is owner/super admin and requested all branches or no branch filter, return null
  if (!requestedBranchId || requestedBranchId === 'ALL' || requestedBranchId === 'all') {
    return null;
  }
  return requestedBranchId;
}
