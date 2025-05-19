// src/pages/api/auth/register.js
import { registerUser } from '@lib/auth/auth'; // Using path alias
import { registerUserSchema } from '@lib/validation/schemas/auth'; // Using path alias
import { ZodError } from 'zod';

export async function onRequest({ request, env }) {
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

    // Validate with Zod (moved to registerUser function in lib/auth/auth.ts)
    // The registerUser function will now handle Zod validation internally.

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

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      user: result.user // User object from registerUser function
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Registration API error:', error);
    // If the error is a ZodError re-thrown from the lib for some reason, handle it
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