// src/types/transaction.d.ts
/**
 * Defines TypeScript interfaces related to financial transactions,
 * transaction lines, journals, and associated data structures.
 */

/**
 * Status of a financial transaction.
 */
export type TransactionStatus =
  | 'pending_entry'       // Transaction data entered but not yet finalized or posted
  | 'posted_to_ledger'    // Transaction is finalized and has affected account balances (renamed from 'posted')
  | 'voided_transaction'  // Transaction has been voided and no longer affects balances (renamed from 'voided')
  | 'draft_incomplete'    // Transaction saved as a draft, not yet complete
  | 'scheduled_future'    // Transaction scheduled for a future date
  | 'recurring_template'; // A template for generating recurring transactions

/**
 * Categorizes transactions by their business purpose, including specific real estate activities.
 */
export type TransactionType =
  | 'general_journal_entry' // Renamed from 'general'
  | 'invoice_generated'     // Renamed from 'invoice' (e.g., tenant invoice)
  | 'payment_received'      // Renamed from 'payment' (e.g., rent from tenant)
  | 'payment_made'          // Payment made to vendor, etc.
  | 'expense_recorded'      // Renamed from 'expense'
  | 'inter_account_transfer'// Renamed from 'transfer'
  | 'balance_adjustment'    // Renamed from 'adjustment' (e.g., for corrections)
  | 'opening_balance_entry' // Renamed from 'opening_balance'
  | 'loan_disbursement'
  | 'loan_principal_payment'// Renamed from 'loan_payment' (principal portion)
  | 'loan_interest_payment'
  | 'asset_depreciation_expense' // Renamed from 'depreciation'
  // Real estate specific:
  | 'rental_income_received' // Renamed from 'rent_income'
  | 'security_deposit_collected' // Renamed from 'security_deposit'
  | 'security_deposit_refunded'  // Renamed from 'security_deposit_return'
  | 'property_maintenance_expense' // Renamed from 'maintenance'
  | 'property_tax_payment'
  | 'property_insurance_payment' // Renamed from 'insurance'
  | 'hoa_condo_fee_payment'      // Renamed from 'hoa_fee'
  | 'real_estate_commission_paid'// Renamed from 'commission'
  | 'property_closing_cost'
  | 'capital_improvement_expenditure' // Renamed from 'capital_improvement'
  | 'utility_bill_payment'          // Renamed from 'utility_payment'
  | 'property_management_fee_paid'  // Renamed from 'property_management_fee'
  | 'owner_draw_distribution'
  | 'owner_capital_contribution'
  | 'bank_fee_charge'
  | 'interest_income_earned'
  | 'other_revenue'
  | 'other_expense';

/**
 * Reconciliation details associated with a transaction line or header.
 */
export interface TransactionReconciliationInfo { // Renamed from ReconciliationInfo
  /** Reference from the bank statement (e.g., bank's transaction ID). */
  bank_statement_reference?: string | null; // Renamed from bank_reference
  /** Date the transaction/line was reconciled. Unix timestamp (seconds). */
  reconciled_at_date?: number | null; // Renamed from reconciled_date
  /** ID of the user who performed the reconciliation. */
  reconciled_by_user_id?: string | null; // Renamed from reconciled_by
  /** Date of the bank statement used for reconciliation. Unix timestamp (seconds). */
  bank_statement_period_end_date?: number | null; // Renamed from statement_date
  /** ID of the reconciliation session this item was part of. */
  reconciliation_session_id?: string | null; // Renamed from batch_id
  reconciliation_match_id?: string | null; // If linked to a specific match in reconciliation.d.ts
}

/**
 * Represents the header of a financial transaction.
 * Typically aligns with a 'transactions' table in the database.
 */
