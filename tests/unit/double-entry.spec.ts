// tests/unit/double-entry.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';

// Assuming you have classes/functions for Account, Transaction, Ledger
// These imports would point to your actual implementations.
// For example:
// import { Account, AccountType } from '../../src/lib/accounting/account';
// import { Transaction, TransactionLine } from '../../src/lib/accounting/transaction';
// import { Ledger } from '../../src/lib/accounting/ledger';

// Mock implementations for demonstration if actual classes are complex or have dependencies
class MockAccount {
  id: string;
  name: string;
  balance: number;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  isDebitNormal: boolean;

  constructor(id: string, name: string, type: 'asset' | 'liability' | 'equity' | 'income' | 'expense', initialBalance = 0) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.balance = initialBalance;
    this.isDebitNormal = type === 'asset' || type === 'expense';
  }

  applyAmount(amount: number, isDebit: boolean) {
    if (this.isDebitNormal) {
      this.balance += isDebit ? amount : -amount;
    } else {
      this.balance += isDebit ? -amount : amount;
    }
  }
}

interface MockTransactionLineInput {
  accountId: string;
  amount: number; // Always positive
  isDebit: boolean;
  description?: string;
}

class MockTransaction {
  id: string;
  date: Date;
  description: string;
  lines: MockTransactionLineInput[];

  constructor(id: string, description: string, lines: MockTransactionLineInput[], date = new Date()) {
    this.id = id;
    this.description = description;
    this.lines = lines;
    this.date = date;
    this.validateBalanced();
  }

  validateBalanced() {
    const totalDebits = this.lines.filter(l => l.isDebit).reduce((sum, l) => sum + l.amount, 0);
    const totalCredits = this.lines.filter(l => !l.isDebit).reduce((sum, l) => sum + l.amount, 0);
    if (totalDebits !== totalCredits) {
      throw new Error(`Transaction unbalanced: Debits ${totalDebits}, Credits ${totalCredits}`);
    }
  }
}

class MockLedger {
  accounts: Map<string, MockAccount>;

  constructor() {
    this.accounts = new Map();
  }

  addAccount(account: MockAccount) {
    this.accounts.set(account.id, account);
  }

  getAccount(accountId: string): MockAccount | undefined {
    return this.accounts.get(accountId);
  }

  postTransaction(transaction: MockTransaction) {
    transaction.validateBalanced(); // Ensure it's balanced before posting
    for (const line of transaction.lines) {
      const account = this.getAccount(line.accountId);
      if (!account) {
        throw new Error(`Account not found: ${line.accountId}`);
      }
      account.applyAmount(line.amount, line.isDebit);
    }
  }
}

