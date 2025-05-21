// src/lib/tax/depreciation.ts
/**
 * Tax Depreciation Calculator
 * 
 * This module provides functions for calculating various depreciation methods
 * for tax purposes, including straight-line, declining balance, sum-of-years-digits,
 * and MACRS (Modified Accelerated Cost Recovery System).
 */

import { formatCurrency, formatPercent } from '../../utils/format';

// ----------------
// Types
// ----------------

/**
 * Depreciation methods supported
 */
export type DepreciationMethod = 
  | 'STRAIGHT_LINE'         // Equal amount each year
  | 'DECLINING_BALANCE'     // Accelerated based on % of remaining basis
  | 'SUM_OF_YEARS_DIGITS'   // Accelerated based on remaining years
  | 'MACRS_GDS'             // General Depreciation System
  | 'MACRS_ADS'             // Alternative Depreciation System
  | 'SECTION_179';          // Full expense in first year (up to limits)

/**
 * Conventions for partial-year depreciation
 */
export type DepreciationConvention = 
  | 'HALF_YEAR'            // Half year of depreciation in first and last years
  | 'MID_QUARTER'          // Based on quarter asset was placed in service
  | 'MID_MONTH'            // Based on month asset was placed in service
  | 'FULL_MONTH'           // Full month in both acquisition and disposal month
  | 'FULL_YEAR';           // Full year regardless of acquisition date

/**
 * Property classes and recovery periods (for MACRS)
 */
export type PropertyClass = 
  | '3_YEAR'      // 3-year property
  | '5_YEAR'      // 5-year property
  | '7_YEAR'      // 7-year property
  | '10_YEAR'     // 10-year property
  | '15_YEAR'     // 15-year property
  | '20_YEAR'     // 20-year property
  | '27_5_YEAR'   // 27.5-year residential rental property
  | '39_YEAR';    // 39-year nonresidential real property

/**
 * Asset information
 */
export interface DepreciableAsset {
  /** Asset ID */
  id?: string;
  /** Asset description */
  description: string;
  /** Date placed in service */
  placedInServiceDate: string;
  /** Original cost */
  originalCost: number;
  /** Salvage value (if applicable) */
  salvageValue?: number;
  /** Useful life in years */
  usefulLife: number;
  /** Property class (for MACRS) */
  propertyClass?: PropertyClass;
  /** Business use percentage (0-100) */
  businessUsePercentage?: number;
}

/**
 * Single period in a depreciation schedule
 */
export interface DepreciationPeriod {
  /** Period number (year) */
  period: number;
  /** Tax year */
  taxYear: number;
  /** Depreciation amount for this period */
  depreciation: number;
  /** Cumulative depreciation to date */
  accumulatedDepreciation: number;
  /** Remaining book value */
  bookValue: number;
  /** Depreciation rate for this period */
  rate?: number;
}

/**
 * Complete depreciation schedule
 */
export interface DepreciationSchedule {
  /** Asset information */
  asset: DepreciableAsset;
  /** Depreciation method used */
  method: DepreciationMethod;
  /** Convention applied */
  convention: DepreciationConvention;
  /** Depreciable basis (cost adjusted for business use %) */
  depreciableBasis: number;
  /** Periods (years) in the schedule */
  periods: DepreciationPeriod[];
  /** Total depreciation over all periods */
  totalDepreciation: number;
  /** Was bonus depreciation applied */
  bonusDepreciation?: {
    /** Percentage taken as bonus */
    percentage: number;
    /** Amount taken as bonus */
    amount: number;
  };
  /** Was Section 179 applied */
  section179?: {
    /** Amount taken as Section 179 */
    amount: number;
  };
}

/**
 * Options for generating a depreciation schedule
 */
export interface DepreciationOptions {
  /** Asset to depreciate */
  asset: DepreciableAsset;
  /** Depreciation method to use */
  method?: DepreciationMethod;
  /** Convention to apply */
  convention?: DepreciationConvention;
  /** Declining balance percentage (if using declining balance) */
  decliningBalanceRate?: number;
  /** Apply bonus depreciation */
  bonusDepreciation?: {
    /** Percentage to apply */
    percentage: number;
    /** Apply bonus depreciation */
    apply: boolean;
  };
  /** Apply Section 179 expensing */
  section179?: {
    /** Amount to expense under Section 179 */
    amount: number;
    /** Apply Section 179 */
    apply: boolean;
  };
  /** Tax year to start depreciation */
  startYear?: number;
}

