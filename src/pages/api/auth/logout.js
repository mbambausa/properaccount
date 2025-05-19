// src/pages/api/auth/logout.js - Logout endpoint for ending user sessions
export async function onRequest({ request, env, cookies }) {
  try {
    // Only allow POST method for logout (to prevent CSRF)
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the session token from cookies
    const sessionToken = cookies.get('session-token')?.value;
    
    if (sessionToken) {
      // Delete session from database
      const db = env.DATABASE;
      await db.prepare(
        'DELETE FROM sessions WHERE id = ?'
      ).bind(sessionToken).run();
      
      // Clear the session cookie
      cookies.delete('session-token', {
        path: '/'
      });
    }
    
    // Return success response even if no session was found (idempotent)
    return new Response(JSON.stringify({
      success: true,
      message: 'Successfully logged out'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}