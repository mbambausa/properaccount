// src/pages/api/auth/login.js
import { loginUser } from '@/lib/auth/auth';
import { loginSchema } from '@/lib/validation/schemas/auth';
import { ZodError } from 'zod';

export async function onRequest({ request, env, cookies }) {
  // Only allow POST method for security
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Check CSRF protection
    // This could use a CSRF token from headers or a double-submit pattern
    const origin = request.headers.get('Origin');
    const host = request.headers.get('Host');
    
    // Basic CSRF check - if this is a browser-based request, origin should match host
    // For API requests from your own frontend, the Origin header should be present
    if (origin) {
      const url = new URL(origin);
      // In production, ensure the origin matches your app's domain
      // Allow localhost in development for testing
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
      const isValidOrigin = (url.host === host) || 
                           (isLocalhost && url.host.includes('localhost'));
      
      if (!isValidOrigin) {
        console.warn(`CSRF protection: Invalid origin ${origin} for host ${host}`);
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid request origin'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const requestData = await request.json();

    // The loginUser function handles validation internally
    const result = await loginUser(env, requestData);

    if (!result.success) {
      return new Response(JSON.stringify({
        success: false,
        error: result.error || 'Invalid email or password',
        errors: result.errors // Pass along Zod errors if present
      }), {
        status: 401, // Unauthorized for login failures
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Set session cookie
    if (result.sessionId) {
      // Determine session expiration and cookie settings
      let sessionDuration = 24 * 60 * 60 * 1000; // 1 day in milliseconds (default)
      
      // If rememberMe was true, use a longer duration for the cookie
      if (requestData.rememberMe) {
        sessionDuration = 30 * 24 * 60 * 60 * 1000; // 30 days
      }
      
      // Get actual session expiration time from KV if possible
      try {
        const sessionData = await env.SESSION_KV.get(`session:${result.sessionId}`, {type: "json"});
        if (sessionData && sessionData.expiresAt) {
          // Use the actual expiration time from the session
          const expiryTimestamp = sessionData.expiresAt * 1000; // Convert seconds to milliseconds
          const cookieExpiresDate = new Date(expiryTimestamp);
          
          // Set cookie with session data
          setCookieWithSecureDefaults(cookies, 'session-token', result.sessionId, {
            expires: cookieExpiresDate,
            maxAge: Math.floor((expiryTimestamp - Date.now()) / 1000) // Convert ms to seconds
          });
        } else {
          // Fallback to default duration
          setCookieWithSecureDefaults(cookies, 'session-token', result.sessionId, {
            maxAge: Math.floor(sessionDuration / 1000) // Convert ms to seconds
          });
        }
      } catch (error) {
        console.error('Error retrieving session data from KV:', error);
        // Fallback to default duration
        setCookieWithSecureDefaults(cookies, 'session-token', result.sessionId, {
          maxAge: Math.floor(sessionDuration / 1000) // Convert ms to seconds
        });
      }
    }

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      user: result.user
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Login API error:', error);
     if (error instanceof ZodError) {
        return new Response(JSON.stringify({
            success: false,
            error: 'Validation failed',
            errors: error.errors,
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Helper function to set cookie with secure defaults
 * @param {Object} cookies - The cookies object from Cloudflare
 * @param {string} name - The cookie name
 * @param {string} value - The cookie value
 * @param {Object} options - Additional cookie options
 */
function setCookieWithSecureDefaults(cookies, name, value, options = {}) {
  // Default settings for security
  const defaults = {
    path: '/',
    httpOnly: true,
    secure: true, // Always set secure in production
    sameSite: 'Lax' // Changed from Strict to Lax to allow redirects from external sites
  };

  // For development environments, check explicitly
  if (env?.ENVIRONMENT === 'development' || 
      (typeof location !== 'undefined' && location.hostname === 'localhost')) {
    defaults.secure = false; // Allow non-HTTPS in local development only
  }

  // Merge provided options with defaults
  const cookieOptions = { ...defaults, ...options };
  
  // Set the cookie
  cookies.set(name, value, cookieOptions);
}