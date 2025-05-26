// src/types/report.d.ts
/**
 * Defines TypeScript interfaces for financial reports including
 * balance sheets, income statements, cash flow statements, trial balance,
 * general ledger, custom reports, and related dashboard metrics.
 */

import type { AccountSystemType } from './accounting'; // For consistent account typing

// ----------------
// Time Period and General Report Types
// ----------------

/** Defines common reporting periods. */
export type ReportPeriod = 'month' | 'quarter' | 'year' | 'custom_range' | 'year_to_date';

/** Specifies the time frame for a report. */
export interface ReportTimeFrame {
  period: ReportPeriod;
  /** Start date of the report period (ISO 8601 string: YYYY-MM-DD). */
  startDate: string;
  /** End date of the report period (ISO 8601 string: YYYY-MM-DD). */
  endDate: string;
  /** Optional: Start date of the comparison period (ISO 8601 string: YYYY-MM-DD). */
  previousPeriodStartDate?: string | null; // Renamed for clarity
  /** Optional: End date of the comparison period (ISO 8601 string: YYYY-MM-DD). */
  previousPeriodEndDate?: string | null;   // Renamed for clarity
  includeYTDComparison?: boolean; // Renamed from includeYTD for clarity
  fiscalYearStart?: { month: number; day: number }; // For fiscal year calculations
}

/** Base interface for all report types. */
export interface ReportBase {
  /** Unique identifier (UUID) for this generated report instance. */
  readonly id: string;
  title: string;
  timeFrame: ReportTimeFrame;
  /** ID of the entity this report pertains to. */
  entityId: string;
  entityName?: string; // Denormalized for display
  /** Unix timestamp (seconds) when the report was generated. */
  generatedAt: number;
  generatedByUserId: string; // Renamed from generatedBy
  reportVersion?: string; // Renamed from version, e.g., "v1.1"
  notes?: string | null;
  isFinalized: boolean; // Renamed from finalized
  currencyCode: string; // ISO 4217 currency code, e.g., "USD"
}

/** Represents a single line item within a financial report. */
export interface ReportLineItem {
  /** ID of the corresponding ChartOfAccount entry, if applicable. */
  accountId?: string | null;
  accountCode?: string | null; // Renamed from code for clarity
  lineItemName: string; // Renamed from name
  amount: number;
  /** Amount from the comparison period, if applicable. */
  previousPeriodAmount?: number | null; // Renamed from previousAmount
  /** Percentage change from the comparison period, as a decimal (e.g., 0.05 for 5%). */
  changePercentage?: number | null; // Renamed from percentChange
  /** Year-to-date amount for this line item, if applicable. */
  yearToDateAmount?: number | null; // Renamed from ytdAmount
  /** Nested line items for hierarchical reports. */
  children?: ReportLineItem[] | null;
  /** True if this amount is a calculated subtotal or total, not directly from an account. */
  isCalculatedTotal?: boolean; // Renamed from isCalculated
  /** True if this line item is a header or section title. */
  isHeaderLine?: boolean; // Renamed from isHeader
  customStyleClass?: string | null; // Renamed from styleClass
  displayOrder: number; // Renamed from order
  /** Pre-formatted string for the main amount (for display). */
  formattedAmount?: string | null;
  /** Pre-formatted string for the previous period amount (for display). */
  formattedPreviousPeriodAmount?: string | null; // Renamed from formattedPreviousAmount
  /** Pre-formatted string for the percentage change (for display). */
  formattedChangePercentage?: string | null; // Renamed from formattedPercentChange
  /** This line item's amount as a percentage of total revenue (for P&L). Decimal value. */
  percentageOfRevenue?: number | null; // Renamed from percentOfRevenue
  /** Pre-formatted string for percentage of revenue (for display). */
  formattedPercentageOfRevenue?: string | null; // Renamed from formattedPercentOfRevenue
  notes?: string | null; // Line-item specific notes
  indentLevel?: number; // For hierarchical display
}

/**
 * Represents an account's balance at a specific point in time or for a period,
 * used within reporting contexts. Renamed from AccountBalance to avoid conflict.
 */
