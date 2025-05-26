// src/utils/csrf.ts
import {
  doubleCsrf,
  type DoubleCsrfUtilities,
  type DoubleCsrfConfigOptions,
} from "csrf-csrf";
import type { APIContext } from "astro";
import type { CloudflareEnv } from "../env"; // Adjusted path assuming env.d.ts is in src/

// Cached instance of CSRF utilities to avoid re-creation on every call within the same context/isolate.
let csrfUtilsInstance: DoubleCsrfUtilities | null = null;
// Store the config used to initialize to help with debugging or dynamic adjustments if ever needed.
let csrfConfigOptionsUsed: DoubleCsrfConfigOptions | null = null;

const DEFAULT_CSRF_FALLBACK_SECRET =
  "unsafe-fallback-dev-secret-must-be-at-least-32-bytes-long-for-csrf";

/**
 * Initializes and returns the doubleCsrf utility functions.
 * Uses environment variables for configuration and attempts to use Auth.js session cookies
 * as part of the session identifier, falling back to a less secure anonymous placeholder.
 */
function getCsrfUtils(env: CloudflareEnv): DoubleCsrfUtilities {
  if (csrfUtilsInstance && 
      csrfConfigOptionsUsed && 
      (csrfConfigOptionsUsed.getSecret() === (env.CSRF_SECRET || DEFAULT_CSRF_FALLBACK_SECRET))) {
    // Return cached instance if secret hasn't changed (important for serverless environments)
    return csrfUtilsInstance;
  }

  let secret = env.CSRF_SECRET; // This should be a strong, unguessable string (min 32 bytes)
  if (!secret || secret.length < 32) {
    secret = DEFAULT_CSRF_FALLBACK_SECRET;
    const message = `CSRF_SECRET is missing, too short, or changed. Length: ${secret?.length || 0}. Using an insecure fallback secret.
    Ensure CSRF_SECRET is a cryptographically strong random string of at least 32 bytes.
    Set it in the Cloudflare Pages dashboard for production/preview, and in .dev.vars for local development.`;
    
    if (env.ENVIRONMENT === "production" || import.meta.env.PROD) {
      console.error(`CRITICAL CSRF SETUP ERROR: ${message}`);
      // In a real production scenario, you might throw an error here or have a more robust alerting mechanism.
    } else {
      console.warn(`CSRF SETUP WARNING (Non-Production): ${message}`);
    }
  }

  const isProductionEnv = env.ENVIRONMENT === "production";

  const cookieOptionsConfig: DoubleCsrfConfigOptions["cookieOptions"] = {
    path: "/",
    secure: isProductionEnv, // Use secure cookies in production
    httpOnly: true,
    sameSite: "lax", // Recommended default for CSRF cookies
    maxAge: 60 * 60 * 2, // 2 hours (adjust as needed)
  };

  const configToUse: DoubleCsrfConfigOptions = {
    getSecret: () => secret, // Closure to provide the secret
    cookieName: isProductionEnv
      ? "__Host-csrf.token.secret" // Recommended prefix for secure cookies
      : "csrf.token.secret", // Simpler name for dev
    cookieOptions: cookieOptionsConfig,
    size: 64, // Size of the CSRF token generated (bytes)
    getTokenFromRequest: (req: Request) => {
      // Standard ways to get token: form field, header, query param
      const formDataToken = (req as any).formData?.get?.("_csrf"); // If parsing FormData
      const headerToken = req.headers.get("X-CSRF-Token");
      // Query param is less common for CSRF but supported by library
      // const queryToken = new URL(req.url).searchParams.get("_csrf"); 
      return formDataToken || headerToken /* || queryToken */;
    },
    // TODO SECURITY: The anonymous fallback for getSessionIdentifier weakens CSRF for unauthenticated users.
    // Consider generating and storing a unique, unguessable anonymous ID in a separate cookie
    // if strong CSRF protection for anonymous actions is critical.
    getSessionIdentifier: (req: Request): string => {
      const authJsSecureCookieName = "__Secure-authjs.session-token";
      const authJsDevCookieName = "authjs.session-token";
      // Example custom app session cookie (if you have one separate from Auth.js)
      // const customAppSessionCookieName = isProductionEnv ? "__Host-app.session" : "app.session";

      const cookiesHeader = req.headers.get("cookie");
      if (cookiesHeader) {
        const cookies = cookiesHeader.split("; ").filter(Boolean);
        let sessionTokenValue: string | undefined;

        const authJsCookie = cookies.find((c) =>
          c.startsWith(`${isProductionEnv ? authJsSecureCookieName : authJsDevCookieName}=`)
        );

        if (authJsCookie) {
          sessionTokenValue = authJsCookie.split("=")[1];
        } 
        // else {
        //   const customCookie = cookies.find((c) => c.startsWith(`${customAppSessionCookieName}=`));
        //   if (customCookie) sessionTokenValue = customCookie.split("=")[1];
        // }

        // Ensure the token is substantial enough to be a session identifier
        if (sessionTokenValue && sessionTokenValue.length > 10) { 
          return sessionTokenValue;
        }
      }
      // Fallback for anonymous users or if no session cookie found
      return "__anonymous_csrf_placeholder_session__"; 
    },
  };

  csrfConfigOptionsUsed = configToUse; // Cache the config used
  csrfUtilsInstance = doubleCsrf(configToUse);
  return csrfUtilsInstance;
}

/**
 * Prepares and sets a CSRF token and its associated secret cookie on the response.
 * The token should be included in forms/requests, and the cookie is HttpOnly.
 * This function should be called on GET requests for pages that will submit forms.
 */
