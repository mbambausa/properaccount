// src/lib/auth/permissions.ts
// NOTE: This module depends on an `entity_access` table in the D1 database.
// Ensure this table is defined in your `cloudflare/d1/schema.ts` and that a
// corresponding migration has been created and applied.

/**
 * Permission Management Service
 * 
 * Handles permission checking, granting, and validation for users
 * based on their roles and entity-specific access.
 */

import type { User, Permission, UserRole, EntityAccess, ResourceType } from '@/types/auth';
import { DEFAULT_ROLE_PERMISSIONS } from '@/types/auth';
import type { CloudflareEnv } from '@/env';
import * as d1Helpers from '../cloudflare/d1';

/**
 * Check if a user has a specific permission
 * This checks both role-based and entity-specific permissions
 */
export async function userHasPermission(
  user: User,
  permission: Permission,
  entityId?: string,
  env?: CloudflareEnv
): Promise<boolean> {
  // Check role-based permissions first
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  if (rolePermissions.includes(permission)) {
    return true;
  }

  // If checking entity-specific permission and env is provided
  if (entityId && env?.DATABASE) {
    try {
      const entityAccess = await getEntityAccess(env, user.id, entityId);
      if (entityAccess && entityAccess.permissions.includes(permission)) {
        return true;
      }
    } catch (error) {
      console.error('Error checking entity permissions:', error);
    }
  }

  return false;
}

/**
 * Check if a user has all of the specified permissions
 */
