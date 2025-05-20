// src/utils/financial.ts
import Decimal from 'decimal.js';

// Define a project-specific configuration for Decimal.js
// This configuration aims for GAAP compliance with high precision for intermediate calculations
// and Banker's rounding (ROUND_HALF_EVEN).
const PROPERACCOUNT_DECIMAL_CONFIG = {
  precision: 20, // Sufficient precision for most financial calculations.
  rounding: Decimal.ROUND_HALF_EVEN, // Banker's rounding, commonly used in finance.
  toExpNeg: -7, // Default, controls exponential notation for small numbers.
  toExpPos: 21, // Default, controls exponential notation for large numbers.
};

/**
 * Creates a new Decimal instance using a project-specific configuration.
 * This approach avoids modifying the global Decimal.js settings.
 *
 * @param value - The value to convert to a Decimal. Can be a number, string, or another Decimal instance.
 * @returns A new Decimal instance configured for ProperAccount.
 * @throws If the value cannot be converted to a Decimal.
 */
export function newDecimal(value: number | string | Decimal): Decimal {
  const CustomDecimal = Decimal.clone(PROPERACCOUNT_DECIMAL_CONFIG);
  try {
    return new CustomDecimal(value);
  } catch (error) {
    console.error(`Error creating Decimal from value: ${value}`, error);
    // Depending on desired strictness, you might throw a custom error or return Decimal.NaN
    throw new Error(`Invalid input for newDecimal: ${value}`);
  }
}

/**
 * Formats a numerical amount (assumed to be in the main currency unit, e.g., dollars)
 * as a currency string (e.g., "$1,234.50").
 * Ensures the amount is rounded to 2 decimal places using Banker's rounding.
 *
 * @param amount - The amount to format. Can be a number, string, or Decimal instance.
 * @param currency - The ISO 4217 currency code (defaults to 'USD').
 * @returns A string representing the formatted currency value, or an error message if input is invalid.
 */
export function formatCurrency(
  amount: number | string | Decimal,
  currency = 'USD'
): string {
  try {
    const decimalAmount = newDecimal(amount);
    // Ensure the amount is a valid number before formatting
    if (decimalAmount.isNaN()) {
      console.warn(`formatCurrency received an invalid amount: ${amount}`);
      return 'Invalid Amount';
    }
    const num = decimalAmount.toDP(2).toNumber(); // Ensure 2 decimal places
    return new Intl.NumberFormat('en-US', { // Using 'en-US' for consistent formatting, adjust if localization is needed.
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch (error) {
    console.error(`Error formatting currency for amount: ${amount}`, error);
    return 'Formatting Error';
  }
}

/**
 * Formats an integer amount (representing cents) as a currency string (e.g., 12345 cents -> "$123.45").
 *
 * @param cents - The amount in cents (must be an integer).
 * @param currency - The ISO 4217 currency code (defaults to 'USD').
 * @returns A string representing the formatted currency value, or an error message if input is invalid.
 */
export function formatCentsAsCurrency(
  cents: number,
  currency = 'USD'
): string {
  if (!Number.isInteger(cents)) {
    console.warn(
      `formatCentsAsCurrency received a non-integer value for cents: ${cents}. Potential precision issues.`
    );
    // Optionally, you could round `cents` here or throw an error.
    // For now, it proceeds but the warning is important.
  }
  try {
    const dollars = newDecimal(cents).dividedBy(100);
    // `formatCurrency` will handle rounding to 2 decimal places.
    return formatCurrency(dollars, currency);
  } catch (error) {
    console.error(`Error formatting cents as currency for cents: ${cents}`, error);
    return 'Formatting Error';
  }
}

/**
 * Represents a line item in a transaction, used for balancing checks.
 * Assumes 'amount' is always positive and in cents.
 */
interface TransactionLineCents {
  amount: number; // Amount in cents, always positive.
  is_debit: boolean; // True if the line is a debit, false if a credit.
}

/**
 * Checks if a transaction (represented by an array of lines with amounts in cents) is balanced.
 * Total debits must equal total credits.
 *
 * @param lines - An array of transaction lines, where each line has an `amount` (in cents) and `is_debit` flag.
 * @returns True if the transaction is balanced, false otherwise.
 */
export function isTransactionBalancedCents(
  lines: Array<TransactionLineCents>
): boolean {
  if (!lines || lines.length === 0) {
    // An empty transaction or null input might be considered unbalanced or handled as an error.
    // For this function, an empty transaction is technically "balanced" at zero.
    return true; 
  }
  let balance = newDecimal(0);
  for (const line of lines) {
    // Ensure line.amount is a valid number before creating Decimal
    if (typeof line.amount !== 'number' || isNaN(line.amount)) {
        console.warn('isTransactionBalancedCents encountered an invalid amount in lines:', line);
        return false; // Or throw an error, depending on desired strictness
    }
    const amt = newDecimal(line.amount); // Amount is in cents
    balance = line.is_debit ? balance.plus(amt) : balance.minus(amt);
  }
  return balance.isZero();
}

/**
 * Calculates the balance of an account (in cents) based on a series of transaction lines.
 * The calculation depends on the account's normal balance (debit or credit).
 *
 * @param lines - An array of transaction lines affecting the account.
 * @param accountNormalBalance - The normal balance type of the account ('debit' or 'credit').
 * @returns The calculated account balance in cents.
 */
export function calculateAccountBalanceCents(
  lines: Array<TransactionLineCents>,
  accountNormalBalance: 'debit' | 'credit'
): number {
  let balance = newDecimal(0);
  for (const line of lines) {
    if (typeof line.amount !== 'number' || isNaN(line.amount)) {
        console.warn('calculateAccountBalanceCents encountered an invalid amount in lines:', line);
        // Skip this line or throw an error
        continue; 
    }
    const amt = newDecimal(line.amount); // Amount is in cents
    if (accountNormalBalance === 'debit') {
      balance = line.is_debit ? balance.plus(amt) : balance.minus(amt);
    } else { // accountNormalBalance === 'credit'
      balance = !line.is_debit ? balance.plus(amt) : balance.minus(amt);
    }
  }
  // The balance is in cents, return as a number.
  // If the balance could exceed Number.MAX_SAFE_INTEGER, consider returning string or Decimal.
  return balance.toNumber(); 
}
