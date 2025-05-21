// src/lib/validation/schemas/loan.ts
/**
 * Loan Validation Schemas
 *
 * This module provides Zod validation schemas for loan-related operations,
 * aligning with the types defined in src/types/loan.d.ts.
 */

import { z } from 'zod';

// Placeholder for monetaryAmountSchema - ensure this is imported from transaction.ts or a common file
// For fixing current errors, defining a local version.
// Replace with: import { monetaryAmountSchema } from './transaction'; (or common path)
const monetaryAmountSchema = z.number({
    invalid_type_error: "Amount must be a number.",
    required_error: "Amount is required."
  })
  .finite({ message: 'Amount must be a finite number.' })
  .refine(val => !isNaN(val), { message: 'Amount must be a valid number' });
// END Placeholder

// ----------------
// Enums from loan.d.ts
// ----------------

export const loanTypeEnum = z.enum(
  ['mortgage', 'seller_financing', 'related_party', 'other_receivable', 'other_payable', 'line_of_credit'],
  { errorMap: () => ({ message: "Invalid loan type." }) }
);
export type LoanType = z.infer<typeof loanTypeEnum>;

export const loanPaymentFrequencyEnum = z.enum(
  ['monthly', 'quarterly', 'semi_annually', 'annually', 'lump_sum', 'custom', 'interest_only'],
  { errorMap: () => ({ message: "Invalid payment frequency." }) }
);
export type LoanPaymentFrequency = z.infer<typeof loanPaymentFrequencyEnum>;

export const loanStatusEnum = z.enum(
  ['draft', 'pending_approval', 'active', 'past_due', 'in_default', 'paid_off', 'restructured', 'cancelled', 'written_off'],
  { errorMap: () => ({ message: "Invalid loan status." }) }
);
export type LoanStatus = z.infer<typeof loanStatusEnum>;

export const interestRateTypeEnum = z.enum(
  ['fixed', 'variable', 'mixed'],
  { errorMap: () => ({ message: "Invalid interest rate type." }) }
);
export type InterestRateType = z.infer<typeof interestRateTypeEnum>;

export const interestCalculationMethodEnum = z.enum(
  ['simple', 'compound_daily', 'compound_monthly', 'compound_annually', 'amortized_payment'],
  { errorMap: () => ({ message: "Invalid interest calculation method." }) }
);
export type InterestCalculationMethod = z.infer<typeof interestCalculationMethodEnum>;

export const loanScheduleStatusEnum = z.enum(
  ['scheduled', 'paid', 'pending_confirmation', 'skipped', 'missed', 'partially_paid'],
  { errorMap: () => ({ message: "Invalid loan schedule status." }) }
);
export type LoanScheduleStatus = z.infer<typeof loanScheduleStatusEnum>;

const datePreprocess = (arg: unknown) => {
  if (typeof arg === 'string' || typeof arg === 'number' || arg instanceof Date) {
    const date = new Date(arg);
    // Check if the date is valid after construction
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return arg; // Let z.date() handle further validation or invalid type
};

const dateSchema = z.preprocess(datePreprocess, z.date({
  errorMap: (issue, ctx) => {
    if (issue.code === z.ZodIssueCode.invalid_date) {
      return { message: "Invalid date." };
    }
    // Fallback for other issues like invalid_type
    return { message: "Expected a valid date (string, number, or Date object)." };
  }
}));

const optionalDateSchema = z.preprocess(datePreprocess, z.date().nullable().optional());


// ----------------
// Base Loan Object Shape (without .refine for easier .partial/.extend)
// ----------------
const loanObjectShape = {
  entity_id: z.string().uuid({ message: "Entity ID is required and must be a valid UUID." }),
  borrower_name: z.string().max(191, "Borrower name too long.").optional().nullable(),
  lender_name: z.string().max(191, "Lender name too long.").optional().nullable(),
  description: z.string().max(500, "Description too long.").optional().nullable(),
  loan_type: loanTypeEnum,
  original_principal: monetaryAmountSchema.pipe(z.number().positive({ message: "Original principal must be positive." })),
  interest_rate: z.number()
    .min(0, { message: "Interest rate cannot be negative." })
    .max(1, { message: "Interest rate should be a decimal (e.g., 0.05 for 5%). Max 100%." }),
  interest_rate_type: interestRateTypeEnum,
  variable_rate_details: z.string().max(255, "Variable rate details too long.").optional().nullable(),
  calculation_method: interestCalculationMethodEnum,
  origination_date: dateSchema,
  maturity_date: dateSchema,
  payment_frequency: loanPaymentFrequencyEnum,
  scheduled_payment_amount: monetaryAmountSchema.pipe(z.number().positive({ message: "Scheduled payment amount must be positive." })),
  status: loanStatusEnum.default('draft'),
  collateral_description: z.string().max(500, "Collateral description too long.").optional().nullable(),
  collateral_value: monetaryAmountSchema.optional().nullable(),
  next_payment_date: optionalDateSchema,
  last_payment_date: optionalDateSchema,
  last_payment_amount: monetaryAmountSchema.optional().nullable(),
  principal_account_id: z.string().uuid({ message: "Principal account ID must be valid." }).optional().nullable(),
  interest_account_id: z.string().uuid({ message: "Interest account ID must be valid." }).optional().nullable(),
  linked_bank_account_id: z.string().uuid({ message: "Linked bank account ID must be valid." }).optional().nullable(),
  is_receivable: z.boolean({ required_error: "is_receivable field (true/false) is required." }),
  tags: z.array(z.string().max(50)).max(10, "Maximum 10 tags.").optional().nullable(),
  loan_reference_number: z.string().max(100, "Loan reference number too long.").optional().nullable(),
};

export const baseLoanSchema = z.object(loanObjectShape).refine(data => {
    // origination_date and maturity_date are now Date objects after preprocess
    return data.maturity_date > data.origination_date;
  }, {
    message: "Maturity date must be after the origination date.",
    path: ["maturity_date"],
});

/**
 * Schema for creating a new loan.
 */
export const createLoanInputSchema = baseLoanSchema; // It already has the refine

/**
 * Schema for updating an existing loan. All fields are optional.
 * The refine from baseLoanSchema might not apply well if dates are not part of the update.
 * Use superRefine for conditional validation on partial updates.
 */
export const updateLoanInputSchema = z.object(loanObjectShape).partial().superRefine((data, ctx) => {
  if (data.origination_date && data.maturity_date) {
    if (new Date(data.maturity_date) <= new Date(data.origination_date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maturity date must be after the origination date.",
        path: ["maturity_date"],
      });
    }
  }
  // Add other conditional validations for partial updates if needed
});


