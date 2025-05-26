// src/types/loan.d.ts
/**
 * Defines TypeScript interfaces related to loans, including mortgages,
 * construction loans, amortization schedules, payments, and loan analytics,
 * with specific considerations for real estate finance.
 */

/**
 * Type of loan from a business and real estate perspective.
 */
export type LoanType =
  | 'mortgage_residential'
  | 'mortgage_commercial'
  | 'construction_loan_new'
  | 'construction_loan_renovation' // Same as rehab_loan
  | 'bridge_loan'
  | 'home_equity_loan' // HELOAN
  | 'home_equity_line_of_credit' // HELOC
  | 'hard_money_loan'
  | 'seller_financing_note' // Renamed for clarity
  | 'land_contract_agreement' // Renamed for clarity
  | 'related_party_loan'      // Renamed for clarity
  | 'tenant_security_deposit_loan' // If deposits are treated as loans or similar obligation
  | 'rehabilitation_loan'        // Renamed for clarity
  | 'mezzanine_financing'        // Renamed for clarity
  | 'equipment_financing'        // For business assets
  | 'line_of_credit_business'
  | 'personal_loan_unsecured'
  | 'other_receivable_note'    // If app tracks notes receivable that are loan-like
  | 'other_payable_note';      // If app tracks notes payable that are loan-like

/**
 * Frequency of scheduled loan payments.
 */
export type LoanPaymentFrequency =
  | 'monthly'
  | 'bi_weekly' // Every two weeks
  | 'semi_monthly' // Twice a month (e.g., 1st and 15th)
  | 'quarterly'
  | 'semi_annually'
  | 'annually'
  | 'lump_sum_at_maturity' // Renamed from lump_sum
  | 'interest_only_periodic'
  | 'custom_schedule'; // For irregular payment schedules

/**
 * Current status of the loan.
 */
export type LoanStatus =
  | 'draft'                   // Loan application started but not submitted/finalized
  | 'pending_underwriting'    // Submitted, awaiting lender approval (renamed from pending_approval)
  | 'approved_pending_funding'
  | 'active_current'          // Funded and payments are up-to-date
  | 'active_in_arrears'       // Payments are late
  | 'paid_off_fully'          // Renamed from paid_off
  | 'refinanced'
  | 'defaulted_legal_action'  // Renamed from defaulted
  | 'foreclosure_proceedings'
  | 'cancelled_by_applicant'  // Renamed from cancelled
  | 'rejected_by_lender'
  | 'sold_transferred';       // Loan has been sold to another servicer

/**
 * Whether the interest rate is fixed or variable.
 */
export type InterestRateType = 'fixed' | 'variable_adjustable'; // Renamed variable

/**
 * Method used to calculate interest (e.g., simple interest, compound interest).
 */
export type InterestCalculationMethod =
  | 'simple_on_remaining_balance' // Most common for mortgages
  | 'compound_daily'
  | 'compound_monthly'
  | 'compound_annually'
  | 'interest_only_calculation'
  | 'rule_of_78s'; // Less common now, but exists

/**
 * Status of an individual payment in the amortization schedule.
 */
export type LoanSchedulePaymentStatus = // Renamed from LoanScheduleStatus
  | 'scheduled_future' // Renamed from scheduled
  | 'paid_on_time'
  | 'paid_late'
  | 'payment_pending_clearing' // Renamed from pending_payment
  | 'skipped_deferred' // Renamed from skipped (e.g., due to forbearance)
  | 'missed_defaulted'; // Renamed from missed

/**
 * Detailed information about collateral securing a loan, especially for real estate.
 */
