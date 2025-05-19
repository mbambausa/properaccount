// env.d.ts
/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />
/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DATABASE: D1Database;
  CONFIG_KV: KVNamespace;
  REPORT_CACHE_KV: KVNamespace;
  SESSION: KVNamespace; // Assuming you named the binding 'SESSION' for the KV session store
  DOCUMENTS_BUCKET: R2Bucket;
  BACKGROUND_TASKS_QUEUE: Queue;

  // Secrets (should match what you set with `wrangler secret put`)
  JWT_SECRET: string;
  SESSION_SECRET: string; // <--- ADD THIS LINE if not already present
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // CSRF_SECRET?: string; // Add if you implement and set this
}

declare namespace App {
  interface Locals {
    user?: {
      id: string;
      email: string;
      name?: string;
      role: string;
    };
    sessionId?: string;
    // Make Cloudflare bindings available in Astro components and API routes
    cloudflare: {
      env: CloudflareEnv;
      context: ExecutionContext;
    }
  }
}

// For import.meta.env (client-side and build-time server-side)
interface ImportMetaEnv {
  readonly PUBLIC_APP_URL: string;
  readonly PUBLIC_DEV_MODE?: string; // From your .env
  // Add other PUBLIC_ prefixed variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}