export interface TransactionHeader { // Renamed from Transaction
  /** Unique identifier (UUID) for this transaction. */
  readonly id: string;
  /** ID of the user who owns this transaction record. */
  readonly user_id: string;
  /** ID of the primary entity this transaction belongs to. */
  readonly entity_id: string;
  /** Optional: ID of a journal entry that groups this and other related transactions. */
  journal_id?: string | null;
  /** Date of the transaction. Unix timestamp (seconds). */
  transaction_date: number; // Renamed from date
  description_text: string; // Renamed from description
  /** Optional external reference (e.g., check number, invoice ID, bank transaction ID). */
  external_reference?: string | null; // Renamed from reference
  status: TransactionStatus;
  /** Has this entire transaction been reconciled? Individual lines might have specific reconciliation status. */
  is_fully_reconciled: boolean; // Renamed from is_reconciled
  /** Optional: ID of a primary supporting document (e.g., invoice PDF in R2). */
  primary_document_id?: string | null; // Renamed from document_url (now an ID)
  transaction_type?: TransactionType;
  /** ID of a related counterparty entity (e.g., customer, vendor, tenant, bank). */
  counterparty_entity_id?: string | null; // Renamed from related_entity_id
  /** Unix timestamp (seconds) when this transaction record was created. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when this transaction record was last updated. */
  updated_at: number;
  /** Detailed lines (debits and credits) of the transaction. Populated when fetching full transaction details. */
  line_items?: TransactionLine[]; // Renamed from lines
  /** Reconciliation details if the transaction header itself is marked reconciled. */
  reconciliation_details?: TransactionReconciliationInfo | null; // Renamed from reconciliation_info
  tags?: string[];
  is_recurring_instance?: boolean; // If this transaction was generated from a recurring template
  recurring_transaction_template_id?: string | null;
}

/**
 * Represents a single line item (a debit or a credit) within a financial transaction.
 * Typically aligns with a 'transaction_lines' table in the database.
 */
export interface TransactionLine {
  /** Unique identifier (UUID) for this line item. */
  readonly id: string;
  /** ID of the TransactionHeader this line belongs to. */
  readonly transaction_id: string;
  /** ID of the Chart of Account entry being debited or credited. */
  readonly account_id: string; // Renamed from entity_account_id for clarity (it's a CoA ID)
  /** Monetary amount of this line item (always stored as a positive value). */
  readonly amount: number;
  /** True if this line represents a debit to the account_id, false if a credit. */
  readonly is_debit: boolean;
  /** Optional line-specific description or memo. */
  readonly memo?: string | null;
  /** Unix timestamp (seconds) when this line item was created (usually same as transaction_id.created_at). */
  readonly created_at: number; // May not be strictly needed if always same as header
  /** Optional tax code or category for this specific line item, for detailed tax reporting. */
  readonly tax_code_or_category?: string | null; // Renamed from tax_code
  /** Optional JSONB or serialized string for custom metadata specific to this line. */
  readonly custom_metadata?: Record<string, unknown> | null; // Renamed from metadata
  /** Optional: ID of a property or sub-entity this line item specifically relates to (for granular P&L). */
  property_or_segment_id?: string | null; // Renamed from property_id
  /** Optional: Link to a specific document line item if applicable (e.g. invoice line). */
  document_line_item_ref?: string | null;
  is_line_reconciled?: boolean; // If reconciliation is done at line level
  line_reconciliation_details?: TransactionReconciliationInfo | null;
}

/**
 * Input payload for creating a single transaction line item.
 */
export interface TransactionLineItemInput { // Renamed from TransactionLineInput
  account_id: string; // CoA ID
  amount: number; // Must be positive
  is_debit: boolean;
  memo?: string | null;
  tax_code_or_category?: string | null;
  custom_metadata?: Record<string, unknown> | null;
  property_or_segment_id?: string | null;
}

/**
 * Input payload for creating a new TransactionHeader with its line items.
 */
