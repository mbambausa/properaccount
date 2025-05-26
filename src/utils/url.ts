// src/utils/url.ts
/**
 * URL and query string manipulation utilities.
 * These functions are designed to be isomorphic (work in browser and server environments)
 * by requiring explicit base URLs or current URLs as parameters.
 */

/**
 * Builds a URL string with optional query parameters.
 *
 * @param basePath The base path or full URL. If a relative path, it will be resolved against a common origin if one were globally available,
 * but for isomorphic use, it's best if `basePath` is either a full URL or `params` are being added to a known full URL.
 * For constructing URLs from scratch server-side, provide a full base URL (e.g., from `Astro.site` or `env.PUBLIC_APP_URL`).
 * Client-side, you might use `window.location.origin` as part of the `basePath`.
 * @param params Optional record of query parameters to add to the URL.
 * @returns The constructed URL string.
 * @throws Error if the basePath is invalid and cannot be parsed into a URL.
 */
export function buildUrl(basePath: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  let url: URL;
  try {
    // If basePath is already a full URL, use it.
    // If it's a relative path, it needs a base to be resolved against.
    // For isomorphic use, ensure basePath can be resolved. If always used client-side with relative paths,
    // new URL(basePath, window.location.origin) would be the pattern.
    // For robust isomorphic behavior, encourage `basePath` to be absolute or provide an explicit base in the caller.
    // Here, we'll assume `basePath` can be resolved or is absolute.
    if (basePath.startsWith('http://') || basePath.startsWith('https://')) {
      url = new URL(basePath);
    } else {
      // If it's a relative path like '/foo/bar' and expected to be on current origin,
      // the caller needs to handle prepending the origin.
      // For simplicity here, if it's not a full URL, we try to parse it as is,
      // which might be useful for pathnames with query strings.
      // A more robust approach for relative paths would be: new URL(basePath, explicitOrigin).
      // Let's assume for this utility, if not absolute, it's a path that might already have an origin implicitly
      // or is being constructed part by part.
      // If an error occurs, it means basePath was not a valid URL or resolvable path part.
      url = new URL(basePath, 'http://dummybase'); // Dummy base for relative path parsing
      if (url.origin === 'http://dummybase') { // Path was relative
        url.protocol = ''; // Clear dummy protocol/host if it was just a path
        url.host = '';
        url.hostname = '';
        url.port = '';
      }
    }
  } catch (e) {
    console.error(`buildUrl: Invalid basePath provided: "${basePath}"`, e);
    throw new Error(`Invalid base path for URL construction: ${basePath}`);
  }

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  
  // If the original basePath was relative (e.g. "/path?query"), return pathname + search
  if (basePath.startsWith('/') && !(basePath.startsWith('//')) && (url.origin === '' || url.origin === 'http://dummybase')) {
    return `${url.pathname}${url.search}`;
  }
  return url.toString();
}

/**
 * Parses a query string (e.g., from `location.search` or a URL part) into an object.
 * Handles array notation for query parameters (e.g., `filters[]=value1&filters[]=value2`).
 *
 * @template T The expected shape of the parsed query parameters.
 * @param queryString The query string to parse (e.g., "?foo=bar&baz=1").
 * @returns An object representing the parsed query parameters.
 */
export function parseQueryString<T = Record<string, string | string[]>>(
  queryString: string
): T {
  const params = new URLSearchParams(queryString.startsWith('?') ? queryString.substring(1) : queryString);
  const result: any = {};

  for (const [key, value] of params.entries()) {
    if (key.endsWith('[]')) { // Handle array parameters like "key[]=value1&key[]=value2"
      const arrayKey = key.slice(0, -2);
      if (!Object.prototype.hasOwnProperty.call(result, arrayKey)) {
        result[arrayKey] = [];
      }
      if (Array.isArray(result[arrayKey])) {
        result[arrayKey].push(value);
      }
    } else {
      // If key already exists (e.g. ?foo=bar&foo=baz), make it an array
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        if (!Array.isArray(result[key])) {
          result[key] = [result[key]];
        }
        result[key].push(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
}

/**
 * Updates the query parameters of a given URL string.
 *
 * @param currentUrlString The current URL string (must be a full URL or include an origin).
 * @param updates A record of query parameters to add, update, or remove (if value is null/undefined).
 * @returns The new URL string with updated query parameters.
 * @throws Error if currentUrlString is not a valid URL.
 */
export function updateQueryParams(
  currentUrlString: string,
  updates: Record<string, string | number | boolean | undefined | null>
): string {
  let url: URL;
  try {
    url = new URL(currentUrlString);
  } catch (e) {
    console.error(`updateQueryParams: Invalid currentUrlString provided: "${currentUrlString}"`, e);
    throw new Error(`Invalid current URL for query parameter update: ${currentUrlString}`);
  }

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

/**
 * Gets a specific query parameter from a URL string or the current window URL.
 * @param paramName The name of the query parameter.
 * @param urlString Optional URL string to parse. Defaults to `window.location.search` if in a browser.
 * Server-side, this must be provided.
 * @returns The value of the query parameter or null if not found.
 */
export function getQueryParam(paramName: string, urlString?: string): string | null {
  let searchParams: URLSearchParams;
  if (urlString) {
    try {
      searchParams = new URL(urlString).searchParams;
    } catch {
      // If urlString is just a query string part
      searchParams = new URLSearchParams(urlString.startsWith('?') ? urlString : `?${urlString}`);
    }
  } else if (typeof window !== 'undefined') {
    searchParams = new URLSearchParams(window.location.search);
  } else {
    // Server-side or non-browser, and no urlString provided.
    console.warn(`getQueryParam: Cannot determine query parameters without a urlString in a non-browser environment.`);
    return null;
  }
  return searchParams.get(paramName);
}

/**
 * Creates a query string from an object of parameters.
 *
 * @param params An object of parameters.
 * @returns A URL-encoded query string (e.g., "foo=bar&baz=1").
 */
export functioncreateQueryString(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, String(v))); // Or key[] if server expects that
      } else {
        searchParams.set(key, String(value));
      }
    }
  });
  return searchParams.toString();
}