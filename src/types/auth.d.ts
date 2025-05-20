// src/types/auth.d.ts

/**
 * Defines the possible roles a user can have within the application.
 */
export type UserRole = 'admin' | 'user' | 'owner' | 'manager' | 'viewer';

/**
 * Represents the permissions a user can have within an entity.
 */
export type Permission = 
  // Entity management permissions
  | 'entity.view'
  | 'entity.edit'
  | 'entity.delete'
  | 'entity.settings'
  | 'entity.users.manage'
  
  // Account/transaction permissions
  | 'accounts.view'
  | 'accounts.create'
  | 'accounts.edit'
  | 'accounts.delete'
  | 'transactions.view'
  | 'transactions.create'
  | 'transactions.edit'
  | 'transactions.delete'
  | 'transactions.approve'
  | 'transactions.export'
  
  // Report permissions
  | 'reports.view'
  | 'reports.create'
  | 'reports.export'
  
  // Document permissions
  | 'documents.view'
  | 'documents.upload'
  | 'documents.delete'
  
  // Settings and configuration
  | 'settings.view'
  | 'settings.edit';

/**
 * Represents an active user session.
 */
export interface Session {
  /** Unique identifier for the session */
  readonly id: string;
  
  /** ID of the user this session belongs to */
  readonly userId: string;
  
  /** Timestamp (Unix seconds) when the session was created */
  readonly createdAt: number;
  
  /** Timestamp (Unix seconds) when the session expires */
  expiresAt: number;
  
  /** Optional arbitrary data to store with the session */
  data?: {
    /** IP address the session was created from */
    ip?: string;
    
    /** User agent the session was created with */
    userAgent?: string;
    
    /** Timestamp of the last activity in this session */
    lastActivity?: number;
    
    /** Whether the session was extended */
    extended?: boolean;
    
    /** Number of times the session was extended */
    extensionCount?: number;
    
    /** Current entity context for the session */
    currentEntityId?: string;
    
    /** Whether this session has been fully authenticated (useful for MFA) */
    fullyAuthenticated?: boolean;
    
    /** Any additional data */
    [key: string]: any;
  };
}

/**
 * Represents a user account in the system.
 */
export interface User {
  /** Unique identifier for the user */
  readonly id: string;
  
  /** User's email address (used for login) */
  email: string;
  
  /** User's display name */
  name?: string;
  
  /** User's permission role in the system */
  role: UserRole;
  
  /** Timestamp (Unix seconds) when the user account was created */
  readonly createdAt: number;
  
  /** Timestamp (Unix seconds) when the user account was last updated */
  updatedAt: number;
  
  /** Timestamp (Unix seconds) when the user's email was verified, if applicable */
  verifiedAt?: number;
  
  /** URL to the user's profile image */
  imageUrl?: string;
  
  /** Flags indicating preferences or states for this user */
  flags?: {
    /** Whether the user needs to change their password on next login */
    forcePasswordChange?: boolean;
    
    /** Whether the user has completed onboarding */
    onboardingComplete?: boolean;
    
    /** Whether the user account is locked */
    locked?: boolean;
    
    /** Whether multi-factor authentication is enabled */
    mfaEnabled?: boolean;
    
    /** Whether the user has admin-level access */
    isAdmin?: boolean;
    
    /** Custom flags can be added as needed */
    [key: string]: boolean | undefined;
  };
  
  /** Last login timestamp (Unix seconds) */
  lastLoginAt?: number;
  
  /** The last IP address the user logged in from */
  lastLoginIp?: string;
}

/**
 * Represents an entity (organization, company, etc.) in a multi-tenant system.
 */
export interface Entity {
  /** Unique identifier for the entity */
  readonly id: string;
  
  /** Entity name */
  name: string;
  
  /** Optional description */
  description?: string;
  
  /** Type of entity */
  type: 'company' | 'personal' | 'trust' | 'partnership';
  
  /** Parent entity ID, if this is a child entity */
  parentId?: string | null;
  
  /** Timestamp (Unix seconds) when the entity was created */
  readonly createdAt: number;
  
  /** Timestamp (Unix seconds) when the entity was last updated */
  updatedAt: number;
  
  /** ID of the user who created this entity */
  createdBy: string;
  
  /** Settings for this entity */
  settings?: Record<string, any>;
  
  /** Custom fields specific to this entity */
  customFields?: Record<string, any>;
}

/**
 * Represents a user's access to an entity.
 */
export interface EntityAccess {
  /** Entity the access pertains to */
  entityId: string;
  
  /** User who has access */
  userId: string;
  
  /** User's role within this entity */
  role: UserRole;
  
  /** Specific permissions granted to the user for this entity */
  permissions: Permission[];
  
