// src/lib/reports/income-statement.ts
/**
 * Income Statement Report Generator
 *
 * This module generates income statement (profit & loss) reports based on
 * transactions for a specified entity and time period.
 */

// Use type-only imports
import type {
  IncomeStatementReport,
  ReportLineItem,
  ReportTimeFrame,
  TransactionSummary,
} from "../../types/report";
import {
  getTransactionTotals,
  getAccountsByType,
} from "../accounting/accounting-api";
import { formatCurrency, formatPercent } from "../../utils/format";
import type { D1Database } from "@cloudflare/workers-types";

/**
 * Extended ReportLineItem interface with percentOfRevenue
 */
interface ExtendedReportLineItem extends ReportLineItem {
  percentOfRevenue?: number;
  formattedPercentOfRevenue?: string;
}

/**
 * Extended IncomeStatementReport interface with additional properties
 */
interface ExtendedIncomeStatementReport extends IncomeStatementReport {
  grossProfit?: number;
  operatingIncome?: number;
  incomeBeforeTax?: number;
  netIncomePreviousPeriod?: number;
  netIncomePercentChange?: number;
  netIncomePercentOfRevenue?: number;
  formattedNetIncome?: string;
  formattedNetIncomePreviousPeriod?: string;
  formattedNetIncomePercentChange?: string;
  formattedNetIncomePercentOfRevenue?: string;
  formattedGrossProfit?: string;
  formattedOperatingIncome?: string;
  formattedIncomeBeforeTax?: string;
}

/**
 * Account type categories for the income statement
 */
const REVENUE_ACCOUNT_TYPES = ["REVENUE", "INCOME", "OTHER_INCOME"];
const EXPENSE_ACCOUNT_TYPES = [
  "EXPENSE",
  "COST_OF_GOODS_SOLD",
  "OTHER_EXPENSE",
  "DEPRECIATION",
  "AMORTIZATION",
  "INTEREST_EXPENSE",
  "TAX_EXPENSE",
];
const COGS_ACCOUNT_TYPES = ["COST_OF_GOODS_SOLD"];
const OPERATING_EXPENSE_TYPES = ["EXPENSE", "DEPRECIATION", "AMORTIZATION"];
const NON_OPERATING_EXPENSE_TYPES = ["OTHER_EXPENSE", "INTEREST_EXPENSE"];
const TAX_EXPENSE_TYPES = ["TAX_EXPENSE"];

/**
 * Options for generating an income statement report
 */
export interface IncomeStatementOptions {
  /** Entity ID to generate the report for */
  entityId: string;
  /** Time frame for the report */
  timeFrame: ReportTimeFrame;
  /** Start date of the period (ISO format) */
  startDate: string;
  /** End date of the period (ISO format) */
  endDate: string;
  /** Previous period start date for comparison (ISO format) */
  previousStartDate?: string;
  /** Previous period end date for comparison (ISO format) */
  previousEndDate?: string;
  /** Whether to include comparative data */
  includeComparison?: boolean;
  /** Whether to include percentage of revenue */
  showPercentOfRevenue?: boolean;
  /** Whether to include transaction details */
  includeTransactionDetails?: boolean;
  /** Whether to include subtotals for operating/non-operating items */
  includeOperatingSubtotals?: boolean;
  /** Chart of accounts ID if not using the default */
  chartOfAccountsId?: string;
  /** Currency code */
  currencyCode?: string;
  /** Database connection */
  db: D1Database;
  /** User ID generating the report */
  userId: string;
}

/**
 * Generate an income statement report
 *
 * @param options Report generation options
 * @returns Income statement report
 */
