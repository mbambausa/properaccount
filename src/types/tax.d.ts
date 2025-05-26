// src/types/tax.d.ts
/**
 * Tax management and compliance type definitions
 */

export type TaxJurisdiction = 'federal' | 'state' | 'local' | 'foreign';
export type TaxEntityType = 'individual' | 'partnership' | 'corporation' | 's_corp' | 'llc' | 'trust' | 'estate';
export type TaxYear = number; // e.g., 2024

export type TaxForm = 
  // Federal forms
  | '1040' | '1040-SR' | '1065' | '1120' | '1120S'
  | '1099-MISC' | '1099-NEC' | '1099-INT' | '1099-DIV'
  | 'W-2' | 'W-9' | 'K-1'
  // Real estate specific
  | 'Schedule-E' | '4562' | '8825' | '1098';

export type DepreciationMethod = 
  | 'straight_line'
  | 'declining_balance_150'
  | 'declining_balance_200'
  | 'macrs_gds'
  | 'macrs_ads'
  | 'section_179'
  | 'bonus';

export type TaxStatus = 'not_started' | 'in_progress' | 'ready_for_review' | 'filed' | 'amended';

/**
 * Tax configuration for an entity
 */
export interface TaxConfiguration {
  readonly id: string;
  entity_id: string;
  tax_year: TaxYear;
  jurisdiction: TaxJurisdiction;
  state_code?: string;
  
  // Entity information
  entity_type: TaxEntityType;
  ein?: string;
  filing_status?: string;
  accounting_method: 'cash' | 'accrual';
  fiscal_year_end?: string; // MM-DD
  
  // Account mappings to tax lines
  account_mappings: TaxAccountMapping[];
  
  // Depreciation schedules
  depreciation_schedules: DepreciationSchedule[];
  
  // Section 1031 exchanges
  like_kind_exchanges?: LikeKindExchange[];
  
  // Passive activity tracking
  passive_activities?: PassiveActivity[];
  
  // Configuration metadata
  readonly created_at: number;
  updated_at: number;
  locked: boolean;
  locked_at?: number;
}

/**
 * Mapping of accounts to tax form lines
 */
export interface TaxAccountMapping {
  readonly id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  
  // Tax form mapping
  tax_form: TaxForm;
  tax_line: string;
  tax_line_description: string;
  
  // Rules
  inclusion_rules?: {
    include_subaccounts: boolean;
    transaction_types?: string[];
    date_range_override?: {
      start: number;
      end: number;
    };
  };
  
  // Adjustments
  adjustment_percentage?: number;
  fixed_adjustment?: number;
  notes?: string;
}

/**
 * Asset depreciation schedule
 */
export interface DepreciationSchedule {
  readonly id: string;
  asset_id: string;
  property_id?: string;
  asset_description: string;
  
  // Asset details
  asset_type: string;
  placed_in_service_date: number;
  cost_basis: number;
  salvage_value: number;
  useful_life_years: number;
  
  // Depreciation method
  method: DepreciationMethod;
  convention: 'half_year' | 'mid_quarter' | 'mid_month';
  
  // Current year calculations
  current_year_depreciation: number;
  accumulated_depreciation: number;
  net_book_value: number;
  
  // Special deductions
  section_179_deduction?: number;
  bonus_depreciation?: number;
  
  // Schedule details
  annual_depreciation: Array<{
    year: TaxYear;
    depreciation_amount: number;
    beginning_book_value: number;
    ending_book_value: number;
  }>;
  
  // Disposal information
  disposed?: boolean;
  disposal_date?: number;
  disposal_proceeds?: number;
  gain_loss_on_disposal?: number;
}

/**
 * Section 1031 Like-Kind Exchange tracking
 */
export interface LikeKindExchange {
  readonly id: string;
  
  // Relinquished property
  relinquished_property: {
    property_id: string;
    description: string;
    sale_date: number;
    sale_price: number;
    adjusted_basis: number;
    selling_expenses: number;
  };
  
  // Replacement property
  replacement_property?: {
    property_id?: string;
    description: string;
    identification_date?: number;
    purchase_date?: number;
    purchase_price?: number;
  };
  
  // Exchange details
  qualified_intermediary: string;
  identification_deadline: number; // 45 days
  exchange_deadline: number;       // 180 days
  
  // Financial details
  boot_received?: number;
  boot_paid?: number;
  realized_gain: number;
  recognized_gain: number;
  deferred_gain: number;
  
  status: 'identified' | 'completed' | 'failed' | 'partial';
}

/**
 * Passive activity loss tracking
 */
export interface PassiveActivity {
  readonly id: string;
  activity_type: 'rental' | 'business';
  property_id?: string;
  description: string;
  
