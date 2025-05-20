// src/lib/mojo/common/financial.ts
/**
 * JavaScript Adapter for Mojo BigDecimal Financial Operations.
 *
 * This module provides a JavaScript interface for financial calculations
 * that are intended to be backed by a Mojo WebAssembly (Wasm) module.
 */

import { detectWebAssemblySupport } from '../feature-detection';
import { getFeatureFlags } from '../feature-flags';

/**
 * Rounding modes for financial calculations
 * These align with the constants in the Mojo implementation
 */
export enum RoundingMode {
  ROUND_HALF_EVEN = 0, // Banker's rounding (GAAP-compliant)
  ROUND_HALF_UP = 1,   // Standard rounding
  ROUND_UP = 2,        // Always round away from zero
  ROUND_DOWN = 3,      // Always round toward zero
  ROUND_CEILING = 4,   // Toward positive infinity
  ROUND_FLOOR = 5      // Toward negative infinity
}

/**
 * Custom error class for financial operations
 */
export class FinancialError extends Error {
  public readonly code: string;
  public readonly operation: string;
  
  constructor(message: string, code: string, operation: string) {
    super(message);
    this.name = 'FinancialError';
    this.code = code;
    this.operation = operation;
  }
}

// --- Wasm Module Interaction (Placeholders) ---
// This interface defines how the Wasm module is loaded and its functions accessed.
interface MojoWasmExports {
  bigDecimalFromString: (s: string) => any; // Returns an opaque handle or internal rep
  bigDecimalFromNumber: (n: number) => any;
  bigDecimalToString: (bdHandle: any) => string;
  bigDecimalToNumber: (bdHandle: any) => number; // May lose precision for very large/small numbers
  bigDecimalAdd: (h1: any, h2: any) => any;
  bigDecimalSubtract: (h1: any, h2: any) => any;
  bigDecimalMultiply: (h1: any, h2: any) => any;
  bigDecimalDivide: (h1: any, h2: any, precision: number, roundingMode: number) => any; // Mojo needs precision/rounding
  bigDecimalCompare: (h1: any, h2: any) => number; // -1, 0, 1 for less, equal, greater
  bigDecimalIsZero: (bdHandle: any) => boolean;
  bigDecimalEquals: (h1: any, h2: any) => boolean;
  bigDecimalIsPositive: (bdHandle: any) => boolean;
  bigDecimalIsNegative: (bdHandle: any) => boolean;
  bigDecimalAbs: (bdHandle: any) => any;
  bigDecimalRound: (bdHandle: any, precision: number, roundingMode: number) => any;
  bigDecimalToFixed: (bdHandle: any, dp: number, roundingMode: number) => string;
}

// Module state
let wasmExports: MojoWasmExports | null = null;
let wasmInitialized = false;
let wasmInitializing = false;
let wasmInitError: Error | null = null;

/**
 * Initializes the Mojo Wasm module and populates `wasmExports`.
 * This should be called once during application startup.
 */
