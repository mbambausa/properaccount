// src/utils/validation.ts
/**
 * Validation utilities
 * 
 * Provides common validation functions for forms, API inputs,
 * and business logic throughout the application.
 */

import { z } from 'zod';

// ----------------
// Common Validators
// ----------------

/**
 * Email validation regex (RFC 5322 simplified)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * EIN validation regex (XX-XXXXXXX format)
 */
const EIN_REGEX = /^\d{2}-\d{7}$/;

/**
 * Phone validation regex (supports various formats)
 */
const PHONE_REGEX = /^(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;

/**
 * Validates an email address
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Validates an EIN (Employer Identification Number)
 */
export function isValidEIN(ein: string): boolean {
  return EIN_REGEX.test(ein);
}

/**
 * Validates a phone number
 */
export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}

/**
 * Validates that a string is not empty after trimming
 */
export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Validates a monetary amount (positive, max 2 decimal places)
 */
export function isValidAmount(amount: number | string): boolean {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num < 0) return false;
  
  // Check for max 2 decimal places
  const decimalPart = num.toString().split('.')[1];
  return !decimalPart || decimalPart.length <= 2;
}

/**
 * Validates an account code (alphanumeric, may include hyphens)
 */
export function isValidAccountCode(code: string): boolean {
  return /^[A-Z0-9-]+$/i.test(code) && code.length >= 3 && code.length <= 20;
}

// ----------------
// Zod Schemas
// ----------------

/**
 * Common field schemas for reuse
 */
export const commonSchemas = {
  email: z.string().email('Invalid email address'),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  
  ein: z.string().regex(EIN_REGEX, 'Invalid EIN format (XX-XXXXXXX)'),
  
  phone: z.string().regex(PHONE_REGEX, 'Invalid phone number'),
  
  amount: z.number()
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places'),
  
  accountCode: z.string()
    .min(3, 'Account code must be at least 3 characters')
    .max(20, 'Account code must be at most 20 characters')
    .regex(/^[A-Z0-9-]+$/i, 'Account code can only contain letters, numbers, and hyphens'),
  
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  
  url: z.string().url('Invalid URL'),
};

// ----------------
// Form Validation
// ----------------

/**
 * Validates form data against a schema and returns formatted errors
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  // Format errors for easy display
  const errors: Record<string, string[]> = {};
  
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  });
  
  return { success: false, errors };
}

// ----------------
// Business Rules
// ----------------

/**
 * Validates that debits equal credits for a transaction
 */
export function isBalancedTransaction(lines: Array<{ amount: number; isDebit: boolean }>): boolean {
  const totals = lines.reduce(
    (acc, line) => {
      if (line.isDebit) {
        acc.debits += line.amount;
      } else {
        acc.credits += line.amount;
      }
      return acc;
    },
    { debits: 0, credits: 0 }
  );
  
  // Account for floating point precision
  return Math.abs(totals.debits - totals.credits) < 0.01;
}

/**
 * Validates a fiscal year
 */
export function isValidFiscalYear(year: number): boolean {
  const currentYear = new Date().getFullYear();
  return year >= 1900 && year <= currentYear + 10;
}

/**
 * Validates interest rate (0-100%)
 */
export function isValidInterestRate(rate: number): boolean {
  return rate >= 0 && rate <= 100;
}

// ----------------
// Sanitization
// ----------------

/**
 * Sanitizes a string for safe display (prevents XSS)
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes and formats an account code
 */
export function sanitizeAccountCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

/**
 * Sanitizes and formats an EIN
 */
export function sanitizeEIN(ein: string): string {
  const digits = ein.replace(/\D/g, '');
  if (digits.length === 9) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return ein;
}

// ----------------
// Composite Validators
// ----------------

/**
 * Validates a complete entity
 */
export const entitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['individual', 'company', 'trust', 'partnership', 'property', 'tenant', 'vendor']),
  ein: commonSchemas.ein.optional(),
  address: z.string().optional(),
  businessType: z.string().optional(),
  isActive: z.boolean().default(true),
});

/**
 * Validates a transaction input
 */
export const transactionSchema = z.object({
  entityId: z.string().uuid(),
  date: commonSchemas.date,
  description: z.string().min(1, 'Description is required'),
  lines: z.array(z.object({
    accountId: z.string().uuid(),
    amount: commonSchemas.amount,
    isDebit: z.boolean(),
    memo: z.string().optional(),
  })).min(2, 'Transaction must have at least 2 lines')
    .refine(isBalancedTransaction, 'Transaction must be balanced'),
});

// ----------------
// Error Messages
// ----------------

/**
 * Common validation error messages
 */
export const validationMessages = {
  required: (field: string) => `${field} is required`,
  invalid: (field: string) => `${field} is invalid`,
  tooShort: (field: string, min: number) => `${field} must be at least ${min} characters`,
  tooLong: (field: string, max: number) => `${field} must be at most ${max} characters`,
  outOfRange: (field: string, min: number, max: number) => `${field} must be between ${min} and ${max}`,
  mustMatch: (field1: string, field2: string) => `${field1} must match ${field2}`,
};