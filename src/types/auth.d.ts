// src/types/auth.d.ts
/**
 * User roles within a real estate accounting system.
 */
export type UserRole =
  | 'admin'             // System administrator (all permissions)
  | 'user'              // Basic user (generic)
  | 'owner'             // Property owner
  | 'property_manager'  // Property management company
  | 'manager'           // Individual property manager
  | 'accountant'        // Financial manager
  | 'maintenance'       // Maintenance staff
  | 'tenant'            // Tenant with limited access
  | 'viewer';           // Read-only

/**
 * Permission set for real estate and accounting features.
 */
export enum Permission {
  // --- Entity Management ---
  ViewEntity = 'entity:view',
  EditEntity = 'entity:edit',
  DeleteEntity = 'entity:delete',
  ManageEntitySettings = 'entity:settings:manage',
  ManageEntityUsers = 'entity:users:manage',

  // --- Accounting & Transactions ---
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

  // --- Reporting ---
  ViewReports = 'reports:view',
  CreateReports = 'reports:create',
  ExportReports = 'reports:export',

  // --- Document Management ---
  ViewDocuments = 'documents:view',
  UploadDocuments = 'documents:upload',
  DeleteDocuments = 'documents:delete',
  ManageDocumentPermissions = 'documents:permissions:manage',

  // --- Loan Management ---
  ViewLoans = 'loans:view',
  CreateLoans = 'loans:create',
  EditLoans = 'loans:edit',
  DeleteLoans = 'loans:delete',
  ManageLoanPayments = 'loans:payments:manage',

  // --- Tax Management ---
  ViewTaxInfo = 'tax:view',
  EditTaxInfo = 'tax:edit',

  // --- App/Global ---
  ManageAppSettings = 'app:settings:manage',
  ViewAuditLogs = 'app:auditlogs:view',

  // === Real Estate Specific Permissions ===

  // Property Management
  ViewProperties = 'properties:view',
  CreateProperties = 'properties:create',
  EditProperties = 'properties:edit',
  DeleteProperties = 'properties:delete',
  ManageUnits = 'properties:units:manage',

  // Tenant Management
  ViewTenants = 'tenants:view',
  CreateTenants = 'tenants:create',
  EditTenants = 'tenants:edit',
  DeleteTenants = 'tenants:delete',
  ManageLeases = 'tenants:leases:manage',

  // Rent & Payments
  ViewRentRoll = 'rent:view',
  CollectRent = 'rent:collect',
  ManageDepositReturns = 'rent:deposits:manage',

  // Maintenance & Work Orders
  ViewMaintenance = 'maintenance:view',
  CreateWorkOrders = 'maintenance:create',
  ApproveWorkOrders = 'maintenance:approve',

  // Vendor Management
  ManageVendors = 'vendors:manage',
  ApproveVendorPayments = 'vendors:payments:approve',
}

/**
 * Resource types for action logging and permission checks.
 */
export enum ResourceType {
  USER = 'USER',
  ENTITY = 'ENTITY',
  PROPERTY = 'PROPERTY',
  UNIT = 'UNIT',
  TRANSACTION = 'TRANSACTION',
  ACCOUNT = 'ACCOUNT',
  DOCUMENT = 'DOCUMENT',
  REPORT = 'REPORT',
  LEASE = 'LEASE',
  TENANT = 'TENANT',
  WORK_ORDER = 'WORK_ORDER',
  VENDOR = 'VENDOR',
}

/**
 * Specific activity log actions, including real estate–related operations.
 */
export enum ActivityAction {
  // Authentication
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTER = 'USER_REGISTER',
  PASSWORD_RESET = 'PASSWORD_RESET',
  MFA_ENABLED = 'MFA_ENABLED',

  // Entity Management
  ENTITY_CREATED = 'ENTITY_CREATED',
  ENTITY_UPDATED = 'ENTITY_UPDATED',
  ENTITY_DELETED = 'ENTITY_DELETED',

  // Property Management
  PROPERTY_CREATED = 'PROPERTY_CREATED',
  PROPERTY_UPDATED = 'PROPERTY_UPDATED',
  PROPERTY_SOLD = 'PROPERTY_SOLD',
  UNIT_CREATED = 'UNIT_CREATED',

  // Financial
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  TRANSACTION_VOIDED = 'TRANSACTION_VOIDED',
  RECONCILIATION_COMPLETED = 'RECONCILIATION_COMPLETED',
  RENT_COLLECTED = 'RENT_COLLECTED',
  DEPOSIT_RETURNED = 'DEPOSIT_RETURNED',

  // Reporting
  REPORT_GENERATED = 'REPORT_GENERATED',
  REPORT_EXPORTED = 'REPORT_EXPORTED',

  // Tenant Management
  LEASE_CREATED = 'LEASE_CREATED',
  LEASE_RENEWED = 'LEASE_RENEWED',
  LEASE_TERMINATED = 'LEASE_TERMINATED',
  TENANT_ADDED = 'TENANT_ADDED',

  // Maintenance
  WORK_ORDER_CREATED = 'WORK_ORDER_CREATED',
  WORK_ORDER_COMPLETED = 'WORK_ORDER_COMPLETED',
}

