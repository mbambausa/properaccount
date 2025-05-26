// src/mojo/common/financial.ts
/**
 * JavaScript Adapter for Mojo BigDecimal Financial Operations.
 */

// FIXED: Importing from the consolidated utils file
import { getWebAssemblySupport, type WebAssemblySupport } from '../../utils/feature-flags';
import { getFeatureFlags } from '../../utils/feature-flags';
import { initMojoModule, type MojoModule } from '../common/loader';

/**
 * Rounding modes for financial calculations
 */
export enum RoundingMode {
  ROUND_HALF_EVEN = 0,
  ROUND_HALF_UP = 1,
  ROUND_UP = 2,
  ROUND_DOWN = 3,
  ROUND_CEILING = 4,
  ROUND_FLOOR = 5,
}

/**
 * Custom error class for financial operations.
 */
export class FinancialError extends Error {
  public readonly code: string;
  public readonly operation?: string;

  constructor(message: string, code: string, operation?: string) {
    super(message);
    this.name = 'FinancialError';
    this.code = code;
    this.operation = operation;
    Object.setPrototypeOf(this, FinancialError.prototype);
  }
}

/**
 * Interface for Mojo WebAssembly exports related to BigDecimal operations
 */
export interface MojoWasmExports { // Kept 'export' as MojoDecimal class uses it implicitly
  bigDecimalFromString: (s: string) => any;
  bigDecimalFromNumber: (n: number) => any;
  bigDecimalToString: (bdHandle: any) => string;
  bigDecimalToNumber: (bdHandle: any) => number;
  bigDecimalAdd: (h1: any, h2: any) => any;
  bigDecimalSubtract: (h1: any, h2: any) => any;
  bigDecimalMultiply: (h1: any, h2: any) => any;
  bigDecimalDivide: (h1: any, h2: any, precision: number, roundingMode: number) => any;
  bigDecimalCompare: (h1: any, h2: any) => number;
  bigDecimalIsZero: (bdHandle: any) => boolean;
  bigDecimalEquals: (h1: any, h2: any) => boolean;
  bigDecimalIsPositive: (bdHandle: any) => boolean;
  bigDecimalIsNegative: (bdHandle: any) => boolean;
  bigDecimalAbs: (bdHandle: any) => any;
  bigDecimalRound: (bdHandle: any, precision: number, roundingMode: number) => any;
  bigDecimalToFixed: (bdHandle: any, dp: number, roundingMode: number) => string;
}

// Module state
let wasmExportsTarget: MojoWasmExports | null = null;
let wasmInitialized = false;
let wasmInitializing = false;
let wasmInitError: Error | null = null;
let isUsingJsFallback = false; // To know which engine is active

function bankerRound(num: number): number {
    const integer = Math.floor(num);
    const fraction = num - integer;
    if (fraction === 0.5) return integer % 2 === 0 ? integer : integer + 1;
    return Math.round(num);
}

