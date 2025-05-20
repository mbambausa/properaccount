// src/lib/mojo/tax-engine/tax-engine.ts
/**
 * JavaScript adapter for the Mojo tax engine WebAssembly module.
 * Provides high-precision tax calculations with fallbacks to JavaScript.
 */

import Decimal from 'decimal.js';
import { initMojoModule, MojoModule } from '../loader';
import { getFeatureFlags } from '../feature-flags';

// Module state
let mojoTaxEngine: MojoModule | null = null;
let initializing = false;
let initializationError: Error | null = null;

// Depreciation methods
export enum DepreciationMethod {
  STRAIGHT_LINE = 0,
  DOUBLE_DECLINING = 1,
  SUM_OF_YEARS = 2,
  MACRS_RESIDENTIAL = 3,
  MACRS_COMMERCIAL = 4
}

interface DepreciationEntry {
  year: number;
  depreciation: string;
  accumulated: string;
  book_value: string;
}

interface RecaptureResult {
  realized_gain: string;
  recaptured_depreciation: string;
  capital_gain: string;
}

/**
 * Initialize the tax engine
 */
export async function initTaxEngine(forceJS = false): Promise<boolean> {
  // Check if Mojo should be used
  const { useMojoTaxEngine } = getFeatureFlags();
  
  if (!useMojoTaxEngine || forceJS) {
    console.log('Using JavaScript implementation for Tax Engine');
    return false;
  }
  
  // Prevent multiple initialization attempts
  if (mojoTaxEngine?.isInitialized) return true;
  if (initializing) return false;
  
  initializing = true;
  
  try {
    mojoTaxEngine = await initMojoModule('tax-engine');
    console.log('Mojo Tax Engine initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Mojo Tax Engine:', error);
    initializationError = error instanceof Error ? error : new Error(String(error));
    return false;
  } finally {
    initializing = false;
  }
}

/**
 * Calculate depreciation for a given year
 */
export async function calculateDepreciation(
  cost: number | string,
  salvageValue: number | string,
  usefulLife: number,
  method: DepreciationMethod = DepreciationMethod.STRAIGHT_LINE,
  currentYear: number = 1,
  placedInServiceMonth: number = 1
): Promise<string> {
  // Try to use Mojo implementation
  try {
    if (await initTaxEngine()) {
      const result = mojoTaxEngine!.exports.calculate_depreciation(
        String(cost),
        String(salvageValue),
        usefulLife,
        method,
        currentYear,
        placedInServiceMonth
      );
      return result;
    }
  } catch (error) {
    console.warn('Mojo depreciation calculation failed, falling back to JS:', error);
  }
  
  // Fallback to JavaScript implementation
  return calculateDepreciationJS(
    cost, 
    salvageValue, 
    usefulLife, 
    method, 
    currentYear,
    placedInServiceMonth
  );
}

/**
 * JavaScript implementation of depreciation calculation
 */
