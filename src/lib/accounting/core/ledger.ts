// src/lib/accounting/ledger.ts

import { Account } from "./account";
import type { AccountSystemType as AccountD1SchemaType } from "@db/schema";
import { Journal } from "./journal";
// FIXED: Import Transaction class and TransactionLine interface from the local transaction.ts
import { Transaction, type TransactionLine } from "./transaction";
import { type MojoDecimal, newMojoDecimal } from "./financial";
// The utility 'areTransactionLinesBalanced' is encapsulated within Transaction.isBalanced()
// so it's not directly needed here if we use the method from the Transaction class.

export class Ledger {
  private readonly entityId: string;
  private accounts: Map<string, Account> = new Map();
  private journals: Map<string, Journal> = new Map();
  // Now stores instances of the Transaction CLASS
  private recordedTransactions: Transaction[] = [];

  constructor(entityId: string) {
    if (!entityId || entityId.trim() === "") {
      throw new Error(
        "Ledger requires a non-empty entityId for initialization."
      );
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
      throw new Error(
        `Ledger: Account with ID [${account.id}] already exists.`
      );
    }
    this.accounts.set(account.id, account);
  }

  public getAccount(accountId: string): Account | undefined {
    return this.accounts.get(accountId);
  }

  public getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  public getAccountsByType(type: AccountD1SchemaType): Account[] {
    return this.getAllAccounts().filter((account) => account.type === type);
  }

  public addJournal(journal: Journal): void {
    if (!journal || !journal.id) {
      throw new Error("Invalid journal provided to addJournal.");
    }
    if (journal.entityId !== this.entityId) {
      throw new Error(
        `Journal [${journal.id}] for entity [${journal.entityId}] cannot be added to ledger for entity [${this.entityId}].`
      );
    }
    if (this.journals.has(journal.id)) {
      throw new Error(
        `Ledger: Journal with ID [${journal.id}] already exists.`
      );
    }
    this.journals.set(journal.id, journal);
  }

  public getJournal(journalId: string): Journal | undefined {
    return this.journals.get(journalId);
  }

  public recordTransaction(transaction: Transaction): boolean {
    // transaction is now an instance of Transaction class
    if (!transaction || !transaction.id) {
      throw new Error("Invalid transaction provided to recordTransaction.");
    }
    // The Transaction class constructor uses/sets entityId (camelCase)
    if (transaction.entityId !== this.entityId) {
      console.warn(
        `Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] for entity [${transaction.entityId}] rejected.`
      );
      return false;
    }

    // FIXED: Use the isBalanced() method from the Transaction class instance
    if (!transaction.isBalanced()) {
      console.warn(
        `Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] is not balanced. Rejected.`
      );
      return false;
    }

    // Transaction class status is 'draft' | 'posted' | 'void'
    if (transaction.status !== "posted") {
      console.warn(
        `Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] has status '${transaction.status}'. Only 'posted' can be recorded. Rejected.`
      );
      return false;
    }
    if (this.recordedTransactions.some((rt) => rt.id === transaction.id)) {
      console.warn(
        `Ledger (Entity: ${this.entityId}): Transaction [${transaction.id}] has already been recorded. Rejected.`
      );
      return false;
    }

    // Validate accounts in lines
    // The Transaction class lines are Array<TransactionLine & { amount: string }>
    // and TransactionLine (from ./transaction.ts) has accountId (camelCase)
    for (const line of transaction.lines) {
      // FIXED: Use line.accountId (camelCase from TransactionLine interface in ./transaction.ts)
      const account = this.accounts.get(line.accountId);
      if (!account) {
        console.warn(
          `Ledger (Entity: ${this.entityId}): Account [${line.accountId}] in transaction [${transaction.id}] not found. Rejected.`
        );
        return false;
      }
      if (!account.isActive) {
        console.warn(
          `Ledger (Entity: ${this.entityId}): Account [${line.accountId}] - "${account.name}" is inactive. Rejected.`
        );
        return false;
      }
    }

    // Apply transaction to accounts
    transaction.lines.forEach((line) => {
      // line.accountId and line.isDebit are from TransactionLine interface in ./transaction.ts
      const account = this.getAccount(line.accountId)!; // Non-null assertion ok due to loop above
      // Account.applyTransaction expects amount (string|number|MojoDecimal) and isDebit (boolean)
      // line.amount is string here (normalized in Transaction class). line.isDebit is boolean.
      account.applyTransaction(line.amount, line.isDebit);
    });

    this.recordedTransactions.push(transaction);
    return true;
  }

  public getAllRecordedTransactions(): readonly Transaction[] {
    return Object.freeze([...this.recordedTransactions]);
  }

  public getRecordedTransactionsForAccount(accountId: string): Transaction[] {
    return this.recordedTransactions.filter((tx) =>
      // transaction.lines is guaranteed on Transaction class instance
      // FIXED: line.accountId is from TransactionLine interface in ./transaction.ts
      tx.lines.some((line) => line.accountId === accountId)
    );
  }

  public getAccountBalance(accountId: string): string {
    const account = this.getAccount(accountId);
    if (!account) {
      console.warn(
        `Ledger: Account balance requested for non-existent account ID [${accountId}].`
      );
      return newMojoDecimal(0).toString();
    }
    return account.balance;
  }

  public generateTrialBalance(): Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: string;
    credit: string;
  }> {
    const trialBalanceLines = this.getAllAccounts()
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((account) => {
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

    trialBalanceLines.forEach((line) => {
      totalDebits = totalDebits.plus(newMojoDecimal(line.debit));
      totalCredits = totalCredits.plus(newMojoDecimal(line.credit));
    });

    if (!totalDebits.equals(totalCredits)) {
      console.warn(
        `Ledger (Entity: ${this.entityId}): Trial Balance OUT OF BALANCE! Debits: ${totalDebits.toString()}, Credits: ${totalCredits.toString()}`
      );
    } else {
      console.info(
        `Ledger (Entity: ${this.entityId}): Trial Balance is IN BALANCE. Total: ${totalDebits.toString()}`
      );
    }
    return trialBalanceLines;
  }
}