export interface NewTransactionInput { // Renamed from TransactionInput
  entity_id: string;
  journal_id?: string | null;
  /** Transaction date. Unix timestamp (seconds). */
  transaction_date: number;
  description_text: string;
  external_reference?: string | null;
  status?: TransactionStatus; // Defaults to 'pending_entry' or 'posted_to_ledger'
  is_fully_reconciled?: boolean; // Defaults to false
  primary_document_id?: string | null;
  transaction_type?: TransactionType;
  counterparty_entity_id?: string | null;
  line_items: TransactionLineItemInput[]; // Renamed from lines
  tags?: string[];
}

/**
 * Parameters for querying a list of transactions.
 */
export interface TransactionQueryParameters { // Renamed from TransactionQueryParams
  entity_id?: string | string[]; // Allow filtering by multiple entities
  /** Start date for query range. Unix timestamp (seconds). */
  start_date_ts?: number | null; // Renamed from start_date
  /** End date for query range. Unix timestamp (seconds). */
  end_date_ts?: number | null;   // Renamed from end_date
  status?: TransactionStatus | TransactionStatus[];
  is_reconciled_filter?: boolean | null; // Renamed from is_reconciled (true, false, or null for any)
  account_id_filter?: string | null; // Renamed from account_id (filter for transactions involving this CoA)
  min_transaction_amount?: number | null; // Renamed from min_amount
  max_transaction_amount?: number | null; // Renamed from max_amount
  search_term_in_description_or_ref?: string | null; // Renamed from search
  transaction_type_filter?: TransactionType | TransactionType[]; // Renamed from transaction_type
  property_or_segment_id_filter?: string | null; // Renamed from property_id
  pagination_limit?: number | null; // Renamed from limit
  pagination_offset?: number | null; // Renamed from offset
  sort_order_direction?: 'asc' | 'desc'; // Renamed from sort_direction
  sort_by_field?: 'transaction_date' | 'total_amount' | 'description_text' | 'created_at' | 'status'; // Renamed from sort_by
  include_line_items_in_response?: boolean; // Default false for list views
  tag_filter?: string[]; // Filter by one or more tags
}

/**
 * Represents a balance summary, typically for an account or over a period.
 */
export interface AccountBalanceSummary { // Renamed from BalanceSummary
  total_debit_amount: number;  // Renamed from total_debits
  total_credit_amount: number; // Renamed from total_credits
  net_activity_change: number; // Renamed from net_change (Debits - Credits or vice-versa depending on account type)
  opening_balance_amount: number; // Renamed from opening_balance
  closing_balance_amount: number; // Renamed from closing_balance
  period_start_date_ts?: number; // Unix timestamp (seconds)
  period_end_date_ts?: number;   // Unix timestamp (seconds)
  account_id?: string;
}

/**
 * A TransactionHeader enriched with calculated impacts on relevant account balances.
 * Useful for displaying transaction effects without re-querying balances.
 */
export interface TransactionWithBalanceImpacts extends TransactionHeader {
  balance_impact_details: Array<{ // Renamed from balance_impacts
    account_id: string; // CoA ID
    account_code?: string;
    account_name?: string;
    change_in_balance: number; // Net effect on this account's balance
    new_account_balance_after_tx: number; // Renamed from new_balance
  }>;
}

/**
 * Result structure for bulk transaction operations (e.g., batch import, bulk void).
 */
export interface BulkTransactionOperationResult { // Renamed from BulkTransactionResult
  successfully_processed_ids: string[]; // Renamed from successful
  failed_operations_details: Array<{ // Renamed from failed
    input_index_or_id?: number | string; // Original index or temp ID from request
    error_message: string; // Renamed from error
    error_code?: string;
    input_data_snapshot?: NewTransactionInput | Partial<NewTransactionInput>; // Renamed from data
  }>;
  total_operations_requested: number; // Renamed from total
  total_succeeded_count: number; // Renamed from successCount
  total_failed_count?: number; // Added for clarity
}

/**
 * Configuration for mapping columns during transaction import from a file.
 */
