// src/types/report.d.ts
/**
 * Report type definitions
 *
 * This module defines TypeScript interfaces for financial reports including
 * balance sheets, income statements, cash flow statements, dashboards,
 * trial balance, general ledger, and custom reports.
 */

// ----------------
// Time Period Types
// ----------------

export type ReportPeriod = 'month' | 'quarter' | 'year' | 'custom';

export interface ReportTimeFrame {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  previousStartDate?: string;
  previousEndDate?: string;
  includeYTD?: boolean;
}

// ----------------
// Report Data Types
// ----------------

export interface ReportBase {
  id: string;
  title: string;
  timeFrame: ReportTimeFrame;
  entityId: string;
  generatedAt: string;
  generatedBy: string;
  version: string;
  notes?: string;
  finalized: boolean;
}

export interface ReportLineItem {
  accountId?: string;
  code: string;
  name: string;
  amount: number;
  previousAmount?: number;
  percentChange?: number;
  ytdAmount?: number;
  children?: ReportLineItem[];
  isCalculated?: boolean;
  isHeader?: boolean;
  styleClass?: string;
  order: number;
  formattedAmount?: string;
  formattedPreviousAmount?: string;
  formattedPercentChange?: string;
  percentOfRevenue?: number;
  formattedPercentOfRevenue?: string;
}

export interface AccountBalance {
  accountId: string;
  accountName: string;
  accountType: string;
  accountCode: string;
  balance: number;
  asOfDate: string;
}

// ----------------
// Balance Sheet
// ----------------

export interface BalanceSheetReport extends ReportBase {
  type: 'balance-sheet';
  assets: {
    current: ReportLineItem[];
    longTerm: ReportLineItem[];
    total: number;
  };
  liabilities: {
    current: ReportLineItem[];
    longTerm: ReportLineItem[];
    total: number;
  };
  equity: {
    items: ReportLineItem[];
    total: number;
  };
  currencyCode: string;
  accountBalances: AccountBalance[];
}

// ----------------
// Income Statement
// ----------------

export interface IncomeStatementReport extends ReportBase {
  type: 'income-statement';
  revenue: {
    items: ReportLineItem[];
    total: number;
  };
  expenses: {
    items: ReportLineItem[];
    total: number;
  };
  netIncome: number;
  showPercentOfRevenue?: boolean;
  transactions?: TransactionSummary[];
  netIncomePreviousPeriod?: number;
  netIncomePercentChange?: number;
  netIncomePercentOfRevenue?: number;
  grossProfit?: number;
  operatingIncome?: number;
  incomeBeforeTax?: number;
  formattedNetIncome?: string;
  formattedNetIncomePreviousPeriod?: string;
  formattedNetIncomePercentChange?: string;
  formattedNetIncomePercentOfRevenue?: string;
  formattedGrossProfit?: string;
  formattedOperatingIncome?: string;
  formattedIncomeBeforeTax?: string;
}

export interface TransactionSummary {
  count: number;
  total: number;
  accountId: string;
  type: string;
}

// ----------------
// Cash Flow Statement
// ----------------

export interface CashFlowReport extends ReportBase {
  type: 'cash-flow';
  operatingActivities: {
    netIncome: number;
    adjustments: ReportLineItem[];
    changesInWorkingCapital: ReportLineItem[];
    netCash: number;
    formattedNetIncome?: string;
    formattedNetCash?: string;
  };
  investingActivities: {
    items: ReportLineItem[];
    netCash: number;
    formattedNetCash?: string;
  };
  financingActivities: {
    items: ReportLineItem[];
    netCash: number;
    formattedNetCash?: string;
  };
  netIncrease: number;
  beginningCash: number;
  endingCash: number;
  formattedNetIncrease?: string;
  formattedBeginningCash?: string;
  formattedEndingCash?: string;
}

// ----------------
// Dashboard Report
// ----------------

export interface FinancialMetric {
  name: string;
  value: number;
  previousValue?: number;
  target?: number;
  percentChange?: number;
  format: 'currency' | 'percent' | 'number';
  trend?: number[];
  trendLabels?: string[];
  indicator?: 'positive' | 'negative' | 'neutral';
}

