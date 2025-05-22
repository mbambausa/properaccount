// cloudflare/d1/schema.ts

/**
 * TypeScript interfaces mirroring the D1 database schema.
 * These should EXACTLY match the column names and basic data types from your SQL migrations.
 * - Timestamps are stored as Unix epoch seconds (number).
 * - Booleans are stored as INTEGER (0 for false, 1 for true), reflected as `number` here.
 * - Monetary amounts (e.g., transaction line amounts) are stored as INTEGER in cents.
 * - Percentages (e.g., recovery_percentage) are stored as INTEGER in basis points (e.g., 100.00% = 10000).
 */

export interface DbUser { // Corresponds to 'users' table
  id: string;
  email: string;
  name?: string | null;
  password_hash?: string | null; // SQL 'password_hash TEXT' is nullable
  role: string; // SQL 'role TEXT NOT NULL DEFAULT 'user''
  created_at: number;
  updated_at: number;
  verified_at?: number | null; // SQL 'verified_at INTEGER' is nullable
  image_url?: string | null; // SQL 'image_url TEXT' is nullable
}

export interface DbAuthAccount { // Corresponds to `auth_accounts` table
  provider_id: string;
  provider_user_id: string;
  user_id: string;
  created_at: number;
  updated_at: number;
}

export interface DbSession { // Corresponds to `sessions` table
  id: string;
  user_id: string;
  created_at: number;
  expires_at: number;
  data?: string | null;
}

export interface DbVerificationToken { // Corresponds to `verification_tokens` table
  identifier: string;
  token: string;
  expires_at: number;
  created_at: number;
  type: string; // Added to match SQL migration
}

export interface DbActivityLog { // Corresponds to `activity_logs` table
  id: number; // SQL `id INTEGER PRIMARY KEY AUTOINCREMENT`
  user_id?: string | null;
  action: string;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: string | null; // JSON string
  created_at: number;
}

// Placeholder for a table that would store password reset tokens if distinct from verification_tokens
// Your current auth.ts uses verification_tokens with a 'type' field for this.
/*
export interface DbPasswordResetToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  created_at: number;
  is_used: number; // 0 or 1
}
*/

// Application-specific Db interfaces (assuming these match their respective migrations)
export interface DbEntity {
  id: string;
  user_id: string; // This is likely the 'creator_user_id' or similar contextually.
  name: string;
  legal_name?: string | null;
  ein?: string | null; // Or tax_id depending on final DB column name
  address?: string | null;
  legal_address?: string | null;
  business_type?: string | null;
  parent_id?: string | null;
  is_active: number; // 0 or 1
  allows_sub_entities: number; // 0 or 1
  created_at: number;
  updated_at: number;
}

export type AccountSystemTypeDb = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface DbChartOfAccount {
  id: string;
  user_id: string; // User who owns this CoA template/definition
  code: string;
  name: string;
  type: AccountSystemTypeDb;
  subtype?: string | null;
  description?: string | null;
  is_recoverable: number; // 0 or 1
  recovery_percentage?: number | null; // Basis points
  is_active: number; // 0 or 1
  tax_category?: string | null;
  parent_id?: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbEntityAccount {
  id: string;
  user_id: string; // User context, likely owner of the entity
  entity_id: string;
  account_id: string;
  custom_name?: string | null;
  is_active: number; // 0 or 1
  recovery_type?: string | null;
  recovery_percentage?: number | null; // Basis points
  created_at: number;
  updated_at: number;
}

export interface DbJournal {
  id: string;
  user_id: string;
  entity_id: string;
  name: string;
  description?: string | null;
  created_at: number;
  updated_at: number;
}

export type TransactionStatusTypeDb = 'pending' | 'posted' | 'voided';

export interface DbTransaction {
  id: string;
  user_id: string;
  entity_id: string;
  journal_id?: string | null;
  date: number;
  description: string;
  reference?: string | null;
  status: TransactionStatusTypeDb;
  is_reconciled: number; // 0 or 1
  document_url?: string | null;
  // New fields if added based on src/types/transaction.d.ts
  // transaction_type?: string;
  // related_entity_id?: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbTransactionLine {
  id: string;
  transaction_id: string;
  entity_account_id: string;
  amount: number; // Cents
  is_debit: number; // 0 or 1
  memo?: string | null;
  created_at: number;
  // New fields if added based on src/types/transaction.d.ts
  // tax_code?: string | null;
  // metadata?: string | null; // JSON string
}