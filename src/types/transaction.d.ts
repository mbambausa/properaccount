// src/types/transaction.d.ts

/**
 * Status of a financial transaction
 */
export type TransactionStatus = 'pending' | 'posted' | 'voided';

/**
 * Categorizes transactions by their business purpose
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
  | 'depreciation';

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
}

/**
 * Input payload for creating a single transaction line.
 */
export interface TransactionLineInput {
  /** ID of the entity account to debit or credit (required) */
  entity_account_id: string;
  /** Amount for this line item (required, always positive) */
  amount: number;
  /** Whether this is a debit (true) or credit (false) (required) */
  is_debit: boolean;
  /** Optional line-specific description */
  memo?: string | null;
  /** Optional tax code or category for reporting */
  tax_code?: string | null;
  /** Optional metadata for custom properties */
  metadata?: Record<string, unknown> | null;
}

/**
 * Input payload for creating a new Transaction with its lines.
 */
export interface TransactionInput {
  /** ID of the entity this transaction belongs to (required) */
  entity_id: string;
  /** Optional link to a journal that groups related transactions */
  journal_id?: string | null;
  /** Date of the transaction in Unix timestamp seconds (required) */
  date: number;
  /** Description of the transaction purpose (required) */
  description: string;
  /** Optional external reference (check number, invoice ID, etc.) */
  reference?: string | null;
  /** Initial status (defaults to 'pending' if not specified) */
  status?: TransactionStatus;
  /** Whether this transaction has been reconciled (defaults to false) */
  is_reconciled?: boolean;
  /** Optional URL to supporting documentation */
  document_url?: string | null;
  /** Business purpose classification */
  transaction_type?: TransactionType;
  /** ID of related entity if applicable */
  related_entity_id?: string | null;
  /** Transaction lines (at least two lines required, must balance) */
  lines: TransactionLineInput[];
}

/**
 * Parameters for querying transactions
 */
export interface TransactionQueryParams {
  /** Filter by entity ID */
  entity_id?: string;
  /** Filter by start date (inclusive, Unix timestamp seconds) */
  start_date?: number;
  /** Filter by end date (inclusive, Unix timestamp seconds) */
  end_date?: number;
  /** Filter by transaction status */
  status?: TransactionStatus;
  /** Filter by reconciliation status */
  is_reconciled?: boolean;
  /** Filter by specific account involvement */
  account_id?: string;
  /** Filter by minimum amount */
  min_amount?: number;
  /** Filter by maximum amount */
  max_amount?: number;
  /** Search in description or reference */
  search?: string;
  /** Filter by transaction type */
  transaction_type?: TransactionType;
  /** Limit the number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort direction */
  sort_direction?: 'asc' | 'desc';
  /** Sort field */
  sort_by?: 'date' | 'amount' | 'description' | 'created_at';
}

/**
 * Balance summary for an account or entity
 */
export interface BalanceSummary {
  /** Total debits for the period */
  total_debits: number;
  /** Total credits for the period */
  total_credits: number;
  /** Net change for the period (positive for debit increase, negative for credit increase) */
  net_change: number;
  /** Opening balance at the start of the period */
  opening_balance: number;
  /** Closing balance at the end of the period */
  closing_balance: number;
}

/**
 * Transaction with calculated impact on relevant accounts
 */
export interface TransactionWithBalances extends Transaction {
  /** Calculated impacts on account balances */
  balance_impacts: Array<{
    /** Account ID */
    entity_account_id: string;
    /** Account code */
    account_code: string;
    /** Account name */
    account_name: string;
    /** Net change to the account (positive for debit increase, negative for credit increase) */
    net_change: number;
    /** New balance after this transaction */
    new_balance: number;
  }>;
}