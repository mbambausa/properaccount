// src/lib/accounting/chartOfAccounts.ts

import type { AccountSystemType as AccountTypeFromSchema } from '@db/schema';
import type { ExpenseSubtype as TypeExpenseSubtype } from '../../types/account';

export interface ChartOfAccountsItemDefinition {
  code: string;
  name: string;
  type: AccountTypeFromSchema;
  subtype?: TypeExpenseSubtype | string | null;
  isRecoverable?: boolean;
  parentCode?: string | null;
  isControlAccount?: boolean;
  normalBalance: 'debit' | 'credit';
  description?: string | null;
}

export const defaultChartOfAccounts: ChartOfAccountsItemDefinition[] = [
  // == ASSETS (1000-1999) ==
  { code: '1000', name: 'Current Assets', type: 'asset' as AccountTypeFromSchema, normalBalance: 'debit', description: 'Top-level current assets category.' },
  { code: '1010', name: 'Cash and Cash Equivalents', type: 'asset' as AccountTypeFromSchema, parentCode: '1000', normalBalance: 'debit', description: 'Operating bank accounts, petty cash.' },
  { code: '1020', name: 'Checking Account', type: 'asset' as AccountTypeFromSchema, parentCode: '1010', normalBalance: 'debit' },
  { code: '1030', name: 'Savings Account', type: 'asset' as AccountTypeFromSchema, parentCode: '1010', normalBalance: 'debit' },
  { code: '1040', name: 'Petty Cash', type: 'asset' as AccountTypeFromSchema, parentCode: '1010', normalBalance: 'debit' },

  { code: '1100', name: 'Accounts Receivable', type: 'asset' as AccountTypeFromSchema, parentCode: '1000', isControlAccount: true, normalBalance: 'debit', description: 'Amounts due from tenants for rent.' },
  { code: '1110', name: 'Tenant Receivables', type: 'asset' as AccountTypeFromSchema, parentCode: '1100', normalBalance: 'debit' },

  { code: '1200', name: 'Prepaid Expenses', type: 'asset' as AccountTypeFromSchema, parentCode: '1000', normalBalance: 'debit', description: 'Expenses paid in advance, like insurance.' },
  { code: '1210', name: 'Prepaid Insurance', type: 'asset' as AccountTypeFromSchema, parentCode: '1200', normalBalance: 'debit' },

  { code: '1300', name: 'Security Deposits Held (Asset)', type: 'asset' as AccountTypeFromSchema, parentCode: '1000', normalBalance: 'debit', description: 'Cash held in a separate bank account for tenant security deposits. A corresponding liability exists.' },

  { code: '1500', name: 'Fixed Assets', type: 'asset' as AccountTypeFromSchema, normalBalance: 'debit', description: 'Long-term assets like land and buildings.' },
  { code: '1510', name: 'Land', type: 'asset' as AccountTypeFromSchema, parentCode: '1500', normalBalance: 'debit' },
  { code: '1520', name: 'Buildings', type: 'asset' as AccountTypeFromSchema, parentCode: '1500', normalBalance: 'debit' },
  { code: '1525', name: 'Accumulated Depreciation - Buildings', type: 'asset' as AccountTypeFromSchema, parentCode: '1520', normalBalance: 'credit', description: 'Contra-asset account for building depreciation.' },
  { code: '1530', name: 'Furniture and Fixtures', type: 'asset' as AccountTypeFromSchema, parentCode: '1500', normalBalance: 'debit' },
  { code: '1535', name: 'Accumulated Depreciation - Furniture', type: 'asset' as AccountTypeFromSchema, parentCode: '1530', normalBalance: 'credit', description: 'Contra-asset account.' },

  // == LIABILITIES (2000-2999) ==
  { code: '2000', name: 'Current Liabilities', type: 'liability' as AccountTypeFromSchema, normalBalance: 'credit', description: 'Short-term obligations.' },
  { code: '2010', name: 'Accounts Payable', type: 'liability' as AccountTypeFromSchema, parentCode: '2000', isControlAccount: true, normalBalance: 'credit', description: 'Amounts owed to suppliers and vendors.' },
  { code: '2100', name: 'Tenant Security Deposits (Liability)', type: 'liability' as AccountTypeFromSchema, parentCode: '2000', normalBalance: 'credit', description: 'Obligation to return security deposits to tenants.' },
  { code: '2200', name: 'Unearned Rent Revenue', type: 'liability' as AccountTypeFromSchema, parentCode: '2000', normalBalance: 'credit', description: 'Rent received from tenants in advance.' },
  { code: '2300', name: 'Property Taxes Payable', type: 'liability' as AccountTypeFromSchema, parentCode: '2000', normalBalance: 'credit' },
  { code: '2400', name: 'Accrued Expenses', type: 'liability' as AccountTypeFromSchema, parentCode: '2000', normalBalance: 'credit' },

  { code: '2500', name: 'Long-Term Liabilities', type: 'liability' as AccountTypeFromSchema, normalBalance: 'credit', description: 'Obligations due in more than one year.' },
  { code: '2510', name: 'Mortgage Payable', type: 'liability' as AccountTypeFromSchema, parentCode: '2500', normalBalance: 'credit' },
  { code: '2520', name: 'Notes Payable - Long Term', type: 'liability' as AccountTypeFromSchema, parentCode: '2500', normalBalance: 'credit' },

  // == EQUITY (3000-3999) ==
  { code: '3000', name: 'Equity', type: 'equity' as AccountTypeFromSchema, normalBalance: 'credit', description: "Owner's stake in the company." },
  { code: '3010', name: "Owner's Capital / Common Stock", type: 'equity' as AccountTypeFromSchema, parentCode: '3000', normalBalance: 'credit' },
  { code: '3020', name: "Owner's Draws / Dividends", type: 'equity' as AccountTypeFromSchema, parentCode: '3000', normalBalance: 'debit', description: 'Withdrawals by the owner or dividends paid (contra-equity).' },
  { code: '3030', name: 'Retained Earnings', type: 'equity' as AccountTypeFromSchema, parentCode: '3000', normalBalance: 'credit' }, // System Account

  // == INCOME / REVENUE (4000-4999) ==
  { code: '4000', name: 'Operating Revenue', type: 'income' as AccountTypeFromSchema, normalBalance: 'credit', description: 'Income from primary business activities.' },
  { code: '4010', name: 'Rental Income', type: 'income' as AccountTypeFromSchema, parentCode: '4000', normalBalance: 'credit' },
  { code: '4020', name: 'Late Fee Income', type: 'income' as AccountTypeFromSchema, parentCode: '4000', normalBalance: 'credit' },
  { code: '4030', name: 'Other Property Income', type: 'income' as AccountTypeFromSchema, parentCode: '4000', normalBalance: 'credit', description: 'e.g., laundry, parking fees.' },

  { code: '4500', name: 'Non-Operating Income', type: 'income' as AccountTypeFromSchema, normalBalance: 'credit', description: 'Income from secondary activities.' },
  { code: '4510', name: 'Interest Income', type: 'income' as AccountTypeFromSchema, parentCode: '4500', normalBalance: 'credit' },

  // == EXPENSES (5000-5999) ==
  { code: '5000', name: 'Property Operating Expenses', type: 'expense' as AccountTypeFromSchema, normalBalance: 'debit', description: 'Expenses directly related to property operations.' },
  { code: '5010', name: 'Property Management Fees', type: 'expense' as AccountTypeFromSchema, parentCode: '5000', subtype: 'non-recoverable' as TypeExpenseSubtype, isRecoverable: false, normalBalance: 'debit' },
  { code: '5011', name: 'Property Management Fees (Recoverable)', type: 'expense' as AccountTypeFromSchema, parentCode: '5000', subtype: 'recoverable' as TypeExpenseSubtype, isRecoverable: true, normalBalance: 'debit' },
  { code: '5020', name: 'Repairs and Maintenance', type: 'expense' as AccountTypeFromSchema, parentCode: '5000', subtype: 'non-recoverable' as TypeExpenseSubtype, isRecoverable: false, normalBalance: 'debit' },
  { code: '5021', name: 'Repairs and Maintenance (Recoverable)', type: 'expense' as AccountTypeFromSchema, parentCode: '5000', subtype: 'recoverable' as TypeExpenseSubtype, isRecoverable: true, normalBalance: 'debit' },
  { code: '5030', name: 'Utilities', type: 'expense' as AccountTypeFromSchema, parentCode: '5000', subtype: 'non-recoverable' as TypeExpenseSubtype, isRecoverable: false, normalBalance: 'debit' },
  { code: '5031', name: 'Utilities (Recoverable)', type: 'expense' as AccountTypeFromSchema, parentCode: '5000', subtype: 'recoverable' as TypeExpenseSubtype, isRecoverable: true, normalBalance: 'debit' },
  { code: '5040', name: 'Property Insurance', type: 'expense' as AccountTypeFromSchema, parentCode: '5000', normalBalance: 'debit' },
  { code: '5050', name: 'Property Taxes', type: 'expense' as AccountTypeFromSchema, parentCode: '5000', normalBalance: 'debit' },

  { code: '5100', name: 'General & Administrative Expenses', type: 'expense' as AccountTypeFromSchema, normalBalance: 'debit', description: 'Overhead expenses.' },
  { code: '5110', name: 'Bank Service Charges', type: 'expense' as AccountTypeFromSchema, parentCode: '5100', normalBalance: 'debit' },
  { code: '5120', name: 'Office Supplies & Software', type: 'expense' as AccountTypeFromSchema, parentCode: '5100', normalBalance: 'debit' },
  { code: '5130', name: 'Professional Fees', type: 'expense' as AccountTypeFromSchema, parentCode: '5100', normalBalance: 'debit', description: 'Legal, accounting, consulting fees.' },
  { code: '5140', name: 'Licenses and Permits', type: 'expense' as AccountTypeFromSchema, parentCode: '5100', normalBalance: 'debit' },

  { code: '5800', name: 'Financial Expenses', type: 'expense' as AccountTypeFromSchema, normalBalance: 'debit' },
  { code: '5810', name: 'Mortgage Interest Expense', type: 'expense' as AccountTypeFromSchema, parentCode: '5800', normalBalance: 'debit' },
  { code: '5820', name: 'Loan Fees & Other Interest', type: 'expense' as AccountTypeFromSchema, parentCode: '5800', normalBalance: 'debit' },

  { code: '5900', name: 'Depreciation & Amortization', type: 'expense' as AccountTypeFromSchema, normalBalance: 'debit' },
  { code: '5910', name: 'Depreciation Expense - Buildings', type: 'expense' as AccountTypeFromSchema, parentCode: '5900', normalBalance: 'debit' },
  { code: '5920', name: 'Depreciation Expense - Furniture & Fixtures', type: 'expense' as AccountTypeFromSchema, parentCode: '5900', normalBalance: 'debit' },
  { code: '5930', name: 'Amortization Expense - Loan Costs', type: 'expense' as AccountTypeFromSchema, parentCode: '5900', normalBalance: 'debit' },
];


export function getDefaultChartOfAccounts(): ChartOfAccountsItemDefinition[] {
  return defaultChartOfAccounts;
}

export function findAccountByCodeInList(chart: ChartOfAccountsItemDefinition[], code: string): ChartOfAccountsItemDefinition | undefined {
  return chart.find(account => account.code === code);
}

export interface HierarchicalChartOfAccountsItem extends ChartOfAccountsItemDefinition {
  children: HierarchicalChartOfAccountsItem[];
}

export function buildDefaultCoAHierarchy(
  items: ChartOfAccountsItemDefinition[],
  currentParentCode: string | null = null
): HierarchicalChartOfAccountsItem[] {
  const children: HierarchicalChartOfAccountsItem[] = [];
  for (const item of items) {
    const itemParentCode = item.parentCode === undefined ? null : item.parentCode;
    if (itemParentCode === currentParentCode) {
      const node: HierarchicalChartOfAccountsItem = {
        ...item,
        children: buildDefaultCoAHierarchy(items, item.code),
      };
      children.push(node);
    }
  }
  return children.sort((a, b) => a.code.localeCompare(b.code));
}