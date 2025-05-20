// src/lib/mojo/common/financial.ts

/**
 * JavaScript Adapter for Mojo BigDecimal Financial Operations.
 *
 * This module provides a JavaScript interface for financial calculations
 * that are intended to be backed by a Mojo WebAssembly (Wasm) module.
 *
 * Placeholder functions for Wasm interaction are included and marked with // TODO: Wasm Integration.
 * These will need to be replaced with actual calls to your compiled Mojo Wasm module.
 *
 * The MojoDecimal class aims to provide a familiar API for BigDecimal operations,
 * similar in spirit to libraries like decimal.js, but powered by Mojo.
 */

// --- Wasm Module Interaction (Placeholders) ---
// TODO: Wasm Integration - Define how the Wasm module is loaded and its functions are accessed.
// This might involve an initialization function that populates `wasmExports`.
interface MojoWasmExports {
  bigDecimalFromString: (s: string) => any; // Returns an opaque handle or internal rep
  bigDecimalFromNumber: (n: number) => any;
  bigDecimalToString: (bdHandle: any) => string;
  bigDecimalToNumber: (bdHandle: any) => number; // May lose precision for very large/small numbers
  bigDecimalAdd: (h1: any, h2: any) => any;
  bigDecimalSubtract: (h1: any, h2: any) => any;
  bigDecimalMultiply: (h1: any, h2: any) => any;
  bigDecimalDivide: (h1: any, h2: any, precision: number, roundingMode: number) => any; // Mojo needs precision/rounding
  bigDecimalIsZero: (bdHandle: any) => boolean;
  bigDecimalEquals: (h1: any, h2: any) => boolean;
  bigDecimalIsPositive: (bdHandle: any) => boolean;
  bigDecimalAbs: (bdHandle: any) => any;
  bigDecimalToFixed: (bdHandle: any, dp: number, roundingMode: number) => string;
  // Add other necessary functions like comparison, rounding modes, etc.
}

// Placeholder for the actual Wasm exports. This would be populated after Wasm instantiation.
let wasmExports: MojoWasmExports | null = null;

// TODO: Wasm Integration - Implement this function
/**
 * Initializes the Mojo Wasm module and populates `wasmExports`.
 * This should be called once during application startup.
 */
export async function initMojoFinancialEngine(wasmPath: string = '/mojo/big_decimal.wasm'): Promise<void> {
  if (wasmExports) {
    console.log('MojoFinancialEngine already initialized.');
    return;
  }
  try {
    // Example: const { instance } = await WebAssembly.instantiateStreaming(fetch(wasmPath), importObject);
    // wasmExports = instance.exports as unknown as MojoWasmExports;
    console.warn(`MojoFinancialEngine: Wasm initialization is a STUB. Implement loading and instantiation of ${wasmPath}.`);
    // For now, stubbing exports for basic functionality demonstration
    wasmExports = {
      bigDecimalFromString: (s: string) => s, // In reality, this would be an opaque handle
      bigDecimalFromNumber: (n: number) => n.toString(),
      bigDecimalToString: (bdHandle: any) => String(bdHandle),
      bigDecimalToNumber: (bdHandle: any) => parseFloat(String(bdHandle)),
      bigDecimalAdd: (h1: any, h2: any) => (parseFloat(String(h1)) + parseFloat(String(h2))).toString(),
      bigDecimalSubtract: (h1: any, h2: any) => (parseFloat(String(h1)) - parseFloat(String(h2))).toString(),
      bigDecimalMultiply: (h1: any, h2: any) => (parseFloat(String(h1)) * parseFloat(String(h2))).toString(),
      bigDecimalDivide: (h1: any, h2: any, _prec: number, _rm: number) => (parseFloat(String(h1)) / parseFloat(String(h2))).toString(),
      bigDecimalIsZero: (bdHandle: any) => parseFloat(String(bdHandle)) === 0,
      bigDecimalEquals: (h1: any, h2: any) => parseFloat(String(h1)) === parseFloat(String(h2)),
      bigDecimalIsPositive: (bdHandle: any) => parseFloat(String(bdHandle)) > 0,
      bigDecimalAbs: (bdHandle: any) => Math.abs(parseFloat(String(bdHandle))).toString(),
      bigDecimalToFixed: (bdHandle: any, dp: number, _rm: number) => parseFloat(String(bdHandle)).toFixed(dp),
    };
    console.log('MojoFinancialEngine STUB initialized.');
  } catch (error) {
    console.error('Failed to initialize MojoFinancialEngine:', error);
    throw new Error('Could not initialize financial calculation engine.');
  }
}