  // Current year
  current_year_income: number;
  current_year_loss: number;
  current_year_hours: number;
  material_participation: boolean;
  
  // Carryforward
  prior_year_carryforward: number;
  allowed_loss: number;
  suspended_loss: number;
  
  // At-risk rules
  at_risk_basis: number;
  not_at_risk_amount?: number;
}

/**
 * Tax estimate calculations
 */
export interface TaxEstimate {
  entity_id: string;
  tax_year: TaxYear;
  as_of_date: number;
  
  // Income
  gross_income: number;
  taxable_income: number;
  
  // Federal tax
  federal_tax: {
    regular_tax: number;
    amt?: number;
    self_employment_tax?: number;
    net_investment_income_tax?: number;
    additional_medicare_tax?: number;
    total: number;
  };
  
  // State tax
  state_tax?: {
    state_code: string;
    taxable_income: number;
    tax_amount: number;
  };
  
  // Quarterly payments
  quarterly_payments: QuarterlyPayment[];
  
  // Credits and payments
  withholdings: number;
  estimated_payments_made: number;
  credits: number;
  
  // Final calculations
  total_tax_liability: number;
  total_payments_credits: number;
  refund_due?: number;
  amount_owed?: number;
  
  // Safe harbor
  safe_harbor_amount?: number;
  meets_safe_harbor: boolean;
}

/**
 * Quarterly estimated tax payment
 */
export interface QuarterlyPayment {
  quarter: 1 | 2 | 3 | 4;
  due_date: number;
  safe_harbor_amount: number;
  calculated_amount: number;
  amount_paid?: number;
  payment_date?: number;
  payment_method?: string;
  confirmation_number?: string;
}

/**
 * Tax document tracking
 */
export interface TaxDocument {
  readonly id: string;
  entity_id: string;
  tax_year: TaxYear;
  form_type: TaxForm;
  
  // Document details
  document_id?: string;
  recipient_name?: string;
  recipient_tin?: string;
  payer_name?: string;
  payer_tin?: string;
  
  // Key amounts (form-specific)
  amounts: Record<string, number>;
  
  // Status
  status: 'draft' | 'final' | 'filed' | 'corrected';
  date_issued?: number;
  date_filed?: number;
  
  // E-filing
  can_efile: boolean;
  efiled?: boolean;
  efile_confirmation?: string;
}

/**
 * Tax return preparation status
 */
export interface TaxReturn {
  readonly id: string;
  entity_id: string;
  tax_year: TaxYear;
  return_type: 'federal' | 'state' | 'local';
  
  // Status tracking
  status: TaxStatus;
  preparer_id?: string;
  reviewer_id?: string;
  
  // Key dates
  started_at?: number;
  completed_at?: number;
  filed_at?: number;
  due_date: number;
  extended_due_date?: number;
  
  // Forms included
  forms: Array<{
    form_type: TaxForm;
    status: 'not_started' | 'in_progress' | 'complete';
    has_errors: boolean;
  }>;
  
  // Review notes
  review_notes?: Array<{
    note: string;
    created_by: string;
    created_at: number;
    resolved: boolean;
  }>;
  
  // Filing details
  filing_method?: 'paper' | 'efile';
  confirmation_number?: string;
  accepted_date?: number;
  rejection_reason?: string;
}

/**
 * Real estate specific tax calculations
 */
export interface RealEstateTaxCalculation {
  property_id: string;
  tax_year: TaxYear;
  
  // Rental income
  gross_rental_income: number;
  
  // Expenses
  deductible_expenses: {
    mortgage_interest: number;
    property_taxes: number;
    insurance: number;
    repairs_maintenance: number;
    property_management: number;
    utilities: number;
    hoa_fees: number;
    advertising: number;
    professional_fees: number;
    other: number;
    total: number;
  };
  
  // Depreciation
  depreciation_expense: number;
  
  // Net income/loss
  net_rental_income: number;
  
  // Passive loss limitations
  allowed_loss?: number;
  suspended_loss?: number;
  
  // QBI deduction eligibility
  qbi_eligible: boolean;
  qbi_deduction?: number;
}

/**
 * Tax planning scenarios
 */
export interface TaxPlanningScenario {
  readonly id: string;
  entity_id: string;
  name: string;
  description?: string;
  tax_year: TaxYear;
  
  // Assumptions
  assumptions: {
    income_changes?: Record<string, number>;
    expense_changes?: Record<string, number>;
    depreciation_elections?: string[];
    timing_strategies?: string[];
  };
  
  // Results
  baseline_tax: number;
  scenario_tax: number;
  tax_savings: number;
  
  // Recommendations
  recommendations: string[];
  implementation_notes?: string;
  
  created_at: number;
  created_by: string;
}