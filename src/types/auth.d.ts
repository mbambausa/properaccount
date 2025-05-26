// src/types/auth.d.ts
/**
 * Defines types related to user authentication, authorization, roles,
 * permissions, sessions, and activity logging.
 */

/**
 * User roles within the ProperAccount system.
 * Roles dictate sets of permissions and access levels.
 */
export type UserRole =
  | 'admin'             // System administrator with full access
  | 'user'              // Basic authenticated user (default role)
  | 'owner'             // Property owner with rights to their properties/entities
  | 'property_manager'  // Manages properties on behalf of owners or a company
  | 'manager'           // Site/property manager with operational duties
  | 'accountant'        // Financial manager/bookkeeper for entities
  | 'maintenance'       // Maintenance staff with access to work orders
  | 'tenant'            // Tenant with access to their lease, payments, requests
  | 'viewer';           // Read-only access to specific data

/**
 * Granular permission set for various features within the application.
 */
export enum Permission {
  // --- Entity Management ---
  ViewEntityDetails = 'entity:details:view',
  CreateEntity = 'entity:create',
  EditEntityDetails = 'entity:details:edit',
  DeleteEntity = 'entity:delete',
  ManageEntitySettings = 'entity:settings:manage',
  ManageEntityUsers = 'entity:users:manage', // Add/remove users from an entity

  // --- Accounting & Transactions ---
  ViewChartOfAccounts = 'coa:view',
  EditChartOfAccounts = 'coa:edit', // Includes create, delete accounts within CoA
  ViewTransactions = 'transactions:view',
  CreateTransactions = 'transactions:create',
  EditTransactions = 'transactions:edit', // Includes voiding
  DeleteTransactions = 'transactions:delete', // Hard delete, potentially restricted
  ApproveTransactions = 'transactions:approve', // For workflows requiring approval
  ExportTransactions = 'transactions:export',
  ReconcileTransactions = 'transactions:reconcile',

  // --- Reporting ---
  ViewFinancialReports = 'reports:financial:view', // P&L, Balance Sheet, Cash Flow
  ViewOperationalReports = 'reports:operational:view', // Rent Roll, Vacancy
  CreateCustomReports = 'reports:custom:create',
  ExportReports = 'reports:export',

  // --- Document Management ---
  ViewDocuments = 'documents:view',
  UploadDocuments = 'documents:upload',
  EditDocumentMetadata = 'documents:metadata:edit',
  DeleteDocuments = 'documents:delete',
  ManageDocumentPermissions = 'documents:permissions:manage',

  // --- Loan Management ---
  ViewLoans = 'loans:view',
  CreateLoans = 'loans:create',
  EditLoans = 'loans:edit',
  DeleteLoans = 'loans:delete',
  ManageLoanPayments = 'loans:payments:manage',

  // --- Tax Management ---
  ViewTaxInfo = 'tax:info:view',
  EditTaxInfo = 'tax:info:edit', // e.g., mappings, depreciation schedules
  GenerateTaxReports = 'tax:reports:generate',

  // --- Application/Global Settings & Admin ---
  ManageSystemSettings = 'system:settings:manage', // Super-admin for platform settings
  ViewSystemAuditLogs = 'system:auditlogs:view', // Super-admin for all logs
  ManageUsersGlobal = 'system:users:manage', // Super-admin for all users

  // === Real Estate Specific Permissions ===

  // Property Management
  ViewProperties = 'properties:view',
  CreateProperties = 'properties:create',
  EditProperties = 'properties:edit',
  DeleteProperties = 'properties:delete',
  ManageUnits = 'properties:units:manage', // Add/edit/delete units within a property

  // Tenant Management
  ViewTenants = 'tenants:view',
  CreateTenants = 'tenants:create',
  EditTenants = 'tenants:edit',
  DeleteTenants = 'tenants:delete',
  ManageLeases = 'tenants:leases:manage', // Create, edit, terminate leases

  // Rent & Payments (Real Estate Specific)
  ViewRentRoll = 'rentroll:view',
  RecordTenantPayments = 'rent:payments:record', // Record rent, fees
  ManageSecurityDeposits = 'rent:deposits:manage', // Handle deposit collection/return