// ----------------
// MACRS Percentage Tables
// ----------------

/**
 * GDS MACRS Tables (half-year convention)
 * Based on IRS Publication 946, Appendix A
 */
const MACRS_GDS_TABLES: Record<string, number[]> = {
  '3_YEAR': [33.33, 44.45, 14.81, 7.41],
  '5_YEAR': [20.00, 32.00, 19.20, 11.52, 11.52, 5.76],
  '7_YEAR': [14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93, 4.46],
  '10_YEAR': [10.00, 18.00, 14.40, 11.52, 9.22, 7.37, 6.55, 6.55, 6.56, 6.55, 3.28],
  '15_YEAR': [5.00, 9.50, 8.55, 7.70, 6.93, 6.23, 5.90, 5.90, 5.91, 5.90, 5.91, 5.90, 5.91, 5.90, 5.91, 2.95],
  '20_YEAR': [3.750, 7.219, 6.677, 6.177, 5.713, 5.285, 4.888, 4.522, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 4.462, 4.461, 2.231],
  '27_5_YEAR': new Array(28).fill(3.636).map((rate, index) => index === 0 || index === 27 ? rate / 2 : rate),
  '39_YEAR': new Array(40).fill(2.564).map((rate, index) => index === 0 || index === 39 ? rate / 2 : rate)
};

/**
 * ADS MACRS Tables (straight-line over recovery period)
 * These percentages are simplified for representation - actual calculations would
 * incorporate the applicable convention
 */
const MACRS_ADS_TABLES: Record<string, number[]> = {
  '3_YEAR': [16.67, 33.33, 33.33, 16.67],
  '5_YEAR': [10.00, 20.00, 20.00, 20.00, 20.00, 10.00],
  '7_YEAR': [7.14, 14.29, 14.29, 14.29, 14.29, 14.29, 14.29, 7.12],
  '10_YEAR': [5.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 10.00, 5.00],
  '15_YEAR': [3.33, 6.67, 6.67, 6.67, 6.67, 6.67, 6.67, 6.67, 6.67, 6.67, 6.67, 6.67, 6.67, 6.67, 6.67, 3.33],
  '20_YEAR': [2.50, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 5.00, 2.50],
  '27_5_YEAR': new Array(28).fill(3.636).map((rate, index) => index === 0 || index === 27 ? rate / 2 : rate),
  '39_YEAR': new Array(40).fill(2.564).map((rate, index) => index === 0 || index === 39 ? rate / 2 : rate)
};

// ----------------
// Main Functions
// ----------------

/**
 * Generate a complete depreciation schedule based on options
 * 
 * @param options Depreciation calculation options
 * @returns Complete depreciation schedule
 */
