// src/types/import.d.ts
/**
 * Defines TypeScript interfaces related to data import functionality,
 * including import sessions, file types, mapping configurations,
 * validation rules, and bank feed connections for financial data ingestion.
 */

/**
 * Supported file types for data import.
 * Includes common financial data formats and property management software exports.
 */
export type ImportFileType =
  | 'csv'                      // Comma-Separated Values
  | 'excel_xlsx'             // Modern Excel format
  | 'excel_xls'              // Legacy Excel format
  | 'ofx'                      // Open Financial Exchange (Version 1.x or 2.x)
  | 'qfx'                      // Quicken Financial Exchange
  | 'qif'                      // Quicken Interchange Format
  | 'qbo'                      // QuickBooks Online export/backup
  | 'pdf_statement'          // PDF Bank/Credit Card statements (requires OCR)
  | 'generic_bank_statement'   // Non-specific bank statement format
  | 'generic_credit_card_statement'
  // Property management software specific formats
  | 'yardi_gl_export'
  | 'appfolio_transaction_export'
  | 'buildium_ledger_export'
  | 'rent_roll_csv_excel'
  | 'other_custom_format';    // For user-defined parsers

/**
 * Status of an data import session or individual items.
 */
export type ImportStatus =
  | 'pending_upload'
  | 'uploading_file'
  | 'uploaded_pending_parse'
  | 'parsing_file'
  | 'parsed_pending_mapping' // File parsed, header/columns identified
  | 'mapping_columns'        // User is actively mapping columns
  | 'mapped_pending_validation'
  | 'validating_data'        // Applying validation rules to rows
  | 'validation_complete_needs_review' // Validation done, user review of errors/warnings
  | 'ready_for_import'       // All checks passed, ready for final import step
  | 'importing_data'         // Data is being written to the database
  | 'import_completed_successfully'
  | 'import_completed_with_errors' // Some rows failed
  | 'import_completed_with_warnings'
  | 'import_failed'            // Critical failure during import process
  | 'import_cancelled_by_user'
  | 'partially_imported';      // Some data imported, but process interrupted or had critical errors

/**
 * Type of entity being imported (e.g., transactions, chart of accounts).
 */
export type ImportTargetEntityType = // Renamed from ImportEntityType for clarity
  | 'transactions'
  | 'chart_of_accounts'
  | 'entities_general' // General business entities
  | 'tenants_list'
  | 'properties_list'
  | 'leases_list'
  | 'vendors_list'
  | 'loan_details'
  | 'opening_balances';

/**
 * Manages the state and progress of a data import session.
 */
export interface ImportSession {
  /** Unique identifier (UUID) for this import session. */
  readonly id: string;
  /** ID of the user who initiated this import. */
  readonly user_id: string;
  /** ID of the primary entity this import is for. */
  entity_id: string;
  /** User-defined name for this import session (e.g., "Q1 Bank Statements"). */
  name?: string | null;
  file_type: ImportFileType;
  original_file_name: string; // Renamed from file_name
  file_size_bytes: number;    // Renamed from file_size
  /** URL to the uploaded file in temporary storage (e.g., R2 presigned URL for processing). */
  processing_file_url?: string | null; // Renamed from file_url
  target_entity_type: ImportTargetEntityType; // Renamed from entity_type
  status: ImportStatus;
  current_processing_stage?: ImportProcessingStage; // Renamed from stage
  total_rows_detected?: number | null; // Renamed from total_rows
  processed_rows_count?: number | null; // Renamed from processed_rows
  successfully_imported_rows_count?: number | null; // Renamed from successful_rows
  failed_rows_count?: number | null; // Renamed from failed_rows
  skipped_rows_count?: number | null; // Renamed from skipped_rows
  column_mapping_config?: ImportColumnMappingConfig | null; // Renamed from mapping_config
  applied_validation_rules?: AppliedValidationRule[] | null; // Renamed from validation_rules
  import_processing_options?: ImportProcessingOptions | null; // Renamed from import_options
  error_summary_report?: ImportErrorReportSummary | null; // Renamed from error_summary
  /** Unix timestamp (seconds) when the session was created. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when processing started. */
  started_at?: number | null;
  /** Unix timestamp (seconds) when processing completed or failed. */
  completed_at?: number | null;
  /** Additional metadata (e.g., source bank name for statements). */
  metadata?: Record<string, any> | null;
  /** ID of an ImportTemplate used, if any. */
  template_id?: string | null;
  /** If the import can be rolled back. */
  is_rollback_possible?: boolean;
  /** Unix timestamp (seconds) until when rollback is possible. */
  rollback_deadline?: number | null;
}