  // Maintenance & Work Orders
  ViewMaintenanceRequests = 'maintenance:requests:view',
  CreateMaintenanceWorkOrders = 'maintenance:workorders:create',
  AssignMaintenanceWorkOrders = 'maintenance:workorders:assign',
  UpdateMaintenanceWorkOrderStatus = 'maintenance:workorders:status:update',
  ApproveMaintenanceWorkOrders = 'maintenance:workorders:approve', // e.g., for costs

  // Vendor Management
  ViewVendors = 'vendors:view',
  ManageVendors = 'vendors:manage', // Create, edit, delete vendors
  ApproveVendorPayments = 'vendors:payments:approve',

  // User Profile
  EditOwnUserProfile = 'profile:own:edit',
  ViewOwnActivityLog = 'profile:own:activity:view',
}

/**
 * Resource types for action logging and dynamic permission checks.
 */
export enum ResourceType {
  // Core
  USER = 'USER',
  SESSION = 'SESSION',
  SYSTEM = 'SYSTEM',
  // Business Domain
  ENTITY = 'ENTITY',
  ACCOUNT = 'ACCOUNT', // Chart of Account entry
  TRANSACTION = 'TRANSACTION',
  DOCUMENT = 'DOCUMENT',
  REPORT = 'REPORT',
  LOAN = 'LOAN',
  TAX_CONFIG = 'TAX_CONFIG',
  AUTOMATION_RULE = 'AUTOMATION_RULE',
  // Real Estate Domain
  PROPERTY = 'PROPERTY',
  UNIT = 'UNIT',
  TENANT = 'TENANT',
  LEASE = 'LEASE',
  RENT_CHARGE = 'RENT_CHARGE',
  PAYMENT = 'PAYMENT',
  WORK_ORDER = 'WORK_ORDER',
  VENDOR = 'VENDOR',
  // Other
  INVITATION = 'INVITATION',
}

/**
 * Specific activity log actions, categorized for clarity.
 */
export enum ActivityAction {
  // --- Authentication & User Management ---
  USER_LOGIN_SUCCESS = 'USER_LOGIN_SUCCESS',
  USER_LOGIN_FAILURE = 'USER_LOGIN_FAILURE',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTERED = 'USER_REGISTERED',
  USER_PROFILE_UPDATED = 'USER_PROFILE_UPDATED',
  USER_PASSWORD_CHANGED = 'USER_PASSWORD_CHANGED',
  USER_PASSWORD_RESET_REQUESTED = 'USER_PASSWORD_RESET_REQUESTED',
  USER_PASSWORD_RESET_COMPLETED = 'USER_PASSWORD_RESET_COMPLETED',
  USER_EMAIL_VERIFIED = 'USER_EMAIL_VERIFIED',
  USER_MFA_ENABLED = 'USER_MFA_ENABLED',
  USER_MFA_DISABLED = 'USER_MFA_DISABLED',
  USER_MFA_CHALLENGE = 'USER_MFA_CHALLENGE', // Attempted MFA
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_INVITED = 'USER_INVITED',
  USER_DELETED_BY_ADMIN = 'USER_DELETED_BY_ADMIN',

  // --- Entity & Related Management ---
  ENTITY_CREATED = 'ENTITY_CREATED',
  ENTITY_UPDATED = 'ENTITY_UPDATED',
  ENTITY_DELETED = 'ENTITY_DELETED',
  ENTITY_SETTINGS_UPDATED = 'ENTITY_SETTINGS_UPDATED',
  ENTITY_USER_ACCESS_GRANTED = 'ENTITY_USER_ACCESS_GRANTED',
  ENTITY_USER_ACCESS_REVOKED = 'ENTITY_USER_ACCESS_REVOKED',
  ENTITY_USER_ROLE_UPDATED = 'ENTITY_USER_ROLE_UPDATED',

  PROPERTY_CREATED = 'PROPERTY_CREATED',
  PROPERTY_UPDATED = 'PROPERTY_UPDATED',
  PROPERTY_DELETED = 'PROPERTY_DELETED', // Or marked inactive/sold
  UNIT_CREATED = 'UNIT_CREATED',
  UNIT_UPDATED = 'UNIT_UPDATED',
  UNIT_DELETED = 'UNIT_DEleted',

