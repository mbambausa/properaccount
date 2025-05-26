// src/utils/url.ts
/**
 * URL and query string utilities
 */

export function buildUrl(base: string, params?: Record<string, any>): string {
  const url = new URL(base, window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  
  return url.toString();
}

export function parseQueryString<T = Record<string, string>>(
  queryString: string
): T {
  const params = new URLSearchParams(queryString);
  const result: any = {};
  
  for (const [key, value] of params.entries()) {
    // Handle array notation (e.g., filters[])
    if (key.endsWith('[]')) {
      const arrayKey = key.slice(0, -2);
      if (!result[arrayKey]) result[arrayKey] = [];
      result[arrayKey].push(value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

export function updateQueryParams(
  updates: Record<string, any>,
  currentUrl?: string
): string {
  const url = new URL(currentUrl || window.location.href);
  
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(value));
    }
  });
  
  return url.toString();
}