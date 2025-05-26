// src/middleware.ts
import { defineMiddleware, type APIContext, type MiddlewareNext } from 'astro:middleware';
// Note: If 'APIContext' or 'MiddlewareNext' still show errors in your IDE after ensuring
// `astro/client` types are referenced (e.g., in src/env.d.ts), this may indicate
// an issue with your local TypeScript environment's resolution of Astro project types.
// These are the standard types for Astro 5.x middleware.

import type { CloudflareEnv } from './env';
import { prepareCsrfToken, validateCsrfRequest } from './utils/csrf';
import { errorToResponse, AppError, ForbiddenError } from './utils/errors'; // Removed InternalServerError import
import type { Session as AuthJsSessionObject, User as AuthJsUserObject } from '@auth/core/types';
import type { Session, User } from './types/auth';

const MIDDLEWARE_PERF_THRESHOLD_MS = 25;

const CSRF_EXEMPT_PATH_PREFIXES: ReadonlySet<string> = new Set([
  '/api/auth/',
  '/api/webhooks/',
  '/api/health',
  '/api/status',
]);

const STATIC_ASSET_REGEX = /\.(?:js|css|mjs|json|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|otf|map|webmanifest)$/i;

function generateSecureNonce(size = 18): string {
  const array = new Uint8Array(size);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function adaptAuthJsSessionToAppSession(
  authJsSession: AuthJsSessionObject | null,
  appUserId: string | null
): Session | null {
  if (!authJsSession || !appUserId) return null;
  const now = Date.now();
  const expiresTimestamp = authJsSession.expires ? new Date(authJsSession.expires).getTime() : now + (24 * 60 * 60 * 1000);
  return {
    id: crypto.randomUUID(),
    userId: appUserId,
    expiresAt: Math.floor(expiresTimestamp / 1000),
    createdAt: Math.floor(now / 1000),
  };
}

function adaptAuthJsUserToAppUser(authUser: AuthJsUserObject | null | undefined): User | null {
  if (!authUser?.id) return null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const authUserExtended = authUser as any;

  return {
    id: authUser.id,
    email: authUser.email || '',
    name: authUser.name || null,
    role: authUserExtended.role || 'user',
    createdAt: authUserExtended.createdAt || nowSeconds,
    updatedAt: authUserExtended.updatedAt || nowSeconds,
    emailVerifiedAt: authUserExtended.emailVerified instanceof Date
      ? Math.floor(authUserExtended.emailVerified.getTime() / 1000)
      : (typeof authUserExtended.emailVerified === 'string'
          ? Math.floor(new Date(authUserExtended.emailVerified).getTime() / 1000)
          : null),
    imageUrl: authUser.image || null,
  };
}

/**
 * Fetches the Auth.js session.
 * TODO URGENT: Replace this internal fetch with a direct server-side Auth.js utility.
 */
async function getAuthJsSessionFromServer(request: Request, appUrl: string): Promise<AuthJsSessionObject | null> {
  try {
    const sessionUrl = new URL('/api/auth/session', appUrl);
    const sessionRequest = new Request(sessionUrl.toString(), {
      headers: {
        'cookie': request.headers.get('cookie') || '',
        'User-Agent': request.headers.get('User-Agent') || 'InternalMiddleware/1.0',
      },
    });
    const response = await fetch(sessionRequest);
    if (response.ok) {
      const sessionData = await response.json();
      return (sessionData && typeof sessionData === 'object' && Object.keys(sessionData).length > 0) ? sessionData as AuthJsSessionObject : null;
    }
    console.warn(`Middleware: Auth.js session fetch to ${sessionUrl} failed with status ${response.status}`);
    return null;
  } catch (error) {
    console.error('Middleware: Failed to fetch Auth.js session:', error);
    return null;
  }
}

/**
 * Fetches the application user from the D1 database.
 * TODO CRITICAL: Implement actual database lookup logic here.
 */
async function getAppUserFromDb(userId: string | null, env: CloudflareEnv): Promise<User | null> {
  if (!userId) return null;
  // Actual implementation needed
  console.warn(`Middleware Placeholder: getAppUserFromDb called for userId ${userId}. DB lookup NOT IMPLEMENTED.`);
  return null;
}

export const onRequest = defineMiddleware(async (context: APIContext, next: MiddlewareNext) => {
  const requestStartTime = performance.now();
  const { request, locals, platform } = context;
  const url = new URL(request.url);

  if (STATIC_ASSET_REGEX.test(url.pathname)) {
    return next();
  }

  if (platform && !locals.runtime) {
     locals.runtime = {
       env: platform.env as CloudflareEnv,
       cf: platform.cf,
       ctx: platform.context,
       waitUntil: (promise: Promise<any>) => platform.context.waitUntil(promise),
     };
  }
  const env = locals.runtime?.env; // 'env' is used below.

  if (!env) {
    console.error("Middleware FATAL: Cloudflare Environment (locals.runtime.env) could not be initialized.");
    return errorToResponse(new AppError("Server configuration error: Runtime environment missing.", 500, true, "RUNTIME_MISSING"));
  }

  locals.requestId = crypto.randomUUID();
  locals.requestStartTime = requestStartTime;

  locals.features = {
    mojo: env.ENABLE_MOJO === 'true',
    ocr: env.ENABLE_OCR === 'true',
    aiCategorization: env.ENABLE_AI_CATEGORIZATION === 'true',
  };

  try {
    const authJsSession = await getAuthJsSessionFromServer(request, env.PUBLIC_APP_URL);
    let appUserFromAuthJs: User | null = null;
    if (authJsSession?.user) {
      appUserFromAuthJs = adaptAuthJsUserToAppUser(authJsSession.user);
      locals.user = appUserFromAuthJs;
      if (appUserFromAuthJs?.id) {
        const dbUser = await getAppUserFromDb(appUserFromAuthJs.id, env);
        if (dbUser) locals.user = dbUser;
        else if(appUserFromAuthJs) console.warn(`Middleware: User ID ${appUserFromAuthJs.id} from Auth.js session not found in DB.`);
      }
    } else {
      locals.user = null;
    }
    locals.session = adaptAuthJsSessionToAppSession(authJsSession, locals.user?.id || null);
  } catch (e) {
    console.error("Middleware: Error processing authentication state:", e);
    locals.session = null;
    locals.user = null;
  }

  const nonce = generateSecureNonce();
  locals.cspNonce = nonce;

  const isExemptCsrfPath = Array.from(CSRF_EXEMPT_PATH_PREFIXES).some(exemptPrefix =>
    url.pathname.startsWith(exemptPrefix)
  );

  if (!isExemptCsrfPath && env.CSRF_SECRET) {
    try {
      if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
        locals.csrfToken = await prepareCsrfToken(context);
      } else if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        const isValidCsrf = await validateCsrfRequest(context);
        if (!isValidCsrf) {
          console.warn(`Middleware: Invalid CSRF token for ${request.method} ${url.pathname} from IP ${request.headers.get('CF-Connecting-IP')}`);
          return errorToResponse(new ForbiddenError('Invalid security token. Please refresh and try again.', 'CSRF_INVALID'));
        }
      }
    } catch (csrfError: unknown) {
      console.error('Middleware: CSRF protection processing error:', csrfError);
      const appError = csrfError instanceof AppError ? csrfError : new AppError('Security token processing error.', 500, true, "CSRF_PROCESSING_ERROR");
      return errorToResponse(appError);
    }
  } else if (!isExemptCsrfPath && !env.CSRF_SECRET && env.ENVIRONMENT === 'production') {
    console.error(`CRITICAL SECURITY: CSRF_SECRET is not configured in production for non-exempt path: ${url.pathname}!`);
    // return errorToResponse(new AppError("Server security misconfiguration.", 500, true, "CSRF_CONFIG_ERROR"));
  }

  let response: Response;
  try {
    response = await next();
  } catch (error: unknown) {
    console.error(`Middleware: Error during next() for ${url.pathname} (RID: ${locals.requestId}):`, error);
    const appError = error instanceof AppError ? error : new AppError('An unexpected error occurred processing your request.', 500, true, "UNHANDLED_ROUTE_ERROR");
    return errorToResponse(appError);
  }

  const newHeaders = new Headers(response.headers);
  const isProd = env.ENVIRONMENT === "production";
  const isHtmlResponse = response.headers.get('Content-Type')?.includes('text/html');

  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-Frame-Options', 'DENY');
  newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');

  if (isProd) {
    newHeaders.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  if (isHtmlResponse) {
    // TODO URGENT: Strive to remove 'unsafe-inline' from style-src.
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net`,
      `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https: wss:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
      isProd ? "upgrade-insecure-requests" : ""
    ].filter(Boolean).join('; ');
    newHeaders.set('Content-Security-Policy', cspDirectives);
  }

  if (request.method === 'GET') {
    if (isHtmlResponse) {
      if (locals.user || locals.session) {
        newHeaders.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
        newHeaders.set('Pragma', 'no-cache');
        newHeaders.set('Expires', '0');
      } else {
        newHeaders.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      }
    } else if (!STATIC_ASSET_REGEX.test(url.pathname)) {
      if (locals.user || locals.session) {
        newHeaders.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
      } else {
        newHeaders.set('Cache-Control', 'public, max-age=60, s-maxage=60');
      }
    }
  }

  const duration = performance.now() - (locals.requestStartTime || requestStartTime);
  if (duration > MIDDLEWARE_PERF_THRESHOLD_MS && !STATIC_ASSET_REGEX.test(url.pathname)) {
    console.warn(`⚠️  Middleware for ${request.method} ${url.pathname} took ${duration.toFixed(2)}ms (RID: ${locals.requestId})`);
  }
  newHeaders.set('X-Request-ID', locals.requestId || 'unknown-request');
  newHeaders.set('Server-Timing', `mw;dur=${duration.toFixed(2)}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
});