  TENANT_CREATED = 'TENANT_CREATED',
  TENANT_UPDATED = 'TENANT_UPDATED',
  TENANT_DELETED = 'TENANT_DELETED', // Or marked inactive

  LEASE_CREATED = 'LEASE_CREATED',
  LEASE_UPDATED = 'LEASE_UPDATED',
  LEASE_RENEWED = 'LEASE_RENEWED',
  LEASE_TERMINATED = 'LEASE_TERMINATED',

  VENDOR_CREATED = 'VENDOR_CREATED',
  VENDOR_UPDATED = 'VENDOR_UPDATED',
  VENDOR_DELETED = 'VENDOR_DELETED',

  // --- Financial Operations ---
  CHART_OF_ACCOUNTS_UPDATED = 'CHART_OF_ACCOUNTS_UPDATED',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED', // Individual account within CoA
  ACCOUNT_UPDATED = 'ACCOUNT_UPDATED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',

  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_UPDATED = 'TRANSACTION_UPDATED',
  TRANSACTION_VOIDED = 'TRANSACTION_VOIDED',
  TRANSACTION_APPROVED = 'TRANSACTION_APPROVED',
  TRANSACTION_RECONCILED = 'TRANSACTION_RECONCILED',
  TRANSACTION_UNRECONCILED = 'TRANSACTION_UNRECONCILED',
  RECONCILIATION_STARTED = 'RECONCILIATION_STARTED',
  RECONCILIATION_COMPLETED = 'RECONCILIATION_COMPLETED',

  RENT_CHARGE_POSTED = 'RENT_CHARGE_POSTED',
  RENT_PAYMENT_RECORDED = 'RENT_PAYMENT_RECORDED',
  SECURITY_DEPOSIT_RECEIVED = 'SECURITY_DEPOSIT_RECEIVED',
  SECURITY_DEPOSIT_RETURNED = 'SECURITY_DEPOSIT_RETURNED',

  LOAN_CREATED = 'LOAN_CREATED',
  LOAN_PAYMENT_MADE = 'LOAN_PAYMENT_MADE',

  // --- Document, Reporting, Tax ---
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  DOCUMENT_VIEWED = 'DOCUMENT_VIEWED',
  DOCUMENT_DELETED = 'DOCUMENT_DELETED',

  REPORT_GENERATED = 'REPORT_GENERATED',
  REPORT_EXPORTED = 'REPORT_EXPORTED',
  REPORT_SHARED = 'REPORT_SHARED',

  TAX_SETTINGS_UPDATED = 'TAX_SETTINGS_UPDATED',
  TAX_DOCUMENT_GENERATED = 'TAX_DOCUMENT_GENERATED',

  // --- Maintenance ---
  WORK_ORDER_CREATED = 'WORK_ORDER_CREATED',
  WORK_ORDER_UPDATED = 'WORK_ORDER_UPDATED', // e.g., status change, assignment
  WORK_ORDER_COMPLETED = 'WORK_ORDER_COMPLETED',
  WORK_ORDER_APPROVED = 'WORK_ORDER_APPROVED',

  // --- System & Rules ---
  AUTOMATION_RULE_CREATED = 'AUTOMATION_RULE_CREATED',
  AUTOMATION_RULE_TRIGGERED = 'AUTOMATION_RULE_TRIGGERED',
  SYSTEM_MAINTENANCE_STARTED = 'SYSTEM_MAINTENANCE_STARTED',
}

/**
 * Default permissions assigned to each user role.
 * This serves as a baseline; individual users or entity-specific roles can have overrides.
 */
