// src/lib/loans/amortization.ts
/**
 * Loan Amortization Calculator
 * 
 * This module provides functions for calculating loan amortization schedules,
 * supporting various loan types, interest calculation methods, and prepayment scenarios.
 */

import { formatCurrency, formatPercent, formatDate } from '../../utils/format';

// ----------------
// Types
// ----------------

/**
 * Loan types supported by the calculator
 */
export type LoanType = 
  | 'FIXED_RATE'         // Fixed interest rate over the life of the loan
  | 'ADJUSTABLE_RATE'    // Interest rate can change periodically
  | 'INTEREST_ONLY'      // Pay only interest for initial period
  | 'BALLOON'            // Fixed payments with large balance due at end
  | 'GRADUATED'          // Payments increase over time
  | 'NEGATIVE_AMORTIZATION';  // Payment less than interest, balance increases

/**
 * Interest calculation methods
 */
export type InterestMethod = 
  | 'SIMPLE'             // Simple interest
  | 'COMPOUND'           // Compound interest
  | 'DAILY'              // Daily accrual (365/365)
  | 'DAILY_360'          // Daily accrual (360/360)
  | 'MONTHLY'            // Monthly accrual (30/360)
  | 'ACTUAL_365'         // Actual/365
  | 'ACTUAL_360';        // Actual/360

/**
 * Payment frequency options
 */
export type PaymentFrequency = 
  | 'MONTHLY'
  | 'BI_WEEKLY'
  | 'WEEKLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUALLY'
  | 'ANNUALLY';

/**
 * Compounding frequency options
 */
export type CompoundingFrequency = 
  | 'DAILY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUALLY'
  | 'ANNUALLY';

/**
 * Payment type (when payment is due)
 */
export type PaymentType = 
  | 'END_OF_PERIOD'      // Regular payment (arrears)
  | 'START_OF_PERIOD';   // Payment in advance

/**
 * Single payment in an amortization schedule
 */
export interface AmortizationPayment {
  /** Payment number */
  paymentNumber: number;
  /** Payment date */
  paymentDate: string;
  /** Total payment amount */
  paymentAmount: number;
  /** Principal portion of payment */
  principalAmount: number;
  /** Interest portion of payment */
  interestAmount: number;
  /** Extra payment amount (if any) */
  extraPayment?: number;
  /** Remaining loan balance after this payment */
  remainingBalance: number;
  /** Cumulative principal paid to date */
  cumulativePrincipal: number;
  /** Cumulative interest paid to date */
  cumulativeInterest: number;
}

/**
 * Rate adjustment in an adjustable rate loan
 */
export interface RateAdjustment {
  /** Payment number when adjustment occurs */
  paymentNumber: number;
  /** New interest rate after adjustment */
  newRate: number;
}

/**
 * Extra payment on a loan
 */
export interface ExtraPayment {
  /** Payment number for the extra payment */
  paymentNumber: number;
  /** Extra payment amount */
  amount: number;
  /** Whether to recalculate payment or reduce term */
  reduceTerm: boolean;
}

/**
 * Complete amortization schedule
 */
export interface AmortizationSchedule {
  /** Original loan amount */
  loanAmount: number;
  /** Loan annual interest rate (as decimal) */
  interestRate: number;
  /** Term in months */
  termMonths: number;
  /** Regular payment amount */
  paymentAmount: number;
  /** Total number of payments */
  numberOfPayments: number;
  /** First payment date */
  startDate: string;
  /** Individual payment details */
  payments: AmortizationPayment[];
  /** Total interest paid over life of loan */
  totalInterest: number;
  /** Total principal paid over life of loan */
  totalPrincipal: number;
  /** Total amount paid over life of loan */
  totalPaid: number;
  /** Annual percentage rate (APR) if different from note rate */
  apr?: number;
}

/**
 * Options for generating an amortization schedule
 */
