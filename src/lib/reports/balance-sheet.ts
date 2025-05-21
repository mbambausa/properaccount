// src/lib/reports/balance-sheet.ts
/**
 * Balance Sheet Report Generator
 *
 * This module generates balance sheet reports based on account balances
 * for a specified entity and time period.
 */

// Use type-only imports for types when verbatimModuleSyntax is enabled
import type { BalanceSheetReport, ReportLineItem, ReportTimeFrame, AccountBalance } from '../../types/report';
// Update import paths to use our accounting-api
import { getAccountBalances, getAccountsByType } from '../accounting/accounting-api';
import { formatCurrency } from '../../utils/format';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Represents the structure of an Account.
 * It is recommended to define this in a central types file (e.g., src/types/accounting.d.ts)
 * and import it here. [cite: 1118]
 */
interface Account {
  id: string;
  code: string; // Or accountCode
  name: string; // Or accountName
  type: string; // Or accountType
  displayOrder?: number;
  // Add any other properties that getAccountsByType might return for an account
}


/**
 * Account type categories for the balance sheet
 */
const ASSET_ACCOUNT_TYPES = ['ASSET', 'CURRENT_ASSET', 'FIXED_ASSET', 'OTHER_ASSET', 'BANK', 'ACCOUNTS_RECEIVABLE', 'INVENTORY'];
const LIABILITY_ACCOUNT_TYPES = ['LIABILITY', 'CURRENT_LIABILITY', 'LONG_TERM_LIABILITY', 'OTHER_LIABILITY', 'ACCOUNTS_PAYABLE', 'CREDIT_CARD'];
const EQUITY_ACCOUNT_TYPES = ['EQUITY', 'RETAINED_EARNINGS', 'COMMON_STOCK', 'OWNER_EQUITY', 'PARTNER_EQUITY'];

/**
 * Current vs long-term categorization
 */
const CURRENT_ASSET_TYPES = ['CURRENT_ASSET', 'BANK', 'ACCOUNTS_RECEIVABLE', 'INVENTORY'];
const CURRENT_LIABILITY_TYPES = ['CURRENT_LIABILITY', 'ACCOUNTS_PAYABLE', 'CREDIT_CARD'];

/**
 * Options for generating a balance sheet report
 */