export interface CollateralDetails {
  type: 'real_property' | 'personal_guarantee' | 'business_assets' | 'cash_deposit' | 'marketable_securities' | 'other_collateral';
  description?: string; // General description of the collateral
  property?: {
    property_id: string; // UUID of the property entity
    address: string; // Full address
    property_type_description: string; // e.g., "Single Family Residence", "Commercial Office Building"
    appraised_market_value: number; // Renamed from appraised_value
    /** Unix timestamp (seconds) of the appraisal. */
    appraisal_date: number;
    lien_position: 'first' | 'second' | 'third_plus' | 'other_position'; // Renamed for clarity
    ltv_at_origination?: number; // Loan-to-Value at origination as decimal
  };
  guarantors?: Array<{
    guarantor_name: string; // Renamed from name
    guarantor_entity_id?: string | null; // UUID if guarantor is an entity in the system
    guarantee_amount_limit?: number | null; // Renamed from guarantee_amount
    is_unlimited_guarantee?: boolean; // Renamed from is_unlimited
    guarantee_type?: 'full' | 'limited' | 'several';
  }>;
  /** Uniform Commercial Code filing details, if applicable (for business assets). */
  ucc_filing_details?: { // Renamed from ucc_filing
    filing_number: string;
    /** Unix timestamp (seconds) of the UCC filing. */
    filing_date: number;
    filing_jurisdiction: string; // State or county
    expiration_date?: number | null; /** Unix timestamp (seconds) */
  } | null;
  estimated_current_value?: number; // Current value of the collateral if different from appraisal
}

/**
 * Represents a loan, which could be a note receivable (asset) or note payable (liability).
 * Extended with fields specific to real estate finance.
 */
export interface Loan {
  /** Unique identifier (UUID) for this loan. */
  readonly id: string;
  /** ID of the user who owns this loan record. */
  readonly user_id: string;
  /** ID of the entity this loan is primarily associated with (borrower or lender entity). */
  readonly entity_id: string;

  borrower_name_or_entity_id?: string | null; // Can be free text or an Entity ID (UUID)
  lender_name_or_entity_id?: string | null;   // Can be free text or an Entity ID (UUID)
  loan_number_identifier?: string | null; // Lender's account/loan number

  description?: string | null; // Purpose or description of the loan
  loan_type: LoanType;
  /** Initial principal amount of the loan. */
  readonly original_principal_amount: number; // Renamed for clarity
  current_outstanding_principal: number; // Renamed for clarity
  /** Annual interest rate as a decimal (e.g., 0.05 for 5%). */
  interest_rate_percent: number; // Renamed for clarity
  interest_rate_type: InterestRateType;
  interest_calculation_method: InterestCalculationMethod;
  /** Unix timestamp (seconds) when the loan was originated/funded. */
  readonly origination_date: number;
  /** Unix timestamp (seconds) when the loan is due to be fully repaid. */
  maturity_date: number;
  loan_term_months?: number; // Original term in months

  payment_frequency: LoanPaymentFrequency;
  /** Scheduled principal and interest payment amount. */
  scheduled_payment_amount: number; // Renamed from payment_amount
  status: LoanStatus;

  collateral_description_summary?: string | null; // Renamed from collateral_description
  collateral_estimated_value?: number | null; // Renamed from collateral_value
  /** Unix timestamp (seconds) of the next scheduled payment. */
  next_payment_due_date?: number | null; // Renamed from next_payment_date
  last_payment_date?: number | null; /** Unix timestamp (seconds) */
  last_payment_amount?: number | null;

  /** ID of the ChartOfAccount entry for the loan principal (asset or liability). */
  principal_c_o_a_id?: string | null; // Renamed from principal_account_id
  /** ID of the ChartOfAccount entry for interest expense or income. */
  interest_c_o_a_id?: string | null; // Renamed from interest_account_id

  /** Unix timestamp (seconds) when this loan record was created. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when this loan record was last updated. */
  updated_at: number;
  /** True if this loan is an asset (receivable), false if a liability (payable). */
  readonly is_receivable: boolean;

  // --- Real estate specific fields ---
  /** ID of the property entity this loan is primarily associated with (if any). */
  associated_property_id?: string | null; // Renamed from property_id
  /** Loan-to-Value ratio at origination, as a decimal. */
  original_ltv_ratio?: number | null; // Renamed from original_ltv
  /** Current Loan-to-Value ratio, as a decimal. */
  current_ltv_ratio?: number | null; // Renamed from current_ltv
  /** Debt Service Coverage Ratio, if applicable (for income-producing properties). */
  debt_service_coverage_ratio?: number | null; // Renamed from dscr

  prepayment_penalty_details?: { // Renamed from prepayment_penalty
    type: 'none' | 'fixed_amount' | 'percentage_of_balance' | 'declining_percentage' | 'yield_maintenance_formula';
    penalty_amount_or_percent?: number | null;
    /** Unix timestamp (seconds) when the prepayment penalty period ends. */
    penalty_period_ends_date?: number | null; // Renamed from end_date
    penalty_description_terms?: string | null; // Renamed from description
  } | null;

