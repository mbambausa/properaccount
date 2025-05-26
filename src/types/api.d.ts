// src/types/api.d.ts
import type { User } from './auth';
import type { CloudflareEnv } from '../env';

/**
 * Standard API error codes for consistent error handling
 */
export enum ApiErrorCode {
  // General/auth
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Business logic
  UNBALANCED_TRANSACTION = 'UNBALANCED_TRANSACTION',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  ACCOUNT_INACTIVE = 'ACCOUNT_INACTIVE',
  ENTITY_INACTIVE = 'ENTITY_INACTIVE',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // File/Document
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',

  // Other
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',

  // === Real Estate Specific ===
  PROPERTY_OCCUPIED = 'PROPERTY_OCCUPIED',
  LEASE_ACTIVE = 'LEASE_ACTIVE',
  INVALID_LEASE_DATES = 'INVALID_LEASE_DATES',
  RENT_ALREADY_COLLECTED = 'RENT_ALREADY_COLLECTED',
  DEPOSIT_EXCEEDS_LIMIT = 'DEPOSIT_EXCEEDS_LIMIT',
  UNIT_NOT_AVAILABLE = 'UNIT_NOT_AVAILABLE',
  MAINTENANCE_IN_PROGRESS = 'MAINTENANCE_IN_PROGRESS',
  TENANT_HAS_BALANCE = 'TENANT_HAS_BALANCE',
}

/**
 * Standard API response for success
 */
export interface ApiResponseSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasMore: boolean;
  };
  redirectUrl?: string;
}

/**
 * Standard API response for error
 */
export interface ApiResponseError<D = unknown> {
  success: false;
  error: {
    message: string;
    code: ApiErrorCode;
    details?: D;
    statusCode: number;
    timestamp?: string;
    path?: string;
    requestId?: string;
  };
}

// Enhanced error types
export interface FieldError {
  field: string;
  code: string;
  message: string;
  params?: Record<string, any>;
}

export interface BusinessRuleViolation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  affectedEntities?: string[];
  suggestedAction?: string;
}

export type ValidationErrors = Record<string, string[]> | Array<{ path: (string | number)[]; message: string }> | FieldError[];
export type ApiResponse<T = unknown, D = ValidationErrors> = ApiResponseSuccess<T> | ApiResponseError<D>;

/**
 * Pagination, path, and generic update types
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
export interface IdPathParams { id: string; }
export type UpdateRequestBody<T> = Partial<T>;

/**
 * Optimistic UI mutation utility
 */
export interface OptimisticAction<TVariables = unknown, TData = unknown> {
  id: string;
  type: string;
  variables: TVariables;
  timestamp: number;
  status: 'pending' | 'success' | 'error';
  optimisticId?: string;
  error?: string;
  responseData?: TData;
}

/**
 * Handler type utilities
 */
export type ApiHandler<RequestType = unknown, ResponseType = unknown, ErrorType = ValidationErrors> =
  (request: RequestType) => Promise<ApiResponse<ResponseType, ErrorType>>;
export type AstroApiHandler<Params = Record<string, string | undefined>, ReqB = unknown> =
  (context: import('astro').APIContext<Record<string, any>, ReqB extends void ? void : ReqB, Params>) => Promise<Response>;
export type CloudflareWorkerApiHandler =
  (request: Request, env: CloudflareEnv, ctx: import('@cloudflare/workers-types').ExecutionContext) => Promise<Response>;

/**
 * Enhanced API response builder
 */
export const ApiResponseBuilder = {
  success<T>(data: T, message?: string, pagination?: ApiResponseSuccess<T>['pagination']): ApiResponseSuccess<T> {
    return { 
      success: true, 
      data, 
      ...(message && { message }),
      ...(pagination && { pagination })
    };
  },
  
  error(code: ApiErrorCode, message: string, statusCode: number, details?: unknown): ApiResponseError {
    return {
      success: false,
      error: {
        code,
        message,
        statusCode,
        ...(details && { details }),
        timestamp: new Date().toISOString(),
      },
    };
  },
  
  validationError(errors: ValidationErrors): ApiResponseError<ValidationErrors> {
    return {
      success: false,
      error: {
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        statusCode: 400,
        details: errors,
        timestamp: new Date().toISOString(),
      },
    };
  },
  
  businessRuleError(violations: BusinessRuleViolation[]): ApiResponseError<BusinessRuleViolation[]> {
    return {
      success: false,
      error: {
        code: ApiErrorCode.CONFLICT,
        message: 'Business rule violation',
        statusCode: 409,
        details: violations,
        timestamp: new Date().toISOString(),
      },
    };
  },
  
  notFound(resource: string, id?: string): ApiResponseError {
    return {
      success: false,
      error: {
        code: ApiErrorCode.NOT_FOUND,
        message: id ? `${resource} with id ${id} not found` : `${resource} not found`,
        statusCode: 404,
        timestamp: new Date().toISOString(),
      },
    };
  }
};

/* ========== Real Estate DTOs ========== */