export async function userHasAllPermissions(
  user: User,
  permissions: Permission[],
  entityId?: string,
  env?: CloudflareEnv
): Promise<boolean> {
  for (const permission of permissions) {
    if (!await userHasPermission(user, permission, entityId, env)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a user has any of the specified permissions
 */
export async function userHasAnyPermission(
  user: User,
  permissions: Permission[],
  entityId?: string,
  env?: CloudflareEnv
): Promise<boolean> {
  for (const permission of permissions) {
    if (await userHasPermission(user, permission, entityId, env)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all permissions for a user (role + entity-specific)
 */
export async function getUserPermissions(
  user: User,
  entityId?: string,
  env?: CloudflareEnv
): Promise<Permission[]> {
  const permissions = new Set<Permission>();
  
  // Add role-based permissions
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  rolePermissions.forEach(p => permissions.add(p));
  
  // Add entity-specific permissions if applicable
  if (entityId && env?.DATABASE) {
    try {
      const entityAccess = await getEntityAccess(env, user.id, entityId);
      if (entityAccess) {
        entityAccess.permissions.forEach(p => permissions.add(p));
      }
    } catch (error) {
      console.error('Error getting entity permissions:', error);
    }
  }
  
  return Array.from(permissions);
}

/**
 * Get entity access record for a user
 */
export async function getEntityAccess(
  env: CloudflareEnv,
  userId: string,
  entityId: string
): Promise<EntityAccess | null> {
  const db = env.DATABASE;
  if (!db) throw new Error("DATABASE binding not found");

  const access = await db.prepare(`
    SELECT 
      ea.*,
      e.name as entity_name
    FROM entity_access ea
    JOIN entities e ON ea.entity_id = e.id
    WHERE ea.user_id = ? AND ea.entity_id = ?
  `)
    .bind(userId, entityId)
    .first<any>();

  if (!access) return null;

  return {
    id: access.id,
    entityId: access.entity_id,
    userId: access.user_id,
    role: access.role as UserRole,
    permissions: JSON.parse(access.permissions || '[]'),
    grantedAt: access.granted_at,
    updatedAt: access.updated_at,
    grantedByUserId: access.granted_by_user_id,
  };
}

/**
 * Grant entity access to a user
 */
export async function grantEntityAccess(
  env: CloudflareEnv,
  grantorUserId: string,
  targetUserId: string,
  entityId: string,
  role: UserRole,
  additionalPermissions: Permission[] = []
): Promise<EntityAccess> {
  const db = env.DATABASE;
  if (!db) throw new Error("DATABASE binding not found");

  // Combine role permissions with additional permissions
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
  const allPermissions = Array.from(new Set([...rolePermissions, ...additionalPermissions]));
  
  const now = Math.floor(Date.now() / 1000);
  const accessId = crypto.randomUUID();
  
  await d1Helpers.insert(db, 'entity_access', {
    id: accessId,
    entity_id: entityId,
    user_id: targetUserId,
    role,
    permissions: JSON.stringify(allPermissions),
    granted_at: now,
    updated_at: now,
    granted_by_user_id: grantorUserId,
  });

  // Log the action
  await d1Helpers.insert(db, 'activity_logs', {
    user_id: grantorUserId,
    action: 'ENTITY_ACCESS_GRANTED',
    resource_type: 'ENTITY',
    resource_id: entityId,
    metadata: JSON.stringify({
      target_user_id: targetUserId,
      role,
      permissions: allPermissions,
    }),
    created_at: now,
  });

  return {
    id: accessId,
    entityId,
    userId: targetUserId,
    role,
    permissions: allPermissions,
    grantedAt: now,
    updatedAt: now,
    grantedByUserId: grantorUserId,
  };
}

/**
 * Revoke entity access from a user
 */
export async function revokeEntityAccess(
  env: CloudflareEnv,
  revokerUserId: string,
  targetUserId: string,
  entityId: string
): Promise<boolean> {
  const db = env.DATABASE;
  if (!db) throw new Error("DATABASE binding not found");

  const result = await db.prepare(`
    DELETE FROM entity_access 
    WHERE user_id = ? AND entity_id = ?
  `)
    .bind(targetUserId, entityId)
    .run();

  if (result.meta.changes && result.meta.changes > 0) {
    // Log the action
    await d1Helpers.insert(db, 'activity_logs', {
      user_id: revokerUserId,
      action: 'ENTITY_ACCESS_REVOKED',
      resource_type: 'ENTITY',
      resource_id: entityId,
      metadata: JSON.stringify({ target_user_id: targetUserId }),
      created_at: Math.floor(Date.now() / 1000),
    });
    return true;
  }

  return false;
}

/**
 * Update entity access permissions
 */
export async function updateEntityAccess(
  env: CloudflareEnv,
  updaterUserId: string,
  targetUserId: string,
  entityId: string,
  updates: {
    role?: UserRole;
    permissions?: Permission[];
  }
): Promise<EntityAccess | null> {
  const db = env.DATABASE;
  if (!db) throw new Error("DATABASE binding not found");

  const existing = await getEntityAccess(env, targetUserId, entityId);
  if (!existing) return null;

  const now = Math.floor(Date.now() / 1000);
  const updateData: any = { updated_at: now };

  if (updates.role !== undefined) {
    updateData.role = updates.role;
  }

  if (updates.permissions !== undefined) {
    updateData.permissions = JSON.stringify(updates.permissions);
  }

  await d1Helpers.update(db, 'entity_access', existing.id!, updateData);

  // Log the action
  await d1Helpers.insert(db, 'activity_logs', {
    user_id: updaterUserId,
    action: 'ENTITY_ACCESS_UPDATED',
    resource_type: 'ENTITY',
    resource_id: entityId,
    metadata: JSON.stringify({
      target_user_id: targetUserId,
      updates,
    }),
    created_at: now,
  });

  return getEntityAccess(env, targetUserId, entityId);
}

/**
 * Check if a user can perform an action on a resource
 */
export async function canPerformAction(
  user: User,
  action: Permission,
  resourceType: ResourceType,
  resourceId: string,
  env: CloudflareEnv
): Promise<boolean> {
  // Admins can do anything
  if (user.role === 'admin') return true;

  // For entity-based resources, check entity access
  if (resourceType === 'ENTITY' || resourceType === 'PROPERTY') {
    return userHasPermission(user, action, resourceId, env);
  }

  // For user-specific resources, check if it's their own
  if (resourceType === 'USER' && resourceId === user.id) {
    // Users can generally manage their own profile
    return true;
  }

  // Default to role-based permission check
  return userHasPermission(user, action, undefined, env);
}

/**
 * Get all entities a user has access to
 */
export async function getUserEntities(
  env: CloudflareEnv,
  userId: string
): Promise<Array<{ entityId: string; role: UserRole; permissions: Permission[] }>> {
  const db = env.DATABASE;
  if (!db) throw new Error("DATABASE binding not found");

  const accesses = await db.prepare(`
    SELECT 
      ea.entity_id,
      ea.role,
      ea.permissions,
      e.name as entity_name
    FROM entity_access ea
    JOIN entities e ON ea.entity_id = e.id
    WHERE ea.user_id = ? AND e.is_active = 1
    ORDER BY e.name
  `)
    .bind(userId)
    .all<any>();

  return accesses.results.map(access => ({
    entityId: access.entity_id,
    role: access.role as UserRole,
    permissions: JSON.parse(access.permissions || '[]'),
  }));
}

/**
 * Permission helper for use in API routes
 */
export function createPermissionChecker(user: User, env: CloudflareEnv) {
  return {
    has: (permission: Permission, entityId?: string) => 
      userHasPermission(user, permission, entityId, env),
    hasAll: (permissions: Permission[], entityId?: string) => 
      userHasAllPermissions(user, permissions, entityId, env),
    hasAny: (permissions: Permission[], entityId?: string) => 
      userHasAnyPermission(user, permissions, entityId, env),
    canPerform: (action: Permission, resourceType: ResourceType, resourceId: string) =>
      canPerformAction(user, action, resourceType, resourceId, env),
  };
}
