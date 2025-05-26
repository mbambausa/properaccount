// src/lib/accounting/accountMapping.ts

import type { ChartOfAccount } from "../../../types/accounting";

/**
 * Maps common transaction categories to account IDs based on Chart of Accounts
 */
export interface AccountMappingConfig {
  bankFees: string; // Account ID for bank fees
  interestIncome: string; // Account ID for interest income
  propertyTax: string; // Account ID for property tax
  mortgageInterest: string; // Account ID for mortgage interest
  insurance: string; // Account ID for insurance expense
  rentalIncome: string; // Account ID for rental income
  utilities: string; // Account ID for utilities
  repairs: string; // Account ID for repairs & maintenance
  officeSupplies: string; // Account ID for office supplies
  // Add other common categories as needed
}

/**
 * Service to map rule categories to actual account IDs
 */
export class AccountMappingService {
  private accountsById: Map<string, ChartOfAccount> = new Map();
  private accountsByCode: Map<string, ChartOfAccount> = new Map();
  private mappingConfig: AccountMappingConfig;

  /**
   * Initialize with accounts and mapping configuration
   */
  constructor(accounts: ChartOfAccount[], mappingConfig: AccountMappingConfig) {
    // Index accounts for quick lookup
    accounts.forEach((account) => {
      this.accountsById.set(account.id, account);
      this.accountsByCode.set(account.code, account);
    });

    this.mappingConfig = mappingConfig;

    // Validate that all mapped accounts exist
    this.validateMappingConfig();
  }

  /**
   * Verify all account IDs in the mapping config exist
   */
  private validateMappingConfig(): void {
    const missingAccounts: string[] = [];

    Object.entries(this.mappingConfig).forEach(([category, accountId]) => {
      if (!this.accountsById.has(accountId)) {
        missingAccounts.push(`${category}: ${accountId}`);
      }
    });

    if (missingAccounts.length > 0) {
      console.warn(
        `AccountMappingService: The following mapped accounts do not exist in the Chart of Accounts: ${missingAccounts.join(", ")}`
      );
    }
  }

  /**
   * Get account ID for a category from the mapping config
   */
  getCategoryAccountId(category: keyof AccountMappingConfig): string | null {
    const accountId = this.mappingConfig[category];
    if (!accountId || !this.accountsById.has(accountId)) {
      console.warn(
        `AccountMappingService: No valid account mapped for category "${String(category)}"`
      );
      return null;
    }
    return accountId;
  }

  /**
   * Get account by ID
   */
  getAccountById(id: string): ChartOfAccount | null {
    return this.accountsById.get(id) || null;
  }

  /**
   * Get account by code
   */
  getAccountByCode(code: string): ChartOfAccount | null {
    return this.accountsByCode.get(code) || null;
  }

  /**
   * Check if an account exists by ID
   */
  accountExists(id: string): boolean {
    return this.accountsById.has(id);
  }
}
