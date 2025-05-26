// src/lib/accounting/journal.ts

// Assuming 'Transaction' is the main interface from your types file,
// and 'TransactionLine' is the interface for line items.
// Ensure TransactionLine has 'entity_account_id: string' and 'is_debit: boolean'.
import type { Transaction, TransactionLine } from "../../../types/transaction";
import {
  areTransactionLinesBalanced,
  type TransactionLineInput,
} from "../../validation/schemas/transaction";
import { type MojoDecimal, newMojoDecimal } from "./financial";

export interface JournalDefinition {
  id: string;
  name: string;
  description?: string | null;
  entityId: string;
}

export class Journal {
  public readonly id: string;
  public name: string;
  public description?: string | null;
  public readonly entityId: string;
  public transactions: Transaction[] = [];

  constructor(definition: JournalDefinition) {
    if (!definition.id || definition.id.trim() === "") {
      throw new Error("Journal ID is required and cannot be empty.");
    }
    if (!definition.name || definition.name.trim() === "") {
      throw new Error("Journal name is required and cannot be empty.");
    }
    if (!definition.entityId || definition.entityId.trim() === "") {
      throw new Error("Journal entityId is required and cannot be empty.");
    }

    this.id = definition.id;
    this.name = definition.name.trim();
    this.description = definition.description?.trim() || null;
    this.entityId = definition.entityId;
  }

  addTransaction(transaction: Transaction): boolean {
    if (transaction.entity_id !== this.entityId) {
      console.warn(
        `Journal [${this.name}/${this.id}]: Transaction [${transaction.id}] entity [${transaction.entity_id}] does not match journal entity [${this.entityId}]. Not added.`
      );
      return false;
    }

    if (!transaction.lines || transaction.lines.length < 2) {
      console.warn(
        `Journal [${this.name}/${this.id}]: Transaction [${transaction.id}] has no lines or insufficient lines for balance check. Not added.`
      );
      return false;
    }

    // Map TransactionLine from application type to TransactionLineInput for Zod validation schema based utility
    // TransactionLine (from types/transaction.d.ts) should have: entity_account_id: string, amount: number, is_debit: boolean
    // TransactionLineInput (from schemas/transaction.ts) expects: account_id: string, amount: number, entry_type: 'DEBIT' | 'CREDIT'
    const linesForBalanceCheck: TransactionLineInput[] = transaction.lines.map(
      (line) => {
        // FIXED: Use 'entity_account_id' from your TransactionLine type and map to 'account_id'
        // Also ensure your TransactionLine type actually HAS entity_account_id.
        if (typeof line.entity_account_id !== "string") {
          // Ensure this property exists on TransactionLine
          console.error(
            `Transaction line for tx ${transaction.id} is missing 'entity_account_id'. Current line object:`,
            line
          );
          throw new Error(
            `Internal error: Transaction line missing 'entity_account_id'.`
          );
        }
        return {
          amount: line.amount,
          entry_type: line.is_debit ? "DEBIT" : "CREDIT",
          account_id: line.entity_account_id, // Map from entity_account_id
          // description and tax_code_id are optional in TransactionLineInput, so omitting them here is fine.
        };
      }
    );

    // FIXED: Call areTransactionLinesBalanced with correctly typed array, removed 'as any'
    if (!areTransactionLinesBalanced(linesForBalanceCheck)) {
      console.warn(
        `Journal [${this.name}/${this.id}]: Transaction [${transaction.id}] is not balanced. Not added.`
      );
      return false;
    }

    if (this.transactions.some((t) => t.id === transaction.id)) {
      console.warn(
        `Journal [${this.name}/${this.id}]: Transaction [${transaction.id}] already exists. Not added again.`
      );
      return false;
    }
    this.transactions.push(transaction);
    return true;
  }

  removeTransaction(transactionId: string): boolean {
    const initialLength = this.transactions.length;
    this.transactions = this.transactions.filter((t) => t.id !== transactionId);
    return this.transactions.length < initialLength;
  }

  getAllTransactions(): Transaction[] {
    return [...this.transactions];
  }

  getTransactionsByDateRange(startDate: Date, endDate: Date): Transaction[] {
    const startOfDay = new Date(startDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startTimestamp = startOfDay.getTime();

    const endOfDay = new Date(endDate);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const endTimestamp = endOfDay.getTime();

    return this.transactions.filter((transaction) => {
      const txDate = new Date(transaction.date);
      const txTimestamp = txDate.getTime();
      return txTimestamp >= startTimestamp && txTimestamp <= endTimestamp;
    });
  }

  getTransactionById(transactionId: string): Transaction | undefined {
    return this.transactions.find((t) => t.id === transactionId);
  }

  private calculateTotalByLines(
    linesPredicate: (line: TransactionLine) => boolean,
    onlyPosted: boolean
  ): MojoDecimal {
    let total: MojoDecimal = newMojoDecimal(0);
    this.transactions.forEach((transaction) => {
      if (onlyPosted && transaction.status !== "posted") {
        return;
      }
      if (!transaction.lines) return;

      transaction.lines.forEach((line) => {
        // line is inferred as TransactionLine
        if (linesPredicate(line)) {
          total = total.plus(newMojoDecimal(line.amount));
        }
      });
    });
    return total;
  }

  getTotalDebits(onlyPosted: boolean = false): string {
    return this.calculateTotalByLines(
      (line) => line.is_debit,
      onlyPosted
    ).toString();
  }

  getTotalCredits(onlyPosted: boolean = false): string {
    return this.calculateTotalByLines(
      (line) => !line.is_debit,
      onlyPosted
    ).toString();
  }

  isJournalBalanced(onlyPosted: boolean = false): boolean {
    const debits = this.calculateTotalByLines(
      (line) => line.is_debit,
      onlyPosted
    );
    const credits = this.calculateTotalByLines(
      (line) => !line.is_debit,
      onlyPosted
    );
    return debits.equals(credits);
  }
}
