// src/utils/api.ts
/**
 * API Client
 *
 * A lightweight client for making API requests.
 * Handles request formatting, error handling, and response parsing.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  /** * The main data payload. If the request was successful and the response was JSON,
   * this will be the parsed JSON data (or `responseData.data` if the JSON has a `data` property).
   * If successful but not JSON (e.g., plain text), this might be an object like `{ text: "..." }`.
   * If not successful, this might contain partial data from an error response if available.
   */
  data?: T;
  error?: string;
  /** Detailed validation errors, if provided by the API. */
  errors?: Record<string, string[]> | Array<{ path: (string | number)[]; message: string }>;
  message?: string;
  status: number;
  redirectUrl?: string;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  baseUrl?: string;
  token?: string;
  includeCredentials?: boolean;
  timeout?: number; // Milliseconds
  /** * Explicitly sets the Content-Type. 
   * - 'json': stringifies body, sets 'application/json'.
   * - 'form-data': typically used with FormData body, Content-Type set by browser.
   * - 'x-www-form-urlencoded': creates URLSearchParams, sets 'application/x-www-form-urlencoded'.
   * - 'text': sets 'text/plain'.
   * - `false`: useful for FormData to let browser set Content-Type with boundary.
   * If `body` is FormData and contentType is not `false`, contentType might be ignored by some parts of the logic.
   */
  contentType?: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'text' | false;
  headers?: Record<string, string> | Headers;
  body?: any;
}

/**
 * Makes an API request.
 * @template T The expected type of the `data` field in a successful JSON response.
 * @param endpoint The API endpoint path.
 * @param options Configuration for the request.
 * @returns A promise that resolves to an ApiResponse.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    baseUrl = '', // Default to empty string, allowing for relative paths or fully qualified endpoints
    method = 'GET',
    headers: optionHeaders = {},
    body,
    token,
    includeCredentials = true, // 'include' is often needed for cookies/auth
    timeout = 30000, // 30 seconds default timeout
    contentType = body instanceof FormData ? false : 'json', // Infer content type if FormData, else default to JSON
    ...fetchOptions
  } = options;

  // Construct full URL
  const url = endpoint.startsWith('http') || !baseUrl
    ? endpoint
    : `${baseUrl.replace(/\/$/, '')}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const requestHeaders = new Headers(optionHeaders);

  if (token && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  let processedBody: BodyInit | null = null;

  if (method !== 'GET' && method !== 'HEAD' && body !== undefined && body !== null) {
    if (contentType === 'json') {
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/json;charset=UTF-8');
      }
      processedBody = JSON.stringify(body);
    } else if (contentType === 'x-www-form-urlencoded') {
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
      }
      if (body instanceof URLSearchParams) {
        processedBody = body;
      } else if (typeof body === 'object') {
        const params = new URLSearchParams();
        for (const key in body as Record<string, any>) {
          if (Object.prototype.hasOwnProperty.call(body, key)) {
            params.append(key, String((body as Record<string, any>)[key]));
          }
        }
        processedBody = params;
      } else {
        // Fallback for non-object bodies with this content type
        processedBody = String(body); 
      }
    } else if (contentType === 'text') {
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'text/plain;charset=UTF-8');
      }
      processedBody = String(body);
    } else if (contentType === false || body instanceof FormData) {
      // Let the browser set the Content-Type for FormData (includes boundary)
      // If contentType is explicitly false, also don't set it.
      processedBody = body as FormData; 
    } else {
      // For other body types or if contentType is 'form-data' but body isn't FormData instance
      processedBody = body as BodyInit; 
    }
  }

  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json, text/plain, */*');
  }

  const fetchConfig: RequestInit = {
    method,
    headers: requestHeaders,
    credentials: includeCredentials ? 'include' : (options.credentials || 'same-origin'),
    body: processedBody,
    ...fetchOptions,
  };

  const controller = new AbortController();
  const timeoutId = timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
  if (timeout > 0) {
    fetchConfig.signal = controller.signal;
  }

  try {
    const response = await fetch(url, fetchConfig);
    if (timeoutId) clearTimeout(timeoutId);

    type JsonResponseType = {
      data?: T; // If the API wraps data in a 'data' property
      error?: string;
      errors?: ApiResponse<T>['errors'];
      message?: string;
      redirectUrl?: string;
      // Potentially other fields that might be part of the JSON response
      [key: string]: any; 
    };

    let responseBodyJson: JsonResponseType | null = null;
    let responseBodyText: string | undefined;

    const responseContentType = response.headers.get('Content-Type');

    // Try to parse as JSON if content type suggests it
    if (responseContentType?.includes('application/json')) {
      try {
        responseBodyJson = await response.json();
      } catch (jsonError: unknown) {
        // JSON parsing failed. Log it, but don't immediately fail the request handling.
        // We might still want to get text content for error messages.
        console.warn(`API (${method} ${url}) response (status ${response.status}) claimed JSON but failed to parse:`, jsonError);
        // Try to read the body as text for error reporting, but be cautious as stream might be consumed/errored.
        // This is a best-effort attempt if JSON parsing fails.
        try {
          // Cloning is safer if you suspect stream issues, but here we're in a catch for .json() already.
          responseBodyText = await response.text(); 
        } catch (textError: unknown) {
          console.warn(`API (${method} ${url}) also failed to read text body after JSON parse error:`, textError);
        }
      }
    } else {
      // If not JSON, try to read as text.
      try {
        responseBodyText = await response.text();
      } catch (e: unknown) {
        console.warn(`API (${method} ${url}) response (status ${response.status}) failed to read non-JSON text body:`, e);
      }
    }

    let finalErrorMessage: string | undefined;
    let finalValidationErrors: ApiResponse<T>['errors'];
    let finalData: T | undefined;

    if (response.ok) {
      if (responseBodyJson) {
        // If the API nests data under a 'data' key, use that. Otherwise, use the whole JSON object.
        finalData = responseBodyJson.data !== undefined ? responseBodyJson.data : (responseBodyJson as T);
      } else if (responseBodyText !== undefined) {
        // If successful but not JSON, wrap text in a standard way if T allows or handle as per app needs.
        // For a generic client, this might be { text: responseBodyText }
        finalData = { text: responseBodyText } as unknown as T; 
      }
    } else { // Not response.ok
      finalErrorMessage = responseBodyJson?.message ||
        responseBodyJson?.error ||
        (responseBodyJson?.errors ? (Array.isArray(responseBodyJson.errors) ? responseBodyJson.errors.map((err: any) => err.message).join(', ') : JSON.stringify(responseBodyJson.errors)) : null) ||
        responseBodyText || // Use text if JSON error info is not available
        response.statusText ||
        `Request failed with status ${response.status}`;
      finalValidationErrors = responseBodyJson?.errors;
      // If the error response itself contains a 'data' field, capture it.
      finalData = responseBodyJson?.data; 
    }

    return {
      success: response.ok,
      data: finalData,
      error: finalErrorMessage,
      errors: finalValidationErrors,
      message: response.ok ? (responseBodyJson?.message || 'Success') : finalErrorMessage,
      status: response.status,
      redirectUrl: responseBodyJson?.redirectUrl,
    };

  } catch (error: unknown) {
    if (timeoutId) clearTimeout(timeoutId);
    let errorMessage = 'Unknown network error or request issue.';
    let errorStatus = 0; // 0 indicates a client-side error like network failure or timeout

    if (error instanceof DOMException && error.name === 'AbortError') {
      errorMessage = 'Request timed out';
      errorStatus = 408; // Request Timeout
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    console.error(`API request to ${method} ${url} failed:`, errorMessage, error);
    return {
      success: false,
      error: errorMessage,
      message: errorMessage,
      status: errorStatus,
    };
  }
}

