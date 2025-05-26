// src/types/loan.d.ts
/**
 * Type of loan from a business and real estate perspective.
 */
export type LoanType = 
  | 'mortgage'
  | 'construction_loan'
  | 'bridge_loan'
  | 'home_equity_loan'
  | 'hard_money_loan'
  | 'seller_financing'
  | 'land_contract'
  | 'related_party'
  | 'tenant_deposit_loan'
  | 'rehab_loan'
  | 'mezzanine_loan'
  | 'other_receivable'
  | 'other_payable';

/**
 * Frequency of scheduled loan payments.
 */
export type LoanPaymentFrequency = 'monthly' | 'quarterly' | 'annually' | 'lump_sum' | 'custom';

/**
 * Current status of the loan.
 */
export type LoanStatus = 'active' | 'pending_approval' | 'paid_off' | 'defaulted' | 'cancelled' | 'draft';

/**
 * Whether the interest rate is fixed or variable.
 */
export type InterestRateType = 'fixed' | 'variable';

/**
 * Method used to calculate interest.
 */
export type InterestCalculationMethod = 'simple' | 'compound';

/**
 * Status of a payment in the amortization schedule.
 */
export type LoanScheduleStatus = 'scheduled' | 'paid' | 'pending_payment' | 'skipped' | 'missed';

/**
 * Enhanced collateral information for real estate loans.
 */
export interface CollateralDetails {
  type: 'real_property' | 'personal_guarantee' | 'cash' | 'securities' | 'other';
  property?: {
    property_id: string;
    address: string;
    property_type: string;
    appraised_value: number;
    appraisal_date: number;
    lien_position: 'first' | 'second' | 'third' | 'other';
  };
  guarantors?: Array<{
    name: string;
    entity_id?: string;
    guarantee_amount?: number;
    is_unlimited?: boolean;
  }>;
  ucc_filing?: {
    filing_number: string;
    filing_date: number;
    jurisdiction: string;
  };
}

/**
 * Represents a loan (note receivable or note payable), extended for real estate.
 */
export interface Loan {
  /** Unique identifier (UUID) for this loan */
  readonly id: string;
  readonly user_id: string;
  readonly entity_id: string;
  borrower_name?: string | null;
  lender_name?: string | null;
  description?: string | null;
  loan_type: LoanType;
  readonly original_principal: number;
  current_principal: number;
  interest_rate: number;
  interest_rate_type: InterestRateType;
  calculation_method: InterestCalculationMethod;
  readonly origination_date: number;
  maturity_date: number;
  payment_frequency: LoanPaymentFrequency;
  payment_amount: number;
  status: LoanStatus;
  collateral_description?: string | null;
  collateral_value?: number | null;
  next_payment_date?: number | null;
  principal_account_id?: string | null;
  interest_account_id?: string | null;
  readonly created_at: number;
  updated_at: number;
  readonly is_receivable: boolean;

  /** Real estate specific fields */
  property_id?: string | null;
  original_ltv?: number | null;
  current_ltv?: number | null;
  dscr?: number | null;
  prepayment_penalty?: {
    type: 'none' | 'fixed' | 'declining' | 'yield_maintenance';
    amount?: number;
    end_date?: number;
    description?: string;
  } | null;
  escrow_details?: {
    include_taxes: boolean;
    include_insurance: boolean;
    monthly_amount?: number;
    account_id?: string;
  } | null;
  variable_rate_details?: {
    index_type: 'prime' | 'libor' | 'sofr' | 'treasury' | 'other';
    margin: number;
    rate_cap?: number;
    rate_floor?: number;
    adjustment_frequency?: string;
    next_adjustment_date?: number;
  } | null;
  balloon_payment?: {
    amount: number;
    due_date: number;
  } | null;
  construction_details?: {
    draw_schedule?: Array<{
      phase: string;
      amount: number;
      expected_date: number;
      drawn_date?: number;
    }>;
    interest_reserve?: number;
    completion_date?: number;
  } | null;
  /** Enhanced collateral info */
  collateral_details?: CollateralDetails | null;
}

/**
 * Represents an entry in a loan's amortization schedule.
 */
export interface LoanScheduleEntry {
  readonly id: string;
  readonly loan_id: string;
  readonly user_id: string;
  readonly payment_number: number;
  payment_date: number;
  total_payment: number;
  principal_portion: number;
  interest_portion: number;
  remaining_balance: number;
  status: LoanScheduleStatus;
  actual_payment_date?: number | null;
  actual_payment_amount?: number | null;
  transaction_id?: string | null;
  readonly created_at: number;
  updated_at: number;
}

