// src/types/calculations.d.ts
/**
 * Defines TypeScript interfaces for real estate financial calculations,
 * investment analysis, operating metrics, and loan-related computations.
 */

// Property valuation metrics
export interface CapitalizationRate {
  netOperatingIncome: number;
  propertyValue: number;
  /** Capitalization Rate (NOI / Property Value) as a decimal (e.g., 0.08 for 8%). */
  rate: number;
}

export interface CashOnCashReturn {
  annualPreTaxCashFlow: number;
  totalCashInvested: number;
  /** Cash-on-Cash Return rate (Annual Pre-Tax Cash Flow / Total Cash Invested) as a decimal. */
  rate: number;
}

export interface GrossRentMultiplier {
  propertyPrice: number;
  annualGrossRentalIncome: number;
  /** Gross Rent Multiplier (Property Price / Annual Gross Rental Income). */
  multiplier: number;
}

export interface DebtServiceCoverageRatio {
  netOperatingIncome: number;
  totalDebtService: number; // Annual principal and interest payments
  /** DSCR (NOI / Total Debt Service). */
  ratio: number;
}

export interface InternalRateOfReturn {
  initialInvestment: number; // Typically a negative value
  cashFlows: Array<{
    year: number;
    amount: number;
  }>;
  holdingPeriodYears: number;
  terminalValue?: number; // Expected sale price or residual value at end of holding period
  /** Internal Rate of Return as a decimal (e.g., 0.12 for 12%). */
  irr: number;
}

// Operating metrics for a property
export interface PropertyOperatingMetrics {
  propertyId: string; // UUID
  period: {
    /** Unix timestamp (seconds) for the start of the period. */
    start: number;
    /** Unix timestamp (seconds) for the end of the period. */
    end: number;
  };

  // Income metrics
  grossPotentialRent: number;
  vacancyAndCreditLoss: number; // Renamed for clarity from 'vacancy'
  effectiveGrossIncome: number; // Gross Potential Rent - Vacancy & Credit Loss
  otherIncome: number; // e.g., laundry, parking, application fees
  totalRevenue: number; // Effective Gross Income + Other Income (renamed from totalIncome)

  // Expense metrics
  operatingExpenses: number; // Does not include debt service or capital expenditures
  capitalExpenditures?: number; // Optional, as sometimes analyzed separately
  totalExpenses: number; // Sum of operating and potentially other direct property expenses

  // Key results & ratios
  netOperatingIncome: number; // Total Revenue - Operating Expenses
  /** Operating Expense Ratio (OpEx / Effective Gross Income) as a decimal. */
  operatingExpenseRatio: number;
  /** Break-Even Ratio ((OpEx + Debt Service) / Gross Potential Rent) as a decimal. */
  breakEvenRatio?: number; // May require debt service data

  // Per unit metrics (if applicable, for multi-unit properties)
  averageIncomePerUnit?: number;
  averageExpensePerUnit?: number;
  averageNoiPerUnit?: number;
  unitCount?: number; // Number of units used for per-unit calculations
}

// Rent comparable for market analysis
export interface RentComparable {
  address: string;
  /** Distance in preferred unit (e.g., miles or km) from the subject property. */
  distance?: number;
  propertyType: string; // e.g., "Apartment", "Single-Family Home"
  yearBuilt?: number;
  bedrooms: number;
  bathrooms: number; // e.g., 1, 1.5, 2
  squareFootage?: number;
  amenities?: string[];

  // Rent data
  monthlyRent: number;
  rentPerSqFt?: number; // Calculated: monthlyRent / squareFootage
  /** Unix timestamp (seconds) of the last lease date for this comparable. */
  lastLeaseDate?: number;

  // Adjustments relative to the subject property
  adjustments?: Array<{
    factor: string; // e.g., "Condition", "View", "Amenities"
    adjustmentAmount: number; // Monetary adjustment (positive or negative)
    reason?: string;
  }>;
  adjustedMonthlyRent?: number; // Rent after adjustments

  // Source of comparable data
  source?: 'mls' | 'rental_listing_site' | 'property_manager_data' | 'public_record' | 'appraisal';
  confidence?: 'high' | 'medium' | 'low'; // Confidence in the accuracy of this comp
}

