// src/lib/accounting/accounting-api.ts
/**
 * Accounting API Interface
 *
 * This module provides interface functions between the accounting core system
 * and the reporting modules. It abstracts the lower-level accounting classes
 * and provides simpler functions for common operations needed by reports.
 */

import { Account } from "./account";
import { Ledger } from "./ledger";
import { Transaction } from "./transaction";
import { newMojoDecimal } from "./financial";
import type { D1Database } from "@cloudflare/workers-types";
import type { AccountBalance } from "../../../types/report";

/**
 * Get account balances for specified account types as of a date
 */
export async function getAccountBalances({
  entityId,
  asOfDate,
  accountTypes,
  db,
}: {
  entityId: string;
  asOfDate: string;
  accountTypes: string[];
  db: D1Database;
}): Promise<AccountBalance[]> {
  // In a real implementation, you would:
  // 1. Query D1 database for accounts of specified types
  // 2. Query transactions up to asOfDate
  // 3. Calculate balance for each account

  // Simulate database query for accounts
  const accounts = await getAccountsByType({
    entityId,
    types: accountTypes,
    db,
  });

  // For each account, return balance information
  return accounts.map((account) => ({
    accountId: account.id,
    accountName: account.name,
    accountType: account.type,
    accountCode: account.code,
    balance: parseFloat(account.balance), // Convert string balance to number
    asOfDate: asOfDate,
  }));
}

/**
 * Get accounts by type from the database
 */
export async function getAccountsByType({
  entityId,
  types,
  db,
}: {
  entityId: string;
  types: string[];
  db: D1Database;
}): Promise<Account[]> {
  // In a real implementation, you would query D1 database for matching accounts

  // For now, create a simulated response based on types
  // This would use db.prepare().bind().all() in real implementation

  // Simulate a database query with a promise
  return new Promise((resolve) => {
    // Simulate fetching accounts from database
    const accounts: Account[] = [];

    // Create some sample accounts for each requested type
    types.forEach((type, index) => {
      // Create accounts of the requested type
      const typeAccounts = [
        new Account({
          id: `${type.toLowerCase()}_1_${entityId}`,
          code: `${type.substring(0, 3)}001`,
          name: `${type} Account 1`,
          type: type as any, // Cast as any since we can't validate all possible types here
          isActive: true,
          normalBalance: ["ASSET", "EXPENSE"].includes(type)
            ? "debit"
            : "credit",
        }),
        new Account({
          id: `${type.toLowerCase()}_2_${entityId}`,
          code: `${type.substring(0, 3)}002`,
          name: `${type} Account 2`,
          type: type as any,
          isActive: true,
          normalBalance: ["ASSET", "EXPENSE"].includes(type)
            ? "debit"
            : "credit",
        }),
      ];

      // Add sample balances
      typeAccounts[0].setBalance(10000 + index * 1000);
      typeAccounts[1].setBalance(5000 + index * 500);

      accounts.push(...typeAccounts);
    });

    resolve(accounts);
  });
}

/**
 * Get transaction totals aggregated by account for a time period
 */
export async function getTransactionTotals({
  entityId,
  startDate,
  endDate,
  accountTypes,
  db,
}: {
  entityId: string;
  startDate: string;
  endDate: string;
  accountTypes: string[];
  db: D1Database;
}): Promise<
  Array<{
    accountId: string;
    count: number;
    total: number;
    type: string;
  }>
> {
  // In a real implementation, you would:
  // 1. Query D1 database for transactions in the date range for relevant accounts
  // 2. Aggregate transaction totals by account

  // Simulate database query
  // This would be a complex query with GROUP BY in real implementation
  const accounts = await getAccountsByType({
    entityId,
    types: accountTypes,
    db,
  });

  // Simulate transaction totals
  return accounts.map((account) => {
    // Generate simulated transaction data
    const transactionCount = Math.floor(Math.random() * 20) + 5;
    const totalAmount = parseFloat(account.balance) * 0.8 * Math.random();

    return {
      accountId: account.id,
      count: transactionCount,
      total: totalAmount,
      type: account.type,
    };
  });
}

/**
 * Get changes in account balances between two dates
 */
export async function getChangeInAccountBalances({
  entityId,
  startDate,
  endDate,
  accountTypes,
  db,
}: {
  entityId: string;
  startDate: string;
  endDate: string;
  accountTypes: string[];
  db: D1Database;
}): Promise<
  Array<{
    accountId: string;
    startingBalance: number;
    endingBalance: number;
    netChange: number;
  }>
> {
  // In real implementation, would:
  // 1. Get balances as of startDate
  // 2. Get balances as of endDate
  // 3. Calculate changes

  const accounts = await getAccountsByType({
    entityId,
    types: accountTypes,
    db,
  });

  // Simulate balance changes
  return accounts.map((account) => {
    const currentBalance = parseFloat(account.balance);
    // Create a simulated starting balance between 70-90% of current balance
    const startingBalanceFactor = 0.7 + Math.random() * 0.2;
    const startingBalance = currentBalance * startingBalanceFactor;

    return {
      accountId: account.id,
      startingBalance,
      endingBalance: currentBalance,
      netChange: currentBalance - startingBalance,
    };
  });
}

/**
 * Retrieve account by ID from the database
 */
export async function getAccountById(
  entityId: string,
  accountId: string,
  db: D1Database
): Promise<Account | null> {
  // In real implementation, would query D1 database

  // For simulation, return a mock account if ID pattern matches expected
  if (accountId.includes(entityId)) {
    // Extract account type and number from accountId format
    const parts = accountId.split("_");
    if (parts.length >= 2) {
      const type = parts[0].toUpperCase();
      const num = parts[1];

      return new Account({
        id: accountId,
        code: `${type.substring(0, 3)}${num.padStart(3, "0")}`,
        name: `${type} Account ${num}`,
        type: type as any,
        isActive: true,
        normalBalance: ["ASSET", "EXPENSE"].includes(type) ? "debit" : "credit",
      });
    }
  }

  return null;
}

/**
 * Get ledger instance for an entity
 */
export function getLedgerForEntity(entityId: string): Ledger {
  // In real implementation, would initialize a ledger from database
  // or retrieve from cache
  return new Ledger(entityId);
}

/**
 * Initialize a report-ready accounting environment
 * This could be used to set up the initial state for report generation
 */
export async function initializeReportingEnvironment(
  entityId: string,
  db: D1Database
): Promise<{
  ledger: Ledger;
  accounts: Account[];
}> {
  const ledger = getLedgerForEntity(entityId);

  // Get all accounts for the entity
  const accounts = await getAccountsByType({
    entityId,
    types: ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE", "REVENUE"],
    db,
  });

  // Add accounts to ledger
  accounts.forEach((account) => {
    // Only add if not already in ledger
    if (!ledger.getAccount(account.id)) {
      ledger.addAccount(account);
    }
  });

  return {
    ledger,
    accounts,
  };
}
