// src/types/mojo.d.ts
/**
 * Defines TypeScript interfaces for interacting with Mojo (WebAssembly) modules,
 * which are planned for computationally intensive tasks in the Pro tier.
 */

/**
 * Enumerates the different Mojo WebAssembly modules planned for the application.
 */
export type MojoModule =
  | 'financial_calculator'       // For core financial math (NPV, IRR, amortization, depreciation)
  | 'tax_engine_analyzer'        // For complex tax calculations and optimization (renamed)
  | 'loan_engine_analyzer'       // For advanced loan analysis and refinancing (renamed)
  | 'reporting_data_engine'    // For high-speed aggregation and generation of report data (renamed)
  | 'batch_data_processor'     // For bulk operations like transaction categorization or period closing (renamed)
  | 'ml_transaction_categorizer' // AI/ML for transaction categorization (renamed)
  | 'ml_financial_predictor';    // AI/ML for predictions (e.g., cash flow) (renamed)

/**
 * Generic request structure for calling a function within a Mojo module.
 * @template TInput The expected type for the `inputs` field.
 */
export interface MojoCalculationRequest<TInput = Record<string, any>> {
  module: MojoModule;
  function: string; // Name of the function to call within the Wasm module
  inputs: TInput;   // Function-specific input parameters
  options?: {
    /** Desired precision for calculations, if applicable. */
    precision?: number;
    /** Timeout for the Wasm execution in milliseconds. */
    timeoutMs?: number; // Renamed for clarity
    /** Hint to the Mojo runtime whether caching the result is desirable/possible. */
    enableResultCaching?: boolean; // Renamed for clarity
    cacheKey?: string; // Optional custom cache key
  };
  /** Unique ID for tracking this specific request, useful for async operations or logging. */
  requestId?: string;
}

/**
 * Generic result structure from a Mojo module function call.
 * @template TOutput The expected type of the `result` field.
 */
export interface MojoCalculationResult<TOutput = any> {
  success: boolean;
  result?: TOutput; // The actual result from the Wasm function
  error?: MojoExecutionError; // Renamed from error and using specific type
  /** Execution time of the Wasm function in milliseconds. */
  executionTimeMs: number;
  wasmModuleUsed: string; // Name/path of the Wasm module file
  wasmModuleVersion?: string; // Renamed from wasmVersion
  calculationPrecision?: number; // Actual precision used if different from request
  wasResultCached?: boolean; // Renamed from cached
  requestId?: string; // Correlates with the request ID
  logs?: string[]; // Optional logs or diagnostic messages from Wasm
}

/**
 * Specific error structure for Mojo execution failures.
 */
export interface MojoExecutionError { // Renamed from MojoError
  code:
    | 'MODULE_NOT_LOADED' // Renamed from MODULE_NOT_FOUND
    | 'FUNCTION_NOT_FOUND_IN_MODULE' // Renamed from FUNCTION_NOT_FOUND
    | 'INVALID_INPUT_PARAMETERS' // Renamed from INVALID_INPUT
    | 'EXECUTION_TIMEOUT' // Renamed from TIMEOUT
    | 'WASM_MEMORY_ALLOCATION_ERROR' // Renamed from MEMORY_ERROR
    | 'WASM_RUNTIME_ERROR' // General Wasm execution error
    | 'CALCULATION_LOGIC_ERROR' // Error within the Mojo algorithm itself
    | 'SERIALIZATION_ERROR' // Error serializing inputs or deserializing outputs
    | 'UNKNOWN_MOJO_ERROR';
  message: string;
  module?: MojoModule;
  function?: string;
  details?: any; // Additional context-specific error details
  wasmTrapMessage?: string; // If the error originated from a Wasm trap
}

// --- Specific Input/Output types for Mojo Financial Calculator module ---

export interface MojoFinancialRequest<TInput, TOutput> extends MojoCalculationRequest<TInput> {
  module: 'financial_calculator';
  // `function` will be specific, e.g., 'calculate_npv'
}