// Property Management DTOs
export interface PropertyDto {
  id: string;
  entityId: string;
  name: string;
  address: string;
  propertyType: 'residential' | 'commercial' | 'mixed' | 'land';
  units?: UnitDto[];
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  monthlyRentalIncome: number;
  yearBuilt?: number;
  squareFootage?: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UnitDto {
  id: string;
  propertyId: string;
  unitNumber: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  monthlyRent: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  currentTenantId?: string;
  currentLeaseId?: string;
}

// Tenant & Lease DTOs
export interface TenantDto {
  id: string;
  name: string;
  email: string;
  phone?: string;
  currentLeases: LeaseDto[];
  paymentHistory?: PaymentDto[];
  balance: number;
  createdAt: number;
}

export interface LeaseDto {
  id: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  status: 'draft' | 'active' | 'expired' | 'terminated';
  autoRenew: boolean;
  terms?: Record<string, any>;
}

// Rent & Payment DTOs
export interface RentDto {
  id: string;
  leaseId: string;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid' | 'late' | 'partial';
  paidDate?: string;
  paidAmount?: number;
  lateFee?: number;
}

export interface PaymentDto {
  id: string;
  tenantId: string;
  leaseId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'check' | 'transfer' | 'online';
  type: 'rent' | 'deposit' | 'late_fee' | 'other';
  reference?: string;
}

/* ========== Property/Lease/Rent API Requests ========== */

// Property Management
export interface CreatePropertyRequest {
  name: string;
  address: string;
  propertyType: 'residential' | 'commercial' | 'mixed' | 'land';
  yearBuilt?: number;
  purchasePrice?: number;
  units?: Array<{
    unitNumber: string;
    bedrooms?: number;
    bathrooms?: number;
    squareFootage?: number;
    monthlyRent: number;
  }>;
}
export interface PropertySearchRequest extends PaginationQuery {
  propertyType?: string;
  minRent?: number;
  maxRent?: number;
  location?: string;
  hasVacancy?: boolean;
}

// Lease Management
export interface CreateLeaseRequest {
  propertyId: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  terms?: Record<string, any>;
}

// Rent Collection
export interface CollectRentRequest {
  leaseId: string;
  amount: number;
  paymentMethod: 'cash' | 'check' | 'transfer' | 'online';
  paymentDate?: string;
  reference?: string;
}

/* ========== Maintenance DTOs ========== */

export interface WorkOrderDto {
  id: string;
  propertyId: string;
  unitId?: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  reportedBy: string;
  assignedTo?: string;
  estimatedCost?: number;
  actualCost?: number;
  createdAt: number;
  completedAt?: number;
}

export interface CreateWorkOrderRequest {
  propertyId: string;
  unitId?: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  assignedTo?: string;
  estimatedCost?: number;
}

/* ========== Real Estate Report Types ========== */

export interface ReportRequest {
  entityId: string;
  type: 'balance-sheet' | 'income-statement' | 'cash-flow'
    | 'rent-roll' | 'vacancy' | 'tenant-aging' | 'property-performance' | 'custom';
  startDate?: string;
  endDate?: string;
  period?: 'monthly' | 'quarterly' | 'yearly';
  compareWithPrevious?: boolean;
  propertyIds?: string[];
  groupBy?: 'property' | 'unit' | 'tenant';
  filters?: Record<string, unknown>;
}

// Example: Rent Roll Report
export interface RentRollReport {
  properties: Array<{
    propertyId: string;
    propertyName: string;
    units: Array<{
      unitNumber: string;
      tenant: string;
      leaseStart: string;
      leaseEnd: string;
      monthlyRent: number;
      status: string;
    }>;
    totalUnits: number;
    occupiedUnits: number;
    totalMonthlyRent: number;
    occupancyRate: number;
  }>;
  summary: {
    totalProperties: number;
    totalUnits: number;
    totalOccupied: number;
    totalMonthlyIncome: number;
    averageOccupancy: number;
  };
}

/* ========== Bulk Operation Types ========== */

export interface BulkOperationRequest<T> {
  operations: Array<{
    data: T;
    operationType: 'create' | 'update' | 'delete';
  }>;
}

export interface BulkOperationResponse<T> {
  successful: Array<{ index: number; result: T; }>;
  failed: Array<{ index: number; error: ApiResponseError; }>;
  summary: { total: number; succeeded: number; failed: number; };
}

/* ========== Standard Auth/User API DTOs ========== */

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse extends ApiResponseSuccess<{ user: User; sessionId: string; expiresAt: number; }> {}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface RegisterResponse extends ApiResponseSuccess<{ user: User; requiresEmailVerification: boolean; }> {}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  currentPassword?: string;
}

/* ========== General DTOs for Entities, Accounts, Transactions ========== */

export interface EntityDto {
  id: string;
  name: string;
  type: string;
  ein?: string | null;
  isActive: boolean;
  parentId?: string | null;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface TransactionDto {
  id: string;
  entityId: string;
  description: string;
  date: string;
  status: 'pending' | 'posted' | 'voided';
  lines: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    amount: number;
    isDebit: boolean;
    memo?: string | null;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AccountDto {
  id: string;
  entityId: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  balance: number;
  isActive: boolean;
  parentId?: string | null;
  description?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ReportData {
  id: string;
  entityId: string;
  type: string;
  title: string;
  data: unknown;
  period?: string;
  startDate?: string;
  endDate?: string;
  createdAt: number;
}