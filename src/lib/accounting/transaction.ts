// src/lib/accounting/transaction.ts
/**
 * Transaction class for financial accounting operations.
 * Implements double-entry bookkeeping with GAAP-compliant validation.
 */

import { MojoDecimal, newMojoDecimal, RoundingMode } from '../mojo/common/financial';
import { areMonetaryAmountsEqual, isTransactionBalanced } from './utils';

/**
 * Custom error class for transaction operations
 */
export class TransactionError extends Error {
  public readonly code: string;
  public readonly transactionId?: string;
  
  constructor(message: string, code: string, transactionId?: string) {
    super(message);
    this.name = 'TransactionError';
    this.code = code;
    this.transactionId = transactionId;
  }
}

/**
 * Represents a line item in a transaction (debit or credit)
 */
export interface TransactionLine {
  id: string;
  accountId: string;
  amount: string | number;
  isDebit: boolean;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Data needed to create a transaction
 */
export interface TransactionData {
  id: string;
  date: Date;
  description: string;
  entityId: string;
  lines: TransactionLine[];
  status?: 'draft' | 'posted' | 'void';
  reference?: string;
  metadata?: Record<string, any>;
}

/**
 * Represents a financial transaction with one or more line items.
 * Implements double-entry bookkeeping principles.
 */
export class Transaction {
  public readonly id: string;
  public date: Date;
  public description: string;
  public readonly entityId: string;
  public lines: Array<TransactionLine & { amount: string }>;
  public status: 'draft' | 'posted' | 'void';
  public reference?: string;
  public metadata?: Record<string, any>;