export function generateDepreciationSchedule(
  options: DepreciationOptions
): DepreciationSchedule {
  const {
    asset,
    method = 'MACRS_GDS',
    convention = 'HALF_YEAR',
    decliningBalanceRate = 200, // 200% = double declining balance
    bonusDepreciation = { percentage: 0, apply: false },
    section179 = { amount: 0, apply: false },
    startYear = new Date().getFullYear()
  } = options;

  // Calculate depreciable basis (adjust for business use)
  let depreciableBasis = asset.originalCost;
  
  if (asset.businessUsePercentage !== undefined && asset.businessUsePercentage < 100) {
    depreciableBasis = asset.originalCost * (asset.businessUsePercentage / 100);
  }
  
  // Initialize bonus and section 179 amounts
  let bonusAmount = 0;
  let section179Amount = 0;
  
  // Apply Section 179 if requested
  if (section179.apply && section179.amount > 0) {
    // Cap Section 179 at the depreciable basis
    section179Amount = Math.min(section179.amount, depreciableBasis);
    // Reduce the depreciable basis by the Section 179 amount
    depreciableBasis -= section179Amount;
  }
  
  // Apply bonus depreciation if requested
  if (bonusDepreciation.apply && bonusDepreciation.percentage > 0) {
    // Calculate bonus amount
    bonusAmount = depreciableBasis * (bonusDepreciation.percentage / 100);
    // Reduce the depreciable basis by the bonus amount
    depreciableBasis -= bonusAmount;
  }
  
  // Calculate depreciation periods based on method
  let periods: DepreciationPeriod[] = [];
  
  switch (method) {
    case 'STRAIGHT_LINE':
      periods = calculateStraightLine(asset, depreciableBasis, convention, startYear);
      break;
      
    case 'DECLINING_BALANCE':
      periods = calculateDecliningBalance(
        asset, 
        depreciableBasis, 
        convention, 
        decliningBalanceRate, 
        startYear
      );
      break;
      
    case 'SUM_OF_YEARS_DIGITS':
      periods = calculateSumOfYearsDigits(asset, depreciableBasis, convention, startYear);
      break;
      
    case 'MACRS_GDS':
      periods = calculateMACRS(asset, depreciableBasis, 'GDS', convention, startYear);
      break;
      
    case 'MACRS_ADS':
      periods = calculateMACRS(asset, depreciableBasis, 'ADS', convention, startYear);
      break;
      
    case 'SECTION_179':
      // When using Section 179 as primary method, expense entire amount in first year
      periods = calculateSection179(asset, depreciableBasis, startYear);
      section179Amount = depreciableBasis;
      depreciableBasis = 0;
      break;
  }
  
  // If there's bonus or Section 179, add it to the first year
  if (periods.length > 0 && (bonusAmount > 0 || section179Amount > 0)) {
    periods[0].depreciation += bonusAmount + section179Amount;
    periods[0].accumulatedDepreciation += bonusAmount + section179Amount;
    
    // Adjust book values for all periods
    const totalFirstYear = periods[0].depreciation;
    
    // Update all periods after the first
    for (let i = 1; i < periods.length; i++) {
      periods[i].accumulatedDepreciation = 
        periods[i-1].accumulatedDepreciation + periods[i].depreciation;
      
      periods[i].bookValue = 
        asset.originalCost - periods[i].accumulatedDepreciation;
    }
    
    // Update first period book value
    periods[0].bookValue = asset.originalCost - totalFirstYear;
  }
  
  // Calculate total depreciation
  const totalDepreciation = periods.reduce((sum, period) => sum + period.depreciation, 0);
  
  // Build and return the full schedule
  const schedule: DepreciationSchedule = {
    asset,
    method,
    convention,
    depreciableBasis: asset.originalCost - section179Amount,
    periods,
    totalDepreciation
  };
  
  // Add bonus depreciation info if applied
  if (bonusDepreciation.apply && bonusAmount > 0) {
    schedule.bonusDepreciation = {
      percentage: bonusDepreciation.percentage,
      amount: bonusAmount
    };
  }
  
  // Add Section 179 info if applied
  if ((section179.apply && section179Amount > 0) || method === 'SECTION_179') {
    schedule.section179 = {
      amount: section179Amount
    };
  }
  
  return schedule;
}

/**
 * Calculate current-year depreciation for an asset
 * 
 * @param asset Asset information
 * @param currentYear Year to calculate depreciation for
 * @param options Depreciation options
 * @returns Depreciation amount for the specified year
 */
export function calculateCurrentYearDepreciation(
  asset: DepreciableAsset,
  currentYear: number,
  options: DepreciationOptions
): number {
  // Generate the complete schedule
  const schedule = generateDepreciationSchedule({
    ...options,
    asset,
    startYear: new Date(asset.placedInServiceDate).getFullYear()
  });
  
  // Find the period for the requested year
  const period = schedule.periods.find(p => p.taxYear === currentYear);
  
  // Return the depreciation for the period, or 0 if not found
  return period ? period.depreciation : 0;
}

/**
 * Calculate total accumulated depreciation through a specific year
 * 
 * @param asset Asset information
 * @param throughYear Year to calculate accumulated depreciation through
 * @param options Depreciation options
 * @returns Accumulated depreciation through the specified year
 */
export function calculateAccumulatedDepreciation(
  asset: DepreciableAsset,
  throughYear: number,
  options: DepreciationOptions
): number {
  // Generate the complete schedule
  const schedule = generateDepreciationSchedule({
    ...options,
    asset,
    startYear: new Date(asset.placedInServiceDate).getFullYear()
  });
  
  // Find all periods up to and including the requested year
  const relevantPeriods = schedule.periods.filter(p => p.taxYear <= throughYear);
  
  // Sum up depreciation for all relevant periods
  return relevantPeriods.reduce((sum, period) => sum + period.depreciation, 0);
}