export interface BalanceSheetOptions {
  /** Entity ID to generate the report for */
  entityId: string;
  /** Time frame for the report */
  timeFrame: ReportTimeFrame;
  /** Date to generate balances as of */
  asOfDate: string;
  /** Previous period date for comparison (optional) */
  previousDate?: string;
  /** Whether to include comparative data */
  includeComparison?: boolean;
  /** Whether to include account details */
  includeAccountDetails?: boolean;
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
 * Generate a balance sheet report
 *
 * @param options Report generation options
 * @returns Balance sheet report
 */
export async function generateBalanceSheet(options: BalanceSheetOptions): Promise<BalanceSheetReport> {
  const {
    entityId,
    timeFrame,
    asOfDate,
    previousDate,
    includeComparison = false,
    includeAccountDetails = true,
    currencyCode = 'USD', // currencyCode is now used
    db,
    userId
  } = options;

  // 1. Fetch all relevant account balances
  const accountBalances: AccountBalance[] = await getAccountBalances({
    entityId,
    asOfDate,
    accountTypes: [...ASSET_ACCOUNT_TYPES, ...LIABILITY_ACCOUNT_TYPES, ...EQUITY_ACCOUNT_TYPES],
    db
  });

  // 2. If comparison is requested, fetch previous period balances
  let previousBalances: AccountBalance[] = [];
  if (includeComparison && previousDate) {
    previousBalances = await getAccountBalances({
      entityId,
      asOfDate: previousDate,
      accountTypes: [...ASSET_ACCOUNT_TYPES, ...LIABILITY_ACCOUNT_TYPES, ...EQUITY_ACCOUNT_TYPES],
      db
    });
  }

  // 3. Fetch account information for categorization
  // Ensure getAccountsByType returns Promise<Account[]>
  const accounts: Account[] = await getAccountsByType({
    entityId,
    types: [...ASSET_ACCOUNT_TYPES, ...LIABILITY_ACCOUNT_TYPES, ...EQUITY_ACCOUNT_TYPES],
    db
  });

  // 4. Create an account lookup map for easier access
  const accountMap = new Map<string, Account>(); // Typed the Map
  accounts.forEach((account: Account) => { // Explicitly type 'account'
    accountMap.set(account.id, account);
  });

  // 5. Process assets section
  const assets = processAssetSection(accountBalances, previousBalances, accountMap, includeComparison);

  // 6. Process liabilities section
  const liabilities = processLiabilitySection(accountBalances, previousBalances, accountMap, includeComparison);

  // 7. Process equity section
  const equity = processEquitySection(accountBalances, previousBalances, accountMap, includeComparison);

  // 8. Generate the report
  const report: BalanceSheetReport = {
    id: crypto.randomUUID(),
    type: 'balance-sheet',
    title: `Balance Sheet - ${new Date(asOfDate).toLocaleDateString()}`,
    timeFrame: timeFrame,
    entityId: entityId,
    generatedAt: new Date().toISOString(),
    generatedBy: userId,
    version: '1.0',
    finalized: false,
    assets: {
      current: assets.current,
      longTerm: assets.longTerm,
      total: assets.total
    },
    liabilities: {
      current: liabilities.current,
      longTerm: liabilities.longTerm,
      total: liabilities.total
    },
    equity: {
      items: equity.items,
      total: equity.total
    },
    currencyCode: currencyCode, // Added currencyCode to the report object
    accountBalances: includeAccountDetails ? accountBalances : []
  };

  // Verify the balance sheet equation: Assets = Liabilities + Equity
  const totalLiabilitiesAndEquity = liabilities.total + equity.total;
  const isBalanced = Math.abs(assets.total - totalLiabilitiesAndEquity) < 0.01; // Allow for small rounding errors

  if (!isBalanced) {
    console.warn(`Balance sheet equation doesn't balance. Assets: ${assets.total}, Liabilities + Equity: ${totalLiabilitiesAndEquity}, Difference: ${assets.total - totalLiabilitiesAndEquity}`);
  }

  return report;
}

/**
 * Process the asset section of the balance sheet
 */
function processAssetSection(
  accountBalances: AccountBalance[],
  previousBalances: AccountBalance[],
  accountMap: Map<string, Account>, // Use the Account type
  includeComparison: boolean
): { current: ReportLineItem[], longTerm: ReportLineItem[], total: number } {
  // Filter to only asset accounts
  const assetBalances = accountBalances.filter(balance => {
    const account = accountMap.get(balance.accountId);
    return account && ASSET_ACCOUNT_TYPES.includes(account.type);
  });

  // Create maps for current and previous balances for quick lookup
  const balanceMap = new Map<string, number>();
  assetBalances.forEach(balance => {
    balanceMap.set(balance.accountId, balance.balance);
  });

  const previousBalanceMap = new Map<string, number>();
  if (includeComparison) {
    previousBalances
      .filter(balance => {
        const account = accountMap.get(balance.accountId);
        return account && ASSET_ACCOUNT_TYPES.includes(account.type);
      })
      .forEach(balance => {
        previousBalanceMap.set(balance.accountId, balance.balance);
      });
  }

  // Separate accounts into current and long-term assets
  const currentAssets: ReportLineItem[] = [];
  const longTermAssets: ReportLineItem[] = [];

  // Process each asset account
  assetBalances.forEach(balance => {
    const account = accountMap.get(balance.accountId);
    if (!account) return;

    const lineItem: ReportLineItem = {
      accountId: balance.accountId,
      code: account.code || '',
      name: account.name,
      amount: balance.balance,
      order: account.displayOrder || 0
    };

    // Add comparison data if available
    if (includeComparison) {
      const previousBalanceValue = previousBalanceMap.get(balance.accountId) || 0;
      lineItem.previousAmount = previousBalanceValue;
      lineItem.percentChange = previousBalanceValue !== 0
        ? ((balance.balance - previousBalanceValue) / Math.abs(previousBalanceValue)) * 100
        : balance.balance !== 0 ? 100 : 0;
    }

    // Categorize as current or long-term asset
    if (CURRENT_ASSET_TYPES.includes(account.type)) {
      currentAssets.push(lineItem);
    } else {
      longTermAssets.push(lineItem);
    }
  });

  // Sort both arrays by account code or order
  currentAssets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.code.localeCompare(b.code));
  longTermAssets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.code.localeCompare(b.code));

  // Add subtotals for current assets
  const currentAssetsTotal = currentAssets.reduce((sum, asset) => sum + asset.amount, 0);
  if (currentAssets.length > 0) { // Add subtotal only if there are items
    currentAssets.push({
      code: 'TOTAL_CURRENT_ASSETS',
      name: 'Total Current Assets',
      amount: currentAssetsTotal,
      isCalculated: true,
      order: 999, // Ensure order is high enough for subtotal
      styleClass: 'subtotal'
    });
  }


  // Add subtotals for long-term assets
  const longTermAssetsTotal = longTermAssets.reduce((sum, asset) => sum + asset.amount, 0);
  if (longTermAssets.length > 0) { // Add subtotal only if there are items
    longTermAssets.push({
      code: 'TOTAL_LONG_TERM_ASSETS',
      name: 'Total Long-Term Assets',
      amount: longTermAssetsTotal,
      isCalculated: true,
      order: 999, // Ensure order is high enough for subtotal
      styleClass: 'subtotal'
    });
  }

  // Calculate the total assets
  const totalAssets = currentAssetsTotal + longTermAssetsTotal;

  return {
    current: currentAssets,
    longTerm: longTermAssets,
    total: totalAssets
  };
}

