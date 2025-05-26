// src/types/reconciliation.d.ts
/**
 * Defines TypeScript interfaces for bank reconciliation processes,
 * including reconciliation sessions, transaction matching, bank statement data,
 * automation rules, and bank feed connections.
 */

/**
 * Status of a bank reconciliation process.
 */
export type ReconciliationStatus =
  | 'not_started'          // Reconciliation has not yet begun
  | 'in_progress'          // Reconciliation is actively being worked on
  | 'pending_review'       // Reconciliation completed by system/user, awaiting another review/approval
  | 'completed_balanced'   // Reconciliation finished, and balances match
  | 'completed_with_discrepancy' // Reconciliation finished, but there's an unexplained difference
  | 'abandoned_by_user'    // User explicitly abandoned the process
  | 'auto_closed_incomplete';// System closed due to inactivity or unresolved issues

/**
 * Type of match found between a bank transaction and book (ledger) transaction(s).
 */
export type MatchType =
  | 'exact_match'              // Perfect match on key criteria (e.g., date, amount, reference)
  | 'fuzzy_match_system'       // System found a close match with minor differences (e.g., slight date/amount variance)
  | 'ai_suggested_match'       // AI model suggested this match
  | 'manual_user_match'        // User manually selected and confirmed this match
  | 'rule_based_auto_match'    // Matched automatically by a predefined ReconciliationRule
  | 'one_to_many_bank_to_book' // One bank transaction matches multiple book transactions
  | 'many_to_one_bank_to_book' // Multiple bank transactions match one book transaction
  | 'many_to_many_bank_to_book';// Multiple bank transactions match multiple book transactions

/**
 * Confidence level of a match, especially for system-suggested matches.
 */
export type MatchConfidence = 'very_low' | 'low' | 'medium' | 'high' | 'exact_system_verified';

/**
 * Method used to perform the reconciliation.
 */
export type ReconciliationMethod = 'manual_line_by_line' | 'automated_with_rules' | 'semi_automated_review' | 'bank_feed_auto_match';

/**
 * Represents a bank reconciliation session for a specific account and period.
 */
export interface ReconciliationSession {
  /** Unique identifier (UUID) for this reconciliation session. */
  readonly id: string;
  /** ID of the user performing or responsible for this reconciliation. */
  readonly user_id: string;
  /** ID of the entity this reconciliation belongs to. */
  entity_id: string;
  /** ID of the Chart of Account (cash account) being reconciled. */
  account_id: string;
  account_name?: string; // Denormalized for display
  /** Date of the bank statement being reconciled. Unix timestamp (seconds), typically end of day. */
  statement_date: number;
  /** Start date of the period being reconciled. Unix timestamp (seconds), typically start of day. */
  statement_period_start_date: number; // Renamed from start_date
  /** End date of the period being reconciled. Unix timestamp (seconds), typically end of day. */
  statement_period_end_date: number;   // Renamed from end_date

  /** Opening balance from the book/ledger for the period. */
  book_opening_balance: number; // Renamed from opening_balance
  /** Closing balance from the bank statement. */
  bank_statement_ending_balance: number; // Renamed from statement_ending_balance
  /** Closing balance from the book/ledger for the period before adjustments. */
  book_closing_balance_pre_adjustment?: number;

  status: ReconciliationStatus;
  method_used: ReconciliationMethod; // Renamed from method

  // Progress tracking
  total_bank_statement_items: number; // Renamed from total_statement_items
  matched_item_count: number; // Renamed from matched_items
  unmatched_bank_item_count: number; // Renamed from unmatched_bank_items
  unmatched_book_item_count: number; // Renamed from unmatched_book_items

  // Reconciliation results
  calculated_reconciled_book_balance?: number | null; // Renamed from reconciled_balance (Book balance after adjustments)
  difference_to_statement: number; // (Calculated Reconciled Book Balance - Bank Statement Ending Balance)
  is_fully_balanced: boolean; // Renamed from is_balanced (true if difference_to_statement is zero or within tolerance)
  balancing_tolerance?: number; // e.g. 0.01 for small differences

  // Metadata
  bank_name?: string | null;
  bank_statement_reference_id?: string | null; // Renamed from statement_reference
  user_notes?: string | null; // Renamed from notes
  /** Unix timestamp (seconds) when this session was created. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when this session was actively started. */
  started_at?: number | null;
  /** Unix timestamp (seconds) when this session was completed or finalized. */
  completed_at?: number | null;
  completed_by_user_id?: string | null; // Renamed from completed_by
  /** Unix timestamp (seconds) of the last activity in this session. */
  last_activity_at?: number | null;

