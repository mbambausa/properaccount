// src/types/tax.d.ts
/**
 * Defines TypeScript interfaces related to tax management, compliance,
 * tax forms, depreciation schedules, and tax planning scenarios.
 */

export type TaxJurisdiction = 'federal' | 'state' | 'local_city' | 'local_county' | 'foreign_country';
export type TaxEntityTypeForFiling = // Renamed from TaxEntityType for clarity on its purpose
  | 'individual_1040'
  | 'partnership_1065'
  | 'corporation_1120'
  | 's_corporation_1120s'
  | 'llc_disregarded_entity' // Taxed as owner
  | 'llc_taxed_as_partnership'
  | 'llc_taxed_as_corporation'
  | 'trust_1041'
  | 'estate_706_1041'
  | 'non_profit_990';

export type TaxYear = number; // e.g., 2024, 2025

export type TaxFormIdentifier = // Renamed from TaxForm for clarity
  // Federal forms
  | 'form_1040' | 'form_1040_sr' | 'form_1040_schedule_c' | 'form_1040_schedule_e' | 'form_1040_schedule_f'
  | 'form_1065' | 'form_1065_schedule_k1'
  | 'form_1120' | 'form_1120_s' | 'form_1120_s_schedule_k1'
  | 'form_1099_misc' | 'form_1099_nec' | 'form_1099_int' | 'form_1099_div' | 'form_1099_b' | 'form_1099_r'
  | 'form_w2' | 'form_w9'
  // Real estate specific / Depreciation
  | 'form_4562' // Depreciation and Amortization
  | 'form_8825' // Rental Real Estate Income and Expenses of a Partnership or an S Corporation
  | 'form_1098' // Mortgage Interest Statement
  | 'form_8283' // Noncash Charitable Contributions
  // State specific forms might be strings like "CA_FORM_568"
  | string; // Allow for state/local specific form identifiers

export type DepreciationConvention = // Grouped from DepreciationSchedule
  | 'half_year'
  | 'mid_quarter'
  | 'mid_month'
  | 'full_month'; // For certain assets

export type DepreciationMethod =
  | 'straight_line_sl'
  | 'declining_balance_150_db'
  | 'declining_balance_200_db' // Double Declining Balance
  | 'macrs_gds_200_db' // General Depreciation System (often 200% DB or SL)
  | 'macrs_gds_150_db'
  | 'macrs_gds_sl'
  | 'macrs_ads_sl'     // Alternative Depreciation System (Straight Line)
  | 'section_179_expensing'
  | 'bonus_depreciation_168k'
  | 'sum_of_years_digits_syd' // Less common now
  | 'units_of_production_uop';

export type TaxFilingStatus = // Renamed from TaxStatus for clarity
  | 'not_yet_started' // Renamed from not_started
  | 'in_progress_data_entry' // Renamed from in_progress
  | 'pending_review_internal' // Renamed from ready_for_review
  | 'pending_client_approval'
  | 'ready_to_file'
  | 'filed_pending_acceptance'
  | 'filed_accepted_by_agency' // Renamed from filed
  | 'filed_rejected_by_agency'
  | 'amended_return_filed' // Renamed from amended
  | 'extension_filed';

/**
 * Tax configuration for a specific entity and tax year.
 */
export interface TaxConfiguration {
  /** Unique identifier (UUID) for this tax configuration record. */
  readonly id: string;
  entity_id: string;
  tax_year: TaxYear;
  jurisdiction: TaxJurisdiction;
  /** State code if jurisdiction is 'state' (e.g., "CA", "NY"). */
  state_code?: string | null;
  /** Local jurisdiction name if applicable (e.g., "New York City"). */
  local_jurisdiction_name?: string | null;

  entity_type_for_filing: TaxEntityTypeForFiling; // Renamed from entity_type
  ein_or_ssn?: string | null; // Renamed from ein for ssn inclusion
  primary_filing_status_option?: string | null; // e.g., "Single", "Married Filing Jointly" for 1040
  accounting_method_for_tax: 'cash' | 'accrual' | 'hybrid'; // Renamed from accounting_method
  /** Fiscal year end date as "MM-DD" string (e.g., "12-31" for calendar year). */
  fiscal_year_end_mm_dd?: string | null; // Renamed from fiscal_year_end