// --- Convenience Methods ---

/** Convenience method for GET requests */
export async function apiGet<T = unknown>(
  endpoint: string,
  options: Omit<ApiRequestOptions, 'method' | 'body' | 'contentType'> = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/** Convenience method for POST requests (defaults to JSON if body is object) */
export async function apiPost<T = unknown>(
  endpoint: string,
  data?: any,
  options: Omit<ApiRequestOptions, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: data,
    // contentType will default to 'json' if data is an object and not FormData, or 'false' if FormData
  });
}

/** Convenience method for PUT requests (defaults to JSON if body is object) */
export async function apiPut<T = unknown>(
  endpoint: string,
  data?: any,
  options: Omit<ApiRequestOptions, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: data,
  });
}

/** Convenience method for DELETE requests */
export async function apiDelete<T = unknown>(
  endpoint: string,
  options: Omit<ApiRequestOptions, 'method' | 'body' | 'contentType'> = {} 
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}

/** Convenience method for PATCH requests (defaults to JSON if body is object) */
export async function apiPatch<T = unknown>(
  endpoint:string,
  data?: any,
  options: Omit<ApiRequestOptions, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: data,
  });
}

/** Submit a form with FormData (e.g., for file uploads) */
export async function apiSubmitForm<T = unknown>(
  endpoint: string,
  formData: FormData, // Body is explicitly FormData
  options: Omit<ApiRequestOptions, 'method' | 'body' | 'contentType'> = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: (options as ApiRequestOptions).method || 'POST', // Default to POST if not specified
    body: formData,
    contentType: false, // Let browser set Content-Type for FormData
  });
}