export interface RentAnalysis {
  subjectProperty: {
    propertyId: string; // UUID
    address: string;
    currentRent?: number;
    unitDescription?: string; // e.g., "2 bed, 1 bath"
  };
  comparables: RentComparable[];

  // Analysis results
  suggestedRentRange: {
    low: number;
    high: number;
    recommended: number;
  };
  averageAdjustedRentPerSqFt?: number;
  medianAdjustedRent?: number;
  /** Overall confidence in the rent analysis (0-1 or qualitative). */
  confidenceScore?: number | 'high' | 'medium' | 'low';

  // Market factors considered
  marketTrend?: 'increasing' | 'stable' | 'decreasing';
  /** Optional monetary adjustment based on seasonality. */
  seasonalAdjustment?: number;

  /** Unix timestamp (seconds) when the analysis was performed. */
  analysisDate: number;
  /** Unix timestamp (seconds) until when this analysis is considered reasonably valid. */
  validUntil?: number;
}

// Investment analysis for a property
export interface PropertyInvestmentAnalysis {
  property: {
    id: string; // UUID
    address: string;
    purchasePrice: number;
    closingCosts: number;
    initialRenovationCosts?: number; // Costs incurred at acquisition for renovation
  };

  financing: {
    downPayment: number;
    loanAmount: number;
    interestRate: number; // Annual interest rate as a decimal (e.g., 0.05 for 5%)
    loanTermYears: number; // Loan term in years
    monthlyPrincipalAndInterest: number; // P&I payment
    loanPoints?: number;
    otherLoanFees?: number;
  };

  // Projections, typically over a holding period (e.g., 5 or 10 years)
  projections: Array<{
    year: number;

    // Income
    grossScheduledRentalIncome: number;
    otherIncome: number;
    vacancyLossPercent: number; // As a decimal
    effectiveGrossIncome: number;

    // Expenses
    operatingExpenses: number; // Includes property tax, insurance, utilities, management, repairs
    annualDebtService: number; // Total P&I for the year
    capitalExpendituresYearly?: number; // Non-recurring large expenses

    // Cash flow
    preTaxCashFlow: number; // EGI - OpEx - Debt Service - CapEx
    estimatedTaxBenefitOrLiability: number; // From depreciation, interest deductions, etc.
    afterTaxCashFlow: number;

    // Equity & Value
    principalPaydownInYear: number;
    propertyValueAppreciationPercent?: number; // As a decimal
    estimatedPropertyValueEndOfYear: number;
    accumulatedEquity: number;
    loanBalanceEndOfYear: number;
  }>;

  // Key summary metrics over the holding period
  summaryMetrics: {
    initialCapRate: number; // Based on purchase price and year 1 NOI
    averageCashOnCashReturn: number; // Over holding period
    totalReturnOnInvestment?: number; // (Total Cash Flow + Equity Gain) / Total Cash Invested
    projectedIRR: number; // Internal Rate of Return
    averageDSCR?: number; // Debt Service Coverage Ratio
    averageOperatingExpenseRatio?: number;
    paybackPeriodYears?: number;
  };

  // Sensitivity analysis results (optional)
  sensitivityAnalysis?: {
    // Key: scenario description (e.g., "Rent +10%"), Value: new IRR or key metric
    rentVariation?: Record<string, number>;
    vacancyVariation?: Record<string, number>;
    interestRateVariation?: Record<string, number>;
    operatingExpenseVariation?: Record<string, number>;
  };

  assumptions?: {
    holdingPeriodYears: number;
    discountRateForNPV?: number; // For Net Present Value calculations
    exitCapRate?: number; // For estimating sale price at end of holding period
    incomeGrowthRatePercent?: number; // Annual growth
    expenseGrowthRatePercent?: number; // Annual growth
  };
}

// Loan amortization calculations
export interface LoanAmortizationCalculation {
  principal: number;
  annualInterestRate: number; // As a decimal, e.g., 0.05 for 5%
  termMonths: number;
  /** Unix timestamp (seconds) for the first payment date or loan start date. */
  startDate: number;

  // Calculated payment info
  monthlyPayment: number;
  totalInterestPaid: number;
  totalPrincipalAndInterestPaid: number; // Renamed from totalPayments for clarity

