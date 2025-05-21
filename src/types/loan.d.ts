// src/types/loan.d.ts

/**
 * Type of loan from a business classification perspective
 */
export type LoanType = 'mortgage' | 'seller_financing' | 'related_party' | 'other_receivable' | 'other_payable';

/**
 * Frequency of scheduled loan payments
 */
export type LoanPaymentFrequency = 'monthly' | 'quarterly' | 'annually' | 'lump_sum' | 'custom';

/**
 * Current status of the loan
 */
export type LoanStatus = 'active' | 'pending_approval' | 'paid_off' | 'defaulted' | 'cancelled' | 'draft';

/**
 * Whether the interest rate is fixed or variable
 */
export type InterestRateType = 'fixed' | 'variable';

/**
 * Method used to calculate interest
 */
export type InterestCalculationMethod = 'simple' | 'compound';

/**
 * Status of a payment in the amortization schedule
 */
export type LoanScheduleStatus = 'scheduled' | 'paid' | 'pending_payment' | 'skipped' | 'missed';

/**
 * Represents a loan (note receivable or note payable).
 * Aligns with the 'loans' D1 table (DbLoan).
 */
export interface Loan {
  /** Unique identifier (UUID) for this loan */
  readonly id: string;
  /** ID of the user who owns this loan record */
  readonly user_id: string;
  /** ID of the entity that owns this loan (receivable) or owes this loan (payable) */
  readonly entity_id: string;
  /** If receivable, name of the borrower */
  borrower_name?: string | null;
  /** If payable, name of the lender */
  lender_name?: string | null;
  /** Optional description of the loan purpose */
  description?: string | null;
  /** Classification of the loan type */
  loan_type: LoanType;
  /** Initial loan amount */
  readonly original_principal: number;
  /** Current outstanding principal balance */
  current_principal: number;
  /** Annual interest rate as a decimal (e.g., 0.05 for 5%) */
  interest_rate: number;
  /** Whether interest rate is fixed or variable */
  interest_rate_type: InterestRateType;
  /** Method used to calculate interest accrual */
  calculation_method: InterestCalculationMethod;
  /** Date when the loan was originated (Unix timestamp seconds) */
  readonly origination_date: number;
  /** Date when the loan is scheduled to be fully paid (Unix timestamp seconds) */
  maturity_date: number;
  /** How frequently payments are scheduled */
  payment_frequency: LoanPaymentFrequency;
  /** Regular payment amount */
  payment_amount: number;
  /** Current status of the loan */
  status: LoanStatus;
  /** Description of any collateral securing the loan */
  collateral_description?: string | null;
  /** Estimated value of the collateral */
  collateral_value?: number | null;
  /** Date of the next scheduled payment (Unix timestamp seconds) */
  next_payment_date?: number | null;
  /** ID of the account recording the loan principal in the chart of accounts */
  principal_account_id?: string | null;
  /** ID of the account recording interest expense/income */
  interest_account_id?: string | null;
  /** Timestamp when this loan record was created (Unix timestamp seconds) */
  readonly created_at: number;
  /** Timestamp when this loan record was last updated (Unix timestamp seconds) */
  updated_at: number;
  /** Whether this loan is a note receivable (true) or note payable (false) */
  readonly is_receivable: boolean;
}

/**
 * Represents an entry in a loan's amortization schedule.
 * Aligns with the 'loan_schedules' D1 table (DbLoanSchedule).
 */
export interface LoanScheduleEntry {
  /** Unique identifier (UUID) for this schedule entry */
  readonly id: string;
  /** ID of the loan this schedule entry belongs to */
  readonly loan_id: string;
  /** ID of the user who owns this record */
  readonly user_id: string;
  /** Sequential number of this payment in the overall schedule */
  readonly payment_number: number;
  /** Scheduled payment date (Unix timestamp seconds) */
  payment_date: number;
  /** Total scheduled payment amount (principal + interest) */
  total_payment: number;
  /** Portion of payment that applies to principal */
  principal_portion: number;
  /** Portion of payment that applies to interest */
  interest_portion: number;
  /** Expected principal balance after this payment */
  remaining_balance: number;
  /** Current status of this scheduled payment */
  status: LoanScheduleStatus;
  /** Date when payment was actually made, if different from scheduled (Unix timestamp seconds) */
  actual_payment_date?: number | null;
  /** Actual amount paid, if different from scheduled amount */
  actual_payment_amount?: number | null;
  /** ID of the accounting transaction recording this payment */
  transaction_id?: string | null;
  /** Timestamp when this schedule entry was created (Unix timestamp seconds) */
  readonly created_at: number;
  /** Timestamp when this schedule entry was last updated (Unix timestamp seconds) */
  updated_at: number;
}