  /** Mappings of Chart of Accounts entries to tax form lines. */
  tax_account_mappings?: TaxAccountMapping[] | null; // Renamed from account_mappings

  /** Depreciation schedules for assets relevant to this tax configuration. */
  asset_depreciation_schedules?: DepreciationSchedule[] | null; // Renamed from depreciation_schedules

  /** Records of Section 1031 Like-Kind Exchanges. */
  like_kind_exchange_records?: LikeKindExchange[] | null; // Renamed from like_kind_exchanges

  /** Tracking of passive activities and their loss limitations. */
  passive_activity_loss_tracking?: PassiveActivity[] | null; // Renamed from passive_activities

  // Configuration metadata
  /** Unix timestamp (seconds) when this configuration was created. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when this configuration was last updated. */
  updated_at: number;
  is_configuration_locked: boolean; // Renamed from locked
  /** Unix timestamp (seconds) when configuration was locked. */
  locked_at_timestamp?: number | null; // Renamed from locked_at
  prepared_by_user_id?: string | null;
  notes?: string | null;
}

/**
 * Defines the mapping of a specific Chart of Account entry to a line on a tax form.
 */
export interface TaxAccountMapping {
  /** Unique identifier (UUID) for this mapping rule. */
  readonly id: string;
  tax_configuration_id: string; // Links to TaxConfiguration
  chart_of_account_id: string;  // Renamed from account_id
  account_code_display?: string; // Denormalized from CoA
  account_name_display?: string; // Denormalized from CoA

  // Tax form mapping details
  target_tax_form: TaxFormIdentifier; // Renamed from tax_form
  target_tax_form_line: string;     // e.g., "Schedule E, Line 3a", "Form 4562, Part I, Line 14"
  tax_line_description_notes?: string | null; // Renamed from tax_line_description

  // Optional rules for including/excluding amounts from this account
  mapping_inclusion_rules?: {
    include_all_subaccounts?: boolean;
    filter_by_transaction_types?: string[] | null; // e.g., only "RENTAL_INCOME" from this account
    /** Override period for this specific mapping. Optional. */
    date_range_override_for_mapping?: {
      /** Unix timestamp (seconds). */
      start_date: number;
      /** Unix timestamp (seconds). */
      end_date: number;
    } | null;
    filter_by_property_ids?: string[] | null; // For real estate specific lines
  } | null;

  // Adjustments to the amount from this account before adding to tax line
  adjustment_factor_percentage?: number | null; // e.g., 0.8 for 80% deductible meals
  fixed_adjustment_amount?: number | null;    // e.g., add or subtract a fixed amount
  mapping_notes?: string | null;              // Renamed from notes
}

/**
 * Tracks the depreciation schedule for a single asset.
 */
export interface DepreciationSchedule {
  /** Unique identifier (UUID) for this depreciation schedule/asset. */
  readonly id: string;
  tax_configuration_id: string; // Links to TaxConfiguration
  asset_identifier: string; // User-defined or system ID for the asset
  property_id_if_real_estate?: string | null; // Link to property entity if applicable
  asset_description_name: string; // Renamed from asset_description

  asset_category_or_type: string; // e.g., "Residential Rental Real Estate", "Computer Equipment", "Furniture"
  /** Date asset was placed in service. Unix timestamp (seconds). */
  placed_in_service_date_ts: number; // Renamed from placed_in_service_date
  cost_basis_for_depreciation: number; // Renamed from cost_basis
  salvage_value_estimate?: number | null; // Renamed from salvage_value (often 0 for MACRS)
  depreciable_basis?: number; // Cost Basis - Salvage Value (or Section 179)
  useful_life_in_years: number; // Recovery period

  depreciation_method: DepreciationMethod; // Renamed from method
  macrs_convention_if_applicable?: DepreciationConvention | null; // Renamed from convention

  // Current tax year calculations
  current_year_depreciation_expense: number; // Renamed from current_year_depreciation
  prior_years_accumulated_depreciation: number; // Beginning of current tax year
  end_of_year_accumulated_depreciation: number; // After current year's expense
  net_book_value_end_of_year: number;

