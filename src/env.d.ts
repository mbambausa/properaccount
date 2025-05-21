// src/env.d.ts
/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/env" />
/// <reference types="@cloudflare/workers-types" />

import type { Alpine as AlpineType } from "alpinejs";
import type {
  KVNamespace,
  D1Database,
  R2Bucket,
  Queue,
  CfProperties,
  ExecutionContext,
} from "@cloudflare/workers-types";
import type { Session, User } from "./types/auth"; // Ensure Session and User types are imported

// Defines the shape of Cloudflare bindings and secrets
// available via `Astro.locals.runtime.env`.
export interface CloudflareEnv {
  // Cloudflare Service Bindings (ensure these match wrangler.toml bindings)
  DATABASE: D1Database;
  CONFIG_KV: KVNamespace;
  REPORT_CACHE_KV: KVNamespace;
  SESSION_KV: KVNamespace;       // For custom session management
  DOCUMENTS_BUCKET: R2Bucket;
  BACKGROUND_TASKS_QUEUE?: Queue; // Optional until Phase 3+

  // Secrets (set in Cloudflare dashboard or .dev.vars for local)
  AUTH_SECRET: string;    // For Auth.js or similar
  CSRF_SECRET: string;    // For CSRF protection logic
  SESSION_SECRET: string; // For signing/encrypting custom session data
  JWT_SECRET: string;     // For any custom JWT logic

  // OAuth Provider Secrets
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  // Environment identifier
  ENVIRONMENT: "development" | "production" | "staging" | string;
}

declare global {
  interface Window {
    Alpine?: AlpineType;
    // (other globals as before…)
  }

  namespace App {
    interface Locals {
      runtime: {
        env: CloudflareEnv;
        cf?: CfProperties;          // Cloudflare request properties
        ctx: ExecutionContext;       // Execution context (waitUntil, passThroughOnException)
      };
      cspNonce?: string;            // For CSP nonces in headers/forms
      user?: User;                  // Use imported User type
      sessionId?: string;           // From custom session store
      session?: Session;            // Use imported Session type
      csrfToken?: string;           // To embed in forms
      currentEntityId?: string;     // For tenant (multi-entity) middleware
    }
  }
}

// Client-side environment variables (import.meta.env)
interface ImportMetaEnv {
  readonly PUBLIC_APP_URL: string;
  readonly PUBLIC_DEV_MODE?: string;     // "true" or "false"
  readonly NODE_ENV: "development" | "production" | "test";
  readonly PUBLIC_ENABLE_TOASTS?: string;
  readonly PUBLIC_DEFAULT_THEME?: "light" | "dark" | "system";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {}; // Ensure this file is treated as a module
