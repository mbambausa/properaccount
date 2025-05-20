// src/utils/csrf.ts
import { doubleCsrf } from 'csrf-csrf'; // Ensure 'csrf-csrf' is installed
import type { APIContext } from 'astro';
// Correctly import CloudflareEnv from your env.d.ts file
// The path '../env.d' assumes csrf.ts is in src/utils/ and env.d.ts is in src/
import type { CloudflareEnv } from '../env.d';

// Define the shape of CSRF utilities returned by doubleCsrf
type CsrfUtils = {
  generateToken: (
    req: Request,
    res: Response, // A Response object that will have 'Set-Cookie' header added
    overwrite?: boolean // CORRECTED: The third param is 'overwrite' (boolean), not an options object
  ) => string; // Returns the CSRF token string
  validateRequest: (req: Request, res: Response) => boolean; // Validates token from request
};

// Singleton instance for CSRF utilities to avoid re-initialization on every call.
let csrfUtilsInstance: CsrfUtils | null = null;

/**
 * Initializes and returns CSRF utility functions.
 * It uses a singleton pattern to ensure csrf-csrf is configured only once.
 * @param env - The runtime environment containing secrets and configurations.
 * @returns An object with `generateToken` and `validateRequest` functions.
 */
function getCsrfUtils(env: CloudflareEnv): CsrfUtils {
  if (csrfUtilsInstance) {
    return csrfUtilsInstance;
  }

  const secret =
    env.CSRF_SECRET && env.CSRF_SECRET.length >= 32
      ? env.CSRF_SECRET
      : (() => {
          const fallback =
            'unsafe-fallback-dev-secret-must-be-at-least-32-bytes-long-for-csrf';
          if (env.ENVIRONMENT === 'development' || import.meta.env.DEV) {
            console.warn(
              `CSRF Setup Warning: Using fallback CSRF_SECRET. THIS IS INSECURE. Ensure CSRF_SECRET is properly set in your production environment and .dev.vars.`
            );
          } else {
            console.error(
              'CRITICAL CSRF Setup Error: CSRF_SECRET is missing or too short in a production-like environment.'
            );
            // Consider throwing an error in production to prevent insecure operation
            // throw new Error("CSRF_SECRET is not securely configured for production.");
          }
          return fallback;
        })();

  // Destructure the functions returned by doubleCsrf.
  // The generateToken function from the library is directly used.
  const csrfUtilities = doubleCsrf({
    getSecret: () => secret,
    getSessionIdentifier: (req: Request): string => {
      const isProdLike = env.ENVIRONMENT === 'production';
      const sessionCookieName = isProdLike
        ? "__Secure-authjs.session-token" // Standard for Auth.js in prod
        : "authjs.session-token"; // Standard for Auth.js in dev

      const cookiesHeader = req.headers.get('cookie');
      if (cookiesHeader) {
        const cookies = cookiesHeader.split('; ');
        const sessionCookie = cookies.find(c => c.startsWith(`${sessionCookieName}=`));
        if (sessionCookie) {
          const sessionTokenValue = sessionCookie.split('=')[1];
          if (sessionTokenValue) {
            return sessionTokenValue;
          }
        }
      }
      return "__csrf_no_session__"; // Fallback identifier
    },
    cookieName: '__Host-csrf-secret', // Recommended prefix for security
    cookieOptions: {
      path: '/',
      secure: import.meta.env.PROD, // True if in production build
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 2, // 2 hours
    },
    size: 32, // Token size in bytes
  });

  csrfUtilsInstance = csrfUtilities; // Assign the directly returned object
  return csrfUtilsInstance;
}

/**
 * Prepares CSRF protection for a request by generating a CSRF token
 * and setting the CSRF secret cookie via Astro's context.
 * This function should be called on pages that render forms requiring CSRF protection.
 * @param context - The Astro APIContext.
 * @returns A promise that resolves to the generated CSRF token.
 */