  // Linked items (optional, could be fetched on demand)
  // matches?: ReconciliationMatch[];
  // adjustments?: ReconciliationAdjustment[];
  bank_statement_id?: string | null; // If bank statements are stored as separate records
}

/**
 * Represents a match between one or more bank transactions and one or more book (ledger) transactions.
 */
export interface ReconciliationMatch {
  /** Unique identifier (UUID) for this match. */
  readonly id: string;
  session_id: string; // Links to ReconciliationSession

  // Bank side details (can be an aggregate if many-to-one)
  /** IDs of bank transactions involved in this match. */
  bank_transaction_ids: string[]; // Changed from bank_transaction_id to array
  /** Earliest date of matched bank transactions. Unix timestamp (seconds). */
  bank_transaction_earliest_date: number; // Renamed from bank_date
  bank_transaction_description_summary: string; // Concatenated or primary description
  total_bank_transaction_amount: number; // Sum of amounts if multiple bank txns
  bank_transaction_references?: string[] | null;

  // Book side details (ledger transactions)
  /** IDs of book (ledger) transactions involved in this match. */
  book_transaction_ids: string[];
  total_book_transaction_amount: number;
  book_transaction_descriptions?: string[] | null;

  // Match details
  match_type: MatchType;
  match_confidence_level?: MatchConfidence | null; // Renamed from match_confidence
  match_confidence_score_value?: number | null; // e.g., 0.0 to 1.0
  match_reasoning_details?: string[] | null; // Renamed from match_reasons

  // Differences (if not an exact match but still accepted)
  date_difference_in_days?: number | null;
  amount_difference_value?: number | null;

  // Status & Review
  match_status: 'suggested_pending_review' | 'user_accepted' | 'user_rejected' | 'system_auto_accepted' | 'disputed_by_user'; // Renamed from status
  reviewed_by_user_id?: string | null; // Renamed from reviewed_by
  /** Unix timestamp (seconds) when reviewed. */
  reviewed_at?: number | null;
  user_notes_on_match?: string | null; // Renamed from notes
}

/**
 * Represents an imported or electronically fetched bank statement.
 */
export interface BankStatement {
  /** Unique identifier (UUID) for this statement record. */
  readonly id: string;
  /** ID of the Chart of Account (cash account) this statement is for. */
  account_id: string;
  /** Date of the statement (usually end of period). Unix timestamp (seconds). */
  statement_date: number;
  /** Start date of the statement period. Unix timestamp (seconds). */
  statement_period_start_date: number; // Renamed from start_date
  /** End date of the statement period. Unix timestamp (seconds). */
  statement_period_end_date: number;   // Renamed from end_date
  opening_balance_from_statement: number; // Renamed from opening_balance
  closing_balance_from_statement: number; // Renamed from closing_balance

  bank_name: string;
  account_number_masked?: string | null;
  statement_reference_code?: string | null; // Renamed from statement_reference

  /** Array of transactions listed on this statement. */
  transactions: BankTransaction[];

  /** Unix timestamp (seconds) when this statement was uploaded/fetched. */
  imported_at: number; // Renamed from uploaded_at
  imported_by_user_id: string; // Renamed from uploaded_by
  source_file_url?: string | null; // If uploaded from a file
  source_file_type?: 'pdf' | 'csv' | 'ofx' | 'qfx' | 'api_feed'; // Renamed from file_type
  bank_feed_connection_id?: string | null; // If from a bank feed

  is_fully_processed_for_reconciliation: boolean; // Renamed from processed
  /** Unix timestamp (seconds) when processing/parsing finished. */
  processed_at_timestamp?: number | null; // Renamed from processed_at
  parsing_error_messages?: string[] | null; // Renamed from parsing_errors
}

/**
 * Represents a single transaction from a bank statement.
 */
export interface BankTransaction {
  /** Unique identifier (UUID) for this bank transaction record. */
  readonly id: string;
  bank_statement_id: string; // Links to BankStatement
  /** Transaction date as per bank. Unix timestamp (seconds). */
  transaction_date: number; // Renamed from date
  /** Date transaction was posted by the bank. Unix timestamp (seconds). */
  posted_date?: number | null;
  description_original: string; // Renamed from description
  amount: number; // Positive for credits/deposits, negative for debits/withdrawals
  running_balance_after_txn?: number | null; // Renamed from balance
  bank_reference_code?: string | null; // Renamed from reference
  check_number_if_any?: string | null; // Renamed from check_number
  transaction_type_by_bank?: 'debit' | 'credit' | 'transfer' | 'fee' | 'interest' | 'atm' | 'pos' | 'direct_deposit' | 'other'; // Renamed from type
  bank_provided_category?: string | null; // Renamed from category
  merchant_name_or_payee?: string | null; // Renamed from merchant
  transaction_location?: string | null; // Renamed from location

