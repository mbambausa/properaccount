// src/lib/validation/schemas/transaction.ts
/**
 * Transaction Validation Schemas
 *
 * This module provides Zod validation schemas for transaction-related operations,
 * ensuring data integrity for double-entry accounting transactions.
 */

import { z } from 'zod';

// ----------------
// Shared Sub-Schemas
// ----------------

/**
 * Valid monetary amount schema.
 * Consider using z.number().transform() with a decimal library for precision if direct math is done.
 * For storage and simple validation, z.number() is okay if system consistently handles units (e.g. cents).
 */
export const monetaryAmountSchema = z.number({
    invalid_type_error: "Amount must be a number.",
    required_error: "Amount is required."
  })
  .finite({ message: 'Amount must be a finite number.' })
  .refine(val => !isNaN(val), { message: 'Amount must be a valid number' });

/**
 * Transaction types/categories
 */
export const transactionCategoryType = [
  'JOURNAL_ENTRY',
  'SALES_INVOICE',
  'CUSTOMER_PAYMENT',
  'PURCHASE_BILL',
  'BILL_PAYMENT',
  'EXPENSE_REPORT',
  'BANK_DEPOSIT',
  'BANK_TRANSFER',
  'CREDIT_MEMO',
  'DEBIT_MEMO',
  'GENERAL_ADJUSTMENT',
  'OPENING_BALANCE',
  'BANK_TRANSACTION_IMPORT',
  'LOAN_DISBURSEMENT',
  'LOAN_PAYMENT',
  'DEPRECIATION_EXPENSE',
  'AMORTIZATION_EXPENSE',
  'OWNER_CONTRIBUTION',
  'OWNER_DRAW',
  'PAYROLL_EXPENSE',
  'OTHER_TRANSACTION',
] as const;

export const transactionCategorySchema = z.enum(transactionCategoryType, {
  errorMap: () => ({ message: "Invalid transaction category." })
});

/**
 * Transaction status types
 */
export const transactionStatusSchema = z.enum([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'POSTED',
  'REJECTED',
  'VOIDED',
  'RECONCILED',
  'FAILED_POSTING',
  'SCHEDULED',
], { errorMap: () => ({ message: "Invalid transaction status." }) });

/**
 * Schema for external reference details
 */
export const externalReferenceSchema = z.object({
  type: z.string().max(50, "Reference type too long."),
  ref_id: z.string().max(100, "Reference ID too long."),
  ref_url: z.string().url("Invalid reference URL.").max(512).optional().nullable(),
  description: z.string().max(255, "Reference description too long.").optional().nullable(),
});

// ----------------
// Transaction Entry (Line Item) Schema
// ----------------

export const transactionLineSchema = z.object({
  account_id: z.string().uuid({ message: 'Account ID must be a valid UUID.' }),
  amount: monetaryAmountSchema
    .refine(val => val >= 0, { message: 'Line amount must be non-negative. Direction is set by entryType.' }),
  entry_type: z.enum(['DEBIT', 'CREDIT'], {
    required_error: "Entry type (DEBIT or CREDIT) is required.",
    errorMap: () => ({ message: "Entry type must be DEBIT or CREDIT." })
  }),
  description: z.string().max(255, "Line description is too long.").optional().nullable(),
  tax_code_id: z.string().max(50, "Tax code is too long.").optional().nullable(),
});
export type TransactionLineInput = z.infer<typeof transactionLineSchema>;

// ----------------
// Main Transaction Schema
// ----------------