// TODO: Define GAAP-compliant rounding modes if needed by Mojo functions.
// Example: const ROUND_HALF_EVEN = 0; // Align with Mojo's constants

/**
 * Represents a high-precision decimal number, backed by Mojo's BigDecimal.
 * Values are typically stored as strings or opaque handles for Mojo interaction.
 */
export class MojoDecimal {
  // The internal representation. Could be a string, a number (if Wasm converts), or an opaque handle/pointer.
  // For this placeholder, we'll use string to emphasize precision across the boundary.
  private readonly internalValue: any; // Represents the Mojo BigDecimal handle/value

  /**
   * Creates a new MojoDecimal instance.
   * @param value - number or string representation of a number.
   * @throws If the Wasm engine is not initialized or if Mojo conversion fails.
   */
  constructor(value: number | string | MojoDecimal) {
    if (!wasmExports) {
      throw new Error('MojoFinancialEngine not initialized. Call initMojoFinancialEngine() first.');
    }
    if (value instanceof MojoDecimal) {
      this.internalValue = value.internalValue; // Clone or reuse handle
    } else if (typeof value === 'string') {
      this.internalValue = wasmExports.bigDecimalFromString(value);
    } else if (typeof value === 'number') {
      this.internalValue = wasmExports.bigDecimalFromNumber(value);
    } else {
      throw new Error('Invalid value for MojoDecimal constructor.');
    }
  }

  /**
   * Adds another MojoDecimal to this one.
   * @param other - The MojoDecimal to add.
   * @returns A new MojoDecimal instance with the result.
   */
  plus(other: MojoDecimal): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    const resultHandle = wasmExports.bigDecimalAdd(this.internalValue, other.internalValue);
    return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle)); // Assuming string roundtrip or handle reuse
  }

  /**
   * Subtracts another MojoDecimal from this one.
   * @param other - The MojoDecimal to subtract.
   * @returns A new MojoDecimal instance with the result.
   */
  minus(other: MojoDecimal): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    const resultHandle = wasmExports.bigDecimalSubtract(this.internalValue, other.internalValue);
    return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
  }

  /**
   * Multiplies this MojoDecimal by another.
   * @param other - The MojoDecimal to multiply by.
   * @returns A new MojoDecimal instance with the result.
   */
  times(other: MojoDecimal): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    const resultHandle = wasmExports.bigDecimalMultiply(this.internalValue, other.internalValue);
    return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
  }

  /**
   * Divides this MojoDecimal by another.
   * @param other - The MojoDecimal to divide by.
   * @param precision - The number of decimal places for the result.
   * @param roundingMode - (Placeholder) The rounding mode to use (align with Mojo's constants).
   * @returns A new MojoDecimal instance with the result.
   */
  dividedBy(other: MojoDecimal, precision: number = 20, roundingMode: number = 0 /* Placeholder for ROUND_HALF_EVEN */): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    // TODO: Wasm Integration - Ensure precision and roundingMode are correctly passed and handled by Mojo.
    const resultHandle = wasmExports.bigDecimalDivide(this.internalValue, other.internalValue, precision, roundingMode);
    return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
  }

  /**
   * Checks if the value is zero.
   * @returns True if the value is zero, false otherwise.
   */
  isZero(): boolean {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalIsZero(this.internalValue);
  }

  /**
   * Compares this MojoDecimal with another for equality.
   * @param other - The MojoDecimal to compare with.
   * @returns True if the values are equal, false otherwise.
   */
  equals(other: MojoDecimal): boolean {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalEquals(this.internalValue, other.internalValue);
  }

  /**
   * Checks if the value is positive.
   * @returns True if the value is greater than zero.
   */
  isPositive(): boolean {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalIsPositive(this.internalValue);
  }

  /**
   * Returns the absolute value of this MojoDecimal.
   * @returns A new MojoDecimal instance with the absolute value.
   */
  abs(): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    const resultHandle = wasmExports.bigDecimalAbs(this.internalValue);
    return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
  }

  /**
   * Converts the MojoDecimal to a standard JavaScript number.
   * Note: This may result in precision loss for very large or very small numbers,
   * or numbers with many decimal places. Use with caution for display or non-critical paths.
   * @returns The numeric value.
   */
  toNumber(): number {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalToNumber(this.internalValue);
  }

  /**
   * Converts the MojoDecimal to a string representation.
   * @returns The string representation of the number.
   */
  toString(): string {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalToString(this.internalValue);
  }

  /**
   * Converts the MojoDecimal to a string with a fixed number of decimal places.
   * @param dp - Number of decimal places.
   * @param roundingMode - (Placeholder) The rounding mode to use.
   * @returns The string representation with fixed decimal places.
   */
  toFixed(dp: number, roundingMode: number = 0 /* Placeholder */): string {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    // TODO: Wasm Integration - Ensure roundingMode is correctly passed and handled.
    return wasmExports.bigDecimalToFixed(this.internalValue, dp, roundingMode);
  }
}