export interface AmortizationOptions {
  /** Loan principal amount */
  loanAmount: number;
  /** Annual interest rate as decimal (e.g., 0.05 for 5%) */
  interestRate: number;
  /** Loan term in months */
  termMonths: number;
  /** Optional: Start date for the loan (defaults to current date) */
  startDate?: string;
  /** Optional: Type of loan */
  loanType?: LoanType;
  /** Optional: Payment frequency */
  paymentFrequency?: PaymentFrequency;
  /** Optional: Compounding frequency for interest */
  compoundingFrequency?: CompoundingFrequency;
  /** Optional: Interest calculation method */
  interestMethod?: InterestMethod;
  /** Optional: Payment type (end or start of period) */
  paymentType?: PaymentType;
  /** Optional: Extra payments to be made */
  extraPayments?: ExtraPayment[];
  /** Optional: Rate adjustments for ARM loans */
  rateAdjustments?: RateAdjustment[];
  /** Optional: Initial interest-only period (months) */
  interestOnlyPeriod?: number;
  /** Optional: Balloon payment at end */
  balloonPayment?: number;
  /** Optional: Annual fees */
  annualFees?: number;
  /** Optional: Whether to include leap years in calculations */
  includeLeapYears?: boolean;
  /** Optional: Custom payment amount (overrides calculated amount) */
  customPaymentAmount?: number;
}

// ----------------
// Main Functions
// ----------------

/**
 * Calculate the monthly payment for a loan
 * 
 * @param principal Loan amount
 * @param annualRate Annual interest rate as decimal
 * @param termMonths Loan term in months
 * @param paymentFrequency How often payments are made
 * @param compoundingFrequency How often interest compounds
 * @returns Monthly payment amount
 */
export function calculatePayment(
  principal: number,
  annualRate: number,
  termMonths: number,
  paymentFrequency: PaymentFrequency = 'MONTHLY',
  compoundingFrequency: CompoundingFrequency = 'MONTHLY'
): number {
  // Handle edge case of zero interest
  if (annualRate === 0) {
    return principal / termMonths;
  }

  // Convert annual rate to payment period rate
  const periodsPerYear = getPeriodsPerYear(paymentFrequency);
  const compoundsPerYear = getCompoundsPerYear(compoundingFrequency);
  
  // Calculate effective rate per period
  const effectiveRate = calculateEffectiveRate(
    annualRate,
    periodsPerYear,
    compoundsPerYear
  );
  
  // Convert term months to number of payments
  const numberOfPayments = (termMonths * periodsPerYear) / 12;
  
  // Calculate payment using standard formula: P = P0*r*(1+r)^n/((1+r)^n-1)
  const payment = principal * 
    (effectiveRate * Math.pow(1 + effectiveRate, numberOfPayments)) / 
    (Math.pow(1 + effectiveRate, numberOfPayments) - 1);
  
  return payment;
}

/**
 * Generate a complete amortization schedule for a loan
 * 
 * @param options Amortization calculation options
 * @returns Complete amortization schedule
 */
