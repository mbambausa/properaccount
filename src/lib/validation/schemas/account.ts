// src/lib/validation/schemas/account.ts
/**
 * Account Validation Schemas (Chart of Accounts Entries)
 *
 * This module provides Zod validation schemas for Chart of Accounts entries,
 * aligning with the D1 'accounts' table and the ChartOfAccount type.
 * Ref: ProperAccount Technical Reference Guide, p.8 (D1 accounts schema)
 * Ref: src/types/accounting.d.ts (ChartOfAccount type)
 */

import { z } from 'zod';

/**
 * Account System Types Enum (Asset, Liability, Equity, Income, Expense)
 * Should match AccountSystemType in src/types/accounting.d.ts
 */
export const accountSystemTypeEnum = z.enum(
  ['asset', 'liability', 'equity', 'income', 'expense'],
  {
    required_error: "Account type is required.",
    errorMap: () => ({ message: "Invalid account type. Must be one of asset, liability, equity, income, or expense." })
  }
);
export type AccountSystemType = z.infer<typeof accountSystemTypeEnum>;

/**
 * Expense Subtypes Enum (optional, for more granular classification)
 * Should match ExpenseSubtype in src/types/accounting.d.ts
 */
export const expenseSubtypeEnum = z.enum(
  ['recoverable', 'non-recoverable', 'other'],
  {
    errorMap: () => ({ message: "Invalid expense subtype." })
  }
);
export type ExpenseSubtype = z.infer<typeof expenseSubtypeEnum>;


/**
 * Base schema for account properties that can be set during creation or update.
 * Excludes system-generated fields like id, entity_id, created_at, updated_at.
 */
export const baseAccountSchema = z.object({
  code: z.string()
    .trim()
    .min(1, { message: "Account code is required." })
    .max(20, { message: "Account code must be 20 characters or less." })
    .regex(/^[a-zA-Z0-9-._]+$/, { message: "Account code can only contain letters, numbers, hyphens, underscores, and periods." }),

  name: z.string()
    .trim()
    .min(1, { message: "Account name is required." })
    .max(100, { message: "Account name must be 100 characters or less." }),

  type: accountSystemTypeEnum,

  subtype: z.string().max(50, "Subtype must be 50 characters or less.").optional().nullable(),
    // Example of conditional subtype based on type:
    // .refine(data => !(data.type === 'expense' && !expenseSubtypeEnum.safeParse(data.subtype).success), {
    //   message: "Invalid subtype for expense account.",
    //   path: ['subtype'],
    // }),

  description: z.string().max(500, "Description must be 500 characters or less.").optional().nullable(),

  is_recoverable: z.boolean().default(false),

  recovery_percentage: z.number()
    .min(0, { message: "Recovery percentage must be between 0 and 100." })
    .max(100, { message: "Recovery percentage must be between 0 and 100." })
    .optional().nullable()
    .refine(val => val === null || val === undefined || val >= 0, { message: "Recovery percentage cannot be negative."}),

  is_active: z.boolean().default(true),

  tax_category: z.string().max(50, "Tax category must be 50 characters or less.").optional().nullable(),

  parent_id: z.string().uuid({ message: "Parent ID must be a valid UUID." }).optional().nullable(),
});

/**
 * Schema for creating a new account.
 * `entity_id` will be added by the service layer, usually from the authenticated context.
 */
export const createAccountInputSchema = baseAccountSchema;

/**
 * Schema for updating an existing account. All fields are optional.
 * `id` and `entity_id` are typically path parameters or from context, not in the update body.
 */
export const updateAccountInputSchema = baseAccountSchema.partial();

/**
 * Full account schema including system-generated fields.
 * This represents an account record as stored in the database or returned by API.
 */
export const accountSchema = baseAccountSchema.extend({
  id: z.string().uuid({ message: "Account ID must be a valid UUID." }),
  entity_id: z.string().uuid({ message: "Entity ID must be a valid UUID." }),
  created_at: z.preprocess((arg) => {
    if (typeof arg === 'string' || typeof arg === 'number') return new Date(arg);
    return arg;
  }, z.date()),
  updated_at: z.preprocess((arg) => {
    if (typeof arg === 'string' || typeof arg === 'number') return new Date(arg);
    return arg;
  }, z.date()),
});

// Export inferred TypeScript types
export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>;
export type Account = z.infer<typeof accountSchema>;

export default {
  accountSystemTypeEnum,
  expenseSubtypeEnum,
  baseAccountSchema,
  createAccountInputSchema,
  updateAccountInputSchema,
  accountSchema,
};