export async function prepareCsrfToken(context: APIContext): Promise<string> {
  const env = context.locals.runtime?.env as CloudflareEnv | undefined;

  if (!env) {
    const errorMessage = "CSRF Prep: CloudflareEnv (locals.runtime.env) is missing. Cannot prepare CSRF token.";
    console.error(errorMessage);
    // In dev, return a placeholder to avoid breaking pages, but this is a serious misconfiguration.
    if (import.meta.env.DEV) return "dev-csrf-token-env-missing"; 
    throw new Error("Server configuration error: CSRF environment not found.");
  }

  const csrfUtils = getCsrfUtils(env);

  try {
    // The csrf-csrf library's generateCsrfToken modifies a Response object directly to set cookies.
    // We create a dummy response to capture the 'set-cookie' header.
    const dummyResponse = new Response(null);
    const csrfToken = csrfUtils.generateCsrfToken(dummyResponse, context.request);

    const setCookieHeader = dummyResponse.headers.get("set-cookie");
    if (setCookieHeader) {
      // Astro's context.cookies.set API is preferred for setting cookies in Astro middleware/endpoints.
      // We need to parse the attributes from the set-cookie header string.
      // TODO: This parsing is complex and could be fragile. Simplify if `csrf-csrf` or Astro offers better interop.
      const cookieParts = setCookieHeader.split(";").map((part) => part.trim());
      const [nameValue, ...optionsArray] = cookieParts;
      const [cookieName, cookieValue] = nameValue.split("=");

      const astroCookieOptions: import("astro").AstroCookieSetOptions = {
        httpOnly: csrfConfigOptionsUsed?.cookieOptions?.httpOnly ?? true,
        secure: csrfConfigOptionsUsed?.cookieOptions?.secure ?? (env.ENVIRONMENT === "production"),
        path: csrfConfigOptionsUsed?.cookieOptions?.path ?? "/",
        sameSite: (csrfConfigOptionsUsed?.cookieOptions?.sameSite ?? "lax") as "lax" | "strict" | "none" | boolean | undefined,
      };
      
      // Parse Max-Age and Expires from the optionsArray
      optionsArray.forEach((part) => {
        const [key, ...valParts] = part.split("=");
        const value = valParts.join("="); // Handles cases where value might contain '='
        const lowerKey = key.toLowerCase();

        if (lowerKey === "max-age" && value) {
          astroCookieOptions.maxAge = parseInt(value, 10);
        } else if (lowerKey === "expires" && value) {
          // astroCookieOptions.expires = new Date(value); // This can be kept if preferred
        } 
        // Other attributes like 'secure', 'httponly', 'path', 'samesite' are already set from csrfConfigOptionsUsed
      });

      // Ensure Max-Age or Expires is set to give the cookie a lifetime
      if (astroCookieOptions.maxAge === undefined && astroCookieOptions.expires === undefined) {
        astroCookieOptions.maxAge = csrfConfigOptionsUsed?.cookieOptions?.maxAge ?? (60 * 60 * 2); // Default 2 hours
      }
      
      context.cookies.set(cookieName, cookieValue, astroCookieOptions);
    } else {
      console.warn("CSRF Prep: 'set-cookie' header for CSRF secret was not generated by csrf-csrf library.");
      // This might indicate an issue with the CSRF library or its configuration.
    }
    return csrfToken;
  } catch (error: unknown) {
    console.error("CSRF token generation error:", error);
    if (import.meta.env.DEV) {
      return "dev-csrf-token-generation-error-" + Math.random().toString(36).substring(2, 9);
    }
    // In production, rethrow or handle more gracefully, but don't expose a broken CSRF system.
    throw new Error("Failed to generate CSRF token due to an internal error.");
  }
}

/**
 * Validates a CSRF token from an incoming request.
 * This should be called on POST, PUT, DELETE, PATCH requests.
 * * @returns `true` if the token is valid or if in DEV mode and CSRF system is misconfigured (to avoid blocking dev).
 * `false` if the token is invalid.
 * @throws Error in production if CSRF system is critically misconfigured.
 */
export async function validateCsrfRequest(
  contextOrRequest: APIContext | Request,
  envOverride?: CloudflareEnv // Allow passing env for contexts where locals might not be populated yet
): Promise<boolean> {
  const request = "request" in contextOrRequest ? contextOrRequest.request : contextOrRequest;
  const locals = "locals" in contextOrRequest ? contextOrRequest.locals : undefined;
  
  // Prefer envOverride if provided, then locals, then try to infer from global if possible (not ideal)
  const env = envOverride || (locals?.runtime?.env as CloudflareEnv | undefined);

  if (!env) {
    console.error("CSRF Validation Error: CloudflareEnv (runtime.env) is missing. CSRF validation cannot proceed reliably.");
    // In development, allow the request to proceed to avoid blocking development due to misconfiguration.
    // In production, this is a critical failure.
    if (import.meta.env.DEV) return true; 
    throw new Error("Server configuration error: CSRF environment validation failed.");
  }

  try {
    const { validateRequest } = getCsrfUtils(env);
    // validateRequest will throw an error if token is invalid, or return void if valid.
    // For consistency, we'll wrap this and return boolean.
    // However, csrf-csrf's validateRequest often throws an error on failure.
    // The library's type definition might be `(req: Request) => void | Promise<void>`.
    // If it throws, this try/catch will handle it. If it returns, it means valid.
    await validateRequest(request); // Assuming it might be async
    return true; 
  } catch (error: unknown) {
    // Log the CSRF validation failure details
    const url = new URL(request.url);
    console.warn(
      `CSRF token validation FAILED for: ${request.method} ${url.pathname}. IP: ${request.headers.get("CF-Connecting-IP") || 'N/A'}. Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return false; // Token is invalid
  }
}