export function generateAmortizationSchedule(
  options: AmortizationOptions
): AmortizationSchedule {
  const {
    loanAmount,
    interestRate,
    termMonths,
    startDate = new Date().toISOString().slice(0, 10),
    loanType = 'FIXED_RATE',
    paymentFrequency = 'MONTHLY',
    compoundingFrequency = 'MONTHLY',
    interestMethod = 'COMPOUND',
    paymentType = 'END_OF_PERIOD',
    extraPayments = [],
    rateAdjustments = [],
    interestOnlyPeriod = 0,
    balloonPayment = 0,
    customPaymentAmount
  } = options;

  // Validate inputs
  if (loanAmount <= 0) throw new Error('Loan amount must be positive');
  if (interestRate < 0) throw new Error('Interest rate cannot be negative');
  if (termMonths <= 0) throw new Error('Loan term must be positive');

  // Calculate payment amount if not provided
  const calculatedPayment = calculatePayment(
    loanAmount,
    interestRate,
    termMonths,
    paymentFrequency,
    compoundingFrequency
  );
  
  // Use custom payment if provided, otherwise use calculated payment
  const periodicPayment = customPaymentAmount || calculatedPayment;
  
  // For interest-only loans, calculate the interest-only payment
  let interestOnlyPayment = 0;
  if (loanType === 'INTEREST_ONLY' && interestOnlyPeriod > 0) {
    interestOnlyPayment = loanAmount * interestRate / getPeriodsPerYear(paymentFrequency);
  }

  // Set up initial values
  let balance = loanAmount;
  let paymentNumber = 1;
  let cumulativePrincipal = 0;
  let cumulativeInterest = 0;
  let currentRate = interestRate;
  
  // Calculate payments per year and payment interval
  const periodsPerYear = getPeriodsPerYear(paymentFrequency);
  const paymentIntervalDays = 365 / periodsPerYear;
  
  // Create payment array
  const payments: AmortizationPayment[] = [];
  
  // Date calculator for payment dates
  const getPaymentDate = (startDate: string, paymentNumber: number): string => {
    const startDateTime = new Date(startDate);
    const newDate = new Date(startDateTime);
    
    // Adjust based on payment frequency
    switch (paymentFrequency) {
      case 'MONTHLY':
        newDate.setMonth(startDateTime.getMonth() + paymentNumber - 1);
        break;
      case 'BI_WEEKLY':
        newDate.setDate(startDateTime.getDate() + (paymentNumber - 1) * 14);
        break;
      case 'WEEKLY':
        newDate.setDate(startDateTime.getDate() + (paymentNumber - 1) * 7);
        break;
      case 'QUARTERLY':
        newDate.setMonth(startDateTime.getMonth() + (paymentNumber - 1) * 3);
        break;
      case 'SEMI_ANNUALLY':
        newDate.setMonth(startDateTime.getMonth() + (paymentNumber - 1) * 6);
        break;
      case 'ANNUALLY':
        newDate.setFullYear(startDateTime.getFullYear() + paymentNumber - 1);
        break;
    }
    
    return newDate.toISOString().slice(0, 10);
  };

  // Maximum number of payments based on term and frequency
  const maxPayments = Math.ceil((termMonths / 12) * periodsPerYear);
  
  // Generate each payment in the schedule
  while (paymentNumber <= maxPayments && balance > 0.01) {
    // Check for rate adjustments
    const adjustment = rateAdjustments.find(adj => adj.paymentNumber === paymentNumber);
    if (adjustment) {
      currentRate = adjustment.newRate;
    }
    
    // Calculate payment date
    const paymentDate = getPaymentDate(startDate, paymentNumber);
    
    // Calculate interest for this period
    let interestAmount = 0;
    
    // Determine periodic rate based on interest method
    const periodicRate = calculatePeriodicRate(
      currentRate,
      interestMethod,
      periodsPerYear,
      getCompoundsPerYear(compoundingFrequency),
      paymentIntervalDays
    );
    
    interestAmount = balance * periodicRate;
    
    // Determine payment amount for this period
    let thisPaymentAmount = periodicPayment;
    
    // Handle interest-only period
    if (loanType === 'INTEREST_ONLY' && paymentNumber <= interestOnlyPeriod) {
      thisPaymentAmount = interestOnlyPayment;
    }
    
    // Handle balloon payment at the end
    if (loanType === 'BALLOON' && paymentNumber === maxPayments) {
      thisPaymentAmount = balance + interestAmount;
    }
    
    // Calculate principal portion
    let principalAmount = thisPaymentAmount - interestAmount;
    
    // Handle negative amortization
    if (loanType === 'NEGATIVE_AMORTIZATION' && principalAmount < 0) {
      principalAmount = 0;
      thisPaymentAmount = interestAmount;
    }
    
    // Ensure we don't overpay
    if (principalAmount > balance) {
      principalAmount = balance;
      thisPaymentAmount = principalAmount + interestAmount;
    }
    
    // Check for extra payment
    const extraPaymentEntry = extraPayments.find(ep => ep.paymentNumber === paymentNumber);
    let extraPayment = 0;
    
    if (extraPaymentEntry) {
      extraPayment = extraPaymentEntry.amount;
      // Cap the extra payment to the remaining balance
      if (extraPayment > balance - principalAmount) {
        extraPayment = balance - principalAmount;
      }
      principalAmount += extraPayment;
      thisPaymentAmount += extraPayment;
    }
    
    // Update balance and cumulative totals
    balance -= principalAmount;
    cumulativePrincipal += principalAmount;
    cumulativeInterest += interestAmount;
    
    // Add payment to schedule
    payments.push({
      paymentNumber,
      paymentDate,
      paymentAmount: thisPaymentAmount,
      principalAmount,
      interestAmount,
      extraPayment: extraPayment > 0 ? extraPayment : undefined,
      remainingBalance: balance,
      cumulativePrincipal,
      cumulativeInterest
    });
    
    // Increment payment number
    paymentNumber++;
    
    // Break early if balance is paid off
    if (balance <= 0.01) {
      balance = 0;
      break;
    }
  }
  
  // Calculate totals
  const totalPrincipal = payments.reduce((sum, payment) => sum + payment.principalAmount, 0);
  const totalInterest = payments.reduce((sum, payment) => sum + payment.interestAmount, 0);
  const totalPaid = totalPrincipal + totalInterest;
  
  // Build and return the schedule
  return {
    loanAmount,
    interestRate,
    termMonths,
    paymentAmount: periodicPayment,
    numberOfPayments: payments.length,
    startDate,
    payments,
    totalInterest,
    totalPrincipal,
    totalPaid
  };
}