export const DEFAULT_ROLE_PERMISSIONS: Readonly<Record<UserRole, ReadonlyArray<Permission>>> = {
  admin: Object.values(Permission), // System admin has all permissions
  owner: [
    Permission.ViewEntityDetails, Permission.EditEntityDetails, Permission.ManageEntityUsers,
    Permission.ViewChartOfAccounts, Permission.ViewTransactions, Permission.CreateTransactions, Permission.EditTransactions,
    Permission.ViewFinancialReports, Permission.ExportReports,
    Permission.ViewProperties, Permission.EditProperties, Permission.ManageUnits,
    Permission.ViewTenants, Permission.EditTenants, Permission.ManageLeases,
    Permission.ViewRentRoll, Permission.RecordTenantPayments, Permission.ManageSecurityDeposits,
    Permission.ViewDocuments, Permission.UploadDocuments,
    Permission.ViewMaintenanceRequests, Permission.CreateMaintenanceWorkOrders, Permission.ApproveMaintenanceWorkOrders,
    Permission.ViewLoans,
    Permission.ViewTaxInfo,
    Permission.EditOwnUserProfile,
  ],
  property_manager: [
    Permission.ViewEntityDetails,
    Permission.ViewChartOfAccounts, Permission.ViewTransactions, Permission.CreateTransactions, Permission.EditTransactions, Permission.ReconcileTransactions,
    Permission.ViewFinancialReports,
    Permission.ViewProperties, Permission.EditProperties, Permission.ManageUnits,
    Permission.ViewTenants, Permission.CreateTenants, Permission.EditTenants, Permission.ManageLeases,
    Permission.ViewRentRoll, Permission.RecordTenantPayments, Permission.ManageSecurityDeposits,
    Permission.ViewDocuments, Permission.UploadDocuments,
    Permission.ViewMaintenanceRequests, Permission.CreateMaintenanceWorkOrders, Permission.AssignMaintenanceWorkOrders, Permission.UpdateMaintenanceWorkOrderStatus,
    Permission.ViewVendors, Permission.ManageVendors,
    Permission.EditOwnUserProfile,
  ],
  manager: [ // e.g., on-site manager
    Permission.ViewEntityDetails, // Limited to their assigned entity/property context
    Permission.ViewProperties, Permission.ManageUnits,
    Permission.ViewTenants, Permission.ManageLeases,
    Permission.ViewRentRoll, Permission.RecordTenantPayments,
    Permission.ViewMaintenanceRequests, Permission.CreateMaintenanceWorkOrders, Permission.UpdateMaintenanceWorkOrderStatus,
    Permission.EditOwnUserProfile,
  ],
  accountant: [
    Permission.ViewEntityDetails,
    Permission.ViewChartOfAccounts, Permission.EditChartOfAccounts,
    Permission.ViewTransactions, Permission.CreateTransactions, Permission.EditTransactions, Permission.ApproveTransactions, Permission.ReconcileTransactions,
    Permission.ViewFinancialReports, Permission.ExportReports,
    Permission.ViewRentRoll, Permission.ManageSecurityDeposits,
    Permission.ViewLoans, Permission.ManageLoanPayments,
    Permission.ViewTaxInfo, Permission.EditTaxInfo, Permission.GenerateTaxReports,
    Permission.ViewVendors, Permission.ApproveVendorPayments,
    Permission.EditOwnUserProfile,
  ],
  maintenance: [
    Permission.ViewProperties, // Limited to assigned properties
    Permission.ViewMaintenanceRequests, Permission.UpdateMaintenanceWorkOrderStatus,
    Permission.ViewDocuments, // e.g., related to work orders
    Permission.EditOwnUserProfile,
  ],
  tenant: [
    Permission.ViewOwnUserProfile, Permission.EditOwnUserProfile, // Limited profile editing
    Permission.ViewDocuments, // View their own lease, payment receipts
    Permission.CreateMaintenanceWorkOrders, // Submit requests for their unit
    Permission.ViewMaintenanceRequests, // View status of their own requests
    Permission.RecordTenantPayments, // If self-service payment portal
    // View own lease details, payment history
  ],
  user: [ // Basic authenticated user, perhaps before being assigned a more specific role
    Permission.ViewEntityDetails, // If part of an entity
    Permission.EditOwnUserProfile,
    Permission.ViewOwnActivityLog,
  ],
  viewer: [ // Read-only role
    Permission.ViewEntityDetails,
    Permission.ViewChartOfAccounts,
    Permission.ViewTransactions,
    Permission.ViewFinancialReports,
    Permission.ViewOperationalReports,
    Permission.ViewProperties,
    Permission.ViewTenants,
    Permission.ViewRentRoll,
    Permission.ViewDocuments,
    Permission.ViewLoans,
    Permission.ViewTaxInfo,
    Permission.ViewMaintenanceRequests,
    Permission.ViewVendors,
    Permission.ViewOwnUserProfile,
  ]
};

