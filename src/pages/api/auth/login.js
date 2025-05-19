// src/pages/api/auth/login.js
import { loginUser } from '@lib/auth/auth'; // Using path alias
import { loginSchema } from '@lib/validation/schemas/auth'; // Using path alias
import { ZodError } from 'zod';

export async function onRequest({ request, env, cookies }) {
  // Only allow POST method
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
    const requestData = await request.json();

    // Validate with Zod (moved to loginUser function in lib/auth/auth.ts)
    // The loginUser function will now handle Zod validation internally.

    const result = await loginUser(env, requestData);

    if (!result.success) {
      return new Response(JSON.stringify({
        success: false,
        error: result.error || 'Invalid email or password', // Provide a generic message for auth failure
        errors: result.errors // Pass along Zod errors if present
      }), {
        status: 401, // Unauthorized for login failures
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Set session cookie
    if (result.sessionId) {
      const expiresAt = new Date();
      // Determine expiration based on rememberMe (defaulted in loginUser if not explicit)
      // Assuming session duration is handled by createSession, which is called by loginUser.
      // For cookie, use the session's actual expiration.
      // We need to fetch the session to get its actual expiresAt if loginUser doesn't return it.
      // For simplicity, let's assume loginUser's session creation implies standard duration
      // or we get expiry from the session object if it was returned.
      // For a robust solution, the session object returned from createSession should contain expiresAt.
      // Let's assume a default 30-day cookie if rememberMe was true (which loginUser handles internally)
      // The session TTL is handled in `createSession`. Cookie expiry should ideally match.
      const sessionData = await env.SESSION_KV.get(`session:${result.sessionId}`, {type: "json"});
      let cookieExpiresDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
      if (sessionData && (sessionData as any).expiresAt) {
        cookieExpiresDate = new Date((sessionData as any).expiresAt * 1000);
      }


      cookies.set('session-token', result.sessionId, {
        path: '/',
        expires: cookieExpiresDate,
        httpOnly: true,
        secure: request.url.startsWith('https:'), // Set secure only if on HTTPS
        sameSite: 'Strict'
      });
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