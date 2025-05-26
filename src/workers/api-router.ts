// src/workers/api-router.ts
/**
 * Main API Router Worker (revised for Auth.js & proper CORS)
 */
import type { CloudflareEnv } from '../env';

// import your actual handlers for real endpoints
// import { handlePasswordToolsRoute } from './handlers/auth-tools-handler';
// import { handleUserProfileRoute } from './handlers/user-profile-handler';

export default {
  async fetch(
    request: Request,
    env: CloudflareEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Dynamic CORS origin for security
    let acao = env.ENVIRONMENT === 'development'
      ? 'http://localhost:4321'
      : env.PUBLIC_APP_URL || '';

    // If request Origin matches, allow it; else restrict for production
    const requestOrigin = request.headers.get('Origin');
    if (
      env.ENVIRONMENT !== 'development' &&
      requestOrigin &&
      acao &&
      requestOrigin !== acao
    ) {
      // Optionally: restrict to only acao, or add allow-list logic if needed
      acao = ''; // Empty string will block in production if origin mismatches
    }
    if (!acao && env.ENVIRONMENT === 'production') {
      console.warn("CORS Allow-Origin not configured for production!");
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': acao,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      // ----- ROUTING -----
      // Auth.js handles all /api/auth/* routes elsewhere, so do not process them here
      if (path.startsWith('/api/auth/')) {
        return new Response(
          JSON.stringify({ error: "Not Found" }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (path.startsWith('/api/auth-tools/')) {
        // Password reset, email verification, etc.
        // response = await handlePasswordToolsRoute(request, env, ctx);
        response = new Response(
          JSON.stringify({ message: 'Password tools placeholder' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } else if (path.startsWith('/api/user/profile')) {
        // Profile update, fetch, etc.
        // response = await handleUserProfileRoute(request, env, ctx);
        response = new Response(
          JSON.stringify({ message: 'User profile placeholder' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } else if (path === '/api/health') {
        response = new Response(
          JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: env.ENVIRONMENT || 'unknown'
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        response = new Response(
          JSON.stringify({ error: 'Not Found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // ----- Merge CORS headers -----
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        if (value) headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', detail: errorMessage }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  },
};