  // Special deductions taken
  section_179_deduction_taken_in_year_placed_in_service?: number | null;
  bonus_depreciation_taken_percentage?: number | null; // e.g., 100 for 100% bonus

  // Detailed annual schedule (can be extensive)
  detailed_annual_depreciation_schedule?: Array<{
    tax_year_for_entry: TaxYear; // Renamed from year
    depreciation_expense_for_year: number; // Renamed from depreciation_amount
    book_value_beginning_of_year: number;
    book_value_end_of_year: number;
  }> | null;

  // Disposal information
  is_disposed_of?: boolean; // Renamed from disposed
  /** Date of asset disposal. Unix timestamp (seconds). */
  disposal_date_ts?: number | null; // Renamed from disposal_date
  disposal_sale_proceeds?: number | null; // Renamed from disposal_proceeds
  gain_or_loss_on_disposal_amount?: number | null; // Renamed from gain_loss_on_disposal
}

/**
 * Tracks a Section 1031 Like-Kind Exchange.
 */
export interface LikeKindExchange {
  /** Unique identifier (UUID) for this exchange record. */
  readonly id: string;
  tax_configuration_id: string;

  relinquished_property_details: { // Renamed from relinquished_property
    property_id_internal?: string | null; // Link to internal property entity
    description_address: string; // Renamed from description
    /** Date of sale. Unix timestamp (seconds). */
    sale_date_ts: number; // Renamed from sale_date
    net_sale_price: number; // Sale price less selling expenses
    adjusted_cost_basis: number; // Renamed from adjusted_basis
    // selling_expenses: number; // Included in net_sale_price typically
  };

  replacement_property_details?: { // Renamed from replacement_property
    property_id_internal?: string | null;
    description_address: string;
    /** Date replacement property was identified. Unix timestamp (seconds). */
    identification_date_ts?: number | null; // Renamed from identification_date
    /** Date replacement property was acquired/purchased. Unix timestamp (seconds). */
    purchase_date_ts?: number | null; // Renamed from purchase_date
    purchase_price_or_value: number; // Renamed from purchase_price
  } | null;

  qualified_intermediary_name?: string | null; // Renamed from qualified_intermediary
  /** Deadline to identify replacement property (45 days from sale). Unix timestamp (seconds). */
  identification_period_deadline_ts: number; // Renamed from identification_deadline
  /** Deadline to acquire replacement property (180 days from sale). Unix timestamp (seconds). */
  exchange_period_deadline_ts: number; // Renamed from exchange_deadline

  // Financial details of the exchange
  cash_boot_received_amount?: number | null; // Renamed from boot_received
  mortgage_relief_or_boot_paid_amount?: number | null; // Renamed from boot_paid (can be debt relief)
  total_realized_gain: number;
  gain_recognized_if_any: number; // Renamed from recognized_gain (due to boot)
  gain_deferred_amount: number; // Renamed from deferred_gain
  new_basis_in_replacement_property?: number;

  status: 'planning' | 'relinquished_property_sold_pending_identification' | 'replacement_property_identified_pending_acquisition' | 'exchange_completed' | 'exchange_failed_partially_or_fully' | 'exchange_cancelled'; // Extended status
}

/**
 * Tracks income/loss from a passive activity for tax purposes.
 */
export interface PassiveActivityLossTracking { // Renamed from PassiveActivity
  /** Unique identifier (UUID) for this passive activity record. */
  readonly id: string;
  tax_configuration_id: string;
  activity_description: string; // Renamed from description e.g., "Rental Property at 123 Main St"
  activity_type: 'rental_real_estate' | 'other_passive_business_interest'; // More specific
  property_id_if_rental?: string | null;

  // Current tax year figures
  current_year_net_income_or_loss: number; // Positive for income, negative for loss
  hours_of_participation_current_year?: number | null; // Renamed from current_year_hours
  meets_material_participation_test?: boolean; // Renamed from material_participation (can be complex to determine)

