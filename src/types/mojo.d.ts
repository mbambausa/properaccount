// src/types/mojo.d.ts
/**
 * Mojo WASM integration types
 */

export type MojoModule = 
  | 'financial_calculator'
  | 'tax_engine'
  | 'loan_engine'
  | 'reporting_engine'
  | 'batch_processor'
  | 'ml_categorizer'
  | 'ml_predictor';

export interface MojoCalculationRequest {
  module: MojoModule;
  function: string;
  inputs: Record<string, any>;
  options?: {
    precision?: number;
    timeout?: number;
    cache?: boolean;
  };
}

export interface MojoCalculationResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  executionTimeMs: number;
  wasmModuleUsed: string;
  wasmVersion: string;
  precision: number;
  cached: boolean;
}

// Financial calculations
export interface MojoFinancialRequest extends MojoCalculationRequest {
  module: 'financial_calculator';
  function: 'npv' | 'irr' | 'amortization' | 'depreciation' | 'compound_interest';
}

export interface MojoNPVInput {
  cashFlows: number[];
  discountRate: number;
  initialInvestment: number;
}

export interface MojoIRRInput {
  cashFlows: number[];
  guess?: number;
  maxIterations?: number;
  tolerance?: number;
}

export interface MojoAmortizationInput {
  principal: number;
  annualRate: number;
  termMonths: number;
  startDate?: number;
  extraPayments?: Array<{
    month: number;
    amount: number;
  }>;
}

export interface MojoDepreciationInput {
  assetCost: number;
  salvageValue: number;
  usefulLife: number;
  method: 'straight_line' | 'declining_balance' | 'sum_of_years' | 'macrs';
  placed_in_service_date: number;
  convention?: 'half_year' | 'mid_quarter' | 'mid_month';
}

// Tax calculations
export interface MojoTaxRequest extends MojoCalculationRequest {
  module: 'tax_engine';
  function: 'calculate_tax' | 'optimize_deductions' | 'quarterly_estimate' | 'depreciation_schedule';
}

export interface MojoTaxCalculationInput {
  income: Record<string, number>;
  deductions: Record<string, number>;
  credits: Record<string, number>;
  filingStatus: string;
  dependents: number;
  state?: string;
}

// Loan calculations
export interface MojoLoanRequest extends MojoCalculationRequest {
  module: 'loan_engine';
  function: 'amortization_schedule' | 'payoff_calculation' | 'refinance_analysis' | 'loan_comparison';
}

// Batch processing
export interface MojoBatchRequest extends MojoCalculationRequest {
  module: 'batch_processor';
  function: 'categorize_transactions' | 'calculate_balances' | 'close_period' | 'generate_statements';
}

export interface MojoBatchTransactionInput {
  transactions: Array<{
    id: string;
    date: number;
    amount: number;
    description: string;
    currentCategory?: string;
  }>;
  rules?: Array<{
    pattern: string;
    category: string;
    confidence: number;
  }>;
}

// ML predictions
export interface MojoMLRequest extends MojoCalculationRequest {
  module: 'ml_categorizer' | 'ml_predictor';
  function: 'predict' | 'train' | 'evaluate';
}

export interface MojoMLPredictionInput {
  features: Record<string, any>;
  modelVersion?: string;
  threshold?: number;
}

export interface MojoMLTrainingInput {
  trainingData: Array<{
    features: Record<string, any>;
    label: any;
  }>;
  modelConfig?: {
    algorithm?: string;
    hyperparameters?: Record<string, any>;
  };
}

// Performance metrics
export interface MojoPerformanceMetrics {
  totalExecutions: number;
  averageExecutionTime: number;
  cacheHitRate: number;
  errorRate: number;
  moduleMetrics: Record<MojoModule, {
    executions: number;
    avgTime: number;
    errors: number;
    lastUsed: number;
  }>;
}

// Module loading
export interface MojoModuleInfo {
  name: MojoModule;
  version: string;
  size: number; // bytes
  loaded: boolean;
  functions: string[];
  lastLoaded?: number;
  loadTime?: number; // ms
}

// Error types
export interface MojoError {
  code: 'MODULE_NOT_FOUND' | 'FUNCTION_NOT_FOUND' | 'INVALID_INPUT' | 'TIMEOUT' | 'MEMORY_ERROR' | 'CALCULATION_ERROR';
  message: string;
  module?: MojoModule;
  function?: string;
  details?: any;
}

// Configuration
export interface MojoConfig {
  maxExecutionTime: number; // ms
  maxMemory: number; // bytes
  enableCaching: boolean;
  cacheSize: number; // entries
  cacheTTL: number; // seconds
  preloadModules?: MojoModule[];
  precision: number; // decimal places
}