// NPV (Net Present Value)
export interface MojoNPVInput {
  cashFlows: number[]; // Array of cash flows, first usually negative (initial investment)
  discountRate: number; // As a decimal, e.g., 0.1 for 10%
}
export interface MojoNPVOutput {
  npv: number;
}

// IRR (Internal Rate of Return)
export interface MojoIRRInput {
  cashFlows: number[]; // Array of cash flows
  guess?: number; // Optional initial guess for the IRR algorithm
  maxIterations?: number;
  tolerance?: number;
}
export interface MojoIRROutput {
  irr: number; // As a decimal
  iterations?: number; // Iterations taken by the solver
}

// Amortization Schedule
export interface MojoAmortizationInput {
  principal: number;
  annualInterestRate: number; // As a decimal, e.g., 0.05 for 5%
  termMonths: number;
  /** Optional: Start date of the loan. Unix timestamp (seconds). */
  startDateTimestamp?: number | null; // Renamed from startDate
  extraPayments?: Array<{
    paymentNumber: number; // Which payment number this extra payment applies after/with
    amount: number;
  }> | null;
}
export interface MojoAmortizationScheduleEntry {
  paymentNumber: number;
  paymentAmount: number;
  principalPaid: number;
  interestPaid: number;
  endingBalance: number;
  /** Optional: Payment date. Unix timestamp (seconds). */
  paymentDateTimestamp?: number | null;
}
export interface MojoAmortizationOutput {
  monthlyPayment: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  schedule: MojoAmortizationScheduleEntry[];
  /** Optional: Loan payoff date. Unix timestamp (seconds). */
  payoffDateTimestamp?: number | null;
}

// Depreciation
export interface MojoDepreciationInput {
  assetCost: number;
  salvageValue: number;
  usefulLifeYears: number; // Renamed from usefulLife
  method: 'straight_line' | 'double_declining_balance' | 'sum_of_years_digits' | 'macrs_gds' | 'macrs_ads' | 'units_of_production';
  /** Date asset was placed in service. Unix timestamp (seconds). */
  placedInServiceDateTimestamp: number; // Renamed from placed_in_service_date
  macrsConvention?: 'half_year' | 'mid_quarter' | 'mid_month' | null; // Renamed from convention
  businessUsePercentage?: number; // As decimal, e.g., 0.8 for 80%
  unitsProducedThisPeriod?: number; // For units_of_production method
  totalEstimatedUnits?: number;   // For units_of_production method
}
export interface MojoDepreciationOutputEntry {
  year: number;
  depreciationExpense: number;
  accumulatedDepreciation: number;
  bookValueEndOfYear: number;
}
export interface MojoDepreciationOutput {
  annualSchedule: MojoDepreciationOutputEntry[];
  totalDepreciationTaken?: number;
}


// --- Specific Input/Output types for Mojo Tax Engine module ---
export interface MojoTaxRequest<TInput, TOutput> extends MojoCalculationRequest<TInput> {
  module: 'tax_engine_analyzer';
  // `function` e.g., 'calculate_federal_tax_liability', 'optimize_deductions_schedule_e'
}
export interface MojoTaxCalculationInput {
  taxYear: number;
  filingStatus: 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household' | 'qualifying_widow';
  incomeSources: Record<string, number>; // e.g., { wages: 50000, rentalIncome: 10000 }
  itemizedDeductions?: Record<string, number> | null;
  standardDeductionAmount?: number; // Could be fetched by engine based on year/status
  taxCredits?: Record<string, number> | null;
  dependentsCount?: number;
  stateCode?: string | null; // For state tax calculations
  propertyTaxPaid?: number;
  mortgageInterestPaid?: number;
}
export interface MojoTaxCalculationOutput {
  grossIncome: number;
  adjustedGrossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  federalTaxLiability: number;
  stateTaxLiability?: number | null;
  effectiveTaxRatePercent?: number;
  marginalTaxRatePercent?: number;
  creditsAppliedAmount?: number;
  finalTaxDueOrRefund: number; // Positive if due, negative if refund
}

