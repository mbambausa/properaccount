-- Migration: cloudflare/d1/migrations/0001_entities.sql
-- Description: Sets up tables related to entities, properties, and their relationships.

PRAGMA foreign_keys = ON;

-- Entities Table (companies, properties, etc.)
CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL, -- The user who owns/created this entity context if not using entity_access for primary ownership
    name TEXT NOT NULL, -- User-friendly name (e.g., "Main Street Property", "My Company")
    legal_name TEXT, -- Official legal name of the entity
    ein TEXT, -- Employer Identification Number or other Tax ID
    address TEXT, -- Primary physical address (consider structured fields or JSON later)
    legal_address TEXT, -- Official registered address
    business_type TEXT, -- e.g., 'llc', 'corporation', 'sole_proprietorship', 'trust'
    parent_id TEXT, -- For hierarchical entities (e.g., parent company, property group)
    is_active INTEGER NOT NULL DEFAULT 1, -- 0 for inactive, 1 for active
    allows_sub_entities INTEGER NOT NULL DEFAULT 0, -- 0 for false, 1 for true (can this entity be a parent)
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES entities(id) ON DELETE SET NULL
);

-- Index for faster lookups on common fields
CREATE INDEX IF NOT EXISTS idx_entities_user_id ON entities(user_id);
CREATE INDEX IF NOT EXISTS idx_entities_parent_id ON entities(parent_id);
CREATE INDEX IF NOT EXISTS idx_entities_business_type ON entities(business_type);

-- EntityAccess Table (for managing user access to entities - multi-tenancy)
-- This table defines which users can access which entities and with what role/permissions.
CREATE TABLE IF NOT EXISTS entity_access (
    id TEXT PRIMARY KEY, -- UUID for the access record itself
    entity_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL, -- e.g., 'owner', 'manager', 'viewer', 'accountant'
    permissions TEXT, -- JSON array of specific permissions, if role-based isn't granular enough
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    granted_by_user_id TEXT, -- User who granted this access
    UNIQUE (entity_id, user_id), -- Ensure a user has only one role/permission set per entity
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_entity_access_entity_id ON entity_access(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_access_user_id ON entity_access(user_id);

-- Notes:
-- - Consider adding a 'path' or 'materialized_path' column to 'entities' for easier querying of hierarchies if deep nesting is common.
-- - 'business_type' could be normalized into its own table if it has many attributes.
-- - JSON fields like 'address' or 'permissions' offer flexibility but have query limitations.
