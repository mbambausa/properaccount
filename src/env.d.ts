// env.d.ts
/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />
/// <reference types="@cloudflare/workers-types" />

// Define the shape of your D1, KV, R2, Queue, and DO bindings
// This helps TypeScript understand what's available on `env` in Cloudflare Workers/Pages Functions
interface CloudflareEnv {
  DATABASE: D1Database; // Main D1 database binding [cite: 13]
  CONFIG_KV: KVNamespace; // KV for application configuration [cite: 27]
  REPORT_CACHE_KV: KVNamespace; // KV for caching reports [cite: 30]
  DOCUMENTS_BUCKET: R2Bucket; // R2 for document storage [cite: 33]
  BACKGROUND_TASKS_QUEUE: Queue; // Queue for background processing [cite: 311]
  // Add other bindings like Durable Objects or AI if you use them
  // MY_DO: DurableObjectNamespace;
  // AI: any;

  // Secrets (defined in wrangler.toml and set via `wrangler secret put`)
  JWT_SECRET: string; // [cite: 51]
  CSRF_SECRET: string; // [cite: 113]
  GOOGLE_CLIENT_ID: string; // [cite: 47]
  GOOGLE_CLIENT_SECRET: string; // [cite: 47]
}

// Augment Astro's ` riconoscimento` type for Cloudflare Pages
declare namespace App {
  interface Locals {
    // User object, typically populated by authentication middleware [cite: 7]
    user?: {
      id: string;
      email: string;
      name?: string;
      role: string; // Example: 'admin', 'user'
      // Add any other user-specific properties you need
    };
    sessionId?: string; // Session identifier [cite: 7]
    // You can add other request-specific data to `locals`
    // مثلاً:
    // currentEntityId?: string;
    // csrfToken?: string;

    // Cloudflare environment bindings, accessible in Astro components and API endpoints
    // when using the Cloudflare adapter.
    cloudflare: {
      env: CloudflareEnv;
      context: ExecutionContext; // Provides `waitUntil` and `passThroughOnException`
    };
  }
}

// Augment ImportMetaEnv for client-side env variables prefixed with PUBLIC_
// and server-side env variables
interface ImportMetaEnv {
  readonly PUBLIC_APP_URL: string; // Example: URL of your deployed application
  readonly PUBLIC_GOOGLE_ANALYTICS_ID?: string; // Example for client-side analytics

  // Server-side only (same as in CloudflareEnv, but accessible via import.meta.env in server code)
  // Note: For Cloudflare Workers/Pages, direct access to secrets via import.meta.env
  // is generally discouraged; they should be accessed via the `env` object passed to the handler.
  // However, some build-time env vars might be needed.
  // The `CloudflareEnv` interface above is more relevant for runtime access in CF Workers.
  readonly NODE_ENV?: "development" | "production" | "test";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
