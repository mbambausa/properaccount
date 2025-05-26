// src/types/export.d.ts
/**
 * Export functionality type definitions
 */

export type ExportFormat = 
  | 'csv'
  | 'excel'
  | 'pdf'
  | 'json'
  | 'xml'
  | 'quickbooks'
  | 'quicken'
  | 'turbo_tax'
  | 'yardi'           // Property management software
  | 'appfolio'        // Property management software
  | 'buildium';       // Property management software

export type ExportType = 
  | 'transactions'
  | 'chart_of_accounts'
  | 'balance_sheet'
  | 'income_statement'
  | 'cash_flow'
  | 'trial_balance'
  | 'general_ledger'
  | 'tax_report'
  | 'documents'
  | 'entities'
  | 'full_backup'
  // Real estate specific
  | 'rent_roll'
  | 'tenant_ledger'
  | 'property_performance'
  | 'maintenance_history'
  | 'lease_abstracts';

export type ExportStatus = 
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

/**
 * Export job configuration
 */
export interface ExportJob {
  readonly id: string;
  readonly user_id: string;
  entity_id?: string;
  name: string;
  type: ExportType;
  format: ExportFormat;
  filters?: ExportFilters;
  options?: ExportOptions;
  status: ExportStatus;
  progress?: number;
  file_url?: string;
  file_size?: number;
  error_message?: string;
  readonly created_at: number;
  started_at?: number;
  completed_at?: number;
  expires_at?: number;
  download_count: number;
  metadata?: Record<string, any>;
}

/**
 * Export filtering options
 */
export interface ExportFilters {
  date_range?: {
    start: number;
    end: number;
  };
  account_ids?: string[];
  entity_ids?: string[];
  property_ids?: string[];
  transaction_types?: string[];
  statuses?: string[];
  tags?: string[];
  custom_filters?: Record<string, any>;
}

/**
 * Export formatting options
 */
export interface ExportOptions {
  // General options
  include_headers?: boolean;
  include_metadata?: boolean;
  include_balances?: boolean;
  include_inactive?: boolean;
  date_format?: string;
  number_format?: string;
  currency_code?: string;
  timezone?: string;
  
  // PDF options
  pdf_options?: {
    page_size: 'letter' | 'legal' | 'a4';
    orientation: 'portrait' | 'landscape';
    include_logo?: boolean;
    include_page_numbers?: boolean;
    include_timestamps?: boolean;
    watermark?: string;
  };
  
  // Excel options
  excel_options?: {
    include_formulas?: boolean;
    freeze_headers?: boolean;
    auto_column_width?: boolean;
    include_charts?: boolean;
    password_protect?: boolean;
  };
  
  // Accounting software options
  accounting_options?: {
    chart_of_accounts_mapping?: Record<string, string>;
    use_classes?: boolean;
    use_locations?: boolean;
    include_memo?: boolean;
    include_attachments?: boolean;
  };
}

/**
 * Export template for recurring exports
 */
export interface ExportTemplate {
  readonly id: string;
  readonly user_id: string;
  name: string;
  description?: string;
  type: ExportType;
  format: ExportFormat;
  filters: ExportFilters;
  options: ExportOptions;
  is_active: boolean;
  schedule?: ExportSchedule;
  last_run_at?: number;
  next_run_at?: number;
  readonly created_at: number;
  updated_at: number;
}

/**
 * Export scheduling configuration
 */
export interface ExportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  day_of_week?: number;  // 0-6
  day_of_month?: number; // 1-31
  time_of_day?: string;  // HH:MM
  timezone: string;
  send_email?: boolean;
  email_recipients?: string[];
}

/**
 * Data mapping for exports
 */
export interface ExportMapping {
  source_field: string;
  target_field: string;
  transform?: 'none' | 'uppercase' | 'lowercase' | 'date' | 'number' | 'custom';
  custom_transform?: string;
  default_value?: any;
}

/**
 * Export preview data
 */
export interface ExportPreview {
  row_count: number;
  column_count: number;
  estimated_size: number;
  sample_data: any[];
  warnings?: string[];
}

/**
 * Bulk export configuration
 */
export interface BulkExport {
  exports: Array<{
    type: ExportType;
    format: ExportFormat;
    filters?: ExportFilters;
  }>;
  combine_files?: boolean;
  archive_format?: 'zip' | 'tar';
}

/**
 * Export audit log
 */
export interface ExportAuditLog {
  export_id: string;
  user_id: string;
  action: 'created' | 'downloaded' | 'deleted' | 'shared';
  ip_address?: string;
  user_agent?: string;
  timestamp: number;
}