// src/middleware.ts
/**
 * ProperAccount Middleware (TypeScript)
 * Handles security headers, authentication state, CSRF protection, and request processing.
 */

import type { APIContext, MiddlewareNext } from 'astro';
import type { CloudflareEnv } from './env';
import { getSessionFromRequest, extendSession, deleteSession } from './lib/auth/session';
import { prepareCsrfToken, validateCsrfRequest } from './utils/csrf';
import type { Session } from './types/auth';

// Explicitly define the types expected in locals to use the Session type
interface AppLocals {
  user?: any;
  sessionId?: string;
  session?: Session; // This ensures the Session type is used
  csrfToken?: string;
  cspNonce?: string;
  runtime?: {
    env: CloudflareEnv;
  };
}

function generateSecureNonce(size = 16): string {
  const array = new Uint8Array(size);
  crypto.getRandomValues(array);
  let base64 = btoa(String.fromCharCode.apply(null, Array.from(array)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function onRequest(
  context: APIContext<AppLocals>, // Add type parameter to APIContext
  next: MiddlewareNext
): Promise<Response> {
  const { request, locals, cookies } = context;
  const env = locals.runtime?.env as CloudflareEnv | undefined;
  const isProd = import.meta.env.PROD;

  if (!env) {
    console.error("Middleware FATAL: CloudflareEnv not found in context.locals.runtime.");
    return new Response("Server configuration error.", { status: 500 });
  }

  const nonce = generateSecureNonce();
  locals.cspNonce = nonce;

  try {
    if (request.method === 'GET') {
      locals.csrfToken = await prepareCsrfToken(context);
    } else if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      const url = new URL(request.url);
      const isApiAuthEndpoint = url.pathname.startsWith('/api/auth/');
      const isApiJsonRequest = request.headers.get('Content-Type')?.includes('application/json') && url.pathname.startsWith('/api/');
      if (!isApiAuthEndpoint && !isApiJsonRequest) {
        if (!await validateCsrfRequest(context)) {
          console.warn(`CSRF validation failed for ${request.method} ${url.pathname}`);
          return new Response('Invalid CSRF token.', { status: 403 });
        }
      }
    }
  } catch (csrfError) {
    console.error('CSRF middleware processing error:', csrfError);
    return new Response('CSRF processing error.', { status: 500 });
  }

  try {
    const sessionInfo = await getSessionFromRequest(request, env);
    if (sessionInfo) {
      const { session: currentSession, user, sessionId } = sessionInfo;
      const nowSeconds = Math.floor(Date.now() / 1000);

      if (currentSession.expiresAt < nowSeconds) {
        cookies.delete('session-token', { path: '/' });
        locals.user = undefined;
        locals.sessionId = undefined;
        locals.session = undefined;
        await deleteSession(env, sessionId);
      } else {
        locals.user = user;
        locals.sessionId = sessionId;
        locals.session = currentSession;

        if (currentSession.createdAt) {
          const sessionDuration = currentSession.expiresAt - currentSession.createdAt;
          const sessionRemaining = currentSession.expiresAt - nowSeconds;
          const twentyPercentDuration = sessionDuration * 0.2;

          if (sessionRemaining < twentyPercentDuration && sessionRemaining > 0) {
            try {
              const extendedSessionData = await extendSession(env, sessionId);
              if (extendedSessionData) {
                locals.session = extendedSessionData;
              }
            } catch (extendError) {
              console.error('Error extending session in middleware:', extendError);
            }
          }
        }
      }
    } else {
      locals.user = undefined;
      locals.sessionId = undefined;
      locals.session = undefined;
      if (cookies.has('session-token')) {
        cookies.delete('session-token', { path: '/' });
      }
    }
  } catch (sessionError) {
    console.error('Session processing error in middleware:', sessionError);
    locals.user = undefined;
    locals.sessionId = undefined;
    locals.session = undefined;
  }

  const responseFromNext = await next();
  const finalResponse = responseFromNext;

  finalResponse.headers.set('X-Content-Type-Options', 'nosniff');
  finalResponse.headers.set('X-Frame-Options', 'DENY');
  finalResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  finalResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()');

  if (isProd) {
    finalResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  const baseCspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https:`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  const devRelaxations = [
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*`,
    `connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:* https:`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  ];

  const cspString = isProd
    ? baseCspDirectives.join('; ')
    : [...baseCspDirectives.slice(0,1), ...devRelaxations, ...baseCspDirectives.slice(3)].join('; ');

  finalResponse.headers.set('Content-Security-Policy', cspString);

  if (request.method === 'GET' && finalResponse.headers.get('Content-Type')?.includes('text/html')) {
    if (locals.user) {
      finalResponse.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
    } else {
      finalResponse.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    }
  }

  return finalResponse;
}