/**
 * Calculate the APR (Annual Percentage Rate) for a loan including fees
 * 
 * @param loanAmount Principal loan amount
 * @param interestRate Stated interest rate (as decimal)
 * @param termMonths Loan term in months
 * @param fees Origination fees and other upfront costs
 * @returns APR as a decimal
 */
export function calculateAPR(
  loanAmount: number,
  interestRate: number,
  termMonths: number,
  fees: number
): number {
  // Calculate the payment based on the stated rate
  const payment = calculatePayment(loanAmount, interestRate, termMonths);
  
  // Function to calculate present value at a given rate
  const presentValue = (rate: number): number => {
    let pv = 0;
    for (let i = 1; i <= termMonths; i++) {
      pv += payment / Math.pow(1 + rate/12, i);
    }
    return pv;
  };
  
  // Effective amount received (loan amount minus fees)
  const effectiveAmount = loanAmount - fees;
  
  // Use iterative approach to find APR
  let aprGuess = interestRate;
  let stepSize = 0.01;
  let iterations = 0;
  const maxIterations = 100;
  
  while (iterations < maxIterations) {
    const pvAtGuess = presentValue(aprGuess);
    
    if (Math.abs(pvAtGuess - effectiveAmount) < 0.01) {
      break;
    }
    
    if (pvAtGuess > effectiveAmount) {
      aprGuess += stepSize;
    } else {
      aprGuess -= stepSize;
      stepSize /= 2;
    }
    
    iterations++;
  }
  
  return aprGuess;
}

/**
 * Calculate total interest paid over the life of a loan
 * 
 * @param principal Loan amount
 * @param annualRate Annual interest rate as decimal
 * @param termMonths Loan term in months
 * @param extraPayments Optional array of extra payments
 * @returns Total interest paid
 */
export function calculateTotalInterest(
  principal: number,
  annualRate: number,
  termMonths: number,
  extraPayments: ExtraPayment[] = []
): number {
  // Generate the full schedule and return total interest
  const schedule = generateAmortizationSchedule({
    loanAmount: principal,
    interestRate: annualRate,
    termMonths,
    extraPayments
  });
  
  return schedule.totalInterest;
}