  // Reconciliation status for this specific bank transaction
  is_matched_in_reconciliation: boolean; // Renamed from is_reconciled
  reconciliation_match_id?: string | null; // Links to ReconciliationMatch

  // Additional metadata
  cleaned_or_enriched_description?: string | null;
  custom_metadata?: Record<string, any> | null;
}

/**
 * Rule for automating bank transaction matching during reconciliation.
 */
export interface ReconciliationRule {
  /** Unique identifier (UUID) for this rule. */
  readonly id: string;
  /** ID of the user who created/owns this rule. */
  readonly user_id: string;
  /** Optional: If rule is specific to one cash account. */
  target_account_id?: string | null; // Renamed from account_id
  rule_name: string; // Renamed from name
  description_notes?: string | null; // Renamed from description
  is_active: boolean;
  execution_priority: number; // Lower numbers run first

  // Matching criteria for bank transaction
  bank_transaction_match_criteria: BankTransactionMatchCriteria; // Renamed from criteria and MatchCriteria

  // Actions to perform on match
  auto_accept_match_if_confident?: boolean; // Renamed from auto_accept
  /** Suggest or auto-assign this book account ID if matched. */
  suggested_book_account_id?: string | null; // Renamed from category_id (assuming category means account)
  add_tags_to_book_transaction?: string[] | null; // Renamed from add_tags
  create_book_transaction_if_missing?: {
    default_description_template?: string; // e.g., "Bank Fee: {{bank.description}}"
    default_book_account_id: string; // Account for the other side of entry (e.g. Bank Fees Expense)
    default_is_debit_for_book: boolean; // If bank debit, should book be credit to cash and debit to expense?
  } | null;

  // Stats
  times_rule_applied_successfully: number; // Renamed from times_used
  /** Unix timestamp (seconds) when this rule was last successfully applied. */
  last_successfully_applied_at?: number | null; // Renamed from last_used_at
  historical_success_rate_percent?: number | null; // Renamed from success_rate
}

export interface BankTransactionMatchCriteria {
  amount_match_condition?: { // Renamed from amount_match
    type: 'exact_amount' | 'amount_within_range' | 'amount_within_tolerance_percent';
    exact_value?: number | null;
    min_value?: number | null;
    max_value?: number | null;
    tolerance_percentage?: number | null; // As decimal, e.g., 0.01 for 1%
  } | null;

  date_match_condition?: { // Renamed from date_match
    type: 'exact_date' | 'date_within_days_range';
    tolerance_in_days?: number | null;
  } | null;

  description_text_match_condition?: { // Renamed from description_match
    type: 'text_contains' | 'text_starts_with' | 'text_ends_with' | 'exact_text_match' | 'matches_regex_pattern';
    search_value: string;
    is_case_sensitive?: boolean;
  } | null;

  reference_code_match_condition?: { // Renamed from reference_match
    type: 'exact_code_match' | 'code_contains_text';
    search_value: string;
  } | null;
  bank_transaction_type_filter?: BankTransaction['transaction_type_by_bank'][]; // Only apply rule if bank tx type is one of these
  logical_operator_for_criteria?: 'AND_ALL' | 'OR_ANY'; // How multiple criteria are combined
}

/**
 * Represents an adjustment made during reconciliation (e.g., bank fees, interest earned).
 * These typically result in new book transactions.
 */
export interface ReconciliationAdjustment {
  /** Unique identifier (UUID) for this adjustment. */
  readonly id: string;
  session_id: string; // Links to ReconciliationSession
  adjustment_type: 'bank_service_fee' | 'interest_earned' | 'nsf_fee_received' | 'error_correction_bank' | 'error_correction_book' | 'timing_difference_adjustment' | 'other_adjustment';
  description_notes: string; // Renamed from description
  amount: number; // Positive value
  is_debit_to_cash_account: boolean; // True if reduces cash, false if increases cash
  /** ID of the new book transaction created for this adjustment. */
  linked_book_transaction_id?: string | null; // Renamed from transaction_id
  created_by_user_id: string; // Renamed from created_by
  /** Unix timestamp (seconds) when adjustment was created. */
  created_at: number;
  is_approved_for_posting?: boolean; // Renamed from approved
  approved_by_user_id?: string | null; // Renamed from approved_by
  /** Date for the adjustment transaction. Unix timestamp (seconds). */
  adjustment_date: number;
}

/**
 * Summary report generated at the end of a reconciliation process.
 */
