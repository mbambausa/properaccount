// src/lib/mojo/batch-processor/batch-processor.ts
/**
 * JavaScript adapter for the Mojo batch processor WebAssembly module.
 * Provides high-performance transaction processing with fallbacks to JavaScript.
 */

import Decimal from 'decimal.js';
import { initMojoModule, MojoModule } from '../loader';
import { getFeatureFlags } from '../feature-flags';

// Module state
let mojoBatchProcessor: MojoModule | null = null;
let initializing = false;
let initializationError: Error | null = null;

// Error codes
export enum BatchProcessorError {
  NONE = 0,
  UNBALANCED = 1,
  MISSING_REQUIRED = 2,
  INVALID_ACCOUNT = 3,
  INVALID_DATE = 4,
  DUPLICATE = 5
}

interface TransactionLine {
  account_id: string;
  amount: string | number;
  is_debit: boolean;
  description?: string;
}

interface Transaction {
  id: string;
  date: string;
  description?: string;
  lines: TransactionLine[];
}

interface Account {
  id: string;
  type: string;
  name: string;
  balance: string | number;
}

interface ValidationError {
  transaction_id: string;
  line?: number;
  code: BatchProcessorError;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: any[];
  processed_transactions?: Transaction[];
  updated_accounts?: Record<string, Account>;
}

interface CategorizationPattern {
  text: string;
  category: string;
  min_amount?: string | number;
  max_amount?: string | number;
}

/**
 * Initialize the batch processor
 */
export async function initBatchProcessor(forceJS = false): Promise<boolean> {
  // Check if Mojo should be used
  const { useMojoBatchProcessor } = getFeatureFlags();
  
  if (!useMojoBatchProcessor || forceJS) {
    console.log('Using JavaScript implementation for Batch Processor');
    return false;
  }
  
  // Prevent multiple initialization attempts
  if (mojoBatchProcessor?.isInitialized) return true;
  if (initializing) return false;
  
  initializing = true;
  
  try {
    mojoBatchProcessor = await initMojoModule('batch-processor');
    console.log('Mojo Batch Processor initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Mojo Batch Processor:', error);
    initializationError = error instanceof Error ? error : new Error(String(error));
    return false;
  } finally {
    initializing = false;
  }
}

/**
 * Validate a batch of transactions
 */
export async function validateTransactions(
  transactions: Transaction[],
  validAccounts: string[]
): Promise<ValidationResult> {
  // Try to use Mojo implementation
  try {
    if (await initBatchProcessor()) {
      const result = mojoBatchProcessor!.exports.validate_transactions(
        JSON.stringify(transactions),
        JSON.stringify(validAccounts)
      );
      return JSON.parse(result);
    }
  } catch (error) {
    console.warn('Mojo transaction validation failed, falling back to JS:', error);
  }
  
  // Fallback to JavaScript implementation
  return validateTransactionsJS(transactions, validAccounts);
}

/**
 * JavaScript implementation of transaction validation
 */
