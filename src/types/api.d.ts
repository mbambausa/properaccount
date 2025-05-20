// src/types/api.d.ts
import type { User } from './auth';

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
 * Common format for validation errors, mapping field names to error messages.
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

// Entity types
export interface Entity {
  id: string;
  name: string;
  type?: string;
  ownerId: string;
  parentId?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

// Financial types
export interface Transaction {
  id: string;
  entityId: string;
  description: string;
  amount: number;
  date: string;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string;
  accountId?: string;
  toAccountId?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Account {
  id: string;
  entityId: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  balance: number;
  currency: string;
  isActive: boolean;
  parentId?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

// Report types
export interface ReportRequest {
  entityId: string;
  type: 'balance-sheet' | 'income-statement' | 'cash-flow' | 'custom';
  startDate?: string;
  endDate?: string;
  period?: 'monthly' | 'quarterly' | 'yearly';
  filters?: Record<string, unknown>;
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

/**
 * Handler type utilities for API implementation
 */
export type ApiHandler<RequestType = unknown, ResponseType = unknown> = (
  request: RequestType
) => Promise<ApiResponse<ResponseType>>;

/**
 * Handler type specific to Cloudflare Workers environment
 */
export type CloudflareApiHandler = (context: {
  request: Request;
  env: Record<string, unknown>;
  cookies: any;
  cf?: Record<string, unknown>;
  params?: Record<string, string>;
}) => Promise<Response>;