describe('Double-Entry Accounting Logic', () => {
  let ledger: MockLedger;
  let cashAccount: MockAccount;
  let expenseAccount: MockAccount;
  let revenueAccount: MockAccount;
  let accountsPayable: MockAccount;

  beforeEach(() => {
    ledger = new MockLedger();
    cashAccount = new MockAccount('cash-001', 'Cash', 'asset', 1000);
    expenseAccount = new MockAccount('expense-001', 'Office Supplies', 'expense');
    revenueAccount = new MockAccount('revenue-001', 'Service Revenue', 'income');
    accountsPayable = new MockAccount('ap-001', 'Accounts Payable', 'liability');

    ledger.addAccount(cashAccount);
    ledger.addAccount(expenseAccount);
    ledger.addAccount(revenueAccount);
    ledger.addAccount(accountsPayable);
  });

  it('should correctly initialize account balances', () => {
    expect(cashAccount.balance).toBe(1000);
    expect(expenseAccount.balance).toBe(0);
  });

  it('should throw an error for an unbalanced transaction', () => {
    const unbalancedLines: MockTransactionLineInput[] = [
      { accountId: expenseAccount.id, amount: 100, isDebit: true },
      { accountId: cashAccount.id, amount: 50, isDebit: false }, // Not balanced
    ];
    expect(() => new MockTransaction('tx-unbalanced', 'Unbalanced purchase', unbalancedLines))
      .toThrow('Transaction unbalanced: Debits 100, Credits 50');
  });

  it('should correctly post a simple expense transaction (cash purchase)', () => {
    const lines: MockTransactionLineInput[] = [
      { accountId: expenseAccount.id, amount: 100, isDebit: true, description: 'Debit Office Supplies' },
      { accountId: cashAccount.id, amount: 100, isDebit: false, description: 'Credit Cash' },
    ];
    const transaction = new MockTransaction('tx-expense', 'Bought office supplies', lines);
    ledger.postTransaction(transaction);

    expect(expenseAccount.balance).toBe(100); // Expenses increase with debits
    expect(cashAccount.balance).toBe(900);   // Assets decrease with credits
  });

  it('should correctly post a revenue transaction (cash sale)', () => {
    const lines: MockTransactionLineInput[] = [
      { accountId: cashAccount.id, amount: 500, isDebit: true, description: 'Debit Cash' },
      { accountId: revenueAccount.id, amount: 500, isDebit: false, description: 'Credit Service Revenue' },
    ];
    const transaction = new MockTransaction('tx-revenue', 'Provided services for cash', lines);
    ledger.postTransaction(transaction);

    expect(cashAccount.balance).toBe(1500); // Assets increase with debits
    expect(revenueAccount.balance).toBe(-500); // Income increases with credits (represented as negative for calculation if normalBalance is credit and we sum)
                                             // Or, if your Account class handles it: revenueAccount.balance should be 500 (if positive means credit balance for income)
                                             // Let's adjust MockAccount for this typical representation:
                                             // If !isDebitNormal (e.g. liability, equity, income), credit increases balance.
                                             // So, revenue should increase.
    // Re-evaluating based on typical accounting representations:
    // For income accounts (credit normal balance), a credit increases the balance.
    // Our MockAccount logic: if (!isDebitNormal) { this.balance += isDebit ? -amount : amount; }
    // So for revenue (credit normal), a credit (isDebit=false) adds amount.
    expect(revenueAccount.balance).toBe(500);
  });

  it('should correctly post a transaction involving liabilities (purchase on account)', () => {
    const lines: MockTransactionLineInput[] = [
      { accountId: expenseAccount.id, amount: 200, isDebit: true, description: 'Debit Office Supplies' },
      { accountId: accountsPayable.id, amount: 200, isDebit: false, description: 'Credit Accounts Payable' },
    ];
    const transaction = new MockTransaction('tx-ap', 'Bought supplies on credit', lines);
    ledger.postTransaction(transaction);

    expect(expenseAccount.balance).toBe(200);
    expect(accountsPayable.balance).toBe(200); // Liabilities increase with credits
  });

  it('should correctly post a payment to a liability', () => {
    // First, incur the liability (as above)
    const purchaseLines: MockTransactionLineInput[] = [
      { accountId: expenseAccount.id, amount: 200, isDebit: true },
      { accountId: accountsPayable.id, amount: 200, isDebit: false },
    ];
    ledger.postTransaction(new MockTransaction('tx-ap-setup', 'Initial AP', purchaseLines));
    expect(accountsPayable.balance).toBe(200);
    expect(cashAccount.balance).toBe(1000);

    // Now, pay the liability
    const paymentLines: MockTransactionLineInput[] = [
      { accountId: accountsPayable.id, amount: 150, isDebit: true, description: 'Debit Accounts Payable' },
      { accountId: cashAccount.id, amount: 150, isDebit: false, description: 'Credit Cash' },
    ];
    const paymentTx = new MockTransaction('tx-ap-payment', 'Paid part of AP', paymentLines);
    ledger.postTransaction(paymentTx);

    expect(accountsPayable.balance).toBe(50); // Liabilities decrease with debits
    expect(cashAccount.balance).toBe(850);    // Assets decrease with credits
  });

  // Add more complex scenarios:
  // - Transactions with multiple debits and/or credits
  // - Adjusting entries (e.g., depreciation, accruals)
  // - Closing entries (transferring income/expense to equity)
  // - Correcting entries
  // - Transactions involving contra accounts
});
