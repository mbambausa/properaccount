// src/pages/api/auth/register.js - Registration endpoint for new users
export async function onRequest({ request, env }) {
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
    if (!data.email || !data.password || !data.name) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: email, password, and name are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email format'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Password requirements
    if (data.password.length < 8) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Password must be at least 8 characters'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user already exists
    const db = env.DATABASE;
    const existingUser = await db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(data.email).first();
    
    if (existingUser) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User with this email already exists'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Hash the password
    const passwordHash = await hashPassword(data.password);
    
    // Generate a unique ID for the new user
    const userId = crypto.randomUUID();
    
    // Insert new user into database
    await db.prepare(
      'INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      userId,
      data.name,
      data.email.toLowerCase(),
      passwordHash,
      new Date().toISOString(),
      new Date().toISOString()
    ).run();
    
    // Return success response (without sending back sensitive information)
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: userId,
        name: data.name,
        email: data.email
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Password hashing function
async function hashPassword(password) {
  // In a real implementation, use a proper password hashing algorithm
  // like bcrypt, Argon2, or PBKDF2. For example with Web Crypto API:
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Use SHA-256 for example (note: in production, use a proper password hashing algorithm with salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}