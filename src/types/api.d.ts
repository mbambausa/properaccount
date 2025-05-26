// src/types/api.d.ts
/**
 * Defines standard structures for API requests, responses,
 * Data Transfer Objects (DTOs), and error handling.
 */

import type { User } from './auth'; // Assuming User type is defined in auth.d.ts
import type { CloudflareEnv } from '../env'; // For CloudflareWorkerApiHandler
import type { RealEstateEntityType, EntityType as CoreEntityType } from './entity'; // For property DTO consistency
import type { AccountSystemType } from './accounting';
import type { TransactionStatus, TransactionType } from './transaction';
import type { ReportPeriod, ReportTimeFrame } from './report'; // For ReportRequest

/**
 * Standard API error codes for consistent error handling.
 */
export enum ApiErrorCode {
  // General/auth
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  MFA_REQUIRED = 'MFA_REQUIRED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT', // e.g., version mismatch, concurrent update

  // Business logic
  UNBALANCED_TRANSACTION = 'UNBALANCED_TRANSACTION',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  ENTITY_INACTIVE = 'ENTITY_INACTIVE',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',

  // Rate limiting / Quota
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Server / System
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // File/Document
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  OCR_FAILED = 'OCR_FAILED',

  // Other
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',

  // === Real Estate Specific ===
  PROPERTY_OCCUPIED = 'PROPERTY_OCCUPIED',
  PROPERTY_NOT_FOUND = 'PROPERTY_NOT_FOUND',
  UNIT_NOT_FOUND = 'UNIT_NOT_FOUND',
  LEASE_ACTIVE = 'LEASE_ACTIVE',
  LEASE_NOT_FOUND = 'LEASE_NOT_FOUND',
  INVALID_LEASE_DATES = 'INVALID_LEASE_DATES',
  RENT_ALREADY_COLLECTED = 'RENT_ALREADY_COLLECTED',
  DEPOSIT_EXCEEDS_LIMIT = 'DEPOSIT_EXCEEDS_LIMIT',
  UNIT_NOT_AVAILABLE = 'UNIT_NOT_AVAILABLE',
  MAINTENANCE_IN_PROGRESS = 'MAINTENANCE_IN_PROGRESS',
  WORK_ORDER_NOT_FOUND = 'WORK_ORDER_NOT_FOUND',
  TENANT_HAS_BALANCE = 'TENANT_HAS_BALANCE',
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
}

/**
 * Standard API response structure for successful operations.
 * @template T The type of the data payload.
 */
export interface ApiResponseSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string; // Optional success message
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasMore: boolean;
  };
  redirectUrl?: string; // For guiding client-side navigation after an action
  meta?: Record<string, any>; // For additional metadata
}

/**
 * Standard API response structure for failed operations.
 * @template D The type of the error details (e.g., validation errors).
 */
export interface ApiResponseError<D = unknown> {
  success: false;
  error: {
    message: string; // User-friendly error message
    code: ApiErrorCode | string; // Standardized error code
    details?: D; // Specific error details, e.g., field validation errors
    statusCode: number; // HTTP status code
    timestamp?: string; // ISO 8601 timestamp of when the error occurred
    path?: string; // API path that caused the error
    requestId?: string; // Unique ID for tracing the request
  };
}

// Enhanced error detail types
export interface FieldError {
  field: string; // Path to the field, e.g., "address.street"
  code: string; // Specific validation code for the field, e.g., "TOO_SHORT"
  message: string; // User-friendly message for this specific field error
  params?: Record<string, any>; // Parameters for the error message, e.g., { minLength: 5 }
}

export interface BusinessRuleViolation {
  rule: string; // Identifier of the business rule violated
  severity: 'error' | 'warning'; // Severity of the violation
  message: string; // Description of the violation
  affectedEntities?: Array<{ type: string; id: string }>; // Entities affected by this violation
  suggestedAction?: string; // What the user might do to resolve it
}

// Union type for validation error details
export type ValidationErrors = Record<string, string[]> | Array<{ path: (string | number)[]; message: string }> | FieldError[];

/**
 * General API response type, can be either success or error.
 * @template T The type of the data payload for successful responses.
 * @template D The type of the error details for failed responses.
 */
