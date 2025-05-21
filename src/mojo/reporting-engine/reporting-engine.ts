// src/lib/mojo/reporting-engine/reporting-engine.ts
/**
 * JavaScript adapter for the Mojo reporting engine WebAssembly module.
 * Provides GAAP-compliant financial reporting with fallbacks to JavaScript.
 */

import Decimal from "decimal.js";
import { initMojoModule, MojoModule } from "../common/loader";
import { getFeatureFlags } from "../feature-flags";

// Module state
let mojoReportingEngine: MojoModule | null = null;
let initializing = false;
let initializationError: Error | null = null;

// Report types
export enum ReportType {
  BALANCE_SHEET = 0,
  INCOME_STATEMENT = 1,
  CASH_FLOW = 2,
  TAX_SUMMARY = 3,
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance?: string | number;
  tax_deductible?: boolean;
}

interface Transaction {
  id: string;
  date: string;
  description?: string;
  lines: Array<{
    account_id: string;
    amount: string | number;
    is_debit: boolean;
  }>;
}

interface BalanceSheetParams {
  date: string;
}

interface IncomeStatementParams {
  start_date: string;
  end_date: string;
}

interface CashFlowParams {
  start_date: string;
  end_date: string;
}

interface TaxSummaryParams {
  year: number | string;
}

type ReportParams =
  | BalanceSheetParams
  | IncomeStatementParams
  | CashFlowParams
  | TaxSummaryParams;

/**
 * Initialize the reporting engine
 */
export async function initReportingEngine(forceJS = false): Promise<boolean> {
  // Check if Mojo should be used
  const { useMojoReportingEngine } = getFeatureFlags();

  if (!useMojoReportingEngine || forceJS) {
    console.log("Using JavaScript implementation for Reporting Engine");
    return false;
  }

  // Prevent multiple initialization attempts
  if (mojoReportingEngine?.isInitialized) return true;
  if (initializing) return false;

  initializing = true;

  try {
    mojoReportingEngine = await initMojoModule("reporting-engine");
    console.log("Mojo Reporting Engine initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize Mojo Reporting Engine:", error);
    initializationError =
      error instanceof Error ? error : new Error(String(error));
    return false;
  } finally {
    initializing = false;
  }
}

/**
 * Generate a financial report
 */
export async function generateReport(
  reportType: ReportType,
  accounts: Record<string, Account>,
  transactions: Transaction[],
  params: ReportParams
): Promise<any> {
  // Try to use Mojo implementation
  try {
    if (await initReportingEngine()) {
      const result = mojoReportingEngine!.exports.generate_report(
        reportType,
        JSON.stringify(accounts),
        JSON.stringify(transactions),
        JSON.stringify(params)
      );
      return JSON.parse(result);
    }
  } catch (error) {
    console.warn("Mojo report generation failed, falling back to JS:", error);
  }

  // Fallback to JavaScript implementation based on report type
  switch (reportType) {
    case ReportType.BALANCE_SHEET:
      return generateBalanceSheetJS(
        accounts,
        (params as BalanceSheetParams).date
      );

    case ReportType.INCOME_STATEMENT:
      return generateIncomeStatementJS(
        accounts,
        transactions,
        (params as IncomeStatementParams).start_date,
        (params as IncomeStatementParams).end_date
      );

    case ReportType.CASH_FLOW:
      return generateCashFlowReportJS(
        accounts,
        transactions,
        (params as CashFlowParams).start_date,
        (params as CashFlowParams).end_date
      );

    case ReportType.TAX_SUMMARY:
      return generateTaxSummaryJS(
        accounts,
        transactions,
        Number((params as TaxSummaryParams).year)
      );

    default:
      throw new Error("Unknown report type");
  }
}

/**
 * Generate a balance sheet report (JavaScript implementation)
 */
