// src/types/accounting.d.ts
/**
 * Main system-level account types.
 */
export type AccountSystemType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

/**
 * More detailed subtypes for real estate accounting.
 */
export type AssetSubtype = 
  | 'cash'
  | 'operating_account'
  | 'security_deposit_account'
  | 'reserve_account'
  | 'property_land'
  | 'property_building'
  | 'property_improvements'
  | 'accumulated_depreciation'
  | 'accounts_receivable'
  | 'prepaid_expenses'
  | 'other_current'
  | 'other_fixed';

export type LiabilitySubtype =
  | 'accounts_payable'
  | 'security_deposits_held'
  | 'prepaid_rent'
  | 'mortgage_current'
  | 'mortgage_long_term'
  | 'notes_payable'
  | 'accrued_expenses'
  | 'other_current'
  | 'other_long_term';

export type IncomeSubtype =
  | 'rental_income'
  | 'late_fees'
  | 'application_fees'
  | 'parking_income'
  | 'laundry_income'
  | 'utility_reimbursement'
  | 'other_income';

export type ExpenseSubtype = 
  | 'recoverable'
  | 'non-recoverable'
  | 'repairs_maintenance'
  | 'property_management'
  | 'utilities'
  | 'insurance'
  | 'property_tax'
  | 'hoa_fees'
  | 'mortgage_interest'
  | 'depreciation'
  | 'advertising'
  | 'professional_fees'
  | 'other';

/**
 * Tax categories specific to real estate.
 */
export type RealEstateTaxCategory = 
  | 'schedule_e_income'
  | 'schedule_e_expense'
  | 'depreciation_1250'
  | 'depreciation_1245'
  | 'capital_improvement'
  | 'passive_loss_carryforward'
  | 'qbi_eligible'
  | '1031_exchange'
  | 'mortgage_interest_1098'
  | 'property_tax_deductible';

/**
 * Core Chart of Account interface, extended for real estate.
 */
export interface ChartOfAccount {
  id: string;
  user_id: string;
  code: string;
  name: string;
  type: AccountSystemType;

  /** More specific subtype based on account type. */
  subtype?: AssetSubtype | LiabilitySubtype | IncomeSubtype | ExpenseSubtype | string | null;

  description?: string | null;
  is_recoverable: boolean;
  recovery_percentage?: number | null;
  is_active: boolean;
  tax_category?: RealEstateTaxCategory | string | null;
  parent_id?: string | null;
  created_at: number;
  updated_at: number;

  /** For property-specific accounts, link to property entity. */
  property_id?: string | null;

  /** Whether this account should be included in property P&L. */
  include_in_property_pl?: boolean;

  /** Whether this account is used for tenant billing. */
  billable_to_tenant?: boolean;

  /** Default allocation method for shared expenses. */
  allocation_method?: 'per_unit' | 'by_square_foot' | 'by_percentage' | 'manual' | null;
}

/**
 * Node with child accounts for tree rendering.
 */
export interface ChartOfAccountNode extends ChartOfAccount {
  children?: ChartOfAccountNode[];
  level?: number;
  path?: string;
  hasChildren?: boolean;
  balance?: number;
}

/**
 * Input payload for Chart of Account.
 */
export interface ChartOfAccountInput {
  code: string;
  name: string;
  type: AccountSystemType;
  subtype?: string | null;
  description?: string | null;
  is_recoverable?: boolean;
  recovery_percentage?: number | null;
  is_active?: boolean;
  tax_category?: RealEstateTaxCategory | string | null;
  parent_id?: string | null;
  property_id?: string | null;
  include_in_property_pl?: boolean;
  billable_to_tenant?: boolean;
  allocation_method?: 'per_unit' | 'by_square_foot' | 'by_percentage' | 'manual' | null;
}

/**
 * Real estate-specific Chart of Account templates.
 */
export interface ChartOfAccountsTemplate {
  name: string;
  description: string;
  type: 'residential_rental' | 'commercial_rental' | 'mixed_use' | 'property_management' | 'reit';
  accounts: ChartOfAccountInput[];
}

/**
 * Common real estate account codes.
 */
export const REAL_ESTATE_ACCOUNT_CODES = {
  // Assets
  OPERATING_CASH: '1010',
  SECURITY_DEPOSITS_HELD: '1020',
  TENANT_RECEIVABLES: '1200',
  LAND: '1510',
  BUILDING: '1520',
  IMPROVEMENTS: '1530',
  ACCUMULATED_DEPRECIATION: '1590',
  // Liabilities
  SECURITY_DEPOSITS_LIABILITY: '2100',
  PREPAID_RENT: '2200',
  MORTGAGE_PAYABLE: '2510',
  // Income
  RENTAL_INCOME: '4100',
  LATE_FEES: '4200',
  OTHER_INCOME: '4900',
  // Expenses
  REPAIRS_MAINTENANCE: '5100',
  PROPERTY_MANAGEMENT: '5200',
  UTILITIES: '5300',
  INSURANCE: '5400',
  PROPERTY_TAX: '5500',
  MORTGAGE_INTEREST: '5600',
  DEPRECIATION: '5700',
} as const;

/**
 * Standard account balance structure.
 */
export interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountSystemType;
  balance: number;
  debitTotal?: number;
  creditTotal?: number;
  transactionCount?: number;
}

/**
 * Account balance at the property level.
 */
export interface PropertyAccountBalance extends AccountBalance {
  propertyId: string;
  propertyName: string;
  unitId?: string;
  metrics?: {
    occupancyRate?: number;
    effectiveRentRatio?: number;
    expenseRatio?: number;
  };
}

/**
 * Allocation of shared expenses across properties.
 */
export interface ExpenseAllocation {
  sourceAccountId: string;
  totalAmount: number;
  allocations: Array<{
    propertyId: string;
    amount: number;
    percentage: number;
    basis: 'units' | 'square_feet' | 'revenue' | 'manual';
  }>;
}

/**
 * Recovery calculation for recoverable expenses.
 */
export interface RecoveryCalculation {
  originalAmount: number;
  recoveryPercentage: number;
  recoverableAmount: number;
  nonRecoverableAmount: number;
}

/**
 * Cash flow classification for real estate.
 */
export interface CashFlowClassification {
  accountId: string;
  category: 'operating' | 'investing' | 'financing';
  classification:
    | 'rental_receipts'
    | 'operating_expenses'
    | 'capital_expenditures'
    | 'mortgage_principal'
    | 'mortgage_interest'
    | 'property_acquisition'
    | 'property_disposition'
    | 'equity_contributions'
    | 'distributions';
}

// Type guards
export function isAssetAccount(account: ChartOfAccount): boolean {
  return account.type === 'asset';
}

export function isIncomeAccount(account: ChartOfAccount): boolean {
  return account.type === 'income';
}

export function isExpenseAccount(account: ChartOfAccount): boolean {
  return account.type === 'expense';
}

export function isPropertySpecificAccount(account: ChartOfAccount): boolean {
  return account.property_id != null;
}

export function isRecoverableExpense(account: ChartOfAccount): boolean {
  return account.type === 'expense' && account.is_recoverable;
}

// Account helpers
export function getAccountTypeNormalBalance(type: AccountSystemType): 'debit' | 'credit' {
  switch (type) {
    case 'asset':
    case 'expense':
      return 'debit';
    case 'liability':
    case 'equity':
    case 'income':
      return 'credit';
  }
}

export function calculateAccountBalance(
  account: ChartOfAccount,
  debits: number,
  credits: number
): number {
  const normalBalance = getAccountTypeNormalBalance(account.type);
  return normalBalance === 'debit' ? debits - credits : credits - debits;
}