export type ApiResponse<T = unknown, D = ValidationErrors> = ApiResponseSuccess<T> | ApiResponseError<D>;

/** Query parameters for pagination. */
export interface PaginationQuery {
  page?: number;    // 1-indexed page number
  limit?: number;   // Number of items per page
  sortBy?: string;  // Field to sort by
  sortOrder?: 'asc' | 'desc';
  cursor?: string;  // For cursor-based pagination
}

/** Path parameters typically including an ID. */
export interface IdPathParams { id: string; }

/** Generic type for update request bodies (partial data). */
export type UpdateRequestBody<T> = Partial<T>;

/** Represents an action in an optimistic UI update queue. */
export interface OptimisticAction<TVariables = unknown, TData = unknown> {
  readonly id: string; // Unique ID for the optimistic action
  type: string;      // Action type identifier, e.g., "CREATE_TRANSACTION"
  variables: TVariables; // Input variables for the action
  timestamp: number; // Unix timestamp (ms) when action was initiated
  status: 'pending' | 'success' | 'error'; // Current status
  optimisticId?: string; // Temporary client-side ID for the created/updated resource
  error?: string; // Error message if status is 'error'
  responseData?: TData; // Actual response data if status is 'success'
}

// --- Handler Type Utilities ---

/** Generic type for an API handler function. */
export type ApiHandler<RequestType = unknown, ResponseType = unknown, ErrorType = ValidationErrors> =
  (request: RequestType) => Promise<ApiResponse<ResponseType, ErrorType>>;

/** Type for an Astro API endpoint handler. */
export type AstroApiHandler<
  Params = Record<string, string | undefined>, // Route parameters
  ReqB = unknown // Request body type
> = (
  context: import('astro').APIContext<Record<string, any>, ReqB extends void ? void : ReqB, Params>
) => Promise<Response>; // Astro handlers return a Response object

/** Type for a Cloudflare Worker API handler. */
export type CloudflareWorkerApiHandler = (
  request: Request,
  env: CloudflareEnv,
  ctx: import('@cloudflare/workers-types').ExecutionContext
) => Promise<Response>; // Cloudflare Workers also return a Response object

/**
 * Utility object for building standardized API responses.
 */
export const ApiResponseBuilder = {
  /** Creates a success response. */
  success<T>(data: T, message?: string, pagination?: ApiResponseSuccess<T>['pagination'], meta?: Record<string,any>): ApiResponseSuccess<T> {
    return {
      success: true,
      data,
      ...(message && { message }),
      ...(pagination && { pagination }),
      ...(meta && { meta }),
    };
  },

  /** Creates a generic error response. */
  error(code: ApiErrorCode | string, message: string, statusCode: number, details?: unknown, path?: string, requestId?: string): ApiResponseError {
    return {
      success: false,
      error: {
        code,
        message,
        statusCode,
        ...(details && { details }),
        timestamp: new Date().toISOString(),
        ...(path && { path }),
        ...(requestId && { requestId }),
      },
    };
  },

  /** Creates a validation error response. */
  validationError(errors: ValidationErrors, path?: string, requestId?: string): ApiResponseError<ValidationErrors> {
    return {
      success: false,
      error: {
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Validation failed. Please check the provided data.',
        statusCode: 400, // Bad Request
        details: errors,
        timestamp: new Date().toISOString(),
        ...(path && { path }),
        ...(requestId && { requestId }),
      },
    };
  },
  
  /** Creates a business rule violation error response. */
  businessRuleError(violations: BusinessRuleViolation[], message = 'Operation violates business rules.', path?: string, requestId?: string): ApiResponseError<BusinessRuleViolation[]> {
    return {
      success: false,
      error: {
        code: ApiErrorCode.CONFLICT, // Or a more specific business rule error code
        message,
        statusCode: 409, // Conflict
        details: violations,
        timestamp: new Date().toISOString(),
        ...(path && { path }),
        ...(requestId && { requestId }),
      },
    };
  },

  /** Creates a "Not Found" error response. */
  notFound(resourceName: string, resourceId?: string, path?: string, requestId?: string): ApiResponseError {
    const message = resourceId
      ? `${resourceName} with ID '${resourceId}' not found.`
      : `${resourceName} not found.`;
    return {
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message,
        statusCode: 404,
        timestamp: new Date().toISOString(),
        ...(path && { path }),
        ...(requestId && { requestId }),
      },
    };
  },

  /** Creates an "Unauthorized" error response. */
  unauthorized(message = 'Authentication required.', path?: string, requestId?: string): ApiResponseError {
    return ApiResponseBuilder.error(ApiErrorCode.UNAUTHORIZED, message, 401, undefined, path, requestId);
  },

  /** Creates a "Forbidden" error response. */
  forbidden(message = 'You do not have permission to perform this action.', path?: string, requestId?: string): ApiResponseError {
    return ApiResponseBuilder.error(ApiErrorCode.FORBIDDEN, message, 403, undefined, path, requestId);
  },

   /** Creates an "Internal Server Error" response. */
  internalError(message = 'An unexpected internal server error occurred.', path?: string, requestId?: string, details?: unknown): ApiResponseError {
    return ApiResponseBuilder.error(ApiErrorCode.INTERNAL_ERROR, message, 500, details, path, requestId);
  }
};

