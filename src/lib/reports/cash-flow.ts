// src/lib/reports/cash-flow.ts
/**
 * Cash Flow Statement Generator
 * 
 * This module generates cash flow statements based on account balances and transactions
 * for a specified entity and time period, using either the direct or indirect method.
 */

// Update to type-only imports
import type { CashFlowReport, ReportLineItem, ReportTimeFrame, AccountBalance } from '../../types/report';
import { getAccountBalances, getTransactionTotals, getChangeInAccountBalances, getAccountsByType } from '../accounting/accounting-api';
import { formatCurrency } from '../../utils/format';
import type { D1Database } from '@cloudflare/workers-types';


/**
 * Cash flow statement method types
 */
export type CashFlowMethod = 'DIRECT' | 'INDIRECT';

/**
 * Account type categories for the cash flow statement
 */
const CASH_ACCOUNT_TYPES = ['BANK', 'CASH'];
const OPERATING_ASSET_TYPES = ['ACCOUNTS_RECEIVABLE', 'INVENTORY', 'PREPAID_EXPENSE', 'OTHER_CURRENT_ASSET'];
const OPERATING_LIABILITY_TYPES = ['ACCOUNTS_PAYABLE', 'UNEARNED_REVENUE', 'ACCRUED_LIABILITY', 'OTHER_CURRENT_LIABILITY'];
const INVESTING_ASSET_TYPES = ['FIXED_ASSET', 'INVESTMENT', 'INTANGIBLE_ASSET', 'OTHER_ASSET'];
const FINANCING_LIABILITY_TYPES = ['LONG_TERM_LIABILITY', 'LOAN', 'NOTE_PAYABLE'];
const FINANCING_EQUITY_TYPES = ['EQUITY', 'COMMON_STOCK', 'PREFERRED_STOCK', 'RETAINED_EARNINGS', 'TREASURY_STOCK', 'PARTNER_EQUITY', 'OWNER_EQUITY'];
const NON_CASH_EXPENSE_TYPES = ['DEPRECIATION', 'AMORTIZATION', 'BAD_DEBT'];

/**
 * Extended interfaces for cash flow formatting properties
 */
interface OperatingActivitiesSection {
  netIncome: number;
  adjustments: ReportLineItem[];
  changesInWorkingCapital: ReportLineItem[];
  netCash: number;
  formattedNetIncome?: string;
  formattedNetCash?: string;
}

interface InvestingActivitiesSection {
  items: ReportLineItem[];
  netCash: number;
  formattedNetCash?: string;
}

interface FinancingActivitiesSection {
  items: ReportLineItem[];
  netCash: number;
  formattedNetCash?: string;
}

/**
 * Options for generating a cash flow statement
 */
