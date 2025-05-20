// src/utils/errors.ts

/**
 * Defines a set of standardized error codes for the application.
 * This helps in categorizing errors and handling them consistently.
 */
export enum ErrorCode {
  /** Indicates an error originating from database operations. */
  DATABASE_ERROR = 'database_error',
  /** Indicates that input data failed validation checks. */
  VALIDATION_ERROR = 'validation_error',
  /** Indicates an error during user authentication (e.g., invalid credentials). */
  AUTHENTICATION_ERROR = 'authentication_error',
  /** Indicates that an authenticated user does not have permission to perform an action. */
  AUTHORIZATION_ERROR = 'authorization_error',
  /** Indicates that a requested resource was not found. */
  NOT_FOUND = 'not_found',
  /** Indicates that the client sent an invalid request (e.g., malformed data). */
  BAD_REQUEST = 'bad_request',
  /** Indicates a generic or unexpected server-side error. */
  SERVER_ERROR = 'server_error',
  /** Indicates an error related to third-party API integrations. */
  EXTERNAL_API_ERROR = 'external_api_error',
  /** Indicates a configuration issue within the application. */
  CONFIGURATION_ERROR = 'configuration_error',
  /** Indicates that an operation timed out. */
  TIMEOUT_ERROR = 'timeout_error',
  /** Indicates a conflict, e.g., trying to create a resource that already exists. */
  CONFLICT_ERROR = 'conflict_error',
}

/**
 * Custom error class for application-specific errors.
 * Extends the built-in Error class to include an error code, HTTP status, and optional details.
 */
export class AppError extends Error {
  /** A specific error code from the ErrorCode enum. */
  public readonly code: ErrorCode;
  /** The HTTP status code appropriate for this error. */
  public readonly status: number;
  /** Optional additional details or context about the error (e.g., validation failures). */
  public readonly details?: any;

  /**
   * Creates an instance of AppError.
   * @param code - The error code from the ErrorCode enum.
   * @param message - A human-readable description of the error.
   * @param status - The HTTP status code (defaults to 500 if not specified).
   * @param details - Optional additional information about the error.
   */
  constructor(code: ErrorCode, message: string, status: number = 500, details?: any) {
    super(message); // Call the parent Error constructor
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = 'AppError'; // Set the error name for easier identification

    // This line is important for ensuring `instanceof AppError` works correctly
    // when targeting older JavaScript environments, though less critical with modern TS/JS.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * A utility function to handle unknown errors and ensure they are returned as AppError instances.
 * If the caught error is already an AppError, it's returned as is.
 * Otherwise, it's logged and wrapped in a generic SERVER_ERROR AppError.
 *
 * @param error - The error object caught in a try-catch block (typed as unknown for safety).
 * @returns An instance of AppError.
 */
export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    // If the error is already an AppError, return it directly.
    return error;
  }
  
  // Log the original unhandled error for debugging purposes.
  // In a production environment, you might send this to an error tracking service.
  console.error('Unhandled error occurred:', error);

  // For any other type of error, wrap it in a generic AppError.
  return new AppError(
    ErrorCode.SERVER_ERROR,
    'An unexpected error occurred on the server. Please try again later.', // User-friendly message
    500, // Default to 500 Internal Server Error
    // Optionally, include some non-sensitive details from the original error if helpful for debugging,
    // but be cautious about exposing sensitive information.
    (error instanceof Error) ? { originalError: error.message } : { originalError: String(error) }
  );
}
