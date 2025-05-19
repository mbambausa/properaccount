// src/middleware.js

// Helper to generate a nonce. In a real application, ensure this is
// a cryptographically strong random string, unique per request.
// This can be stored in Astro.locals to be used in your .astro files.
function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function onRequest({ request, next, env, locals }) {
  // Generate a nonce for this request
  // const nonce = generateNonce();
  // locals.cspNonce = nonce; // Make it available to Astro components

  const response = await next();
  const newResponse = new Response(response.body, response);

  // Standard Security Headers
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('X-XSS-Protection', '1; mode=block'); // Often redundant with strong CSP
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); //

  // Content Security Policy (CSP)
  // Strive to remove 'unsafe-inline'. Use nonces or hashes.
  // Astro's <ViewTransitions /> might inject inline styles for transitions.
  // Alpine.js might also use inline event handlers that could be affected by a very strict CSP
  // if it doesn't use its CSP-compatible build or if 'unsafe-eval' is also disallowed.

  const cspDirectives = [
    "default-src 'self'", // Restrict by default to own origin
    // For scripts, ideally use nonces or hashes.
    // `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net;` // Example with nonce
    // Astro's built-in scripts might require specific hashes if nonces aren't easily integrated.
    // The 'unsafe-inline' is kept from your original for now, but should be reviewed.
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;", // // REVIEW THIS
    // For styles, also aim to remove 'unsafe-inline'.
    // `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com;` // Example with nonce
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;", // // REVIEW THIS
    "font-src 'self' https://fonts.gstatic.com;", //
    "img-src 'self' data: https:;", // // 'https:' is broad, tighten if possible
    "connect-src 'self' https://api.properaccount.com;", // // Ensure this is your intended API endpoint
    "object-src 'none';", // Recommended: Disallow <object>, <embed>, <applet>
    "base-uri 'self';",   // Recommended: Restricts <base> tag
    "form-action 'self';", // Recommended: Restricts where forms can submit
    "frame-ancestors 'none';", // Recommended: Prevents clickjacking (similar to X-Frame-Options: DENY)
    "block-all-mixed-content;", // Recommended: Prevent loading HTTP assets on HTTPS pages
    "upgrade-insecure-requests;" // Recommended: Requests HTTP resources over HTTPS
  ];

  if (env.NODE_ENV !== 'development') {
    newResponse.headers.set('Content-Security-Policy', cspDirectives.join(' '));
  }
  // For development, you might want a more relaxed CSP or none at all
  // to avoid issues with HMR, devtools, etc. Your original logic to only apply in non-dev is kept.

  return newResponse;
}