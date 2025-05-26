// src/lib/factories/transaction.factory.ts
/**
 * Factory functions for creating common transaction types
 */

import type {
  TransactionInput,
  TransactionLineInput,
  LeaseDto,
  PropertyDto,
  WorkOrderDto,
  LoanScheduleEntry
} from '@/types';
import { REAL_ESTATE_ACCOUNT_CODES } from '@/types/accounting';

// Helper to create a basic transaction line
function createLine(
  accountId: string,
  amount: number,
  isDebit: boolean,
  memo?: string,
  propertyId?: string
): TransactionLineInput {
  return {
    entity_account_id: accountId,
    amount,
    is_debit: isDebit,
    memo: memo || null,
    tax_code: null,
    metadata: null,
    property_id: propertyId || null
  };
}

// Rent collection
export function createRentPayment(
  lease: LeaseDto,
  cashAccountId: string,
  rentalIncomeAccountId: string,
  amount: number,
  paymentDate: number,
  paymentMethod: string = 'check'
): TransactionInput {
  return {
    entity_id: lease.propertyId,
    date: paymentDate,
    description: `Rent payment - Unit ${lease.unitId}`,
    transaction_type: 'rent_income',
    related_entity_id: lease.tenantId,
    reference: `RENT-${lease.id}-${new Date(paymentDate * 1000).toISOString().slice(0, 7)}`,
    lines: [
      createLine(cashAccountId, amount, true, `Rent from tenant ${lease.tenantId}`, lease.propertyId),
      createLine(rentalIncomeAccountId, amount, false, `Monthly rent`, lease.propertyId)
    ]
  };
}

// Late fee
export function createLateFee(
  lease: LeaseDto,
  cashAccountId: string,
  lateFeeAccountId: string,
  amount: number,
  feeDate: number
): TransactionInput {
  return {
    entity_id: lease.propertyId,
    date: feeDate,
    description: `Late fee - Unit ${lease.unitId}`,
    transaction_type: 'rent_income',
    related_entity_id: lease.tenantId,
    lines: [
      createLine(cashAccountId, amount, true, `Late fee`, lease.propertyId),
      createLine(lateFeeAccountId, amount, false, `Late fee income`, lease.propertyId)
    ]
  };
}

// Security deposit collection
export function createSecurityDepositCollection(
  lease: LeaseDto,
  cashAccountId: string,
  depositLiabilityAccountId: string,
  amount: number,
  collectionDate: number
): TransactionInput {
  return {
    entity_id: lease.propertyId,
    date: collectionDate,
    description: `Security deposit - Unit ${lease.unitId}`,
    transaction_type: 'security_deposit',
    related_entity_id: lease.tenantId,
    lines: [
      createLine(cashAccountId, amount, true, `Security deposit received`, lease.propertyId),
      createLine(depositLiabilityAccountId, amount, false, `Security deposit liability`, lease.propertyId)
    ]
  };
}

// Security deposit return
export function createSecurityDepositReturn(
  lease: LeaseDto,
  cashAccountId: string,
  depositLiabilityAccountId: string,
  returnAmount: number,
  deductions: Array<{ description: string; amount: number; expenseAccountId: string }>,
  returnDate: number
): TransactionInput {
  const lines: TransactionLineInput[] = [];
  const totalDeposit = returnAmount + deductions.reduce((sum, d) => sum + d.amount, 0);
  
  // Reverse the liability
  lines.push(createLine(
    depositLiabilityAccountId, 
    totalDeposit, 
    true, 
    `Security deposit return`, 
    lease.propertyId
  ));
  
  // Cash payment for return amount
  if (returnAmount > 0) {
    lines.push(createLine(
      cashAccountId, 
      returnAmount, 
      false, 
      `Deposit refund to tenant`, 
      lease.propertyId
    ));
  }
  
  // Expense entries for deductions
  deductions.forEach(deduction => {
    lines.push(createLine(
      deduction.expenseAccountId,
      deduction.amount,
      true,
      deduction.description,
      lease.propertyId
    ));
  });
  
  return {
    entity_id: lease.propertyId,
    date: returnDate,
    description: `Security deposit return - Unit ${lease.unitId}`,
    transaction_type: 'security_deposit_return',
    related_entity_id: lease.tenantId,
    lines
  };
}

