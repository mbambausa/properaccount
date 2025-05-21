// src/types/entity.d.ts

/**
 * Standard entity types, aligning with Zod schema in Technical Reference Guide.
 */
export type EntityType = 'individual' | 'company' | 'trust' | 'partnership';

/**
 * More detailed business structure types, can be used in a separate classification field if needed.
 */
export type DetailedBusinessType =
  | 'sole_proprietorship'
  | 'partnership' // Also in EntityType
  | 'llc_single_member'
  | 'llc_multi_member'
  | 's_corporation'
  | 'c_corporation'
  | 'non_profit'
  | 'trust' // Also in EntityType
  | 'estate'
  | 'other';

/**
 * Represents a property or business entity.
 * This should align closely with the 'entities' D1 table and Zod schema.
 */
export interface Entity {
  /** Unique identifier (UUID) for this entity */
  readonly id: string;

  /** Display name of the entity (required, max 100 chars) */
  name: string;

  /**
   * Primary classification of the entity.
   * Aligns with `type` in D1 schema and Zod schema (Tech Ref, p. 39).
   */
  type: EntityType;

  /** Optional detailed description of the entity or its purpose. */
  description?: string | null;

  /**
   * Tax Identification Number (e.g., EIN for companies, SSN for individuals if applicable and handled securely).
   * Aligns with `taxId` in Zod schema (Tech Ref, p. 39).
   */
  tax_id?: string | null;

  /** Legal/formal name as registered with authorities (if different from display name) */
  legal_name?: string | null;

  /** Primary business address */
  address?: string | null; // Consider a structured address type later

  /** Registered agent information, if applicable */
  registered_agent?: {
    name: string;
    address: string;
  } | null;

  /** Date of incorporation or formation (ISO Date string) */
  formation_date?: string | null;

  /** Jurisdiction of formation (e.g., "Delaware", "California") */
  jurisdiction?: string | null;

  /**
   * ID of parent entity (for hierarchical structures like subsidiaries).
   * Aligns with `parentId` in D1 schema and Zod schema (Tech Ref, p. 8, 39).
   */
  parent_id?: string | null;

  /** Whether this entity is currently active and operational */
  is_active: boolean; // Default true

  /**
   * User ID of the person who initially created this entity record in the system.
   * For auditing purposes. Access control is managed via EntityAccess.
   */
  readonly created_by_user_id: string;

  /** Timestamp (Unix ms or s) when this entity was created in the system */
  readonly created_at: number | Date;

  /** Timestamp (Unix ms or s) when this entity was last updated */
  updated_at: number | Date;

  /** Optional path string for hierarchical navigation (e.g., "parent/child"), could be derived. */
  readonly path?: string | null;

  /** Custom fields for additional entity-specific information */
  custom_fields?: Record<string, any> | null;

  // Removed `allows_sub_entities` as this can often be inferred or managed by system logic/permissions
  // Removed `user_id` (direct owner) to align with D1 schema focusing on `entity_access` for user linkage.
}

/**
 * Payload for creating or updating an Entity.
 * Excludes read-only fields (`id`, `created_by_user_id`, `created_at`, `path`).
 * `updated_at` is typically set by the server.
 */
export interface EntityInput {
  name: string;
  type: EntityType;
  description?: string | null;
  tax_id?: string | null;
  legal_name?: string | null;
  address?: string | null;
  registered_agent?: { name: string; address: string; } | null;
  formation_date?: string | null;
  jurisdiction?: string | null;
  parent_id?: string | null;
  is_active?: boolean; // Server should default to true if not provided on create
  custom_fields?: Record<string, any> | null;
}

/**
 * Query parameters for filtering and retrieving entities.
 */
export interface EntityQueryFilters {
  /** Filter by entity type */
  type?: EntityType;
  /** Only return active entities when true */
  is_active?: boolean;
  /** Only return entities that are children of the specified parent ID */
  parent_id?: string | null; // `null` could mean top-level entities
  /** Search term to filter entities by name, legal_name, or description */
  search_term?: string;
  /** Filter by entities created by a specific user */
  created_by_user_id?: string;
  /** Sorting options */
  // sort_by?: keyof Entity; // Be cautious with direct keyof for sensitive fields
  // sort_direction?: 'asc' | 'desc';
  /** Pagination options from api.d.ts could be used here */
  // pagination?: PaginationQuery;
}

/**
 * Hierarchical representation of an entity with its direct children.
 * Useful for displaying entity trees.
 */
export interface EntityWithChildren extends Entity {
  children?: Entity[]; // Simpler, direct children only. Deep nesting handled by recursive calls.
  // Removed depth, can be calculated during tree traversal if needed.
}