function validateTransactionsJS(
  transactions: Transaction[],
  validAccounts: string[]
): ValidationResult {
  const results: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  // Build set of valid accounts for faster lookup
  const validAccountSet = new Set(validAccounts);
  
  // Track transaction IDs to check for duplicates
  const transactionIds = new Set<string>();
  
  transactions.forEach((transaction, index) => {
    const transactionId = transaction.id || String(index);
    const lines = transaction.lines || [];
    
    // Check for duplicate transaction ID
    if (transactionIds.has(transactionId)) {
      results.valid = false;
      results.errors.push({
        transaction_id: transactionId,
        code: BatchProcessorError.DUPLICATE,
        message: "Duplicate transaction ID"
      });
      return;
    }
    
    transactionIds.add(transactionId);
    
    // Check for required fields
    if (!transaction.date) {
      results.valid = false;
      results.errors.push({
        transaction_id: transactionId,
        code: BatchProcessorError.MISSING_REQUIRED,
        message: "Missing transaction date"
      });
    }
    
    // Validate date format
    if (!isValidDate(transaction.date)) {
      results.valid = false;
      results.errors.push({
        transaction_id: transactionId,
        code: BatchProcessorError.INVALID_DATE,
        message: `Invalid date format: ${transaction.date}`
      });
    }
    
    // Check for empty lines
    if (lines.length === 0) {
      results.valid = false;
      results.errors.push({
        transaction_id: transactionId,
        code: BatchProcessorError.MISSING_REQUIRED,
        message: "Transaction has no lines"
      });
      return;
    }
    
    // Validate transaction lines
    let debits = new Decimal(0);
    let credits = new Decimal(0);
    
    lines.forEach((line, lineIndex) => {
      // Validate account
      if (!validAccountSet.has(line.account_id)) {
        results.valid = false;
        results.errors.push({
          transaction_id: transactionId,
          line: lineIndex,
          code: BatchProcessorError.INVALID_ACCOUNT,
          message: `Invalid account ID: ${line.account_id}`
        });
      }
      
      // Sum debits and credits
      const amount = new Decimal(line.amount || 0);
      if (line.is_debit) {
        debits = debits.plus(amount);
      } else {
        credits = credits.plus(amount);
      }
    });
    
    // Check if transaction is balanced
    if (!debits.equals(credits)) {
      results.valid = false;
      results.errors.push({
        transaction_id: transactionId,
        code: BatchProcessorError.UNBALANCED,
        message: `Transaction is not balanced. Debits: ${debits.toString()}, Credits: ${credits.toString()}`
      });
    }
  });
  
  return results;
}

/**
 * Process a batch of transactions
 */
export async function processTransactionBatch(
  transactions: Transaction[],
  accounts: Record<string, Account>
): Promise<ValidationResult> {
  // Try to use Mojo implementation
  try {
    if (await initBatchProcessor()) {
      const result = mojoBatchProcessor!.exports.process_transaction_batch(
        JSON.stringify(transactions),
        JSON.stringify(accounts)
      );
      return JSON.parse(result);
    }
  } catch (error) {
    console.warn('Mojo batch processing failed, falling back to JS:', error);
  }
  
  // Fallback to JavaScript implementation
  return processTransactionBatchJS(transactions, accounts);
}

/**
 * JavaScript implementation of transaction batch processing
 */
function processTransactionBatchJS(
  transactions: Transaction[],
  accounts: Record<string, Account>
): ValidationResult {
  // First validate the transactions
  const validAccounts = Object.keys(accounts);
  const results = validateTransactionsJS(transactions, validAccounts);
  
  // If not valid, return validation errors
  if (!results.valid) {
    return results;
  }
  
  const processedTransactions: Transaction[] = [];
  const accountBalances: Record<string, Decimal> = {};
  
  // Initialize account balances
  for (const accountId in accounts) {
    accountBalances[accountId] = new Decimal(accounts[accountId].balance || 0);
  }
  
  // Process each transaction
  transactions.forEach((transaction, index) => {
    const transactionId = transaction.id || String(index);
    const lines = transaction.lines || [];
    
    const processedLines: TransactionLine[] = [];
    
    lines.forEach(line => {
      const accountId = line.account_id;
      const amount = new Decimal(line.amount || 0);
      const isDebit = line.is_debit;
      
      // Update account balance
      const accountType = accounts[accountId]?.type || 'asset';
      const normalBalanceIsDebit = (
        accountType === 'asset' || 
        accountType === 'expense'
      );
      
      // If debit and normal balance is debit, or credit and normal balance is credit, increase balance
      if ((isDebit && normalBalanceIsDebit) || (!isDebit && !normalBalanceIsDebit)) {
        accountBalances[accountId] = accountBalances[accountId].plus(amount);
      } else {
        accountBalances[accountId] = accountBalances[accountId].minus(amount);
      }
      
      processedLines.push({
        account_id: accountId,
        amount: amount.toString(),
        is_debit: isDebit,
        description: line.description
      });
    });
    
    processedTransactions.push({
      id: transactionId,
      date: transaction.date,
      description: transaction.description || '',
      lines: processedLines
    });
  });
  
  // Prepare updated accounts
  const updatedAccounts: Record<string, Account> = {};
  for (const accountId in accountBalances) {
    updatedAccounts[accountId] = {
      id: accountId,
      type: accounts[accountId]?.type || '',
      name: accounts[accountId]?.name || '',
      balance: accountBalances[accountId].toString()
    };
  }
  
  results.processed_transactions = processedTransactions;
  results.updated_accounts = updatedAccounts;
  
  return results;
}