export interface ReconciliationCompletionSummary { // Renamed from ReconciliationSummary
  reconciliation_session_id: string; // Link to session
  account_id: string;
  /** Period start date. Unix timestamp (seconds). */
  period_start_date_utc: number; // Renamed from period_start
  /** Period end date. Unix timestamp (seconds). */
  period_end_date_utc: number;   // Renamed from period_end

  // Balances
  book_balance_opening_period: number; // Renamed from book_opening_balance
  bank_statement_balance_opening_period?: number | null; // From statement, if available
  
  add_deposits_in_transit: Array<OutstandingItemDetail>; // Renamed from deposits_in_transit
  total_deposits_in_transit: number;
  
  subtract_outstanding_checks_or_payments: Array<OutstandingItemDetail>; // Renamed from outstanding_checks
  total_outstanding_checks_or_payments: number;

  book_adjustments_for_reconciliation: ReconciliationAdjustment[]; // Renamed from adjustment_details
  total_book_adjustments_amount: number; // Sum of adjustment amounts (net effect)

  adjusted_book_balance: number; // Book Opening + Deposits in Transit - Outstanding Checks +/- Adjustments
  bank_statement_balance_closing_period: number; // Renamed from bank_closing_balance

  // Final status
  is_reconciled_successfully: boolean; // Renamed from is_reconciled (true if adjusted_book_balance equals bank_statement_balance_closing_period within tolerance)
  final_difference_amount: number;
  /** Unix timestamp (seconds) when reconciliation was finalized. */
  reconciliation_finalized_at?: number | null; // Renamed from reconciled_at
  finalized_by_user_id?: string | null; // Renamed from reconciled_by
}

export interface OutstandingItemDetail {
  /** Original transaction date. Unix timestamp (seconds). */
  original_transaction_date: number; // Renamed from date
  reference_or_check_number?: string | null; // Renamed from reference
  description_or_payee?: string | null; // Added for clarity
  amount: number;
  book_transaction_id?: string; // Link to the book transaction
}


/**
 * Represents a discrepancy found during reconciliation that needs investigation.
 */
export interface ReconciliationDiscrepancyItem { // Renamed from ReconciliationDiscrepancy
  readonly id: string; // UUID
  session_id: string;
  discrepancy_type: 'missing_item_in_bank_statement' | 'missing_item_in_book_ledger' | 'amount_mismatch_item' | 'potential_duplicate_item' | 'date_mismatch_significant';
  severity_level: 'low' | 'medium' | 'high' | 'critical_stop'; // Renamed from severity
  description_of_discrepancy: string; // Renamed from description
  bank_transaction_id?: string | null; // If related to a bank transaction
  book_transaction_id?: string | null; // If related to a book transaction
  amount_difference_if_any?: number | null; // Renamed from amount_difference
  suggested_resolution_action?: string | null; // Renamed from suggested_resolution
  is_resolved: boolean; // Renamed from resolved
  resolution_notes_text?: string | null; // Renamed from resolution
  assigned_to_user_id?: string | null;
  /** Unix timestamp (seconds) when discrepancy was identified. */
  identified_at: number;
}

/**
 * Configuration for a bank feed connection (e.g., Plaid, Yodlee).
 */
export interface BankFeedConnection {
  /** Unique identifier (UUID) for this connection. */
  readonly id: string;
  entity_id: string; // Entity this feed belongs to
  /** ID of the Chart of Account (cash account) linked to this feed. */
  linked_coa_id: string; // Renamed from account_id
  provider_name: 'plaid' | 'yodlee' | 'teller_io' | 'finicity' | 'mx_platform' | 'manual_sftp_import'; // Renamed from provider
  connection_current_status: 'active_syncing' | 'requires_reauthentication' | 'error_sync_failed' | 'disconnected_by_user' | 'paused'; // Renamed from connection_status
  /** Unix timestamp (seconds) of the last successful data synchronization. */
  last_successful_sync_timestamp?: number | null; // Renamed from last_sync_at
  /** Unix timestamp (seconds) of the next scheduled synchronization attempt. */
  next_scheduled_sync_timestamp?: number | null; // Renamed from next_sync_at
  sync_schedule_frequency: 'automatic_daily' | 'manual_trigger_only' | 'every_few_hours'; // Renamed from sync_frequency
  last_error_message?: string | null; // Renamed from error_message
  /** Store encrypted provider-specific access tokens or configuration. DO NOT store raw credentials. */
  encrypted_provider_credentials_or_config?: string | null; // Renamed from credentials_encrypted
  /** User-friendly name for this bank feed connection. */
  connection_label?: string;
  /** Date from which transactions should initially be fetched. ISO 8601 Date String (YYYY-MM-DD). */
  initial_fetch_from_date?: string | null;
  /** Unix timestamp (seconds) when this connection was created. */
  readonly created_at: number;
  updated_at: number;
}