// Maintenance expense
export function createMaintenanceExpense(
  workOrder: WorkOrderDto,
  cashAccountId: string,
  maintenanceExpenseAccountId: string,
  amount: number,
  paymentDate: number,
  vendorId?: string
): TransactionInput {
  return {
    entity_id: workOrder.propertyId,
    date: paymentDate,
    description: `Maintenance: ${workOrder.description}`,
    transaction_type: 'maintenance',
    related_entity_id: vendorId || workOrder.assignedTo || undefined,
    reference: `WO-${workOrder.id}`,
    lines: [
      createLine(
        maintenanceExpenseAccountId, 
        amount, 
        true, 
        workOrder.description, 
        workOrder.propertyId
      ),
      createLine(
        cashAccountId, 
        amount, 
        false, 
        `Payment for work order ${workOrder.id}`, 
        workOrder.propertyId
      )
    ]
  };
}

// Property tax payment
export function createPropertyTaxPayment(
  property: PropertyDto,
  cashAccountId: string,
  propertyTaxAccountId: string,
  amount: number,
  paymentDate: number,
  taxPeriod: string
): TransactionInput {
  return {
    entity_id: property.entityId,
    date: paymentDate,
    description: `Property tax - ${property.address} - ${taxPeriod}`,
    transaction_type: 'property_tax',
    reference: `TAX-${taxPeriod}`,
    lines: [
      createLine(propertyTaxAccountId, amount, true, `Property tax ${taxPeriod}`, property.id),
      createLine(cashAccountId, amount, false, `Property tax payment`, property.id)
    ]
  };
}

// Insurance payment
export function createInsurancePayment(
  property: PropertyDto,
  cashAccountId: string,
  insuranceExpenseAccountId: string,
  amount: number,
  paymentDate: number,
  policyPeriod: string
): TransactionInput {
  return {
    entity_id: property.entityId,
    date: paymentDate,
    description: `Insurance premium - ${property.address} - ${policyPeriod}`,
    transaction_type: 'insurance',
    reference: `INS-${policyPeriod}`,
    lines: [
      createLine(insuranceExpenseAccountId, amount, true, `Insurance ${policyPeriod}`, property.id),
      createLine(cashAccountId, amount, false, `Insurance payment`, property.id)
    ]
  };
}

// Mortgage payment
export function createMortgagePayment(
  property: PropertyDto,
  cashAccountId: string,
  mortgageLiabilityAccountId: string,
  interestExpenseAccountId: string,
  principalAmount: number,
  interestAmount: number,
  paymentDate: number,
  loanId?: string
): TransactionInput {
  const totalPayment = principalAmount + interestAmount;
  
  return {
    entity_id: property.entityId,
    date: paymentDate,
    description: `Mortgage payment - ${property.address}`,
    transaction_type: 'loan_payment',
    reference: loanId,
    lines: [
      createLine(mortgageLiabilityAccountId, principalAmount, true, `Principal payment`, property.id),
      createLine(interestExpenseAccountId, interestAmount, true, `Interest payment`, property.id),
      createLine(cashAccountId, totalPayment, false, `Mortgage payment`, property.id)
    ]
  };
}

// Property management fee
export function createManagementFee(
  property: PropertyDto,
  cashAccountId: string,
  managementFeeAccountId: string,
  amount: number,
  feeDate: number,
  managementCompanyId?: string
): TransactionInput {
  return {
    entity_id: property.entityId,
    date: feeDate,
    description: `Property management fee - ${property.address}`,
    transaction_type: 'property_management_fee',
    related_entity_id: managementCompanyId,
    lines: [
      createLine(managementFeeAccountId, amount, true, `Management fee`, property.id),
      createLine(cashAccountId, amount, false, `Payment to management company`, property.id)
    ]
  };
}

// Utility payment
export function createUtilityPayment(
  property: PropertyDto,
  cashAccountId: string,
  utilityExpenseAccountId: string,
  amount: number,
  paymentDate: number,
  utilityType: string,
  utilityProviderId?: string
): TransactionInput {
  return {
    entity_id: property.entityId,
    date: paymentDate,
    description: `${utilityType} - ${property.address}`,
    transaction_type: 'utility_payment',
    related_entity_id: utilityProviderId,
    lines: [
      createLine(utilityExpenseAccountId, amount, true, utilityType, property.id),
      createLine(cashAccountId, amount, false, `${utilityType} payment`, property.id)
    ]
  };
}