/**
 * Current stage of the import process.
 */
export type ImportProcessingStage = // Renamed from ImportStage
  | 'file_upload'
  | 'file_parsing'
  | 'column_mapping'
  | 'data_validation'
  | 'user_review_fix'
  | 'final_import'
  | 'post_import_actions';

/**
 * Configuration for mapping columns from the source file to target system fields.
 */
export interface ImportColumnMappingConfig { // Renamed from ImportMapping
  // Example transaction mappings (would be specific to target_entity_type)
  transaction_date_column?: SourceColumnDefinition; // Renamed from date_column
  transaction_amount_column?: SourceColumnDefinition;
  transaction_description_column?: SourceColumnDefinition;
  target_account_column?: SourceColumnDefinition; // Account to debit/credit
  debit_amount_column?: SourceColumnDefinition; // If debits are in a separate column
  credit_amount_column?: SourceColumnDefinition;
  transaction_reference_column?: SourceColumnDefinition;
  payee_or_payer_column?: SourceColumnDefinition;
  category_or_memo_column?: SourceColumnDefinition;

  // Real estate specific mappings (if target_entity_type is property/lease/tenant related)
  property_identifier_column?: SourceColumnDefinition;
  unit_identifier_column?: SourceColumnDefinition;
  tenant_name_column?: SourceColumnDefinition;
  lease_start_date_column?: SourceColumnDefinition;

  /** Mappings for custom fields in the target entity. Key is target custom field name. */
  custom_field_mappings?: Record<string, SourceColumnDefinition> | null;

  /** Rules for transforming or mapping specific values within columns. Key is target field path. */
  value_transformation_rules?: Record<string, ValueTransformationRule[]> | null; // Renamed from value_mappings
  /** Default values to apply if source column is empty or not mapped. Key is target field path. */
  default_field_values?: Record<string, any> | null; // Renamed from default_values
  /** Rules for skipping rows based on content. */
  row_skip_conditions?: RowSkipCondition[] | null; // Renamed from skip_rules
  header_row_index?: number; // 0-indexed, default 0
  data_start_row_index?: number; // 0-indexed, default 1
  file_encoding?: 'utf-8' | 'iso-8859-1' | 'windows-1252';
  delimiter_character?: ',' | ';' | '\t' | '|'; // For CSV
}

export interface SourceColumnDefinition { // Renamed from ColumnMapping
  /** Name or index (0-based for CSV) of the column in the source file. */
  source_column_header_or_index: string | number;
  // target_field: string; // Target field is now the key in ImportColumnMappingConfig or custom_field_mappings
  expected_data_type: 'string' | 'number' | 'date' | 'boolean' | 'currency_decimal';
  date_format_if_string?: string | null; // e.g., "MM/DD/YYYY", "ISO8601"
  is_required_for_import?: boolean;
  data_cleaning_transforms?: DataCleaningTransform[] | null; // Renamed from transform
}

export interface ValueTransformationRule { // Renamed from ValueMapping
  /** Source values from the file that trigger this transformation. */
  source_input_values: string[];
  /** The target value to map to if a source_input_value is matched. */
  mapped_target_value: any;
  // target_field path is the key in ImportColumnMappingConfig.value_transformation_rules
  match_is_case_sensitive?: boolean;
}

export interface DataCleaningTransform { // Renamed from DataTransform
  type:
    | 'to_uppercase' | 'to_lowercase' | 'trim_whitespace'
    | 'replace_text' | 'regex_extract_replace'
    | 'parse_date_from_string' | 'parse_number_from_string' // Handles currency symbols, commas
    | 'split_column' // e.g. "FirstName LastName" into two fields
    | 'custom_script'; // For very complex transformations
  config?: Record<string, any> | null; // Parameters for the transform (e.g., regex, date format)
}

