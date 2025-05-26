// src/utils/api.ts
/**
 * API Client
 *
 * A lightweight client for making API requests.
 * Handles request formatting, error handling, and response parsing.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]> | Array<{ path: (string | number)[]; message: string }>;
  message?: string;
  status: number;
  redirectUrl?: string;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  baseUrl?: string;
  token?: string;
  includeCredentials?: boolean;
  timeout?: number;
  contentType?: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'text' | false;
  headers?: Record<string, string> | Headers;
  body?: any;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    baseUrl = '',
    method = 'GET',
    headers: optionHeaders = {},
    body,
    token,
    includeCredentials = true,
    timeout = 30000,
    contentType = body instanceof FormData ? false : 'json',
    ...fetchOptions
  } = options;

  const url = endpoint.startsWith('http') || !baseUrl
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

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
        processedBody = String(body);
      }
    } else if (contentType === 'text') {
      if (!requestHeaders.has('Content-Type')) {
        requestHeaders.set('Content-Type', 'text/plain;charset=UTF-8');
      }
      processedBody = String(body);
    } else if (contentType === false || body instanceof FormData) {
      processedBody = body as FormData;
    } else {
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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    fetchConfig.signal = controller.signal;

    const response = await fetch(url, fetchConfig);
    clearTimeout(timeoutId);

    type JsonResponseType = {
      data?: T;
      error?: string;
      errors?: Record<string, string[]> | Array<{ path: (string | number)[]; message: string }>;
      message?: string;
      redirectUrl?: string;
    };

    let responseData: JsonResponseType | any = null;
    let textForError: string | undefined;

    const responseContentType = response.headers.get('Content-Type');
    if (responseContentType?.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch (e: unknown) { // Typed catch parameter
        if (!response.ok || (response.ok && response.status !== 204)) {
          console.warn(`API (${method} ${url}) response (status ${response.status}) claimed JSON but failed to parse:`, e);
        }
        try {
          // This line was the source of the "e implicitly has an any type" error if 'e' was not typed in the catch.
          // Now 'e' is 'unknown'.
          const tempText = await response.text(); // Try to get text if JSON parsing failed
          if (!response.ok) textForError = tempText;
        } catch { /* ignore if text read fails */ }
      }
    } else {
      try {
        textForError = await response.text();
        if (response.ok && textForError && typeof responseData === 'undefined') {
          responseData = { text: textForError };
        }
      } catch (e: unknown) { // Typed catch parameter
        console.warn(`API (${method} ${url}) response (status ${response.status}) failed to read text body:`, e);
      }
    }

    let finalErrorMessage: string | undefined;
    let finalValidationErrors: ApiResponse<T>['errors'];

    if (!response.ok) {
      finalErrorMessage = responseData?.message ||
        responseData?.error ||
        (responseData?.errors ? (Array.isArray(responseData.errors) ? responseData.errors.map((err: any) => err.message).join(', ') : JSON.stringify(responseData.errors)) : null) ||
        textForError ||
        response.statusText ||
        `Request failed with status ${response.status}`;
      finalValidationErrors = responseData?.errors;
    }

    return {
      success: response.ok,
      data: response.ok ? (responseData?.data !== undefined ? responseData.data : responseData) : (responseData?.data),
      error: finalErrorMessage,
      errors: finalValidationErrors,
      message: response.ok ? (responseData?.message || 'Success') : finalErrorMessage,
      status: response.status,
      redirectUrl: responseData?.redirectUrl,
    };

  } catch (error: unknown) { // Typed catch parameter
    let errorMessage = 'Unknown network error';
    let errorStatus = 0;

    if (error instanceof DOMException && error.name === 'AbortError') {
      errorMessage = 'Request timed out';
      errorStatus = 408;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    console.error(`API request to ${url} failed:`, errorMessage, error);
    return {
      success: false,
      error: errorMessage,
      message: errorMessage,
      status: errorStatus,
    };
  }
}

// Convenience methods (apiGet, apiPost, etc.) remain the same as previous correct version.
// ... (apiGet, apiPost, apiPut, apiDelete, apiPatch, apiSubmitForm from previous answer)
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
  options: Omit<ApiRequestOptions, 'method' | 'body'> = {} 
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
  formData: FormData,
  options: Omit<ApiRequestOptions, 'method' | 'body' | 'contentType'> = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    method: (options as ApiRequestOptions).method || 'POST',
    body: formData,
    contentType: false, 
  });
}