// src/pages/api/auth/login.js - Login endpoint for user authentication
export async function onRequest({ request, env, cookies }) {
  try {
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

    // Parse request body
    const data = await request.json();
    
    // Validate required fields
    if (!data.email || !data.password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: email and password are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Lookup user by email
    const db = env.DATABASE;
    const user = await db.prepare(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?'
    ).bind(data.email.toLowerCase()).first();
    
    // User not found or password doesn't match
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email or password'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify password
    const passwordMatches = await verifyPassword(data.password, user.password_hash);
    
    if (!passwordMatches) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email or password'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate session token
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    // Store session in database
    await db.prepare(
      'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(
      sessionId,
      user.id,
      now.toISOString(),
      expiresAt.toISOString()
    ).run();
    
    // Set session cookie
    cookies.set('session-token', sessionId, {
      path: '/',
      expires: expiresAt,
      httpOnly: true,
      secure: true,
      sameSite: 'strict'
    });
    
    // Return success response (without sending back sensitive information)
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Password verification function
async function verifyPassword(password, storedHash) {
  // In a real implementation, this would use the same algorithm as the hashPassword function
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Use SHA-256 for example (in production, use proper password verification)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex === storedHash;
}