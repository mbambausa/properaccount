// src/lib/mojo/loan-engine/loan-engine.ts
/**
 * JavaScript adapter for the Mojo loan engine WebAssembly module.
 * Provides high-precision loan calculations with fallbacks to JavaScript.
 */

import Decimal from 'decimal.js';
import { initMojoModule, MojoModule } from '../loader';
import { getFeatureFlags } from '../feature-flags';

// Module state
let mojoLoanEngine: MojoModule | null = null;
let initializing = false;
let initializationError: Error | null = null;

export enum RoundingMode {
  ROUND_HALF_EVEN = 0, // Banker's rounding (GAAP-compliant)
  ROUND_HALF_UP = 1,   // Round up on midpoint
  ROUND_UP = 2,        // Always round away from zero
  ROUND_DOWN = 3       // Always round toward zero
}

interface LoanPayment {
  term: number;
  payment: string;
  principal: string;
  interest: string;
  balance: string;
}

interface LoanScenario {
  scenario_id: number;
  principal: string;
  annual_rate: string;
  terms: number;
  payment_frequency: number;
  payment: string;
  total_interest: string;
  total_cost: string;
}

/**
 * Initialize the loan engine
 */
export async function initLoanEngine(forceJS = false): Promise<boolean> {
  // Check if Mojo should be used
  const { useMojoLoanEngine } = getFeatureFlags();
  
  if (!useMojoLoanEngine || forceJS) {
    console.log('Using JavaScript implementation for Loan Engine');
    return false;
  }
  
  // Prevent multiple initialization attempts
  if (mojoLoanEngine?.isInitialized) return true;
  if (initializing) return false;
  
  initializing = true;
  
  try {
    mojoLoanEngine = await initMojoModule('loan-engine');
    console.log('Mojo Loan Engine initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Mojo Loan Engine:', error);
    initializationError = error instanceof Error ? error : new Error(String(error));
    return false;
  } finally {
    initializing = false;
  }
}

/**
 * Calculate loan payment amount
 */
export async function calculateLoanPayment(
  principal: number | string,
  annualRate: number | string,
  terms: number,
  paymentFrequency: number = 12
): Promise<string> {
  // Try to use Mojo implementation
  try {
    if (await initLoanEngine()) {
      const result = mojoLoanEngine!.exports.calculate_loan_payment(
        String(principal),
        String(annualRate),
        terms,
        paymentFrequency
      );
      return result;
    }
  } catch (error) {
    console.warn('Mojo loan calculation failed, falling back to JS:', error);
  }
  
  // Fallback to JavaScript implementation
  return calculateLoanPaymentJS(principal, annualRate, terms, paymentFrequency);
}

/**
 * JavaScript implementation of loan payment calculation
 */
function calculateLoanPaymentJS(
  principal: number | string,
  annualRate: number | string,
  terms: number,
  paymentFrequency: number = 12
): string {
  // Use Decimal.js for high precision
  const p = new Decimal(principal);
  const r = new Decimal(annualRate).div(paymentFrequency);
  
  // If rate is zero, simple division
  if (r.isZero()) {
    return p.div(terms).toFixed(2);
  }
  
  // P * r * (1 + r)^n / ((1 + r)^n - 1)
  const onePlusR = r.add(1);
  const onePlusRPowN = onePlusR.pow(terms);
  const numerator = p.mul(r).mul(onePlusRPowN);
  const denominator = onePlusRPowN.sub(1);
  
  return numerator.div(denominator).toFixed(2);
}

/**
 * Generate amortization schedule
 */
export async function generateAmortizationSchedule(
  principal: number | string,
  annualRate: number | string,
  terms: number,
  paymentFrequency: number = 12
): Promise<LoanPayment[]> {
  // Try to use Mojo implementation
  try {
    if (await initLoanEngine()) {
      const result = mojoLoanEngine!.exports.generate_amortization_schedule(
        String(principal),
        String(annualRate),
        terms,
        paymentFrequency
      );
      return JSON.parse(result);
    }
  } catch (error) {
    console.warn('Mojo amortization calculation failed, falling back to JS:', error);
  }
  
  // Fallback to JavaScript implementation
  return generateAmortizationScheduleJS(principal, annualRate, terms, paymentFrequency);
}

/**
 * JavaScript implementation of amortization schedule
 */
function generateAmortizationScheduleJS(
  principal: number | string,
  annualRate: number | string,
  terms: number,
  paymentFrequency: number = 12
): LoanPayment[] {
  const p = new Decimal(principal);
  const r = new Decimal(annualRate).div(paymentFrequency);
  const payment = new Decimal(calculateLoanPaymentJS(principal, annualRate, terms, paymentFrequency));
  let remainingBalance = p;
  
  const schedule: LoanPayment[] = [];
  
  for (let term = 1; term <= terms; term++) {
    // Calculate interest for this period
    const interestPayment = remainingBalance.mul(r).toDecimalPlaces(2);
    
    // Calculate principal portion
    let principalPayment = payment.sub(interestPayment);
    let currentPayment = payment;
    
    // Handle final payment rounding
    if (term === terms) {
      principalPayment = remainingBalance;
      currentPayment = principalPayment.add(interestPayment);
    }
    
    // Update remaining balance
    remainingBalance = remainingBalance.sub(principalPayment);
    
    // Add to schedule
    schedule.push({
      term,
      payment: currentPayment.toFixed(2),
      principal: principalPayment.toFixed(2),
      interest: interestPayment.toFixed(2),
      balance: remainingBalance.toFixed(2)
    });
  }
  
  return schedule;
}

/**
 * Compare loan scenarios
 */
export async function compareLoanScenarios(
  principal: number | string,
  scenarios: [number | string, number, number][]
): Promise<LoanScenario[]> {
  // Try to use Mojo implementation
  try {
    if (await initLoanEngine()) {
      const scenariosJson = JSON.stringify(scenarios);
      const result = mojoLoanEngine!.exports.compare_loan_scenarios(
        String(principal),
        scenariosJson
      );
      return JSON.parse(result);
    }
  } catch (error) {
    console.warn('Mojo loan scenario comparison failed, falling back to JS:', error);
  }
  
  // Fallback to JavaScript implementation
  return compareLoanScenariosJS(principal, scenarios);
}

/**
 * JavaScript implementation of loan scenario comparison
 */
function compareLoanScenariosJS(
  principal: number | string,
  scenarios: [number | string, number, number][]
): LoanScenario[] {
  const p = new Decimal(principal);
  const results: LoanScenario[] = [];
  
  scenarios.forEach((scenario, index) => {
    const [annualRate, terms, paymentFrequency] = scenario;
    const payment = new Decimal(calculateLoanPaymentJS(principal, annualRate, terms, paymentFrequency));
    const totalPayments = payment.mul(terms);
    const totalInterest = totalPayments.sub(p);
    const totalCost = p.add(totalInterest);
    
    results.push({
      scenario_id: index + 1,
      principal: p.toString(),
      annual_rate: String(annualRate),
      terms,
      payment_frequency: paymentFrequency,
      payment: payment.toFixed(2),
      total_interest: totalInterest.toFixed(2),
      total_cost: totalCost.toFixed(2)
    });
  });
  
  return results;
}