function initializeJavaScriptFallback(): void {
  console.info('MojoFinancialEngine: Initializing JavaScript fallback.');
  isUsingJsFallback = true;
  wasmExportsTarget = {
    bigDecimalFromString: (s: string) => s,
    bigDecimalFromNumber: (n: number) => n.toString(),
    bigDecimalToString: (bdHandle: any) => String(bdHandle),
    bigDecimalToNumber: (bdHandle: any) => parseFloat(String(bdHandle)),
    bigDecimalAdd: (h1: any, h2: any) => (parseFloat(String(h1)) + parseFloat(String(h2))).toString(),
    bigDecimalSubtract: (h1: any, h2: any) => (parseFloat(String(h1)) - parseFloat(String(h2))).toString(),
    bigDecimalMultiply: (h1: any, h2: any) => (parseFloat(String(h1)) * parseFloat(String(h2))).toString(),
    bigDecimalDivide: (h1: any, h2: any, _prec: number, _rm: number) => {
      const divisor = parseFloat(String(h2));
      if (divisor === 0) return "NaN";
      const divVal = parseFloat(String(h1)) / divisor;
      return isFinite(divVal) ? divVal.toString() : "NaN";
    },
    bigDecimalCompare: (h1: any, h2: any) => {
      const a = parseFloat(String(h1)); const b = parseFloat(String(h2));
      return a < b ? -1 : a > b ? 1 : 0;
    },
    bigDecimalIsZero: (bdHandle: any) => parseFloat(String(bdHandle)) === 0,
    bigDecimalEquals: (h1: any, h2: any) => parseFloat(String(h1)) === parseFloat(String(h2)),
    bigDecimalIsPositive: (bdHandle: any) => parseFloat(String(bdHandle)) > 0,
    bigDecimalIsNegative: (bdHandle: any) => parseFloat(String(bdHandle)) < 0,
    bigDecimalAbs: (bdHandle: any) => Math.abs(parseFloat(String(bdHandle))).toString(),
    bigDecimalRound: (bdHandle: any, precision: number, roundingMode: RoundingMode): any => {
      const value = parseFloat(String(bdHandle)); const factor = Math.pow(10, precision);
      let roundedNum;
      switch (roundingMode) {
        case RoundingMode.ROUND_HALF_EVEN: roundedNum = bankerRound(value * factor) / factor; break;
        case RoundingMode.ROUND_HALF_UP: roundedNum = Math.round(value * factor) / factor; break;
        case RoundingMode.ROUND_UP: roundedNum = Math.ceil(value * factor) / factor; break;
        case RoundingMode.ROUND_DOWN: roundedNum = Math.floor(value * factor) / factor; break;
        case RoundingMode.ROUND_CEILING: roundedNum = Math.ceil(value * factor) / factor; break;
        case RoundingMode.ROUND_FLOOR: roundedNum = Math.floor(value * factor) / factor; break;
        default: roundedNum = Math.round(value * factor) / factor;
      }
      return roundedNum.toString();
    },
    bigDecimalToFixed: (bdHandle: any, dp: number, roundingMode: RoundingMode): string => {
        const num = parseFloat(String(bdHandle));
        if (roundingMode !== undefined && wasmExportsTarget && typeof wasmExportsTarget.bigDecimalRound === 'function') {
             const roundedValStr = wasmExportsTarget.bigDecimalRound(bdHandle, dp, roundingMode) as string;
             // Ensure the output of stubbed round is a number string before parseFloat
             const roundedNum = parseFloat(roundedValStr);
             return isNaN(roundedNum) ? num.toFixed(dp) : roundedNum.toFixed(dp);
        }
        return num.toFixed(dp);
    }
  };
  wasmInitialized = true;
  wasmInitializing = false;
}

export async function initMojoFinancialEngine(wasmPath: string = '/mojo/big_decimal.wasm'): Promise<void> {
  if (wasmInitialized) {
    const engineType = isUsingJsFallback ? 'fallback' : 'Wasm';
    console.log(`MojoFinancialEngine already ${engineType} initialized.`);
    return;
  }
  if (wasmInitializing) {
    console.log('MojoFinancialEngine initialization already in progress.');
    return;
  }
  wasmInitializing = true;
  wasmInitError = null;
  isUsingJsFallback = false; // Assume Wasm will load unless checks fail

  try {
    const flags = getFeatureFlags();
    if (!flags.useMojoBigDecimal || flags.preferJSImplementation) {
      initializeJavaScriptFallback();
      return;
    }

    // FIXED: Explicitly type 'support' with the imported WebAssemblySupport type
    const support: WebAssemblySupport = await getWebAssemblySupport();
    // FIXED: Changed support.supported to support.isSupported
    if (!support.isSupported) {
      console.warn('WebAssembly not supported by current environment. Using JavaScript fallback.');
      initializeJavaScriptFallback();
      return;
    }

    console.info(`MojoFinancialEngine: Loading Wasm module from ${wasmPath}`);
    // Use the generic loader from './loader.ts' if you have it.
    // For this example, keeping direct fetch and instantiate.
    // If using loader:
    // const loadedModule = await initMojoModule<MojoWasmExports>('big_decimal', {/* importObject */}, wasmPath);
    // wasmExportsTarget = loadedModule.exports;
    
const importObject = { 
  env: { 
    memory: new WebAssembly.Memory({ initial: 256, maximum: 10240 }) 
  } 
};
const loadedModule = await initMojoModule<MojoWasmExports>('big_decimal', importObject, wasmPath);
wasmExportsTarget = loadedModule.exports;

    wasmInitialized = true;
    console.info('MojoFinancialEngine: Wasm module initialized successfully.');

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    wasmInitError = err;
    console.error('MojoFinancialEngine: Failed to initialize Wasm, falling back to JS.', err);
    initializeJavaScriptFallback();
  } finally {
    wasmInitializing = false;
  }
}

export class MojoDecimal {
  private readonly internalValue: any;