  // Carryforward and allowance
  prior_year_suspended_loss_carryforward: number; // Renamed from prior_year_carryforward
  current_year_loss_allowed_amount: number; // Renamed from allowed_loss (based on PAL rules)
  current_year_loss_suspended_amount: number; // Renamed from suspended_loss (carried forward to next year)

  // At-risk limitation details (optional, as it's a separate but related concept)
  at_risk_investment_basis_beginning_of_year?: number | null; // Renamed from at_risk_basis
  at_risk_loss_limitation_amount_current_year?: number | null; // Renamed from not_at_risk_amount
  at_risk_investment_basis_end_of_year?: number | null;
  active_participation_status?: boolean; // For rental real estate loss allowance
}

/**
 * Estimated tax liability calculations.
 */
export interface TaxLiabilityEstimate { // Renamed from TaxEstimate
  entity_id: string;
  tax_year: TaxYear;
  /** As of which date this estimate is calculated. Unix timestamp (seconds). */
  estimate_as_of_date_ts: number; // Renamed from as_of_date

  // Income figures
  estimated_gross_income: number;
  estimated_adjustments_to_income?: number;
  estimated_adjusted_gross_income_agi?: number;
  estimated_total_deductions: number; // Standard or itemized
  estimated_taxable_income: number;

  // Federal Tax Components
  estimated_federal_tax_details?: { // Renamed from federal_tax
    ordinary_income_tax: number; // Renamed from regular_tax
    alternative_minimum_tax_amt?: number | null;
    self_employment_tax_seca?: number | null;
    net_investment_income_tax_niit?: number | null;
    additional_medicare_tax?: number | null;
    total_federal_tax_before_credits: number;
    federal_tax_credits_applied?: number;
    final_federal_tax_liability: number; // Renamed from total
  } | null;

  // State Tax Components (could be an array for multi-state)
  estimated_state_tax_details?: Array<{ // Renamed from state_tax
    state_code: string; // e.g., "CA"
    state_taxable_income: number;
    state_tax_amount: number;
    state_tax_credits_applied?: number;
    final_state_tax_liability?: number;
  }> | null;

  // Quarterly Estimated Payments
  quarterly_estimated_payments_schedule?: EstimatedQuarterlyPayment[] | null; // Renamed from quarterly_payments and QuarterlyPayment

  // Summary of Payments and Credits
  total_federal_withholdings_year_to_date?: number | null; // Renamed from withholdings
  total_estimated_tax_payments_made_year_to_date: number; // Renamed from estimated_payments_made
  total_tax_credits_available?: number | null; // Renamed from credits

  // Final Calculation
  total_estimated_tax_liability_all_jurisdictions: number; // Renamed from total_tax_liability
  total_payments_and_credits_applied: number; // Renamed from total_payments_credits
  estimated_refund_due_amount?: number | null; // Renamed from refund_due
  estimated_balance_owed_amount?: number | null; // Renamed from amount_owed

  // Safe Harbor Calculation (to avoid underpayment penalties)
  safe_harbor_required_payment_amount?: number | null; // Renamed from safe_harbor_amount
  meets_safe_harbor_requirements?: boolean; // Renamed from meets_safe_harbor
  penalty_and_interest_estimate_if_underpaid?: number | null;
}

export interface EstimatedQuarterlyPayment {
  quarter_number: 1 | 2 | 3 | 4; // Renamed from quarter
  /** Due date for this quarterly payment. Unix timestamp (seconds). */
  payment_due_date_ts: number; // Renamed from due_date
  calculated_safe_harbor_payment_amount?: number | null; // Renamed from safe_harbor_amount
  calculated_estimated_payment_amount: number; // Renamed from calculated_amount
  actual_amount_paid?: number | null; // Renamed from amount_paid
  /** Date payment was made. Unix timestamp (seconds). */
  actual_payment_date_ts?: number | null; // Renamed from payment_date
  payment_method_used?: string | null; // Renamed from payment_method
  payment_confirmation_code?: string | null; // Renamed from confirmation_number
  jurisdiction: 'federal' | string; // 'federal' or state code like 'CA'
}

/**
 * Tracks information about a specific tax document (e.g., 1099-MISC, W-2).
 */