/**
 * Calculate remaining depreciable basis as of a specific year
 * 
 * @param asset Asset information
 * @param asOfYear Year to calculate remaining basis for
 * @param options Depreciation options
 * @returns Remaining depreciable basis
 */
export function calculateRemainingBasis(
  asset: DepreciableAsset,
  asOfYear: number,
  options: DepreciationOptions
): number {
  // Generate the complete schedule
  const schedule = generateDepreciationSchedule({
    ...options,
    asset,
    startYear: new Date(asset.placedInServiceDate).getFullYear()
  });
  
  // Find the period for the requested year
  const period = schedule.periods.find(p => p.taxYear === asOfYear);
  
  // Return the book value for the period, or the original cost if not found
  return period ? period.bookValue : asset.originalCost;
}

/**
 * Determine optimal depreciation method for tax purposes
 * 
 * @param asset Asset information
 * @param options Additional options to consider
 * @returns Recommended depreciation method and options
 */
export function recommendDepreciationMethod(
  asset: DepreciableAsset,
  options: {
    eligibleForBonus?: boolean;
    eligibleForSection179?: boolean;
    seekAcceleratedDeduction?: boolean;
    expectedTaxRateIncrease?: boolean;
  } = {}
): {
  method: DepreciationMethod;
  convention: DepreciationConvention;
  useBonus?: boolean;
  useSection179?: boolean;
  rationale: string;
} {
  const {
    eligibleForBonus = true,
    eligibleForSection179 = true,
    seekAcceleratedDeduction = true,
    expectedTaxRateIncrease = false
  } = options;
  
  // Start with MACRS GDS as the default
  let method: DepreciationMethod = 'MACRS_GDS';
  let convention: DepreciationConvention = 'HALF_YEAR';
  let useBonus = false;
  let useSection179 = false;
  let rationale = 'MACRS GDS generally provides the optimal balance of accelerated deductions and simplicity.';
  
  // For real property (buildings), MACRS is typically required
  if (asset.propertyClass === '27_5_YEAR' || asset.propertyClass === '39_YEAR') {
    return {
      method: 'MACRS_GDS',
      convention: 'MID_MONTH',
      rationale: 'Real property must use MACRS GDS with mid-month convention.'
    };
  }
  
  // If accelerated deduction is desired and asset is eligible for Section 179
  if (seekAcceleratedDeduction && eligibleForSection179) {
    method = 'SECTION_179';
    useSection179 = true;
    rationale = 'Section 179 allows for immediate expensing of the full asset cost in the first year.';
    
    return { method, convention, useSection179, rationale };
  }
  
  // If accelerated deduction is desired and asset is eligible for bonus depreciation
  if (seekAcceleratedDeduction && eligibleForBonus) {
    useBonus = true;
    rationale = 'Bonus depreciation combined with MACRS GDS provides substantial first-year deduction.';
    
    return { method, convention, useBonus, rationale };
  }
  
  // If expecting tax rate increases, may want to defer deductions
  if (expectedTaxRateIncrease) {
    method = 'STRAIGHT_LINE';
    rationale = 'Straight-line method defers deductions to future years when tax rates may be higher.';
    
    return { method, convention, rationale };
  }
  
  // Default recommendation
  return { method, convention, useBonus, useSection179, rationale };
}

/**
 * Format a depreciation schedule for display
 * 
 * @param schedule Depreciation schedule to format
 * @param currencyCode Currency code to use for formatting
 * @returns Formatted depreciation schedule with string values
 */