/**
 * Process the liability section of the balance sheet
 */
function processLiabilitySection(
  accountBalances: AccountBalance[],
  previousBalances: AccountBalance[],
  accountMap: Map<string, Account>, // Use the Account type
  includeComparison: boolean
): { current: ReportLineItem[], longTerm: ReportLineItem[], total: number } {
  // Filter to only liability accounts
  const liabilityBalances = accountBalances.filter(balance => {
    const account = accountMap.get(balance.accountId);
    return account && LIABILITY_ACCOUNT_TYPES.includes(account.type);
  });

  const balanceMap = new Map<string, number>();
  liabilityBalances.forEach(balance => {
    balanceMap.set(balance.accountId, balance.balance);
  });

  const previousBalanceMap = new Map<string, number>();
  if (includeComparison) {
    previousBalances
      .filter(balance => {
        const account = accountMap.get(balance.accountId);
        return account && LIABILITY_ACCOUNT_TYPES.includes(account.type);
      })
      .forEach(balance => {
        previousBalanceMap.set(balance.accountId, balance.balance);
      });
  }

  const currentLiabilities: ReportLineItem[] = [];
  const longTermLiabilities: ReportLineItem[] = [];

  liabilityBalances.forEach(balance => {
    const account = accountMap.get(balance.accountId);
    if (!account) return;

    const lineItem: ReportLineItem = {
      accountId: balance.accountId,
      code: account.code || '',
      name: account.name,
      amount: balance.balance, // Liabilities often have credit balances (negative in raw data)
                               // but are shown as positive on balance sheets. Assuming input `balance` is already correctly signed for display.
      order: account.displayOrder || 0
    };

    if (includeComparison) {
      const previousBalanceValue = previousBalanceMap.get(balance.accountId) || 0;
      lineItem.previousAmount = previousBalanceValue;
      lineItem.percentChange = previousBalanceValue !== 0
        ? ((balance.balance - previousBalanceValue) / Math.abs(previousBalanceValue)) * 100
        : balance.balance !== 0 ? 100 : 0;
    }

    if (CURRENT_LIABILITY_TYPES.includes(account.type)) {
      currentLiabilities.push(lineItem);
    } else {
      longTermLiabilities.push(lineItem);
    }
  });

  currentLiabilities.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.code.localeCompare(b.code));
  longTermLiabilities.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.code.localeCompare(b.code));

  const currentLiabilitiesTotal = currentLiabilities.reduce((sum, liability) => sum + liability.amount, 0);
  if (currentLiabilities.length > 0) {
    currentLiabilities.push({
      code: 'TOTAL_CURRENT_LIABILITIES',
      name: 'Total Current Liabilities',
      amount: currentLiabilitiesTotal,
      isCalculated: true,
      order: 999,
      styleClass: 'subtotal'
    });
  }

  const longTermLiabilitiesTotal = longTermLiabilities.reduce((sum, liability) => sum + liability.amount, 0);
  if (longTermLiabilities.length > 0) {
    longTermLiabilities.push({
      code: 'TOTAL_LONG_TERM_LIABILITIES',
      name: 'Total Long-Term Liabilities',
      amount: longTermLiabilitiesTotal,
      isCalculated: true,
      order: 999,
      styleClass: 'subtotal'
    });
  }

  const totalLiabilities = currentLiabilitiesTotal + longTermLiabilitiesTotal;

  return {
    current: currentLiabilities,
    longTerm: longTermLiabilities,
    total: totalLiabilities
  };
}