export interface TransactionImportColumnMapping { // Renamed from TransactionImportMapping
  date_column_name_or_index: string | number; // Renamed from dateColumn
  description_column_name_or_index: string | number; // Renamed from descriptionColumn
  /** Column for single amount (positive for credit/inflow, negative for debit/outflow if no separate debit/credit columns). */
  single_amount_column_name_or_index?: string | number | null; // Renamed from amountColumn
  /** Column specifically for debit amounts (always positive). */
  debit_amount_column_name_or_index?: string | number | null; // Renamed from debitColumn
  /** Column specifically for credit amounts (always positive). */
  credit_amount_column_name_or_index?: string | number | null; // Renamed from creditColumn
  reference_or_check_no_column_name_or_index?: string | number | null; // Renamed from referenceColumn
  /** Column for payee/payer name, or mapping rules to determine it. */
  payee_or_payer_column_name_or_index?: string | number | null;
  /** Column for category hint, or mapping rules to determine ChartOfAccount ID. */
  category_hint_column_name_or_index?: string | number | null;
  /** Mappings from source file values to target ChartOfAccount IDs. Key is source value. */
  account_value_mapping_rules?: Record<string, string> | null; // Renamed from accountMapping
  date_format_if_string?: string | null; // e.g., "MM/DD/YYYY"
  debit_credit_indicator_column?: string | number | null; // Column that says "DEBIT" or "CREDIT"
  debit_indicator_value?: string; // Value in indicator column that means debit
  credit_indicator_value?: string; // Value in indicator column that means credit
}

/**
 * Represents a transaction row parsed from an import file, before final processing.
 */
export interface ImportedTransactionRow { // Renamed from ImportedTransaction
  original_row_number_in_file: number; // Renamed from rowNumber
  raw_data_from_row: Record<string, any>; // Renamed from rawData
  parsed_transaction_input?: NewTransactionInput | null; // Renamed from parsed
  validation_error_messages?: string[] | null; // Renamed from errors
  suggested_account_matches?: Array<{ // Renamed from suggestedAccounts
    target_account_id: string; // CoA ID
    match_confidence_score: number; // Renamed from confidence (0-1)
    match_reasoning?: string;
  }> | null;
  import_action_to_take?: 'create' | 'skip_duplicate' | 'update_existing' | 'flag_for_review';
}

/**
 * Represents a journal entry, which is a container for one or more related transactions
 * that collectively balance (debits equal credits for the journal as a whole).
 */
export interface JournalEntry { // Renamed from Journal
  /** Unique identifier (UUID) for this journal entry. */
  readonly id: string;
  readonly user_id: string;
  readonly entity_id: string;
  /** User-defined name or reference for this journal (e.g., "Payroll Sep 2025", "Month-End Accruals"). */
  journal_name_or_reference: string; // Renamed from name
  /** Date of the journal entry. Unix timestamp (seconds). */
  journal_date: number; // Renamed from date
  journal_entry_type?: 'general_ledger_journal' | 'closing_entry_journal' | 'adjusting_entry_journal' | 'recurring_journal_template_instance' | 'reversing_entry_journal'; // Renamed from type
  /** Array of TransactionHeader IDs that belong to this journal entry. Often fetched separately. */
  constituent_transaction_ids?: string[] | null; // Renamed from transactions (now IDs)
  total_debits_for_journal?: number; // Calculated sum
  total_credits_for_journal?: number; // Calculated sum
  is_balanced?: boolean; // Calculated
  /** Unix timestamp (seconds) when this journal entry was created. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when this journal entry was last updated. */
  updated_at: number;
  status?: 'draft' | 'posted' | 'approved' | 'voided';
  memo_or_description?: string;
}

/*
NOTE: Runtime helper functions and type guards previously in this file
(e.g., isRentTransaction, isMaintenanceTransaction, isPropertyRelatedTransaction, hasPropertyAllocation)
should be moved to a regular .ts utility file, for example:
`src/lib/transactions/transactionUtils.ts` or `src/lib/transactions/transactionGuards.ts`.
This keeps .d.ts files strictly for type declarations.
*/