export function formatDepreciationSchedule(
  schedule: DepreciationSchedule, 
  currencyCode = 'USD'
): any {
  // Create a deep copy to avoid modifying the original
  const formattedSchedule = JSON.parse(JSON.stringify(schedule));
  
  // Format monetary values
  formattedSchedule.formattedDepreciableBasis = formatCurrency(
    schedule.depreciableBasis, 
    currencyCode
  );
  
  formattedSchedule.formattedTotalDepreciation = formatCurrency(
    schedule.totalDepreciation, 
    currencyCode
  );
  
  // Format bonus depreciation if present
  if (schedule.bonusDepreciation) {
    formattedSchedule.bonusDepreciation.formattedAmount = formatCurrency(
      schedule.bonusDepreciation.amount, 
      currencyCode
    );
    formattedSchedule.bonusDepreciation.formattedPercentage = formatPercent(
      schedule.bonusDepreciation.percentage / 100
    );
  }
  
  // Format Section 179 if present
  if (schedule.section179) {
    formattedSchedule.section179.formattedAmount = formatCurrency(
      schedule.section179.amount, 
      currencyCode
    );
  }
  
  // Format individual periods
  formattedSchedule.periods = schedule.periods.map(period => ({
    ...period,
    formattedDepreciation: formatCurrency(period.depreciation, currencyCode),
    formattedAccumulatedDepreciation: formatCurrency(period.accumulatedDepreciation, currencyCode),
    formattedBookValue: formatCurrency(period.bookValue, currencyCode),
    formattedRate: period.rate !== undefined ? formatPercent(period.rate / 100) : undefined
  }));
  
  return formattedSchedule;
}

// ----------------
// Method-Specific Calculation Functions
// ----------------

/**
 * Calculate straight-line depreciation
 */
function calculateStraightLine(
  asset: DepreciableAsset,
  depreciableBasis: number,
  convention: DepreciationConvention,
  startYear: number
): DepreciationPeriod[] {
  // Calculate depreciable amount (cost minus salvage value)
  const depreciableAmount = depreciableBasis - (asset.salvageValue || 0);
  
  // Calculate annual depreciation amount
  const annualDepreciation = depreciableAmount / asset.usefulLife;
  
  // Apply convention for first and last year
  const firstYearFactor = getFirstYearFactor(convention, asset.placedInServiceDate);
  const lastYearFactor = 1 - firstYearFactor;
  
  // Initialize periods array
  const periods: DepreciationPeriod[] = [];
  
  // Calculate depreciation for each period
  for (let year = 1; year <= asset.usefulLife + 1; year++) {
    let depreciation = 0;
    const taxYear = startYear + year - 1;
    
    if (year === 1) {
      // First year - apply convention
      depreciation = annualDepreciation * firstYearFactor;
    } else if (year === asset.usefulLife + 1) {
      // Last year (may be partial due to convention)
      depreciation = annualDepreciation * lastYearFactor;
    } else {
      // Full years
      depreciation = annualDepreciation;
    }
    
    // Only add period if there's depreciation
    if (depreciation > 0) {
      // Calculate accumulated depreciation and book value
      const previousAccumulated = periods.length > 0 
        ? periods[periods.length - 1].accumulatedDepreciation 
        : 0;
      
      const accumulatedDepreciation = previousAccumulated + depreciation;
      const bookValue = depreciableBasis - accumulatedDepreciation;
      
      // Add period to array
      periods.push({
        period: year,
        taxYear,
        depreciation,
        accumulatedDepreciation,
        bookValue,
        rate: 1 / asset.usefulLife * 100
      });
    }
  }
  
  return periods;
}

/**
 * Calculate declining balance depreciation
 */
function calculateDecliningBalance(
  asset: DepreciableAsset,
  depreciableBasis: number,
  convention: DepreciationConvention,
  decliningBalanceRate: number,
  startYear: number
): DepreciationPeriod[] {
  // Calculate the declining balance rate as a decimal
  const dbRate = decliningBalanceRate / 100 / asset.usefulLife;
  
  // Apply convention for first year
  const firstYearFactor = getFirstYearFactor(convention, asset.placedInServiceDate);
  
  // Initialize periods array and tracking variables
  const periods: DepreciationPeriod[] = [];
  let remainingBasis = depreciableBasis;
  let accumulatedDepreciation = 0;
  
  // Calculate depreciation for each period
  for (let year = 1; year <= asset.usefulLife * 2; year++) {
    // Stop if remaining basis is depleted
    if (remainingBasis <= (asset.salvageValue || 0) || remainingBasis < 0.01) {
      break;
    }
    
    const taxYear = startYear + year - 1;
    let depreciation = 0;
    
    // Calculate this year's depreciation
    if (year === 1) {
      // First year - apply convention
      depreciation = remainingBasis * dbRate * firstYearFactor;
    } else {
      // Check if switching to straight-line would give more depreciation
      const remainingYears = Math.max(asset.usefulLife - year + 1, 1);
      const straightLineAmount = remainingBasis / remainingYears;
      const decliningBalanceAmount = remainingBasis * dbRate;
      
      // Use the larger of the two
      depreciation = Math.max(straightLineAmount, decliningBalanceAmount);
    }
    
    // Ensure we don't depreciate below salvage value
    if (remainingBasis - depreciation < (asset.salvageValue || 0)) {
      depreciation = remainingBasis - (asset.salvageValue || 0);
    }
    
    // Only add period if there's depreciation
    if (depreciation > 0) {
      // Update tracking variables
      accumulatedDepreciation += depreciation;
      remainingBasis -= depreciation;
      
      // Calculate the effective rate for this period
      const effectiveRate = (depreciation / (remainingBasis + depreciation)) * 100;
      
      // Add period to array
      periods.push({
        period: year,
        taxYear,
        depreciation,
        accumulatedDepreciation,
        bookValue: remainingBasis,
        rate: effectiveRate
      });
    }
  }
  
  return periods;
}

