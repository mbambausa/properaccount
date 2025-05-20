// src/lib/accounting/utils.ts
/**
 * Utilities for handling numeric conversions between different representations
 * in the accounting system. Ensures consistency between database storage format
 * and application logic format.
 */

import { MojoDecimal, newMojoDecimal, RoundingMode } from '../mojo/common/financial';

/**
 * Converts a monetary amount in cents (used in database) to a MojoDecimal object.
 * 
 * @param cents Integer amount in cents (e.g., 12345 for $123.45)
 * @returns A MojoDecimal representation of the amount in dollars
 */
export function centsToMojoDecimal(cents: number): MojoDecimal {
  // Check for invalid input
  if (!Number.isInteger(cents)) {
    console.warn('centsToMojoDecimal received non-integer cents value:', cents);
  }
  
  // Convert cents to dollars by dividing by 100
  return newMojoDecimal(cents / 100);
}

/**
 * Converts a MojoDecimal amount (used in application logic) to cents for database storage.
 * Uses GAAP-compliant rounding (banker's rounding / round half to even).
 * 
 * @param value MojoDecimal amount in dollars
 * @returns Integer amount in cents for database storage
 */
export function mojoDecimalToCents(value: MojoDecimal): number {
  // Use GAAP-compliant rounding (ROUND_HALF_EVEN)
  const dollarAmount = value.toFixed(2, RoundingMode.ROUND_HALF_EVEN);
  return Math.round(parseFloat(dollarAmount) * 100);
}

/**
 * Safely converts a value to MojoDecimal regardless of input type.
 * Handles numbers, strings, or existing MojoDecimal instances.
 * 
 * @param value Number, string, or MojoDecimal to convert
 * @returns A MojoDecimal representation of the value
 */
export function toMojoDecimal(value: number | string | MojoDecimal): MojoDecimal {
  if (value instanceof MojoDecimal) {
    return value;
  }
  return newMojoDecimal(value);
}

/**
 * Determines if two monetary amounts are equal within a small tolerance
 * to account for floating-point rounding errors.
 * 
 * @param a First amount
 * @param b Second amount
 * @param tolerance Maximum allowed difference (default: 0.001)
 * @returns True if the amounts are effectively equal
 */
export function areMonetaryAmountsEqual(
  a: number | string | MojoDecimal,
  b: number | string | MojoDecimal,
  tolerance: number = 0.001
): boolean {
  const aDecimal = toMojoDecimal(a);
  const bDecimal = toMojoDecimal(b);
  const difference = aDecimal.minus(bDecimal).abs();
  
  return difference.toNumber() < tolerance;
}

/**
 * Checks if a transaction is balanced (debits equal credits)
 * with tolerance for small rounding differences.
 * 
 * @param lines Array of transaction lines with amount and isDebit properties
 * @param tolerance Maximum allowed difference (default: 0.01)
 * @returns True if the transaction is balanced
 */
export function isTransactionBalanced(
  lines: Array<{ amount: string | number; isDebit: boolean }>,
  tolerance: number = 0.01
): boolean {
  let totalDebits = newMojoDecimal(0);
  let totalCredits = newMojoDecimal(0);
  
  for (const line of lines) {
    const amount = toMojoDecimal(line.amount);
    if (line.isDebit) {
      totalDebits = totalDebits.plus(amount);
    } else {
      totalCredits = totalCredits.plus(amount);
    }
  }
  
  const difference = totalDebits.minus(totalCredits).abs();
  return difference.toNumber() < tolerance;
}

/**
 * Normalizes a dollar amount string to a standard format
 * (removes currency symbols, commas, etc.)
 * 
 * @param amountStr String representing a dollar amount (e.g., "$1,234.56")
 * @returns Normalized number string (e.g., "1234.56")
 */
export function normalizeAmountString(amountStr: string): string {
  // Remove currency symbols, commas, and other non-numeric characters
  // except for decimal point and negative sign
  return amountStr.replace(/[^0-9.-]/g, '');
}