/**
 * Complete amortization schedule for a loan.
 */
export interface AmortizationSchedule {
  readonly loan_id: string;
  entries: LoanScheduleEntry[];
  readonly generated_at: number;
  total_interest: number;
  total_payments: number;
}

/**
 * Input payload for creating or updating a Loan.
 */
export interface LoanInput {
  entity_id: string;
  borrower_name?: string | null;
  lender_name?: string | null;
  description?: string | null;
  loan_type: LoanType;
  original_principal: number;
  interest_rate: number;
  interest_rate_type: InterestRateType;
  calculation_method: InterestCalculationMethod;
  origination_date: number;
  maturity_date: number;
  payment_frequency: LoanPaymentFrequency;
  payment_amount: number;
  status?: LoanStatus;
  collateral_description?: string | null;
  collateral_value?: number | null;
  next_payment_date?: number | null;
  principal_account_id?: string | null;
  interest_account_id?: string | null;
  is_receivable: boolean;

  /** Real estate specific fields */
  property_id?: string | null;
  original_ltv?: number | null;
  dscr?: number | null;
  prepayment_penalty?: {
    type: 'none' | 'fixed' | 'declining' | 'yield_maintenance';
    amount?: number;
    end_date?: number;
    description?: string;
  } | null;
  escrow_details?: {
    include_taxes: boolean;
    include_insurance: boolean;
    monthly_amount?: number;
    account_id?: string;
  } | null;
  variable_rate_details?: {
    index_type: 'prime' | 'libor' | 'sofr' | 'treasury' | 'other';
    margin: number;
    rate_cap?: number;
    rate_floor?: number;
    adjustment_frequency?: string;
    next_adjustment_date?: number;
  } | null;
  balloon_payment?: {
    amount: number;
    due_date: number;
  } | null;
  construction_details?: {
    draw_schedule?: Array<{
      phase: string;
      amount: number;
      expected_date: number;
      drawn_date?: number;
    }>;
    interest_reserve?: number;
    completion_date?: number;
  } | null;
  collateral_details?: CollateralDetails | null;
}

/**
 * Input for recording a payment against a loan schedule entry.
 */
export interface RecordLoanPaymentInput {
  loan_schedule_id: string;
  actual_payment_date: number;
  actual_payment_amount: number;
  transaction_id?: string;
  new_status?: LoanScheduleStatus;
  notes?: string | null;
}

/**
 * Summary of a loan for reporting purposes.
 */
export interface LoanSummary {
  id: string;
  counterparty_name: string;
  loan_type: LoanType;
  is_receivable: boolean;
  original_principal: number;
  current_principal: number;
  interest_rate: number;
  maturity_date: number;
  status: LoanStatus;
  next_payment_date?: number | null;
  payments_made: number;
  payments_remaining: number;
  percent_complete: number;
}

/**
 * Loan performance and analytics data.
 */
export interface LoanPerformance {
  loan_id: string;
  payment_metrics: {
    on_time_payments: number;
    late_payments: number;
    missed_payments: number;
    average_days_late?: number;
    total_late_fees?: number;
  };
  financial_metrics: {
    total_paid_to_date: number;
    total_principal_paid: number;
    total_interest_paid: number;
    remaining_interest: number;
    effective_interest_rate?: number;
  };
  risk_indicators: {
    current_ltv?: number;
    debt_service_ratio?: number;
    days_past_due?: number;
    risk_rating?: 'low' | 'medium' | 'high';
  };
}

/**
 * Loan refinancing details.
 */
export interface LoanRefinance {
  original_loan_id: string;
  new_loan_id: string;
  refinance_date: number;
  reason: 'rate_reduction' | 'cash_out' | 'term_change' | 'payment_reduction' | 'other';
  cash_out_amount?: number;
  closing_costs?: number;
  break_even_months?: number;
}

/**
 * Loan portfolio summary for reporting/analytics.
 */
export interface LoanPortfolioSummary {
  total_loans: number;
  by_type: Record<LoanType, {
    count: number;
    total_balance: number;
    average_rate: number;
  }>;
  total_outstanding: number;
  weighted_avg_rate: number;
  health_metrics: {
    performing_loans: number;
    non_performing_loans: number;
    loans_in_default: number;
    average_ltv?: number;
    average_dscr?: number;
  };
  maturity_profile: Array<{
    year: number;
    maturing_loans: number;
    maturing_balance: number;
  }>;
}