export async function initMojoFinancialEngine(wasmPath: string = '/mojo/big_decimal.wasm'): Promise<void> {
  // Prevent multiple initializations
  if (wasmExports) {
    console.log('MojoFinancialEngine already initialized.');
    return;
  }
  
  // Prevent multiple initialization attempts
  if (wasmInitializing) {
    console.log('MojoFinancialEngine initialization in progress.');
    return;
  }
  
  wasmInitializing = true;
  
  try {
    // Check feature flags before attempting to load WebAssembly
    const { useMojoBigDecimal, preferJSImplementation } = getFeatureFlags();
    
    if (!useMojoBigDecimal || preferJSImplementation) {
      console.info('Using JavaScript fallback for MojoFinancialEngine due to feature flags.');
      initializeJavaScriptFallback();
      wasmInitialized = true;
      return;
    }
    
    // Check for WebAssembly support
    const wasmSupport = await detectWebAssemblySupport();
    if (!wasmSupport.supported) {
      console.warn('WebAssembly not supported. Using JavaScript fallback for MojoFinancialEngine.');
      initializeJavaScriptFallback();
      wasmInitialized = true;
      return;
    }
    
    // Attempt to load the WebAssembly module
    console.info(`Loading MojoFinancialEngine WebAssembly module from ${wasmPath}`);
    
    try {
      // Real implementation would use WebAssembly.instantiateStreaming
      const response = await fetch(wasmPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch WebAssembly module: ${response.statusText}`);
      }
      
      const wasmBytes = await response.arrayBuffer();
      const module = await WebAssembly.compile(wasmBytes);
      
      const instance = await WebAssembly.instantiate(module, {
        env: {
          // Memory and other imports needed by the module
          memory: new WebAssembly.Memory({ initial: 16, maximum: 100 }),
        }
      });
      
      wasmExports = instance.exports as unknown as MojoWasmExports;
      wasmInitialized = true;
      console.info('MojoFinancialEngine WebAssembly module initialized successfully.');
    } catch (error) {
      console.warn('Failed to initialize WebAssembly module:', error);
      console.info('Falling back to JavaScript implementation.');
      initializeJavaScriptFallback();
      wasmInitialized = true;
    }
  } catch (error) {
    wasmInitError = error instanceof Error ? error : new Error(String(error));
    console.error('Failed to initialize MojoFinancialEngine:', error);
    throw new FinancialError(
      `Could not initialize financial calculation engine: ${error.message}`,
      'INIT_FAILED',
      'initMojoFinancialEngine'
    );
  } finally {
    wasmInitializing = false;
  }
}

/**
 * Initialize the JavaScript fallback implementation for when WebAssembly is not available
 */
function initializeJavaScriptFallback(): void {
  console.info('Initializing JavaScript fallback for MojoFinancialEngine');
  wasmExports = {
    bigDecimalFromString: (s: string) => s, // In reality, this would be an opaque handle
    bigDecimalFromNumber: (n: number) => n.toString(),
    bigDecimalToString: (bdHandle: any) => String(bdHandle),
    bigDecimalToNumber: (bdHandle: any) => parseFloat(String(bdHandle)),
    bigDecimalAdd: (h1: any, h2: any) => (parseFloat(String(h1)) + parseFloat(String(h2))).toString(),
    bigDecimalSubtract: (h1: any, h2: any) => (parseFloat(String(h1)) - parseFloat(String(h2))).toString(),
    bigDecimalMultiply: (h1: any, h2: any) => (parseFloat(String(h1)) * parseFloat(String(h2))).toString(),
    bigDecimalDivide: (h1: any, h2: any, _prec: number, _rm: number) => {
      const divVal = parseFloat(String(h1)) / parseFloat(String(h2));
      return isFinite(divVal) ? divVal.toString() : "NaN";
    },
    bigDecimalCompare: (h1: any, h2: any) => {
      const a = parseFloat(String(h1));
      const b = parseFloat(String(h2));
      return a < b ? -1 : a > b ? 1 : 0;
    },
    bigDecimalIsZero: (bdHandle: any) => parseFloat(String(bdHandle)) === 0,
    bigDecimalEquals: (h1: any, h2: any) => parseFloat(String(h1)) === parseFloat(String(h2)),
    bigDecimalIsPositive: (bdHandle: any) => parseFloat(String(bdHandle)) > 0,
    bigDecimalIsNegative: (bdHandle: any) => parseFloat(String(bdHandle)) < 0,
    bigDecimalAbs: (bdHandle: any) => Math.abs(parseFloat(String(bdHandle))).toString(),
    bigDecimalRound: (bdHandle: any, precision: number, roundingMode: number) => {
      const value = parseFloat(String(bdHandle));
      const factor = Math.pow(10, precision);
      
      // Implement different rounding modes
      switch (roundingMode) {
        case RoundingMode.ROUND_HALF_EVEN: // Banker's rounding
          return bankerRound(value * factor) / factor;
        case RoundingMode.ROUND_HALF_UP:
          return Math.round(value * factor) / factor;
        case RoundingMode.ROUND_UP:
          return Math.ceil(value * factor) / factor;
        case RoundingMode.ROUND_DOWN:
          return Math.floor(value * factor) / factor;
        case RoundingMode.ROUND_CEILING:
          return Math.ceil(value * factor) / factor;
        case RoundingMode.ROUND_FLOOR:
          return Math.floor(value * factor) / factor;
        default:
          return Math.round(value * factor) / factor;
      }
    },
    bigDecimalToFixed: (bdHandle: any, dp: number, roundingMode: number) => {
      const value = parseFloat(String(bdHandle));
      const factor = Math.pow(10, dp);
      let rounded;
      
      switch (roundingMode) {
        case RoundingMode.ROUND_HALF_EVEN:
          rounded = bankerRound(value * factor) / factor;
          break;
        case RoundingMode.ROUND_HALF_UP:
          rounded = Math.round(value * factor) / factor;
          break;
        case RoundingMode.ROUND_UP:
          rounded = Math.ceil(Math.abs(value) * factor) / factor * (value < 0 ? -1 : 1);
          break;
        case RoundingMode.ROUND_DOWN:
          rounded = Math.floor(Math.abs(value) * factor) / factor * (value < 0 ? -1 : 1);
          break;
        case RoundingMode.ROUND_CEILING:
          rounded = Math.ceil(value * factor) / factor;
          break;
        case RoundingMode.ROUND_FLOOR:
          rounded = Math.floor(value * factor) / factor;
          break;
        default:
          rounded = Math.round(value * factor) / factor;
      }
      
      return rounded.toFixed(dp);
    }
  };
}

/**
 * Banker's rounding (round half to even) implementation
 */
function bankerRound(num: number): number {
  const integer = Math.floor(num);
  const fraction = num - integer;
  if (fraction < 0.5) return integer;
  if (fraction > 0.5) return integer + 1;
  return integer % 2 === 0 ? integer : integer + 1;
}

/**
 * Represents a high-precision decimal number, backed by Mojo's BigDecimal.
 */
export class MojoDecimal {
  private readonly internalValue: any; // Represents the Mojo BigDecimal handle/value

  /**
   * Creates a new MojoDecimal instance.
   * @param value - number or string representation of a number, or another MojoDecimal.
   * @throws If the Wasm engine is not initialized or if value conversion fails.
   */
  constructor(value: number | string | MojoDecimal) {
    if (!wasmExports) {
      const error = wasmInitError || new Error('MojoFinancialEngine not initialized. Call initMojoFinancialEngine() first.');
      throw new FinancialError(
        error.message,
        'ENGINE_NOT_INITIALIZED',
        'MojoDecimal.constructor'
      );
    }
    
    try {
      if (value instanceof MojoDecimal) {
        this.internalValue = value.internalValue;
      } else if (typeof value === 'string') {
        // Handle empty strings or whitespace
        if (value.trim() === '') {
          this.internalValue = wasmExports.bigDecimalFromNumber(0);
        } else {
          this.internalValue = wasmExports.bigDecimalFromString(value);
        }
      } else if (typeof value === 'number') {
        if (!isFinite(value)) {
          throw new Error(`Cannot create MojoDecimal from non-finite number: ${value}`);
        }
        this.internalValue = wasmExports.bigDecimalFromNumber(value);
      } else {
        throw new Error(`Invalid value type for MojoDecimal: ${typeof value}`);
      }
    } catch (error) {
      throw new FinancialError(
        `Failed to create MojoDecimal: ${error.message}`,
        'DECIMAL_CREATION_ERROR',
        'MojoDecimal.constructor'
      );
    }
  }

  /**
   * Adds another MojoDecimal to this one.
   * @param other - The MojoDecimal, number, or string to add.
   * @returns A new MojoDecimal instance with the result.
   */
  plus(other: MojoDecimal | number | string): MojoDecimal {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.plus'
    );
    
    try {
      const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other);
      const resultHandle = wasmExports.bigDecimalAdd(this.internalValue, otherDecimal.internalValue);
      return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
    } catch (error) {
      throw new FinancialError(
        `Addition failed: ${error.message}`,
        'OPERATION_FAILED',
        'MojoDecimal.plus'
      );
    }
  }

  /**
   * Subtracts another MojoDecimal from this one.
   * @param other - The MojoDecimal, number, or string to subtract.
   * @returns A new MojoDecimal instance with the result.
   */
  minus(other: MojoDecimal | number | string): MojoDecimal {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.minus'
    );
    
    try {
      const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other);
      const resultHandle = wasmExports.bigDecimalSubtract(this.internalValue, otherDecimal.internalValue);
      return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
    } catch (error) {
      throw new FinancialError(
        `Subtraction failed: ${error.message}`,
        'OPERATION_FAILED',
        'MojoDecimal.minus'
      );
    }
  }

  /**
   * Multiplies this MojoDecimal by another.
   * @param other - The MojoDecimal, number, or string to multiply by.
   * @returns A new MojoDecimal instance with the result.
   */
  times(other: MojoDecimal | number | string): MojoDecimal {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.times'
    );
    
    try {
      const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other);
      const resultHandle = wasmExports.bigDecimalMultiply(this.internalValue, otherDecimal.internalValue);
      return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
    } catch (error) {
      throw new FinancialError(
        `Multiplication failed: ${error.message}`,
        'OPERATION_FAILED',
        'MojoDecimal.times'
      );
    }
  }

  /**
   * Divides this MojoDecimal by another.
   * @param other - The MojoDecimal, number, or string to divide by.
   * @param precision - The number of decimal places to keep.
   * @param roundingMode - The rounding mode to use.
   * @returns A new MojoDecimal instance with the result.
   */
  dividedBy(
    other: MojoDecimal | number | string, 
    precision: number = 20, 
    roundingMode: RoundingMode = RoundingMode.ROUND_HALF_EVEN
  ): MojoDecimal {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.dividedBy'
    );
    
    try {
      const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other);
      
      // Check for division by zero
      if (otherDecimal.isZero()) {
        throw new Error('Division by zero');
      }
      
      const resultHandle = wasmExports.bigDecimalDivide(
        this.internalValue, 
        otherDecimal.internalValue, 
        precision, 
        roundingMode
      );
      return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
    } catch (error) {
      throw new FinancialError(
        `Division failed: ${error.message}`,
        'OPERATION_FAILED',
        'MojoDecimal.dividedBy'
      );
    }
  }

  /**
   * Compares this MojoDecimal with another.
   * @param other - The MojoDecimal, number, or string to compare with.
   * @returns -1 if this < other, 0 if this = other, 1 if this > other.
   */
  comparedTo(other: MojoDecimal | number | string): number {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.comparedTo'
    );
    
    try {
      const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other);
      return wasmExports.bigDecimalCompare(this.internalValue, otherDecimal.internalValue);
    } catch (error) {
      throw new FinancialError(
        `Comparison failed: ${error.message}`,
        'OPERATION_FAILED',
        'MojoDecimal.comparedTo'
      );
    }
  }

  /**
   * Rounds this MojoDecimal to a specified number of decimal places.
   * @param decimalPlaces - Number of decimal places.
   * @param roundingMode - Rounding mode to use.
   * @returns A new MojoDecimal with the rounded value.
   */
  round(
    decimalPlaces: number = 2, 
    roundingMode: RoundingMode = RoundingMode.ROUND_HALF_EVEN
  ): MojoDecimal {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.round'
    );
    
    try {
      const resultHandle = wasmExports.bigDecimalRound(
        this.internalValue, 
        decimalPlaces, 
        roundingMode
      );
      return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
    } catch (error) {
      throw new FinancialError(
        `Rounding failed: ${error.message}`,
        'OPERATION_FAILED',
        'MojoDecimal.round'
      );
    }
  }

  /**
   * Checks if the value is zero.
   * @returns True if the value is zero, false otherwise.
   */
  isZero(): boolean {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.isZero'
    );
    return wasmExports.bigDecimalIsZero(this.internalValue);
  }

  /**
   * Compares this MojoDecimal with another for equality.
   * @param other - The MojoDecimal, number, or string to compare with.
   * @returns True if the values are equal, false otherwise.
   */
  equals(other: MojoDecimal | number | string): boolean {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.equals'
    );
    
    try {
      const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other);
      return wasmExports.bigDecimalEquals(this.internalValue, otherDecimal.internalValue);
    } catch (error) {
      throw new FinancialError(
        `Equality check failed: ${error.message}`,
        'OPERATION_FAILED',
        'MojoDecimal.equals'
      );
    }
  }

  /**
   * Checks if the value is positive.
   * @returns True if the value is greater than zero.
   */
  isPositive(): boolean {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.isPositive'
    );
    return wasmExports.bigDecimalIsPositive(this.internalValue);
  }

  /**
   * Checks if the value is negative.
   * @returns True if the value is less than zero.
   */
  isNegative(): boolean {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.isNegative'
    );
    return wasmExports.bigDecimalIsNegative(this.internalValue);
  }

  /**
   * Returns the absolute value of this MojoDecimal.
   * @returns A new MojoDecimal instance with the absolute value.
   */
  abs(): MojoDecimal {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.abs'
    );
    
    try {
      const resultHandle = wasmExports.bigDecimalAbs(this.internalValue);
      return new MojoDecimal(wasmExports.bigDecimalToString(resultHandle));
    } catch (error) {
      throw new FinancialError(
        `Absolute value calculation failed: ${error.message}`,
        'OPERATION_FAILED',
        'MojoDecimal.abs'
      );
    }
  }

  /**
   * Returns the maximum of this MojoDecimal and another.
   * @param other - The MojoDecimal, number, or string to compare with.
   * @returns The larger of the two values as a new MojoDecimal.
   */
  max(other: MojoDecimal | number | string): MojoDecimal {
    const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other);
    return this.comparedTo(otherDecimal) >= 0 ? this : otherDecimal;
  }

  /**
   * Returns the minimum of this MojoDecimal and another.
   * @param other - The MojoDecimal, number, or string to compare with.
   * @returns The smaller of the two values as a new MojoDecimal.
   */
  min(other: MojoDecimal | number | string): MojoDecimal {
    const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other);
    return this.comparedTo(otherDecimal) <= 0 ? this : otherDecimal;
  }

  /**
   * Converts the MojoDecimal to a standard JavaScript number.
   * Note: This may result in precision loss for very large or very small numbers.
   * @returns The numeric value.
   */
  toNumber(): number {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.toNumber'
    );
    return wasmExports.bigDecimalToNumber(this.internalValue);
  }

  /**
   * Converts the MojoDecimal to a string representation.
   * @returns The string representation of the number.
   */
  toString(): string {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.toString'
    );
    return wasmExports.bigDecimalToString(this.internalValue);
  }

  /**
   * Converts the MojoDecimal to a string with a fixed number of decimal places.
   * @param dp - Number of decimal places.
   * @param roundingMode - The rounding mode to use.
   * @returns The string representation with fixed decimal places.
   */
  toFixed(dp: number = 2, roundingMode: RoundingMode = RoundingMode.ROUND_HALF_EVEN): string {
    if (!wasmExports) throw new FinancialError(
      'MojoFinancialEngine not initialized',
      'ENGINE_NOT_INITIALIZED',
      'MojoDecimal.toFixed'
    );
    
    try {
      return wasmExports.bigDecimalToFixed(this.internalValue, dp, roundingMode);
    } catch (error) {
      throw new FinancialError(
        `toFixed operation failed: ${error.message}`,
        'OPERATION_FAILED',
        'MojoDecimal.toFixed'
      );
    }
  }
}

/**
 * Factory function to create a new MojoDecimal instance.
 */
export function newMojoDecimal(value: number | string | MojoDecimal): MojoDecimal {
  return new MojoDecimal(value);
}

/**
 * Formats a monetary value as a currency string.
 * @param value - Monetary value to format.
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

  try {
    if (value instanceof MojoDecimal) {
      // Use GAAP-compliant rounding (banker's rounding)
      numToFormat = parseFloat(value.toFixed(2, RoundingMode.ROUND_HALF_EVEN));
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
  } catch (error) {
    console.error(`Error formatting currency: ${error.message}`);
    return `${currency} ???`;
  }
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
  try {
    if (!Number.isInteger(cents)) {
      console.warn(
        'formatCentsAsCurrency received non-integer cents. Potential precision issues if not already handled by MojoDecimal conversion upstream.',
        cents
      );
    }
    
    const dollars = cents / 100;
    return formatCurrency(dollars, currency, locale);
  } catch (error) {
    console.error(`Error formatting cents as currency: ${error.message}`);
    return `${currency} ???`;
  }
}

/**
 * Checks if a set of transaction lines balances to zero.
 * @param lines - Array of transaction lines with amount and isDebit properties.
 * @returns True if the transaction is balanced.
 */
export function isTransactionBalanced(
  lines: Array<{ amount: string | number; isDebit: boolean }>
): boolean {
  if (!wasmExports) {
    console.error('MojoFinancialEngine not initialized. Cannot check transaction balance.');
    return false;
  }
  
  try {
    let balance = new MojoDecimal(0);
    
    for (const line of lines) {
      const amount = new MojoDecimal(line.amount);
      balance = line.isDebit ? balance.plus(amount) : balance.minus(amount);
    }
    
    // Allow for tiny rounding differences (< 0.01)
    const tolerance = new MojoDecimal(0.01);
    return balance.abs().comparedTo(tolerance) < 0;
  } catch (error) {
    console.error('Error checking transaction balance:', error);
    return false;
  }
}

/**
 * Initializes the MojoFinancialEngine module.
 * Should be called at application startup.
 */
export async function initializeFinancialEngine(): Promise<void> {
  try {
    await initMojoFinancialEngine();
  } catch (error) {
    console.error('Failed to initialize financial engine:', error);
    // Continue anyway, as we'll use JavaScript fallbacks
  }
}