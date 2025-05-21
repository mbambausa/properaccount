// src/types/accounting.d.ts

/**
 * The broad categories of all accounts.
 * Aligns with DbChartOfAccount['type'] from cloudflare/d1/schema.ts.
 */
// FIXED: Standardizing on 'income' as per your d1/schema.ts
export type AccountSystemType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

/**
 * For expense accounts, indicates whether they are
 * recoverable (and to what extent) or non-recoverable.
 */
export type ExpenseSubtype = 'recoverable' | 'non-recoverable' | 'other';

/**
 * Represents a definition of an account in the Chart of Accounts for application use.
 * This interface aligns with the structure of the 'DbChartOfAccount' interface
 * from cloudflare/d1/schema.ts, converting numerical booleans to actual booleans.
 */
export interface ChartOfAccount {
  /** Unique system-generated identifier (UUID) for this account definition. */
  id: string;
  /**
   * Identifier of the entity this account belongs to.
   * Note: Your DbChartOfAccount has user_id. If this type is for the application-level
   * representation of an account within an entity's COA (linked via DbEntityAccount),
   * then entity_id might be more appropriate here or obtained via join.
   * For now, matching DbChartOfAccount which has user_id.
   * If accounts are per-entity, user_id here might represent the entity owner
   * or it should be entity_id.
   */
  user_id: string; // As per your DbChartOfAccount. If entity-specific, consider entity_id.
  // entity_id: string; // Alternative if this represents an account within an entity's specific COA
  /** User-defined code for the account (e.g., "1010", "6050"). Unique per user/entity. */
  code: string;
  /** Human-readable name for the account (e.g., "Operating Cash Account", "Office Supplies"). */
  name: string;
  /** The fundamental type of the account. */
  type: AccountSystemType; // Uses 'income' now
  /**
   * Further classification, e.g., for expenses indicating recoverability,
   * or more specific types like 'current_asset', 'long_term_liability'.
   */
  subtype?: string | null;
  /** A brief explanation of what the account is used for. */
  description?: string | null;
  /**
   * For expense accounts, explicitly marks if it is recoverable.
   * True if DbChartOfAccount.is_recoverable is 1.
   */
  is_recoverable: boolean;
  /**
   * Percentage (0–10000 basis points) of a recoverable expense that is expected to be reimbursed.
   * This should be converted to/from basis points if interacting with DbChartOfAccount.recovery_percentage.
   * E.g., 75% = 7500.
   */
  recovery_percentage?: number | null; // Application level might be 0-100, DB is basis points.
  /**
   * Whether the account is currently active and can be used in transactions.
   * True if DbChartOfAccount.is_active is 1.
   */
  is_active: boolean;
  /** Optional link to tax form lines or categories. */
  tax_category?: string | null;
  /**
   * The ID (UUID) of the parent account, for hierarchical chart of accounts.
   * Null if it's a top-level account.
   */
  parent_id?: string | null;
  /** Timestamp (Unix seconds) when this account definition was created. */
  created_at: number; // Matches DbChartOfAccount
  /** Timestamp (Unix seconds) when this account definition was last updated. */
  updated_at: number; // Matches DbChartOfAccount
}

/**
 * Input payload when creating or updating a Chart of Account definition.
 * Booleans are expected as booleans. Timestamps are handled by the server.
 * `user_id` would typically come from the authenticated user context.
 */
export interface ChartOfAccountInput {
  // user_id is typically not part of input, derived from session/auth context.
  code: string;
  name: string;
  type: AccountSystemType; // Uses 'income' now
  subtype?: string | null;
  description?: string | null;
  is_recoverable?: boolean; // Defaults to false if not provided in service
  recovery_percentage?: number | null; // Application level (0-100), convert to basis points for DB
  is_active?: boolean;      // Defaults to true if not provided in service
  tax_category?: string | null;
  parent_id?: string | null;
}