/* ========== Real Estate Specific DTOs ========== */

// Property Management DTOs
export interface PropertyDto {
  id: string; // UUID
  entityId: string; // UUID of the owning/managing entity
  name: string;
  address: string; // Full address string, consider structured address type if needed
  propertyType: RealEstateEntityType; // Using the more detailed type from entity.d.ts
  units?: UnitDto[];
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number; // Calculated: occupiedUnits / totalUnits
  monthlyPotentialRent: number; // Sum of rent for all units if 100% occupied
  monthlyActualRent?: number; // Actual collected/billed rent for current period
  yearBuilt?: number;
  squareFootage?: number; // Total square footage for the property
  isActive: boolean;
  createdAt: number; // Unix timestamp (seconds)
  updatedAt: number; // Unix timestamp (seconds)
  imageUrl?: string; // URL to a primary image of the property
}

export interface UnitDto {
  id: string; // UUID
  propertyId: string; // UUID
  unitNumber: string; // e.g., "Apt 101", "Suite 200"
  bedrooms?: number;
  bathrooms?: number; // e.g., 1, 1.5, 2
  squareFootage?: number;
  monthlyRent: number; // Current market or actual rent for this unit
  status: 'available' | 'occupied' | 'maintenance' | 'reserved' | 'notice_given';
  currentTenantId?: string | null; // UUID
  currentLeaseId?: string | null; // UUID
  amenities?: string[]; // e.g., ["balcony", "laundry_in_unit"]
  lastMaintenanceDate?: string; // ISO Date string
}

// Tenant & Lease DTOs
export interface TenantDto {
  id: string; // UUID
  entityId?: string; // If tenant is also an entity, or for B2B tenants
  name: string;
  email: string;
  phone?: string | null;
  // currentLeases: LeaseDto[]; // Might be too much data for a simple DTO, consider linking via ID
  activeLeaseCount: number;
  paymentHistorySummary?: {
    onTimePayments: number;
    latePayments: number;
    lastPaymentDate?: string; // ISO Date string
  };
  accountBalance: number; // Current balance (positive if tenant owes, negative if credit)
  createdAt: number; // Unix timestamp (seconds)
  contactPreference?: 'email' | 'phone' | 'sms';
}

export interface LeaseDto {
  id: string; // UUID
  propertyId: string; // UUID
  unitId: string; // UUID
  tenantIds: string[]; // Array of tenant UUIDs associated with this lease
  startDate: string; // ISO Date string (YYYY-MM-DD)
  endDate: string; // ISO Date string (YYYY-MM-DD)
  moveInDate?: string; // ISO Date string
  moveOutDate?: string; // ISO Date string
  monthlyRent: number;
  securityDeposit: number;
  status: 'draft' | 'active' | 'expired' | 'terminated' | 'pending_renewal' | 'holdover';
  autoRenew: boolean;
  renewalTerms?: string; // Description of renewal terms
  terms?: Record<string, any>; // For custom lease terms (e.g., pet policy, parking)
  documentIds?: string[]; // IDs of associated lease documents in R2
}