  escrow_account_details?: { // Renamed from escrow_details
    includes_property_taxes: boolean; // Renamed from include_taxes
    includes_homeowners_insurance: boolean; // Renamed from include_insurance
    monthly_escrow_payment_amount?: number | null; // Renamed from monthly_amount
    /** ID of the CoA entry for the escrow asset account. */
    escrow_asset_c_o_a_id?: string | null; // Renamed from account_id
    current_escrow_balance?: number | null;
  } | null;

  variable_adjustable_rate_details?: { // Renamed from variable_rate_details
    index_benchmark_type: 'prime_rate' | 'libor_replacement_sofr' | 'us_treasury_yield' | 'federal_funds_rate' | 'other_custom_index'; // Renamed from index_type
    margin_over_index_percent: number; // Renamed from margin
    initial_fixed_period_months?: number | null;
    lifetime_rate_cap_percent?: number | null; // Renamed from rate_cap
    periodic_rate_cap_percent?: number | null; // Max change per adjustment
    rate_floor_percent?: number | null; // Renamed from rate_floor
    adjustment_frequency_months?: number | null; // Renamed adjustment_frequency (was string)
    /** Unix timestamp (seconds) of the next rate adjustment. */
    next_rate_adjustment_date?: number | null; // Renamed from next_adjustment_date
    current_index_value_percent?: number | null;
  } | null;

  balloon_payment_details?: { // Renamed from balloon_payment
    balloon_payment_amount: number; // Renamed from amount
    /** Unix timestamp (seconds) when the balloon payment is due. */
    balloon_payment_due_date: number; // Renamed from due_date
  } | null;

  construction_loan_details?: { // Renamed from construction_details
    total_construction_budget?: number;
    draw_request_schedule?: Array<{ // Renamed from draw_schedule
      phase_description: string; // Renamed from phase
      draw_amount: number; // Renamed from amount
      /** Expected date for this draw. Unix timestamp (seconds). */
      expected_completion_date_for_draw: number; // Renamed from expected_date
      /** Actual date this draw was funded. Unix timestamp (seconds). */
      actual_draw_funded_date?: number | null; // Renamed from drawn_date
      inspection_required_for_draw?: boolean;
    }> | null;
    interest_reserve_amount?: number | null; // Renamed from interest_reserve
    /** Expected project completion date. Unix timestamp (seconds). */
    expected_project_completion_date?: number | null; // Renamed from completion_date
    construction_period_interest_type?: 'interest_only' | 'accrued_capitalized';
  } | null;

  /** Enhanced collateral information. */
  detailed_collateral_info?: CollateralDetails | null; // Renamed from collateral_details

  tags?: string[];
  custom_fields?: Record<string, any>;
}

/**
 * Represents a single entry (a scheduled payment) in a loan's amortization schedule.
 */
export interface LoanScheduleEntry {
  /** Unique identifier (UUID) for this schedule entry. */
  readonly id: string;
  readonly loan_id: string; // Foreign key to the Loan
  readonly user_id: string; // For ownership/scoping
  readonly payment_number: number; // Sequential payment number (1, 2, 3...)
  /** Scheduled date for this payment. Unix timestamp (seconds). */
  scheduled_payment_date: number; // Renamed from payment_date
  /** Total amount due for this scheduled payment. */
  total_scheduled_payment: number; // Renamed from total_payment
  principal_payment_portion: number; // Renamed from principal_portion
  interest_payment_portion: number; // Renamed from interest_portion
  remaining_loan_balance_after_payment: number; // Renamed from remaining_balance
  status: LoanSchedulePaymentStatus; // Current status of this scheduled payment
  /** Actual date payment was made. Unix timestamp (seconds). */
  actual_payment_received_date?: number | null; // Renamed from actual_payment_date
  /** Actual amount received for this payment. */
  actual_payment_received_amount?: number | null; // Renamed from actual_payment_amount
  /** ID of the transaction record related to this payment. */
  linked_transaction_id?: string | null; // Renamed from transaction_id
  late_fee_assessed?: number | null;
  additional_principal_paid?: number | null;
  notes?: string | null;
  /** Unix timestamp (seconds) when this schedule entry was created/calculated. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when this schedule entry was last updated (e.g., status change). */
  updated_at: number;
}

