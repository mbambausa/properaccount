// src/types/accounting.d.ts
/**
 * Defines core accounting types, including Chart of Accounts,
 * account subtypes, and related structures specific to real estate accounting.
 */

/**
 * Main system-level account types.
 */
export type AccountSystemType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

/**
 * More detailed subtypes for real estate accounting.
 * Consider adding an 'other_asset' or similar if truly custom string subtypes were intended.
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
  | 'other_current' // Note: 'other_current' also in LiabilitySubtype
  | 'other_fixed';

export type LiabilitySubtype =
  | 'accounts_payable'
  | 'security_deposits_held'
  | 'prepaid_rent'
  | 'mortgage_current'
  | 'mortgage_long_term'
  | 'notes_payable'
  | 'accrued_expenses'
  | 'other_current' // Note: 'other_current' also in AssetSubtype
  | 'other_long_term';

export type IncomeSubtype =
  | 'rental_income'
  | 'late_fees'
  | 'application_fees'
  | 'parking_income'
  | 'laundry_income'
  | 'utility_reimbursement'
  | 'other_income'; // Generic 'other' for income

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
  | 'other'; // Generic 'other' for expenses

/**
 * Tax categories specific to real estate.
 * Consider adding an 'other_tax' or similar if custom string categories were intended.
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
  /** Unique identifier (UUID) for this account */
  readonly id: string;
  /** ID of the user who owns this account record */
  readonly user_id: string; // Assuming user-scoped CoA for MVP Start tier
  // entity_id?: string; // Consider if CoA is per-entity rather than per-user

  code: string;
  name: string;
  type: AccountSystemType;

  /** More specific subtype based on account type. For custom subtypes, consider a separate 'custom_subtype?: string;' field or extend the enums. */
  subtype?: AssetSubtype | LiabilitySubtype | IncomeSubtype | ExpenseSubtype | null;

  description?: string | null;
  is_recoverable: boolean; // Primarily for expense accounts
  recovery_percentage?: number | null; // Relevant if is_recoverable is true
  is_active: boolean;

  /** Tax category for reporting. For custom categories, consider a separate 'custom_tax_category?: string;' field. */
  tax_category?: RealEstateTaxCategory | null;
  parent_id?: string | null; // For hierarchical CoA

  /** Unix timestamp in seconds for creation date */
  readonly created_at: number;
  /** Unix timestamp in seconds for last update */
  updated_at: number;

  /** For property-specific accounts, link to property entity. */
  property_id?: string | null;

  /** Whether this account should be included in property P&L. */
  include_in_property_pl?: boolean;

  /** Whether this account is used for tenant billing (e.g., utility passthrough). */
  billable_to_tenant?: boolean;

  /** Default allocation method for shared expenses if this account represents one. */
  allocation_method?: 'per_unit' | 'by_square_foot' | 'by_percentage' | 'manual' | null;
}

/**
 * Represents a Chart of Account entry in a tree structure, often for UI display.
 * Includes additional properties like children, hierarchy level, and current balance.
 */
export interface ChartOfAccountNode extends ChartOfAccount {
  children?: ChartOfAccountNode[];
  level?: number; // Depth in the tree
  path?: string; // Materialized path, e.g., "ParentName > ChildName"
  hasChildren?: boolean;
  balance?: number; // Current balance of this account (may include children's balances depending on context)
}

/**
 * Input payload for creating or updating a Chart of Account entry.
 * Excludes read-only fields like id, user_id, created_at, updated_at.
 */
export interface ChartOfAccountInput {
  code: string;
  name: string;
  type: AccountSystemType;
  subtype?: AssetSubtype | LiabilitySubtype | IncomeSubtype | ExpenseSubtype | null; // Enforce known subtypes
  description?: string | null;
  is_recoverable?: boolean;
  recovery_percentage?: number | null;
  is_active?: boolean;
  tax_category?: RealEstateTaxCategory | null; // Enforce known tax categories
  parent_id?: string | null;
  property_id?: string | null;
  include_in_property_pl?: boolean;
  billable_to_tenant?: boolean;
  allocation_method?: 'per_unit' | 'by_square_foot' | 'by_percentage' | 'manual' | null;
}

/**
 * Structure for real estate-specific Chart of Account templates.
 */
export interface ChartOfAccountsTemplate {
  name: string;
  description: string;
  type: 'residential_rental' | 'commercial_rental' | 'mixed_use' | 'property_management' | 'reit';
  accounts: ChartOfAccountInput[]; // Uses the input type for template accounts
}

/**
 * Common real estate account codes for quick reference or template generation.
 * Using `as const` makes the values and keys strongly typed.
 */