function calculateDepreciationJS(
  cost: number | string,
  salvageValue: number | string,
  usefulLife: number,
  method: DepreciationMethod = DepreciationMethod.STRAIGHT_LINE,
  currentYear: number = 1,
  placedInServiceMonth: number = 1
): string {
  // Validate inputs
  if (currentYear < 1 || currentYear > usefulLife + 1) {
    return "0.00";
  }
  
  const assetCost = new Decimal(cost);
  const residualValue = new Decimal(salvageValue);
  
  // Calculate months in service for first year
  let firstYearFactor = new Decimal(1);
  if (placedInServiceMonth > 1) {
    const monthsInService = 13 - placedInServiceMonth;
    firstYearFactor = new Decimal(monthsInService).div(12);
  }
  
  // Apply selected depreciation method
  if (method === DepreciationMethod.STRAIGHT_LINE) {
    // Straight-line: (cost - salvage) / useful_life
    const annualDepreciation = assetCost.minus(residualValue).div(usefulLife);
    
    if (currentYear === 1) {
      return annualDepreciation.times(firstYearFactor).toFixed(2);
    } else if (currentYear <= usefulLife) {
      return annualDepreciation.toFixed(2);
    } else {
      return "0.00";
    }
  }
  
  else if (method === DepreciationMethod.DOUBLE_DECLINING) {
    // Double-declining balance
    const rate = new Decimal(2).div(usefulLife);
    
    // Calculate remaining value after prior years' depreciation
    let bookValue = assetCost;
    for (let year = 1; year < currentYear; year++) {
      let deprRate = rate;
      if (year === 1) {
        deprRate = rate.times(firstYearFactor);
      }
      const yearlyDepreciation = bookValue.times(deprRate);
      bookValue = bookValue.minus(yearlyDepreciation);
    }
    
    // Ensure we don't depreciate below salvage value
    const maxDepreciation = bookValue.minus(residualValue);
    if (maxDepreciation.isNegative()) {
      return "0.00";
    }
    
    let depreciation = bookValue.times(rate);
    if (currentYear === 1) {
      depreciation = depreciation.times(firstYearFactor);
    }
    
    return depreciation.lessThan(maxDepreciation) 
      ? depreciation.toFixed(2) 
      : maxDepreciation.toFixed(2);
  }
  
  else if (method === DepreciationMethod.SUM_OF_YEARS) {
    // Sum-of-years-digits
    const n = usefulLife;
    const sum = (n * (n + 1)) / 2;
    const factor = new Decimal(usefulLife - currentYear + 1).div(sum);
    const depreciation = assetCost.minus(residualValue).times(factor);
    
    if (currentYear === 1) {
      return depreciation.times(firstYearFactor).toFixed(2);
    }
    
    return depreciation.toFixed(2);
  }
  
  else if (method === DepreciationMethod.MACRS_RESIDENTIAL) {
    // MACRS for residential rental property (27.5 years)
    let rate: Decimal;
    
    if (currentYear === 1) {
      rate = new Decimal("0.03636").times(firstYearFactor); // 3.636%
    } else if (currentYear > 27) {
      rate = new Decimal("0.01818"); // 1.818% (half year in year 28)
    } else {
      rate = new Decimal("0.03636"); // 3.636%
    }
    
    return assetCost.times(rate).toFixed(2);
  }
  
  else if (method === DepreciationMethod.MACRS_COMMERCIAL) {
    // MACRS for commercial property (39 years)
    let rate: Decimal;
    
    if (currentYear === 1) {
      rate = new Decimal("0.02564").times(firstYearFactor); // 2.564% (half year)
    } else if (currentYear > 39) {
      rate = new Decimal("0.01282"); // 1.282% (half year in year 40)
    } else {
      rate = new Decimal("0.02564"); // 2.564%
    }
    
    return assetCost.times(rate).toFixed(2);
  }
  
  // Default - straight line
  return assetCost.minus(residualValue).div(usefulLife).toFixed(2);
}

/**
 * Generate a complete depreciation schedule
 */
export async function generateDepreciationSchedule(
  cost: number | string,
  salvageValue: number | string,
  usefulLife: number,
  method: DepreciationMethod = DepreciationMethod.STRAIGHT_LINE,
  placedInServiceMonth: number = 1
): Promise<DepreciationEntry[]> {
  // Try to use Mojo implementation
  try {
    if (await initTaxEngine()) {
      const result = mojoTaxEngine!.exports.generate_depreciation_schedule(
        String(cost),
        String(salvageValue),
        usefulLife,
        method,
        placedInServiceMonth
      );
      return JSON.parse(result);
    }
  } catch (error) {
    console.warn('Mojo depreciation schedule generation failed, falling back to JS:', error);
  }
  
  // Fallback to JavaScript implementation
  return generateDepreciationScheduleJS(
    cost, 
    salvageValue, 
    usefulLife, 
    method, 
    placedInServiceMonth
  );
}

/**
 * JavaScript implementation of depreciation schedule generation
 */