  /** Timestamp (Unix seconds) when access was granted */
  readonly grantedAt: number;
  
  /** Timestamp (Unix seconds) when access was last updated */
  updatedAt: number;
  
  /** User who granted or last updated this access */
  grantedBy: string;
}

/**
 * Represents a linked third-party authentication provider account.
 */
export interface AuthAccount {
  /** Identifier of the authentication provider (e.g., 'google', 'github') */
  readonly providerId: string;
  
  /** User ID from the provider's system */
  readonly providerUserId: string;
  
  /** ID of the user in our system that this provider account is linked to */
  readonly userId: string;
  
  /** Timestamp (Unix seconds) when this provider link was created */
  readonly createdAt: number;
  
  /** Timestamp (Unix seconds) when this provider link was last updated */
  updatedAt: number;
  
  /** Provider-specific account data */
  providerAccountData?: Record<string, any>;
}

/**
 * Represents a token used for email verification or password reset.
 */
export interface VerificationToken {
  /** Email or other identifier this token was issued to */
  readonly identifier: string;
  
  /** The actual token value (should be hashed in storage) */
  readonly token: string;
  
  /** Timestamp (Unix seconds) when this token expires */
  readonly expiresAt: number;
  
  /** Timestamp (Unix seconds) when this token was created */
  readonly createdAt: number;
  
  /** Type of verification ('email', 'password-reset', etc.) */
  readonly type?: string;
}

/**
 * Represents a user activity audit log entry.
 */
export interface ActivityLog {
  /** Unique identifier for this log entry */
  readonly id?: string;
  
  /** ID of the user who performed the action (if authenticated) */
  readonly userId?: string;
  
  /** ID of the entity in which the action was performed (if applicable) */
  readonly entityId?: string;
  
  /** Description of the action performed */
  readonly action: string;
  
  /** IP address from which the action was performed */
  readonly ipAddress?: string;
  
  /** User agent of the client used to perform the action */
  readonly userAgent?: string;
  
  /** Additional contextual data about the action */
  readonly metadata?: Record<string, any>;
  
  /** Timestamp (Unix seconds) when this activity occurred */
  readonly createdAt: number;
  
  /** Status of the action (e.g., 'success', 'failure', 'attempted') */
  readonly status?: 'success' | 'failure' | 'attempted';
  
  /** Resource type that was affected (e.g., 'user', 'entity', 'transaction') */
  readonly resourceType?: string;
  
  /** ID of the resource that was affected */
  readonly resourceId?: string;
}

/**
 * Represents configuration for multi-factor authentication.
 */
export interface MfaConfig {
  /** User ID this configuration belongs to */
  userId: string;
  
  /** Type of MFA */
  type: 'totp' | 'sms' | 'email';
  
  /** Secret key for TOTP */
  secret?: string;
  
  /** Phone number for SMS */
  phoneNumber?: string;
  
  /** Backup email for email-based MFA */
  backupEmail?: string;
  
  /** Whether this MFA method is enabled */
  enabled: boolean;
  
  /** Timestamp (Unix seconds) when this configuration was created */
  readonly createdAt: number;
  
  /** Timestamp (Unix seconds) when this configuration was last updated */
  updatedAt: number;
  
  /** Timestamp (Unix seconds) when this MFA method was last used */
  lastUsedAt?: number;
}

/**
 * Password change/reset request data structure.
 */
export interface PasswordChangeRequest {
  /** Current password (required when user is logged in) */
  currentPassword?: string;
  
  /** New password to set */
  newPassword: string;
  
  /** Confirmation of new password (for validation) */
  confirmPassword: string;
  
  /** Reset token (only for password reset, not change) */
  resetToken?: string;
}

/**
 * Represents an invite to an entity.
 */
export interface EntityInvite {
  /** Unique identifier for this invite */
  readonly id: string;
  
  /** Email address the invite was sent to */
  email: string;
  
  /** ID of the entity the user is invited to */
  entityId: string;
  
  /** Role the user will have if they accept */
  role: UserRole;
  
  /** Specific permissions to grant */
  permissions?: Permission[];
  
  /** ID of the user who created the invite */
  createdBy: string;
  
  /** Timestamp (Unix seconds) when the invite was created */
  readonly createdAt: number;
  
  /** Timestamp (Unix seconds) when the invite expires */
  expiresAt: number;
  
  /** Custom message included with the invite */
  message?: string;
  
  /** Whether the invite has been accepted */
  accepted?: boolean;
  
  /** Timestamp (Unix seconds) when the invite was accepted, if applicable */
  acceptedAt?: number;
  
  /** ID of the user created from this invite, if applicable */
  acceptedByUserId?: string;
}