/**
 * Calculate sum-of-years-digits depreciation
 */
function calculateSumOfYearsDigits(
  asset: DepreciableAsset,
  depreciableBasis: number,
  convention: DepreciationConvention,
  startYear: number
): DepreciationPeriod[] {
  // Calculate depreciable amount (cost minus salvage value)
  const depreciableAmount = depreciableBasis - (asset.salvageValue || 0);
  
  // Calculate sum of years digits
  const sumOfYears = (asset.usefulLife * (asset.usefulLife + 1)) / 2;
  
  // Apply convention for first year
  const firstYearFactor = getFirstYearFactor(convention, asset.placedInServiceDate);
  
  // Initialize periods array
  const periods: DepreciationPeriod[] = [];
  
  // Calculate depreciation for each period
  for (let year = 1; year <= asset.usefulLife; year++) {
    const taxYear = startYear + year - 1;
    
    // SYD factor: (remaining years / sum of years)
    const sydFactor = (asset.usefulLife - year + 1) / sumOfYears;
    
    // Calculate this year's depreciation
    let depreciation = depreciableAmount * sydFactor;
    
    // Apply convention to first year
    if (year === 1) {
      depreciation *= firstYearFactor;
    }
    
    // Calculate accumulated depreciation and book value
    const previousAccumulated = periods.length > 0 
      ? periods[periods.length - 1].accumulatedDepreciation 
      : 0;
    
    const accumulatedDepreciation = previousAccumulated + depreciation;
    const bookValue = depreciableBasis - accumulatedDepreciation;
    
    // Add period to array
    periods.push({
      period: year,
      taxYear,
      depreciation,
      accumulatedDepreciation,
      bookValue,
      rate: sydFactor * 100
    });
  }
  
  // If there's remaining book value due to convention, add final period
  const lastPeriod = periods[periods.length - 1];
  if (lastPeriod.bookValue > (asset.salvageValue || 0) + 0.01) {
    const finalDepreciation = lastPeriod.bookValue - (asset.salvageValue || 0);
    
    periods.push({
      period: asset.usefulLife + 1,
      taxYear: startYear + asset.usefulLife,
      depreciation: finalDepreciation,
      accumulatedDepreciation: lastPeriod.accumulatedDepreciation + finalDepreciation,
      bookValue: asset.salvageValue || 0,
      rate: (finalDepreciation / lastPeriod.bookValue) * 100
    });
  }
  
  return periods;
}

/**
 * Calculate MACRS depreciation
 */
