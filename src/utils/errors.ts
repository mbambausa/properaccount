// src/utils/errors.ts

/**
 * Base class for custom application errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean; // Distinguishes operational errors from programmer errors
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    name?: string,
    code?: string,
  ) {
    super(message);
    this.name = name || this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Type for structured validation errors with field-specific error messages.
 */
export type ValidationErrorDetail = Record<string, string[]>;

/**
 * Error for invalid input or data validation failures.
 */
export class ValidationError extends AppError {
  public readonly errors?: ValidationErrorDetail;

  constructor(message: string = 'Invalid input provided.', errors?: ValidationErrorDetail) {
    super(message, 400, true, 'ValidationError', 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

/**
 * Error for authentication failures.
 */
export class AuthError extends AppError {
  constructor(message: string = 'Authentication failed.', code: string = 'AUTH_FAILED') {
    super(message, 401, true, 'AuthError', code);
  }
}

/**
 * Error for authorization failures (user is authenticated but lacks permission).
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'You do not have permission to perform this action.', code: string = 'FORBIDDEN') {
    super(message, 403, true, 'ForbiddenError', code);
  }
}

/**
 * Error for when a requested resource is not found.
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'The requested resource was not found.', code: string = 'NOT_FOUND') {
    super(message, 404, true, 'NotFoundError', code);
  }
}

/**
 * Error for conflicts, e.g., trying to create a resource that already exists.
 */
export class ConflictError extends AppError {
  constructor(message: string = 'A conflict occurred with the current state of the resource.', code: string = 'CONFLICT') {
    super(message, 409, true, 'ConflictError', code);
  }
}

/**
 * Error for issues with external service integrations.
 */
export class ServiceIntegrationError extends AppError {
  constructor(message: string = 'An error occurred while communicating with an external service.', code: string = 'SERVICE_ERROR') {
    super(message, 502, true, 'ServiceIntegrationError', code);
  }
}

/**
 * Interface defining the structure of API error responses.
 */
export interface ApiErrorResponse {
  error: {
    message: string;
    statusCode: number;
    code?: string;
    details?: unknown;
  };
}

/**
 * Generic API error utility to create a standardized JSON error response.
 */
export function createApiErrorResponse(
  message: string,
  statusCode: number,
  details?: unknown,
  code?: string,
): Response {
  const errorResponse: ApiErrorResponse = {
    error: {
      message,
      statusCode,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
    },
  };

  return new Response(
    JSON.stringify(errorResponse),
    {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

/**
 * Type guard to check if an error is an instance of AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Creates a standardized error response from an Error object.
 * Useful for centralized error handling in API routes.
 */
export function errorToResponse(error: unknown): Response {
  if (isAppError(error)) {
    return createApiErrorResponse(
      error.message,
      error.statusCode,
      error instanceof ValidationError ? { validationErrors: error.errors } : undefined,
      error.code
    );
  }
  
  // For unexpected errors, return a generic 500 response
  console.error('Unexpected error:', error);
  return createApiErrorResponse(
    'An unexpected error occurred.',
    500,
    undefined,
    'INTERNAL_ERROR'
  );
}