  // Amortization schedule
  schedule: Array<{
    paymentNumber: number;
    /** Unix timestamp (seconds) for this payment's due date. */
    paymentDate: number;
    beginningBalance: number;
    scheduledPaymentAmount: number; // Could be different from monthlyPayment if extra payments
    principalPayment: number;
    interestPayment: number;
    endingBalance: number;
    cumulativeInterestPaid: number;
    cumulativePrincipalPaid: number;
  }>;

  // Optional: Scenarios for early payoff
  earlyPayoffScenarios?: Array<{
    extraMonthlyPayment: number;
    newTermMonths: number;
    totalInterestSaved: number;
    /** Unix timestamp (seconds) of the new payoff date. */
    newPayoffDate: number;
  }>;
}

// Break-even analysis for a property
export interface BreakEvenAnalysis {
  propertyId: string; // UUID

  // Fixed costs (per period, e.g., monthly or annually)
  fixedCosts: {
    mortgagePrincipalAndInterest: number;
    propertyInsurance: number;
    propertyTaxes: number;
    hoaFees?: number;
    otherFixed: number; // e.g., ثابت PM fees
    totalFixedCosts: number;
  };

  // Variable costs (often as a percentage of rent or per occupied unit)
  variableCostsPerUnitOrPercentRent?: {
    utilitiesIfLandlordPaid?: number; // Per unit per month
    maintenancePercentOfRent?: number; // As a decimal
    managementPercentOfRent?: number; // As a decimal
    otherVariablePercentOfRent?: number; // As a decimal
  };
  averageVariableCostPerUnit?: number; // If calculated directly

  // Income
  averageRentPerUnit: number;
  numberOfUnits: number;

  // Results
  /** Percentage of units that need to be occupied to cover all costs. */
  breakEvenOccupancyRate: number;
  /** Number of units needed to break even. */
  breakEvenUnitsOccupied: number;
  /** Total rental income needed to break even. */
  breakEvenRentalIncome: number;
  /** Current profit or loss margin. */
  currentOperatingMargin?: number;
  /** Current profit or loss margin as a percentage of potential income. */
  currentOperatingMarginPercentage?: number;
}

// Refinance analysis for an existing loan
export interface RefinanceAnalysis {
  currentLoan: {
    outstandingBalance: number;
    currentAnnualInterestRate: number; // As decimal
    currentMonthlyPayment: number;
    remainingTermMonths: number;
  };

  newLoanOffer: {
    newLoanAmount: number; // Could be > outstandingBalance if cash-out
    newAnnualInterestRate: number; // As decimal
    newLoanTermMonths: number;
    closingCostsAndFees: number;
    newMonthlyPayment: number; // Calculated for the new loan
  };

  analysisSummary: {
    changeInMonthlyPayment: number; // Positive if new payment is lower
    /** Months to recoup closing costs through monthly savings. Null if no savings. */
    breakEvenMonthsToRecoupCosts?: number | null;
    totalInterestSavingsOverNewLoanTerm?: number; // Compared to keeping old loan
    netCashReceivedOrPaidAtClosing: number; // (New Loan Amount - Outstanding Balance - Closing Costs)
    impactOnLoanPayoffDate?: string; // e.g., "Extended by X months", "Shortened by Y months"
    // Consider adding Net Present Value (NPV) of the refinance decision
  };

  recommendation?: 'strongly_recommend' | 'consider' | 'neutral' | 'not_recommended';
  keyReasons?: string[]; // Brief explanations for the recommendation
}

// Comparison of multiple properties
export interface PropertyPortfolioComparison {
  properties: Array<{
    id: string; // UUID
    name: string;
    address?: string;
    metrics: Partial<PropertyOperatingMetrics>; // Key metrics for comparison
    capRate?: number;
    cashOnCashReturn?: number;
    occupancyRate?: number; // Current or average
    purchasePrice?: number;
    currentEstimatedValue?: number;
  }>;

  // Comparative rankings based on selected criteria
  rankings?: {
    byNetOperatingIncome?: string[]; // Array of property IDs, ranked
    byCapRate?: string[];
    byCashOnCashReturn?: string[];
    byOccupancyRate?: string[];
  };

  // Portfolio-level summary metrics
  portfolioSummary?: {
    totalProperties: number;
    totalEstimatedValue?: number;
    aggregateNetOperatingIncome?: number;
    weightedAverageCapRate?: number;
    totalDebt?: number; // If loan data is linked
    totalEquity?: number;
    overallPortfolioDSCR?: number;
  };
}