// Rent & Payment DTOs
export interface RentChargeDto { // Renamed from RentDto for clarity, represents a charge
  id: string; // UUID
  leaseId: string; // UUID
  chargeType: 'rent' | 'late_fee' | 'utility' | 'other_charge';
  description?: string; // e.g., "March Rent", "Late Fee for Feb"
  dueDate: string; // ISO Date string (YYYY-MM-DD)
  amountDue: number;
  amountPaid: number;
  balanceRemaining: number; // amountDue - amountPaid
  status: 'pending' | 'paid' | 'partially_paid' | 'late' | 'waived';
  paidDate?: string | null; // ISO Date string
  relatedPaymentIds?: string[]; // IDs of payments applied to this charge
}

export interface PaymentDto {
  id: string; // UUID
  tenantId?: string | null; // UUID, if from a specific tenant
  leaseId?: string | null; // UUID, if applicable to a lease
  entityId?: string | null; // Entity making/receiving payment if not tenant (e.g., owner contribution)
  amount: number;
  paymentDate: string; // ISO Date string (YYYY-MM-DD)
  paymentMethod: 'cash' | 'check' | 'ach_transfer' | 'credit_card' | 'online_portal' | 'other';
  type: 'rent' | 'security_deposit' | 'application_fee' | 'late_fee' | 'utility_reimbursement' | 'owner_contribution' | 'vendor_payment' | 'other';
  reference?: string | null; // e.g., Check number, transaction ID
  notes?: string | null;
  appliedToChargeIds?: string[]; // IDs of RentChargeDto this payment is applied to
}

/* ========== Property/Lease/Rent API Requests (Examples) ========== */

export interface CreatePropertyRequest {
  name: string;
  address: string; // Consider structured address object for more detail
  propertyType: RealEstateEntityType;
  yearBuilt?: number;
  purchasePrice?: number; // Optional at creation
  units?: Array<{
    unitNumber: string;
    bedrooms?: number;
    bathrooms?: number;
    squareFootage?: number;
    monthlyRent: number; // Initial market/asking rent
  }>;
  entityId: string; // Owning entity ID
}
export interface PropertySearchRequest extends PaginationQuery {
  propertyType?: RealEstateEntityType;
  minRent?: number;
  maxRent?: number;
  locationQuery?: string; // For searching city, state, zip
  hasVacancy?: boolean;
  entityId?: string; // Filter by owning entity
}

export interface CreateLeaseRequest {
  propertyId: string;
  unitId: string;
  tenantIds: string[]; // Support multiple tenants on one lease
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  monthlyRent: number;
  securityDeposit: number;
  applicationFee?: number;
  moveInDate?: string; // YYYY-MM-DD
  terms?: Record<string, any>;
}

export interface RecordPaymentRequest { // Renamed from CollectRentRequest for generality
  amount: number;
  paymentDate: string; // YYYY-MM-DD
  paymentMethod: PaymentDto['paymentMethod'];
  type: PaymentDto['type'];
  tenantId?: string | null;
  leaseId?: string | null;
  entityId?: string | null; // If payment is from/to a general entity
  reference?: string | null;
  notes?: string | null;
  applyToChargeIds?: string[]; // Optional: specific charges this payment covers
}

/* ========== Maintenance DTOs ========== */

export interface WorkOrderDto {
  id: string; // UUID
  propertyId: string; // UUID
  unitId?: string | null; // UUID
  description: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'structural' | 'cosmetic' | 'landscaping' | 'other';
  priority: 'low' | 'medium' | 'high' | 'emergency';
  status: 'open' | 'pending_assignment' | 'assigned' | 'in_progress' | 'on_hold' | 'pending_parts' | 'completed' | 'cancelled' | 'requires_follow_up';
  reportedByTenantId?: string | null; // UUID
  reportedByUserId?: string | null; // UUID (e.g., staff)
  assignedToVendorId?: string | null; // UUID
  assignedToUserId?: string | null; // UUID (e.g., internal staff)
  permissionToEnter?: 'yes' | 'no' | 'call_first';
  estimatedCost?: number;
  actualCost?: number;
  invoiceId?: string | null; // Link to vendor invoice
  createdAt: number; // Unix timestamp (seconds)
  updatedAt: number; // Unix timestamp (seconds)
  scheduledDate?: string | null; // ISO Date string
  completedAt?: number | null; // Unix timestamp (seconds)
  images?: Array<{ url: string; caption?: string }>;
  notes?: Array<{ userId: string; note: string; timestamp: number }>;
}

