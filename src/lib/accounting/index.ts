// src/lib/accounting/index.ts
/**
 * Accounting Module Index
 *
 * This module exports the unified accounting API and core accounting classes.
 */

// Export the accounting API for external modules
export * from "./core/accounting-api";

// Export core accounting classes for direct use when needed
export { Account } from "./core/account";
export { Ledger } from "./core/ledger";
export { Transaction } from "./core/transaction";
export { newMojoDecimal, type MojoDecimal } from "./core/financial";

// Export accounting types from our types module
// You might want to add appropriate type exports from your accounting.d.ts file here
