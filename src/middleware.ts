// src/middleware.ts
import type { APIContext, MiddlewareNext } from 'astro';
import type { CloudflareEnv } from './env';
import { prepareCsrfToken, validateCsrfRequest } from './utils/csrf';
import type { Session as AuthJsSession, User as AuthJsUser } from '@auth/core/types';
import type { Session, User } from './types/auth';

// Performance tracking for middleware
const MIDDLEWARE_PERF_THRESHOLD = 5; // ms

// Utility to generate a CSP nonce
function generateSecureNonce(size = 16): string {
  const array = new Uint8Array(size);
  crypto.getRandomValues(array);
  // More efficient base64 encoding
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// CSRF exempted paths
const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/',
  '/api/webhook/',
  '/api/health',
  '/api/status'
]);

// Static asset paths
const STATIC_ASSET_REGEX = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i;

// Type adapter to convert Auth.js session to our custom session type
function adaptAuthJsSession(authSession: AuthJsSession | null): Session | null {
  if (!authSession?.user) return null;
  
  const now = Date.now();
  const user = adaptAuthJsUser(authSession.user);
  
  // Create a session that matches our custom type
  return {
    id: crypto.randomUUID(), // Generate a unique session ID
    userId: user.id,
    expiresAt: authSession.expires ? new Date(authSession.expires).getTime() : now + (24 * 60 * 60 * 1000),
    createdAt: now,
  };
}

// Type adapter for Auth.js user to our custom user type
function adaptAuthJsUser(authUser: AuthJsUser): User {
  const now = Date.now();
  
  return {
    id: authUser.id || authUser.email || crypto.randomUUID(),
    email: authUser.email || '',
    name: authUser.name || null,
    // Remove image since it's not in your User type
    role: 'user', // Default role, you might want to get this from session data
    createdAt: now,
    updatedAt: now,
  };
}

// Import the auth instance from your auth file
async function getAuthSession(request: Request): Promise<AuthJsSession | null> {
  try {
    // This assumes you have a method to get the session
    // You might need to adjust based on your auth setup
    const authUrl = new URL('/api/auth/session', request.url);
    const response = await fetch(authUrl, {
      headers: request.headers,
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Failed to get auth session:', error);
    return null;
  }
}

// Helper to get user from session
async function getUserFromSession(session: Session | null, env: CloudflareEnv): Promise<User | null> {
  if (!session) return null;
  
  // You would typically fetch the user from your database here
  // For now, returning null - implement based on your user service
  try {
    // Example: const user = await userService.getById(session.userId);
    // return user;
    return null;
  } catch (error) {
    console.error('Failed to get user from session:', error);
    return null;
  }
}

export async function onRequest(context: APIContext, next: MiddlewareNext): Promise<Response> {
  const startTime = performance.now();
  
  if (!context.locals) context.locals = {};
  const { request, locals } = context;
  const env = locals.runtime?.env as CloudflareEnv | undefined;
  const isProd = import.meta.env.PROD;
  const url = new URL(request.url);

  // Skip middleware for static assets
  if (STATIC_ASSET_REGEX.test(url.pathname)) {
    return next();
  }

  if (!env) {
    console.error("Middleware FATAL: CloudflareEnv not found.");
    return new Response("Server configuration error.", { status: 500 });
  }

  // --- Auth.js Session Handling ---
  try {
    const authJsSession = await getAuthSession(request);
    const session = adaptAuthJsSession(authJsSession);
    locals.session = session;
    
    // Get user from session
    const user = await getUserFromSession(session, env);
    locals.user = user;
  } catch (e) {
    console.error("Error fetching session in middleware:", e);
    locals.session = null;
    locals.user = null;
  }

  // --- CSP NONCE ---
  const nonce = generateSecureNonce();
  locals.cspNonce = nonce;

  // --- CSRF Protection ---
  const isExemptPath = Array.from(CSRF_EXEMPT_PATHS).some(path => 
    url.pathname.startsWith(path)
  );

  try {
    if (request.method === 'GET' && !isExemptPath) {
      locals.csrfToken = await prepareCsrfToken(context);
    } else if (
      ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method) &&
      !isExemptPath
    ) {
      const valid = await validateCsrfRequest(context);
      if (!valid) {
        return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  } catch (csrfError) {
    console.error('CSRF middleware error:', csrfError);
    return new Response(JSON.stringify({ error: 'CSRF processing error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // --- Main Response ---
  let response: Response;
  try {
    response = await next();
  } catch (error) {
    console.error('Middleware error during next():', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // --- Security Headers ---
  const newHeaders = new Headers(response.headers);
  
  // Basic security headers
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-Frame-Options', 'DENY');
  newHeaders.set('X-XSS-Protection', '1; mode=block');
  newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newHeaders.set('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  
  // HSTS for production only
  if (isProd) {
    newHeaders.set('Strict-Transport-Security', 
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  // --- Content Security Policy (CSP) ---
  const isHtml = response.headers.get('Content-Type')?.includes('text/html');
  if (isHtml) {
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net`,
      `style-src 'self' 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https: wss:",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "worker-src 'self' blob:",
      isProd ? "upgrade-insecure-requests" : ""
    ].filter(Boolean);
    
    newHeaders.set('Content-Security-Policy', cspDirectives.join('; '));
  }

  // --- Cache-Control ---
  if (request.method === 'GET' && isHtml) {
    if (locals.user) {
      // Authenticated users get no cache
      newHeaders.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
      newHeaders.set('Pragma', 'no-cache');
      newHeaders.set('Expires', '0');
    } else {
      // Public pages get short cache
      newHeaders.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    }
  }

  // --- Performance Monitoring ---
  const duration = performance.now() - startTime;
  if (duration > MIDDLEWARE_PERF_THRESHOLD) {
    console.warn(`⚠️ Middleware took ${duration.toFixed(2)}ms for ${url.pathname}`);
  }
  newHeaders.set('Server-Timing', `middleware;dur=${duration.toFixed(2)}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}