export interface CreateWorkOrderRequest {
  propertyId: string;
  unitId?: string | null;
  description: string;
  category: WorkOrderDto['category'];
  priority: WorkOrderDto['priority'];
  reportedByTenantId?: string | null;
  permissionToEnter?: WorkOrderDto['permissionToEnter'];
  assignedToVendorId?: string | null;
  assignedToUserId?: string | null;
  estimatedCost?: number;
  images?: Array<{ url: string; caption?: string }>; // URLs to pre-uploaded images
}

/* ========== Real Estate Report Request Types ========== */

export interface ReportRequest {
  entityId: string; // The primary entity for which the report is generated
  type:
    | 'balance-sheet'
    | 'income-statement' // Profit & Loss
    | 'cash-flow'
    | 'rent-roll'
    | 'vacancy-report'
    | 'tenant-aging-summary'
    | 'property-performance-summary'
    | 'maintenance-summary'
    | 'lease-expiration-report'
    | 'owner-statement' // For property owners
    | 'custom'; // If custom report builder is used
  timeFrame: ReportTimeFrame; // Defined in report.d.ts, assuming consistency
  // Specific filters for real estate reports
  propertyIds?: string[]; // Filter by specific properties
  unitIds?: string[];     // Filter by specific units
  tenantIds?: string[];   // Filter by specific tenants
  leaseStatus?: LeaseDto['status'][]; // Filter by lease status
  groupBy?: 'property' | 'unit' | 'tenant' | 'month' | 'quarter'; // Aggregation level
  formatOptions?: Record<string, any>; // e.g., { includeComparisons: true, currency: 'CAD' }
  customReportId?: string; // If type is 'custom'
  filters?: Record<string, unknown>; // Additional dynamic filters
}

// Example: Rent Roll Report Data DTO (actual report structure in report.d.ts)
export interface RentRollReportData { // This is an example of DATA that might be in ApiResponseSuccess<T>
  properties: Array<{
    propertyId: string;
    propertyName: string;
    units: Array<{
      unitNumber: string;
      tenantName?: string | null; // May be vacant
      leaseId?: string | null;
      leaseStartDate?: string | null; // ISO Date
      leaseEndDate?: string | null;   // ISO Date
      monthlyRent?: number | null;
      securityDeposit?: number | null;
      status: UnitDto['status'];
      sqFt?: number;
      beds?: number;
      baths?: number;
    }>;
    summary: {
      totalUnits: number;
      occupiedUnits: number;
      vacantUnits: number;
      occupancyRate: number; // percentage
      totalScheduledRent: number;
      totalMarketRent?: number; // Potential rent
    };
  }>;
  reportSummary: {
    totalProperties: number;
    totalUnits: number;
    totalOccupiedUnits: number;
    overallOccupancyRate: number;
    totalScheduledIncome: number;
    reportDate: string; // ISO Date
  };
}

/* ========== Bulk Operation Types (Generic, can be specialized) ========== */

export interface BulkOperationItem<TInput, TExisting = undefined> {
  id?: string; // For updates/deletes, or client-generated ID for creates
  operationType: 'create' | 'update' | 'delete';
  data: TInput; // Payload for create/update
  /** If updating, this could be the version or lastUpdatedAt for optimistic concurrency control */
  optimisticLockVersion?: TExisting extends { updatedAt: number } ? number : string | number;
}
export interface BulkOperationRequest<TInput, TExisting = undefined> {
  entityId?: string; // Optional context
  operations: Array<BulkOperationItem<TInput, TExisting>>;
}

export interface BulkOperationResponseItem<TResult = unknown> {
  id?: string; // ID of the processed item (original or new)
  clientOptimisticId?: string; // If client provided one
  success: boolean;
  result?: TResult; // Result data for successful operation
  error?: { code: ApiErrorCode | string; message: string; details?: any }; // Error details for failed operation
}
export interface BulkOperationResponse<TResult = unknown> {
  results: Array<BulkOperationResponseItem<TResult>>;
  summary: {
    totalRequested: number;
    totalSucceeded: number;
    totalFailed: number;
  };
}

