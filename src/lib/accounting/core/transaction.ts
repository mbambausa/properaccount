// src/lib/accounting/transaction.ts
/**
 * Transaction class for financial accounting operations.
 * Implements double-entry bookkeeping with GAAP-compliant validation.
 */

// FIXED: Import RoundingMode from financial.ts
import { MojoDecimal, newMojoDecimal, RoundingMode } from "./financial";
import { isTransactionBalanced } from "../utils";

export class TransactionError extends Error {
  // ... (no changes to TransactionError) ...
  public readonly code: string;
  public readonly transactionId?: string;

  constructor(message: string, code: string, transactionId?: string) {
    super(message);
    this.name = "TransactionError";
    this.code = code;
    this.transactionId = transactionId;
  }
}

export interface TransactionLine {
  // ... (no changes to TransactionLine interface) ...
  id: string;
  accountId: string;
  amount: string | number;
  isDebit: boolean;
  description?: string;
  metadata?: Record<string, any>;
}

export interface TransactionData {
  // ... (no changes to TransactionData interface) ...
  id: string;
  date: Date;
  description: string;
  entityId: string;
  lines: TransactionLine[];
  status?: "draft" | "posted" | "void";
  reference?: string;
  metadata?: Record<string, any>;
}

export class Transaction {
  // ... (constructor and other methods mostly unchanged, ensure they use the imported RoundingMode) ...
  public readonly id: string;
  public date: Date;
  public description: string;
  public readonly entityId: string;
  public lines: Array<TransactionLine & { amount: string }>;
  public status: "draft" | "posted" | "void";
  public reference?: string;
  public metadata?: Record<string, any>;