/**
 * Represents the complete amortization schedule for a loan.
 */
export interface AmortizationSchedule {
  readonly loan_id: string; // The loan this schedule belongs to
  schedule_entries: LoanScheduleEntry[]; // Renamed from entries
  /** Unix timestamp (seconds) when this schedule was generated or last refreshed. */
  readonly generated_at_timestamp: number; // Renamed from generated_at
  total_interest_to_be_paid_over_loan_life: number; // Renamed from total_interest
  total_principal_and_interest_to_be_paid: number; // Renamed from total_payments
  loan_payoff_date_original_schedule?: number; // Unix timestamp (seconds)
}

/**
 * Input payload for creating or updating a Loan.
 * Excludes read-only fields like `id`, `user_id`, `created_at`, `updated_at`.
 * Some fields like `current_principal` might be settable on create (e.g. existing loan) but often derived on update.
 */
export interface LoanInput {
  entity_id: string; // Primary entity associated (borrower or lender)
  borrower_name_or_entity_id?: string | null;
  lender_name_or_entity_id?: string | null;
  loan_number_identifier?: string | null;
  description?: string | null;
  loan_type: LoanType;
  original_principal_amount: number;
  interest_rate_percent: number;
  interest_rate_type: InterestRateType;
  interest_calculation_method: InterestCalculationMethod;
  /** Unix timestamp (seconds). */
  origination_date: number;
  /** Unix timestamp (seconds). */
  maturity_date: number;
  loan_term_months?: number;
  payment_frequency: LoanPaymentFrequency;
  scheduled_payment_amount: number;
  status?: LoanStatus; // Usually set by system but can be input for existing loans
  collateral_description_summary?: string | null;
  collateral_estimated_value?: number | null;
  /** Unix timestamp (seconds). */
  next_payment_due_date?: number | null;
  principal_c_o_a_id?: string | null;
  interest_c_o_a_id?: string | null;
  is_receivable: boolean;

  // Real estate specific fields (as in Loan interface)
  associated_property_id?: string | null;
  original_ltv_ratio?: number | null;
  debt_service_coverage_ratio?: number | null;
  prepayment_penalty_details?: Loan['prepayment_penalty_details'];
  escrow_account_details?: Loan['escrow_account_details'];
  variable_adjustable_rate_details?: Loan['variable_adjustable_rate_details'];
  balloon_payment_details?: Loan['balloon_payment_details'];
  construction_loan_details?: Loan['construction_loan_details'];
  detailed_collateral_info?: CollateralDetails | null;
  tags?: string[];
  custom_fields?: Record<string, any>;
  // For updates, might include current_outstanding_principal if manually adjusting
  current_outstanding_principal?: number; 
}

/**
 * Input for recording a payment against a specific loan schedule entry.
 */
export interface RecordLoanPaymentInput {
  loan_schedule_entry_id: string; // Renamed from loan_schedule_id
  /** Actual date payment was received/made. Unix timestamp (seconds). */
  actual_payment_date: number;
  actual_payment_amount: number;
  /** Optional ID of the financial transaction created for this payment. */
  linked_transaction_id?: string | null;
  new_payment_status?: LoanSchedulePaymentStatus; // Renamed from new_status
  payment_method?: string; // e.g., "ACH", "Check"
  payment_reference?: string; // e.g., Check number, confirmation ID
  notes?: string | null;
  additional_principal_payment?: number | null; // If user made an extra principal payment
  late_fee_paid?: number | null;
}

/**
 * Summary of a loan, often used in lists or reports.
 */
export interface LoanSummary {
  readonly id: string;
  /** Name of the borrower (if loan is receivable) or lender (if loan is payable). */
  counterparty_name: string;
  loan_type: LoanType;
  is_receivable: boolean;
  original_principal_amount: number;
  current_outstanding_principal: number;
  interest_rate_percent: number;
  /** Unix timestamp (seconds). */
  maturity_date: number;
  status: LoanStatus;
  /** Unix timestamp (seconds). */
  next_payment_due_date?: number | null;
  total_payments_made_count: number; // Renamed from payments_made
  payments_remaining_count: number; // Renamed from payments_remaining
  /** Percentage of loan term or principal completed, as decimal (0-1). */
  loan_completion_percent: number; // Renamed from percent_complete
  associated_property_address?: string | null; // If linked to a property
}

