// src/types/export.d.ts
/**
 * Defines TypeScript interfaces related to data export functionality,
 * including job management, formats, filters, options, and scheduling.
 */

/**
 * Supported export file formats.
 * Includes common data formats and specific accounting/property management software formats.
 */
export type ExportFormat =
  | 'csv'               // Comma-Separated Values
  | 'excel'             // Microsoft Excel (XLSX)
  | 'pdf'               // Portable Document Format
  | 'json'              // JavaScript Object Notation
  | 'xml'               // Extensible Markup Language
  | 'quickbooks_desktop'// QBB or IIF for QuickBooks Desktop
  | 'quickbooks_online' // QBO format or API specific
  | 'quicken'           // QIF format
  | 'xero_csv'          // Xero specific CSV format
  | 'turbo_tax'         // TXF format for TurboTax
  | 'generic_tax_prep'  // Generic format for other tax software
  // Property management software specific formats
  | 'yardi_voyager_csv'
  | 'appfolio_csv'
  | 'buildium_csv'
  | 'other_pm_export';  // Generic placeholder

/**
 * Types of data that can be exported from the system.
 */
export type ExportType =
  | 'chart_of_accounts'
  | 'transactions_list'       // Detailed list of transactions
  | 'general_ledger_detail'
  | 'trial_balance_summary'
  | 'balance_sheet_report'
  | 'income_statement_report' // Profit & Loss
  | 'cash_flow_statement_report'
  // Real estate specific reports/data
  | 'rent_roll_report'
  | 'tenant_ledger_detail'
  | 'property_performance_summary'
  | 'maintenance_history_report'
  | 'lease_abstracts_summary'
  | 'vendor_1099_data'
  // Other data types
  | 'documents_metadata_list' // List of documents, not the files themselves
  | 'entity_list_details'
  | 'user_activity_log'
  | 'full_entity_backup';    // Comprehensive backup of a single entity's data

/**
 * Status of an export job.
 */
export type ExportStatus =
  | 'queued'            // Job submitted and waiting for processing
  | 'processing'        // Job is actively being generated
  | 'completed'         // Job finished successfully, file is available
  | 'failed'            // Job failed during processing
  | 'cancelled_by_user'
  | 'expired_download'; // Download link/file has expired

/**
 * Represents an export job, tracking its configuration and status.
 */
export interface ExportJob {
  /** Unique identifier (UUID) for this export job. */
  readonly id: string;
  /** ID of the user who initiated this export. */
  readonly user_id: string;
  /** Optional: ID of the entity whose data is being exported. */
  entity_id?: string | null;
  /** User-defined name for this export job (e.g., "Q1 Transactions Export"). */
  name?: string | null; // Made optional, can be auto-generated
  type: ExportType;
  format: ExportFormat;
  filters?: ExportFilters; // Filters applied to the data being exported
  options?: ExportOptions; // Formatting and content options for the export
  status: ExportStatus;
  /** Progress percentage (0-100) if applicable for long-running jobs. */
  progress?: number | null;
  /** URL to download the generated export file (e.g., a signed R2 URL). */
  file_url?: string | null;
  /** Size of the generated file in bytes. */
  file_size_bytes?: number | null;
  file_name_generated?: string | null; // Actual filename generated
  error_message?: string | null; // If status is 'failed'
  /** Unix timestamp (seconds) when the job was created/queued. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when processing started. */
  started_at?: number | null;
  /** Unix timestamp (seconds) when processing completed or failed. */
  completed_at?: number | null;
  /** Unix timestamp (seconds) when the download link/file expires. */
  download_expires_at?: number | null; // Renamed from expires_at for clarity
  download_count?: number; // How many times the file has been downloaded
  /** Additional metadata associated with the job. */
  metadata?: Record<string, any> | null;
  /** ID of an ExportTemplate used to create this job, if any. */
  template_id?: string | null;
}

/**
 * Filtering options to apply to the data before exporting.
 */
export interface ExportFilters {
  date_range?: {
    /** Unix timestamp (seconds) for start of range (inclusive). */
    start_date: number; // Renamed from start
    /** Unix timestamp (seconds) for end of range (inclusive). */
    end_date: number;   // Renamed from end
  } | null;
  account_ids?: string[] | null;    // Filter by specific chart of account IDs
  entity_ids?: string[] | null;     // Filter by specific entity IDs (for multi-entity exports if applicable)
  property_ids?: string[] | null;   // Filter by specific property IDs
  transaction_types?: string[] | null; // Filter by transaction type
  transaction_statuses?: string[] | null; // Filter by transaction status
  tags?: string[] | null;           // Filter by tags associated with data
  min_amount?: number | null;
  max_amount?: number | null;
  /** Custom filters specific to the ExportType. */
  custom_filters?: Record<string, any> | null;
}

/**
 * Formatting and content options for the exported file.
 */
export interface ExportOptions {
  // General options
  include_headers?: boolean;
  include_metadata_summary?: boolean; // e.g., report generation date, filters used
  include_account_balances?: boolean; // For transaction reports, include start/end balances
  include_inactive_items?: boolean; // e.g., inactive accounts or entities
  date_format_string?: string; // e.g., "MM/DD/YYYY", "YYYY-MM-DD"
  number_format_locale?: string; // e.g., "en-US", "de-DE"
  currency_code_override?: string; // e.g., "CAD" if data is in USD but export needs CAD
  timezone_for_dates?: string; // e.g., "America/New_York"

