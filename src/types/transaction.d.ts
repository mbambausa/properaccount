// src/types/transaction.d.ts
/**
 * Status of a financial transaction
 */
export type TransactionStatus = 'pending' | 'posted' | 'voided';

/**
 * Categorizes transactions by their business purpose, including real estate.
 */
export type TransactionType =
  | 'general'
  | 'invoice'
  | 'payment'
  | 'expense'
  | 'transfer'
  | 'adjustment'
  | 'opening_balance'
  | 'loan_payment'
  | 'depreciation'
  // Real estate specific:
  | 'rent_income'
  | 'security_deposit'
  | 'security_deposit_return'
  | 'maintenance'
  | 'property_tax'
  | 'insurance'
  | 'hoa_fee'
  | 'commission'
  | 'closing_cost'
  | 'capital_improvement'
  | 'utility_payment'
  | 'property_management_fee';

/**
 * Reconciliation details for a transaction
 */
export interface ReconciliationInfo {
  /** Bank statement reference */
  bank_reference?: string;
  /** Date reconciled (Unix timestamp, seconds) */
  reconciled_date?: number;
  /** User who reconciled */
  reconciled_by?: string;
  /** Bank statement date */
  statement_date?: number;
  /** Reconciliation batch ID if part of bulk reconciliation */
  batch_id?: string;
}

/**
 * Represents a financial transaction header.
 * Aligns with the 'transactions' D1 table (DbTransaction).
 */
export interface Transaction {
  /** Unique identifier (UUID) for this transaction */
  readonly id: string;
  /** ID of the user who owns this transaction record */
  readonly user_id: string;
  /** ID of the entity this transaction belongs to */
  readonly entity_id: string;
  /** Optional link to a journal that groups related transactions */
  journal_id?: string | null;
  /** Date of the transaction (Unix timestamp seconds) */
  date: number;
  /** Description of the transaction purpose */
  description: string;
  /** Optional external reference (check number, invoice ID, etc.) */
  reference?: string | null;
  /** Current processing status of the transaction */
  status: TransactionStatus;
  /** Whether this transaction has been reconciled against bank statements */
  is_reconciled: boolean;
  /** Optional URL to supporting documentation */
  document_url?: string | null;
  /** Business purpose classification of the transaction */
  transaction_type?: TransactionType;
  /** ID of related entity (customer, vendor, etc.) if applicable */
  related_entity_id?: string | null;
  /** Timestamp when this transaction was created (Unix timestamp seconds) */
  readonly created_at: number;
  /** Timestamp when this transaction was last updated (Unix timestamp seconds) */
  updated_at: number;
  /** Transaction lines (debits and credits) - available when full transaction is fetched */
  lines?: TransactionLine[];
  /** Reconciliation details if reconciled */
  reconciliation_info?: ReconciliationInfo;
}

/**
 * Represents a single line item within a financial transaction (a debit or a credit).
 * Aligns with the 'transaction_lines' D1 table (DbTransactionLine).
 */
export interface TransactionLine {
  /** Unique identifier (UUID) for this line item */
  readonly id: string;
  /** ID of the transaction this line belongs to */
  readonly transaction_id: string;
  /** ID of the entity account being debited or credited */
  readonly entity_account_id: string;
  /** Monetary amount (always positive) */
  readonly amount: number;
  /** Whether this line represents a debit (true) or credit (false) */
  readonly is_debit: boolean;
  /** Optional line-specific description */
  readonly memo?: string | null;
  /** Timestamp when this line was created (Unix timestamp seconds) */
  readonly created_at: number;
  /** Optional tax code or category for reporting */
  readonly tax_code?: string | null;
  /** Optional metadata for custom properties */
  readonly metadata?: Record<string, unknown> | null;
  /** Property/sub-entity this line relates to (for property-level tracking) */
  property_id?: string | null;
}

/**
 * Input payload for creating a single transaction line.
 */
export interface TransactionLineInput {
  entity_account_id: string;
  amount: number;
  is_debit: boolean;
  memo?: string | null;
  tax_code?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Property/sub-entity this line relates to */
  property_id?: string | null;
}

/**
 * Input payload for creating a new Transaction with its lines.
 */
export interface TransactionInput {
  entity_id: string;
  journal_id?: string | null;
  date: number;
  description: string;
  reference?: string | null;
  status?: TransactionStatus;
  is_reconciled?: boolean;
  document_url?: string | null;
  transaction_type?: TransactionType;
  related_entity_id?: string | null;
  lines: TransactionLineInput[];
}

/**
 * Parameters for querying transactions
 */
export interface TransactionQueryParams {
  entity_id?: string;
  start_date?: number;
  end_date?: number;
  status?: TransactionStatus;
  is_reconciled?: boolean;
  account_id?: string;
  min_amount?: number;
  max_amount?: number;
  search?: string;
  transaction_type?: TransactionType;
  property_id?: string;
  limit?: number;
  offset?: number;
  sort_direction?: 'asc' | 'desc';
  sort_by?: 'date' | 'amount' | 'description' | 'created_at';
}

/**
 * Balance summary for an account or entity
 */
export interface BalanceSummary {
  total_debits: number;
  total_credits: number;
  net_change: number;
  opening_balance: number;
  closing_balance: number;
}

/**
 * Transaction with calculated impact on relevant accounts
 */
export interface TransactionWithBalances extends Transaction {
  balance_impacts: Array<{
    entity_account_id: string;
    account_code: string;
    account_name: string;
    net_change: number;
    new_balance: number;
  }>;
}

/**
 * Result of a bulk transaction operation
 */
export interface BulkTransactionResult {
  /** Successfully created transaction IDs */
  successful: string[];
  /** Failed transactions with error details */
  failed: Array<{
    index: number;
    error: string;
    data?: TransactionInput;
  }>;
  /** Total processed */
  total: number;
  /** Success count */
  successCount: number;
}

/**
 * Transaction import mapping configuration
 */
export interface TransactionImportMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  debitColumn?: string;
  creditColumn?: string;
  referenceColumn?: string;
  accountMapping?: Record<string, string>;
}

/**
 * Imported transaction before processing
 */
export interface ImportedTransaction {
  rowNumber: number;
  rawData: Record<string, any>;
  parsed?: TransactionInput;
  errors?: string[];
  suggestedAccounts?: Array<{
    accountId: string;
    confidence: number;
  }>;
}

/**
 * Journal entry grouping related transactions
 */
export interface Journal {
  id: string;
  user_id: string;
  entity_id: string;
  name: string;
  date: number;
  type?: 'general' | 'closing' | 'adjusting' | 'recurring';
  transactions?: Transaction[];
  created_at: number;
  updated_at: number;
}

/**
 * Type guards for transactions
 */
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