export interface DashboardReport extends ReportBase {
  type: 'dashboard';
  metrics: FinancialMetric[];
  revenueSummary?: {
    total: number;
    ytd: number;
    byCategory: Array<{name: string; value: number}>;
  };
  expenseSummary?: {
    total: number;
    ytd: number;
    byCategory: Array<{name: string; value: number}>;
  };
  cashPosition?: {
    balance: number;
    projected: number;
    trend: number[];
    trendDates: string[];
  };
  accountsReceivable?: {
    total: number;
    aging: Array<{range: string; amount: number}>;
  };
  accountsPayable?: {
    total: number;
    aging: Array<{range: string; amount: number}>;
  };
}

// ----------------
// Trial Balance Report
// ----------------

/**
 * Trial balance report showing all accounts with their debit/credit balances
 */
export interface TrialBalanceReport extends ReportBase {
  type: 'trial-balance';
  accounts: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    debitBalance: number;
    creditBalance: number;
    netBalance: number;
    parentAccountId?: string;
    order: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  difference?: number;
}

// ----------------
// General Ledger Report
// ----------------

/**
 * General ledger report showing all transactions by account
 */
export interface GeneralLedgerReport extends ReportBase {
  type: 'general-ledger';
  accounts: Array<{
    account: {
      id: string;
      code: string;
      name: string;
      type: string;
    };
    openingBalance: number;
    transactions: Array<{
      transactionId: string;
      date: string;
      description: string;
      reference?: string;
      debit?: number;
      credit?: number;
      runningBalance: number;
      relatedEntity?: string;
    }>;
    closingBalance: number;
    periodDebits: number;
    periodCredits: number;
  }>;
  includeZeroBalances?: boolean;
  includeInactiveAccounts?: boolean;
}

// ----------------
// Custom Report Builder
// ----------------

/**
 * Custom report configuration for the report builder
 */
export interface CustomReportConfig {
  name: string;
  description?: string;
  accountSelection: {
    includeAccounts?: string[];
    includeTypes?: string[];
    excludeAccounts?: string[];
  };
  columns: Array<{
    id: string;
    name: string;
    type: 'account' | 'amount' | 'percentage' | 'text' | 'date';
    formula?: string;
    width?: string;
  }>;
  groupBy?: {
    field: string;
    showSubtotals?: boolean;
  };
  sortBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  filters?: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
    value: any;
  }>;
}

/**
 * Custom report generated from the report builder
 */
export interface CustomReport extends ReportBase {
  type: 'custom';
  config: CustomReportConfig;
  data: Array<Record<string, any>>;
  totals?: Record<string, number>;
  metadata?: {
    rowCount: number;
    accountsIncluded: number;
    executionTime?: number;
  };
}

// ----------------
// Report Formatting & Export
// ----------------

export type ReportExportFormat = 'pdf' | 'csv' | 'xlsx' | 'json';

export type ReportVisualizationType =
  'table' |
  'line-chart' |
  'bar-chart' |
  'pie-chart' |
  'gauge' |
  'scorecard';

export interface ReportVisualization {
  type: ReportVisualizationType;
  dataField: string;
  title: string;
  width?: string;
  height?: string;
  config?: Record<string, any>;
}

export interface ReportFormatOptions {
  showPercentages?: boolean;
  showComparisons?: boolean;
  showTrends?: boolean;
  currencyCode?: string;
  decimalPlaces?: number;
  includeLogo?: boolean;
  includeEntityInfo?: boolean;
  pageLayout?: 'portrait' | 'landscape';
  negativeInParentheses?: boolean;
  fontSize?: 'small' | 'medium' | 'large';
  customClass?: string;
  visualizations?: ReportVisualization[];
}

// ----------------
// Report Request & Response
// ----------------

export interface ReportRequestParams {
  type: 'balance-sheet' | 'income-statement' | 'cash-flow' | 'dashboard' | 'trial-balance' | 'general-ledger' | 'custom';
  entityId: string;
  timeFrame: ReportTimeFrame;
  formatOptions?: ReportFormatOptions;
  includeAccountDetails?: boolean;
  includeTransactionDetails?: boolean;
  filters?: Record<string, any>;
}

export interface ReportResponse {
  success: boolean;
  error?: string;
  report?: Report;
  reportUrl?: string;
  generationTime?: number;
}

// ----------------
// Report Union Type
// ----------------

export type Report =
  | BalanceSheetReport
  | IncomeStatementReport
  | CashFlowReport
  | DashboardReport
  | TrialBalanceReport
  | GeneralLedgerReport
  | CustomReport;
