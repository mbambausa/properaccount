// src/middleware.js
export function onRequest({ request, next, env }) {
  // Process the request with the rest of the middleware chain and Astro route
  return next().then(response => {
    // Clone the response so we can modify headers
    const newResponse = new Response(response.body, response);
    
    // Add security headers
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('X-XSS-Protection', '1; mode=block');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Add Content Security Policy if not in dev mode
    if (env.NODE_ENV !== 'development') {
      newResponse.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.properaccount.com;"
      );
    }
    
    return newResponse;
  });
}