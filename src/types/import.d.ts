// src/types/import.d.ts
/**
 * Import functionality type definitions for financial data ingestion
 */

export type ImportFileType = 
  | 'csv'
  | 'excel'
  | 'ofx'              // Open Financial Exchange
  | 'qfx'              // Quicken
  | 'qif'              // Quicken Interchange Format
  | 'qbo'              // QuickBooks Online
  | 'pdf'              // For OCR processing
  | 'bank_statement'
  | 'credit_card'
  // Property management formats
  | 'yardi_export'
  | 'appfolio_export'
  | 'buildium_export'
  | 'rent_roll';

export type ImportStatus = 
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'mapping'
  | 'validating'
  | 'ready'
  | 'importing'
  | 'completed'
  | 'failed'
  | 'partial'
  | 'cancelled';

export type ImportEntityType = 
  | 'transaction'
  | 'account'
  | 'entity'
  | 'tenant'
  | 'property'
  | 'lease'
  | 'vendor';

/**
 * Import session management
 */
export interface ImportSession {
  readonly id: string;
  readonly user_id: string;
  entity_id: string;
  name: string;
  file_type: ImportFileType;
  file_name: string;
  file_size: number;
  file_url?: string;
  entity_type: ImportEntityType;
  status: ImportStatus;
  stage?: ImportStage;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  skipped_rows: number;
  mapping_config?: ImportMapping;
  validation_rules?: ValidationRule[];
  import_options?: ImportOptions;
  error_summary?: ErrorSummary;
  readonly created_at: number;
  started_at?: number;
  completed_at?: number;
  metadata?: Record<string, any>;
}

/**
 * Import processing stages
 */
export interface ImportStage {
  current: 'upload' | 'parse' | 'map' | 'validate' | 'review' | 'import';
  completed: string[];
  can_rollback: boolean;
}

/**
 * Column mapping configuration
 */
export interface ImportMapping {
  // Transaction mappings
  date_column?: ColumnMapping;
  amount_column?: ColumnMapping;
  description_column?: ColumnMapping;
  account_column?: ColumnMapping;
  debit_column?: ColumnMapping;
  credit_column?: ColumnMapping;
  reference_column?: ColumnMapping;
  payee_column?: ColumnMapping;
  category_column?: ColumnMapping;
  
  // Real estate specific mappings
  property_column?: ColumnMapping;
  unit_column?: ColumnMapping;
  tenant_column?: ColumnMapping;
  lease_column?: ColumnMapping;
  
  // Custom field mappings
  custom_mappings?: Record<string, ColumnMapping>;
  
  // Mapping rules
  value_mappings?: Record<string, ValueMapping>;
  default_values?: Record<string, any>;
  skip_rules?: SkipRule[];
}

export interface ColumnMapping {
  source_column: string | number;
  target_field: string;
  data_type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  format?: string;
  required?: boolean;
  transform?: DataTransform;
}

export interface ValueMapping {
  source_values: string[];
  target_value: any;
  target_field?: string;
}

export interface DataTransform {
  type: 'uppercase' | 'lowercase' | 'trim' | 'replace' | 'regex' | 'date_parse' | 'number_parse' | 'custom';
  config?: Record<string, any>;
}

export interface SkipRule {
  field: string;
  condition: 'empty' | 'equals' | 'contains' | 'regex';
  value?: any;
}

/**
 * Import validation
 */
export interface ValidationRule {
  field: string;
  type: 'required' | 'format' | 'range' | 'unique' | 'reference' | 'balance';
  config?: Record<string, any>;
  severity: 'error' | 'warning';
  message?: string;
}

/**
 * Import options
 */
export interface ImportOptions {
  // General options
  duplicate_handling: 'skip' | 'update' | 'create_new';
  date_format?: string;
  timezone?: string;
  decimal_separator?: '.' | ',';
  thousands_separator?: ',' | '.' | ' ' | '';
  currency_symbol?: string;
  
  // Transaction options
  auto_categorize?: boolean;
  create_missing_accounts?: boolean;
  reconcile_existing?: boolean;
  
  // Real estate options
  create_missing_properties?: boolean;
  create_missing_tenants?: boolean;
  update_lease_terms?: boolean;
  
  // Performance options
  batch_size?: number;
  enable_rollback?: boolean;
  dry_run?: boolean;
}

/**
 * Imported row processing
 */
export interface ImportedRow {
  row_number: number;
  raw_data: Record<string, any>;
  parsed_data?: any;
  mapped_data?: any;
  validation_results?: ValidationResult[];
  suggested_matches?: SuggestedMatch[];
  import_action?: 'create' | 'update' | 'skip';
  status: 'pending' | 'validated' | 'imported' | 'failed' | 'skipped';
  error_messages?: string[];
  warnings?: string[];
}

export interface ValidationResult {
  field: string;
  rule: string;
  passed: boolean;
  message?: string;
  severity: 'error' | 'warning';
}

export interface SuggestedMatch {
  field: string;
  suggestions: Array<{
    id: string;
    name: string;
    type: string;
    confidence: number;
    metadata?: Record<string, any>;
  }>;
  auto_selected?: boolean;
}

/**
 * Error tracking
 */
export interface ErrorSummary {
  total_errors: number;
  errors_by_type: Record<string, number>;
  common_errors: Array<{
    error: string;
    count: number;
    affected_rows: number[];
  }>;
  sample_errors: ImportError[];
}

export interface ImportError {
  row_number: number;
  column?: string;
  error_type: string;
  message: string;
  value?: any;
  suggestion?: string;
}

/**
 * Import templates
 */
export interface ImportTemplate {
  readonly id: string;
  readonly user_id: string;
  name: string;
  description?: string;
  file_type: ImportFileType;
  entity_type: ImportEntityType;
  mapping_config: ImportMapping;
  validation_rules: ValidationRule[];
  import_options: ImportOptions;
  sample_file_url?: string;
  readonly created_at: number;
  updated_at: number;
  usage_count: number;
}

/**
 * Bank feed configuration
 */
export interface BankFeedConfig {
  readonly id: string;
  entity_id: string;
  account_id: string;
  connection_type: 'plaid' | 'yodlee' | 'manual' | 'sftp';
  connection_config?: Record<string, any>;
  import_schedule?: ImportSchedule;
  last_sync_at?: number;
  is_active: boolean;
}

export interface ImportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'manual';
  time?: string;
  day_of_week?: number;
  day_of_month?: number;
}

/**
 * Import history
 */
export interface ImportHistory {
  session_id: string;
  imported_count: number;
  imported_type: ImportEntityType;
  imported_by: string;
  imported_at: number;
  can_undo: boolean;
  undo_expires_at?: number;
}