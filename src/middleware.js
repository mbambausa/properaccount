// src/middleware.js

/**
 * Generates a cryptographically strong random nonce.
 * This nonce can be used in Content Security Policy headers to allow specific inline scripts or styles.
 * @returns {string} A base64 encoded nonce.
 */
function generateNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Convert to base64 for a more common nonce format in CSP.
  // Using hex is also fine, but base64 is often seen.
  let str = '';
  array.forEach((byte) => {
    str += String.fromCharCode(byte);
  });
  return btoa(str);
}

export async function onRequest({ request, next, locals, cookies }) {
  // Generate a nonce for this request and make it available to Astro components/layouts
  // This allows <script> and <style> tags to use this nonce for CSP.
  const nonce = generateNonce();
  locals.cspNonce = nonce;

  // Proceed to the next middleware or the page/API route
  const response = await next();

  // Clone the response to modify headers
  const newResponse = new Response(response.body, response);

  // Standard Security Headers
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY'); // Prevents clickjacking
  // X-XSS-Protection is deprecated and can be harmful; a strong CSP is preferred.
  // newResponse.headers.set('X-XSS-Protection', '1; mode=block');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'); // Restrict sensitive APIs

  // Content Security Policy (CSP)
  // CSP helps prevent XSS attacks by controlling what resources can be loaded.
  // Using a nonce allows specific inline scripts/styles required by Astro or UI libraries.
  const cspDirectives = [
    "default-src 'self'", // By default, only allow resources from the same origin.
    // For scripts: allow 'self' and scripts with the generated nonce.
    // Astro's <ViewTransitions /> and Alpine.js might require nonce for inline styles/scripts if 'unsafe-inline' is removed.
    // If you load scripts from CDNs (e.g., for analytics, fonts not handled by Astro), add their domains here.
    // Example: `script-src 'self' 'nonce-${nonce}' https://your-cdn.com;`
    // Your project plan uses Alpine.js via @astrojs/alpinejs, which should be bundled ('self').
    // HTMX is also a direct dependency.
    `script-src 'self' 'nonce-${nonce}'`, // Removed 'unsafe-inline'. Astro's tooling should handle its scripts.
                                         // Removed https://cdn.jsdelivr.net as it's not explicitly used.

    // For styles: allow 'self', styles with the nonce, and Google Fonts.
    // UnoCSS is processed at build time and should be covered by 'self'.
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`, // Removed 'unsafe-inline'.
    "font-src 'self' https://fonts.gstatic.com", // For Google Fonts.
    // For images: allow 'self', data URIs (for small inline images), and all HTTPS sources.
    // Consider tightening 'https:' if you know all your image sources.
    "img-src 'self' data: https:",
    // For connections (fetch, XHR, WebSockets): allow 'self'.
    // If your API is on a different subdomain (e.g., api.properaccount.com), add it: `https://api.properaccount.com`.
    // Since API routes are in `src/pages/api/`, they are same-origin.
    "connect-src 'self'",
    "object-src 'none'", // Disallow <object>, <embed>, <applet> for security.
    "base-uri 'self'",   // Restricts the <base> tag.
    "form-action 'self'", // Restricts where forms can submit data.
    "frame-ancestors 'none'", // Prevents clickjacking (stronger than X-Frame-Options: DENY).
    "block-all-mixed-content", // Prevents loading HTTP assets on HTTPS pages.
    "upgrade-insecure-requests" // Attempts to upgrade HTTP requests to HTTPS.
  ];

  // Apply CSP only in production. For development, Astro's HMR and dev tools might require more lenient settings.
  // `import.meta.env.PROD` is true when `astro build` is run.
  // `import.meta.env.DEV` is true when `astro dev` is run.
  if (import.meta.env.PROD) {
    newResponse.headers.set('Content-Security-Policy', cspDirectives.join('; ')); // Use semicolon as separator
  }
  // In development, Astro might inject inline styles/scripts for HMR.
  // If you encounter CSP issues in dev, you might set a more relaxed policy or none.
  // Example for dev:
  // else {
  //   newResponse.headers.set('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: ws: https://fonts.googleapis.com https://fonts.gstatic.com;");
  // }


  // Add CSRF token to cookies if not already present or if it needs to be refreshed.
  // This part is usually handled by your CSRF utility when a form page is rendered
  // or an API endpoint expects a token.
  // The `prepareCsrf` function from `src/utils/csrf.ts` should be called in relevant page/layout
  // server-side scripts to generate and set the cookie.
  // This middleware is primarily for setting *response headers*.

  // Example of how `locals` can be used by subsequent Astro components or API routes:
  // locals.someData = "This data is available in Astro.locals";

  return newResponse;
}