function generateBalanceSheetJS(
  accounts: Record<string, Account>,
  date: string
): any {
  const assets: any[] = [];
  const liabilities: any[] = [];
  const equity: any[] = [];

  let totalAssets = new Decimal(0);
  let totalLiabilities = new Decimal(0);
  let totalEquity = new Decimal(0);

  // Categorize accounts and calculate totals
  Object.entries(accounts).forEach(([accountId, account]) => {
    const accountType = account.type || "";
    const balance = new Decimal(account.balance || 0);

    const accountData = {
      id: accountId,
      name: account.name || "",
      balance: balance.toString(),
    };

    if (accountType === "asset") {
      assets.push(accountData);
      totalAssets = totalAssets.plus(balance);
    } else if (accountType === "liability") {
      liabilities.push(accountData);
      totalLiabilities = totalLiabilities.plus(balance);
    } else if (accountType === "equity") {
      equity.push(accountData);
      totalEquity = totalEquity.plus(balance);
    }
  });

  // Check if balance sheet is balanced
  const isBalanced = totalAssets.equals(totalLiabilities.plus(totalEquity));
  const variance = isBalanced
    ? new Decimal(0)
    : totalAssets.minus(totalLiabilities.plus(totalEquity));

  // Sort account sections by name
  assets.sort((a, b) => a.name.localeCompare(b.name));
  liabilities.sort((a, b) => a.name.localeCompare(b.name));
  equity.sort((a, b) => a.name.localeCompare(b.name));

  return {
    report_type: "balance_sheet",
    date,
    assets,
    liabilities,
    equity,
    total_assets: totalAssets.toString(),
    total_liabilities: totalLiabilities.toString(),
    total_equity: totalEquity.toString(),
    is_balanced: isBalanced,
    variance: variance.toString(),
  };
}

/**
 * Generate an income statement report (JavaScript implementation)
 */
function generateIncomeStatementJS(
  accounts: Record<string, Account>,
  transactions: Transaction[],
  startDate: string,
  endDate: string
): any {
  const revenueAccounts: any[] = [];
  const expenseAccounts: any[] = [];

  // Find revenue and expense accounts
  Object.entries(accounts).forEach(([accountId, account]) => {
    const accountType = account.type || "";

    if (accountType === "revenue") {
      revenueAccounts.push({
        id: accountId,
        name: account.name || "",
        balance: "0", // Will be calculated from transactions
      });
    } else if (accountType === "expense") {
      expenseAccounts.push({
        id: accountId,
        name: account.name || "",
        balance: "0", // Will be calculated from transactions
      });
    }
  });

  // Calculate account balances for the period
  const accountBalances: Record<string, Decimal> = {};

  // Initialize account balances to zero
  Object.keys(accounts).forEach((accountId) => {
    accountBalances[accountId] = new Decimal(0);
  });

  // Process transactions within date range
  transactions.forEach((transaction) => {
    const date = transaction.date || "";

    // Skip transactions outside date range
    if (date < startDate || date > endDate) {
      return;
    }

    const lines = transaction.lines || [];

    lines.forEach((line) => {
      const accountId = line.account_id;
      const amount = new Decimal(line.amount || 0);
      const isDebit = line.is_debit;

      const accountType = accounts[accountId]?.type || "";

      // Skip accounts that are not revenue or expense
      if (accountType !== "revenue" && accountType !== "expense") {
        return;
      }

      // For revenue: credit increases, debit decreases
      // For expense: debit increases, credit decreases
      if (accountType === "revenue") {
        if (isDebit) {
          accountBalances[accountId] = accountBalances[accountId].minus(amount);
        } else {
          accountBalances[accountId] = accountBalances[accountId].plus(amount);
        }
      } else if (accountType === "expense") {
        if (isDebit) {
          accountBalances[accountId] = accountBalances[accountId].plus(amount);
        } else {
          accountBalances[accountId] = accountBalances[accountId].minus(amount);
        }
      }
    });
  });

  // Update account balances and calculate totals
  let totalRevenue = new Decimal(0);
  let totalExpenses = new Decimal(0);

  revenueAccounts.forEach((account) => {
    const balance = accountBalances[account.id] || new Decimal(0);
    account.balance = balance.toString();
    totalRevenue = totalRevenue.plus(balance);
  });

  expenseAccounts.forEach((account) => {
    const balance = accountBalances[account.id] || new Decimal(0);
    account.balance = balance.toString();
    totalExpenses = totalExpenses.plus(balance);
  });

  const netIncome = totalRevenue.minus(totalExpenses);

  // Sort account sections by name
  revenueAccounts.sort((a, b) => a.name.localeCompare(b.name));
  expenseAccounts.sort((a, b) => a.name.localeCompare(b.name));

  return {
    report_type: "income_statement",
    start_date: startDate,
    end_date: endDate,
    revenue: revenueAccounts,
    expenses: expenseAccounts,
    total_revenue: totalRevenue.toString(),
    total_expenses: totalExpenses.toString(),
    net_income: netIncome.toString(),
  };
}