/**
 * Full loan schema including system-generated fields.
 */
export const loanSchema = z.object(loanObjectShape).extend({
  id: z.string().uuid({ message: "Loan ID must be a valid UUID." }),
  user_id: z.string().uuid({ message: "User ID must be a valid UUID." }),
  current_principal: monetaryAmountSchema,
  created_at: dateSchema, // No need to preprocess again if input is expected to be Date from DB
  updated_at: dateSchema, // No need to preprocess again
}).refine(data => {
    return data.maturity_date > data.origination_date;
  }, {
    message: "Maturity date must be after the origination date (check on full schema).",
    path: ["maturity_date"],
});


// ----------------
// Loan Schedule Entry Schema
// ----------------
export const loanScheduleEntrySchema = z.object({
  id: z.string().uuid(),
  loan_id: z.string().uuid(),
  payment_number: z.number().int().positive(),
  payment_date: dateSchema,
  scheduled_payment: monetaryAmountSchema,
  principal_paid: monetaryAmountSchema,
  interest_paid: monetaryAmountSchema,
  remaining_balance: monetaryAmountSchema, // Can be negative for final payment adjustments
  status: loanScheduleStatusEnum,
  actual_payment_date: optionalDateSchema,
  actual_payment_amount: monetaryAmountSchema.optional().nullable(),
  actual_principal_paid: monetaryAmountSchema.optional().nullable(),
  actual_interest_paid: monetaryAmountSchema.optional().nullable(),
  transaction_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  created_at: dateSchema,
  updated_at: dateSchema,
});

// ----------------
// Loan Payment Input Schema
// ----------------
export const recordLoanPaymentInputSchema = z.object({
  loan_id: z.string().uuid({ message: "Loan ID for the payment is required." }),
  loan_schedule_id: z.string().uuid({ message: "Loan schedule ID must be valid." }).optional().nullable(),
  actual_payment_date: dateSchema,
  actual_payment_amount: monetaryAmountSchema.pipe(z.number().positive({ message: "Payment amount must be positive." })),
  allocation: z.object({
    principal: monetaryAmountSchema.optional(),
    interest: monetaryAmountSchema.optional(),
    escrow: monetaryAmountSchema.optional(),
    fees: monetaryAmountSchema.optional(),
  }).optional(),
  transaction_id: z.string().uuid("Transaction ID must be valid.").optional().nullable(),
  new_schedule_status: loanScheduleStatusEnum.optional(),
  notes: z.string().max(500, "Payment notes too long.").optional().nullable(),
  payment_method: z.string().max(50, "Payment method too long.").optional().nullable(),
});


// Export inferred TypeScript types
export type CreateLoanInput = z.infer<typeof createLoanInputSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanInputSchema>;
export type Loan = z.infer<typeof loanSchema>;
export type LoanScheduleEntry = z.infer<typeof loanScheduleEntrySchema>;
export type RecordLoanPaymentInput = z.infer<typeof recordLoanPaymentInputSchema>;


export default {
  loanTypeEnum,
  loanPaymentFrequencyEnum,
  loanStatusEnum,
  interestRateTypeEnum,
  interestCalculationMethodEnum,
  loanScheduleStatusEnum,
  baseLoanSchema,
  createLoanInputSchema,
  updateLoanInputSchema,
  loanSchema,
  loanScheduleEntrySchema,
  recordLoanPaymentInputSchema,
};