  constructor(data: TransactionData) {
    if (!data.id)
      throw new TransactionError(
        "Transaction ID is required.",
        "MISSING_FIELD"
      );
    if (!data.date)
      throw new TransactionError(
        "Transaction date is required.",
        "MISSING_FIELD"
      );
    if (!data.description?.trim())
      throw new TransactionError(
        "Transaction description is required.",
        "MISSING_FIELD"
      );
    if (!data.entityId)
      throw new TransactionError(
        "Transaction entityId is required.",
        "MISSING_FIELD"
      );
    if (!data.lines || data.lines.length < 2) {
      throw new TransactionError(
        "Transaction must have at least two lines.",
        "INVALID_LINES",
        data.id
      );
    }

    this.id = data.id;
    this.date = data.date;
    this.description = data.description.trim();
    this.entityId = data.entityId;

    this.lines = data.lines.map((line) => {
      if (
        !line.id ||
        typeof line.accountId !== "string" ||
        line.accountId.trim() === ""
      ) {
        throw new TransactionError(
          `Transaction line is missing required 'id' or 'accountId'. Line: ${JSON.stringify(line)}`,
          "INVALID_LINE_DATA",
          this.id
        );
      }
      try {
        const amountValue: MojoDecimal = newMojoDecimal(line.amount);
        if (amountValue.isNegative()) {
          console.warn(
            `Transaction line amount for account ${line.accountId} in transaction ${this.id} was negative (${line.amount}). Using absolute value.`
          );
        }
        return {
          ...line,
          id: line.id,
          accountId: line.accountId,
          amount: amountValue.abs().toString(),
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new TransactionError(
          `Invalid amount format for account ${line.accountId}: ${message}`,
          "INVALID_AMOUNT",
          this.id
        );
      }
    });

    this.status = data.status || "draft";
    this.reference = data.reference;
    this.metadata = data.metadata;
  }

  isBalanced(): boolean {
    try {
      return isTransactionBalanced(
        this.lines.map((l) => ({
          accountId: l.accountId,
          amount: l.amount,
          isDebit: l.isDebit,
        }))
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `Balance check failed for transaction ${this.id}:`,
        message
      );
      throw new TransactionError(
        `Failed to validate transaction balance: ${message}`,
        "BALANCE_CHECK_FAILED",
        this.id
      );
    }
  }

  addLine(
    lineData: Omit<TransactionLine, "id" | "amount"> & {
      amount: string | number;
    }
  ): string {
    if (this.status === "posted" || this.status === "void") {
      throw new TransactionError(
        `Cannot add lines to a transaction with status: ${this.status}.`,
        "INVALID_STATUS",
        this.id
      );
    }
    if (
      (typeof lineData.amount !== "number" &&
        typeof lineData.amount !== "string") ||
      typeof lineData.isDebit !== "boolean" ||
      !lineData.accountId
    ) {
      throw new TransactionError(
        "Invalid line data: amount (string/number), isDebit, and accountId are required.",
        "INVALID_LINE_DATA",
        this.id
      );
    }

    try {
      const id = crypto.randomUUID();
      const amountValue: MojoDecimal = newMojoDecimal(lineData.amount).abs();
      this.lines.push({
        id,
        accountId: lineData.accountId,
        amount: amountValue.toString(),
        isDebit: lineData.isDebit,
        description: lineData.description,
        metadata: lineData.metadata,
      });
      return id;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new TransactionError(
        `Failed to add line: ${message}`,
        "ADD_LINE_FAILED",
        this.id
      );
    }
  }

  removeLine(lineId: string): boolean {
    if (this.status === "posted" || this.status === "void") {
      throw new TransactionError(
        `Cannot remove lines from a transaction with status: ${this.status}.`,
        "INVALID_STATUS",
        this.id
      );
    }
    const initialLength = this.lines.length;
    this.lines = this.lines.filter((line) => line.id !== lineId);
    return this.lines.length < initialLength;
  }

  getTotalAmount(): string {
    try {
      let totalDebits: MojoDecimal = newMojoDecimal(0);
      for (const line of this.lines) {
        if (line.isDebit) {
          totalDebits = totalDebits.plus(newMojoDecimal(line.amount));
        }
      }
      // Now uses RoundingMode imported from ./financial
      return totalDebits.round(2, RoundingMode.ROUND_HALF_EVEN).toString();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new TransactionError(
        `Failed to calculate total amount: ${message}`,
        "CALCULATION_ERROR",
        this.id
      );
    }
  }

  post(): boolean {
    if (this.status !== "draft") {
      throw new TransactionError(
        `Cannot post transaction. Current status: ${this.status}. Expected 'draft'.`,
        "INVALID_STATUS",
        this.id
      );
    }
    if (this.lines.length < 2) {
      console.warn(
        `Transaction ${this.id} must have at least two lines to be posted.`
      );
      return false;
    }
    if (!this.isBalanced()) {
      console.warn(`Transaction ${this.id} is not balanced. Cannot post.`);
      return false;
    }
    this.status = "posted";
    return true;
  }

  void(): boolean {
    if (this.status !== "posted") {
      throw new TransactionError(
        `Cannot void transaction. Current status: ${this.status}. Expected 'posted'.`,
        "INVALID_STATUS",
        this.id
      );
    }
    this.status = "void";
    return true;
  }

  createReversal(
    newTransactionId: string,
    reversalDate: Date = new Date(),
    reversalDescription: string = `Reversal of transaction ${this.id}`
  ): Transaction {
    if (this.status !== "posted") {
      throw new TransactionError(
        `Cannot create reversal. Transaction status: ${this.status}. Expected 'posted'.`,
        "INVALID_STATUS",
        this.id
      );
    }

    const reversedLines: TransactionLine[] = this.lines.map((line) => ({
      id: crypto.randomUUID(),
      accountId: line.accountId,
      amount: line.amount,
      isDebit: !line.isDebit,
      description:
        line.description || `Reversal of line for account ${line.accountId}`,
      metadata: {
        ...line.metadata,
        reversalOfLineId: line.id,
      },
    }));

    return new Transaction({
      id: newTransactionId,
      date: reversalDate,
      description: reversalDescription,
      entityId: this.entityId,
      lines: reversedLines,
      reference: this.reference
        ? `Reversal of ${this.reference}`
        : `Reversal of Tx ${this.id}`,
      metadata: {
        ...this.metadata,
        reversalOfTransactionId: this.id,
        isReversalEntry: true,
      },
    });
  }
}