function generateDepreciationScheduleJS(
  cost: number | string,
  salvageValue: number | string,
  usefulLife: number,
  method: DepreciationMethod = DepreciationMethod.STRAIGHT_LINE,
  placedInServiceMonth: number = 1
): DepreciationEntry[] {
  const schedule: DepreciationEntry[] = [];
  let accumulatedDepreciation = new Decimal(0);
  const assetCost = new Decimal(cost);
  const residualValue = new Decimal(salvageValue);
  let bookValue = assetCost;
  
  // Number of years to calculate (add 1 for partial final year)
  let yearsToCalculate = usefulLife;
  if (method === DepreciationMethod.MACRS_RESIDENTIAL && placedInServiceMonth > 1) {
    yearsToCalculate = 28; // 27.5 years with partial first and last years
  } else if (method === DepreciationMethod.MACRS_COMMERCIAL && placedInServiceMonth > 1) {
    yearsToCalculate = 40; // 39 years with partial first and last years
  }
  
  for (let year = 1; year <= yearsToCalculate; year++) {
    const depreciation = new Decimal(calculateDepreciationJS(
      assetCost.toString(),
      residualValue.toString(),
      usefulLife,
      method,
      year,
      placedInServiceMonth
    ));
    
    // Skip years with zero depreciation
    if (depreciation.isZero()) continue;
    
    accumulatedDepreciation = accumulatedDepreciation.plus(depreciation);
    bookValue = assetCost.minus(accumulatedDepreciation);
    
    // Ensure book value doesn't go below salvage value
    if (bookValue.lessThan(residualValue)) {
      bookValue = residualValue;
      // Adjust final depreciation
      const adjustedDepreciation = assetCost.minus(residualValue).minus(
        accumulatedDepreciation.minus(depreciation)
      );
      
      if (adjustedDepreciation.greaterThan(0)) {
        accumulatedDepreciation = assetCost.minus(residualValue);
        
        schedule.push({
          year,
          depreciation: adjustedDepreciation.toFixed(2),
          accumulated: accumulatedDepreciation.toFixed(2),
          book_value: bookValue.toFixed(2)
        });
      }
      
      break; // No more depreciation needed
    }
    
    schedule.push({
      year,
      depreciation: depreciation.toFixed(2),
      accumulated: accumulatedDepreciation.toFixed(2),
      book_value: bookValue.toFixed(2)
    });
  }
  
  return schedule;
}

/**
 * Calculate tax basis with improvements and depreciation
 */
export async function calculateTaxBasis(
  originalBasis: number | string,
  improvements: (number | string)[],
  depreciationTaken: number | string
): Promise<string> {
  // Try to use Mojo implementation
  try {
    if (await initTaxEngine()) {
      const improvementsJson = JSON.stringify(improvements);
      const result = mojoTaxEngine!.exports.calculate_tax_basis(
        String(originalBasis),
        improvementsJson,
        String(depreciationTaken)
      );
      return result;
    }
  } catch (error) {
    console.warn('Mojo tax basis calculation failed, falling back to JS:', error);
  }
  
  // Fallback to JavaScript implementation
  return calculateTaxBasisJS(originalBasis, improvements, depreciationTaken);
}

/**
 * JavaScript implementation of tax basis calculation
 */
function calculateTaxBasisJS(
  originalBasis: number | string,
  improvements: (number | string)[],
  depreciationTaken: number | string
): string {
  let basis = new Decimal(originalBasis);
  
  // Add improvements
  for (const improvement of improvements) {
    basis = basis.plus(new Decimal(improvement));
  }
  
  // Subtract depreciation
  basis = basis.minus(new Decimal(depreciationTaken));
  
  // Ensure basis doesn't go negative
  if (basis.isNegative()) {
    return "0.00";
  }
  
  return basis.toFixed(2);
}

/**
 * Calculate depreciation recapture for sold property
 */
export async function calculateDepreciationRecapture(
  originalCost: number | string,
  accumulatedDepreciation: number | string,
  salePrice: number | string
): Promise<RecaptureResult> {
  // Try to use Mojo implementation
  try {
    if (await initTaxEngine()) {
      const result = mojoTaxEngine!.exports.calculate_depreciation_recapture(
        String(originalCost),
        String(accumulatedDepreciation),
        String(salePrice)
      );
      return JSON.parse(result);
    }
  } catch (error) {
    console.warn('Mojo depreciation recapture calculation failed, falling back to JS:', error);
  }
  
  // Fallback to JavaScript implementation
  return calculateDepreciationRecaptureJS(originalCost, accumulatedDepreciation, salePrice);
}

/**
 * JavaScript implementation of depreciation recapture calculation
 */
function calculateDepreciationRecaptureJS(
  originalCost: number | string,
  accumulatedDepreciation: number | string,
  salePrice: number | string
): RecaptureResult {
  const cost = new Decimal(originalCost);
  const depreciation = new Decimal(accumulatedDepreciation);
  const price = new Decimal(salePrice);
  
  const adjustedBasis = cost.minus(depreciation);
  const realizedGain = price.minus(adjustedBasis);
  
  // No gain? No recapture.
  if (realizedGain.isNegative() || realizedGain.isZero()) {
    return {
      realized_gain: "0.00",
      recaptured_depreciation: "0.00",
      capital_gain: "0.00"
    };
  }
  
  // Calculate the portion that is recapture vs. capital gain
  const recapture = Decimal.min(realizedGain, depreciation);
  const capitalGain = realizedGain.minus(recapture);
  
  return {
    realized_gain: realizedGain.toFixed(2),
    recaptured_depreciation: recapture.toFixed(2),
    capital_gain: capitalGain.toFixed(2)
  };
}