export interface ReportAccountContextEntry {
  accountId: string; // UUID
  accountName: string;
  accountType: AccountSystemType; // Using imported AccountSystemType
  accountCode: string;
  balance: number;
  /** Date for which this balance is relevant (ISO 8601 string: YYYY-MM-DD). */
  asOfDate: string;
  periodDebitTotal?: number;
  periodCreditTotal?: number;
}

// ----------------
// Balance Sheet Report
// ----------------
export interface BalanceSheetSection {
  items: ReportLineItem[];
  totalAmount: number; // Renamed from total
  formattedTotalAmount?: string;
}
export interface BalanceSheetReport extends ReportBase {
  type: 'balance-sheet';
  assets: {
    currentAssets: BalanceSheetSection; // Renamed from current
    longTermAssets: BalanceSheetSection; // Renamed from longTerm (or fixedAssets)
    totalAssets: number; // Renamed from total
    formattedTotalAssets?: string;
  };
  liabilities: {
    currentLiabilities: BalanceSheetSection; // Renamed from current
    longTermLiabilities: BalanceSheetSection; // Renamed from longTerm
    totalLiabilities: number; // Renamed from total
    formattedTotalLiabilities?: string;
  };
  equity: {
    items: ReportLineItem[]; // Detailed equity accounts
    totalEquity: number; // Renamed from total
    formattedTotalEquity?: string;
  };
  // Verification: totalAssets should equal totalLiabilities + totalEquity
  isBalanced?: boolean; // Calculated: abs(totalAssets - (totalLiabilities + totalEquity)) < tolerance
  // accountBalancesSnapshot?: ReportAccountContextEntry[]; // Balances used to generate this BS
}

// ----------------
// Income Statement (Profit & Loss) Report
// ----------------
export interface IncomeStatementSection {
  items: ReportLineItem[];
  totalAmount: number; // Renamed from total
  formattedTotalAmount?: string;
}
export interface IncomeStatementReport extends ReportBase {
  type: 'income-statement';
  revenue: IncomeStatementSection;
  costOfGoodsSold?: IncomeStatementSection | null; // Optional COGS
  grossProfit: number; // Revenue - COGS (or just Revenue if no COGS)
  formattedGrossProfit?: string;
  operatingExpenses: IncomeStatementSection; // Renamed from expenses
  operatingIncome: number; // Gross Profit - Operating Expenses (EBITDA or EBIT depending on OpEx detail)
  formattedOperatingIncome?: string;
  otherIncomeAndExpenses?: IncomeStatementSection | null; // Interest, non-operating
  incomeBeforeTax: number;
  formattedIncomeBeforeTax?: string;
  incomeTaxExpense?: number | null;
  formattedIncomeTaxExpense?: string;
  netIncome: number;
  formattedNetIncome?: string;
  // Optional comparative data points already in ReportLineItem or can be added here:
  // netIncomePreviousPeriod?: number;
  // netIncomePercentChange?: number;
  // netIncomePercentOfTotalRevenue?: number; // Renamed from netIncomePercentOfRevenue
  showPercentageOfTotalRevenueColumn?: boolean; // Renamed from showPercentOfRevenue
  // Supporting details or transaction summaries are usually separate or drill-downs
  // transactionsSummary?: TransactionSummary[]; // Renamed from transactions
}

// Example of TransactionSummary (if needed directly in P&L, though often a drill-down)
export interface TransactionSummaryForReport { // Renamed from TransactionSummary
  transactionCount: number; // Renamed from count
  totalAmount: number; // Renamed from total
  relatedAccountId: string; // Renamed from accountId
  transactionTypeGrouping: string; // Renamed from type
}

