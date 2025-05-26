// src/types/validation.d.ts
/**
 * Exports TypeScript types inferred from the Zod schemas defined in `src/utils/validation.ts`.
 * This provides static types for validated data structures throughout the application.
 * It may also define other validation-related type structures if needed.
 */

import { z } from 'zod';

// Import your Zod schemas from the utility file
// Adjust the import path if your `validation.ts` is located elsewhere relative to `src/types`
// Assuming `validation.ts` is in `../utils/validation`
import {
  MoneySchema,
  PercentageSchema,
  InterestRateSchema,
  UUIDSchema,
  EINSchema,
  SSNSchema,
  PhoneSchema,
  PropertyAddressSchema,
  DateStringSchema,
  FiscalYearEndSchema,
  PropertyTypeSchema,
  UnitStatusSchema,
  LeaseStatusSchema,
  AccountSystemTypeSchema,
  TransactionStatusSchema,
  EntityInputSchema as ZodEntityInputSchema, // Alias to avoid name clash if needed
  TransactionLineInputSchema as ZodTransactionLineInputSchema,
  TransactionInputSchema as ZodTransactionInputSchema,
  CreatePropertyRequestSchema as ZodCreatePropertyRequestSchema,
  CreateLeaseRequestSchema as ZodCreateLeaseRequestSchema,
  LoanInputSchema as ZodLoanInputSchema
  // Import other Zod schemas from `src/utils/validation.ts` as needed
} from '../utils/validation'; // Adjust path as necessary

// --- Inferred Types from Common Zod Schemas ---
export type Money = z.infer<typeof MoneySchema>;
export type Percentage = z.infer<typeof PercentageSchema>;
export type InterestRate = z.infer<typeof InterestRateSchema>;
export type UUID = z.infer<typeof UUIDSchema>;
export type EIN = z.infer<typeof EINSchema>;
export type SSN = z.infer<typeof SSNSchema>;
export type Phone = z.infer<typeof PhoneSchema>;
export type PropertyAddress = z.infer<typeof PropertyAddressSchema>;
export type DateString = z.infer<typeof DateStringSchema>; // YYYY-MM-DD
export type FiscalYearEndString = z.infer<typeof FiscalYearEndSchema>; // MM-DD

// --- Inferred Types from Domain-Specific Zod Schemas ---

// Real Estate Specific Enums (if not already defined in other .d.ts, Zod enums become literal unions)
export type PropertyTypeValidation = z.infer<typeof PropertyTypeSchema>;
export type UnitStatusValidation = z.infer<typeof UnitStatusSchema>;
export type LeaseStatusValidation = z.infer<typeof LeaseStatusSchema>;

// Accounting Specific Enums
export type AccountSystemTypeValidation = z.infer<typeof AccountSystemTypeSchema>;
export type TransactionStatusValidation = z.infer<typeof TransactionStatusSchema>;

// Inferred types from composite Zod schemas
// These match the structure defined by your Zod schemas for input validation.
// They can be used as the type for data *after* it has been successfully validated by Zod.

/** Validated structure for Entity input (create/update). */
export type ValidatedEntityInput = z.infer<typeof ZodEntityInputSchema>;

/** Validated structure for a single transaction line input. */
export type ValidatedTransactionLineInput = z.infer<typeof ZodTransactionLineInputSchema>;

/** Validated structure for a new transaction input (header + lines). */
export type ValidatedTransactionInput = z.infer<typeof ZodTransactionInputSchema>;

/** Validated structure for creating a new property. */
export type ValidatedCreatePropertyRequest = z.infer<typeof ZodCreatePropertyRequestSchema>;

/** Validated structure for creating a new lease. */
export type ValidatedCreateLeaseRequest = z.infer<typeof ZodCreateLeaseRequestSchema>;

/** Validated structure for loan input (create/update). */
export type ValidatedLoanInput = z.infer<typeof ZodLoanInputSchema>;

// --- Other Validation-Related Types ---

/**
 * Structure for formatted validation errors, often used by UI components.
 * This aligns with the output of `validateForm` in `src/utils/validation.ts`.
 * Could also be imported from `api.d.ts` if `ValidationErrors` there is preferred.
 */
export interface FormattedValidationErrors {
  [fieldPath: string]: string[]; // Key is dot-notated path to field, value is array of error messages
}

/**
 * Result type for a validation operation.
 * @template T The type of the data if validation is successful.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: FormattedValidationErrors }; // Or use z.ZodError directly if preferred for raw errors

// Example of a type for a function that performs validation using a Zod schema:
export type ValidatorFn<S extends z.ZodTypeAny> = (data: unknown) => ValidationResult<z.infer<S>>;

// You might also define types for specific business rule validation outcomes if they are complex
// and not just boolean results.

// Example: If you had a Zod schema for ChartOfAccountInput in `src/utils/validation.ts`
// import { ChartOfAccountInputSchema } from '../utils/validation';
// export type ValidatedChartOfAccountInput = z.infer<typeof ChartOfAccountInputSchema>;