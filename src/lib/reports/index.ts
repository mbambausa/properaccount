// src/lib/reports/index.ts
/**
 * Reports Module Index
 * 
 * This module exports the unified reports API and individual report generators.
 */

// Export the unified ReportAPI for easy access
export { ReportAPI } from './report-api';

// Export individual report generators and their helper functions
export * from './balance-sheet';
export * from './income-statement';
export * from './cash-flow';

// Export the report types from our types module
export type { 
  ReportTimeFrame,
  ReportPeriod,
  ReportBase,
  BalanceSheetReport,
  IncomeStatementReport,
  CashFlowReport,
  DashboardReport,
  ReportLineItem,
  AccountBalance,
  TransactionSummary,
  ReportExportFormat,
  ReportVisualizationType,
  ReportVisualization,
  ReportFormatOptions,
  ReportRequestParams,
  ReportResponse,
  FinancialMetric
} from '../../types/report';