export const baseTransactionSchema = z.object({
  entity_id: z.string().uuid({ message: 'Primary Entity ID for the transaction is required.' }),
  transaction_date: z.string().datetime({ message: "Transaction date must be a valid date/time." }),
  posting_date: z.string().datetime({ message: "Posting date must be a valid date/time." }).optional().nullable(),
  category: transactionCategorySchema,
  description: z.string().min(1, "Description is required.").max(500, "Description is too long."),
  reference_number: z.string().max(100, "Reference number is too long.").optional().nullable(),
  currency_code: z.string().length(3, 'Currency code must be 3 characters (ISO 4217).').default('USD'),
  lines: z.array(transactionLineSchema)
    .min(2, { message: 'Transaction must have at least two lines (debit and credit).' })
    .max(100, { message: 'Transaction cannot have more than 100 lines for performance.' }),
  status: transactionStatusSchema.default('DRAFT'),
  tags: z.array(z.string().max(50, "Tag is too long.")).max(10, "Maximum 10 tags allowed.").optional().nullable(),
  internal_notes: z.string().max(2000, "Internal notes are too long.").optional().nullable(),
});

export const createTransactionInputSchema = baseTransactionSchema;
export const updateTransactionInputSchema = baseTransactionSchema.partial();

export const transactionSchema = baseTransactionSchema.extend({
  id: z.string().uuid({ message: 'Transaction ID must be a valid UUID.' }),
  created_at: z.preprocess(arg => typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg, z.date()),
  updated_at: z.preprocess(arg => typeof arg === 'string' || typeof arg === 'number' ? new Date(arg) : arg, z.date()),
  created_by_user_id: z.string().uuid({ message: "Creator User ID must be valid." }),
}).refine(data => {
  const debits = data.lines.filter(l => l.entry_type === 'DEBIT').reduce((sum, l) => sum + l.amount, 0);
  const credits = data.lines.filter(l => l.entry_type === 'CREDIT').reduce((sum, l) => sum + l.amount, 0);
  return Math.abs(debits - credits) < 0.001;
}, {
  message: "Transaction is not balanced: total debits must equal total credits.",
  path: ["lines"],
});

export type TransactionInput = z.infer<typeof createTransactionInputSchema>;
export type TransactionUpdateInput = z.infer<typeof updateTransactionInputSchema>;
export type Transaction = z.infer<typeof transactionSchema>;

// ----------------
// Validation Helper
// ----------------

/**
 * Validates that the sum of debit amounts equals the sum of credit amounts for a transaction's lines.
 * @param lines - An array of transaction lines.
 * @returns True if balanced, false otherwise.
 */
export function areTransactionLinesBalanced(lines: TransactionLineInput[]): boolean {
  if (!lines || lines.length < 2) return false;

  const debits = lines
    .filter(entry => entry.entry_type === 'DEBIT')
    .reduce((sum, entry) => sum + entry.amount, 0);

  const credits = lines
    .filter(entry => entry.entry_type === 'CREDIT')
    .reduce((sum, entry) => sum + entry.amount, 0);

  return Math.abs(debits - credits) < 0.001;
}

export const createTransactionSchemaBalanced = createTransactionInputSchema.refine(
  data => areTransactionLinesBalanced(data.lines),
  {
    message: "Transaction is not balanced: total debits must equal total credits.",
    path: ["lines"],
  }
);

export const updateTransactionSchemaBalanced = updateTransactionInputSchema.superRefine((data, ctx) => {
  if (data.lines && data.lines.length > 0 && !areTransactionLinesBalanced(data.lines)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Transaction is not balanced: total debits must equal total credits.",
      path: ["lines"],
    });
  }
});

export function validateTransactionCreationData(
  data: unknown
): z.SafeParseReturnType<TransactionInput, TransactionInput> {
  return createTransactionSchemaBalanced.safeParse(data);
}

export function validateTransactionUpdateData(
  data: unknown
): z.SafeParseReturnType<Partial<TransactionInput>, Partial<TransactionInput>> {
  return updateTransactionSchemaBalanced.safeParse(data);
}

export default {
  transactionSchema,
  createTransactionInputSchema: createTransactionSchemaBalanced,
  updateTransactionInputSchema: updateTransactionSchemaBalanced,
  transactionLineSchema,
  transactionCategorySchema,
  transactionStatusSchema,
  externalReferenceSchema,
  monetaryAmountSchema,
  validateTransactionCreationData,
  validateTransactionUpdateData,
};