/**
 * Represents a user's session in the application.
 * This might be stored server-side (e.g., in KV store) or as a JWT payload.
 */
export interface Session {
  /** Unique identifier for this session. */
  readonly id: string;
  /** ID of the user this session belongs to. */
  readonly userId: string;
  /** Unix timestamp (seconds) when the session was created. */
  readonly createdAt: number;
  /** Unix timestamp (seconds) when the session will expire. */
  expiresAt: number;
  /** Optional data associated with the session. */
  data?: {
    ipAddress?: string;
    userAgent?: string;
    /** Unix timestamp (seconds) of the last recorded activity for this session. */
    lastActivityAt?: number;
    /** ID of the entity the user is currently actively working within. */
    currentEntityId?: string;
    /** Indicates if Multi-Factor Authentication was completed for this session. */
    isMfaVerified?: boolean;
    /** Current property ID if viewing property-specific data. */
    currentPropertyId?: string;
    /** List of recently accessed entities/properties for quick navigation. */
    recentItems?: Array<{
      id: string; // Entity or Property ID
      name: string;
      type: 'entity' | 'property'; // Type of the recent item
      lastAccessed: number; // Unix timestamp (seconds)
    }>;
    /** User's preferred view (e.g., for property managers). */
    preferredView?: 'portfolio_overview' | 'property_detail' | 'financial_summary';
    [key: string]: any; // Allow for other custom session data
  };
}

/**
 * Represents a user account in the system.
 * This aligns with what might be stored in the 'users' D1 table.
 */
export interface User {
  /** Unique identifier (UUID) for this user. */
  readonly id: string;
  email: string; // Must be unique
  name?: string | null;
  hashedPassword?: string | null; // Null if using OAuth only
  role: UserRole; // Application-level role
  /** Unix timestamp (seconds) when the user account was created. */
  readonly createdAt: number;
  /** Unix timestamp (seconds) when the user account was last updated. */
  updatedAt: number;
  /** Unix timestamp (seconds) when the user's email was verified. Null if not verified. */
  emailVerifiedAt?: number | null;
  imageUrl?: string | null; // URL to profile picture
  flags?: {
    forcePasswordChange?: boolean;
    onboardingComplete?: boolean;
    isLocked?: boolean; // Account locked due to suspicious activity or admin action
    isMfaEnabled?: boolean;
    isTermsAccepted?: boolean;
    [key: string]: boolean | undefined; // Extensible flags
  };
  /** Unix timestamp (seconds) of the user's last login. */
  lastLoginAt?: number | null;
  lastLoginIp?: string | null;
  timezone?: string | null; // User's preferred timezone, e.g., "America/Denver"
  locale?: string | null;   // User's preferred locale, e.g., "en-US"
}

/**
 * Defines a user's access rights and role within a specific entity.
 * This structure facilitates multi-entity access control.
 */
export interface EntityAccess {
  /** Unique identifier for this access record. */
  readonly id?: string; // May be auto-generated by DB
  entityId: string; // ID of the entity
  userId: string;   // ID of the user
  role: UserRole;   // Role of the user within this specific entity
  /** Specific permissions overriding or complementing the role's default permissions for this entity. */
  permissions?: Permission[];
  /** Unix timestamp (seconds) when access was granted. */
  readonly grantedAt: number;
  /** Unix timestamp (seconds) when access details were last updated. */
  updatedAt: number;
  /** ID of the user who granted this access. */
  grantedByUserId: string;
  notes?: string | null; // Optional notes about this access grant
}

/**
 * Represents a linked third-party authentication provider account for a user.
 * E.g., Google, GitHub.
 */