/**
 * Process the equity section of the balance sheet
 */
function processEquitySection(
  accountBalances: AccountBalance[],
  previousBalances: AccountBalance[],
  accountMap: Map<string, Account>, // Use the Account type
  includeComparison: boolean
): { items: ReportLineItem[], total: number } {
  const equityBalances = accountBalances.filter(balance => {
    const account = accountMap.get(balance.accountId);
    return account && EQUITY_ACCOUNT_TYPES.includes(account.type);
  });

  const balanceMap = new Map<string, number>();
  equityBalances.forEach(balance => {
    balanceMap.set(balance.accountId, balance.balance);
  });

  const previousBalanceMap = new Map<string, number>();
  if (includeComparison) {
    previousBalances
      .filter(balance => {
        const account = accountMap.get(balance.accountId);
        return account && EQUITY_ACCOUNT_TYPES.includes(account.type);
      })
      .forEach(balance => {
        previousBalanceMap.set(balance.accountId, balance.balance);
      });
  }

  const equityItems: ReportLineItem[] = [];

  equityBalances.forEach(balance => {
    const account = accountMap.get(balance.accountId);
    if (!account) return;

    const lineItem: ReportLineItem = {
      accountId: balance.accountId,
      code: account.code || '',
      name: account.name,
      amount: balance.balance, // Equity usually has credit balances. Similar to liabilities, assuming correct sign for display.
      order: account.displayOrder || 0
    };

    if (includeComparison) {
      const previousBalanceValue = previousBalanceMap.get(balance.accountId) || 0;
      lineItem.previousAmount = previousBalanceValue;
      lineItem.percentChange = previousBalanceValue !== 0
        ? ((balance.balance - previousBalanceValue) / Math.abs(previousBalanceValue)) * 100
        : balance.balance !== 0 ? 100 : 0;
    }

    equityItems.push(lineItem);
  });

  equityItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.code.localeCompare(b.code));

  const totalEquity = equityItems.reduce((sum, equity) => sum + equity.amount, 0);

  if (equityItems.length > 0) {
    equityItems.push({
      code: 'TOTAL_EQUITY',
      name: 'Total Equity',
      amount: totalEquity,
      isCalculated: true,
      order: 999,
      styleClass: 'subtotal'
    });
  }

  return {
    items: equityItems,
    total: totalEquity
  };
}

/**
 * Format a balance sheet report for display
 *
 * @param report Balance sheet report to format
 * @param currencyCode Currency code to use for formatting
 * @returns Formatted balance sheet report
 */
export function formatBalanceSheet(report: BalanceSheetReport, currencyCode?: string): BalanceSheetReport {
  // Create a deep copy to avoid modifying the original
  const formattedReport = JSON.parse(JSON.stringify(report)) as BalanceSheetReport;
  const resolvedCurrencyCode = currencyCode || formattedReport.currencyCode || 'USD';

  // Helper function to format items
  const formatLineItems = (items: ReportLineItem[]) => {
    items.forEach(item => {
      // Ensure item.formattedAmount etc. are assignable by checking if ReportLineItem includes them (which it does now)
      item.formattedAmount = formatCurrency(item.amount, resolvedCurrencyCode);
      if (item.previousAmount !== undefined) {
        item.formattedPreviousAmount = formatCurrency(item.previousAmount, resolvedCurrencyCode);
      }
      if (item.percentChange !== undefined) {
        item.formattedPercentChange = `${item.percentChange.toFixed(2)}%`;
      }
    });
  };

  // Format asset amounts
  formatLineItems(formattedReport.assets.current);
  formatLineItems(formattedReport.assets.longTerm);

  // Format liability amounts
  formatLineItems(formattedReport.liabilities.current);
  formatLineItems(formattedReport.liabilities.longTerm);

  // Format equity amounts
  formatLineItems(formattedReport.equity.items);

  return formattedReport;
}

