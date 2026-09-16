import { User, UserRole } from './types.ts';

export type AccessModule =
  | 'pos' | 'pc-builder' | 'promotions' | 'cash-register' | 'sales'
  | 'inventory' | 'serials' | 'reorder' | 'labels' | 'transfers'
  | 'repairs' | 'trade-in' | 'customers' | 'suppliers' | 'staff-performance'
  | 'dashboard' | 'expenses' | 'reports' | 'settings';

const FULL_ACCESS_ROLES: UserRole[] = ['SUPER_ADMIN', 'TENANT_OWNER', 'ADMIN'];

const MODULE_ROLES: Record<AccessModule, UserRole[]> = {
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

export function canAccessModule(user: Pick<User, 'role_name'> | null | undefined, module: AccessModule): boolean {
  if (!user) return false;
  return FULL_ACCESS_ROLES.includes(user.role_name) || MODULE_ROLES[module].includes(user.role_name);
}