/* ========== Standard Auth/User API DTOs (as in your project plan) ========== */

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  mfaToken?: string; // For MFA step
}

// User type should come from './auth'
export interface LoginResponseData {
  user: User;
  sessionId: string; // Or a token if using JWT sessions primarily
  expiresAt: number; // Unix timestamp (seconds) for session/token expiry
  mfaRequired?: boolean; // If MFA is required as a next step
  redirectUrl?: string; // e.g., to onboarding or dashboard
}
export type LoginResponse = ApiResponseSuccess<LoginResponseData>;


export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  // companyName?: string; // If registering an initial entity
}
export interface RegisterResponseData {
  user: User;
  requiresEmailVerification: boolean;
}
export type RegisterResponse = ApiResponseSuccess<RegisterResponseData>;


export interface ForgotPasswordRequest {
  email: string;
}
// No data needed for success, just a message.
export type ForgotPasswordResponse = ApiResponseSuccess<null>;


export interface ResetPasswordRequest {
  token: string; // Password reset token from email
  password: string;
  confirmPassword: string;
}
export type ResetPasswordResponse = ApiResponseSuccess<null>;


export interface UpdateProfileRequest {
  name?: string;
  email?: string; // May require re-verification
  currentPassword?: string; // Required if changing email or password
  newPassword?: string;
  confirmNewPassword?: string;
  // preferences?: UserPreferencesDto;
}
export type UpdateProfileResponse = ApiResponseSuccess<User>; // Return updated user

/* ========== General DTOs for Entities, Accounts, Transactions (as in your project plan) ========== */

export interface EntityDto {
  id: string;
  name: string;
  type: CoreEntityType; // From entity.d.ts
  legalName?: string | null;
  ein?: string | null;
  isActive: boolean;
  parentId?: string | null;
  createdAt: number; // Unix timestamp (seconds)
  updatedAt: number; // Unix timestamp (seconds)
  metadata?: Record<string, unknown>; // For custom fields or additional info
  // Add more fields like address, businessType as needed from entity.d.ts Entity
}

export interface TransactionLineDto { // Renamed for clarity vs. internal TransactionLine
  id: string; // UUID
  accountId: string; // UUID of the ChartOfAccount entry
  accountCode: string;
  accountName: string;
  amount: number; // Positive value
  isDebit: boolean;
  memo?: string | null;
  propertyId?: string | null; // Link to property if line item is property-specific
}
export interface TransactionDto {
  id: string; // UUID
  entityId: string; // UUID
  description: string;
  date: string; // ISO Date string (YYYY-MM-DD) for API, convert to/from timestamp internally
  status: TransactionStatus; // From transaction.d.ts
  transactionType?: TransactionType; // From transaction.d.ts
  reference?: string | null;
  lines: TransactionLineDto[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  isReconciled: boolean;
  documentId?: string | null; // Link to supporting document
  createdAt: number; // Unix timestamp (seconds)
  updatedAt: number; // Unix timestamp (seconds)
}

export interface AccountDto { // ChartOfAccount DTO for API
  id: string; // UUID
  entityId?: string; // Optional if displaying a global CoA template vs entity-specific
  code: string;
  name: string;
  type: AccountSystemType; // From accounting.d.ts
  subtype?: string | null; // Matches ChartOfAccount.subtype from accounting.d.ts
  balance?: number; // Current balance, often calculated
  isActive: boolean;
  parentId?: string | null;
  description?: string | null;
  isSystemAccount?: boolean; // Indicates if it's a non-deletable system account
  createdAt: number; // Unix timestamp (seconds)
  updatedAt: number; // Unix timestamp (seconds)
}

// Report Data DTO - used if a report is fetched as data rather than a generated file
export interface ReportDataDto {
  id: string; // Report instance ID or definition ID
  entityId?: string;
  type: ReportRequest['type']; // Matches report request type
  title: string;
  data: unknown; // The actual report data, structure depends on report type
  generatedAt: number; // Unix timestamp (seconds)
  period?: string; // e.g., "Q1 2025"
  startDate?: string; // ISO Date
  endDate?: string;   // ISO Date
}