// Capital improvement
export function createCapitalImprovement(
  property: PropertyDto,
  cashAccountId: string,
  improvementAssetAccountId: string,
  amount: number,
  paymentDate: number,
  description: string,
  vendorId?: string
): TransactionInput {
  return {
    entity_id: property.entityId,
    date: paymentDate,
    description: `Capital improvement: ${description} - ${property.address}`,
    transaction_type: 'capital_improvement',
    related_entity_id: vendorId,
    lines: [
      createLine(improvementAssetAccountId, amount, true, description, property.id),
      createLine(cashAccountId, amount, false, `Payment for ${description}`, property.id)
    ]
  };
}

// Property purchase closing
export function createPropertyPurchase(
  property: PropertyDto,
  entityId: string,
  purchasePrice: number,
  closingCosts: Record<string, { amount: number; accountId: string }>,
  downPayment: number,
  loanAmount: number,
  cashAccountId: string,
  propertyAssetAccountId: string,
  mortgageLiabilityAccountId: string,
  closingDate: number
): TransactionInput {
  const lines: TransactionLineInput[] = [];
  
  // Property asset
  lines.push(createLine(
    propertyAssetAccountId,
    purchasePrice,
    true,
    'Property purchase',
    property.id
  ));
  
  // Closing costs
  Object.entries(closingCosts).forEach(([description, cost]) => {
    lines.push(createLine(
      cost.accountId,
      cost.amount,
      true,
      description,
      property.id
    ));
  });
  
  // Financing
  if (loanAmount > 0) {
    lines.push(createLine(
      mortgageLiabilityAccountId,
      loanAmount,
      false,
      'Mortgage loan',
      property.id
    ));
  }
  
  // Cash payment
  const totalCash = downPayment + Object.values(closingCosts).reduce((sum, cost) => sum + cost.amount, 0);
  lines.push(createLine(
    cashAccountId,
    totalCash,
    false,
    'Down payment and closing costs',
    property.id
  ));
  
  return {
    entity_id: entityId,
    date: closingDate,
    description: `Property purchase - ${property.address}`,
    transaction_type: 'closing_cost',
    lines
  };
}

// Monthly depreciation
export function createDepreciationEntry(
  property: PropertyDto,
  buildingAssetAccountId: string,
  accumulatedDepreciationAccountId: string,
  depreciationExpenseAccountId: string,
  amount: number,
  depreciationDate: number
): TransactionInput {
  return {
    entity_id: property.entityId,
    date: depreciationDate,
    description: `Monthly depreciation - ${property.address}`,
    transaction_type: 'depreciation',
    lines: [
      createLine(depreciationExpenseAccountId, amount, true, 'Depreciation expense', property.id),
      createLine(accumulatedDepreciationAccountId, amount, false, 'Accumulated depreciation', property.id)
    ]
  };
}

// Commission payment
export function createCommissionPayment(
  property: PropertyDto,
  cashAccountId: string,
  commissionExpenseAccountId: string,
  amount: number,
  paymentDate: number,
  agentId: string,
  description: string
): TransactionInput {
  return {
    entity_id: property.entityId,
    date: paymentDate,
    description: `Commission: ${description}`,
    transaction_type: 'commission',
    related_entity_id: agentId,
    lines: [
      createLine(commissionExpenseAccountId, amount, true, description, property.id),
      createLine(cashAccountId, amount, false, 'Commission payment', property.id)
    ]
  };
}

// Loan payment from schedule
export function createLoanPaymentFromSchedule(
  scheduleEntry: LoanScheduleEntry,
  entityId: string,
  cashAccountId: string,
  principalAccountId: string,
  interestAccountId: string,
  propertyId?: string
): TransactionInput {
  return {
    entity_id: entityId,
    date: scheduleEntry.payment_date,
    description: `Loan payment #${scheduleEntry.payment_number}`,
    transaction_type: 'loan_payment',
    reference: scheduleEntry.loan_id,
    lines: [
      createLine(principalAccountId, scheduleEntry.principal_portion, true, 'Principal payment', propertyId),
      createLine(interestAccountId, scheduleEntry.interest_portion, true, 'Interest payment', propertyId),
      createLine(cashAccountId, scheduleEntry.total_payment, false, 'Loan payment', propertyId)
    ]
  };
}