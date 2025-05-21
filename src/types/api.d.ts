// src/types/api.d.ts
import type { User } from './auth';
import type { CloudflareEnv } from '../env'; // Import CloudflareEnv

/**
 * Standard success response structure for API endpoints.
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
    hasMore: boolean; // Indicates if there are more pages available
  };
  redirectUrl?: string; // Optional URL for client-side redirects
}

/**
 * Standard error response structure for API endpoints.
 */
export interface ApiResponseError<D = unknown> {
  success: false;
  error: {
    message: string;
    code?: string; // Application-specific error code
    details?: D; // Can be an object with field-specific errors or other info
    statusCode: number; // HTTP status code, useful for client-side handling
  };
}

/**
 * Common format for validation errors, mapping field names to error messages
 * or providing a Zod-like error array.
 */
export type ValidationErrors = Record<string, string[]> | Array<{ path: (string | number)[]; message: string }>;

/**
 * Union type for API responses.
 */
export type ApiResponse<T = unknown, D = ValidationErrors> = ApiResponseSuccess<T> | ApiResponseError<D>;

/**
 * Represents common query parameters for paginated API requests.
 */
export interface PaginationQuery {
  page?: number; // Requested page number
  limit?: number; // Number of items per page
  sortBy?: string; // Field to sort by
  sortOrder?: 'asc' | 'desc'; // Sort order
}

/**
 * Represents common path parameters for API requests that target a specific resource by ID.
 */
export interface IdPathParams {
  id: string; // Typically a UUID or database ID
}

/**
 * Generic type for request bodies that update an existing resource (PATCH).
 * Allows for partial updates.
 */
export type UpdateRequestBody<T> = Partial<T>;

/**
 * Type for actions that might have an optimistic UI update component.
 */
export interface OptimisticAction<TVariables = unknown, TData = unknown> {
  id: string; // Unique ID for the action
  type: string; // Type of action (e.g., 'CREATE_ENTITY', 'UPDATE_TRANSACTION')
  variables: TVariables; // Variables for the mutation
  timestamp: number; // Timestamp of when the action was initiated
  status: 'pending' | 'success' | 'error'; // Status of the action
  optimisticId?: string; // Temporary ID for UI element before server confirmation
  error?: string; // Error message if the action failed
  responseData?: TData; // Response data from the server
}

// Auth API types
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse extends ApiResponseSuccess<{ user: User; sessionId: string }> {}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface RegisterResponse extends ApiResponseSuccess<{ user: User }> {}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
}

// Entity types (Consider these as API DTOs, primary types in entity.d.ts)
export interface Entity {
  id: string;
  name: string;
  type?: string; // General type, could align with EntityType from entity.d.ts
  ownerId: string; // Might refer to user_id who has 'owner' role in EntityAccess
  parentId?: string;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  metadata?: Record<string, unknown>;
}

// Financial types (Consider these as API DTOs)
export interface Transaction {
  id: string;
  entityId: string;
  description: string;
  amount: number; // Assuming in cents or a specific decimal format handled by API
  date: string; // ISO date string
  type: 'income' | 'expense' | 'transfer'; // Simplified for API, actual types in transaction.d.ts
  categoryId?: string;
  accountId?: string;
  toAccountId?: string; // For transfers
  metadata?: Record<string, unknown>;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

export interface Account {
  id: string;
  entityId: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'; // Simplified, use AccountSystemType from accounting.d.ts
  balance: number; // Assuming in cents or a specific decimal format
  currency: string; // e.g., "USD"
  isActive: boolean;
  parentId?: string;
  description?: string;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
}

// Report types
export interface ReportRequest {
  entityId: string;
  type: 'balance-sheet' | 'income-statement' | 'cash-flow' | 'custom';
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  period?: 'monthly' | 'quarterly' | 'yearly';
  filters?: Record<string, unknown>;
}

export interface ReportData {
  id: string;
  entityId: string;
  type: string;
  title: string;
  data: unknown; // This should ideally be a more specific type based on report 'type'
  period?: string;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  createdAt: number; // Unix timestamp
}

/**
 * Handler type utilities for API implementation (generic for any backend)
 */
export type ApiHandler<RequestType = unknown, ResponseType = unknown, ErrorType = ValidationErrors> = (
  request: RequestType
) => Promise<ApiResponse<ResponseType, ErrorType>>;

/**
 * Handler type specific to Astro API endpoints (using AstroGlobal).
 * `context.request` is an Astro's augmented Request object.
 * `context.locals` contains `runtime.env` as CloudflareEnv.
 */
export type AstroApiHandler<Params = Record<string, string | undefined>, ReqB = unknown> = (
  context: import('astro').APIContext<Record<string, any>, ReqB extends void ? void : ReqB, Params>
) => Promise<Response>;

/**
 * Handler type specific to Cloudflare Workers (raw Request, not Astro's context).
 * Useful for utility workers or non-Astro endpoints if any.
 */
export type CloudflareWorkerApiHandler = (
  request: Request,
  env: CloudflareEnv, // Use the imported CloudflareEnv
  ctx: import('@cloudflare/workers-types').ExecutionContext
) => Promise<Response>;