// ----------------
// Cash Flow Statement Report
// ----------------
export interface CashFlowActivitySection {
  items: ReportLineItem[];
  netCashFlowAmount: number; // Renamed from netCash
  formattedNetCashFlowAmount?: string;
}
export interface CashFlowReport extends ReportBase {
  type: 'cash-flow';
  operatingActivities: {
    netIncomeFromPL: number; // Renamed from netIncome
    formattedNetIncomeFromPL?: string;
    adjustmentsToReconcileNetIncome: CashFlowActivitySection; // Renamed from adjustments (e.g. depreciation, gains/losses)
    changesInOperatingAssetsLiabilities: CashFlowActivitySection; // Renamed from changesInWorkingCapital
    netCashFromOperatingActivities: number; // Renamed from netCash
    formattedNetCashFromOperatingActivities?: string;
  };
  investingActivities: CashFlowActivitySection;
  financingActivities: CashFlowActivitySection;
  netIncreaseOrDecreaseInCash: number; // Renamed from netIncrease
  formattedNetIncreaseOrDecreaseInCash?: string;
  cashAtBeginningOfPeriod: number; // Renamed from beginningCash
  formattedCashAtBeginningOfPeriod?: string;
  cashAtEndOfPeriod: number; // Renamed from endingCash
  formattedCashAtEndOfPeriod?: string;
  supplementalCashFlowInfo?: {
    cashPaidForInterest?: number;
    cashPaidForTaxes?: number;
    significantNonCashActivities?: ReportLineItem[];
  } | null;
}

// ----------------
// Dashboard-Style Report / Financial Metrics Summary
// ----------------
export interface FinancialMetricValue { // Renamed from FinancialMetric
  metricName: string; // Renamed from name
  currentValue: number; // Renamed from value
  previousPeriodValue?: number | null; // Renamed from previousValue
  targetValue?: number | null; // Renamed from target
  /** Percentage change from previous period or target, as decimal. */
  percentageChange?: number | null; // Renamed from percentChange
  valueFormat: 'currency' | 'percentage' | 'number' | 'ratio'; // Renamed from format
  /** Historical data points for a small trend line/sparkline. */
  trendDataPoints?: number[] | null; // Renamed from trend
  trendTimeLabels?: string[] | null; // Renamed from trendLabels
  trendIndicator?: 'positive' | 'negative' | 'neutral' | 'stable_trend'; // Renamed from indicator
  unitOfMeasure?: string | null; // e.g. "USD", "%", "days"
}
export interface DashboardSummaryReport extends ReportBase { // Renamed from DashboardReport
  type: 'dashboard_summary'; // Renamed from dashboard
  keyPerformanceIndicators: FinancialMetricValue[]; // Renamed from metrics

  // Example summary sections (can be customized)
  revenueOverview?: {
    totalRevenueCurrentPeriod: number;
    totalRevenueYTD: number;
    revenueByCategory?: Array<{ categoryName: string; amount: number; percentageOfTotal?: number }>;
  } | null;
  expenseOverview?: {
    totalExpensesCurrentPeriod: number;
    totalExpensesYTD: number;
    expensesByCategory?: Array<{ categoryName: string; amount: number; percentageOfTotal?: number }>;
  } | null;
  cashPositionSummary?: {
    currentCashBalance: number;
    projectedCashBalanceNextPeriod?: number;
    cashTrendDataPoints?: number[];
    cashTrendTimeLabels?: string[];
  } | null;
  accountsReceivableSummary?: {
    totalOutstandingAR: number;
    agingSummary?: Array<{ agingBucket: string; amount: number; percentageOfTotal?: number }>; // e.g., "0-30 days", "31-60 days"
  } | null;
  accountsPayableSummary?: {
    totalOutstandingAP: number;
    agingSummary?: Array<{ agingBucket: string; amount: number; percentageOfTotal?: number }>;
  } | null;
  // Real estate specific examples
  propertyOccupancySummary?: {
    totalUnits: number;
    occupiedUnits: number;
    occupancyRatePercent: number;
  } | null;
  rentCollectionSummary?: {
    totalRentBilled: number;
    totalRentCollected: number;
    collectionRatePercent: number;
    delinquentRentAmount?: number;
  } | null;
}