export const REAL_ESTATE_ACCOUNT_CODES = {
  // Assets
  OPERATING_CASH: '1010',
  SECURITY_DEPOSITS_HELD_ASSET: '1020', // Clarified asset context
  TENANT_RECEIVABLES: '1200',
  LAND: '1510',
  BUILDING: '1520',
  IMPROVEMENTS: '1530',
  ACCUMULATED_DEPRECIATION: '1590',
  // Liabilities
  SECURITY_DEPOSITS_LIABILITY: '2100',
  PREPAID_RENT_LIABILITY: '2200', // Clarified liability context
  MORTGAGE_PAYABLE: '2510',
  // Income
  RENTAL_INCOME: '4100',
  LATE_FEES_INCOME: '4200', // Clarified income context
  OTHER_INCOME: '4900',
  // Expenses
  REPAIRS_MAINTENANCE_EXPENSE: '5100', // Clarified expense context
  PROPERTY_MANAGEMENT_EXPENSE: '5200',
  UTILITIES_EXPENSE: '5300',
  INSURANCE_EXPENSE: '5400',
  PROPERTY_TAX_EXPENSE: '5500',
  MORTGAGE_INTEREST_EXPENSE: '5600',
  DEPRECIATION_EXPENSE: '5700',
} as const;

/**
 * Standard structure for representing an account's balance.
 * Renamed from AccountBalance to CoreAccountBalance to distinguish from potentially
 * different report-specific balance types.
 */
export interface CoreAccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountSystemType;
  /** Current balance of the account. */
  balance: number;
  /** Total debits for a given period (optional, context-dependent). */
  debitTotal?: number;
  /** Total credits for a given period (optional, context-dependent). */
  creditTotal?: number;
  /** Number of transactions affecting this account in a period (optional). */
  transactionCount?: number;
}

/**
 * Represents an account balance specifically at the property level,
 * potentially including property-specific metrics.
 */
export interface PropertyAccountBalance extends CoreAccountBalance {
  propertyId: string;
  propertyName: string;
  unitId?: string | null; // Optional unit ID if balance is for a specific unit
  metrics?: {
    occupancyRate?: number;       // For property or unit group
    effectiveRentRatio?: number;  // If applicable
    expenseRatio?: number;        // For property P&L accounts
  };
}

/**
 * Defines the structure for allocating a shared expense across multiple properties or cost centers.
 */
export interface ExpenseAllocation {
  /** ID of the source expense account containing the total amount to be allocated. */
  sourceAccountId: string;
  /** Total amount of the expense to be allocated. */
  totalAmount: number;
  /** Array of allocations to specific properties/cost centers. */
  allocations: Array<{
    propertyId: string; // Target property for this portion of the allocation
    amount: number; // Allocated amount to this property
    percentage?: number; // Optional: percentage of totalAmount allocated
    basis: 'units' | 'square_feet' | 'revenue' | 'manual' | 'percentage'; // Basis for allocation
  }>;
  /** Optional description or memo for the allocation. */
  memo?: string;
  /** Date of allocation. Unix timestamp in seconds. */
  allocationDate: number;
}

/**
 * Represents the calculation of recoverable vs. non-recoverable portions of an expense.
 */
export interface RecoveryCalculation {
  originalAmount: number;
  recoveryPercentage: number; // e.g., 0.75 for 75%
  recoverableAmount: number;
  nonRecoverableAmount: number;
  expenseAccountId: string;
  /** Account where the recoverable portion might be billed or tracked. */
  receivableAccountId?: string | null;
}

/**
 * Classifies an account for cash flow statement purposes in real estate contexts.
 */
export interface CashFlowClassification {
  accountId: string;
  category: 'operating' | 'investing' | 'financing'; // Standard cash flow categories
  /** More granular classification specific to real estate activities. */
  classification:
    | 'rental_receipts'
    | 'other_operating_income'
    | 'operating_expenses_paid'
    | 'interest_paid_operating' // Some classify interest paid as operating
    | 'taxes_paid_operating'
    | 'property_acquisition_disposition' // Investing
    | 'capital_expenditures'           // Investing
    | 'proceeds_from_debt'             // Financing
    | 'repayment_of_debt_principal'    // Financing
    | 'interest_paid_financing'      // Some classify interest paid as financing
    | 'distributions_dividends_paid'   // Financing
    | 'equity_contributions_received'  // Financing
    | 'other_investing'
    | 'other_financing';
}

/*
NOTE: Runtime helper functions and type guards previously in this file
(e.g., isAssetAccount, getAccountTypeNormalBalance, calculateAccountBalance)
should be moved to a regular .ts utility file, for example:
`src/lib/accounting/accountingUtils.ts` or `src/lib/coa/coaUtils.ts`.
This keeps .d.ts files strictly for type declarations.
*/