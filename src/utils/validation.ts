// src/utils/validation.ts
/**
 * Validation utilities and Zod schemas.
 *
 * This module provides common validation functions for forms, API inputs,
 * and business logic, primarily leveraging Zod for schema definition and validation.
 */

import { z } from 'zod';

// ----------------
// Common Helper Regexes
// ----------------

/**
 * Email validation regex (based on common practical patterns, not full RFC 5322).
 */
const EMAIL_REGEX = /^[a-zA-Z0-9_!#$%&'*+/=?`{|}~^.-]+@[a-zA-Z0-9.-]+$/; // More permissive for TLDs

/**
 * EIN validation regex (XX-XXXXXXX format).
 */
const EIN_REGEX = /^\d{2}-\d{7}$/;

/**
 * Phone validation regex (supports various common US-style formats, reasonably permissive).
 * Consider a more robust library for comprehensive international phone number validation if needed.
 */
const PHONE_REGEX = /^(?:\+?1[-.\s]?)?(?:\(?([2-9][0-8][0-9])\)?[-.\s]?)?(?:([2-9][0-9]{2})[-.\s]?)([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?$/;

/**
 * Regex for YYYY-MM-DD date string format.
 */
const YYYY_MM_DD_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// ----------------
// Common Standalone Validator Functions (can be used with Zod's .refine or independently)
// ----------------

/**
 * Validates an email address string.
 * @param email The email string to validate.
 * @returns True if the email is in a valid format, false otherwise.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Validates an EIN (Employer Identification Number) string.
 * @param ein The EIN string to validate (expects XX-XXXXXXX format).
 * @returns True if the EIN is in the correct format, false otherwise.
 */
export function isValidEIN(ein: string): boolean {
  if (!ein || typeof ein !== 'string') return false;
  return EIN_REGEX.test(ein);
}

/**
 * Validates a phone number string (primarily US-style).
 * @param phone The phone number string to validate.
 * @returns True if the phone number matches common formats, false otherwise.
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  return PHONE_REGEX.test(phone);
}

/**
 * Validates that a string is not empty after trimming whitespace.
 * @param value The string to validate.
 * @returns True if the string is not empty, false otherwise.
 */
export function isNotEmpty(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates a monetary amount (must be a non-negative number with at most 2 decimal places).
 * @param amount The amount to validate (can be number or string).
 * @returns True if the amount is valid, false otherwise.
 */
export function isValidAmount(amount: number | string): boolean {
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount; // Allow comma as thousands separator
  if (isNaN(num) || num < 0) return false;

  // Check for max 2 decimal places
  const decimalPart = String(num).split('.')[1];
  return !decimalPart || decimalPart.length <= 2;
}

/**
 * Validates an account code (alphanumeric, may include hyphens, specific length).
 * @param code The account code string to validate.
 * @returns True if the account code is valid, false otherwise.
 */
export function isValidAccountCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Z0-9-]+$/i.test(code) && code.length >= 3 && code.length <= 20;
}

// ----------------
// Reusable Zod Schemas (commonSchemas)
// ----------------

export const commonSchemas = {
  /** Validates an email string. */
  email: z.string().email({ message: 'Invalid email address format.' })
    .min(5, { message: "Email must be at least 5 characters."})
    .max(254, { message: "Email must not exceed 254 characters."}),

  /** Validates a password string with common complexity requirements. */
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters long.' })
    .max(128, { message: 'Password must not exceed 128 characters.'})
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number.' })
    .regex(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character.'}), // Common requirement

  /** Validates an EIN string (XX-XXXXXXX). */
  ein: z.string().regex(EIN_REGEX, { message: 'Invalid EIN format. Expected XX-XXXXXXX.' }),

  /** Validates a phone number string (US-style). */
  phone: z.string().regex(PHONE_REGEX, { message: 'Invalid phone number format.' }),

  /** Validates a non-negative monetary amount with up to 2 decimal places. */
  amount: z.number()
    .nonnegative({ message: 'Amount must be a non-negative number.' })
    .multipleOf(0.01, { message: 'Amount can have at most 2 decimal places.' }),

  /** Validates an account code string. */
  accountCode: z.string()
    .min(3, { message: 'Account code must be 3 to 20 characters.' })
    .max(20, { message: 'Account code must be 3 to 20 characters.' })
    .regex(/^[a-zA-Z0-9-]+$/i, { message: 'Account code can only contain letters, numbers, and hyphens.' }),

  /** Validates a date string in YYYY-MM-DD format and ensures it's a valid date. */
  dateString: z.string()
    .regex(YYYY_MM_DD_REGEX, { message: 'Date must be in YYYY-MM-DD format.' })
    .refine((val) => {
        const date = new Date(val + 'T00:00:00Z'); // Parse as UTC to avoid timezone issues with Date.parse
        return !isNaN(date.getTime()) && date.toISOString().startsWith(val);
      }, 
      { message: 'Invalid date.' }
    ),
  
  /** Validates a URL string. */
  url: z.string().url({ message: 'Invalid URL format.' }),

  /** Validates a UUID string. */
  uuid: z.string().uuid({ message: 'Invalid UUID format.' }),
};

// ----------------
// Form Validation Utility
// ----------------

/**
 * Validates form data against a Zod schema and returns formatted errors for UI display.
 * @template T The expected type of the validated data.
 * @param schema The Zod schema to validate against.
 * @param data The unknown data to validate (typically from a form).
 * @returns An object indicating success or failure, with data or formatted errors.
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format Zod errors into a more UI-friendly structure: Record<fieldPath, messages[]>
  const errors: Record<string, string[]> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.'); // e.g., "address.street"
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  });

  return { success: false, errors };
}

// ----------------
// Business Rule Validators (Domain-Specific)
// ----------------

/**
 * Validates that debits equal credits for a transaction's lines.
 * @param lines An array of transaction lines, each with an amount and isDebit flag.
 * @returns True if the transaction is balanced, false otherwise.
 */
export function isBalancedTransaction(lines: Array<{ amount: number; isDebit: boolean }>): boolean {
  if (!lines || lines.length < 2) return false; // Must have at least two lines to balance

  const totals = lines.reduce(
    (acc, line) => {
      const amount = line.amount || 0; // Ensure amount is a number
      if (line.isDebit) {
        acc.debits += amount;
      } else {
        acc.credits += amount;
      }
      return acc;
    },
    { debits: 0, credits: 0 }
  );

  // Account for potential floating-point precision issues with monetary values.
  // Compare with a small epsilon.
  return Math.abs(totals.debits - totals.credits) < 0.0001; // Adjusted epsilon for typical currency
}

/**
 * Validates a fiscal year (e.g., between 1900 and current year + 10).
 * @param year The fiscal year number to validate.
 * @returns True if the fiscal year is within a reasonable range, false otherwise.
 */
export function isValidFiscalYear(year: number): boolean {
  const currentYear = new Date().getFullYear();
  return Number.isInteger(year) && year >= 1900 && year <= currentYear + 10;
}

/**
 * Validates an interest rate (percentage, e.g., 0 to 100).
 * @param rate The interest rate number to validate.
 * @returns True if the interest rate is within the 0-100 range, false otherwise.
 */
export function isValidInterestRate(rate: number): boolean {
  // Assumes rate is a percentage, e.g., 5 for 5%, not 0.05
  return typeof rate === 'number' && !isNaN(rate) && rate >= 0 && rate <= 100;
}

// ----------------
// Sanitization Utilities (Basic examples)
// ----------------

/**
 * Basic sanitization for a string intended for safe HTML display (escapes common HTML chars).
 * For robust XSS protection, rely on framework templating escaping or dedicated libraries.
 * @param str The string to sanitize.
 * @returns The sanitized string.
 */
export function sanitizeStringForHtml(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;') // Some prefer &#39;
    .replace(/\//g, '&#x2F;'); // Helps prevent breaking out of script tags in some contexts
}

/**
 * Sanitizes and formats an account code to uppercase and removes invalid characters.
 * @param code The account code string.
 * @returns The sanitized and formatted account code.
 */
export function sanitizeAndFormatAccountCode(code: string | null | undefined): string {
  if (!code) return '';
  return String(code).toUpperCase().replace(/[^A-Z0-9-]/g, '').substring(0, 20); // Max length from commonSchemas
}

/**
 * Sanitizes and formats an EIN to XX-XXXXXXX.
 * @param ein The EIN string.
 * @returns The formatted EIN string or original if not 9 digits.
 */
export function sanitizeAndFormatEIN(ein: string | null | undefined): string {
  if (!ein) return '';
  const digits = String(ein).replace(/\D/g, ''); // Remove all non-digits
  if (digits.length === 9) {
    return `${digits.substring(0, 2)}-${digits.substring(2)}`;
  }
  return String(ein); // Return original if not exactly 9 digits after cleaning
}

// ----------------
// Composite Zod Schemas (Application-Specific)
// ----------------

// Re-exporting from `src/types/validation.d.ts` or defining here as per project structure
// Assuming these are defined in `src/types/validation.d.ts` and re-exported or used directly
// For this example, let's assume they are defined or imported elsewhere if this file focuses on common utils.
// If they are meant to live here, they would use the commonSchemas defined above.
// e.g.
// export const EntityInputSchema = z.object({
//   name: z.string().min(1, validationMessages.required('Name')),
//   type: z.enum(['individual', 'company', 'trust', 'partnership', 'property', 'tenant', 'vendor']),
//   ein: commonSchemas.ein.optional().nullable(),
//   // ... more fields
// });

// export const TransactionLineInputSchema = z.object({
//   entity_account_id: commonSchemas.uuid,
//   amount: commonSchemas.amount,
//   is_debit: z.boolean(),
//   // ... more fields
// });

// export const TransactionInputSchema = z.object({
//   entity_id: commonSchemas.uuid,
//   date: commonSchemas.dateString.transform((val) => Math.floor(new Date(val + 'T00:00:00Z').getTime() / 1000)), // Example transform to Unix timestamp
//   description: z.string().min(1, validationMessages.required('Description')),
//   lines: z.array(TransactionLineInputSchema).min(2, "Transaction must have at least 2 lines")
//     .refine(isBalancedTransaction, { message: "Transaction must balance (debits must equal credits)" })
//   // ... more fields
// });


// ----------------
// Validation Error Messages (Example)
// ----------------

/**
 * Common validation error messages.
 * Can be used with Zod schema messages or custom validation logic.
 */
export const validationMessages = {
  required: (field: string): string => `${field} is required.`,
  invalid: (field: string): string => `The value provided for ${field} is invalid.`,
  tooShort: (field: string, min: number): string => `${field} must be at least ${min} characters.`,
  tooLong: (field: string, max: number): string => `${field} must not exceed ${max} characters.`,
  outOfRange: (field: string, min: number | string, max: number | string): string => `${field} must be between ${min} and ${max}.`,
  mustMatch: (field1: string, field2: string): string => `${field1} must match ${field2}.`,
  numeric: (field: string): string => `${field} must be a number.`,
  positive: (field: string): string => `${field} must be a positive number.`,
  nonNegative: (field: string): string => `${field} must be a non-negative number.`,
  integer: (field: string): string => `${field} must be an integer.`,
};