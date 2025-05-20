// src/middleware.js
/**
 * ProperAccount Middleware
 * Handles security headers, authentication state, CSRF protection, and request processing.
 */

import { getSessionFromRequest } from './lib/auth/session.js';
import { getUserBySessionId, extendUserSession } from './lib/auth/auth.js';

/**
 * Generates a cryptographically strong random nonce or token.
 * @param {number} size - Size of the random buffer in bytes. Default is 16.
 * @returns {string} A base64 encoded token.
 */
function generateSecureToken(size = 16) {
  const array = new Uint8Array(size);
  crypto.getRandomValues(array);
  // Convert to base64 for a more common format in CSP and tokens
  return btoa(Array.from(array, byte => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-') // URL-safe base64
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Creates an HMAC token for CSRF protection.
 * @param {string} value - The value to sign
 * @param {string} secret - The secret key for HMAC
 * @returns {Promise<string>} A signed token
 */
async function createHmacToken(value, secret) {
  // Convert strings to buffers for WebCrypto API
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    encoder.encode(value)
  );
  
  // Convert signature to base64 URL-safe format
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Validates an HMAC token for CSRF protection.
 * @param {string} value - The original value
 * @param {string} token - The HMAC token to verify
 * @param {string} secret - The secret key for HMAC
 * @returns {Promise<boolean>} True if valid, false otherwise
 */
async function validateHmacToken(value, token, secret) {
  try {
    const expectedToken = await createHmacToken(value, secret);
    return token === expectedToken;
  } catch (error) {
    console.error('HMAC validation error:', error);
    return false;
  }
}

export async function onRequest({ request, next, locals, cookies }) {
  // Initialize environment
  const env = locals.runtime?.env;
  const isProd = import.meta.env.PROD || process.env.NODE_ENV === 'production';
  const csrfSecret = env?.CSRF_SECRET || 'development-csrf-secret-change-in-production';
  
  // Generate a nonce for this request for CSP
  const nonce = generateSecureToken();
  locals.cspNonce = nonce;
  
  // Generate CSRF token and make available to templates
  if (request.method === 'GET') {
    const csrfToken = generateSecureToken(32);
    const timestamp = Date.now().toString();
    const csrfTokenHash = await createHmacToken(`${csrfToken}:${timestamp}`, csrfSecret);
    const fullCsrfToken = `${csrfToken}:${timestamp}:${csrfTokenHash}`;
    
    // Set CSRF cookie (HttpOnly for security)
    cookies.set('csrf', fullCsrfToken, {
      httpOnly: true,
      secure: isProd,
      path: '/',
      sameSite: 'Lax', // Lax allows GET requests with redirects from other sites
      maxAge: 3600 // 1 hour expiry for CSRF tokens
    });
    
    // Make CSRF token available to templates
    locals.csrfToken = fullCsrfToken;
  } 
  // Validate CSRF for state-changing requests
  else if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    // Skip CSRF validation for API endpoints that use their own authorization
    // or for webhook endpoints that can't provide CSRF tokens
    const url = new URL(request.url);
    const isApiEndpoint = url.pathname.startsWith('/api/');
    const hasAuthHeader = !!request.headers.get('Authorization');
    
    // Only validate CSRF for HTML form submissions
    const contentType = request.headers.get('Content-Type') || '';
    const isFormSubmission = contentType.includes('application/x-www-form-urlencoded') || 
                             contentType.includes('multipart/form-data');
    
    if (isFormSubmission && !isApiEndpoint && !hasAuthHeader) {
      let csrfValid = false;
      try {
        const csrfCookie = cookies.get('csrf')?.value;
        let formCsrfToken;
        
        // For form submissions, get the token from form data
        if (contentType.includes('application/x-www-form-urlencoded') || 
            contentType.includes('multipart/form-data')) {
          const formData = await request.clone().formData();
          formCsrfToken = formData.get('_csrf');
        }
        
        if (!csrfCookie || !formCsrfToken) {
          throw new Error('Missing CSRF token in cookie or form');
        }
        
        // Parse token parts
        const [cookieToken, cookieTimestamp, cookieHash] = csrfCookie.split(':');
        
        // Check if token is expired (1 hour max)
        const now = Date.now();
        const tokenAge = now - parseInt(cookieTimestamp, 10);
        if (tokenAge > 3600000) { // 1 hour in milliseconds
          throw new Error('CSRF token expired');
        }
        
        // Validate the cookie's hash
        const cookieHashValid = await validateHmacToken(
          `${cookieToken}:${cookieTimestamp}`, 
          cookieHash, 
          csrfSecret
        );
        
        // Check if form token matches cookie token
        const tokensMatch = formCsrfToken === csrfCookie;
        
        csrfValid = cookieHashValid && tokensMatch;
        
        if (!csrfValid) {
          return new Response('Invalid CSRF token', { status: 403 });
        }
      } catch (error) {
        console.error('CSRF validation error:', error);
        return new Response('Invalid or missing CSRF token', { status: 403 });
      }
    }
  }
  
  // Session Management
  try {
    const sessionToken = cookies.get('session-token')?.value;
    
    if (sessionToken) {
      // Get session data
      const sessionData = await getSessionFromRequest(request, env);
      
      if (sessionData) {
        // Check if session is valid
        const now = Math.floor(Date.now() / 1000);
        
        if (sessionData.session?.expiresAt && sessionData.session.expiresAt < now) {
          // Session expired - clear cookie
          cookies.delete('session-token', { path: '/' });
        } else {
          // Valid session - set user and session data in locals
          locals.user = sessionData.user;
          locals.sessionId = sessionData.sessionId;
          locals.session = sessionData.session;
          
          // Extend session if it's close to expiry (within 20% of total lifetime)
          if (sessionData.session?.expiresAt && sessionData.session.createdAt) {
            const sessionDuration = sessionData.session.expiresAt - sessionData.session.createdAt;
            const sessionRemaining = sessionData.session.expiresAt - now;
            
            // If less than 20% of session time remains, extend it
            if (sessionRemaining < sessionDuration * 0.2) {
              try {
                // Extend by the original duration
                const extendedSession = await extendUserSession(env, sessionData.sessionId);
                
                if (extendedSession) {
                  // Update the session cookie
                  const cookieOptions = {
                    path: '/',
                    httpOnly: true,
                    secure: isProd,
                    sameSite: 'Lax',
                  };
                  
                  // Set expires if available
                  if (extendedSession.expiresAt) {
                    cookieOptions.expires = new Date(extendedSession.expiresAt * 1000);
                  }
                  
                  cookies.set('session-token', sessionData.sessionId, cookieOptions);
                  
                  // Update session data in locals
                  locals.session = extendedSession;
                }
              } catch (extendError) {
                console.error('Error extending session:', extendError);
              }
            }
          }
        }
      } else {
        // Invalid session - clear cookie
        cookies.delete('session-token', { path: '/' });
      }
    }
  } catch (error) {
    console.error('Session processing error:', error);
    // Continue without session - will render as logged out
  }

  // Proceed to the next middleware or the page/API route
  const response = await next();

  // Clone the response to modify headers
  const newResponse = new Response(response.body, response);

  // Standard Security Headers
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY'); // Prevents clickjacking
  // X-XSS-Protection is deprecated and can be harmful; a strong CSP is preferred.
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()'); 
  
  // Add security headers for HTTP to HTTPS upgrades
  if (isProd) {
    newResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'); // 2 years HSTS
  }

  // Content Security Policy (CSP)
  // CSP helps prevent XSS attacks by controlling what resources can be loaded.
  // Using a nonce allows specific inline scripts/styles required by Astro or UI libraries.
  const cspDirectives = [
    "default-src 'self'", // By default, only allow resources from the same origin.
    `script-src 'self' 'nonce-${nonce}'`, // Allow 'self' and scripts with the generated nonce.
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`, // Allow 'self', styles with nonce, and Google Fonts.
    "font-src 'self' https://fonts.gstatic.com", // For Google Fonts.
    "img-src 'self' data:", // Allow 'self' and data URIs. More restrictive.
    "connect-src 'self'", // Allow connections (fetch, XHR, WebSockets) to 'self'.
    "object-src 'none'", // Disallow <object>, <embed>, <applet>.
    "base-uri 'self'",   // Restricts the <base> tag.
    "form-action 'self'", // Restricts where forms can submit data.
    "frame-ancestors 'none'", // Prevents clickjacking.
    "block-all-mixed-content", // Prevents loading HTTP assets on HTTPS pages.
    "upgrade-insecure-requests" // Attempts to upgrade HTTP requests to HTTPS.
  ];

  // Enhanced CSP for Alpine.js and HTMX - allow needed features
  // These frameworks need specific CSP configurations
  if (true) { // Set a condition if you want to control this better
    // For Alpine.js evaluation of expressions
    cspDirectives[1] = `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`;
    
    // For HTMX to work properly with connect-src
    cspDirectives[5] = "connect-src 'self' https:";
  }

  // Apply CSP only in production.
  if (isProd) {
    newResponse.headers.set('Content-Security-Policy', cspDirectives.join('; '));
  } else {
    // More relaxed CSP for development to accommodate HMR and dev tools
    const devCspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'`, // Allow inline and eval for development
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self' ws: wss:", // Allow WebSockets for HMR
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ];
    newResponse.headers.set('Content-Security-Policy', devCspDirectives.join('; '));
  }

  // Set cache control for HTML responses
  if (request.method === 'GET' && response.headers.get('Content-Type')?.includes('text/html')) {
    // Set different cache controls based on authentication
    if (locals.user) {
      // Don't cache authenticated pages
      newResponse.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    } else {
      // Public pages can be cached briefly
      newResponse.headers.set('Cache-Control', 'public, max-age=60, s-maxage=30');
    }
  }

  return newResponse;
}