  constructor(value: number | string | MojoDecimal) {
    if (!wasmInitialized || !wasmExportsTarget) {
      const initErrMessage = wasmInitError ? ` Original error: ${wasmInitError.message}` : '';
      throw new FinancialError(
        `MojoFinancialEngine not ready (initialized: ${wasmInitialized}, exports: ${!!wasmExportsTarget}).${initErrMessage} Call and await initializeFinancialEngine() at app startup.`,
        'ENGINE_NOT_READY', 'MojoDecimal.constructor'
      );
    }
    const currentWasmExports = wasmExportsTarget;
    try {
      if (value instanceof MojoDecimal) this.internalValue = value.internalValue;
      else if (typeof value === 'string') this.internalValue = value.trim() === '' ? currentWasmExports.bigDecimalFromNumber(0) : currentWasmExports.bigDecimalFromString(value);
      else if (typeof value === 'number') {
        if (!isFinite(value)) throw new FinancialError(`Cannot create MojoDecimal from non-finite number: ${value}`, 'INVALID_INPUT', 'constructor');
        this.internalValue = currentWasmExports.bigDecimalFromNumber(value);
      } else { // @ts-ignore
        throw new FinancialError(`Invalid value type for MojoDecimal: ${value === null ? 'null' : typeof value}`, 'INVALID_INPUT_TYPE', 'constructor');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new FinancialError(`Failed to create MojoDecimal: ${message}`, 'CREATION_FAILED', 'MojoDecimal.constructor');
    }
  }

  private static _ensureEngine(): MojoWasmExports {
    if (!wasmInitialized || !wasmExportsTarget) {
      const initErrMessage = wasmInitError ? ` Original error: ${wasmInitError.message}` : '';
      throw new FinancialError(
        `MojoFinancialEngine not ready. Call initMojoFinancialEngine().${initErrMessage}`,
        'ENGINE_NOT_READY', 'MojoDecimal method'
      );
    }
    return wasmExportsTarget;
  }
  // ... (All MojoDecimal methods like plus, minus, etc. remain the same, using this._ensureEngine())
  plus(other: MojoDecimal | number | string): MojoDecimal { const engine = MojoDecimal._ensureEngine(); try { const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other); const resultHandle = engine.bigDecimalAdd(this.internalValue, otherDecimal.internalValue); return new MojoDecimal(engine.bigDecimalToString(resultHandle)); } catch (e:unknown) { const msg = e instanceof Error ? e.message : String(e); throw new FinancialError(`Add failed: ${msg}`, 'ADD_FAILED', 'plus'); }}
  minus(other: MojoDecimal | number | string): MojoDecimal { const engine = MojoDecimal._ensureEngine(); try { const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other); const resultHandle = engine.bigDecimalSubtract(this.internalValue, otherDecimal.internalValue); return new MojoDecimal(engine.bigDecimalToString(resultHandle)); } catch (e:unknown) { const msg = e instanceof Error ? e.message : String(e); throw new FinancialError(`Sub failed: ${msg}`, 'SUB_FAILED', 'minus'); }}
  times(other: MojoDecimal | number | string): MojoDecimal { const engine = MojoDecimal._ensureEngine(); try { const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other); const resultHandle = engine.bigDecimalMultiply(this.internalValue, otherDecimal.internalValue); return new MojoDecimal(engine.bigDecimalToString(resultHandle)); } catch (e:unknown) { const msg = e instanceof Error ? e.message : String(e); throw new FinancialError(`Mul failed: ${msg}`, 'MUL_FAILED', 'times'); }}
  dividedBy(other: MojoDecimal | number | string, precision = 20, roundingMode = RoundingMode.ROUND_HALF_EVEN): MojoDecimal { const engine = MojoDecimal._ensureEngine(); try { const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other); if(otherDecimal.isZero()) throw new FinancialError("Div by zero", "DIV_BY_ZERO", "dividedBy"); const resultHandle = engine.bigDecimalDivide(this.internalValue, otherDecimal.internalValue, precision, roundingMode); return new MojoDecimal(engine.bigDecimalToString(resultHandle)); } catch (e:unknown) { const msg = e instanceof Error ? e.message : String(e); throw new FinancialError(`Div failed: ${msg}`, 'DIV_FAILED', 'dividedBy'); }}
  comparedTo(other: MojoDecimal | number | string): number { const engine = MojoDecimal._ensureEngine(); try { const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other); return engine.bigDecimalCompare(this.internalValue, otherDecimal.internalValue); } catch (e:unknown) { const msg = e instanceof Error ? e.message : String(e); throw new FinancialError(`Cmp failed: ${msg}`, 'CMP_FAILED', 'comparedTo'); }}
  round(dp = 2, rm = RoundingMode.ROUND_HALF_EVEN): MojoDecimal { const engine = MojoDecimal._ensureEngine(); try { const resultHandle = engine.bigDecimalRound(this.internalValue, dp, rm); return new MojoDecimal(engine.bigDecimalToString(resultHandle)); } catch (e:unknown) { const msg = e instanceof Error ? e.message : String(e); throw new FinancialError(`Round failed: ${msg}`, 'ROUND_FAILED', 'round'); }}
  isZero(): boolean { const engine = MojoDecimal._ensureEngine(); return engine.bigDecimalIsZero(this.internalValue); }
  equals(other: MojoDecimal | number | string): boolean { const engine = MojoDecimal._ensureEngine(); try { const otherDecimal = other instanceof MojoDecimal ? other : new MojoDecimal(other); return engine.bigDecimalEquals(this.internalValue, otherDecimal.internalValue); } catch (e:unknown) { console.error(`Equals failed: ${e}`); return false; }}
  isPositive(): boolean { const engine = MojoDecimal._ensureEngine(); return engine.bigDecimalIsPositive(this.internalValue); }
  isNegative(): boolean { const engine = MojoDecimal._ensureEngine(); return engine.bigDecimalIsNegative(this.internalValue); }
  abs(): MojoDecimal { const engine = MojoDecimal._ensureEngine(); try { const resultHandle = engine.bigDecimalAbs(this.internalValue); return new MojoDecimal(engine.bigDecimalToString(resultHandle)); } catch (e:unknown) { const msg = e instanceof Error ? e.message : String(e); throw new FinancialError(`Abs failed: ${msg}`, 'ABS_FAILED', 'abs'); }}
  max(other: MojoDecimal | number | string): MojoDecimal { const o = other instanceof MojoDecimal ? other : new MojoDecimal(other); return this.comparedTo(o) >= 0 ? this : o; }
  min(other: MojoDecimal | number | string): MojoDecimal { const o = other instanceof MojoDecimal ? other : new MojoDecimal(other); return this.comparedTo(o) <= 0 ? this : o; }
  toNumber(): number { const engine = MojoDecimal._ensureEngine(); return engine.bigDecimalToNumber(this.internalValue); }
  toString(): string { const engine = MojoDecimal._ensureEngine(); return engine.bigDecimalToString(this.internalValue); }
  toFixed(dp = 2, rm = RoundingMode.ROUND_HALF_EVEN): string { const engine = MojoDecimal._ensureEngine(); try { return engine.bigDecimalToFixed(this.internalValue, dp, rm); } catch (e:unknown) { const msg = e instanceof Error ? e.message : String(e); throw new FinancialError(`ToFixed failed: ${msg}`, 'TO_FIXED_FAILED', 'toFixed'); }}
}
export function newMojoDecimal(value: number | string | MojoDecimal): MojoDecimal { return new MojoDecimal(value); }