  // PDF specific options
  pdf_export_options?: { // Renamed from pdf_options
    page_size?: 'letter' | 'legal' | 'a4' | 'tabloid';
    orientation?: 'portrait' | 'landscape';
    include_company_logo?: boolean; // Referenced from entity settings
    include_page_numbers?: boolean;
    include_generated_timestamp?: boolean;
    custom_header_text?: string;
    custom_footer_text?: string;
    font_size?: number; // points
    margins_inches?: { top: number; bottom: number; left: number; right: number };
  } | null;

  // Excel (XLSX) specific options
  excel_export_options?: { // Renamed from excel_options
    sheet_name?: string;
    include_formulas_for_totals?: boolean;
    freeze_header_row?: boolean;
    auto_fit_column_widths?: boolean;
    include_filter_dropdowns?: boolean;
    password_protect_file?: boolean; // Note: Password needs secure handling
    // data_as_table?: boolean; // Format data as an Excel Table
  } | null;

  // Accounting software specific options
  accounting_integration_options?: { // Renamed from accounting_options
    target_software: 'quickbooks_desktop' | 'quickbooks_online' | 'xero' | 'generic';
    chart_of_accounts_name_mapping?: Record<string, string>; // Map internal account names to target software names
    use_classes_if_available?: boolean; // QuickBooks specific
    use_locations_if_available?: boolean; // QuickBooks specific
    export_memo_field_to?: string; // e.g., "Description" or "Memo" in target software
    include_attachments_option?: 'link_only' | 'embed_if_possible' | 'none'; // If exporting supporting docs
  } | null;
  split_by_property?: boolean; // For property-related exports, create separate files/sheets per property
}

/**
 * Template for creating recurring or commonly used export jobs.
 */
export interface ExportTemplate {
  /** Unique identifier (UUID) for this export template. */
  readonly id: string;
  /** ID of the user who created/owns this template. */
  readonly user_id: string;
  name: string;
  description?: string | null;
  type: ExportType;
  format: ExportFormat;
  filters: ExportFilters; // Saved filter configuration
  options: ExportOptions; // Saved options configuration
  is_active: boolean; // Whether this template is active for scheduling or selection
  schedule_config?: ExportScheduleConfig | null; // Renamed from schedule
  /** Unix timestamp (seconds) of the last time a job was run from this template. */
  last_run_at?: number | null;
  /** Unix timestamp (seconds) of the next scheduled run for this template. */
  next_run_at?: number | null;
  /** Unix timestamp (seconds) when the template was created. */
  readonly created_at: number;
  /** Unix timestamp (seconds) when the template was last updated. */
  updated_at: number;
  is_shared_template?: boolean; // If it's a system-provided or widely shared template
  usage_count?: number;
}

/**
 * Configuration for scheduling an export job (from a template).
 */
export interface ExportScheduleConfig { // Renamed from ExportSchedule
  frequency: 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'annually' | 'custom_cron';
  day_of_week?: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0=Sunday, for weekly/bi-weekly
  day_of_month?: number; // 1-31, for monthly/quarterly/annually. Use 'last' for last day.
  month_of_year?: number; // 1-12, for annual/quarterly specifics
  time_of_day_utc: string;  // HH:MM in UTC
  custom_cron_expression?: string; // If frequency is 'custom_cron'
  send_email_notification_on_completion?: boolean;
  email_recipients?: string[]; // List of emails to notify
  auto_delete_after_days?: number | null; // Auto-delete generated file after N days
}

/**
 * Defines mapping rules for exporting data to specific external formats or systems.
 * This might be used if direct export to a proprietary format requires field mapping.
 */
export interface ExportDataMappingConfig { // Renamed from ExportMapping
  target_format_or_system: string; // e.g., "SpecificBankFormatCSV", "YardiGL"
  mappings: Array<{
    source_field_path: string; // Path to source field, e.g., "transaction.line_item[0].amount"
    target_field_name: string; // Name in the target format
    transform_function?: 'none' | 'to_uppercase' | 'format_date_MMDDYY' | 'custom_script_id';
    custom_transform_script_id?: string; // ID of a user-defined script for transformation
    default_value_if_empty?: any;
  }>;
}

/**
 * Data structure for previewing a sample of the export before generation.
 */
export interface ExportPreviewData { // Renamed from ExportPreview
  estimated_row_count: number;
  estimated_column_count: number;
  estimated_file_size_bytes?: number; // Approximate
  /** Sample rows of data (e.g., first 10 rows). Structure depends on ExportType. */
  sample_data_rows: any[];
  column_headers?: string[]; // Headers that will be in the export
  potential_warnings?: string[]; // e.g., "Large dataset, export may take time"
}

/**
 * Configuration for performing a bulk export of multiple report types or data sets.
 */
export interface BulkExportRequest { // Renamed from BulkExport
  job_name?: string;
  notification_email?: string;
  exports_to_run: Array<{ // Renamed from exports
    type: ExportType;
    format: ExportFormat;
    filters?: ExportFilters;
    options?: ExportOptions;
    output_filename?: string; // Optional custom filename for this specific part
  }>;
  combine_all_into_single_file?: boolean; // If true, try to merge compatible exports (e.g., multiple CSVs into one Excel with sheets)
  archive_output_as?: 'zip' | 'tar_gz' | null; // If null, individual files
  archive_filename?: string;
}

/**
 * Log entry for auditing export activities.
 */
export interface ExportAuditLogEntry { // Renamed from ExportAuditLog
  readonly id: string; // Unique log entry ID
  export_job_id: string;
  user_id: string;
  action: 'job_created' | 'job_started' | 'job_completed' | 'job_failed' | 'file_downloaded' | 'job_deleted' | 'job_cancelled';
  ip_address?: string | null;
  user_agent?: string | null;
  /** Unix timestamp (seconds) of the audit event. */
  timestamp: number;
  details?: Record<string, any>; // e.g., download IP, cancellation reason
}