export async function prepareCsrf(context: APIContext): Promise<string> {
  // Accessing env through App.Locals.runtime which should be augmented by src/env.d.ts
  const env = context.locals.runtime?.env as CloudflareEnv | undefined;

  if (!env) {
    console.error('CSRF Prep: CloudflareEnv missing from context.locals.runtime. Cannot prepare CSRF token.');
    if (import.meta.env.DEV) return 'dev-csrf-token-env-missing'; // Fallback for dev
    throw new Error('Server configuration error: Runtime environment not found for CSRF preparation.');
  }

  const { generateToken } = getCsrfUtils(env);
  const dummyRes = new Response(); // csrf-csrf's generateToken needs a Response to set cookies on

  try {
    // Call 'generateToken' with 'overwrite' as a boolean (true to overwrite existing secret cookie)
    const token = generateToken(context.request as Request, dummyRes, true);

    const setCookieHeader = dummyRes.headers.get('set-cookie');
    if (setCookieHeader) {
      // Parse the Set-Cookie header and apply it using Astro's cookie API
      const parts = setCookieHeader.split(';').map(part => part.trim());
      const nameValuePair = parts[0].split('=');
      const cookieName = nameValuePair[0];
      let cookieValue = '';
      
      try {
        cookieValue = decodeURIComponent(nameValuePair[1] || '');
      } catch (e) {
        // If decoding fails (e.g., already URI safe), use the raw value
        cookieValue = nameValuePair[1] || '';
      }

      const astroCookieOptions: Record<string, any> = { 
        httpOnly: true, 
        secure: import.meta.env.PROD, 
        path: '/', 
        sameSite: 'lax' 
      };
      
      // Parse options like Max-Age from the Set-Cookie header
      parts.slice(1).forEach(part => {
        const [key, ...valParts] = part.split('=');
        const value = valParts.join('=');
        if (key.toLowerCase() === 'max-age') {
          astroCookieOptions.maxAge = parseInt(value, 10);
        }
        // Astro's cookies.set uses 'expires' (Date object) if you want to set an expiry date.
        // Max-Age is directly supported by Astro's cookies.set.
      });
      
      // Ensure maxAge is set if not parsed from header
      if (astroCookieOptions.maxAge === undefined) {
        astroCookieOptions.maxAge = 60 * 60 * 2; // Default to 2 hours
      }
      
      context.cookies.set(cookieName, cookieValue, astroCookieOptions);
    } else {
      console.warn("CSRF Prep: 'set-cookie' header was not generated by csrf-csrf library. This is unexpected.");
    }

    return token; // This is the CSRF token to embed in forms
  } catch (error) {
    console.error('CSRF token generation error:', error);
    if (import.meta.env.DEV) {
      // Fallback token for development to allow page rendering
      return 'csrf-dev-token-generation-error-' + Math.random().toString(36).substring(2, 15);
    }
    throw new Error('Failed to generate CSRF token due to an internal error.');
  }
}

/**
 * Validates the CSRF token for an incoming request.
 * This should be called in API endpoints that handle state-changing operations (POST, PUT, DELETE).
 * @param context - The Astro APIContext.
 * @returns A promise that resolves to true if the CSRF token is valid, false otherwise.
 */
export async function validateRequestCsrf(context: APIContext): Promise<boolean> {
  // Accessing env through App.Locals.runtime
  const env = context.locals.runtime?.env as CloudflareEnv | undefined;

  if (!env) {
    console.error('CSRF Valid: CloudflareEnv missing from context.locals.runtime. CSRF validation cannot proceed.');
    return false; // Fail closed if environment is missing
  }

  try {
    const { validateRequest } = getCsrfUtils(env);
    const dummyRes = new Response(); // validateRequest also needs a Response object (though it doesn't modify it)

    const isValid = validateRequest(context.request as Request, dummyRes);
    if (!isValid) {
      console.warn(
        `CSRF token validation failed for: ${context.request.method} ${new URL(context.request.url).pathname}`
      );
    }
    return isValid;
  } catch (error) {
    console.error('Error during CSRF validation process:', error);
    // Optional: Lenient mode for development if strictly needed, but generally better to fix issues.
    if (env.ENVIRONMENT === 'development' && import.meta.env.DEV) {
      console.warn('DEVELOPMENT MODE: CSRF validation encountered an error. Request will be rejected by default. Investigate the error.');
      // return true; // Uncomment only if absolutely necessary for dev and the error is understood.
    }
    return false; // Fail closed by default on error
  }
}
