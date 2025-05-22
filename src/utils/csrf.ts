// src/utils/csrf.ts
import { doubleCsrf, type DoubleCsrfUtilities, type DoubleCsrfConfigOptions } from 'csrf-csrf';
// Removed GenerateTokenOptions/GenerateCsrfTokenOptions import as it's not directly used in the call
import type { APIContext } from 'astro';
import type { CloudflareEnv } from '../env';

type CsrfLibraryUtils = DoubleCsrfUtilities;

let csrfUtilsInstance: CsrfLibraryUtils | null = null;
let csrfConfigOptionsUsed: DoubleCsrfConfigOptions | null = null;

const DEFAULT_CSRF_FALLBACK_SECRET =
  'unsafe-fallback-dev-secret-must-be-at-least-32-bytes-long-for-csrf';

function getCsrfUtils(env: CloudflareEnv): CsrfLibraryUtils {
  if (csrfUtilsInstance) {
    return csrfUtilsInstance;
  }

  let secret = env.CSRF_SECRET;

  if (!secret || secret.length < 32) {
    secret = DEFAULT_CSRF_FALLBACK_SECRET;
    if (env.ENVIRONMENT === 'production' || !import.meta.env.PROD) {
      console.error(
        'CRITICAL CSRF Setup Error: CSRF_SECRET is missing or too short in a production-like environment. Using an insecure fallback.'
      );
    } else {
      console.warn(
        `CSRF Setup Warning: Using fallback CSRF_SECRET. THIS IS INSECURE. Ensure CSRF_SECRET is properly set for development in .dev.vars and for production in Cloudflare secrets.`
      );
    }
  }

  const cookieOptionsConfig: DoubleCsrfConfigOptions["cookieOptions"] = {
    path: '/',
    secure: env.ENVIRONMENT === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2 hours in seconds
  };

  const configToUse: DoubleCsrfConfigOptions = {
    getSecret: () => secret,
    getSessionIdentifier: (req: Request): string => {
      const isProdLike = env.ENVIRONMENT === 'production';
      const sessionCookieName = isProdLike
        ? "__Secure-authjs.session-token"
        : "authjs.session-token";

      const cookiesHeader = req.headers.get('cookie');
      if (cookiesHeader) {
        const cookies = cookiesHeader.split('; ');
        const sessionCookie = cookies.find(c => c.startsWith(`${sessionCookieName}=`));
        if (sessionCookie) {
          const sessionTokenValue = sessionCookie.split('=')[1];
          if (sessionTokenValue && sessionTokenValue.length > 10) {
            return sessionTokenValue;
          }
        }
      }
      return "__anonymous_csrf_session__";
    },
    cookieName: env.ENVIRONMENT === 'production' ? '__Host-csrf.secret' : 'csrf.secret',
    cookieOptions: cookieOptionsConfig,
    size: 64,
  };

  csrfConfigOptionsUsed = configToUse;
  csrfUtilsInstance = doubleCsrf(configToUse);
  return csrfUtilsInstance;
}

export async function prepareCsrfToken(context: APIContext): Promise<string> {
  const env = context.locals.runtime?.env as CloudflareEnv | undefined;

  if (!env) {
    const errorMessage = 'CSRF Prep: CloudflareEnv missing. Cannot prepare CSRF token.';
    console.error(errorMessage);
    if (import.meta.env.DEV) return 'dev-csrf-token-env-missing';
    throw new Error('Server configuration error: Runtime environment not found.');
  }

  const csrfUtils = getCsrfUtils(env);

  try {
    const dummyResponse = new Response(null);
    // Corrected method name: generateCsrfToken
    const csrfToken = csrfUtils.generateCsrfToken(dummyResponse, context.request); // [cite: 2]

    const setCookieHeader = dummyResponse.headers.get('set-cookie');

    if (setCookieHeader) {
      const cookieParts = setCookieHeader.split(';').map(part => part.trim());
      const [nameValue, ...optionsArray] = cookieParts;
      const [cookieName, cookieValue] = nameValue.split('=');
      
      const astroCookieOptions: import('astro').AstroCookieSetOptions = {
        httpOnly: csrfConfigOptionsUsed?.cookieOptions?.httpOnly ?? true,
        secure: csrfConfigOptionsUsed?.cookieOptions?.secure ?? (env.ENVIRONMENT === 'production'),
        path: csrfConfigOptionsUsed?.cookieOptions?.path ?? '/',
        sameSite: (csrfConfigOptionsUsed?.cookieOptions?.sameSite ?? 'lax') as 'lax' | 'strict' | 'none' | boolean | undefined,
      };

      optionsArray.forEach(part => {
        const [key, ...valParts] = part.split('=');
        const value = valParts.join('=');
        const lowerKey = key.toLowerCase();

        if (lowerKey === 'max-age' && value) {
          astroCookieOptions.maxAge = parseInt(value, 10);
        } else if (lowerKey === 'expires' && value) {
           astroCookieOptions.expires = new Date(value);
        } else if (lowerKey === 'path' && value) {
          astroCookieOptions.path = value;
        } else if (lowerKey === 'samesite' && value) {
          astroCookieOptions.sameSite = value.toLowerCase() as 'lax' | 'strict' | 'none';
        } else if (lowerKey === 'secure') {
          astroCookieOptions.secure = true;
        } else if (lowerKey === 'httponly') {
          astroCookieOptions.httpOnly = true;
        }
      });
      
      if (astroCookieOptions.maxAge === undefined && astroCookieOptions.expires === undefined) {
        astroCookieOptions.maxAge = csrfConfigOptionsUsed?.cookieOptions?.maxAge ?? (60 * 60 * 2);
      }

      context.cookies.set(cookieName, cookieValue, astroCookieOptions);
    } else {
      console.warn("CSRF Prep: 'set-cookie' header for CSRF secret was not generated.");
    }
    return csrfToken;
  } catch (error) {
    console.error('CSRF token generation error:', error);
    if (import.meta.env.DEV) {
      return 'dev-csrf-token-error-' + Math.random().toString(36).substring(2, 9);
    }
    throw new Error('Failed to generate CSRF token.');
  }
}

export async function validateCsrfRequest(
  contextOrRequest: APIContext | Request,
  envOverride?: CloudflareEnv
): Promise<boolean> {
  const request = 'request' in contextOrRequest ? contextOrRequest.request : contextOrRequest;
  const locals = 'locals' in contextOrRequest ? contextOrRequest.locals : undefined;
  
  const env = envOverride || locals?.runtime?.env as CloudflareEnv | undefined;

  if (!env) {
    console.error('CSRF Valid: CloudflareEnv missing. CSRF validation cannot proceed.');
    return false;
  }

  try {
    const { validateRequest } = getCsrfUtils(env);
    const isValid = validateRequest(request);

    if (!isValid) {
      console.warn(
        `CSRF token validation failed for: ${request.method} ${new URL(request.url).pathname}`
      );
    }
    return isValid;
  } catch (error) {
    console.error('Error during CSRF validation:', error);
    return false;
  }
}