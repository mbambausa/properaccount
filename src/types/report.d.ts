// src/types/report.d.ts
/**
 * Report type definitions
 *
 * This module defines TypeScript interfaces for financial reports including
 * balance sheets, income statements, cash flow statements, and dashboards.
 */

// ----------------
// Time Period Types
// ----------------

/**
 * Time periods for financial reporting
 */
export type ReportPeriod = 'month' | 'quarter' | 'year' | 'custom';

/**
 * Configuration for a report's time period
 */
export interface ReportTimeFrame {
  /** Type of period */
  period: ReportPeriod;
  /** Start date of the report period (ISO format) */
  startDate: string;
  /** End date of the report period (ISO format) */
  endDate: string;
  /** Previous period start date for comparisons (ISO format) */
  previousStartDate?: string;
  /** Previous period end date for comparisons (ISO format) */
  previousEndDate?: string;
  /** Whether to include YTD calculations */
  includeYTD?: boolean;
}

// ----------------
// Report Data Types
// ----------------

/**
 * Base interface for all report types
 */
export interface ReportBase {
  /** Unique identifier for the report */
  id: string;
  /** Report title */
  title: string;
  /** Time frame configuration */
  timeFrame: ReportTimeFrame;
  /** Entity ID the report belongs to */
  entityId: string;
  /** Date the report was generated */
  generatedAt: string;
  /** User who generated the report */
  generatedBy: string;
  /** Report format version */
  version: string;
  /** Custom notes added to the report */
  notes?: string;
  /** Whether the report is finalized */
  finalized: boolean;
}

/**
 * Line item in a financial report
 */
export interface ReportLineItem {
  /** Account ID if applicable */
  accountId?: string;
  /** Line item code */
  code: string;
  /** Display name */
  name: string;
  /** Current period amount */
  amount: number;
  /** Previous period amount if comparison enabled */
  previousAmount?: number;
  /** Percentage change from previous period */
  percentChange?: number;
  /** Year-to-date amount if applicable */
  ytdAmount?: number;
  /** Child line items for hierarchical display */
  children?: ReportLineItem[];
  /** Whether this is a calculated subtotal/total line */
  isCalculated?: boolean;
  /** Whether this is a header line with no value */
  isHeader?: boolean;
  /** Custom styling class */
  styleClass?: string;
  /** Display order */
  order: number;
  /** Formatted current period amount (added for formatting) */
  formattedAmount?: string;
  /** Formatted previous period amount (added for formatting) */
  formattedPreviousAmount?: string;
  /** Formatted percentage change (added for formatting) */
  formattedPercentChange?: string;
  /** Percentage of total revenue (for income statements) */
  percentOfRevenue?: number;
  /** Formatted percentage of revenue (added for formatting) */
  formattedPercentOfRevenue?: string;
}

/**
 * Account balance at a specific date
 */
export interface AccountBalance {
  /** Account ID */
  accountId: string;
  /** Account name */
  accountName: string;
  /** Account type */
  accountType: string;
  /** Account code/number */
  accountCode: string;
  /** Balance amount */
  balance: number;
  /** Date of balance */
  asOfDate: string;
}

// ----------------
// Balance Sheet
// ----------------

/**
 * Balance sheet report
 */
export interface BalanceSheetReport extends ReportBase {
  /** Report type */
  type: 'balance-sheet';
  /** Asset section */
  assets: {
    /** Current assets */
    current: ReportLineItem[];
    /** Long-term assets */
    longTerm: ReportLineItem[];
    /** Total assets calculated amount */
    total: number;
  };
  /** Liability section */
  liabilities: {
    /** Current liabilities */
    current: ReportLineItem[];
    /** Long-term liabilities */
    longTerm: ReportLineItem[];
    /** Total liabilities calculated amount */
    total: number;
  };
  /** Equity section */
  equity: {
    /** Equity line items */
    items: ReportLineItem[];
    /** Total equity calculated amount */
    total: number;
  };
  /** Currency code for the report values */
  currencyCode: string;
  /** Account balances used to generate the report */
  accountBalances: AccountBalance[];
}

// ----------------
// Income Statement
// ----------------

/**
 * Income statement report
 */
