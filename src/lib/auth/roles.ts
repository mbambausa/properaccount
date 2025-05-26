// src/lib/auth/roles.ts
/**
 * Role Management Service
 * 
 * Handles role hierarchy, inheritance, and role-based access control
 */

import type { UserRole, Permission } from '@/types/auth';
import { DEFAULT_ROLE_PERMISSIONS } from '@/types/auth';

/**
 * Role hierarchy definition
 * Higher level roles inherit permissions from lower level roles
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  owner: 90,
  property_manager: 80,
  accountant: 70,
  manager: 60,
  user: 50,
  maintenance: 40,
  tenant: 30,
  viewer: 20,
};

/**
 * Role display names for UI
 */
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  admin: 'Administrator',
  owner: 'Property Owner',
  property_manager: 'Property Management Company',
  manager: 'Property Manager',
  accountant: 'Accountant',
  maintenance: 'Maintenance Staff',
  tenant: 'Tenant',
  user: 'User',
  viewer: 'Viewer',
};

/**
 * Role descriptions
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Full system access with all permissions',
  owner: 'Property owner with viewing rights and financial access',
  property_manager: 'Property management company with operational control',
  manager: 'Individual property manager with day-to-day management rights',
  accountant: 'Financial manager with accounting and reporting access',
  maintenance: 'Maintenance staff with work order management',
  tenant: 'Tenant with limited access to their own information',
  user: 'Basic user with general access',
  viewer: 'Read-only access to permitted resources',
};

/**
 * Check if a role is higher than another in the hierarchy
 */
export function isRoleHigherThan(role1: UserRole, role2: UserRole): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
}

/**
 * Check if a role is equal or higher than another
 */
export function isRoleEqualOrHigherThan(role1: UserRole, role2: UserRole): boolean {
  return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2];
}

/**
 * Get all permissions for a role (including inherited permissions)
 */
export function getRolePermissions(role: UserRole): Permission[] {
  // For now, just return the default permissions
  // In a more complex system, you might want to inherit from lower roles
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
}

/**
 * Get all roles that a user with a given role can assign
 */
export function getAssignableRoles(userRole: UserRole): UserRole[] {
  const userLevel = ROLE_HIERARCHY[userRole];
  
  // Users can only assign roles lower than their own
  return (Object.keys(ROLE_HIERARCHY) as UserRole[])
    .filter(role => ROLE_HIERARCHY[role] < userLevel)
    .sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]);
}

/**
 * Check if a user can assign a specific role
 */
export function canAssignRole(assignerRole: UserRole, targetRole: UserRole): boolean {
  // Admins can assign any role
  if (assignerRole === 'admin') return true;
  
  // Others can only assign roles lower than their own
  return isRoleHigherThan(assignerRole, targetRole);
}

/**
 * Get appropriate default role for a new user based on context
 */
export function getDefaultRole(context?: {
  invitedBy?: UserRole;
  entityType?: string;
  isFirstUser?: boolean;
}): UserRole {
  // First user in the system becomes admin
  if (context?.isFirstUser) return 'admin';
  
  // If invited by someone, default to a role appropriate to the inviter
  if (context?.invitedBy) {
    switch (context.invitedBy) {
      case 'admin':
      case 'owner':
        return 'user';
      case 'property_manager':
        return 'manager';
      case 'manager':
        return 'maintenance';
      default:
        return 'viewer';
    }
  }
  
  // Default for self-registration
  return 'user';
}

/**
 * Validate role transition (for role changes)
 */
export function isValidRoleTransition(
  currentRole: UserRole,
  newRole: UserRole,
  changerRole: UserRole
): boolean {
  // Users cannot change their own role to a higher level
  if (currentRole === changerRole && isRoleHigherThan(newRole, currentRole)) {
    return false;
  }
  
  // Users cannot assign roles equal or higher than their own
  if (!canAssignRole(changerRole, newRole)) {
    return false;
  }
  
  return true;
}

/**
 * Get role-specific limits and quotas
 */
export function getRoleLimits(role: UserRole): {
  maxEntities: number;
  maxUsers: number;
  maxDocumentStorage: number; // in MB
  maxTransactionsPerMonth: number;
  canCreateSubEntities: boolean;
  canInviteUsers: boolean;
  canExportData: boolean;
} {
  switch (role) {
    case 'admin':
      return {
        maxEntities: -1, // unlimited
        maxUsers: -1,
        maxDocumentStorage: -1,
        maxTransactionsPerMonth: -1,
        canCreateSubEntities: true,
        canInviteUsers: true,
        canExportData: true,
      };
    case 'owner':
    case 'property_manager':
      return {
        maxEntities: 100,
        maxUsers: 50,
        maxDocumentStorage: 10240, // 10GB
        maxTransactionsPerMonth: 10000,
        canCreateSubEntities: true,
        canInviteUsers: true,
        canExportData: true,
      };
    case 'manager':
    case 'accountant':
      return {
        maxEntities: 20,
        maxUsers: 10,
        maxDocumentStorage: 5120, // 5GB
        maxTransactionsPerMonth: 5000,
        canCreateSubEntities: true,
        canInviteUsers: true,
        canExportData: true,
      };
    case 'user':
      return {
        maxEntities: 5,
        maxUsers: 0,
        maxDocumentStorage: 1024, // 1GB
        maxTransactionsPerMonth: 1000,
        canCreateSubEntities: false,
        canInviteUsers: false,
        canExportData: true,
      };
    case 'maintenance':
      return {
        maxEntities: 0,
        maxUsers: 0,
        maxDocumentStorage: 100, // 100MB
        maxTransactionsPerMonth: 0,
        canCreateSubEntities: false,
        canInviteUsers: false,
        canExportData: false,
      };
    case 'tenant':
    case 'viewer':
      return {
        maxEntities: 0,
        maxUsers: 0,
        maxDocumentStorage: 10, // 10MB
        maxTransactionsPerMonth: 0,
        canCreateSubEntities: false,
        canInviteUsers: false,
        canExportData: false,
      };
    default:
      return {
        maxEntities: 0,
        maxUsers: 0,
        maxDocumentStorage: 0,
        maxTransactionsPerMonth: 0,
        canCreateSubEntities: false,
        canInviteUsers: false,
        canExportData: false,
      };
  }
}

/**
 * Get roles suitable for different entity types
 */
export function getRolesForEntityType(entityType: string): UserRole[] {
  switch (entityType) {
    case 'property':
    case 'rental_property':
      return ['owner', 'property_manager', 'manager', 'accountant', 'maintenance', 'viewer'];
    case 'property_unit':
      return ['manager', 'maintenance', 'tenant', 'viewer'];
    case 'company':
    case 'property_management':
      return ['owner', 'property_manager', 'accountant', 'user', 'viewer'];
    case 'tenant':
      return ['tenant', 'viewer'];
    default:
      return ['user', 'viewer'];
  }
}

/**
 * Role utility functions for UI components
 */
export const roleUtils = {
  getDisplayName: (role: UserRole) => ROLE_DISPLAY_NAMES[role] || role,
  getDescription: (role: UserRole) => ROLE_DESCRIPTIONS[role] || '',
  canAssign: canAssignRole,
  getAssignable: getAssignableRoles,
  isHigherThan: isRoleHigherThan,
  getLimits: getRoleLimits,
};