export interface TaxDocumentRecord { // Renamed from TaxDocument
  /** Unique identifier (UUID) for this tax document record. */
  readonly id: string;
  entity_id: string; // Entity this document pertains to
  tax_year: TaxYear;
  tax_form_type: TaxFormIdentifier; // Renamed from form_type

  /** ID of the actual stored document file (e.g., in R2). */
  linked_document_file_id?: string | null; // Renamed from document_id
  recipient_name_or_company?: string | null;
  recipient_tax_id_ein_ssn?: string | null; // Renamed from recipient_tin
  payer_name_or_company?: string | null;
  payer_tax_id_ein_ssn?: string | null; // Renamed from payer_tin

  /** Key monetary amounts from the form (e.g., "box1_wages", "box7_nonemployee_compensation"). Keys are box numbers/descriptions. */
  key_amounts_from_form: Record<string, number>; // Renamed from amounts

  document_status: 'draft_pending_data' | 'data_entered_pending_review' | 'finalized_ready_to_issue_file' | 'issued_to_recipient' | 'filed_with_agency' | 'corrected_version_issued' | 'archived'; // Renamed from status
  /** Date document was issued to recipient. Unix timestamp (seconds). */
  date_issued_to_recipient_ts?: number | null; // Renamed from date_issued
  /** Date document was filed with tax agency. Unix timestamp (seconds). */
  date_filed_with_agency_ts?: number | null; // Renamed from date_filed

  is_eligible_for_efile: boolean; // Renamed from can_efile
  was_efiled_successfully?: boolean; // Renamed from efiled
  efile_submission_confirmation_id?: string | null; // Renamed from efile_confirmation
  notes_internal?: string | null;
}

/**
 * Tracks the overall preparation and filing status of a tax return.
 */
export interface TaxReturnFiling { // Renamed from TaxReturn
  /** Unique identifier (UUID) for this tax return record. */
  readonly id: string;
  entity_id: string;
  tax_year: TaxYear;
  return_jurisdiction_type: 'federal' | 'state' | 'local_city' | 'local_county'; // Renamed from return_type
  state_code_if_applicable?: string | null;
  primary_tax_form_identifier?: TaxFormIdentifier; // e.g., 'form_1040', 'form_1120s'

  current_filing_status: TaxFilingStatus; // Renamed from status
  prepared_by_user_id?: string | null; // Renamed from preparer_id
  reviewed_by_user_id?: string | null; // Renamed from reviewer_id

  // Key dates related to this return
  /** Unix timestamp (seconds). */
  date_preparation_started?: number | null; // Renamed from started_at
  /** Unix timestamp (seconds). */
  date_preparation_completed?: number | null; // Renamed from completed_at
  /** Unix timestamp (seconds). */
  date_filed_ts?: number | null; // Renamed from filed_at
  /** Original filing due date. Unix timestamp (seconds). */
  original_due_date_ts: number; // Renamed from due_date
  /** Extended filing due date, if applicable. Unix timestamp (seconds). */
  extended_due_date_ts?: number | null; // Renamed from extended_due_date

  // Component forms and their status within this return
  component_forms_status?: Array<{
    tax_form_type: TaxFormIdentifier; // Renamed from form_type
    form_status: 'not_started' | 'data_entry_in_progress' | 'data_entry_complete' | 'review_pending' | 'review_complete_ok' | 'review_corrections_needed'; // Renamed from status
    has_validation_errors: boolean; // Renamed from has_errors
  }> | null;

  // Review notes and communication
  internal_review_notes?: Array<{
    note_text: string; // Renamed from note
    created_by_user_id: string; // Renamed from created_by
    /** Unix timestamp (seconds). */
    created_at_timestamp: number; // Renamed from created_at
    is_resolved_or_addressed: boolean; // Renamed from resolved
    resolved_by_user_id?: string;
    /** Unix timestamp (seconds). */
    resolved_at_timestamp?: number;
  }> | null;