/**
 * Factory function to create a new MojoDecimal instance.
 * This replaces the old `newDecimal` that used `decimal.js`.
 */
export function newMojoDecimal(value: number | string | MojoDecimal): MojoDecimal {
  return new MojoDecimal(value);
}

/**
 * Format an amount (assumed to be in dollars/main currency unit) as currency.
 * The input amount is expected to be a standard JavaScript number,
 * typically after conversion from a MojoDecimal if it originated from precise calculations.
 */
export function formatCurrency(
  amount: number, // Expects a JS number, potentially from mojoDecimal.toNumber()
  currency = 'USD'
): string {
  // Intl.NumberFormat handles rounding for display purposes.
  // Ensure the input 'amount' is what you intend to format.
  // If 'amount' comes from MojoDecimal.totoFixed(2), it's already a string, parse it.
  // If it comes from MojoDecimal.toNumber(), it's a number.
  const numToFormat = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numToFormat)) {
    console.warn(`formatCurrency received NaN for amount: ${amount}`);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0); // Format 0 or return an error string
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numToFormat);
}

/**
 * Format an integer amount (in cents) as currency.
 */
export function formatCentsAsCurrency(
  cents: number,
  currency = 'USD'
): string {
  if (!Number.isInteger(cents)) {
    console.warn(
      'formatCentsAsCurrency received non-integer. Potential precision loss if not handled by MojoDecimal conversion upstream.'
    );
  }
  // Convert cents to dollars as a JS number for formatting
  const dollars = cents / 100;
  return formatCurrency(dollars, currency);
}

/**
 * Check if a transaction (lines with integer cent amounts) is balanced.
 * Amounts in lines are assumed to be in cents.
 */
export function isTransactionBalancedCents(
  lines: Array<{ amount: number; is_debit: boolean }>
): boolean {
  if (!wasmExports) {
    console.error('MojoFinancialEngine not initialized. Cannot check transaction balance.');
    // Fallback or throw error. For now, returning false.
    return false;
  }
  let balance = new MojoDecimal(0); // Start with MojoDecimal(0)
  for (const line of lines) {
    // Assuming line.amount is in cents, treat as integer for MojoDecimal if it expects that,
    // or scale if MojoDecimal expects main units.
    // For consistency with "Cents" in function name, let's assume MojoDecimal handles integers well.
    const amt = new MojoDecimal(line.amount);
    balance = line.is_debit ? balance.plus(amt) : balance.minus(amt);
  }
  return balance.isZero();
}

/**
 * Calculate account balance (in cents) based on transaction lines.
 * accountNormalBalance: 'debit' | 'credit'
 * Amounts in lines are assumed to be in cents.
 */
export function calculateAccountBalanceCents(
  lines: Array<{ amount: number; is_debit: boolean }>,
  accountNormalBalance: 'debit' | 'credit'
): number {
  if (!wasmExports) {
    console.error('MojoFinancialEngine not initialized. Cannot calculate account balance.');
    return 0; // Fallback
  }
  let balance = new MojoDecimal(0);
  for (const line of lines) {
    const amt = new MojoDecimal(line.amount);
    if (accountNormalBalance === 'debit') {
      balance = line.is_debit ? balance.plus(amt) : balance.minus(amt);
    } else {
      balance = !line.is_debit ? balance.plus(amt) : balance.minus(amt);
    }
  }
  // The result is in cents, so converting to number should be fine.
  return balance.toNumber();
}

// Example of how you might need to handle rounding for GAAP if Mojo doesn't do it by default
// or if you need specific rounding before display.
// This would typically be part of toFixed or a similar method in MojoDecimal.
// export function roundToGAAP(value: MojoDecimal, decimalPlaces: number = 2): MojoDecimal {
//   if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
//   // TODO: Wasm Integration - Call a Mojo function for GAAP-compliant rounding (e.g., half-even)
//   // For placeholder:
//   const num = value.toNumber();
//   const factor = Math.pow(10, decimalPlaces);
//   const roundedNum = Math.round((num + Number.EPSILON) * factor) / factor;
//   return new MojoDecimal(roundedNum);
// }

// Ensure this file is the single source for financial functions.
// If src/utils/financial.ts exists and is a duplicate, it should be removed,
// and all imports should point to this file (src/lib/accounting/financial.ts).