// ----------------
// Trial Balance Report
// ----------------
export interface TrialBalanceReportEntry { // New interface for clarity
  accountId: string; // UUID
  accountCode: string;
  accountName: string;
  accountType: AccountSystemType;
  debitBalanceAmount: number; // Renamed from debitBalance
  creditBalanceAmount: number; // Renamed from creditBalance
  netBalanceAmount?: number; // Usually not shown directly in TB, but can be derived
  parentAccountId?: string | null;
  displayOrder: number; // Renamed from order
}
export interface TrialBalanceReport extends ReportBase {
  type: 'trial-balance';
  accounts: TrialBalanceReportEntry[];
  totalDebitBalances: number; // Renamed from totalDebits
  totalCreditBalances: number; // Renamed from totalCredits
  isReportBalanced: boolean; // Renamed from isBalanced (true if totals match)
  differenceAmountIfUnbalanced?: number; // Renamed from difference
}

// ----------------
// General Ledger Report
// ----------------
export interface GeneralLedgerAccountDetail { // New interface
  accountInfo: { // Renamed from account
    id: string; // UUID
    code: string;
    name: string;
    type: AccountSystemType;
  };
  openingPeriodBalance: number; // Renamed from openingBalance
  transactionsInPeriod: Array<{ // Renamed from transactions
    transactionId: string; // UUID
    /** Transaction date (ISO 8601 string: YYYY-MM-DD). */
    transactionDate: string; // Renamed from date
    descriptionText: string; // Renamed from description
    referenceIdentifier?: string | null; // Renamed from reference
    debitAmount?: number | null; // Renamed from debit
    creditAmount?: number | null; // Renamed from credit
    runningBalanceAfterTransaction: number; // Renamed from runningBalance
    relatedCounterpartyOrEntity?: string | null; // Renamed from relatedEntity
    memo?: string | null;
  }>;
  closingPeriodBalance: number; // Renamed from closingBalance
  totalDebitsInPeriod: number; // Renamed from periodDebits
  totalCreditsInPeriod: number; // Renamed from periodCredits
}
export interface GeneralLedgerReport extends ReportBase {
  type: 'general-ledger';
  accountsDetail: GeneralLedgerAccountDetail[]; // Renamed from accounts
  filterIncludeZeroBalanceAccounts?: boolean; // Renamed from includeZeroBalances
  filterIncludeInactiveCoaAccounts?: boolean; // Renamed from includeInactiveAccounts
}

// ----------------
// Custom Report Builder Types
// ----------------
export interface CustomReportColumnDefinition { // New interface
  id: string; // Unique ID for the column definition
  headerName: string; // Renamed from name
  valueSourceType: 'account_balance' | 'account_activity' | 'calculated_formula' | 'static_text' | 'metadata_field'; // Renamed from type
  valueSourceField?: string; // e.g., accountId for balance, transaction field for activity
  formulaExpression?: string | null; // For calculated_formula
  displayFormat?: 'currency' | 'number' | 'percentage' | 'date' | 'text';
  columnWidth?: string | null; // e.g., "150px", "20%"
  textAlignment?: 'left' | 'center' | 'right';
  isSummable?: boolean; // If this column should be totaled
}
export interface CustomReportConfiguration { // Renamed from CustomReportConfig
  reportName: string; // Renamed from name
  descriptionText?: string | null; // Renamed from description
  accountSelectionCriteria: { // Renamed from accountSelection
    includeAccountIds?: string[] | null;
    includeAccountTypes?: AccountSystemType[] | null;
    excludeAccountIds?: string[] | null;
    accountTags?: string[] | null; // Filter by accounts having specific tags
  };
  reportColumns: CustomReportColumnDefinition[]; // Renamed from columns
  rowGroupingOptions?: { // Renamed from groupBy
    groupByField: string; // e.g., "account.type", "property.name"
    showGroupSubtotals?: boolean;
  } | null;
  sortingOptions?: { // Renamed from sortBy
    sortByField: string;
    sortDirection: 'asc' | 'desc';
  } | null;
  reportFilters?: Array<{ // Renamed from filters
    filterField: string;
    filterOperator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between_dates' | 'in_list';
    filterValue: any;
    filterValue2?: any; // For 'between_dates'
  }> | null;
  showComparisonColumn?: boolean;
  comparisonPeriod?: ReportTimeFrame;
}
export interface CustomGeneratedReport extends ReportBase { // Renamed from CustomReport
  type: 'custom_generated'; // Renamed from custom
  sourceConfig: CustomReportConfiguration; // Renamed from config
  /** Data rows, where each key is a column ID from CustomReportColumnDefinition. */
  reportDataRows: Array<Record<string, any>>; // Renamed from data
  columnTotals?: Record<string, number> | null; // Renamed from totals
  generationMetadata?: { // Renamed from metadata
    rowCountGenerated: number;
    accountsEvaluatedCount: number;
    executionTimeMs?: number;
  } | null;
}