// (Define other specific Input/Output types for Loan, Reporting, Batch, ML modules similarly)
// Example for Batch Transaction Input
export interface MojoBatchTransactionInput {
  transactions: Array<{
    id: string; // Client-side ID for reference
    /** Transaction date. Unix timestamp (seconds). */
    dateTimestamp: number; // Renamed from date
    amount: number;
    description: string;
    currentAssignedCategory?: string | null;
  }>;
  categorizationRules?: Array<{ // Example rules for categorization
    if_description_contains?: string[];
    if_amount_is_between?: { min: number; max: number };
    then_assign_category: string;
    confidence_score?: number; // Rule confidence
  }> | null;
  targetEntityId?: string;
}
// Example for Batch Transaction Output
export interface MojoBatchTransactionOutputItem {
  id: string; // Original transaction ID
  assignedCategoryId?: string | null;
  confidence?: number;
  status: 'categorized' | 'needs_review' | 'failed_to_categorize';
  reason?: string;
}
export interface MojoBatchCategorizationOutput {
  results: MojoBatchTransactionOutputItem[];
  summary: {
    totalProcessed: number;
    successfullyCategorized: number;
    needsReview: number;
    failed: number;
  };
}


// --- Mojo Runtime Performance Metrics & Module Information ---
export interface MojoPerformanceMetrics {
  totalWasmExecutions: number; // Renamed from totalExecutions
  averageWasmExecutionTimeMs: number; // Renamed from averageExecutionTime
  wasmCacheHitRatePercent?: number | null; // Renamed from cacheHitRate
  errorRatePercent: number;
  moduleExecutionMetrics: Partial<Record<MojoModule, { // Renamed from moduleMetrics
    executionCount: number; // Renamed from executions
    averageTimeMs: number; // Renamed from avgTime
    errorCount: number;    // Renamed from errors
    /** Unix timestamp (seconds) of last use. */
    lastUsedTimestamp: number; // Renamed from lastUsed
  }>>;
  totalMemoryUsedBytes?: number;
}

export interface MojoModuleInfo {
  name: MojoModule;
  version: string; // Version of the compiled Wasm module
  fileSizeBytes?: number; // Renamed from size
  isLoaded: boolean; // Renamed from loaded
  availableFunctions: string[]; // Renamed from functions
  /** Unix timestamp (seconds) when module was last loaded into runtime. */
  lastLoadedTimestamp?: number | null; // Renamed from lastLoaded
  /** Time taken to load and compile the module in milliseconds. */
  initialLoadTimeMs?: number | null; // Renamed from loadTime
  featureSupport?: { // Optional: features this specific Wasm module was compiled with/requires
    simd?: boolean;
    threads?: boolean;
    exceptions?: boolean;
  };
}

/**
 * Configuration for the Mojo Wasm runtime environment/wrapper.
 */
export interface MojoRuntimeConfig { // Renamed from MojoConfig
  defaultMaxExecutionTimeMs: number; // Renamed from maxExecutionTime
  maxWasmMemoryBytes?: number; // Renamed from maxMemory (Wasm memory is in pages of 64KiB)
  enableGlobalCaching: boolean; // Renamed from enableCaching
  globalCacheMaxEntries?: number; // Renamed from cacheSize
  globalCacheDefaultTtlSeconds?: number; // Renamed from cacheTTL
  preloadModulesOnStartup?: MojoModule[] | null; // Renamed from preloadModules
  defaultCalculationPrecision?: number; // Renamed from precision (decimal places)
  wasmFilePathResolver?: (module: MojoModule, version?: string) => string; // Function to get path to .wasm files
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'none';
}