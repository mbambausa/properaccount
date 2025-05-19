// src/types/api.d.ts
import type { User } from './auth';

/**
 * Standard API response format for all endpoints
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]> | Array<{ path: (string | number)[]; message: string }>;
  message?: string;
  status?: number;
  redirectUrl?: string;
}

// Auth API types
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse extends ApiResponse {
  user?: User;
  sessionId?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface RegisterResponse extends ApiResponse {
  user?: User;
}

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

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse {
  data?: T[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
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

// Handler type utilities
export type ApiHandler<RequestType = unknown, ResponseType = unknown> = (
  request: RequestType
) => Promise<ApiResponse<ResponseType>>;

export type CloudflareApiHandler = (context: {
  request: Request;
  env: Record<string, unknown>;
  cookies: any;
  cf?: Record<string, unknown>;
  params?: Record<string, string>;
}) => Promise<Response>;