  /**
   * Creates a new Transaction instance.
   * @param data Transaction data
   * @throws If any required fields are missing or invalid
   */
  constructor(data: TransactionData) {
    // Validate required fields
    if (!data.id) throw new TransactionError(
      "Transaction ID is required.",
      "MISSING_FIELD"
    );
    
    if (!data.date) throw new TransactionError(
      "Transaction date is required.",
      "MISSING_FIELD"
    );
    
    if (!data.description?.trim()) throw new TransactionError(
      "Transaction description is required.",
      "MISSING_FIELD"
    );
    
    if (!data.entityId) throw new TransactionError(
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

    // Set properties
    this.id = data.id;
    this.date = data.date;
    this.description = data.description;
    this.entityId = data.entityId;
    
    // Process and normalize line items
    this.lines = data.lines.map(line => {
      try {
        const amountValue: MojoDecimal = newMojoDecimal(line.amount);
        
        // Handle negative amounts
        if (amountValue.isNegative()) {
          console.warn(`Transaction line amount for account ${line.accountId} in transaction ${this.id} was negative. Using absolute value.`);
        }
        
        return {
          ...line,
          id: line.id || crypto.randomUUID(),
          amount: amountValue.abs().toString(),
        };
      } catch (error) {
        throw new TransactionError(
          `Invalid amount format for account ${line.accountId}: ${error.message}`,
          "INVALID_AMOUNT",
          this.id
        );
      }
    });
    
    this.status = data.status || 'draft';
    this.reference = data.reference;
    this.metadata = data.metadata;
  }

  /**
   * Checks if the transaction is balanced (debits equal credits).
   * Uses a small tolerance to account for rounding errors.
   * @returns True if the transaction is balanced.
   */
  isBalanced(): boolean {
    try {
      return isTransactionBalanced(this.lines, 0.01);
    } catch (error) {
      console.error(`Balance check failed for transaction ${this.id}:`, error);
      // Re-throw with standardized format
      throw new TransactionError(
        `Failed to validate transaction balance: ${error.message}`,
        'BALANCE_CHECK_FAILED',
        this.id
      );
    }
  }

  /**
   * Adds a new line to the transaction.
   * @param lineData Data for the new line
   * @returns ID of the newly added line
   * @throws If the transaction is already posted or voided
   */
  addLine(lineData: Omit<TransactionLine, 'id' | 'amount'> & { amount: string | number }): string {
    if (this.status === 'posted' || this.status === 'void') {
      throw new TransactionError(
        `Cannot add lines to a transaction with status: ${this.status}.`,
        "INVALID_STATUS",
        this.id
      );
    }
    
    if ((typeof lineData.amount !== 'number' && typeof lineData.amount !== 'string') || 
        typeof lineData.isDebit !== 'boolean' || 
        !lineData.accountId) {
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
    } catch (error) {
      throw new TransactionError(
        `Failed to add line: ${error.message}`,
        "ADD_LINE_FAILED",
        this.id
      );
    }
  }

  /**
   * Removes a line from the transaction.
   * @param lineId ID of the line to remove
   * @returns True if a line was removed, false if not found
   * @throws If the transaction is already posted or voided
   */
  removeLine(lineId: string): boolean {
    if (this.status === 'posted' || this.status === 'void') {
      throw new TransactionError(
        `Cannot remove lines from a transaction with status: ${this.status}.`,
        "INVALID_STATUS",
        this.id
      );
    }
    
    const initialLength = this.lines.length;
    this.lines = this.lines.filter(line => line.id !== lineId);
    
    return this.lines.length < initialLength;
  }

  /**
   * Gets the total amount of the transaction.
   * Returns the sum of all debit lines (which should equal the sum of all credit lines).
   * @returns Total amount as a string
   */
  getTotalAmount(): string {
    try {
      let totalDebits: MojoDecimal = newMojoDecimal(0);
      
      for (const line of this.lines) {
        if (line.isDebit) {
          totalDebits = totalDebits.plus(newMojoDecimal(line.amount));
        }
      }
      
      // Round to 2 decimal places using GAAP-compliant rounding
      return totalDebits.round(2, RoundingMode.ROUND_HALF_EVEN).toString();
    } catch (error) {
      throw new TransactionError(
        `Failed to calculate total amount: ${error.message}`,
        "CALCULATION_ERROR",
        this.id
      );
    }
  }

  /**
   * Posts the transaction, making it permanent.
   * Validates that the transaction is balanced before posting.
   * @returns True if successfully posted
   * @throws If the transaction is not in draft status
   */
  post(): boolean {
    if (this.status !== 'draft') {
      throw new TransactionError(
        `Cannot post transaction. Current status: ${this.status}. Expected 'draft'.`,
        "INVALID_STATUS",
        this.id
      );
    }
    
    if (this.lines.length < 2) {
      console.warn(`Transaction ${this.id} must have at least two lines to be posted.`);
      return false;
    }
    
    if (!this.isBalanced()) {
      console.warn(`Transaction ${this.id} is not balanced. Cannot post.`);
      return false;
    }
    
    this.status = 'posted';
    return true;
  }

  /**
   * Voids the transaction, marking it as invalid but keeping it in the system.
   * @returns True if successfully voided
   * @throws If the transaction is not in posted status
   */
  void(): boolean {
    if (this.status !== 'posted') {
      throw new TransactionError(
        `Cannot void transaction. Current status: ${this.status}. Expected 'posted'.`,
        "INVALID_STATUS",
        this.id
      );
    }
    
    this.status = 'void';
    return true;
  }
  
  /**
   * Creates a reversing transaction that cancels out this transaction.
   * @param newTransactionId ID for the reversing transaction
   * @param reversalDate Date for the reversing transaction (defaults to current date)
   * @param reversalDescription Description for the reversing transaction
   * @returns A new Transaction that reverses this transaction
   */
  createReversal(
    newTransactionId: string, 
    reversalDate: Date = new Date(), 
    reversalDescription: string = `Reversal of transaction ${this.id}`
  ): Transaction {
    if (this.status !== 'posted') {
      throw new TransactionError(
        `Cannot create reversal. Transaction status: ${this.status}. Expected 'posted'.`,
        "INVALID_STATUS",
        this.id
      );
    }
    
    // Create reversed lines by flipping debit/credit
    const reversedLines: TransactionLine[] = this.lines.map(line => ({
      id: crypto.randomUUID(),
      accountId: line.accountId,
      amount: line.amount,
      isDebit: !line.isDebit, // Flip debit/credit
      description: line.description,
      metadata: { 
        ...line.metadata,
        reversalOf: this.id,
        originalLineId: line.id
      }
    }));
    
    // Create the reversal transaction
    return new Transaction({
      id: newTransactionId,
      date: reversalDate,
      description: reversalDescription,
      entityId: this.entityId,
      lines: reversedLines,
      reference: this.reference ? `Reversal of ${this.reference}` : undefined,
      metadata: {
        ...this.metadata,
        reversalOf: this.id,
        isReversal: true
      }
    });
  }
}