/**
 * Calculate the impact of extra payments on a loan
 * 
 * @param principal Loan amount
 * @param annualRate Annual interest rate as decimal
 * @param termMonths Loan term in months
 * @param extraPaymentAmount Monthly extra payment amount
 * @param startAfterPayment Payment number to start extra payments
 * @returns Object with savings and new payoff details
 */
export function calculateExtraPaymentImpact(
  principal: number,
  annualRate: number,
  termMonths: number,
  extraPaymentAmount: number,
  startAfterPayment: number = 1
): { 
  interestSaved: number, 
  timeReducedMonths: number, 
  newPayoffDate: string,
  originalTotalInterest: number,
  newTotalInterest: number
} {
  // Calculate original schedule
  const originalSchedule = generateAmortizationSchedule({
    loanAmount: principal,
    interestRate: annualRate,
    termMonths
  });
  
  // Generate array of extra payments
  const extraPayments: ExtraPayment[] = [];
  for (let i = startAfterPayment; i <= termMonths; i++) {
    extraPayments.push({
      paymentNumber: i,
      amount: extraPaymentAmount,
      reduceTerm: true
    });
  }
  
  // Calculate new schedule with extra payments
  const newSchedule = generateAmortizationSchedule({
    loanAmount: principal,
    interestRate: annualRate,
    termMonths,
    extraPayments
  });
  
  // Calculate differences
  const interestSaved = originalSchedule.totalInterest - newSchedule.totalInterest;
  const timeReducedMonths = originalSchedule.numberOfPayments - newSchedule.numberOfPayments;
  
  // Calculate new payoff date
  const originalStartDate = new Date(originalSchedule.startDate);
  const originalPayoffDate = new Date(originalStartDate);
  originalPayoffDate.setMonth(originalPayoffDate.getMonth() + originalSchedule.numberOfPayments);
  
  const newPayoffDate = new Date(originalStartDate);
  newPayoffDate.setMonth(newPayoffDate.getMonth() + newSchedule.numberOfPayments);
  
  return {
    interestSaved,
    timeReducedMonths,
    newPayoffDate: newPayoffDate.toISOString().slice(0, 10),
    originalTotalInterest: originalSchedule.totalInterest,
    newTotalInterest: newSchedule.totalInterest
  };
}

/**
 * Compare multiple loan scenarios
 * 
 * @param scenarios Array of loan scenarios to compare
 * @returns Comparison of all scenarios
 */
export function compareLoanScenarios(
  scenarios: AmortizationOptions[]
): Array<{
  name: string;
  monthlyPayment: number;
  totalInterest: number;
  totalPaid: number;
  term: number;
}> {
  return scenarios.map((scenario, index) => {
    const schedule = generateAmortizationSchedule(scenario);
    
    return {
      name: `Scenario ${index + 1}`,
      monthlyPayment: schedule.paymentAmount,
      totalInterest: schedule.totalInterest,
      totalPaid: schedule.totalPaid,
      term: schedule.numberOfPayments
    };
  });
}

/**
 * Format an amortization schedule for display
 * 
 * @param schedule Amortization schedule to format
 * @param currencyCode Currency code to use for formatting
 * @returns Formatted amortization schedule with string values
 */
