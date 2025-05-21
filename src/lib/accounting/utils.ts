/* src/lib/accounting/utils.ts */
/**
 * Utilities for handling numeric conversions between different representations
 * in the accounting system. Ensures consistency between database storage format
 * and application logic format.
 */

// Import MojoDecimal utilities and the shared RoundingMode from financial.ts
import { MojoDecimal, newMojoDecimal, RoundingMode } from './financial';

/**
 * Converts a monetary amount in cents (integer, used in database) to a MojoDecimal object
 * representing the value in main currency units (e.g., dollars).
 *
 * @param cents Integer amount in cents (e.g., 12345 for $123.45)
 * @returns A MojoDecimal representation of the amount.
 */
export function centsToMojoDecimal(cents: number): MojoDecimal {
  if (!Number.isInteger(cents)) {
    console.warn(`centsToMojoDecimal received non-integer cents value: ${cents}. Precision may be affected if it's already a float.`);
  }
  return newMojoDecimal(cents)
    .dividedBy(newMojoDecimal(100), 25, RoundingMode.ROUND_HALF_EVEN);
}

/**
 * Converts a MojoDecimal amount (used in application logic, representing main currency units)
 * to an integer number of cents for database storage.
 * Uses specified rounding mode, defaulting to GAAP-compliant rounding (ROUND_HALF_EVEN).
 *
 * @param value MojoDecimal amount (e.g., representing dollars).
 * @param roundingMode The rounding mode to apply.
 * @returns Integer amount in cents.
 */
export function mojoDecimalToCents(
  value: MojoDecimal,
  roundingMode: RoundingMode = RoundingMode.ROUND_HALF_EVEN
): number {
  if (!(value instanceof MojoDecimal)) {
    throw new Error("mojoDecimalToCents expects a MojoDecimal instance.");
  }
  const centsValueDecimal = value.times(newMojoDecimal(100));
  const roundedCentsString = centsValueDecimal.toFixed(0, roundingMode);
  return parseInt(roundedCentsString, 10);
}

/**
 * Safely converts a value (number, string, or existing MojoDecimal) to a MojoDecimal instance.
 * @param value The value to convert.
 * @returns A MojoDecimal instance.
 */
export function toMojoDecimal(value: number | string | MojoDecimal): MojoDecimal {
  if (value instanceof MojoDecimal) {
    return value;
  }
  return newMojoDecimal(value);
}

/**
 * Determines if two monetary amounts are effectively equal within a small tolerance.
 * Performs comparison using MojoDecimal for precision.
 *
 * @param a First amount (number, string, or MojoDecimal).
 * @param b Second amount (number, string, or MojoDecimal).
 * @param tolerance Maximum allowed difference as a JS number.
 * @returns True if the amounts are considered equal within the tolerance.
 */
export function areMonetaryAmountsEqual(
  a: number | string | MojoDecimal,
  b: number | string | MojoDecimal,
  tolerance: number = 0.000001
): boolean {
  const aDecimal = toMojoDecimal(a);
  const bDecimal = toMojoDecimal(b);
  const difference = aDecimal.minus(bDecimal).abs();
  return difference.toNumber() < tolerance;
}

/**
 * Checks if a transaction's lines are balanced (total debits equal total credits).
 * Uses MojoDecimal for calculations and allows for a small tolerance.
 *
 * @param lines Array of transaction lines. Each line must have 'amount' and 'isDebit'.
 * @param tolerance Maximum allowed difference between total debits and credits.
 * @returns True if the transaction is balanced within the tolerance.
 */
export function isTransactionBalanced(
  lines: Array<{ amount: string | number; isDebit: boolean }>,
  tolerance: number = 0.000001
): boolean {
  if (!lines || lines.length < 2) {
    return lines.length === 0;
  }

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
 * Normalizes a currency amount string by removing common currency symbols and group separators.
 * Leaves the decimal separator and negative sign intact.
 *
 * @param amountStr String representing a monetary amount or numeric value.
 * @returns A cleaned numeric string suitable for parsing.
 */
export function normalizeAmountString(
  amountStr: string | number | null | undefined
): string {
  if (typeof amountStr === 'number') {
    return amountStr.toString();
  }
  if (typeof amountStr !== 'string' || !amountStr.trim()) {
    return "0";
  }
  let normalized = amountStr.replace(/[$\s€£¥]/g, '');
  normalized = normalized.replace(/,/g, '');
  const negativeSign = normalized.startsWith('-') ? '-' : '';
  normalized = normalized.replace(/-/g, '');
  normalized = negativeSign + normalized;
  if (!/^-?\d*(\.\d+)?$/.test(normalized) && normalized !== "") {
    console.warn(`normalizeAmountString produced potentially invalid numeric string: "${normalized}" from input "${amountStr}"`);
  }
  return normalized || "0";
}
