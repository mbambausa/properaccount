// src/lib/accounting/journal.ts
import { Transaction } from './transaction';
import { type MojoDecimal, newMojoDecimal } from './financial';

export interface JournalDefinition {
  id: string;
  name: string;
  description?: string;
  entityId: string;
}

export class Journal {
  public readonly id: string;
  public name: string;
  public description?: string;
  public readonly entityId: string;
  public transactions: Transaction[] = [];

  constructor(definition: JournalDefinition) {
    if (!definition.id) throw new Error("Journal ID is required.");
    if (!definition.name?.trim()) throw new Error("Journal name is required.");
    if (!definition.entityId) throw new Error("Journal entityId is required.");

    this.id = definition.id;
    this.name = definition.name;
    this.description = definition.description;
    this.entityId = definition.entityId;
  }

  addTransaction(transaction: Transaction): boolean {
    if (transaction.entityId !== this.entityId) {
      console.warn(`Journal [${this.name}/${this.id}]: Transaction [${transaction.id}] entity [${transaction.entityId}] does not match journal entity [${this.entityId}]. Not added.`);
      return false;
    }
    if (!transaction.isBalanced()) {
      console.warn(`Journal [${this.name}/${this.id}]: Transaction [${transaction.id}] is not balanced. Not added.`);
      return false;
    }
    if (this.transactions.some(t => t.id === transaction.id)) {
      console.warn(`Journal [${this.name}/${this.id}]: Transaction [${transaction.id}] already exists. Not added again.`);
      return false;
    }
    this.transactions.push(transaction);
    return true;
  }

  removeTransaction(transactionId: string): boolean {
    const initialLength = this.transactions.length;
    this.transactions = this.transactions.filter(t => t.id !== transactionId);
    return this.transactions.length < initialLength;
  }

  getAllTransactions(): Transaction[] {
    return this.transactions;
  }

  getTransactionsByDateRange(startDate: Date, endDate: Date): Transaction[] {
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const startTimestamp = startOfDay.getTime();

    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    const endTimestamp = endOfDay.getTime();

    return this.transactions.filter(transaction => {
      const txTimestamp = new Date(transaction.date).getTime();
      return txTimestamp >= startTimestamp && txTimestamp <= endTimestamp;
    });
  }

  getTransactionById(transactionId: string): Transaction | undefined {
    return this.transactions.find(t => t.id === transactionId);
  }

  getTotalDebits(onlyPosted: boolean = false): string {
    let total: MojoDecimal = newMojoDecimal(0);
    this.transactions.forEach(transaction => {
      if (onlyPosted && transaction.status !== 'posted') {
        return;
      }
      transaction.lines.forEach(line => {
        if (line.isDebit) {
          total = total.plus(newMojoDecimal(line.amount));
        }
      });
    });
    return total.toString();
  }

  getTotalCredits(onlyPosted: boolean = false): string {
    let total: MojoDecimal = newMojoDecimal(0);
    this.transactions.forEach(transaction => {
      if (onlyPosted && transaction.status !== 'posted') {
        return;
      }
      transaction.lines.forEach(line => {
        if (!line.isDebit) {
          total = total.plus(newMojoDecimal(line.amount));
        }
      });
    });
    return total.toString();
  }
}