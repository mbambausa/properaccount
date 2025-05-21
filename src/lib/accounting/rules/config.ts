// src/lib/rules/config.ts

import type { AccountMappingConfig } from '../../accounting/accountMapping';

/**
 * Default account mapping configuration
 * These should be updated to match your actual chart of accounts
 */
export const defaultAccountMapping: AccountMappingConfig = {
  bankFees: '5110',        // Bank Service Charges
  interestIncome: '4510',  // Interest Income
  propertyTax: '5050',     // Property Taxes
  mortgageInterest: '5810', // Mortgage Interest Expense
  insurance: '5040',       // Property Insurance
  rentalIncome: '4010',    // Rental Income
  utilities: '5031',       // Utilities (Recoverable)
  repairs: '5020',         // Repairs and Maintenance
  officeSupplies: '5120',  // Office Supplies & Software
};

/**
 * Load account mapping config from storage or settings
 */
export async function loadAccountMappingConfig(): Promise<AccountMappingConfig> {
  // In a real implementation, you would:
  // 1. Check if there's a custom mapping stored in user preferences/settings
  // 2. Fall back to the default mapping if no custom mapping exists
  
  // For now, just return the default mapping
  return { ...defaultAccountMapping };
}