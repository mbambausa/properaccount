// src/lib/accounting/financial.ts

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
// Example: export const ROUND_HALF_EVEN = 0; // Align with Mojo's constants for roundingMode arguments

/**
 * Represents a high-precision decimal number, backed by Mojo's BigDecimal.
 */
export class MojoDecimal {
  private readonly internalValue: any; // Represents the Mojo BigDecimal handle/value

  constructor(value: number | string | MojoDecimal) {
    if (!wasmExports) {
      throw new Error('MojoFinancialEngine not initialized. Call initMojoFinancialEngine() first.');
    }
    if (value instanceof MojoDecimal) {
      this.internalValue = value.internalValue;
    } else if (typeof value === 'string') {
      this.internalValue = wasmExports.bigDecimalFromString(value);
    } else if (typeof value === 'number') {
      // Converting number to string before passing to Mojo might be safer
      // to ensure consistent handling if Mojo's fromNumber has quirks.
      this.internalValue = wasmExports.bigDecimalFromString(value.toString());
    } else {
      throw new Error('Invalid value for MojoDecimal constructor.');
    }
  }

  plus(other: MojoDecimal): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    const resultHandle = wasmExports.bigDecimalAdd(this.internalValue, other.internalValue);
    // Assuming resultHandle from Mojo is suitable for new MojoDecimal (e.g., it's a string or handle)
    return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
  }

  minus(other: MojoDecimal): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    const resultHandle = wasmExports.bigDecimalSubtract(this.internalValue, other.internalValue);
    return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
  }

  times(other: MojoDecimal): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    const resultHandle = wasmExports.bigDecimalMultiply(this.internalValue, other.internalValue);
    return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
  }

  dividedBy(other: MojoDecimal, precision: number = 20, roundingMode: number = 0 /* Placeholder for ROUND_HALF_EVEN */): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    const resultHandle = wasmExports.bigDecimalDivide(this.internalValue, other.internalValue, precision, roundingMode);
    return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
  }

  isZero(): boolean {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalIsZero(this.internalValue);
  }

  equals(other: MojoDecimal): boolean {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalEquals(this.internalValue, other.internalValue);
  }

  isPositive(): boolean {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalIsPositive(this.internalValue);
  }

  abs(): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    const resultHandle = wasmExports.bigDecimalAbs(this.internalValue);
    return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
  }

  toNumber(): number {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalToNumber(this.internalValue);
  }

  toString(): string {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalToString(this.internalValue);
  }

  toFixed(dp: number, roundingMode: number = 0 /* Placeholder */): string {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalToFixed(this.internalValue, dp, roundingMode);
  }
}

/**
 * Factory function to create a new MojoDecimal instance.
 */
export function newMojoDecimal(value: number | string | MojoDecimal): MojoDecimal {
  return new MojoDecimal(value);
}

/**
 * Formats a monetary value (string, number, or MojoDecimal) as a currency string.
 * @param value - The monetary value.
 * @param currency - ISO currency code (defaults to USD).
 * @param locale - Locale for formatting (defaults to 'en-US').
 * @returns The formatted currency string.
 */
export function formatCurrency(
  value: number | string | MojoDecimal,
  currency: string = 'USD',
  locale: string = 'en-US',
): string {
  let numToFormat: number;

  if (value instanceof MojoDecimal) {
    // For precise formatting to 2 decimal places for currency, use toFixed from MojoDecimal if available,
    // otherwise convert to number (which might lose precision if not careful).
    // Assuming toFixed(2) gives a string representation rounded correctly.
    numToFormat = parseFloat(value.toFixed(2)); // Using placeholder ROUND_HALF_EVEN implicitly
  } else if (typeof value === 'string') {
    numToFormat = parseFloat(value);
  } else {
    numToFormat = value;
  }

  if (isNaN(numToFormat)) {
    console.warn(`formatCurrency received invalid/NaN value: ${value}`);
    // Return a default or error string for NaN values
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numToFormat);
}


/**
 * Formats an integer amount (in cents) as currency.
 * @param cents - Integer number of cents.
 * @param currency - ISO currency code (defaults to USD).
 * @param locale - Locale for formatting (defaults to 'en-US').
 * @returns The formatted currency string.
 */
export function formatCentsAsCurrency(
  cents: number,
  currency: string = 'USD',
  locale: string = 'en-US',
): string {
  if (!Number.isInteger(cents)) {
    console.warn(
      'formatCentsAsCurrency received non-integer cents. Potential precision issues if not already handled by MojoDecimal conversion upstream.'
    );
  }
  const dollars = cents / 100;
  return formatCurrency(dollars, currency, locale);
}

/**
 * Checks if a set of transaction lines balances to zero.
 * Assumes line amounts are numbers or strings that can be converted to MojoDecimal.
 * @param lines - Array of { amount: string | number; is_debit: boolean }
 */
export function isTransactionBalanced(
  lines: Array<{ amount: string | number; is_debit: boolean }>
): boolean {
  if (!wasmExports) {
    console.error('MojoFinancialEngine not initialized. Cannot check transaction balance.');
    return false; // Or throw error
  }
  let balance = new MojoDecimal(0);
  for (const line of lines) {
    const amt = new MojoDecimal(line.amount);
    balance = line.is_debit ? balance.plus(amt) : balance.minus(amt);
  }
  return balance.isZero();
}