// src/lib/accounting/financial.ts
/**
 * JavaScript Adapter for Mojo BigDecimal Financial Operations.
 */

// FIXED: Define and export RoundingMode here, aligning with Mojo Wasm expectations.
export enum RoundingMode {
  ROUND_HALF_EVEN = 0, // Banker's rounding (common in finance)
  ROUND_UP = 1,
  ROUND_DOWN = 2,
  ROUND_HALF_UP = 3,
  // Add other modes as supported by your Mojo BigDecimal Wasm module
  // Ensure these integer values match what your Mojo Wasm functions expect.
}

interface MojoWasmExports {
  bigDecimalFromString: (s: string) => any;
  bigDecimalFromNumber: (n: number) => any;
  bigDecimalToString: (bdHandle: any) => string;
  bigDecimalToNumber: (bdHandle: any) => number;
  bigDecimalAdd: (h1: any, h2: any) => any;
  bigDecimalSubtract: (h1: any, h2: any) => any;
  bigDecimalMultiply: (h1: any, h2: any) => any;
  bigDecimalDivide: (h1: any, h2: any, precision: number, roundingMode: number) => any;
  bigDecimalIsZero: (bdHandle: any) => boolean;
  bigDecimalEquals: (h1: any, h2: any) => boolean;
  bigDecimalIsPositive: (bdHandle: any) => boolean;
  bigDecimalAbs: (bdHandle: any) => any;
  bigDecimalToFixed: (bdHandle: any, dp: number, roundingMode: number) => string;
  // TODO: Add Wasm export for round(dp: number, roundingMode: number) if separate from toFixed
  // bigDecimalRound: (bdHandle: any, dp: number, roundingMode: number) => any; // Returns new handle
}

let wasmExports: MojoWasmExports | null = null;

export async function initMojoFinancialEngine(wasmPath: string = '/mojo/big_decimal.wasm'): Promise<void> {
  if (wasmExports) {
    console.log('MojoFinancialEngine already initialized.');
    return;
  }
  try {
    console.warn(`MojoFinancialEngine: Wasm initialization is a STUB. Implement loading and instantiation of ${wasmPath}.`);
    wasmExports = {
      bigDecimalFromString: (s: string) => s,
      bigDecimalFromNumber: (n: number) => n.toString(),
      bigDecimalToString: (bdHandle: any) => String(bdHandle),
      bigDecimalToNumber: (bdHandle: any) => parseFloat(String(bdHandle)),
      bigDecimalAdd: (h1: any, h2: any) => (parseFloat(String(h1)) + parseFloat(String(h2))).toString(),
      bigDecimalSubtract: (h1: any, h2: any) => (parseFloat(String(h1)) - parseFloat(String(h2))).toString(),
      bigDecimalMultiply: (h1: any, h2: any) => (parseFloat(String(h1)) * parseFloat(String(h2))).toString(),
      bigDecimalDivide: (h1: any, h2: any, _prec: number, rm: number) => (parseFloat(String(h1)) / parseFloat(String(h2))).toString(), // rm not used in stub
      bigDecimalIsZero: (bdHandle: any) => parseFloat(String(bdHandle)) === 0,
      bigDecimalEquals: (h1: any, h2: any) => parseFloat(String(h1)) === parseFloat(String(h2)),
      bigDecimalIsPositive: (bdHandle: any) => parseFloat(String(bdHandle)) > 0,
      bigDecimalAbs: (bdHandle: any) => Math.abs(parseFloat(String(bdHandle))).toString(),
      bigDecimalToFixed: (bdHandle: any, dp: number, rm: number) => parseFloat(String(bdHandle)).toFixed(dp), // rm not used in stub
      // bigDecimalRound: (bdHandle: any, dp: number, rm: number) => parseFloat(String(bdHandle)).toFixed(dp), // Stub for round
    };
    console.log('MojoFinancialEngine STUB initialized.');
  } catch (error) {
    console.error('Failed to initialize MojoFinancialEngine:', error);
    wasmExports = null; // Ensure it's null on failure
    throw new Error('Could not initialize financial calculation engine.');
  }
}

export class MojoDecimal {
  private readonly internalValue: any;

  constructor(value: number | string | MojoDecimal) {
    if (!wasmExports) {
      // Attempt to initialize if not already, or throw a more specific error.
      // For simplicity, we assume initMojoFinancialEngine is called at app startup.
      console.error('MojoFinancialEngine not initialized. Call initMojoFinancialEngine() first.');
      throw new Error('MojoFinancialEngine not initialized.');
    }
    if (value instanceof MojoDecimal) {
      this.internalValue = value.internalValue;
    } else if (typeof value === 'string') {
      this.internalValue = wasmExports.bigDecimalFromString(value);
    } else if (typeof value === 'number') {
      this.internalValue = wasmExports.bigDecimalFromString(value.toString());
    } else {
      throw new Error('Invalid value for MojoDecimal constructor.');
    }
  }

  plus(other: MojoDecimal): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    const resultHandle = wasmExports.bigDecimalAdd(this.internalValue, other.internalValue);
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

  dividedBy(other: MojoDecimal, precision: number = 20, roundingMode: RoundingMode = RoundingMode.ROUND_HALF_EVEN): MojoDecimal {
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

  // Helper, assuming Mojo Wasm might not have isNegative but has isPositive and isZero
  isNegative(): boolean {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return !this.isPositive() && !this.isZero();
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

  toFixed(dp: number, roundingMode: RoundingMode = RoundingMode.ROUND_HALF_EVEN): string {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    return wasmExports.bigDecimalToFixed(this.internalValue, dp, roundingMode);
  }

  // Placeholder for a dedicated round method if different from toFixed
  round(dp: number, roundingMode: RoundingMode = RoundingMode.ROUND_HALF_EVEN): MojoDecimal {
    if (!wasmExports) throw new Error('MojoFinancialEngine not initialized.');
    // Assuming toFixed can be used, and then reconstruct. Or a direct Wasm round function is better.
    // const roundedString = wasmExports.bigDecimalToFixed(this.internalValue, dp, roundingMode);
    // return new MojoDecimal(roundedString);
    // If Mojo has a direct rounding function that returns a new handle:
    // const roundedHandle = wasmExports.bigDecimalRound(this.internalValue, dp, roundingMode);
    // return new MojoDecimal(wasmExports.bigDecimalToString(roundedHandle)); // Or directly if handle can construct
    console.warn("MojoDecimal.round() is using toFixed() as a placeholder. Implement with actual Wasm round if available.");
    return new MojoDecimal(this.toFixed(dp, roundingMode));
  }
}

export function newMojoDecimal(value: number | string | MojoDecimal): MojoDecimal {
  return new MojoDecimal(value);
}

// formatCurrency and formatCentsAsCurrency can remain in utils.ts
// or be moved here if they are considered core to financial object interactions.
// For now, keeping them in utils.ts is fine.