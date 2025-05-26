// src/lib/type-guards.ts
/**
 * Type guard functions for runtime type checking
 */

import type {
  Entity,
  PropertyDetails,
  VendorInfo,
  Transaction,
  TransactionType,
  ChartOfAccount,
  AccountSystemType,
  User,
  UserRole,
  Permission
} from '@/types';

// Entity type guards
export function isPropertyEntity(entity: Entity): entity is Entity & { propertyDetails: PropertyDetails } {
  return entity.type === 'property' && entity.propertyDetails != null;
}

export function isTenantEntity(entity: Entity): boolean {
  return entity.type === 'tenant' && entity.tenantInfo != null;
}

export function isVendorEntity(entity: Entity): entity is Entity & { vendorInfo: VendorInfo } {
  return entity.type === 'vendor' && entity.vendorInfo != null;
}

export function hasActiveLeases(entity: Entity): boolean {
  if (entity.type !== 'tenant' || !entity.tenantInfo) return false;
  const now = new Date().toISOString();
  return entity.tenantInfo.leaseEndDate ? entity.tenantInfo.leaseEndDate > now : false;
}

// Transaction type guards
export function isRentTransaction(transaction: Transaction): boolean {
  return transaction.transaction_type === 'rent_income';
}

export function isMaintenanceTransaction(transaction: Transaction): boolean {
  return transaction.transaction_type === 'maintenance';
}

export function isPropertyRelatedTransaction(transaction: Transaction): boolean {
  const propertyTypes: TransactionType[] = [
    'rent_income',
    'security_deposit',
    'security_deposit_return',
    'maintenance',
    'property_tax',
    'insurance',
    'hoa_fee',
    'commission',
    'closing_cost',
    'capital_improvement',
    'utility_payment',
    'property_management_fee'
  ];
  return transaction.transaction_type ? propertyTypes.includes(transaction.transaction_type) : false;
}

export function hasPropertyAllocation(transaction: Transaction): boolean {
  return transaction.lines?.some(line => line.property_id != null) ?? false;
}

export function isPostedTransaction(transaction: Transaction): boolean {
  return transaction.status === 'posted';
}

export function isReconciledTransaction(transaction: Transaction): boolean {
  return transaction.is_reconciled;
}

// Account type guards
export function isAssetAccount(account: ChartOfAccount): boolean {
  return account.type === 'asset';
}

export function isLiabilityAccount(account: ChartOfAccount): boolean {
  return account.type === 'liability';
}

export function isEquityAccount(account: ChartOfAccount): boolean {
  return account.type === 'equity';
}

export function isIncomeAccount(account: ChartOfAccount): boolean {
  return account.type === 'income';
}

export function isExpenseAccount(account: ChartOfAccount): boolean {
  return account.type === 'expense';
}

export function isDebitNormalAccount(account: ChartOfAccount): boolean {
  return account.type === 'asset' || account.type === 'expense';
}

export function isCreditNormalAccount(account: ChartOfAccount): boolean {
  return account.type === 'liability' || account.type === 'equity' || account.type === 'income';
}

export function isPropertySpecificAccount(account: ChartOfAccount): boolean {
  return account.property_id != null;
}

export function isRecoverableExpense(account: ChartOfAccount): boolean {
  return account.type === 'expense' && account.is_recoverable;
}

// User and permission type guards
export function isAdmin(user: User): boolean {
  return user.role === 'admin';
}

export function isPropertyManager(user: User): boolean {
  return user.role === 'property_manager' || user.role === 'manager';
}

export function isAccountant(user: User): boolean {
  return user.role === 'accountant';
}

export function isTenant(user: User): boolean {
  return user.role === 'tenant';
}

export function hasPermission(user: User, permission: Permission, entityAccess?: { permissions: Permission[] }[]): boolean {
  // Admin has all permissions
  if (isAdmin(user)) return true;
  
  // Check entity-specific permissions if provided
  if (entityAccess) {
    return entityAccess.some(access => access.permissions.includes(permission));
  }
  
  // Check role-based permissions
  const rolePermissions = getRolePermissions(user.role);
  return rolePermissions.includes(permission);
}

export function canManageProperties(user: User): boolean {
  const requiredPermissions: Permission[] = [
    Permission.ViewProperties,
    Permission.EditProperties,
    Permission.ManageUnits
  ];
  return requiredPermissions.every(perm => hasPermission(user, perm));
}

export function canCollectRent(user: User): boolean {
  return hasPermission(user, Permission.CollectRent);
}

export function canViewFinancials(user: User): boolean {
  const financialPermissions: Permission[] = [
    Permission.ViewAccounts,
    Permission.ViewTransactions,
    Permission.ViewReports
  ];
  return financialPermissions.some(perm => hasPermission(user, perm));
}

// Helper to get permissions for a role
function getRolePermissions(role: UserRole): Permission[] {
  // Import from auth types
  const { DEFAULT_ROLE_PERMISSIONS } = require('@/types/auth');
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
}

// Validation type guards
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidEIN(ein: string): boolean {
  const einRegex = /^\d{2}-\d{7}$/;
  return einRegex.test(ein);
}

export function isValidSSN(ssn: string): boolean {
  const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
  return ssnRegex.test(ssn);
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?1?\d{10,14}$/;
  return phoneRegex.test(phone);
}

export function isValidZipCode(zipCode: string): boolean {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
}

// Date type guards
export function isFutureDate(date: number | string): boolean {
  const timestamp = typeof date === 'string' ? new Date(date).getTime() : date * 1000;
  return timestamp > Date.now();
}

export function isPastDate(date: number | string): boolean {
  const timestamp = typeof date === 'string' ? new Date(date).getTime() : date * 1000;
  return timestamp < Date.now();
}

export function isWithinDays(date: number | string, days: number): boolean {
  const timestamp = typeof date === 'string' ? new Date(date).getTime() : date * 1000;
  const now = Date.now();
  const diff = Math.abs(timestamp - now);
  return diff <= days * 24 * 60 * 60 * 1000;
}

// Amount type guards
export function isPositiveAmount(amount: number): boolean {
  return amount > 0;
}

export function isValidCurrency(amount: number): boolean {
  // Check if amount has at most 2 decimal places
  return Number.isFinite(amount) && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.01;
}

export function isBalanced(debits: number, credits: number, tolerance = 0.01): boolean {
  return Math.abs(debits - credits) < tolerance;
}