// ----------------
// Report Formatting & Export Options (can be part of ReportRequestParams)
// ----------------
export type ReportExportFormatType = 'pdf' | 'csv' | 'xlsx' | 'json_data' | 'html_view'; // Renamed from ReportExportFormat

export type ReportVisualizationRenderType = // Renamed from ReportVisualizationType
  | 'table_data_grid'
  | 'line_chart_viz'
  | 'bar_chart_viz'
  | 'pie_chart_viz'
  | 'gauge_indicator_viz'
  | 'kpi_scorecard_viz';

export interface ReportElementVisualization { // Renamed from ReportVisualization
  type: ReportVisualizationRenderType;
  /** Data field from the report (e.g., a specific line item total, or a metric name) to visualize. */
  dataSourceFieldKey: string; // Renamed from dataField
  visualizationTitle?: string | null; // Renamed from title
  layoutWidth?: string | null; // e.g., "1/2", "full" relative to report section
  layoutHeight?: string | null; // e.g., "300px"
  /** Configuration specific to the chart/visualization type. */
  visualizationSpecificConfig?: Record<string, any> | null; // Renamed from config
}
export interface ReportDisplayFormatOptions { // Renamed from ReportFormatOptions
  showPercentagesInReport?: boolean; // Renamed from showPercentages
  showPeriodComparisons?: boolean; // Renamed from showComparisons
  showTrendIndicators?: boolean; // Renamed from showTrends
  reportCurrencyCode?: string | null; // Overrides default if needed
  defaultDecimalPlaces?: number;
  includeCompanyLogoInHeader?: boolean; // Renamed from includeLogo
  includeEntityInformationInHeader?: boolean; // Renamed from includeEntityInfo
  pdfPageLayout?: 'portrait' | 'landscape'; // Renamed from pageLayout
  useParenthesesForNegativeNumbers?: boolean; // Renamed from negativeInParentheses
  reportFontSize?: 'small' | 'medium' | 'large';
  customCssClassForReport?: string | null; // Renamed from customClass
  embeddedVisualizations?: ReportElementVisualization[] | null; // Renamed from visualizations
}

// ----------------
// Report Request & Response (refined from original)
// ----------------
export interface GenerateReportRequest { // Renamed from ReportRequestParams
  reportType: Report['type']; // Union of all specific report types
  entityId: string;
  timeFrame: ReportTimeFrame;
  displayFormatOptions?: ReportDisplayFormatOptions;
  // Specific options based on reportType
  includeAccountDetailsInGL?: boolean; // Renamed from includeAccountDetails
  includeTransactionDetailsInGL?: boolean; // Renamed from includeTransactionDetails
  customReportConfigurationId?: string; // If reportType is 'custom_generated', ID of saved CustomReportConfiguration
  dynamicFilters?: Record<string, any> | null; // Runtime filters
}

export interface GeneratedReportResponse { // Renamed from ReportResponse
  success: boolean;
  errorMessage?: string | null; // Renamed from error
  errorCode?: string | null;
  reportData?: Report; // The actual structured report data
  downloadableReportUrl?: string | null; // URL to a generated file (PDF, XLSX)
  reportGenerationTimeMs?: number | null; // Renamed from generationTime
  requestId?: string;
}

// --- Union Type for all specific report structures ---
export type AnyReportData = // Renamed from Report
  | BalanceSheetReport
  | IncomeStatementReport
  | CashFlowReport
  | DashboardSummaryReport
  | TrialBalanceReport
  | GeneralLedgerReport
  | CustomGeneratedReport;