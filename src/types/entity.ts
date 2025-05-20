// src/types/entity.ts

/**
 * Standard business entity types
 */
export type BusinessType = 
  | 'sole_proprietorship'
  | 'partnership'
  | 'llc'
  | 'c_corporation'
  | 's_corporation'
  | 'non_profit'
  | 'trust'
  | 'other';

/**
 * Represents a property or business entity owned by a user.
 * Mirrors the `entities` table, converting integer flags to booleans.
 */
export interface Entity {
  /** Unique identifier (UUID) for this entity */
  readonly id: string;
  /** ID of the user who owns this entity */
  readonly user_id: string;
  /** Display name of the entity */
  name: string;
  /** Legal/formal name as registered with authorities */
  legal_name?: string | null;
  /** Employer Identification Number or Tax ID (stored securely) */
  ein?: string | null;
  /** Primary business address */
  address?: string | null;
  /** Registered legal address (if different from primary) */
  legal_address?: string | null;
  /** Type of business structure */
  business_type?: BusinessType | null;
  /** ID of parent entity (for hierarchical structures) */
  parent_id?: string | null;
  /** Whether this entity is currently active */
  is_active: boolean;
  /** Whether this entity can have child entities */
  allows_sub_entities: boolean;
  /** Timestamp (Unix seconds) when this entity was created */
  readonly created_at: number;
  /** Timestamp (Unix seconds) when this entity was last updated */
  updated_at: number;
  /** Optional path string for hierarchical navigation (e.g., "parent/child") */
  readonly path?: string | null;
}

/**
 * Payload for creating/updating an Entity.
 * Excludes auto-generated fields (`id`, `user_id`, timestamps).
 */
export interface EntityInput {
  /** Display name of the entity (required, max 100 chars) */
  name: string;
  /** Legal/formal name as registered with authorities */
  legal_name?: string | null;
  /** Employer Identification Number or Tax ID */
  ein?: string | null;
  /** Primary business address */
  address?: string | null;
  /** Registered legal address (if different from primary) */
  legal_address?: string | null;
  /** Type of business structure */
  business_type?: BusinessType | null;
  /** ID of parent entity (for hierarchical structures) */
  parent_id?: string | null;
  /** Whether this entity is currently active (defaults to true) */
  is_active?: boolean;
  /** Whether this entity can have child entities (defaults to false) */
  allows_sub_entities?: boolean;
}

/**
 * Query parameters for filtering entities
 */
export interface EntityQueryParams {
  /** Only return active entities when true */
  active_only?: boolean;
  /** Only return entities that can have sub-entities when true */
  parent_only?: boolean;
  /** Only return entities that are children of the specified parent ID */
  parent_id?: string;
  /** Only return entities of the specified business type */
  business_type?: BusinessType;
  /** Search term to filter entities by name */
  search?: string;
}

/**
 * Hierarchical representation of entities with their children
 */
export interface EntityWithChildren extends Entity {
  /** Child entities that belong to this parent */
  children?: EntityWithChildren[];
  /** Depth in the entity hierarchy */
  depth?: number;
}