export function formatAmortizationSchedule(schedule: AmortizationSchedule, currencyCode = 'USD'): any {
  // Create a deep copy to avoid modifying the original
  const formattedSchedule = JSON.parse(JSON.stringify(schedule));
  
  // Format monetary values
  formattedSchedule.formattedLoanAmount = formatCurrency(schedule.loanAmount, currencyCode);
  formattedSchedule.formattedPaymentAmount = formatCurrency(schedule.paymentAmount, currencyCode);
  formattedSchedule.formattedTotalInterest = formatCurrency(schedule.totalInterest, currencyCode);
  formattedSchedule.formattedTotalPrincipal = formatCurrency(schedule.totalPrincipal, currencyCode);
  formattedSchedule.formattedTotalPaid = formatCurrency(schedule.totalPaid, currencyCode);
  formattedSchedule.formattedInterestRate = formatPercent(schedule.interestRate);
  
  // Format individual payments
  formattedSchedule.payments = schedule.payments.map(payment => ({
    ...payment,
    formattedPaymentDate: formatDate(new Date(payment.paymentDate)),
    formattedPaymentAmount: formatCurrency(payment.paymentAmount, currencyCode),
    formattedPrincipalAmount: formatCurrency(payment.principalAmount, currencyCode),
    formattedInterestAmount: formatCurrency(payment.interestAmount, currencyCode),
    formattedExtraPayment: payment.extraPayment 
      ? formatCurrency(payment.extraPayment, currencyCode) 
      : undefined,
    formattedRemainingBalance: formatCurrency(payment.remainingBalance, currencyCode),
    formattedCumulativePrincipal: formatCurrency(payment.cumulativePrincipal, currencyCode),
    formattedCumulativeInterest: formatCurrency(payment.cumulativeInterest, currencyCode)
  }));
  
  return formattedSchedule;
}

// ----------------
// Helper Functions
// ----------------

/**
 * Get the number of payment periods per year based on frequency
 */
function getPeriodsPerYear(frequency: PaymentFrequency): number {
  switch (frequency) {
    case 'MONTHLY': return 12;
    case 'BI_WEEKLY': return 26;
    case 'WEEKLY': return 52;
    case 'QUARTERLY': return 4;
    case 'SEMI_ANNUALLY': return 2;
    case 'ANNUALLY': return 1;
    default: return 12;
  }
}

/**
 * Get the number of compounding periods per year
 */
function getCompoundsPerYear(frequency: CompoundingFrequency): number {
  switch (frequency) {
    case 'DAILY': return 365;
    case 'MONTHLY': return 12;
    case 'QUARTERLY': return 4;
    case 'SEMI_ANNUALLY': return 2;
    case 'ANNUALLY': return 1;
    default: return 12;
  }
}

/**
 * Calculate effective interest rate per period
 */
function calculateEffectiveRate(
  annualRate: number,
  periodsPerYear: number,
  compoundsPerYear: number
): number {
  // If compounding frequency matches payment frequency, simple division
  if (periodsPerYear === compoundsPerYear) {
    return annualRate / periodsPerYear;
  }
  
  // Otherwise use effective rate formula
  const effectiveAnnualRate = Math.pow(1 + annualRate / compoundsPerYear, compoundsPerYear) - 1;
  return Math.pow(1 + effectiveAnnualRate, 1 / periodsPerYear) - 1;
}

/**
 * Calculate periodic interest rate based on method
 */
function calculatePeriodicRate(
  annualRate: number,
  method: InterestMethod,
  periodsPerYear: number,
  compoundsPerYear: number,
  daysInPeriod: number
): number {
  switch (method) {
    case 'SIMPLE':
      return annualRate / periodsPerYear;
      
    case 'COMPOUND':
      return calculateEffectiveRate(annualRate, periodsPerYear, compoundsPerYear);
      
    case 'DAILY':
      return annualRate * daysInPeriod / 365;
      
    case 'DAILY_360':
      return annualRate * daysInPeriod / 360;
      
    case 'MONTHLY':
      return annualRate / 12;
      
    case 'ACTUAL_365':
      return annualRate * daysInPeriod / 365;
      
    case 'ACTUAL_360':
      return annualRate * daysInPeriod / 360;
      
    default:
      return annualRate / periodsPerYear;
  }
}

/**
 * Check if a year is a leap year
 */
function isLeapYear(year: number): boolean {
  return ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0);
}

export default {
  calculatePayment,
  generateAmortizationSchedule,
  calculateAPR,
  calculateTotalInterest,
  calculateExtraPaymentImpact,
  compareLoanScenarios,
  formatAmortizationSchedule
};