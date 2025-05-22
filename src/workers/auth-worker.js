// src/workers/auth-worker.js
/**
 * Cloudflare Worker for specific authentication-related tasks.
 * This worker is NOT intended to be the primary Auth.js handler for user login/session management,
 * as that is typically handled by an Astro API route (e.g., /src/pages/api/auth/[...auth].ts).
 *
 * This worker might handle tasks like:
 * - API Key validation for backend services.
 * - Custom token generation or validation for specific internal purposes.
 * - Responding to auth-related events or cron triggers.
 */

// Helper for JSON responses
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// Placeholder for D1 database interactions.
// In a real scenario, you might import shared D1 query functions or use Drizzle here.
async function getUserById(db, userId) {
  if (!userId) return null;
  try {
    // This is a simplified query. Your actual DbUserRecord structure and query might differ.
    // Ensure this aligns with your DbUserRecord interface and users table.
    const userRecord = await db.prepare('SELECT id, email, role, verified_at FROM users WHERE id = ?')
      .bind(userId)
      .first();
    return userRecord;
  } catch (e) {
    console.error(`Error fetching user ${userId} from D1:`, e.message);
    return null;
  }
}

// Placeholder for API key validation logic
async function validateApiKey(db, apiKey) {
  if (!apiKey) return { isValid: false, error: "API key required" };
  try {
    // Example: Look up API key in a dedicated D1 table or compare against a secret
    // For simplicity, let's assume an API_KEYS table with 'key_value' and 'permissions'
    // This is a highly simplified example.
    // const apiKeyRecord = await db.prepare('SELECT permissions FROM api_keys WHERE key_value = ? AND active = 1')
    //   .bind(apiKey)
    //   .first();
    // if (apiKeyRecord) {
    //   return { isValid: true, permissions: apiKeyRecord.permissions };
    // }
    // For this example, let's use a hardcoded secret (NOT recommended for production - use Worker secrets)
    const VALID_API_KEY_HASH = "some-hashed-representation-of-a-key"; // Or compare directly if using secrets
    // In a real scenario, hash the incoming key and compare, or use a secure comparison method.
    // This example is illustrative.
    if (apiKey === "test-api-key-123") { // Replace with actual secure validation
        return { isValid: true, permissions: ["read:data"] };
    }

    return { isValid: false, error: "Invalid API key" };
  } catch(e) {
    console.error("Error during API key validation:", e.message);
    return { isValid: false, error: "API key validation failed" };
  }
}


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Simple routing based on path
    // Example: /auth-worker/validate-api-key
    // Example: /auth-worker/user-status?userId=...

    if (!env.DATABASE) {
      console.error("DATABASE binding not found in worker environment.");
      return jsonResponse({ success: false, error: "Server configuration error: Database unavailable." }, 500);
    }
    const db = env.DATABASE;

    try {
      if (request.method === 'POST' && url.pathname.startsWith('/auth-worker/validate-api-key')) {
        let apiKey;
        try {
            const body = await request.json();
            apiKey = body.apiKey;
        } catch (e) {
            return jsonResponse({ success: false, error: "Invalid JSON payload or missing apiKey" }, 400);
        }

        if (!apiKey) {
          return jsonResponse({ success: false, error: "apiKey field is required in JSON body" }, 400);
        }

        const result = await validateApiKey(db, apiKey);
        if (result.isValid) {
          return jsonResponse({ success: true, message: "API key is valid", permissions: result.permissions });
        } else {
          return jsonResponse({ success: false, error: result.error || "Invalid API key" }, 401);
        }
      }

      if (request.method === 'GET' && url.pathname.startsWith('/auth-worker/user-status')) {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return jsonResponse({ success: false, error: 'userId query parameter is required' }, 400);
        }

        const user = await getUserById(db, userId);
        if (user) {
          return jsonResponse({
            success: true,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              isVerified: !!user.verified_at, // SQL 'verified_at' is a timestamp or null
            },
          });
        } else {
          return jsonResponse({ success: false, error: 'User not found' }, 404);
        }
      }

      // Default: Route not found
      return jsonResponse({ success: false, error: 'Not Found. Available routes: /auth-worker/validate-api-key (POST), /auth-worker/user-status (GET)' }, 404);

    } catch (error) {
      console.error('Error in auth-worker:', error.message, error.stack);
      return jsonResponse({ success: false, error: 'An unexpected internal server error occurred.' }, 500);
    }
  },
};