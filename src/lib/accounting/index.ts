// src/lib/accounting/index.ts
/**
 * Accounting Module Index
 * 
 * This module exports the unified accounting API and core accounting classes.
 */

// Export the accounting API for external modules
export * from './accounting-api';

// Export core accounting classes for direct use when needed
export { Account } from './account';
export { Ledger } from './ledger';
export { Transaction } from './transaction';
export { newMojoDecimal, type MojoDecimal } from './financial';

// Export accounting types from our types module
// You might want to add appropriate type exports from your accounting.d.ts file here