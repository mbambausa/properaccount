// src/types/auth.d.ts

/**
 * Defines the possible roles a user can have within the application.
 */
export type UserRole = 'admin' | 'user' | 'owner' | 'manager' | 'viewer';

/**
 * Represents the permissions a user can have within an entity.
 * Using a more structured approach for potentially easier management.
 */
export enum Permission {
  // Entity Management
  ViewEntity = 'entity:view',
  EditEntity = 'entity:edit',
  DeleteEntity = 'entity:delete',
  ManageEntitySettings = 'entity:settings:manage',
  ManageEntityUsers = 'entity:users:manage',

  // Accounting & Transactions
  ViewAccounts = 'accounts:view',
  CreateAccounts = 'accounts:create',
  EditAccounts = 'accounts:edit',
  DeleteAccounts = 'accounts:delete',
  ViewTransactions = 'transactions:view',
  CreateTransactions = 'transactions:create',
  EditTransactions = 'transactions:edit',
  DeleteTransactions = 'transactions:delete',
  ApproveTransactions = 'transactions:approve',
  ExportTransactions = 'transactions:export',

  // Reporting
  ViewReports = 'reports:view',
  CreateReports = 'reports:create', // Might mean generating/customizing
  ExportReports = 'reports:export',

  // Document Management
  ViewDocuments = 'documents:view',
  UploadDocuments = 'documents:upload',
  DeleteDocuments = 'documents:delete',
  ManageDocumentPermissions = 'documents:permissions:manage',

  // Loan Management
  ViewLoans = 'loans:view',
  CreateLoans = 'loans:create',
  EditLoans = 'loans:edit',
  DeleteLoans = 'loans:delete',
  ManageLoanPayments = 'loans:payments:manage',

  // Tax Management
  ViewTaxInfo = 'tax:view',
  EditTaxInfo = 'tax:edit',

  // Global Settings (App-level, not entity-specific)
  ManageAppSettings = 'app:settings:manage',
  ViewAuditLogs = 'app:auditlogs:view',
}


/**
 * Represents an active user session.
 * This is likely managed by your custom session store (e.g., SESSION_KV).
 */
export interface Session {
  /** Unique identifier for the session (e.g., secure random string) */
  readonly id: string;

  /** ID of the user this session belongs to */
  readonly userId: string;

  /** Timestamp (Unix milliseconds or seconds) when the session was created */
  readonly createdAt: number;

  /** Timestamp (Unix milliseconds or seconds) when the session expires */
  expiresAt: number;

  /** Optional arbitrary data to store with the session */
  data?: {
    /** IP address the session was created from (for security auditing) */
    ip?: string;

    /** User agent string from the client that created the session */
    userAgent?: string;

    /** Timestamp of the last activity in this session (for sliding sessions) */
    lastActivityAt?: number;

    /** Current entity ID the user is operating within (for multi-tenancy) */
    currentEntityId?: string;

    /** Indicates if MFA has been completed for this session */
    isMfaVerified?: boolean;

    /** Any additional custom data */
    [key: string]: any;
  };
}

/**
 * Represents a user account in the system.
 */
export interface User {
  /** Unique identifier for the user (UUID) */
  readonly id: string;

  /** User's email address (used for login, should be unique) */
  email: string;

  /** User's display name */
  name?: string | null;

  /** Hashed password (NEVER store plaintext) - This is for data representation, not direct exposure. */
  hashedPassword?: string; // Should not be sent to client

  /** User's primary role in the application (global role) */
  role: UserRole; // Could be 'admin', 'user' etc. Entity-specific roles are in EntityAccess.

  /** Timestamp (Unix ms or s) when the user account was created */
  readonly createdAt: number;

  /** Timestamp (Unix ms or s) when the user account was last updated */
  updatedAt: number;

  /** Timestamp (Unix ms or s) when the user's email was verified, if applicable */
  emailVerifiedAt?: number | null;

  /** URL to the user's profile image */
  imageUrl?: string | null;

  /** Flags indicating preferences or states for this user */
  flags?: {
    forcePasswordChange?: boolean;
    onboardingComplete?: boolean;
    isLocked?: boolean; // Renamed from 'locked' for clarity
    isMfaEnabled?: boolean; // Renamed from 'mfaEnabled'
    // isAdmin flag might be redundant if `role: 'admin'` is used, unless it's a super-admin concept.
    [key: string]: boolean | undefined;
  };

  /** Last login timestamp (Unix ms or s) */
  lastLoginAt?: number | null;

  /** The last IP address the user logged in from (for security auditing) */
  lastLoginIp?: string | null;
}

/**
 * Represents a user's access to an entity, including their role and specific permissions.
 * This links Users to Entities in a multi-tenant setup.
 */
export interface EntityAccess {
  /** Unique ID for this access record (optional, depends on DB schema) */
  id?: string;

  /** Entity the access pertains to */
  entityId: string;

  /** User who has access */
  userId: string;

  /** User's role within this specific entity (e.g., 'owner', 'manager', 'viewer') */
  role: UserRole; // This role is specific to the entity

  /** Specific permissions granted to the user for this entity (overrides or complements role) */
  permissions: Permission[];

  /** Timestamp (Unix ms or s) when access was granted */
  readonly grantedAt: number;

  /** Timestamp (Unix ms or s) when access was last updated */
  updatedAt: number;

  /** User ID of who granted or last updated this access */
  grantedByUserId: string; // Renamed from grantedBy for clarity
}