export interface IncomeStatementReport extends ReportBase {
  /** Report type */
  type: 'income-statement';
  /** Revenue section */
  revenue: {
    /** Revenue line items */
    items: ReportLineItem[];
    /** Total revenue calculated amount */
    total: number;
  };
  /** Expenses section */
  expenses: {
    /** Expense line items */
    items: ReportLineItem[];
    /** Total expenses calculated amount */
    total: number;
  };
  /** Net income (revenue - expenses) */
  netIncome: number;
  /** Whether to show percentages of revenue */
  showPercentOfRevenue?: boolean;
  /** Account transactions used to generate the report */
  transactions?: TransactionSummary[];
  /** Net income from previous period (for comparison) */
  netIncomePreviousPeriod?: number;
  /** Percentage change in net income */
  netIncomePercentChange?: number;
  /** Net income as percentage of revenue */
  netIncomePercentOfRevenue?: number;
  /** Gross profit (revenue - COGS) */
  grossProfit?: number;
  /** Operating income */
  operatingIncome?: number;
  /** Income before taxes */
  incomeBeforeTax?: number;
  /** Formatted net income (added for formatting) */
  formattedNetIncome?: string;
  /** Formatted previous period net income (added for formatting) */
  formattedNetIncomePreviousPeriod?: string;
  /** Formatted percent change in net income (added for formatting) */
  formattedNetIncomePercentChange?: string;
  /** Formatted net income as percentage of revenue (added for formatting) */
  formattedNetIncomePercentOfRevenue?: string;
  /** Formatted gross profit (added for formatting) */
  formattedGrossProfit?: string;
  /** Formatted operating income (added for formatting) */
  formattedOperatingIncome?: string;
  /** Formatted income before tax (added for formatting) */
  formattedIncomeBeforeTax?: string;
}

/**
 * Summary of transactions for a report
 */
export interface TransactionSummary {
  /** Number of transactions */
  count: number;
  /** Total amount */
  total: number;
  /** Account ID */
  accountId: string;
  /** Transaction type */
  type: string;
}

// ----------------
// Cash Flow Statement
// ----------------

/**
 * Cash flow statement report
 */
export interface CashFlowReport extends ReportBase {
  /** Report type */
  type: 'cash-flow';
  /** Operating activities section */
  operatingActivities: {
    /** Net income */
    netIncome: number;
    /** Adjustments to reconcile net income to cash */
    adjustments: ReportLineItem[];
    /** Changes in operating assets and liabilities */
    changesInWorkingCapital: ReportLineItem[];
    /** Net cash from operating activities */
    netCash: number;
    /** Formatted net income (added for formatting) */
    formattedNetIncome?: string;
    /** Formatted net cash from operating activities (added for formatting) */
    formattedNetCash?: string;
  };
  /** Investing activities section */
  investingActivities: {
    /** Investing activity line items */
    items: ReportLineItem[];
    /** Net cash from investing activities */
    netCash: number;
    /** Formatted net cash from investing activities (added for formatting) */
    formattedNetCash?: string;
  };
  /** Financing activities section */
  financingActivities: {
    /** Financing activity line items */
    items: ReportLineItem[];
    /** Net cash from financing activities */
    netCash: number;
    /** Formatted net cash from financing activities (added for formatting) */
    formattedNetCash?: string;
  };
  /** Net increase/decrease in cash */
  netIncrease: number;
  /** Beginning cash balance */
  beginningCash: number;
  /** Ending cash balance */
  endingCash: number;
  /** Formatted net increase in cash (added for formatting) */
  formattedNetIncrease?: string;
  /** Formatted beginning cash balance (added for formatting) */
  formattedBeginningCash?: string;
  /** Formatted ending cash balance (added for formatting) */
  formattedEndingCash?: string;
}

// ----------------
// Dashboard Report
// ----------------

/**
 * Financial metrics for dashboard reports
 */
export interface FinancialMetric {
  /** Metric name */
  name: string;
  /** Current value */
  value: number;
  /** Previous value for comparison */
  previousValue?: number;
  /** Target value if applicable */
  target?: number;
  /** Percentage change */
  percentChange?: number;
  /** Format specifier ('currency', 'percent', 'number') */
  format: 'currency' | 'percent' | 'number';
  /** Trend data for charts */
  trend?: number[];
  /** Trend labels (e.g., months) */
  trendLabels?: string[];
  /** Visual indicator of performance ('positive', 'negative', 'neutral') */
  indicator?: 'positive' | 'negative' | 'neutral';
}

