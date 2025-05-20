// src/utils/financial.ts

// Import the Mojo integration bridge
import * as MojoFinancial from '../lib/mojo/common/financial';

/**
 * Represents a precise monetary value.
 * When interacting with Mojo, this might be a string to maintain precision.
 */
export type MonetaryValue = string | number;

/**
 * Adds two monetary values using the Mojo engine.
 * @param a - The first value (string or number)
 * @param b - The second value (string or number)
 * @returns The sum as a string to maintain precision
 */
export async function addPrecise(a: MonetaryValue, b: MonetaryValue): Promise<string> {
  try {
    return await MojoFinancial.add(String(a), String(b));
  } catch (error) {
    console.error('Error in addPrecise:', error);
    // Fallback logic in case Mojo fails
    const valA = parseFloat(String(a));
    const valB = parseFloat(String(b));
    console.warn('addPrecise: Using fallback. Mojo engine failed.');
    return (valA + valB).toString();
  }
}

/**
 * Subtracts one monetary value from another using the Mojo engine.
 * @param a - The value to subtract from (string or number)
 * @param b - The value to subtract (string or number)
 * @returns The difference as a string
 */
export async function subtractPrecise(a: MonetaryValue, b: MonetaryValue): Promise<string> {
  try {
    return await MojoFinancial.subtract(String(a), String(b));
  } catch (error) {
    console.error('Error in subtractPrecise:', error);
    const valA = parseFloat(String(a));
    const valB = parseFloat(String(b));
    console.warn('subtractPrecise: Using fallback. Mojo engine failed.');
    return (valA - valB).toString();
  }
}

/**
 * Multiplies two monetary values using the Mojo engine.
 * @param a - The first value (string or number)
 * @param b - The second value (string or number)
 * @returns The product as a string
 */
export async function multiplyPrecise(a: MonetaryValue, b: MonetaryValue): Promise<string> {
  try {
    return await MojoFinancial.multiply(String(a), String(b));
  } catch (error) {
    console.error('Error in multiplyPrecise:', error);
    const valA = parseFloat(String(a));
    const valB = parseFloat(String(b));
    console.warn('multiplyPrecise: Using fallback. Mojo engine failed.');
    return (valA * valB).toString();
  }
}

/**
 * Divides one monetary value by another using the Mojo engine.
 * @param a - The dividend (string or number)
 * @param b - The divisor (string or number)
 * @param precision - Optional number of decimal places for the result
 * @returns The quotient as a string
 */
export async function dividePrecise(
  a: MonetaryValue,
  b: MonetaryValue,
  precision?: number,
): Promise<string> {
  try {
    return await MojoFinancial.divide(String(a), String(b), precision);
  } catch (error) {
    console.error('Error in dividePrecise:', error);
    const valA = parseFloat(String(a));
    const valB = parseFloat(String(b));
    if (valB === 0) {
      throw new Error('Division by zero');
    }
    console.warn('dividePrecise: Using fallback. Mojo engine failed.');
    const result = valA / valB;
    return precision !== undefined ? result.toFixed(precision) : result.toString();
  }
}

/**
 * Compares two monetary values using the Mojo engine.
 * @param a - The first value
 * @param b - The second value
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export async function comparePrecise(a: MonetaryValue, b: MonetaryValue): Promise<number> {
  try {
    return await MojoFinancial.compare(String(a), String(b));
  } catch (error) {
    console.error('Error in comparePrecise:', error);
    const valA = parseFloat(String(a));
    const valB = parseFloat(String(b));
    console.warn('comparePrecise: Using fallback. Mojo engine failed.');
    if (valA < valB) return -1;
    else if (valA > valB) return 1;
    else return 0;
  }
}

/**
 * Rounds a monetary value to a specified number of decimal places.
 * @param value - The value to round
 * @param decimalPlaces - Number of decimal places (default: 2)
 * @returns The rounded value as a string
 */
export async function roundPrecise(value: MonetaryValue, decimalPlaces: number = 2): Promise<string> {
  try {
    return await MojoFinancial.round(String(value), decimalPlaces);
  } catch (error) {
    console.error('Error in roundPrecise:', error);
    console.warn('roundPrecise: Using fallback. Mojo engine failed.');
    return parseFloat(String(value)).toFixed(decimalPlaces);
  }
}

/**
 * Formats a monetary value as a currency string.
 * This function can remain in JavaScript as it's for presentation.
 * @param value - The monetary value (string or number)
 * @param currencyCode - The ISO currency code (e.g., 'USD', 'EUR'). Defaults to 'USD'
 * @param locale - The locale for formatting (e.g., 'en-US'). Defaults to 'en-US'
 * @param minimumFractionDigits - Minimum number of fraction digits. Defaults to 2
 * @param maximumFractionDigits - Maximum number of fraction digits. Defaults to 2
 * @returns The formatted currency string
 */
export function formatCurrency(
  value: MonetaryValue,
  currencyCode: string = 'USD',
  locale: string = 'en-US',
  minimumFractionDigits: number = 2,
  maximumFractionDigits: number = 2,
): string {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numericValue)) {
    return `${currencyCode} NaN`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(numericValue);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `${currencyCode} ${numericValue.toFixed(minimumFractionDigits)}`;
  }
}

/**
 * Parses a formatted currency string into a string representation of a number.
 * @param formattedValue - The formatted currency string
 * @returns The numeric string, or null if parsing fails
 */
export function parseCurrency(formattedValue: string): string | null {
  if (typeof formattedValue !== 'string') {
    return null;
  }
  
  try {
    // Remove currency symbols, group separators, and whitespace
    const cleaned = formattedValue
      .replace(/[$€£¥₽₹₩₺₴₦₱]/g, '') // Common currency symbols
      .replace(/[,\s]/g, ''); // Remove thousand separators and spaces
    
    // Handle parentheses for negative numbers (accounting notation)
    const value = cleaned.match(/^\((.*)\)$/) 
      ? "-" + cleaned.replace(/[()]/g, '')
      : cleaned;
    
    const numericValue = parseFloat(value);
    return isNaN(numericValue) ? null : numericValue.toString();
  } catch (error) {
    console.error('Error parsing currency:', error);
    return null;
  }
}

/**
 * Converts from cents (integer storage) to dollars (decimal representation)
 * @param cents - The amount in cents
 * @returns The amount in dollars as a string
 */
export async function centsToDecimal(cents: number): Promise<string> {
  return await dividePrecise(cents, 100, 2);
}

/**
 * Converts from dollars (decimal representation) to cents (integer storage)
 * @param decimal - The amount in dollars
 * @returns The amount in cents as an integer
 */
export async function decimalToCents(decimal: MonetaryValue): Promise<number> {
  const result = await multiplyPrecise(decimal, 100);
  return Math.round(parseFloat(result));
}