/**
 * Calculate working capital from a balance sheet
 * (current assets - current liabilities)
 *
 * @param report Balance sheet report
 * @returns Working capital amount
 */
export function calculateWorkingCapital(report: BalanceSheetReport): number {
  const currentAssets = report.assets.current;
  // The subtotal line item is 'Total Current Assets'
  const totalCurrentAssetsItem = currentAssets.find(item => item.code === 'TOTAL_CURRENT_ASSETS');
  const totalCurrentAssets = totalCurrentAssetsItem ? totalCurrentAssetsItem.amount : currentAssets.filter(item => !item.isCalculated).reduce((sum, item) => sum + item.amount, 0);


  const currentLiabilities = report.liabilities.current;
  // The subtotal line item is 'Total Current Liabilities'
  const totalCurrentLiabilitiesItem = currentLiabilities.find(item => item.code === 'TOTAL_CURRENT_LIABILITIES');
  const totalCurrentLiabilities = totalCurrentLiabilitiesItem ? totalCurrentLiabilitiesItem.amount : currentLiabilities.filter(item => !item.isCalculated).reduce((sum, item) => sum + item.amount, 0);

  return totalCurrentAssets - totalCurrentLiabilities;
}

/**
 * Calculate key financial ratios from a balance sheet
 *
 * @param report Balance sheet report
 * @returns Object containing financial ratios (values can be number or undefined)
 */
export function calculateBalanceSheetRatios(report: BalanceSheetReport): Record<string, number | undefined> {
  const totalAssets = report.assets.total;
  const totalLiabilities = report.liabilities.total;
  const totalEquity = report.equity.total;

  const currentAssets = report.assets.current;
  const totalCurrentAssetsItem = currentAssets.find(item => item.code === 'TOTAL_CURRENT_ASSETS');
  const totalCurrentAssets = totalCurrentAssetsItem ? totalCurrentAssetsItem.amount : currentAssets.filter(item => !item.isCalculated).reduce((sum, item) => sum + item.amount, 0);


  const currentLiabilities = report.liabilities.current;
  const totalCurrentLiabilitiesItem = currentLiabilities.find(item => item.code === 'TOTAL_CURRENT_LIABILITIES');
  const totalCurrentLiabilities = totalCurrentLiabilitiesItem ? totalCurrentLiabilitiesItem.amount : currentLiabilities.filter(item => !item.isCalculated).reduce((sum, item) => sum + item.amount, 0);

  const currentRatio = totalCurrentLiabilities !== 0
    ? totalCurrentAssets / totalCurrentLiabilities
    : undefined;

  const debtToEquityRatio = totalEquity !== 0
    ? totalLiabilities / totalEquity
    : undefined;

  const debtRatio = totalAssets !== 0
    ? totalLiabilities / totalAssets
    : undefined;

  const equityRatio = totalAssets !== 0
    ? totalEquity / totalAssets
    : undefined;

  const workingCapital = totalCurrentAssets - totalCurrentLiabilities;

  return {
    currentRatio: currentRatio,
    quickRatio: undefined, // Would need inventory data (from AccountBalance or specific accounts) to calculate
    cashRatio: undefined,  // Would need cash data (from AccountBalance or specific accounts) to calculate
    debtToEquityRatio: debtToEquityRatio,
    debtRatio: debtRatio,
    equityRatio: equityRatio,
    workingCapital: workingCapital, // This is a number, consistent with Record<string, number | undefined>
  };
}

export default {
  generateBalanceSheet,
  formatBalanceSheet,
  calculateWorkingCapital,
  calculateBalanceSheetRatios
};