export interface CashFlowOptions {
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
  /** Method to use for cash flow (direct or indirect) */
  method?: CashFlowMethod;
  /** Whether to include comparative data */
  includeComparison?: boolean;
  /** Whether to include transaction details */
  includeTransactionDetails?: boolean;
  /** Net income for the period (if already calculated) */
  netIncome?: number;
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
 * Generate a cash flow statement
 * 
 * @param options Report generation options
 * @returns Cash flow statement report
 */
export async function generateCashFlow(options: CashFlowOptions): Promise<CashFlowReport> {
  const {
    entityId,
    timeFrame,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    method = 'INDIRECT',
    includeComparison = false,
    includeTransactionDetails = false,
    netIncome,
    currencyCode = 'USD',
    db,
    userId
  } = options;

  // 1. Get starting and ending cash balances
  const startingBalances = await getAccountBalances({
    entityId,
    asOfDate: startDate,
    accountTypes: CASH_ACCOUNT_TYPES,
    db
  });

  const endingBalances = await getAccountBalances({
    entityId,
    asOfDate: endDate,
    accountTypes: CASH_ACCOUNT_TYPES,
    db
  });

  // Calculate beginning and ending cash
  const beginningCash = startingBalances.reduce((sum: number, balance: AccountBalance) => sum + balance.balance, 0);
  const endingCash = endingBalances.reduce((sum: number, balance: AccountBalance) => sum + balance.balance, 0);

  // 2. Get account information for all accounts needed for cash flow
  const allAccountTypes = [
    ...CASH_ACCOUNT_TYPES,
    ...OPERATING_ASSET_TYPES,
    ...OPERATING_LIABILITY_TYPES,
    ...INVESTING_ASSET_TYPES,
    ...FINANCING_LIABILITY_TYPES,
    ...FINANCING_EQUITY_TYPES,
    ...NON_CASH_EXPENSE_TYPES
  ];

  const accounts = await getAccountsByType({
    entityId,
    types: allAccountTypes,
    db
  });

  // 3. Create an account lookup map for easier access
  const accountMap = new Map<string, any>();
  accounts.forEach((account: any) => {
    accountMap.set(account.id, account);
  });

  // 4. Get transaction totals for the period if using direct method
  let transactionTotals: any[] = [];
  if (method === 'DIRECT' || includeTransactionDetails) {
    transactionTotals = await getTransactionTotals({
      entityId,
      startDate,
      endDate,
      accountTypes: allAccountTypes,
      db
    });
  }

  // 5. Get changes in account balances for the period
  const accountChanges = await getChangeInAccountBalances({
    entityId,
    startDate,
    endDate,
    accountTypes: allAccountTypes,
    db
  });

  // 6. Calculate or use provided net income
  let calculatedNetIncome = netIncome;
  if (calculatedNetIncome === undefined) {
    // Simple approximation of net income if not provided
    // In a real implementation, you'd likely want to use the income statement's result
    const incomeTotals = await getTransactionTotals({
      entityId,
      startDate,
      endDate,
      accountTypes: ['REVENUE', 'INCOME', 'EXPENSE', 'COST_OF_GOODS_SOLD'],
      db
    });

    const revenues = incomeTotals
      .filter((t: any) => ['REVENUE', 'INCOME'].includes(accountMap.get(t.accountId)?.type))
      .reduce((sum: number, t: any) => sum + t.total, 0);

    const expenses = incomeTotals
      .filter((t: any) => ['EXPENSE', 'COST_OF_GOODS_SOLD'].includes(accountMap.get(t.accountId)?.type))
      .reduce((sum: number, t: any) => sum + t.total, 0);

    calculatedNetIncome = revenues - expenses;
  }

  // 7. Generate the cash flow statement based on the method
  let operatingActivities: OperatingActivitiesSection;
  if (method === 'INDIRECT') {
    operatingActivities = processOperatingActivitiesIndirect(
      calculatedNetIncome,
      accountChanges,
      accountMap,
      transactionTotals
    );
  } else {
    operatingActivities = processOperatingActivitiesDirect(
      transactionTotals,
      accountMap
    );
  }

  // 8. Process investing activities
  const investingActivities = processInvestingActivities(
    accountChanges,
    transactionTotals,
    accountMap
  );

  // 9. Process financing activities
  const financingActivities = processFinancingActivities(
    accountChanges,
    transactionTotals,
    accountMap
  );

  // 10. Calculate net increase/decrease in cash
  const netIncrease = 
    operatingActivities.netCash + 
    investingActivities.netCash + 
    financingActivities.netCash;

  // 11. Generate the report
  const report: CashFlowReport = {
    id: crypto.randomUUID(),
    type: 'cash-flow',
    title: `Cash Flow Statement - ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`,
    timeFrame: timeFrame,
    entityId: entityId,
    generatedAt: new Date().toISOString(),
    generatedBy: userId,
    version: '1.0',
    finalized: false,

    operatingActivities: operatingActivities,
    investingActivities: investingActivities,
    financingActivities: financingActivities,

    netIncrease: netIncrease,
    beginningCash: beginningCash,
    endingCash: endingCash
  };

  // Add metadata about the method used
  (report as any).method = method;

  // 12. Validate that the cash flow statement reconciles
  const calculatedEndingCash = beginningCash + netIncrease;
  const isReconciled = Math.abs(calculatedEndingCash - endingCash) < 0.01; // Allow for small rounding errors

  if (!isReconciled) {
    console.warn(`Cash flow statement doesn't reconcile. Beginning Cash: ${beginningCash}, Net Increase: ${netIncrease}, Calculated Ending: ${calculatedEndingCash}, Actual Ending: ${endingCash}, Difference: ${calculatedEndingCash - endingCash}`);
    (report as any).reconcileDifference = calculatedEndingCash - endingCash;
  }

  return report;
}

/**
 * Process operating activities section using the indirect method
 * (starting with net income and adjusting for non-cash items and changes in working capital)
 */
function processOperatingActivitiesIndirect(
  netIncome: number,
  accountChanges: any[],
  accountMap: Map<string, any>,
  transactionTotals: any[]
): OperatingActivitiesSection {
  // Initialize sections
  const adjustments: ReportLineItem[] = [];
  const changesInWorkingCapital: ReportLineItem[] = [];
  
  // 1. Process non-cash expense adjustments (add back)
  let nonCashAdjustments = 0;
  
  // Extract depreciation and amortization from transaction totals
  if (transactionTotals && transactionTotals.length > 0) {
    const nonCashExpenses = transactionTotals.filter(total => {
      const account = accountMap.get(total.accountId);
      return account && NON_CASH_EXPENSE_TYPES.includes(account.type);
    });
    
    nonCashExpenses.forEach(expense => {
      const account = accountMap.get(expense.accountId);
      
      adjustments.push({
        code: account.code || '',
        name: account.name,
        amount: expense.total,
        order: account.displayOrder || 0
      });
      
      nonCashAdjustments += expense.total;
    });
  }
  
  // 2. Process changes in working capital
  let workingCapitalChange = 0;
  
  // Filter for operating assets and liabilities
  const operatingAssetChanges = accountChanges.filter(change => {
    const account = accountMap.get(change.accountId);
    return account && OPERATING_ASSET_TYPES.includes(account.type);
  });
  
  const operatingLiabilityChanges = accountChanges.filter(change => {
    const account = accountMap.get(change.accountId);
    return account && OPERATING_LIABILITY_TYPES.includes(account.type);
  });
  
  // Process operating asset changes (increase is negative cash flow, decrease is positive)
  operatingAssetChanges.forEach(change => {
    const account = accountMap.get(change.accountId);
    const changeAmount = change.endingBalance - change.startingBalance;
    
    // For assets, an increase (positive) means cash used, so we negate
    const cashFlowEffect = -changeAmount;
    
    changesInWorkingCapital.push({
      code: account.code || '',
      name: `Change in ${account.name}`,
      amount: cashFlowEffect,
      order: account.displayOrder || 0
    });
    
    workingCapitalChange += cashFlowEffect;
  });
  
  // Process operating liability changes (increase is positive cash flow, decrease is negative)
  operatingLiabilityChanges.forEach(change => {
    const account = accountMap.get(change.accountId);
    const changeAmount = change.endingBalance - change.startingBalance;
    
    // For liabilities, an increase (positive) means cash source, so we keep as is
    changesInWorkingCapital.push({
      code: account.code || '',
      name: `Change in ${account.name}`,
      amount: changeAmount,
      order: account.displayOrder || 0
    });
    
    workingCapitalChange += changeAmount;
  });
  
  // Sort both arrays by account code or order
  adjustments.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
  changesInWorkingCapital.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
  
  // Calculate net cash from operating activities
  const netCashFromOperations = netIncome + nonCashAdjustments + workingCapitalChange;
  
  return {
    netIncome,
    adjustments,
    changesInWorkingCapital,
    netCash: netCashFromOperations
  };
}

/**
 * Process operating activities section using the direct method
 * (showing actual cash inflows and outflows from operations)
 */
function processOperatingActivitiesDirect(
  transactionTotals: any[],
  accountMap: Map<string, any>
): OperatingActivitiesSection {
  // Initialize cash receipts and payments
  const cashReceipts: ReportLineItem[] = [];
  const cashPayments: ReportLineItem[] = [];
  
  // Filter for cash transactions in revenue and expense accounts
  const operatingTransactions = transactionTotals.filter(total => {
    const account = accountMap.get(total.accountId);
    return account && [
      'REVENUE', 'INCOME', 'EXPENSE', 'COST_OF_GOODS_SOLD', 
      'ACCOUNTS_RECEIVABLE', 'ACCOUNTS_PAYABLE', 'UNEARNED_REVENUE'
    ].includes(account.type);
  });
  
  let totalReceipts = 0;
  let totalPayments = 0;
  
  // Process transactions by category
  operatingTransactions.forEach(transaction => {
    const account = accountMap.get(transaction.accountId);
    
    if (['REVENUE', 'INCOME', 'UNEARNED_REVENUE'].includes(account.type)) {
      // Cash receipts - positive impact on cash flow
      cashReceipts.push({
        code: account.code || '',
        name: `Cash receipts from ${account.name}`,
        amount: transaction.total,
        order: account.displayOrder || 0
      });
      
      totalReceipts += transaction.total;
    } 
    else if (['EXPENSE', 'COST_OF_GOODS_SOLD'].includes(account.type)) {
      // Cash payments - negative impact on cash flow
      cashPayments.push({
        code: account.code || '',
        name: `Cash payments for ${account.name}`,
        amount: -transaction.total, // Negate expenses to show as negative cash flow
        order: account.displayOrder || 0
      });
      
      totalPayments -= transaction.total;
    }
    // Special handling for AR/AP transactions would be more complex in a real implementation
  });
  
  // Sort both arrays by account code or order
  cashReceipts.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
  cashPayments.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
  
  // Combine receipts and payments into single list
  const allItems = [
    ...cashReceipts,
    {
      code: 'TOTAL_RECEIPTS',
      name: 'Total Cash Receipts',
      amount: totalReceipts,
      isCalculated: true,
      order: 100,
      styleClass: 'subtotal'
    },
    ...cashPayments,
    {
      code: 'TOTAL_PAYMENTS',
      name: 'Total Cash Payments',
      amount: totalPayments,
      isCalculated: true,
      order: 200,
      styleClass: 'subtotal'
    }
  ];
  
  // Calculate net cash from operating activities
  const netCashFromOperations = totalReceipts + totalPayments;
  
  return {
    netIncome: netCashFromOperations, // For direct method, there's no net income starting point
    adjustments: [], // No adjustments in direct method
    changesInWorkingCapital: allItems, // We use this array to store all direct method items
    netCash: netCashFromOperations
  };
}

/**
 * Process investing activities section
 */
function processInvestingActivities(
  accountChanges: any[],
  transactionTotals: any[],
  accountMap: Map<string, any>
): InvestingActivitiesSection {
  // Initialize investing activities items
  const investingItems: ReportLineItem[] = [];
  let netInvestingCash = 0;
  
  // Filter for investing asset accounts
  const investingAssetChanges = accountChanges.filter(change => {
    const account = accountMap.get(change.accountId);
    return account && INVESTING_ASSET_TYPES.includes(account.type);
  });
  
  // Process investing asset changes
  investingAssetChanges.forEach(change => {
    const account = accountMap.get(change.accountId);
    const changeAmount = change.endingBalance - change.startingBalance;
    
    // For investing assets, an increase (positive) means cash used, so we negate
    const cashFlowEffect = -changeAmount;
    
    // Name the item based on whether it's an acquisition or disposal
    const name = cashFlowEffect > 0 
      ? `Disposal/reduction of ${account.name}` 
      : `Purchase/addition of ${account.name}`;
    
    investingItems.push({
      code: account.code || '',
      name,
      amount: cashFlowEffect,
      order: account.displayOrder || 0
    });
    
    netInvestingCash += cashFlowEffect;
  });
  
  // Sort investing items by account code or order
  investingItems.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
  
  // Add total line
  investingItems.push({
    code: 'NET_CASH_INVESTING',
    name: 'Net Cash from Investing Activities',
    amount: netInvestingCash,
    isCalculated: true,
    order: 999,
    styleClass: 'total'
  });
  
  return {
    items: investingItems,
    netCash: netInvestingCash
  };
}

/**
 * Process financing activities section
 */
function processFinancingActivities(
  accountChanges: any[],
  transactionTotals: any[],
  accountMap: Map<string, any>
): FinancingActivitiesSection {
  // Initialize financing activities items
  const financingItems: ReportLineItem[] = [];
  let netFinancingCash = 0;
  
  // Filter for financing liability and equity accounts
  const financingLiabilityChanges = accountChanges.filter(change => {
    const account = accountMap.get(change.accountId);
    return account && FINANCING_LIABILITY_TYPES.includes(account.type);
  });
  
  const financingEquityChanges = accountChanges.filter(change => {
    const account = accountMap.get(change.accountId);
    return account && FINANCING_EQUITY_TYPES.includes(account.type);
  });
  
  // Process financing liability changes
  financingLiabilityChanges.forEach(change => {
    const account = accountMap.get(change.accountId);
    const changeAmount = change.endingBalance - change.startingBalance;
    
    // For financing liabilities, an increase (positive) means cash source
    // Name the item based on whether it's an increase or decrease
    const name = changeAmount > 0 
      ? `Proceeds from ${account.name}` 
      : `Repayment of ${account.name}`;
    
    financingItems.push({
      code: account.code || '',
      name,
      amount: changeAmount,
      order: account.displayOrder || 0
    });
    
    netFinancingCash += changeAmount;
  });
  
  // Process financing equity changes
  financingEquityChanges.forEach(change => {
    const account = accountMap.get(change.accountId);
    // Exclude retained earnings as they're affected by net income, not financing activities
    if (account.type === 'RETAINED_EARNINGS') return;
    
    const changeAmount = change.endingBalance - change.startingBalance;
    
    // For equity accounts, an increase might be from issuance of stock or owner contributions
    // A decrease might be dividends, distributions, or treasury stock purchases
    let name: string;
    
    if (account.type === 'COMMON_STOCK' || account.type === 'PREFERRED_STOCK') {
      name = changeAmount > 0 
        ? `Issuance of ${account.name}` 
        : `Repurchase of ${account.name}`;
    } 
    else if (account.type === 'TREASURY_STOCK') {
      // Treasury stock increases (more negative) is cash outflow
      name = changeAmount < 0 
        ? `Purchase of treasury stock` 
        : `Sale of treasury stock`;
      // Reverse the sign for treasury stock as it's a contra-equity account
      // Fix: Don't reassign to constant
      const adjustedChangeAmount = -changeAmount;
      
      financingItems.push({
        code: account.code || '',
        name,
        amount: adjustedChangeAmount, // Use adjusted amount
        order: account.displayOrder || 0
      });
      
      netFinancingCash += adjustedChangeAmount; // Use adjusted amount
      return; // Skip the later push since we've already added the item
    } 
    else {
      name = changeAmount > 0 
        ? `Increase in ${account.name}` 
        : `Decrease in ${account.name}`;
    }
    
    financingItems.push({
      code: account.code || '',
      name,
      amount: changeAmount,
      order: account.displayOrder || 0
    });
    
    netFinancingCash += changeAmount;
  });
  
  // Sort financing items by account code or order
  financingItems.sort((a, b) => a.order - b.order || a.code.localeCompare(b.code));
  
  // Add total line
  financingItems.push({
    code: 'NET_CASH_FINANCING',
    name: 'Net Cash from Financing Activities',
    amount: netFinancingCash,
    isCalculated: true,
    order: 999,
    styleClass: 'total'
  });
  
  return {
    items: financingItems,
    netCash: netFinancingCash
  };
}

/**
 * Format a cash flow statement report for display
 * 
 * @param report Cash flow statement to format
 * @param currencyCode Currency code to use for formatting
 * @returns Formatted cash flow statement
 */
export function formatCashFlow(report: CashFlowReport, currencyCode = 'USD'): CashFlowReport & {
  formattedNetIncrease?: string;
  formattedBeginningCash?: string;
  formattedEndingCash?: string;
} {
  // Create a deep copy to avoid modifying the original
  const formattedReport = JSON.parse(JSON.stringify(report)) as CashFlowReport & {
    formattedNetIncrease?: string;
    formattedBeginningCash?: string;
    formattedEndingCash?: string;
  };
  
  // Format operating activities
  (formattedReport.operatingActivities as OperatingActivitiesSection).formattedNetIncome = formatCurrency(
    formattedReport.operatingActivities.netIncome, 
    currencyCode
  );
  
  formattedReport.operatingActivities.adjustments.forEach(item => {
    item.formattedAmount = formatCurrency(item.amount, currencyCode);
  });
  
  formattedReport.operatingActivities.changesInWorkingCapital.forEach(item => {
    item.formattedAmount = formatCurrency(item.amount, currencyCode);
  });
  
  (formattedReport.operatingActivities as OperatingActivitiesSection).formattedNetCash = formatCurrency(
    formattedReport.operatingActivities.netCash, 
    currencyCode
  );
  
  // Format investing activities
  formattedReport.investingActivities.items.forEach(item => {
    item.formattedAmount = formatCurrency(item.amount, currencyCode);
  });
  
  (formattedReport.investingActivities as InvestingActivitiesSection).formattedNetCash = formatCurrency(
    formattedReport.investingActivities.netCash, 
    currencyCode
  );
  
  // Format financing activities
  formattedReport.financingActivities.items.forEach(item => {
    item.formattedAmount = formatCurrency(item.amount, currencyCode);
  });
  
  (formattedReport.financingActivities as FinancingActivitiesSection).formattedNetCash = formatCurrency(
    formattedReport.financingActivities.netCash, 
    currencyCode
  );
  
  // Format summary amounts
  formattedReport.formattedNetIncrease = formatCurrency(
    formattedReport.netIncrease, 
    currencyCode
  );
  
  formattedReport.formattedBeginningCash = formatCurrency(
    formattedReport.beginningCash, 
    currencyCode
  );
  
  formattedReport.formattedEndingCash = formatCurrency(
    formattedReport.endingCash, 
    currencyCode
  );
  
  return formattedReport;
}

/**
 * Calculate free cash flow from operating and investing activities
 * 
 * @param report Cash flow statement report
 * @returns Free cash flow amount
 */
export function calculateFreeCashFlow(report: CashFlowReport): number {
  // Free cash flow = Cash from operations - Capital expenditures
  
  // Get cash from operations
  const cashFromOperations = report.operatingActivities.netCash;
  
  // Find capital expenditures in investing activities
  // This is a simplification - in reality you'd need to identify specific capital expenditure items
  const capEx = report.investingActivities.items
    .filter(item => item.name.toLowerCase().includes('purchase') || 
                    item.name.toLowerCase().includes('acquisition') ||
                    item.name.toLowerCase().includes('addition'))
    .reduce((sum, item) => sum + Math.min(0, item.amount), 0); // Only sum negative amounts
  
  // Calculate free cash flow (absolute value of capEx since we're recording it as negative)
  return cashFromOperations + capEx;
}

/**
 * Calculate key cash flow ratios
 * 
 * @param cashFlow Cash flow statement report
 * @param incomeStatement Optional income statement to calculate additional ratios
 * @param balanceSheet Optional balance sheet to calculate additional ratios
 * @returns Object containing cash flow ratios
 */
export function calculateCashFlowRatios(
  cashFlow: CashFlowReport,
  incomeStatement?: any,
  balanceSheet?: any
): Record<string, number | undefined> {
  // Basic cash flow metrics
  const operatingCashFlow = cashFlow.operatingActivities.netCash;
  const freeCashFlow = calculateFreeCashFlow(cashFlow);
  
  // Initialize ratios
  const ratios: Record<string, number | undefined> = {
    cashFlowToDebt: undefined,
    cashFlowCoverage: undefined,
    operatingCashFlowRatio: undefined,
    freeCashFlowYield: undefined,
    cashFlowToCapex: undefined,
    cashFlowToRevenue: undefined
  };
  
  // Calculate ratios that need just the cash flow statement
  if (cashFlow.investingActivities) {
    const capEx = cashFlow.investingActivities.items
      .filter(item => item.name.toLowerCase().includes('purchase') || 
                      item.name.toLowerCase().includes('acquisition') ||
                      item.name.toLowerCase().includes('addition'))
      .reduce((sum, item) => sum + Math.abs(Math.min(0, item.amount)), 0);
    
    if (capEx !== 0) {
      ratios.cashFlowToCapex = operatingCashFlow / capEx;
    }
  }
  
  // If income statement is available, calculate related ratios
  if (incomeStatement && incomeStatement.revenue && incomeStatement.revenue.total) {
    const revenue = incomeStatement.revenue.total;
    ratios.cashFlowToRevenue = operatingCashFlow / revenue;
    
    if (incomeStatement.netIncome) {
      ratios.operatingCashFlowToNetIncome = operatingCashFlow / incomeStatement.netIncome;
    }
  }
  
  // If balance sheet is available, calculate related ratios
  if (balanceSheet) {
    // Calculate cash flow to debt ratio
    if (balanceSheet.liabilities && balanceSheet.liabilities.total) {
      const totalDebt = balanceSheet.liabilities.total;
      if (totalDebt !== 0) {
        ratios.cashFlowToDebt = operatingCashFlow / totalDebt;
      }
    }
    
    // Calculate operating cash flow ratio
    if (balanceSheet.liabilities && 
        balanceSheet.liabilities.current && 
        balanceSheet.liabilities.current.length > 0) {
      
      const currentLiabilities = balanceSheet.liabilities.current;
      const totalCurrentLiabilities = currentLiabilities[currentLiabilities.length - 1].amount;
      
      if (totalCurrentLiabilities !== 0) {
        ratios.operatingCashFlowRatio = operatingCashFlow / totalCurrentLiabilities;
      }
    }
    
    // Calculate free cash flow yield if market cap is available
    if ((balanceSheet as any).marketCap) {
      const marketCap = (balanceSheet as any).marketCap;
      ratios.freeCashFlowYield = (freeCashFlow / marketCap) * 100;
    }
  }
  
  return ratios;
}

export default {
  generateCashFlow,
  formatCashFlow,
  calculateFreeCashFlow,
  calculateCashFlowRatios
};