export async function generateIncomeStatement(
  options: IncomeStatementOptions
): Promise<ExtendedIncomeStatementReport> {
  const {
    entityId,
    timeFrame,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    includeComparison = false,
    showPercentOfRevenue = true,
    includeTransactionDetails = false,
    includeOperatingSubtotals = true,
    currencyCode = "USD",
    db,
    userId,
  } = options;

  // 1. Fetch transaction totals for all relevant account types
  const transactionTotals = await getTransactionTotals({
    entityId,
    startDate,
    endDate,
    accountTypes: [...REVENUE_ACCOUNT_TYPES, ...EXPENSE_ACCOUNT_TYPES],
    db,
  });

  // 2. If comparison is requested, fetch previous period data
  let previousTotals: TransactionSummary[] = [];
  if (includeComparison && previousStartDate && previousEndDate) {
    previousTotals = await getTransactionTotals({
      entityId,
      startDate: previousStartDate,
      endDate: previousEndDate,
      accountTypes: [...REVENUE_ACCOUNT_TYPES, ...EXPENSE_ACCOUNT_TYPES],
      db,
    });
  }

  // 3. Fetch account information for categorization
  const accounts = await getAccountsByType({
    entityId,
    types: [...REVENUE_ACCOUNT_TYPES, ...EXPENSE_ACCOUNT_TYPES],
    db,
  });

  // 4. Create an account lookup map for easier access
  const accountMap = new Map<string, any>();
  accounts.forEach((account: any) => {
    accountMap.set(account.id, account);
  });

  // 5. Process revenue section
  const { items: revenueItems, total: totalRevenue } = processRevenueSection(
    transactionTotals,
    previousTotals,
    accountMap,
    includeComparison,
    showPercentOfRevenue
  );

  // 6. Process expense section with potentially multiple categories
  const expenseSections = processExpenseSection(
    transactionTotals,
    previousTotals,
    accountMap,
    includeComparison,
    showPercentOfRevenue,
    totalRevenue,
    includeOperatingSubtotals
  );

  // 7. Calculate total expenses
  const totalExpenses = expenseSections.total;

  // 8. Calculate net income
  const netIncome = totalRevenue - totalExpenses;

  // Calculate percentage of revenue for net income
  let netIncomePercentOfRevenue = null;
  if (showPercentOfRevenue && totalRevenue !== 0) {
    netIncomePercentOfRevenue = (netIncome / totalRevenue) * 100;
  }

  // Calculate comparison data for net income
  let previousNetIncome = null;
  let netIncomePercentChange = null;

  if (includeComparison && previousTotals.length > 0) {
    const previousRevenueTotals = previousTotals.filter(
      (t: TransactionSummary) =>
        REVENUE_ACCOUNT_TYPES.includes(accountMap.get(t.accountId)?.type)
    );
    const previousExpenseTotals = previousTotals.filter(
      (t: TransactionSummary) =>
        EXPENSE_ACCOUNT_TYPES.includes(accountMap.get(t.accountId)?.type)
    );

    const prevRevenue = previousRevenueTotals.reduce(
      (sum: number, t: TransactionSummary) => sum + t.total,
      0
    );
    const prevExpenses = previousExpenseTotals.reduce(
      (sum: number, t: TransactionSummary) => sum + t.total,
      0
    );
    previousNetIncome = prevRevenue - prevExpenses;

    if (previousNetIncome !== 0) {
      netIncomePercentChange =
        ((netIncome - previousNetIncome) / Math.abs(previousNetIncome)) * 100;
    } else if (netIncome !== 0) {
      netIncomePercentChange = 100;
    }
  }

  // 9. Generate the report
  const report: ExtendedIncomeStatementReport = {
    id: crypto.randomUUID(),
    type: "income-statement",
    title: `Income Statement - ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
    timeFrame: timeFrame,
    entityId: entityId,
    generatedAt: new Date().toISOString(),
    generatedBy: userId,
    version: "1.0",
    finalized: false,
    revenue: {
      items: revenueItems as ReportLineItem[],
      total: totalRevenue,
    },
    expenses: {
      items: expenseSections.items as ReportLineItem[],
      total: totalExpenses,
    },
    netIncome: netIncome,
    showPercentOfRevenue: showPercentOfRevenue,
    transactions: includeTransactionDetails
      ? transactionTotals.map((t: TransactionSummary) => ({
          accountId: t.accountId,
          count: t.count,
          total: t.total,
          type: accountMap.get(t.accountId)?.type || "UNKNOWN",
        }))
      : undefined,
  };

  // Add metadata for net income comparison
  if (includeComparison && previousNetIncome !== null) {
    report.netIncomePreviousPeriod = previousNetIncome;
    report.netIncomePercentChange = netIncomePercentChange;
  }

  if (showPercentOfRevenue) {
    report.netIncomePercentOfRevenue = netIncomePercentOfRevenue;
  }

  // Add additional sections if operating subtotals are included
  if (includeOperatingSubtotals) {
    report.grossProfit = expenseSections.grossProfit;
    report.operatingIncome = expenseSections.operatingIncome;
    report.incomeBeforeTax = expenseSections.incomeBeforeTax;
  }

  return report;
}

/**
 * Process the revenue section of the income statement
 */
function processRevenueSection(
  transactionTotals: TransactionSummary[],
  previousTotals: TransactionSummary[],
  accountMap: Map<string, any>,
  includeComparison: boolean,
  showPercentOfRevenue: boolean
): { items: ExtendedReportLineItem[]; total: number } {
  // Filter to only revenue accounts
  const revenueTotals = transactionTotals.filter((total) =>
    REVENUE_ACCOUNT_TYPES.includes(accountMap.get(total.accountId)?.type)
  );

  // Create a map for previous period totals
  const previousTotalMap = new Map<string, number>();
  if (includeComparison) {
    previousTotals
      .filter((total) =>
        REVENUE_ACCOUNT_TYPES.includes(accountMap.get(total.accountId)?.type)
      )
      .forEach((total) => {
        previousTotalMap.set(total.accountId, total.total);
      });
  }

  // Process revenue accounts
  const revenueItems: ExtendedReportLineItem[] = [];
  let totalRevenue = 0;

  revenueTotals.forEach((total) => {
    const account = accountMap.get(total.accountId);
    if (!account) return;

    totalRevenue += total.total;

    const lineItem: ExtendedReportLineItem = {
      accountId: total.accountId,
      code: account.code || "",
      name: account.name,
      amount: total.total,
      order: account.displayOrder || 0,
    };

    // Add comparison data if available
    if (includeComparison) {
      const previousAmount = previousTotalMap.get(total.accountId) || 0;
      lineItem.previousAmount = previousAmount;
      lineItem.percentChange =
        previousAmount !== 0
          ? ((total.total - previousAmount) / Math.abs(previousAmount)) * 100
          : total.total !== 0
            ? 100
            : 0;
    }

    revenueItems.push(lineItem);
  });

  // Sort revenue items by account code or order
  revenueItems.sort(
    (a, b) => a.order - b.order || a.code.localeCompare(b.code)
  );

  // Calculate percent of revenue for each item
  if (showPercentOfRevenue && totalRevenue !== 0) {
    revenueItems.forEach((item) => {
      item.percentOfRevenue = (item.amount / totalRevenue) * 100;
    });
  }

  // Add total revenue line
  revenueItems.push({
    code: "TOTAL_REVENUE",
    name: "Total Revenue",
    amount: totalRevenue,
    isCalculated: true,
    order: 999,
    styleClass: "total",
    percentOfRevenue: showPercentOfRevenue ? 100 : undefined,
  });

  return {
    items: revenueItems,
    total: totalRevenue,
  };
}

/**
 * Process the expense section of the income statement
 */
function processExpenseSection(
  transactionTotals: TransactionSummary[],
  previousTotals: TransactionSummary[],
  accountMap: Map<string, any>,
  includeComparison: boolean,
  showPercentOfRevenue: boolean,
  totalRevenue: number,
  includeOperatingSubtotals: boolean
): {
  items: ExtendedReportLineItem[];
  total: number;
  grossProfit?: number;
  operatingIncome?: number;
  incomeBeforeTax?: number;
} {
  // Filter to only expense accounts
  const expenseTotals = transactionTotals.filter((total) =>
    EXPENSE_ACCOUNT_TYPES.includes(accountMap.get(total.accountId)?.type)
  );

  // Create a map for previous period totals
  const previousTotalMap = new Map<string, number>();
  if (includeComparison) {
    previousTotals
      .filter((total) =>
        EXPENSE_ACCOUNT_TYPES.includes(accountMap.get(total.accountId)?.type)
      )
      .forEach((total) => {
        previousTotalMap.set(total.accountId, total.total);
      });
  }

  // Process expense accounts, potentially grouped by category
  const expenseItems: ExtendedReportLineItem[] = [];
  const cogsItems: ExtendedReportLineItem[] = [];
  const operatingExpenseItems: ExtendedReportLineItem[] = [];
  const nonOperatingExpenseItems: ExtendedReportLineItem[] = [];
  const taxExpenseItems: ExtendedReportLineItem[] = [];

  let totalCOGS = 0;
  let totalOperatingExpenses = 0;
  let totalNonOperatingExpenses = 0;
  let totalTaxExpenses = 0;
  let totalExpenses = 0;

  // Process each expense
  expenseTotals.forEach((total) => {
    const account = accountMap.get(total.accountId);
    if (!account) return;

    const lineItem: ExtendedReportLineItem = {
      accountId: total.accountId,
      code: account.code || "",
      name: account.name,
      amount: total.total,
      order: account.displayOrder || 0,
    };

    // Calculate percent of revenue
    if (showPercentOfRevenue && totalRevenue !== 0) {
      lineItem.percentOfRevenue = (total.total / totalRevenue) * 100;
    }

    // Add comparison data if available
    if (includeComparison) {
      const previousAmount = previousTotalMap.get(total.accountId) || 0;
      lineItem.previousAmount = previousAmount;
      lineItem.percentChange =
        previousAmount !== 0
          ? ((total.total - previousAmount) / Math.abs(previousAmount)) * 100
          : total.total !== 0
            ? 100
            : 0;
    }

    // Track total expenses
    totalExpenses += total.total;

    // Categorize expenses if operating subtotals are requested
    if (includeOperatingSubtotals) {
      if (COGS_ACCOUNT_TYPES.includes(account.type)) {
        cogsItems.push(lineItem);
        totalCOGS += total.total;
      } else if (OPERATING_EXPENSE_TYPES.includes(account.type)) {
        operatingExpenseItems.push(lineItem);
        totalOperatingExpenses += total.total;
      } else if (NON_OPERATING_EXPENSE_TYPES.includes(account.type)) {
        nonOperatingExpenseItems.push(lineItem);
        totalNonOperatingExpenses += total.total;
      } else if (TAX_EXPENSE_TYPES.includes(account.type)) {
        taxExpenseItems.push(lineItem);
        totalTaxExpenses += total.total;
      } else {
        // For any other expense types
        expenseItems.push(lineItem);
      }
    } else {
      // If not categorizing, just add to the main list
      expenseItems.push(lineItem);
    }
  });

  // Sort expense items by account code or order
  expenseItems.sort(
    (a, b) => a.order - b.order || a.code.localeCompare(b.code)
  );

  // If operating subtotals are included, build a structured expense section
  if (includeOperatingSubtotals) {
    // Sort the categorized lists
    cogsItems.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
    operatingExpenseItems.sort(
      (a, b) => a.order - b.order || a.code.localeCompare(b.code)
    );
    nonOperatingExpenseItems.sort(
      (a, b) => a.order - b.order || a.code.localeCompare(b.code)
    );
    taxExpenseItems.sort(
      (a, b) => a.order - b.order || a.code.localeCompare(b.code)
    );

    // Calculate key metrics
    const grossProfit = totalRevenue - totalCOGS;
    const operatingIncome = grossProfit - totalOperatingExpenses;
    const incomeBeforeTax = operatingIncome - totalNonOperatingExpenses;

    // Add COGS items with subtotal
    if (cogsItems.length > 0) {
      expenseItems.push({
        code: "COGS_HEADER",
        name: "Cost of Goods Sold",
        amount: 0,
        isHeader: true,
        order: 100,
        styleClass: "header",
      });

      expenseItems.push(...cogsItems);

      expenseItems.push({
        code: "TOTAL_COGS",
        name: "Total Cost of Goods Sold",
        amount: totalCOGS,
        isCalculated: true,
        order: 199,
        styleClass: "subtotal",
        percentOfRevenue:
          showPercentOfRevenue && totalRevenue !== 0
            ? (totalCOGS / totalRevenue) * 100
            : undefined,
      });

      // Add Gross Profit line
      expenseItems.push({
        code: "GROSS_PROFIT",
        name: "Gross Profit",
        amount: grossProfit,
        isCalculated: true,
        order: 200,
        styleClass: "total-highlight",
        percentOfRevenue:
          showPercentOfRevenue && totalRevenue !== 0
            ? (grossProfit / totalRevenue) * 100
            : undefined,
      });
    }

    // Add Operating Expenses with subtotal
    if (operatingExpenseItems.length > 0) {
      expenseItems.push({
        code: "OPERATING_EXPENSES_HEADER",
        name: "Operating Expenses",
        amount: 0,
        isHeader: true,
        order: 300,
        styleClass: "header",
      });

      expenseItems.push(...operatingExpenseItems);

      expenseItems.push({
        code: "TOTAL_OPERATING_EXPENSES",
        name: "Total Operating Expenses",
        amount: totalOperatingExpenses,
        isCalculated: true,
        order: 399,
        styleClass: "subtotal",
        percentOfRevenue:
          showPercentOfRevenue && totalRevenue !== 0
            ? (totalOperatingExpenses / totalRevenue) * 100
            : undefined,
      });

      // Add Operating Income line
      expenseItems.push({
        code: "OPERATING_INCOME",
        name: "Operating Income",
        amount: operatingIncome,
        isCalculated: true,
        order: 400,
        styleClass: "total-highlight",
        percentOfRevenue:
          showPercentOfRevenue && totalRevenue !== 0
            ? (operatingIncome / totalRevenue) * 100
            : undefined,
      });
    }

    // Add Non-Operating Expenses with subtotal
    if (nonOperatingExpenseItems.length > 0) {
      expenseItems.push({
        code: "NON_OPERATING_EXPENSES_HEADER",
        name: "Non-Operating Expenses",
        amount: 0,
        isHeader: true,
        order: 500,
        styleClass: "header",
      });

      expenseItems.push(...nonOperatingExpenseItems);

      expenseItems.push({
        code: "TOTAL_NON_OPERATING_EXPENSES",
        name: "Total Non-Operating Expenses",
        amount: totalNonOperatingExpenses,
        isCalculated: true,
        order: 599,
        styleClass: "subtotal",
        percentOfRevenue:
          showPercentOfRevenue && totalRevenue !== 0
            ? (totalNonOperatingExpenses / totalRevenue) * 100
            : undefined,
      });

      // Add Income Before Tax line
      expenseItems.push({
        code: "INCOME_BEFORE_TAX",
        name: "Income Before Tax",
        amount: incomeBeforeTax,
        isCalculated: true,
        order: 600,
        styleClass: "total-highlight",
        percentOfRevenue:
          showPercentOfRevenue && totalRevenue !== 0
            ? (incomeBeforeTax / totalRevenue) * 100
            : undefined,
      });
    }

    // Add Tax Expenses with subtotal
    if (taxExpenseItems.length > 0) {
      expenseItems.push({
        code: "TAX_EXPENSES_HEADER",
        name: "Tax Expenses",
        amount: 0,
        isHeader: true,
        order: 700,
        styleClass: "header",
      });

      expenseItems.push(...taxExpenseItems);

      expenseItems.push({
        code: "TOTAL_TAX_EXPENSES",
        name: "Total Tax Expenses",
        amount: totalTaxExpenses,
        isCalculated: true,
        order: 799,
        styleClass: "subtotal",
        percentOfRevenue:
          showPercentOfRevenue && totalRevenue !== 0
            ? (totalTaxExpenses / totalRevenue) * 100
            : undefined,
      });
    }

    return {
      items: expenseItems,
      total: totalExpenses,
      grossProfit,
      operatingIncome,
      incomeBeforeTax,
    };
  } else {
    // Simple approach: just add the total line
    expenseItems.push({
      code: "TOTAL_EXPENSES",
      name: "Total Expenses",
      amount: totalExpenses,
      isCalculated: true,
      order: 999,
      styleClass: "total",
      percentOfRevenue:
        showPercentOfRevenue && totalRevenue !== 0
          ? (totalExpenses / totalRevenue) * 100
          : undefined,
    });

    return {
      items: expenseItems,
      total: totalExpenses,
    };
  }
}

/**
 * Format an income statement report for display
 *
 * @param report Income statement report to format
 * @param currencyCode Currency code to use for formatting
 * @returns Formatted income statement report
 */
export function formatIncomeStatement(
  report: ExtendedIncomeStatementReport,
  currencyCode = "USD"
): ExtendedIncomeStatementReport {
  // Create a deep copy to avoid modifying the original
  const formattedReport = JSON.parse(
    JSON.stringify(report)
  ) as ExtendedIncomeStatementReport;

  // Format revenue amounts
  formattedReport.revenue.items.forEach((item: ExtendedReportLineItem) => {
    item.formattedAmount = formatCurrency(item.amount, currencyCode);
    if (item.previousAmount !== undefined) {
      item.formattedPreviousAmount = formatCurrency(
        item.previousAmount,
        currencyCode
      );
    }
    if (item.percentChange !== undefined) {
      item.formattedPercentChange = `${item.percentChange.toFixed(2)}%`;
    }
    if (item.percentOfRevenue !== undefined) {
      item.formattedPercentOfRevenue = formatPercent(
        item.percentOfRevenue / 100
      );
    }
  });

  // Format expense amounts
  formattedReport.expenses.items.forEach((item: ExtendedReportLineItem) => {
    item.formattedAmount = formatCurrency(item.amount, currencyCode);
    if (item.previousAmount !== undefined) {
      item.formattedPreviousAmount = formatCurrency(
        item.previousAmount,
        currencyCode
      );
    }
    if (item.percentChange !== undefined) {
      item.formattedPercentChange = `${item.percentChange.toFixed(2)}%`;
    }
    if (item.percentOfRevenue !== undefined) {
      item.formattedPercentOfRevenue = formatPercent(
        item.percentOfRevenue / 100
      );
    }
  });

  // Format the net income
  formattedReport.formattedNetIncome = formatCurrency(
    formattedReport.netIncome,
    currencyCode
  );

  if (formattedReport.netIncomePreviousPeriod !== undefined) {
    formattedReport.formattedNetIncomePreviousPeriod = formatCurrency(
      formattedReport.netIncomePreviousPeriod,
      currencyCode
    );
  }

  if (formattedReport.netIncomePercentChange !== undefined) {
    formattedReport.formattedNetIncomePercentChange = `${formattedReport.netIncomePercentChange.toFixed(2)}%`;
  }

  if (formattedReport.netIncomePercentOfRevenue !== undefined) {
    formattedReport.formattedNetIncomePercentOfRevenue = formatPercent(
      formattedReport.netIncomePercentOfRevenue / 100
    );
  }

  // Format subtotals if present
  if (formattedReport.grossProfit !== undefined) {
    formattedReport.formattedGrossProfit = formatCurrency(
      formattedReport.grossProfit,
      currencyCode
    );
  }

  if (formattedReport.operatingIncome !== undefined) {
    formattedReport.formattedOperatingIncome = formatCurrency(
      formattedReport.operatingIncome,
      currencyCode
    );
  }

  if (formattedReport.incomeBeforeTax !== undefined) {
    formattedReport.formattedIncomeBeforeTax = formatCurrency(
      formattedReport.incomeBeforeTax,
      currencyCode
    );
  }

  return formattedReport;
}

/**
 * Calculate key financial ratios from an income statement
 *
 * @param incomeStatement Income statement report
 * @param balanceSheet Optional balance sheet to calculate additional ratios
 * @returns Object containing financial ratios
 */
export function calculateIncomeStatementRatios(
  incomeStatement: ExtendedIncomeStatementReport,
  balanceSheet?: any // Typing as any since we don't need full BalanceSheetReport type
): Record<string, number | undefined> {
  // Calculate totals
  const totalRevenue = incomeStatement.revenue.total;
  const totalExpenses = incomeStatement.expenses.total;
  const netIncome = incomeStatement.netIncome;

  // Find specific subtotals if available
  const grossProfit =
    incomeStatement.grossProfit ||
    totalRevenue - findCOGSTotal(incomeStatement.expenses.items);

  const operatingIncome = incomeStatement.operatingIncome || undefined;

  // Calculate basic ratios
  const grossProfitMargin =
    totalRevenue !== 0 ? grossProfit / totalRevenue : undefined;

  const netProfitMargin =
    totalRevenue !== 0 ? netIncome / totalRevenue : undefined;

  const operatingProfitMargin =
    totalRevenue !== 0 && operatingIncome !== undefined
      ? operatingIncome / totalRevenue
      : undefined;

  // Calculate ROI ratios if balance sheet is available
  let roa = undefined;
  let roe = undefined;

  if (balanceSheet) {
    const totalAssets = balanceSheet.assets?.total;
    const totalEquity = balanceSheet.equity?.total;

    if (totalAssets && totalAssets !== 0) {
      roa = netIncome / totalAssets;
    }

    if (totalEquity && totalEquity !== 0) {
      roe = netIncome / totalEquity;
    }
  }

  return {
    grossProfitMargin,
    operatingProfitMargin,
    netProfitMargin,
    returnOnAssets: roa,
    returnOnEquity: roe,
    // Additional ratios could be added here
  };
}

/**
 * Helper function to find COGS total from expense items
 */
function findCOGSTotal(expenseItems: ReportLineItem[]): number {
  const cogsItem = expenseItems.find((item) => item.code === "TOTAL_COGS");
  return cogsItem ? cogsItem.amount : 0;
}

/**
 * Generate a comparative income statement showing changes between periods
 *
 * @param currentPeriod Current period income statement
 * @param previousPeriod Previous period income statement
 * @returns Comparative income statement with changes
 */
export function generateComparativeIncomeStatement(
  currentPeriod: IncomeStatementReport,
  previousPeriod: IncomeStatementReport
): any {
  // Implementation would merge the two reports and calculate changes
  // This is a placeholder for the functionality

  return {
    // Comparative data structure
  };
}

export default {
  generateIncomeStatement,
  formatIncomeStatement,
  calculateIncomeStatementRatios,
  generateComparativeIncomeStatement,
};