function calculateMACRS(
  asset: DepreciableAsset,
  depreciableBasis: number,
  system: 'GDS' | 'ADS',
  convention: DepreciationConvention,
  startYear: number
): DepreciationPeriod[] {
  // Ensure property class is defined
  if (!asset.propertyClass) {
    throw new Error('Property class is required for MACRS depreciation');
  }
  
  // Get the appropriate MACRS table
  const macrsTable = system === 'GDS' 
    ? MACRS_GDS_TABLES[asset.propertyClass] 
    : MACRS_ADS_TABLES[asset.propertyClass];
  
  if (!macrsTable) {
    throw new Error(`MACRS table not found for property class ${asset.propertyClass}`);
  }
  
  // Initialize periods array
  const periods: DepreciationPeriod[] = [];
  
  // Calculate depreciation for each period using MACRS percentages
  for (let year = 1; year <= macrsTable.length; year++) {
    const taxYear = startYear + year - 1;
    
    // Get MACRS percentage for this year
    const macrsPercentage = macrsTable[year - 1] / 100;
    
    // Calculate this year's depreciation
    const depreciation = depreciableBasis * macrsPercentage;
    
    // Calculate accumulated depreciation and book value
    const previousAccumulated = periods.length > 0 
      ? periods[periods.length - 1].accumulatedDepreciation 
      : 0;
    
    const accumulatedDepreciation = previousAccumulated + depreciation;
    const bookValue = depreciableBasis - accumulatedDepreciation;
    
    // Add period to array
    periods.push({
      period: year,
      taxYear,
      depreciation,
      accumulatedDepreciation,
      bookValue,
      rate: macrsPercentage * 100
    });
  }
  
  return periods;
}

/**
 * Calculate Section 179 expensing (full deduction in first year)
 */
function calculateSection179(
  asset: DepreciableAsset,
  depreciableBasis: number,
  startYear: number
): DepreciationPeriod[] {
  // With Section 179, the entire amount is expensed in the first year
  return [{
    period: 1,
    taxYear: startYear,
    depreciation: depreciableBasis,
    accumulatedDepreciation: depreciableBasis,
    bookValue: 0,
    rate: 100
  }];
}

// ----------------
// Helper Functions
// ----------------

/**
 * Get the depreciation factor for the first year based on convention
 */
function getFirstYearFactor(
  convention: DepreciationConvention,
  placedInServiceDate: string
): number {
  const date = new Date(placedInServiceDate);
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  
  switch (convention) {
    case 'HALF_YEAR':
      return 0.5;
      
    case 'MID_QUARTER':
      // Determine which quarter the asset was placed in service
      const quarter = Math.ceil(month / 3);
      // Mid-quarter factors: Q1=0.875, Q2=0.625, Q3=0.375, Q4=0.125
      return 1 - (quarter * 0.25 - 0.125);
      
    case 'MID_MONTH':
      // Simplified mid-month calculation (actual calculation would be more complex)
      return (13 - month) / 12;
      
    case 'FULL_MONTH':
      return (12 - month + 1) / 12;
      
    case 'FULL_YEAR':
      return 1;
      
    default:
      return 0.5; // Default to half-year
  }
}

/**
 * Determine property class based on asset description and industry
 * This is a simplified implementation - a real one would be much more comprehensive
 * 
 * @param assetDescription Description of the asset
 * @param industry Industry the asset is used in
 * @returns Recommended property class
 */
export function determinePropertyClass(
  assetDescription: string,
  industry?: string
): PropertyClass {
  const description = assetDescription.toLowerCase();
  
  // Buildings and structures
  if (description.includes('building') || description.includes('structure')) {
    if (description.includes('residential') || description.includes('apartment')) {
      return '27_5_YEAR';
    } else {
      return '39_YEAR';
    }
  }
  
  // Vehicles and transportation equipment
  if (description.includes('car') || description.includes('truck') || 
      description.includes('van') || description.includes('vehicle')) {
    return '5_YEAR';
  }
  
  // Office equipment and furniture
  if (description.includes('computer') || description.includes('software') || 
      description.includes('laptop') || description.includes('server')) {
    return '5_YEAR';
  }
  
  if (description.includes('furniture') || description.includes('desk') || 
      description.includes('chair') || description.includes('office')) {
    return '7_YEAR';
  }
  
  // Manufacturing equipment
  if (description.includes('machinery') || description.includes('equipment') || 
      description.includes('production')) {
    return '7_YEAR';
  }
  
  // Land improvements
  if (description.includes('land improvement') || description.includes('pavement') || 
      description.includes('fence') || description.includes('landscape')) {
    return '15_YEAR';
  }
  
  // Default to 7-year property if we can't determine
  return '7_YEAR';
}

export default {
  generateDepreciationSchedule,
  calculateCurrentYearDepreciation,
  calculateAccumulatedDepreciation,
  calculateRemainingBasis,
  recommendDepreciationMethod,
  formatDepreciationSchedule,
  determinePropertyClass
};