/**
 * Complete amortization schedule for a loan
 */
export interface AmortizationSchedule {
  /** ID of the loan this schedule is for */
  readonly loan_id: string;
  /** The complete set of scheduled payments */
  entries: LoanScheduleEntry[];
  /** Date this schedule was generated (Unix timestamp seconds) */
  readonly generated_at: number;
  /** Total interest to be paid over the life of the loan */
  total_interest: number;
  /** Total principal + interest to be paid over the life of the loan */
  total_payments: number;
}

/**
 * Input payload for creating or updating a Loan.
 * `user_id` is derived from session. `current_principal` usually starts as `original_principal`.
 */
export interface LoanInput {
  /** ID of the entity that owns/owes this loan (required) */
  entity_id: string;
  /** Name of the borrower (required for receivables) */
  borrower_name?: string | null;
  /** Name of the lender (required for payables) */
  lender_name?: string | null;
  /** Optional description of the loan purpose */
  description?: string | null;
  /** Classification of the loan type (required) */
  loan_type: LoanType;
  /** Initial loan amount (required, > 0) */
  original_principal: number;
  /** Annual interest rate as a decimal (required, >= 0) */
  interest_rate: number;
  /** Whether interest rate is fixed or variable (required) */
  interest_rate_type: InterestRateType;
  /** Method used to calculate interest (required) */
  calculation_method: InterestCalculationMethod;
  /** Date when the loan was originated (required, Unix timestamp seconds) */
  origination_date: number;
  /** Date when the loan is due (required, Unix timestamp seconds) */
  maturity_date: number;
  /** How frequently payments are scheduled (required) */
  payment_frequency: LoanPaymentFrequency;
  /** Regular payment amount (required, > 0) */
  payment_amount: number;
  /** Initial status of the loan (defaults to 'draft') */
  status?: LoanStatus;
  /** Description of any collateral securing the loan */
  collateral_description?: string | null;
  /** Estimated value of the collateral */
  collateral_value?: number | null;
  /** Date of the first scheduled payment (Unix timestamp seconds) */
  next_payment_date?: number | null;
  /** ID of the account recording the loan principal */
  principal_account_id?: string | null;
  /** ID of the account recording interest expense/income */
  interest_account_id?: string | null;
  /** Whether this loan is a note receivable (true) or note payable (false) (required) */
  is_receivable: boolean;
}

/**
 * Input for recording a payment against a loan schedule entry.
 */
export interface RecordLoanPaymentInput {
  /** ID of the loan schedule entry being paid (required) */
  loan_schedule_id: string;
  /** Date when payment was actually made (required, Unix timestamp seconds) */
  actual_payment_date: number;
  /** Amount actually paid (required, > 0) */
  actual_payment_amount: number;
  /** ID of the accounting transaction if already created */
  transaction_id?: string;
  /** Updated status for the schedule entry (defaults to 'paid') */
  new_status?: LoanScheduleStatus;
  /** Optional payment notes */
  notes?: string | null;
}

/**
 * Summary of a loan for reporting purposes
 */
export interface LoanSummary {
  /** Loan ID */
  id: string;
  /** Name of borrower or lender */
  counterparty_name: string;
  /** Loan type */
  loan_type: LoanType;
  /** Whether this is a receivable or payable */
  is_receivable: boolean;
  /** Original loan amount */
  original_principal: number;
  /** Current outstanding balance */
  current_principal: number;
  /** Annual interest rate */
  interest_rate: number;
  /** Maturity date (Unix timestamp seconds) */
  maturity_date: number;
  /** Current loan status */
  status: LoanStatus;
  /** Next scheduled payment date (Unix timestamp seconds) */
  next_payment_date?: number | null;
  /** Count of payments made to date */
  payments_made: number;
  /** Count of payments remaining */
  payments_remaining: number;
  /** Percentage of loan that has been paid off */
  percent_complete: number;
}