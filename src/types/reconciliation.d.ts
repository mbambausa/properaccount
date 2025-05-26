// src/types/reconciliation.d.ts
/**
 * Bank reconciliation type definitions
 */

export type ReconciliationStatus = 
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'pending_review';

export type MatchType = 
  | 'exact'           // Perfect match
  | 'fuzzy'           // Close match with minor differences
  | 'suggested'       // AI suggested match
  | 'manual'          // User selected match
  | 'rule_based';     // Matched by automation rule

export type MatchConfidence = 'very_low' | 'low' | 'medium' | 'high' | 'exact';

export type ReconciliationMethod = 'manual' | 'auto' | 'semi_auto' | 'bank_feed';

/**
 * Bank reconciliation session
 */
export interface ReconciliationSession {
  readonly id: string;
  readonly user_id: string;
  entity_id: string;
  account_id: string;
  account_name: string;
  statement_date: number;
  start_date: number;
  end_date: number;
  opening_balance: number;
  closing_balance: number;
  statement_ending_balance: number;
  status: ReconciliationStatus;
  method: ReconciliationMethod;
  
  // Progress tracking
  total_statement_items: number;
  matched_items: number;
  unmatched_bank_items: number;
  unmatched_book_items: number;
  
  // Reconciliation results
  reconciled_balance?: number;
  difference?: number;
  is_balanced: boolean;
  
  // Metadata
  bank_name?: string;
  statement_reference?: string;
  notes?: string;
  readonly created_at: number;
  started_at?: number;
  completed_at?: number;
  completed_by?: string;
  last_activity_at?: number;
  
  // Reconciliation items
  matches?: ReconciliationMatch[];
  adjustments?: ReconciliationAdjustment[];
}

/**
 * Individual reconciliation match
 */
export interface ReconciliationMatch {
  readonly id: string;
  session_id: string;
  
  // Bank side
  bank_transaction_id: string;
  bank_date: number;
  bank_description: string;
  bank_amount: number;
  bank_reference?: string;
  bank_balance?: number;
  
  // Book side (can be multiple transactions)
  book_transaction_ids: string[];
  book_total_amount: number;
  
  // Match details
  match_type: MatchType;
  match_confidence: MatchConfidence;
  confidence_score?: number;
  match_reasons?: string[];
  
  // Differences
  date_difference_days?: number;
  amount_difference?: number;
  
  // Status
  status: 'pending' | 'accepted' | 'rejected' | 'disputed';
  reviewed_by?: string;
  reviewed_at?: number;
  notes?: string;
}

/**
 * Bank statement data
 */
export interface BankStatement {
  readonly id: string;
  account_id: string;
  statement_date: number;
  start_date: number;
  end_date: number;
  opening_balance: number;
  closing_balance: number;
  
  // Statement details
  bank_name: string;
  account_number_masked: string;
  statement_reference?: string;
  
  // Transactions
  transactions: BankTransaction[];
  
  // Upload info
  uploaded_at: number;
  uploaded_by: string;
  file_url?: string;
  file_type?: 'pdf' | 'csv' | 'ofx' | 'qfx';
  
  // Processing
  processed: boolean;
  processed_at?: number;
  parsing_errors?: string[];
}

/**
 * Bank transaction from statement
 */
export interface BankTransaction {
  readonly id: string;
  statement_id: string;
  date: number;
  posted_date?: number;
  description: string;
  amount: number;
  balance?: number;
  reference?: string;
  check_number?: string;
  type?: 'debit' | 'credit' | 'transfer' | 'fee' | 'interest';
  category?: string;
  merchant?: string;
  location?: string;
  
  // Reconciliation status
  is_reconciled: boolean;
  reconciliation_match_id?: string;
  
  // Additional metadata
  raw_description?: string;
  cleaned_description?: string;
  metadata?: Record<string, any>;
}

/**
 * Reconciliation rules for automation
 */
export interface ReconciliationRule {
  readonly id: string;
  readonly user_id: string;
  account_id?: string;
  name: string;
  description?: string;
  is_active: boolean;
  priority: number;
  
  // Matching criteria
  criteria: MatchCriteria;
  
  // Actions
  auto_accept: boolean;
  category_id?: string;
  add_tags?: string[];
  
  // Stats
  times_used: number;
  last_used_at?: number;
  success_rate?: number;
}

export interface MatchCriteria {
  amount_match?: {
    type: 'exact' | 'range' | 'tolerance';
    value?: number;
    min?: number;
    max?: number;
    tolerance_percent?: number;
  };
  
  date_match?: {
    type: 'exact' | 'range' | 'tolerance';
    tolerance_days?: number;
  };
  
  description_match?: {
    type: 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'exact';
    value: string;
    case_sensitive?: boolean;
  };
  
  reference_match?: {
    type: 'exact' | 'contains';
    value: string;
  };
}

/**
 * Reconciliation adjustments
 */
export interface ReconciliationAdjustment {
  readonly id: string;
  session_id: string;
  type: 'bank_fee' | 'interest' | 'error_correction' | 'timing_difference' | 'other';
  description: string;
  amount: number;
  is_debit: boolean;
  transaction_id?: string;
  created_by: string;
  created_at: number;
  approved?: boolean;
  approved_by?: string;
}

/**
 * Reconciliation summary report
 */
export interface ReconciliationSummary {
  account_id: string;
  period_start: number;
  period_end: number;
  
  // Balances
  book_opening_balance: number;
  book_closing_balance: number;
  bank_opening_balance: number;
  bank_closing_balance: number;
  
  // Activity
  total_deposits: number;
  total_withdrawals: number;
  deposit_count: number;
  withdrawal_count: number;
  
  // Reconciliation status
  outstanding_checks: Array<{
    date: number;
    reference: string;
    amount: number;
  }>;
  deposits_in_transit: Array<{
    date: number;
    description: string;
    amount: number;
  }>;
  
  // Adjustments
  total_adjustments: number;
  adjustment_details: ReconciliationAdjustment[];
  
  // Final status
  is_reconciled: boolean;
  reconciled_at?: number;
  reconciled_by?: string;
}

/**
 * Reconciliation discrepancy for investigation
 */
export interface ReconciliationDiscrepancy {
  id: string;
  session_id: string;
  type: 'missing_bank' | 'missing_book' | 'amount_mismatch' | 'duplicate';
  severity: 'low' | 'medium' | 'high';
  description: string;
  bank_transaction_id?: string;
  book_transaction_id?: string;
  amount_difference?: number;
  suggested_resolution?: string;
  resolved: boolean;
  resolution?: string;
}

/**
 * Bank feed integration
 */
export interface BankFeedConnection {
  id: string;
  entity_id: string;
  account_id: string;
  provider: 'plaid' | 'yodlee' | 'finicity' | 'manual';
  connection_status: 'active' | 'error' | 'disconnected';
  last_sync_at?: number;
  next_sync_at?: number;
  sync_frequency: 'daily' | 'weekly' | 'manual';
  error_message?: string;
  credentials_encrypted?: string;
}