export function formatCurrency(value: number | string | MojoDecimal, currency = 'USD', locale = 'en-US'): string {
  let numToFormat: number;
  try {
    if (value instanceof MojoDecimal) numToFormat = parseFloat(value.toFixed(2, RoundingMode.ROUND_HALF_EVEN));
    else if (typeof value === 'string') numToFormat = parseFloat(value);
    else numToFormat = value;
    if (isNaN(numToFormat) || !isFinite(numToFormat)) {
      console.warn(`formatCurrency received invalid/NaN/Infinity value: ${value} -> ${numToFormat}`);
      return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(0);
    }
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numToFormat);
  } catch (error: unknown) { const message = error instanceof Error ? error.message : String(error);
    console.error(`Error formatting currency for value "${value}": ${message}`); return `${currency} ERR`; }
}
export function formatCentsAsCurrency(cents: number, currency = 'USD', locale = 'en-US'): string {
  try { if (!Number.isInteger(cents)) console.warn('formatCentsAsCurrency received non-integer cents:', cents);
    return formatCurrency(cents / 100, currency, locale);
  } catch (error: unknown) { const message = error instanceof Error ? error.message : String(error);
    console.error(`Error formatting cents as currency for value "${cents}": ${message}`); return `${currency} ERR`; }
}
export function isTransactionBalanced(lines: Array<{ amount: string | number; isDebit: boolean }>): boolean {
  if (!wasmInitialized || !wasmExportsTarget) {
    console.error('MojoFinancialEngine not initialized for isTransactionBalanced (using JS fallback).');
    let balance = 0;
    for (const line of lines) { const amt = parseFloat(String(line.amount));
        if (isNaN(amt)) { console.error("Invalid amount in line (JS fallback)"); return false; }
        balance += line.isDebit ? amt : -amt; }
    return Math.abs(balance) < 0.001;
  }
  try { let balance = new MojoDecimal(0);
    for (const line of lines) { const amount = new MojoDecimal(line.amount);
      balance = line.isDebit ? balance.plus(amount) : balance.minus(amount); }
    return balance.isZero();
  } catch (error: unknown) { const message = error instanceof Error ? error.message : String(error);
    console.error('Error checking transaction balance with MojoDecimal:', message); return false; }
}
export async function initializeFinancialEngine(): Promise<void> { await initMojoFinancialEngine(); }