export interface RowSkipCondition { // Renamed from SkipRule
  source_column_header_or_index: string | number; // Field in source data to check
  condition_operator: 'is_empty' | 'is_not_empty' | 'equals_value' | 'not_equals_value' | 'contains_text' | 'does_not_contain_text' | 'matches_regex';
  comparison_value?: any; // Value for equals, contains, regex
  is_case_sensitive?: boolean;
}

/**
 * Validation rule applied to mapped data before import.
 */
export interface AppliedValidationRule { // Renamed from ValidationRule
  target_field_path: string; // Path to the field in the mapped data object
  rule_type: 'required_field' | 'data_type_check' | 'value_range' | 'max_length' | 'pattern_match' | 'unique_value_in_column' | 'foreign_key_exists' | 'custom_business_rule';
  config_params?: Record<string, any> | null; // e.g., min/max for range, regex pattern
  severity_level: 'error_halts_import' | 'warning_allows_import' | 'info_only';
  custom_error_message?: string | null;
}

/**
 * Options controlling the import process behavior.
 */
export interface ImportProcessingOptions { // Renamed from ImportOptions
  duplicate_handling_strategy: 'skip_duplicates' | 'update_existing' | 'create_new_with_suffix' | 'fail_on_duplicate';
  date_format_interpretation?: string | null; // Overall date format hint if not per-column
  default_timezone_for_dates?: string | null; // e.g., "America/New_York"
  decimal_separator_character?: '.' | ',';
  thousands_separator_character?: ',' | '.' | ' ' | '';
  default_currency_code?: string | null; // e.g., "USD"

  // Transaction-specific options
  auto_categorize_transactions?: boolean;
  auto_create_missing_accounts?: boolean; // From CoA
  auto_create_missing_payees_vendors?: boolean;
  attempt_to_reconcile_with_existing?: boolean;

  // Real estate specific
  auto_create_missing_properties?: boolean;
  auto_create_missing_tenants?: boolean;
  update_existing_lease_terms?: boolean;

  // Performance & Control
  batch_size_for_db_writes?: number; // Default 100
  enable_transaction_rollback_on_failure?: boolean; // For database writes
  is_dry_run_mode?: boolean; // Validate and simulate but don't actually import
  user_notification_on_completion?: boolean;
}

/**
 * Represents a single row of data during the import process, from raw to imported.
 */
export interface ImportedRowData { // Renamed from ImportedRow
  /** Original row number from the source file (1-indexed). */
  source_row_number: number;
  /** Raw data as key-value pairs from the parsed file row. */
  raw_row_data: Record<string, any>;
  /** Data after column mapping and initial type conversion. Structure matches target_entity_type. */
  mapped_data?: any | null;
  /** Results of validation against AppliedValidationRule[]. */
  validation_results?: RowValidationOutcome[] | null; // Renamed from ValidationResult
  /** Suggestions for matching to existing system entities (e.g., existing accounts, payees). */
  suggested_entity_matches?: SuggestedEntityMatch[] | null; // Renamed from SuggestedMatch
  /** Action to be taken for this row (create, update, skip). */
  determined_import_action?: 'create_new' | 'update_existing' | 'skip_row';
  processing_status: 'pending_validation' | 'validated_ok' | 'validated_with_errors' | 'validated_with_warnings' | 'ready_to_import' | 'imported_successfully' | 'import_failed' | 'skipped_by_rule';
  error_messages?: string[] | null;
  warning_messages?: string[] | null;
  /** ID of the successfully imported record, if applicable. */
  imported_record_id?: string | null;
}

export interface RowValidationOutcome {
  target_field_path: string;
  applied_rule_type: AppliedValidationRule['rule_type'];
  passed_validation: boolean;
  message?: string | null;
  severity_level: AppliedValidationRule['severity_level'];
  validated_value?: any;
}

export interface SuggestedEntityMatch {
  target_field_path: string; // e.g., "payeeName", "accountId"
  /** Type of entity being matched (e.g., 'vendor', 'account'). */
  match_entity_type: string;
  suggestions: Array<{
    id: string; // ID of the existing system entity
    name: string; // Name of the existing system entity
    similarity_score: number; // 0.0 to 1.0
    match_reasoning?: string;
    additional_metadata?: Record<string, any>;
  }>;
  is_automatically_selected?: boolean; // If system picked a high-confidence match
  user_selected_match_id?: string | null; // If user overrides/selects a match
}