/**
 * Dashboard financial summary report
 */
export interface DashboardReport extends ReportBase {
  /** Report type */
  type: 'dashboard';
  /** Key financial metrics */
  metrics: FinancialMetric[];
  /** Revenue summary */
  revenueSummary?: {
    /** Current period total */
    total: number;
    /** YTD total */
    ytd: number;
    /** By category breakdown */
    byCategory: Array<{name: string; value: number}>;
  };
  /** Expense summary */
  expenseSummary?: {
    /** Current period total */
    total: number;
    /** YTD total */
    ytd: number;
    /** By category breakdown */
    byCategory: Array<{name: string; value: number}>;
  };
  /** Cash position */
  cashPosition?: {
    /** Current balance */
    balance: number;
    /** Projected balance at end of period */
    projected: number;
    /** Historical trend */
    trend: number[];
    /** Dates for trend data */
    trendDates: string[];
  };
  /** Accounts receivable aging */
  accountsReceivable?: {
    /** Total outstanding */
    total: number;
    /** Aging buckets (e.g., 0-30 days, 31-60 days) */
    aging: Array<{range: string; amount: number}>;
  };
  /** Accounts payable aging */
  accountsPayable?: {
    /** Total outstanding */
    total: number;
    /** Aging buckets (e.g., 0-30 days, 31-60 days) */
    aging: Array<{range: string; amount: number}>;
  };
}

// ----------------
// Report Formatting & Export
// ----------------

/**
 * Report export format options
 */
export type ReportExportFormat = 'pdf' | 'csv' | 'xlsx' | 'json';

/**
 * Report visualization type
 */
export type ReportVisualizationType =
  'table' |
  'line-chart' |
  'bar-chart' |
  'pie-chart' |
  'gauge' |
  'scorecard';

/**
 * Report visualization configuration
 */
export interface ReportVisualization {
  /** Type of visualization */
  type: ReportVisualizationType;
  /** Data field to visualize */
  dataField: string;
  /** Title for the visualization */
  title: string;
  /** Width (percentage or pixels) */
  width?: string;
  /** Height (percentage or pixels) */
  height?: string;
  /** Additional configuration options for the specific visualization type */
  config?: Record<string, any>;
}

/**
 * Report formatting options
 */
export interface ReportFormatOptions {
  /** Show percentages */
  showPercentages?: boolean;
  /** Show comparisons to previous period */
  showComparisons?: boolean;
  /** Show trend indicators */
  showTrends?: boolean;
  /** Currency code for financial values */
  currencyCode?: string;
  /** Number of decimal places to display */
  decimalPlaces?: number;
  /** Include report logo */
  includeLogo?: boolean;
  /** Include entity information in header */
  includeEntityInfo?: boolean;
  /** Page layout for PDF export ('portrait' or 'landscape') */
  pageLayout?: 'portrait' | 'landscape';
  /** Whether to display negative numbers in parentheses */
  negativeInParentheses?: boolean;
  /** Font size for PDF export */
  fontSize?: 'small' | 'medium' | 'large';
  /** Additional CSS class for styling */
  customClass?: string;
  /** Visualizations to include in the report */
  visualizations?: ReportVisualization[];
}

// ----------------
// Report Request & Response
// ----------------

/**
 * Parameters for requesting a financial report
 */
export interface ReportRequestParams {
  /** Type of report */
  type: 'balance-sheet' | 'income-statement' | 'cash-flow' | 'dashboard' | 'custom';
  /** Entity ID */
  entityId: string;
  /** Time frame */
  timeFrame: ReportTimeFrame;
  /** Format options */
  formatOptions?: ReportFormatOptions;
  /** Include account details */
  includeAccountDetails?: boolean;
  /** Include transaction details */
  includeTransactionDetails?: boolean;
  /** Additional filters */
  filters?: Record<string, any>;
}

/**
 * Response for a report generation request
 */
export interface ReportResponse {
  /** Success or failure */
  success: boolean;
  /** Error message if applicable */
  error?: string;
  /** Generated report data */
  report?: BalanceSheetReport | IncomeStatementReport | CashFlowReport | DashboardReport;
  /** URL to the generated report if externally stored */
  reportUrl?: string;
  /** Generation time in milliseconds */
  generationTime?: number;
}