/**
 * Generate a cash flow report (JavaScript implementation)
 */
function generateCashFlowReportJS(
  accounts: Record<string, Account>,
  transactions: Transaction[],
  startDate: string,
  endDate: string
): any {
  // Identify cash accounts
  const cashAccountIds: string[] = [];
  Object.entries(accounts).forEach(([accountId, account]) => {
    if (
      account.type === "asset" &&
      account.name.toLowerCase().includes("cash")
    ) {
      cashAccountIds.push(accountId);
    }
  });

  // Calculate opening and closing balances
  const openingBalances: Record<string, Decimal> = {};
  const closingBalances: Record<string, Decimal> = {};

  cashAccountIds.forEach((accountId) => {
    openingBalances[accountId] = new Decimal(0);
    closingBalances[accountId] = new Decimal(0);
  });

  // Process all transactions to determine balances
  transactions.forEach((transaction) => {
    const date = transaction.date || "";
    const lines = transaction.lines || [];

    lines.forEach((line) => {
      const accountId = line.account_id;

      // Skip if not a cash account
      if (!cashAccountIds.includes(accountId)) {
        return;
      }

      const amount = new Decimal(line.amount || 0);
      const isDebit = line.is_debit;

      // Update balances
      if (date < startDate) {
        // Affects opening balance
        if (isDebit) {
          openingBalances[accountId] = openingBalances[accountId].plus(amount);
        } else {
          openingBalances[accountId] = openingBalances[accountId].minus(amount);
        }
      }

      // All transactions up to end date affect closing balance
      if (date <= endDate) {
        if (isDebit) {
          closingBalances[accountId] = closingBalances[accountId].plus(amount);
        } else {
          closingBalances[accountId] = closingBalances[accountId].minus(amount);
        }
      }
    });
  });

  // Categorize cash flows
  const operating: any[] = [];
  const investing: any[] = [];
  const financing: any[] = [];

  let totalOperating = new Decimal(0);
  let totalInvesting = new Decimal(0);
  let totalFinancing = new Decimal(0);

  // Process transactions within date range
  transactions.forEach((transaction) => {
    const date = transaction.date || "";

    // Skip transactions outside date range
    if (date < startDate || date > endDate) {
      return;
    }

    const description = transaction.description || "";
    const lines = transaction.lines || [];
    let cashImpact = new Decimal(0);

    // Calculate net cash impact
    lines.forEach((line) => {
      const accountId = line.account_id;

      // If this line affects a cash account
      if (cashAccountIds.includes(accountId)) {
        const amount = new Decimal(line.amount || 0);
        const isDebit = line.is_debit;

        if (isDebit) {
          cashImpact = cashImpact.plus(amount);
        } else {
          cashImpact = cashImpact.minus(amount);
        }
      }
    });

    // Skip if no cash impact
    if (cashImpact.isZero()) {
      return;
    }

    // Categorize by examining non-cash accounts in the transaction
    let category = "operating"; // Default

    for (const line of lines) {
      const accountId = line.account_id;

      // Skip cash accounts for categorization
      if (cashAccountIds.includes(accountId)) {
        continue;
      }

      const account = accounts[accountId] || {};
      const accountType = account.type || "";
      const accountName = (account.name || "").toLowerCase();

      // Categorize based on account type and name
      if (
        accountType === "asset" &&
        (accountName.includes("equipment") || accountName.includes("property"))
      ) {
        category = "investing";
        break;
      } else if (accountType === "liability" && accountName.includes("loan")) {
        category = "financing";
        break;
      } else if (
        accountType === "equity" &&
        (accountName.includes("capital") || accountName.includes("draw"))
      ) {
        category = "financing";
        break;
      }
    }

    // Add to appropriate category
    const cashFlowItem = {
      date,
      description,
      amount: cashImpact.toString(),
    };

    if (category === "operating") {
      operating.push(cashFlowItem);
      totalOperating = totalOperating.plus(cashImpact);
    } else if (category === "investing") {
      investing.push(cashFlowItem);
      totalInvesting = totalInvesting.plus(cashImpact);
    } else if (category === "financing") {
      financing.push(cashFlowItem);
      totalFinancing = totalFinancing.plus(cashImpact);
    }
  });

  // Calculate totals
  const totalCashAccounts: any[] = [];
  let totalOpening = new Decimal(0);
  let totalClosing = new Decimal(0);
  let totalChange = new Decimal(0);

  cashAccountIds.forEach((accountId) => {
    const accountName = accounts[accountId]?.name || "";
    const opening = openingBalances[accountId] || new Decimal(0);
    const closing = closingBalances[accountId] || new Decimal(0);
    const change = closing.minus(opening);

    totalOpening = totalOpening.plus(opening);
    totalClosing = totalClosing.plus(closing);
    totalChange = totalChange.plus(change);

    totalCashAccounts.push({
      id: accountId,
      name: accountName,
      opening_balance: opening.toString(),
      closing_balance: closing.toString(),
      change: change.toString(),
    });
  });

  const totalCashFlow = totalOperating
    .plus(totalInvesting)
    .plus(totalFinancing);
  const reconciliation = totalChange.minus(totalCashFlow);

  // Sort cash flow categories by date
  operating.sort((a, b) => a.date.localeCompare(b.date));
  investing.sort((a, b) => a.date.localeCompare(b.date));
  financing.sort((a, b) => a.date.localeCompare(b.date));

  return {
    report_type: "cash_flow",
    start_date: startDate,
    end_date: endDate,
    cash_accounts: totalCashAccounts,
    total_opening_balance: totalOpening.toString(),
    total_closing_balance: totalClosing.toString(),
    total_change: totalChange.toString(),
    operating_activities: operating,
    investing_activities: investing,
    financing_activities: financing,
    total_operating: totalOperating.toString(),
    total_investing: totalInvesting.toString(),
    total_financing: totalFinancing.toString(),
    total_cash_flow: totalCashFlow.toString(),
    reconciliation_variance: reconciliation.toString(),
  };
}