/**
 * Summary of errors encountered during an import session.
 */
export interface ImportErrorReportSummary { // Renamed from ErrorSummary
  total_errors_found: number;
  errors_by_type_count: Record<string, number>; // e.g., { "REQUIRED_FIELD_MISSING": 10, "INVALID_DATE_FORMAT": 5 }
  most_common_errors: Array<{
    error_message_template: string;
    occurrence_count: number;
    sample_affected_row_numbers: number[]; // e.g., first 5 rows with this error
  }>;
  sample_detailed_errors?: ImportRowErrorDetail[] | null; // Renamed from ImportError
}

export interface ImportRowErrorDetail {
  source_row_number: number;
  problem_column_header?: string | null;
  error_type_code: string; // Corresponds to key in errors_by_type_count
  full_error_message: string;
  original_cell_value?: any;
  suggested_fix_action?: string;
}

/**
 * Saved template for recurring or common import configurations.
 */
export interface ImportTemplate {
  /** Unique identifier (UUID) for this import template. */
  readonly id: string;
  /** ID of the user who created/owns this template. */
  readonly user_id: string;
  name: string;
  description?: string | null;
  source_file_type: ImportFileType; // Renamed from file_type
  target_entity_type: ImportTargetEntityType;
  column_mapping_config: ImportColumnMappingConfig;
  applied_validation_rules?: AppliedValidationRule[] | null;
  import_processing_options?: ImportProcessingOptions | null;
  sample_file_url_for_template?: string | null; // Link to a sample file showing format
  /** Unix timestamp (seconds) when the template was created. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when the template was last updated. */
  updated_at: number;
  usage_count?: number;
  is_shared_template?: boolean;
  tags?: string[];
}

/**
 * Configuration for connecting to a bank feed for automated transaction import.
 */
export interface BankFeedConnectionConfig { // Renamed from BankFeedConfig
  /** Unique identifier (UUID) for this bank feed connection. */
  readonly id: string;
  entity_id: string; // Entity this feed belongs to
  /** ID of the Chart of Account (cash account) to which transactions from this feed will be linked. */
  linked_account_id: string;
  connection_provider: 'plaid' | 'yodlee' | 'teller_io' | 'finicity' | 'manual_upload_sftp'; // Renamed from connection_type
  /** Encrypted or provider-specific connection configuration/tokens. */
  provider_connection_config?: Record<string, any> | null;
  import_schedule_config?: BankFeedImportSchedule; // Renamed from import_schedule
  /** Unix timestamp (seconds) of the last successful synchronization. */
  last_successful_sync_at?: number | null; // Renamed from last_sync_at
  is_active_connection: boolean; // Renamed from is_active
  connection_status_message?: string | null; // e.g., "Needs re-authentication", "Syncing"
  /** Date from which to start fetching transactions. ISO 8601 date string (YYYY-MM-DD). */
  fetch_transactions_from_date?: string | null;
  /** User-friendly name for this connection (e.g., "Chase Business Checking"). */
  friendly_name?: string | null;
  /** Masked account number from the bank. */
  bank_account_number_masked?: string | null;
  bank_name?: string | null;
}

export interface BankFeedImportSchedule { // Renamed from ImportSchedule
  sync_frequency: 'daily' | 'every_few_days' | 'weekly' | 'manual_trigger_only';
  preferred_sync_time_utc?: string | null; // HH:MM in UTC for daily/weekly
  day_of_week_for_weekly_sync?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday
}

/**
 * History log of import sessions.
 */
export interface ImportSessionHistoryLog { // Renamed from ImportHistory
  import_session_id: string; // UUID
  imported_items_count: number; // Renamed from imported_count
  target_entity_type: ImportTargetEntityType;
  imported_by_user_id: string; // Renamed from imported_by
  /** Unix timestamp (seconds) when the import was finalized. */
  imported_at: number;
  can_be_undone: boolean; // Renamed from can_undo
  /** Unix timestamp (seconds) until when this import can be undone. */
  undo_possible_until?: number | null; // Renamed from undo_expires_at
  source_file_name?: string; // For reference
}