/**
 * Role-based default permissions mapping.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: Object.values(Permission),
  owner: [
    Permission.ViewEntity,
    Permission.EditEntity,
    Permission.ViewAccounts,
    Permission.ViewTransactions,
    Permission.ViewReports,
    Permission.ViewProperties,
    Permission.ViewTenants,
    Permission.ViewRentRoll,
    Permission.CollectRent,
    Permission.ViewDocuments,
    Permission.ViewMaintenance,
  ],
  property_manager: [
    Permission.ViewEntity,
    Permission.ViewAccounts,
    Permission.CreateTransactions,
    Permission.ViewTransactions,
    Permission.ManageUnits,
    Permission.ViewProperties,
    Permission.ViewTenants,
    Permission.ManageLeases,
    Permission.CollectRent,
    Permission.CreateWorkOrders,
    Permission.ViewMaintenance,
    Permission.ManageVendors,
  ],
  manager: [
    Permission.ViewEntity,
    Permission.ViewProperties,
    Permission.ManageUnits,
    Permission.ViewTenants,
    Permission.ManageLeases,
    Permission.CollectRent,
    Permission.ViewMaintenance,
    Permission.CreateWorkOrders,
  ],
  accountant: [
    Permission.ViewEntity,
    Permission.ViewAccounts,
    Permission.ViewTransactions,
    Permission.ApproveTransactions,
    Permission.ViewReports,
    Permission.ExportReports,
    Permission.ViewTaxInfo,
    Permission.EditTaxInfo,
    Permission.ViewRentRoll,
    Permission.ManageDepositReturns,
  ],
  maintenance: [
    Permission.ViewEntity,
    Permission.ViewProperties,
    Permission.ViewMaintenance,
    Permission.CreateWorkOrders,
    Permission.ApproveWorkOrders,
  ],
  tenant: [
    Permission.ViewEntity,
    Permission.ViewTransactions,
    Permission.ViewDocuments,
    Permission.ViewMaintenance,
  ],
  user: [
    Permission.ViewEntity,
    Permission.ViewAccounts,
    Permission.ViewTransactions,
    Permission.ViewReports,
    Permission.ViewProperties,
    Permission.ViewTenants,
  ],
  viewer: [
    Permission.ViewEntity,
    Permission.ViewAccounts,
    Permission.ViewTransactions,
    Permission.ViewReports,
    Permission.ViewProperties,
    Permission.ViewTenants,
  ]
};

/**
 * User session, including property context and recents.
 */
export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: number;
  expiresAt: number;
  data?: {
    ip?: string;
    userAgent?: string;
    lastActivityAt?: number;
    currentEntityId?: string;
    isMfaVerified?: boolean;
    /** Current property ID if viewing property-specific data */
    currentPropertyId?: string;
    /** List of recently accessed entities for quick switching */
    recentEntities?: Array<{
      id: string;
      name: string;
      type: 'entity' | 'property';
    }>;
    /** User's preferred view (e.g., for property managers) */
    preferredView?: 'portfolio' | 'property' | 'financial';
    [key: string]: any;
  };
}

/**
 * User account definition.
 */
export interface User {
  readonly id: string;
  email: string;
  name?: string | null;
  hashedPassword?: string;
  role: UserRole;
  readonly createdAt: number;
  updatedAt: number;
  emailVerifiedAt?: number | null;
  imageUrl?: string | null;
  flags?: {
    forcePasswordChange?: boolean;
    onboardingComplete?: boolean;
    isLocked?: boolean;
    isMfaEnabled?: boolean;
    [key: string]: boolean | undefined;
  };
  lastLoginAt?: number | null;
  lastLoginIp?: string | null;
}

/**
 * User's access to a given entity.
 */
export interface EntityAccess {
  id?: string;
  entityId: string;
  userId: string;
  role: UserRole;
  permissions: Permission[];
  readonly grantedAt: number;
  updatedAt: number;
  grantedByUserId: string;
}

/**
 * Third-party auth provider account.
 */
export interface AuthProviderAccount {
  readonly provider: string;
  readonly providerUserId: string;
  readonly userId: string;
  readonly createdAt: number;
  updatedAt: number;
  providerData?: Record<string, any>;
}

/**
 * Verification token for password reset, etc.
 */
export interface VerificationToken {
  readonly identifier: string;
  readonly token: string;
  readonly expiresAt: number;
  readonly createdAt: number;
  readonly type: string;
  usedAt?: number | null;
}

/**
 * Activity/audit log entry with resource and action type.
 */
export interface ActivityLog {
  readonly id: string;
  readonly userId?: string | null;
  readonly entityId?: string | null;
  readonly action: ActivityAction | string;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly metadata?: Record<string, any> | null;
  readonly createdAt: number;
  readonly status?: 'SUCCESS' | 'FAILURE' | 'ATTEMPT';
  readonly resourceType?: ResourceType | string;
  readonly resourceId?: string | null;
}

/**
 * Multi-factor authentication configuration.
 */
export interface MfaConfiguration {
  readonly userId: string;
  type: 'totp' | 'sms' | 'email_otp' | 'backup_code';
  secret?: string;
  phoneNumber?: string;
  isEnabled: boolean;
  readonly createdAt: number;
  updatedAt: number;
  lastUsedAt?: number | null;
  label?: string;
}

/**
 * Password update/reset request structure.
 */
export interface PasswordUpdateRequest {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
  resetToken?: string;
}

/**
 * Entity invitation for access sharing.
 */
export interface EntityInvitation {
  readonly id: string;
  email: string;
  entityId: string;
  role: UserRole;
  permissions?: Permission[];
  readonly invitedByUserId: string;
  readonly createdAt: number;
  expiresAt: number;
  message?: string | null;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  acceptedAt?: number | null;
  acceptedByUserId?: string | null;
}