export interface AuthProviderAccount {
  readonly provider: string; // e.g., "google", "github"
  readonly providerUserId: string; // User's ID from the OAuth provider
  readonly userId: string; // Local application user ID
  /** Unix timestamp (seconds) when this provider account was linked. */
  readonly createdAt: number;
  /** Unix timestamp (seconds) when this provider account info was last updated. */
  updatedAt: number;
  /** Optional: Store additional data from provider (e.g., access_token, refresh_token if securely handled). */
  providerData?: Record<string, any>;
}

/**
 * Structure for verification tokens (e.g., email verification, password reset).
 */
export interface VerificationToken {
  readonly identifier: string; // Typically user's email or ID
  readonly token: string;      // The unguessable token string (hashed in DB)
  /** Unix timestamp (seconds) when the token expires. */
  readonly expiresAt: number;
  /** Unix timestamp (seconds) when the token was created. */
  readonly createdAt: number;
  readonly type: 'email_verification' | 'password_reset' | 'mfa_setup';
  /** Unix timestamp (seconds) when the token was used. Null if not used. */
  usedAt?: number | null;
}

/**
 * Represents an entry in the activity/audit log.
 */
export interface ActivityLog {
  /** Unique identifier (UUID) for this log entry. */
  readonly id: string;
  /** ID of the user who performed the action. Null for system actions. */
  readonly userId?: string | null;
  /** ID of the primary entity context for this action. */
  readonly entityId?: string | null;
  /** Type of action performed. */
  readonly action: ActivityAction | string; // Allow custom string for extensibility
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  /** Additional metadata relevant to the action (e.g., changed fields, input parameters). */
  readonly metadata?: Record<string, any> | null;
  /** Unix timestamp (seconds) when the action occurred. */
  readonly createdAt: number;
  readonly status?: 'SUCCESS' | 'FAILURE' | 'ATTEMPT'; // Outcome of the action
  /** Type of the primary resource affected by the action. */
  readonly resourceType?: ResourceType | string;
  /** ID of the primary resource affected. */
  readonly resourceId?: string | null;
}

/**
 * Configuration for a user's Multi-Factor Authentication (MFA) method.
 */
export interface MfaConfiguration {
  /** Unique identifier for this MFA configuration. */
  readonly id: string;
  readonly userId: string;
  type: 'totp' | 'sms' | 'email_otp' | 'backup_code';
  secret?: string | null; // Encrypted TOTP secret or similar
  phoneNumber?: string | null; // For SMS MFA (E.164 format)
  isEnabled: boolean;
  isVerified: boolean; // Indicates if this specific MFA method has been verified by the user
  /** Unix timestamp (seconds) when this MFA method was configured. */
  readonly createdAt: number;
  /** Unix timestamp (seconds) when this MFA method was last updated. */
  updatedAt: number;
  /** Unix timestamp (seconds) when this MFA method was last successfully used. */
  lastUsedAt?: number | null;
  label?: string | null; // User-defined label for the MFA method
}

/**
 * Request structure for updating a user's password.
 */
export interface PasswordUpdateRequest {
  currentPassword?: string; // Required if changing password while logged in
  newPassword: string;
  confirmNewPassword: string;
  resetToken?: string; // Required if resetting password via token
}

/**
 * Represents an invitation for a user to access an entity.
 */
export interface EntityInvitation {
  /** Unique identifier (UUID) for this invitation. */
  readonly id: string;
  email: string; // Email of the invited user
  entityId: string; // ID of the entity to which the user is invited
  role: UserRole;   // Role to be granted upon acceptance
  permissions?: Permission[]; // Specific permissions if overriding role defaults
  readonly invitedByUserId: string; // ID of the user who sent the invitation
  /** Unix timestamp (seconds) when the invitation was created. */
  readonly createdAt: number;
  /** Unix timestamp (seconds) when the invitation expires. */
  expiresAt: number;
  message?: string | null; // Optional message from the inviter
  status: 'pending' | 'accepted' | 'revoked' | 'expired' | 'declined';
  /** Unix timestamp (seconds) when the invitation was accepted. */
  acceptedAt?: number | null;
  /** ID of the user who accepted the invitation (if they were new or existing). */
  acceptedByUserId?: string | null;
}