/**
 * Performance metrics and analytics data for a single loan.
 */
export interface LoanPerformanceMetrics { // Renamed from LoanPerformance
  readonly loan_id: string;
  payment_history_metrics: { // Renamed from payment_metrics
    on_time_payment_count: number; // Renamed from on_time_payments
    late_payment_count: number;    // Renamed from late_payments
    missed_payment_count: number;  // Renamed from missed_payments
    average_days_late_for_late_payments?: number | null; // Renamed from average_days_late
    total_late_fees_collected?: number | null; // Renamed from total_late_fees
    payment_streak_current_on_time?: number; // Consecutive on-time payments
  };
  financial_repayment_metrics: { // Renamed from financial_metrics
    total_amount_paid_to_date: number;
    total_principal_repaid_to_date: number; // Renamed from total_principal_paid
    total_interest_paid_to_date: number;    // Renamed from total_interest_paid
    remaining_interest_to_be_paid_estimate?: number | null; // Renamed from remaining_interest
    effective_annual_interest_rate_paid?: number | null; // If different from nominal due to fees/timing
  };
  risk_assessment_indicators: { // Renamed from risk_indicators
    current_loan_to_value_ratio?: number | null; // Renamed from current_ltv
    current_debt_service_coverage_ratio?: number | null; // Renamed from debt_service_ratio
    days_currently_past_due?: number | null; // Renamed from days_past_due
    internal_risk_rating?: 'low' | 'medium' | 'high' | 'watch_list' | null;
  };
  /** Unix timestamp (seconds) when these metrics were last calculated. */
  metrics_as_of_date: number;
}

/**
 * Details of a loan refinancing event.
 */
export interface LoanRefinanceEvent { // Renamed from LoanRefinance
  readonly id: string; // ID of this refinance event record
  original_loan_id: string;
  new_loan_id: string; // ID of the new loan that replaced the original
  /** Unix timestamp (seconds) when the refinance occurred. */
  refinance_event_date: number; // Renamed from refinance_date
  refinance_reason: 'interest_rate_reduction' | 'cash_out_equity' | 'loan_term_change' | 'payment_amount_reduction' | 'debt_consolidation' | 'other_reason';
  cash_out_amount_taken?: number | null; // Renamed from cash_out_amount
  refinance_closing_costs?: number | null; // Renamed from closing_costs
  /** Estimated months to break even on closing costs due to payment savings. */
  break_even_point_months?: number | null; // Renamed from break_even_months
  notes?: string | null;
}

/**
 * Summary of an entity's loan portfolio for reporting and analytics.
 */
export interface LoanPortfolioOverview { // Renamed from LoanPortfolioSummary
  entity_id: string; // For which entity this overview is
  /** Unix timestamp (seconds) when this overview was generated. */
  as_of_date: number;
  total_active_loans_count: number; // Renamed from total_loans
  summary_by_loan_type: Record<LoanType, {
    count: number;
    total_outstanding_balance: number; // Renamed from total_balance
    weighted_average_interest_rate_percent: number; // Renamed from average_rate
  }>;
  total_portfolio_outstanding_balance: number; // Renamed from total_outstanding
  portfolio_weighted_average_interest_rate_percent: number; // Renamed from weighted_avg_rate
  portfolio_health_indicators: { // Renamed from health_metrics
    number_of_performing_loans: number;
    number_of_non_performing_loans_30_plus_days?: number; // Example
    number_of_loans_in_default_status?: number;
    portfolio_average_ltv_ratio?: number | null;
    portfolio_average_dscr?: number | null;
  };
  loan_maturity_profile_summary: Array<{ // Renamed from maturity_profile
    maturity_year: number;
    count_of_maturing_loans: number; // Renamed from maturing_loans
    total_balance_maturing: number; // Renamed from maturing_balance
  }>;
  total_upcoming_payments_next_30_days?: number; // Sum of next payments due
}