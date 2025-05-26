// src/types/calculations.d.ts
/**
 * Real estate financial calculations and metrics
 */

// Property valuation metrics
export interface CapitalizationRate {
  netOperatingIncome: number;
  propertyValue: number;
  rate: number; // NOI / Property Value
}

export interface CashOnCashReturn {
  annualPreTaxCashFlow: number;
  totalCashInvested: number;
  rate: number; // Annual Cash Flow / Total Cash Invested
}

export interface GrossRentMultiplier {
  propertyPrice: number;
  annualGrossRentalIncome: number;
  multiplier: number; // Price / Annual Gross Rent
}

export interface DebtServiceCoverageRatio {
  netOperatingIncome: number;
  totalDebtService: number;
  ratio: number; // NOI / Total Debt Service
}

export interface InternalRateOfReturn {
  initialInvestment: number;
  cashFlows: Array<{
    year: number;
    amount: number;
  }>;
  holdingPeriod: number;
  terminalValue: number;
  irr: number; // percentage
}

// Operating metrics
export interface PropertyOperatingMetrics {
  propertyId: string;
  period: { start: number; end: number };
  
  // Income metrics
  grossPotentialRent: number;
  vacancy: number;
  effectiveGrossIncome: number;
  otherIncome: number;
  totalIncome: number;
  
  // Expense metrics
  operatingExpenses: number;
  capitalExpenses: number;
  totalExpenses: number;
  
  // Key ratios
  netOperatingIncome: number;
  operatingExpenseRatio: number; // OpEx / Effective Gross Income
  breakEvenRatio: number; // (OpEx + Debt Service) / Gross Potential Rent
  
  // Per unit metrics (if multi-unit)
  incomePerUnit?: number;
  expensePerUnit?: number;
  noiPerUnit?: number;
}

// Rent analysis
export interface RentComparable {
  address: string;
  distance: number; // miles from subject property
  propertyType: string;
  yearBuilt: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  amenities: string[];
  
  // Rent data
  monthlyRent: number;
  rentPerSqFt: number;
  lastLeaseDate: number;
  
  // Adjustments
  adjustments: Array<{
    factor: string;
    adjustment: number; // positive or negative
    reason: string;
  }>;
  adjustedRent: number;
  
  // Source
  source: 'mls' | 'rental_site' | 'property_manager' | 'public_record';
  confidence: 'high' | 'medium' | 'low';
}

export interface RentAnalysis {
  subjectProperty: {
    propertyId: string;
    address: string;
    currentRent?: number;
  };
  comparables: RentComparable[];
  
  // Analysis results
  suggestedRentRange: {
    low: number;
    high: number;
    recommended: number;
  };
  averageRentPerSqFt: number;
  medianRent: number;
  confidenceScore: number;
  
  // Market factors
  marketTrend: 'increasing' | 'stable' | 'decreasing';
  seasonalAdjustment?: number;
  
  analysisDate: number;
  validUntil: number;
}

// Investment analysis
export interface PropertyInvestmentAnalysis {
  property: {
    id: string;
    address: string;
    purchasePrice: number;
    closingCosts: number;
    renovationCosts?: number;
  };
  
  financing: {
    downPayment: number;
    loanAmount: number;
    interestRate: number;
    loanTerm: number; // years
    monthlyPayment: number;
  };
  
  projections: Array<{
    year: number;
    
    // Income
    grossRentalIncome: number;
    otherIncome: number;
    vacancyLoss: number;
    effectiveGrossIncome: number;
    
    // Expenses
    operatingExpenses: number;
    debtService: number;
    capitalExpenses: number;
    
    // Cash flow
    beforeTaxCashFlow: number;
    taxableIncome: number;
    taxLiability: number;
    afterTaxCashFlow: number;
    
    // Equity
    principalPaydown: number;
    appreciation: number;
    totalEquity: number;
  }>;
  
  // Key metrics
  metrics: {
    capRate: number;
    cashOnCashReturn: number;
    totalROI: number;
    irr: number;
    dscr: number;
    breakEvenRatio: number;
  };
  
  // Sensitivity analysis
  sensitivity?: {
    rentIncrease: Record<string, number>; // % change -> new metric
    vacancyRate: Record<string, number>;
    interestRate: Record<string, number>;
    expenseIncrease: Record<string, number>;
  };
}

// Loan calculations
export interface LoanAmortizationCalculation {
  principal: number;
  interestRate: number;
  termMonths: number;
  startDate: number;
  
  // Payment info
  monthlyPayment: number;
  totalInterest: number;
  totalPayments: number;
  
  // Schedule
  schedule: Array<{
    paymentNumber: number;
    paymentDate: number;
    beginningBalance: number;
    scheduledPayment: number;
    principalPayment: number;
    interestPayment: number;
    endingBalance: number;
    cumulativeInterest: number;
    cumulativePrincipal: number;
  }>;
  
  // Early payoff scenarios
  earlyPayoffScenarios?: Array<{
    extraMonthlyPayment: number;
    newTermMonths: number;
    interestSaved: number;
  }>;
}

// Break-even analysis
export interface BreakEvenAnalysis {
  propertyId: string;
  
  // Fixed costs
  fixedCosts: {
    mortgage: number;
    insurance: number;
    propertyTax: number;
    hoa?: number;
    other: number;
    total: number;
  };
  
  // Variable costs
  variableCosts: {
    utilities?: number;
    maintenance: number;
    management?: number;
    other: number;
    total: number;
  };
  
  // Income
  rentalIncome: number;
  otherIncome?: number;
  
  // Results
  breakEvenOccupancy: number; // percentage
  breakEvenRent: number; // per unit if multi-unit
  currentMargin: number;
  marginPercentage: number;
}

// Refinance analysis
export interface RefinanceAnalysis {
  currentLoan: {
    balance: number;
    interestRate: number;
    monthlyPayment: number;
    remainingTermMonths: number;
  };
  
  newLoan: {
    amount: number;
    interestRate: number;
    termMonths: number;
    closingCosts: number;
    monthlyPayment: number;
  };
  
  analysis: {
    monthlySavings: number;
    breakEvenMonths: number;
    lifetimeSavings: number;
    cashOut?: number;
    
    // NPV analysis
    npvOfSavings: number;
    effectiveInterestRate: number;
  };
  
  recommendation: 'strongly_recommend' | 'recommend' | 'neutral' | 'not_recommend';
  reasons: string[];
}

// Property comparison
export interface PropertyComparison {
  properties: Array<{
    id: string;
    name: string;
    metrics: PropertyOperatingMetrics;
    capRate: number;
    cashOnCashReturn: number;
    occupancyRate: number;
  }>;
  
  rankings: {
    byNOI: string[];
    byCapRate: string[];
    byCashFlow: string[];
    byOccupancy: string[];
  };
  
  portfolio: {
    totalValue: number;
    totalNOI: number;
    averageCapRate: number;
    totalDebt: number;
    totalEquity: number;
    portfolioDSCR: number;
  };
}