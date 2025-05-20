// src/pages/api/auth/register.js
import { registerUser } from '@/lib/auth/auth'; // Using path alias
import { ZodError } from 'zod';

export async function onRequest({ request, env, context, cookies }) {
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

  // CSRF protection - Origin validation for API requests
  const origin = request.headers.get('Origin');
  const host = request.headers.get('Host');
  
  if (origin) {
    const url = new URL(origin);
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const isValidOrigin = (url.host === host) || (isLocalhost && url.host.includes('localhost'));
    
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

  // Basic rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  
  try {
    // Check rate limit using KV - implementation depends on your rate limiting strategy
    // This is a simple example, consider using Cloudflare's built-in rate limiting for production
    if (env.CONFIG_KV) {
      const rateKey = `ratelimit:register:${clientIP}`;
      const rateData = await env.CONFIG_KV.get(rateKey, { type: 'json' });
      
      const now = Date.now();
      const windowMs = 3600 * 1000; // 1 hour window
      const maxRequests = 5; // 5 registration attempts per hour from same IP
      
      let attempts = 0;
      let windowStart = now;
      
      if (rateData) {
        // Reset counter if window has expired
        if (now - rateData.windowStart > windowMs) {
          windowStart = now;
          attempts = 1;
        } else {
          windowStart = rateData.windowStart;
          attempts = rateData.attempts + 1;
          
          if (attempts > maxRequests) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Too many registration attempts. Please try again later.'
            }), {
              status: 429, // Too Many Requests
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(Math.ceil(windowMs / 1000))
              }
            });
          }
        }
      } else {
        // First attempt
        attempts = 1;
      }
      
      // Store rate limiting data
      await env.CONFIG_KV.put(rateKey, JSON.stringify({
        windowStart,
        attempts,
        lastAttempt: now
      }), {
        expirationTtl: 3600 // 1 hour in seconds
      });
    }

    const requestData = await request.json();

    // The registerUser function will handle Zod validation internally
    const result = await registerUser(env, requestData);

    if (!result.success) {
      // Determine status code based on error type
      let statusCode = 400; // Default to Bad Request
      
      if (result.error?.includes('already exists')) {
        statusCode = 409; // Conflict
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: result.error,
        errors: result.errors // Pass along Zod errors if present
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Successfully registered - log the event
    try {
      if (env.DATABASE && result.user?.id) {
        await env.DATABASE.prepare(
          'INSERT INTO activity_logs (user_id, action, ip_address, metadata, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          result.user.id,
          'user_registered',
          clientIP,
          JSON.stringify({ userAgent: request.headers.get('User-Agent') }),
          Math.floor(Date.now() / 1000)
        ).run();
      }
    } catch (logError) {
      // Don't fail the registration if logging fails
      console.error('Error logging registration event:', logError);
    }

    // Return success response with minimal user data
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name || null
      }
    }), {
      status: 201, // Created
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Registration API error:', error);
    
    // Handle specific error types
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
    
    // Generic error handler
    return new Response(JSON.stringify({
      success: false,
      error: 'An unexpected error occurred. Please try again later.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}