  // Filing details
  filing_method_used?: 'paper_mail' | 'efile_irs' | 'efile_state_portal' | 'efile_third_party_software'; // Renamed from filing_method
  efile_submission_id_or_confirmation?: string | null; // Renamed from confirmation_number
  /** Date return was accepted by agency. Unix timestamp (seconds). */
  agency_acceptance_date_ts?: number | null; // Renamed from accepted_date
  agency_rejection_reason_if_any?: string | null; // Renamed from rejection_reason
  amount_paid_with_return?: number;
  refund_amount_received?: number;
}

/**
 * Calculations specific to real estate for tax purposes (e.g., Schedule E items).
 */
export interface RealEstateTaxSummaryCalculation { // Renamed from RealEstateTaxCalculation
  property_id: string; // Or an array if summarizing multiple properties
  tax_year: TaxYear;

  // Rental income
  total_gross_rental_income: number; // Renamed from gross_rental_income

  // Deductible expenses for rental property
  deductible_rental_expenses_summary: { // Renamed from deductible_expenses
    mortgage_interest_paid: number; // Renamed from mortgage_interest
    property_taxes_paid: number;    // Renamed from property_taxes
    property_insurance_paid: number;// Renamed from insurance
    repairs_and_maintenance_costs: number; // Renamed from repairs_maintenance
    property_management_fees_paid: number; // Renamed from property_management
    utilities_paid_by_owner: number; // Renamed from utilities
    hoa_condo_fees_paid?: number | null; // Renamed from hoa_fees
    advertising_and_marketing_costs?: number | null; // Renamed from advertising
    legal_and_professional_fees?: number | null; // Renamed from professional_fees
    other_rental_expenses?: number | null; // Renamed from other
    total_deductible_rental_expenses: number; // Renamed from total
  };

  // Depreciation
  total_depreciation_expense_for_year: number; // Renamed from depreciation_expense

  // Net rental income/loss
  net_rental_income_or_loss_before_pal: number; // Renamed from net_rental_income (Before Passive Activity Loss rules)

  // Passive Activity Loss (PAL) considerations
  allowed_passive_loss_deduction?: number | null; // Renamed from allowed_loss
  suspended_passive_loss_carryforward?: number | null; // Renamed from suspended_loss

  // Qualified Business Income (QBI) deduction considerations
  is_qbi_eligible_activity?: boolean; // Renamed from qbi_eligible
  qbi_deduction_amount_calculated?: number | null; // Renamed from qbi_deduction
  qbi_component_income?: number;
  qbi_component_w2_wages?: number;
  qbi_component_ubia_of_qualified_property?: number;
}

/**
 * Represents a tax planning scenario to model different tax outcomes.
 */
export interface TaxPlanningScenarioAnalysis { // Renamed from TaxPlanningScenario
  /** Unique identifier (UUID) for this scenario. */
  readonly id: string;
  entity_id: string;
  scenario_name: string; // Renamed from name
  scenario_description?: string | null; // Renamed from description
  tax_year_for_scenario: TaxYear; // Renamed from tax_year

  // Assumptions defining this scenario
  scenario_assumptions: {
    changes_to_income_items?: Record<string, number> | null; // Key: income source, Value: change amount
    changes_to_expense_items?: Record<string, number> | null; // Key: expense category, Value: change amount
    depreciation_method_elections?: Array<{ asset_id: string; new_method: DepreciationMethod }> | null;
    timing_of_income_or_expenses_strategies?: string[] | null; // e.g., "Accelerate Q4 Expenses", "Defer Income to Next Year"
    investment_decisions?: Array<{ description: string; financial_impact: number}> | null; // e.g., "Sell Property X", "Invest in Y"
  };

  // Results comparing baseline to scenario
  baseline_estimated_tax_liability: number; // Renamed from baseline_tax
  scenario_estimated_tax_liability: number; // Renamed from scenario_tax
  estimated_tax_savings_or_cost: number;  // Renamed from tax_savings (positive for savings, negative for cost)

  // Recommendations based on the scenario
  scenario_recommendations_text?: string[] | null; // Renamed from recommendations
  implementation_notes_or_risks?: string | null; // Renamed from implementation_notes

  /** Unix timestamp (seconds) when this scenario was created. */
  created_at_timestamp: number; // Renamed from created_at
  created_by_user_id: string; // Renamed from created_by
  last_calculated_at_timestamp?: number;
}