/**
 * Represents a linked third-party authentication provider account (e.g., Google, GitHub).
 */
export interface AuthProviderAccount { // Renamed from AuthAccount for clarity
  /** Identifier of the authentication provider (e.g., 'google', 'github') */
  readonly provider: string; // Renamed from providerId

  /** User ID from the provider's system */
  readonly providerUserId: string;

  /** ID of the user in our system that this provider account is linked to */
  readonly userId: string;

  /** Timestamp (Unix ms or s) when this provider link was created */
  readonly createdAt: number;

  /** Timestamp (Unix ms or s) when this provider link was last updated */
  updatedAt: number;

  /** Additional provider-specific account data (e.g., access_token, refresh_token - handle securely) */
  providerData?: Record<string, any>; // Renamed from providerAccountData
}

/**
 * Represents a token used for purposes like email verification or password reset.
 */
export interface VerificationToken {
  /** The identifier this token is for (e.g., email address, user ID) */
  readonly identifier: string;

  /** The actual token value (should be hashed if stored persistently) */
  readonly token: string; // The plaintext token, if transient. Or a reference to a hashed one.

  /** Timestamp (Unix ms or s) when this token expires */
  readonly expiresAt: number;

  /** Timestamp (Unix ms or s) when this token was created */
  readonly createdAt: number;

  /** Type of verification (e.g., 'EMAIL_VERIFICATION', 'PASSWORD_RESET') */
  readonly type: string;

  /** Whether the token has been used */
  usedAt?: number | null;
}

/**
 * Represents a user activity audit log entry.
 */
export interface ActivityLog {
  /** Unique identifier for this log entry (UUID) */
  readonly id: string;

  /** ID of the user who performed the action (if authenticated) */
  readonly userId?: string | null;

  /** ID of the entity in which the action was performed (if applicable) */
  readonly entityId?: string | null;

  /** Description of the action performed (e.g., 'USER_LOGIN', 'TRANSACTION_CREATED') */
  readonly action: string; // Consider using an enum for actions

  /** IP address from which the action was performed */
  readonly ipAddress?: string | null;

  /** User agent of the client used to perform the action */
  readonly userAgent?: string | null;

  /** Additional contextual data about the action (e.g., parameters, changes made) */
  readonly metadata?: Record<string, any> | null;

  /** Timestamp (Unix ms or s) when this activity occurred */
  readonly createdAt: number;

  /** Status of the action (e.g., 'SUCCESS', 'FAILURE', 'ATTEMPT') */
  readonly status?: 'SUCCESS' | 'FAILURE' | 'ATTEMPT'; // Consider using an enum

  /** Resource type that was affected (e.g., 'User', 'Entity', 'Transaction') */
  readonly resourceType?: string | null; // Consider using an enum

  /** ID of the resource that was affected */
  readonly resourceId?: string | null;
}

/**
 * Represents configuration for multi-factor authentication for a user.
 */
export interface MfaConfiguration { // Renamed from MfaConfig
  /** User ID this configuration belongs to */
  readonly userId: string;

  /** Type of MFA method */
  readonly type: 'totp' | 'sms' | 'email_otp' | 'backup_code';

  /** Secret key for TOTP (encrypted if stored) */
  secret?: string; // Store securely

  /** Phone number for SMS (if type is 'sms') */
  phoneNumber?: string;

  /** Whether this MFA method is currently enabled by the user */
  isEnabled: boolean;

  /** Timestamp (Unix ms or s) when this configuration was created */
  readonly createdAt: number;

  /** Timestamp (Unix ms or s) when this configuration was last updated */
  updatedAt: number;

  /** Timestamp (Unix ms or s) when this MFA method was last successfully used */
  lastUsedAt?: number | null;

  /** Label for the MFA method (e.g., "Authenticator App", "Phone ending in 1234") */
  label?: string;
}

/**
 * Password change/reset request data structure.
 */
export interface PasswordUpdateRequest { // Renamed from PasswordChangeRequest
  /** Current password (required when user is logged in and changing their own password) */
  currentPassword?: string;

  /** New password to set */
  newPassword: string;

  /** Confirmation of new password (for client-side and server-side validation) */
  confirmPassword: string;

  /** Reset token (only for password reset flow, not for logged-in user changing password) */
  resetToken?: string;
}

/**
 * Represents an invitation for a user to join an entity.
 */
export interface EntityInvitation { // Renamed from EntityInvite
  /** Unique identifier for this invitation (UUID) */
  readonly id: string;

  /** Email address the invitation was sent to */
  email: string;

  /** ID of the entity the user is invited to join */
  entityId: string;

  /** Role the user will be assigned in the entity if they accept */
  role: UserRole;

  /** Specific permissions to grant upon acceptance (can augment role-based permissions) */
  permissions?: Permission[];

  /** ID of the user who created/sent the invitation */
  readonly invitedByUserId: string; // Renamed from createdBy

  /** Timestamp (Unix ms or s) when the invitation was created */
  readonly createdAt: number;

  /** Timestamp (Unix ms or s) when the invitation expires */
  expiresAt: number;

  /** Custom message included with the invitation */
  message?: string | null;

  /** Status of the invitation */
  status: 'pending' | 'accepted' | 'revoked' | 'expired';

  /** Timestamp (Unix ms or s) when the invite was accepted, if applicable */
  acceptedAt?: number | null;

  /** ID of the user who accepted this invite (could be a new or existing user) */
  acceptedByUserId?: string | null;
}