/**
 * Categorize transactions based on patterns
 */
export async function categorizeTransactions(
  transactions: any[],
  patterns: CategorizationPattern[]
): Promise<any[]> {
  // Try to use Mojo implementation
  try {
    if (await initBatchProcessor()) {
      const result = mojoBatchProcessor!.exports.categorize_transactions(
        JSON.stringify(transactions),
        JSON.stringify(patterns)
      );
      return JSON.parse(result);
    }
  } catch (error) {
    console.warn('Mojo transaction categorization failed, falling back to JS:', error);
  }
  
  // Fallback to JavaScript implementation
  return categorizeTransactionsJS(transactions, patterns);
}

/**
 * JavaScript implementation of transaction categorization
 */
function categorizeTransactionsJS(
  transactions: any[],
  patterns: CategorizationPattern[]
): any[] {
  return transactions.map(transaction => {
    const description = (transaction.description || '').toLowerCase();
    const amount = new Decimal(transaction.amount || 0);
    const originalCategory = transaction.category || '';
    
    // Skip if already categorized with high confidence
    if ((transaction.category_confidence || 0) > 0.8) {
      return transaction;
    }
    
    let matchedCategory = originalCategory;
    let confidence = 0;
    
    // Try to match patterns
    patterns.forEach(pattern => {
      const patternText = (pattern.text || '').toLowerCase();
      const patternCategory = pattern.category || '';
      const patternMinAmount = new Decimal(pattern.min_amount || -999999999);
      const patternMaxAmount = new Decimal(pattern.max_amount || 999999999);
      
      // Check if description contains pattern text
      if (description.includes(patternText)) {
        // Check if amount is within range
        if (amount.gte(patternMinAmount) && amount.lte(patternMaxAmount)) {
          // Calculate match confidence based on text length
          const newConfidence = patternText.length / description.length;
          
          // Only update if confidence is higher
          if (newConfidence > confidence) {
            matchedCategory = patternCategory;
            confidence = newConfidence;
          }
        }
      }
    });
    
    // Apply matched category
    return {
      ...transaction,
      category: matchedCategory,
      category_confidence: confidence,
      category_is_auto: matchedCategory !== originalCategory
    };
  });
}

/**
 * Helper function to validate date string format
 */
function isValidDate(dateStr: string): boolean {
  // Check for YYYY-MM-DD format
  if (!dateStr || dateStr.length !== 10) {
    return false;
  }
  
  if (dateStr[4] !== '-' || dateStr[7] !== '-') {
    return false;
  }
  
  // Check if other characters are digits
  for (let i = 0; i < dateStr.length; i++) {
    if (i !== 4 && i !== 7) {
      if (!/\d/.test(dateStr[i])) {
        return false;
      }
    }
  }
  
  // Extract year, month, day
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(5, 7), 10);
  const day = parseInt(dateStr.substring(8, 10), 10);
  
  // Basic validation
  if (month < 1 || month > 12) {
    return false;
  }
  
  if (day < 1 || day > 31) {
    return false;
  }
  
  return true;
}