/**
 * Generate a tax summary report (JavaScript implementation)
 */
function generateTaxSummaryJS(
  accounts: Record<string, Account>,
  transactions: Transaction[],
  year: number
): any {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Generate income statement for the year
  const incomeStatement = generateIncomeStatementJS(
    accounts,
    transactions,
    startDate,
    endDate
  );

  // Extract tax-relevant information
  const revenueItems = incomeStatement.revenue;
  const expenseItems = incomeStatement.expenses;

  const taxableIncome = new Decimal(incomeStatement.net_income);

  // Identify tax-deductible expenses
  const deductibleExpenses: any[] = [];
  let totalDeductible = new Decimal(0);

  expenseItems.forEach((expense) => {
    const expenseId = expense.id;
    const account = accounts[expenseId] || {};
    const taxDeductible = account.tax_deductible !== false; // Default to true

    if (taxDeductible) {
      deductibleExpenses.push(expense);
      totalDeductible = totalDeductible.plus(new Decimal(expense.balance));
    }
  });

  // Calculate depreciation
  let depreciationExpense = new Decimal(0);
  expenseItems.forEach((expense) => {
    const name = (expense.name || "").toLowerCase();
    if (name.includes("depreciation")) {
      depreciationExpense = depreciationExpense.plus(
        new Decimal(expense.balance)
      );
    }
  });

  // Generate tax summary
  return {
    report_type: "tax_summary",
    year,
    total_revenue: incomeStatement.total_revenue,
    deductible_expenses: deductibleExpenses,
    total_deductible_expenses: totalDeductible.toString(),
    depreciation_expense: depreciationExpense.toString(),
    taxable_income: taxableIncome.toString(),
  };
}
