// src/lib/accounting/ledger.ts

import { Account } from './account';
// Removed AccountDefinition, JournalDefinition, TransactionData imports as they are not used directly by Ledger methods.
// If Ledger methods were to take these definition types as parameters (e.g. for creating new instances),
// then `import type { AccountDefinition } from './account';` etc., would be needed.

import type { AccountSystemType as AccountTypeFromSchema } from '@db/schema';
import { Journal } from './journal';
import { Transaction } from './transaction';
import { type MojoDecimal, newMojoDecimal } from './financial';

export class Ledger {
  private readonly entityId: string;
  private accounts: Map<string, Account> = new Map();
  private journals: Map<string, Journal> = new Map();
  private recordedTransactions: Transaction[] = [];

  constructor(entityId: string) {
    if (!entityId) {
      throw new Error("Ledger requires an entityId for initialization.");
    }
    this.entityId = entityId;
  }

  public getEntityId(): string {
    return this.entityId;
  }

  public addAccount(account: Account): void {
    if (!account || !account.id) {
      throw new Error("Invalid account provided to addAccount.");
    }
    if (this.accounts.has(account.id)) {
      throw new Error(`Ledger: Account with ID [${account.id}] already exists.`);
    }
    this.accounts.set(account.id, account);
  }

  public getAccount(accountId: string): Account | undefined {
    return this.accounts.get(accountId);
  }

  public getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  public getAccountsByType(type: AccountTypeFromSchema): Account[] {
    return this.getAllAccounts().filter(account => account.type === type);
  }

  public addJournal(journal: Journal): void {
    if (!journal || !journal.id) {
      throw new Error("Invalid journal provided to addJournal.");
    }
    if (journal.entityId !== this.entityId) {
      throw new Error(`Journal [${journal.id}] for entity [${journal.entityId}] cannot be added to ledger for entity [${this.entityId}].`);
    }
    if (this.journals.has(journal.id)) {
      throw new Error(`Ledger: Journal with ID [${journal.id}] already exists.`);
    }
    this.journals.set(journal.id, journal);
  }

  public getJournal(journalId: string): Journal | undefined {
    return this.journals.get(journalId);
  }

  public recordTransaction(transaction: Transaction): boolean {
    if (!transaction || !transaction.id) {
      throw new Error("Invalid transaction provided to recordTransaction.");
    }
    if (transaction.entityId !== this.entityId) {
      console.warn(`Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] for entity [${transaction.entityId}] rejected.`);
      return false;
    }
    if (!transaction.isBalanced()) {
      console.warn(`Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] is not balanced. Rejected.`);
      return false;
    }
    if (transaction.status !== 'posted') {
      console.warn(`Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] has status '${transaction.status}'. Only 'posted' can be recorded. Rejected.`);
      return false;
    }
    if (this.recordedTransactions.some(rt => rt.id === transaction.id)) {
      console.warn(`Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] has already been recorded. Rejected.`);
      return false;
    }

    for (const line of transaction.lines) {
      const account = this.accounts.get(line.accountId);
      if (!account) {
        console.warn(`Ledger (Entity: ${this.entityId}): Account [${line.accountId}] in transaction [${transaction.id}] not found. Rejected.`);
        return false;
      }
      if (!account.isActive) {
        console.warn(`Ledger (Entity: ${this.entityId}): Account [${line.accountId}] - "${account.name}" is inactive. Rejected.`);
        return false;
      }
    }

    transaction.lines.forEach(line => {
      const account = this.getAccount(line.accountId)!;
      account.applyTransaction(line.amount, line.isDebit);
    });

    this.recordedTransactions.push(transaction);
    return true;
  }

  public getAllRecordedTransactions(): Transaction[] {
    return this.recordedTransactions;
  }

  public getRecordedTransactionsForAccount(accountId: string): Transaction[] {
    return this.recordedTransactions.filter(tx =>
      tx.lines.some(line => line.accountId === accountId)
    );
  }

  public getAccountBalance(accountId: string): string {
    const account = this.getAccount(accountId);
    return account ? account.balance : "0";
  }

  public generateTrialBalance(): Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: string;
    credit: string;
  }> {
    const trialBalanceLines = this.getAllAccounts().map(account => {
      const balance: MojoDecimal = account.balanceMojoDecimal;
      let debitAmount: MojoDecimal = newMojoDecimal(0);
      let creditAmount: MojoDecimal = newMojoDecimal(0);

      if (account.isDebitNormal()) {
        if (balance.isPositive() || balance.isZero()) {
          debitAmount = balance;
        } else {
          creditAmount = balance.abs();
        }
      } else {
        if (balance.isPositive() || balance.isZero()) {
          creditAmount = balance;
        } else {
          debitAmount = balance.abs();
        }
      }
      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        debit: debitAmount.toString(),
        credit: creditAmount.toString(),
      };
    });

    let totalDebits: MojoDecimal = newMojoDecimal(0);
    let totalCredits: MojoDecimal = newMojoDecimal(0);
    trialBalanceLines.forEach(line => {
      totalDebits = totalDebits.plus(newMojoDecimal(line.debit));
      totalCredits = totalCredits.plus(newMojoDecimal(line.credit));
    });

    if (!totalDebits.equals(totalCredits)) {
      console.warn(`Ledger (Entity: ${this.entityId}): Trial Balance out of balance! Debits: ${totalDebits.toString()}, Credits: ${totalCredits.toString()}`);
    }
    return trialBalanceLines;
  }
}