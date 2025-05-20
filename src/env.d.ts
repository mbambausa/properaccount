// src/env.d.ts
/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/env" />
/// <reference types="@cloudflare/workers-types" />

import type { Alpine as AlpineType } from "alpinejs";

// This interface defines the shape of your Cloudflare bindings and secrets
// that are accessible via `Astro.locals.runtime.env` in server-side code.
export interface CloudflareEnv {
  // Cloudflare Service Bindings
  DATABASE: D1Database;
  CONFIG_KV: KVNamespace;
  REPORT_CACHE_KV: KVNamespace;
  SESSION_KV: KVNamespace; // For custom session management
  DOCUMENTS_BUCKET: R2Bucket;
  BACKGROUND_TASKS_QUEUE: Queue; // For Phase 3+

  // Secrets (set in Cloudflare dashboard for deployed envs, .dev.vars for local)
  AUTH_SECRET: string;
  CSRF_SECRET: string;
  SESSION_SECRET: string;
  JWT_SECRET: string;

  // OAuth Provider Secrets
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  // Environment identifier (e.g., 'development', 'staging', 'production')
  ENVIRONMENT?: "development" | "production" | "staging" | string;
}

declare global {
  interface Window {
    eruda?: { init: (config?: any) => void };
    Alpine?: AlpineType;
    toggleTheme?: () => void;
    toastSystem?: {
      show: (
        type: "success" | "error" | "warning" | "info",
        message: string,
        duration?: number
      ) => string;
      remove: (id: string) => void;
    };
    showToast?: (
      type: "success" | "error" | "warning" | "info",
      message: string,
      duration?: number
    ) => string | null;

    // Add fs utility for accessing files from Mojo components
    fs?: {
      readFile: (
        path: string,
        options?: { encoding?: string }
      ) => Promise<string | Uint8Array>;
    };
  }
  // Make eruda and Alpine available globally if they are loaded via <script> tags.
  const eruda: Window["eruda"];
  const Alpine: AlpineType;

  // Moving App namespace inside global to ensure it's recognized properly
  namespace App {
    interface Locals {
      runtime: {
        env: CloudflareEnv;
        cf?: CfProperties;
        ctx?: ExecutionContext;
      };
      cspNonce?: string;
      user?: {
        id: string;
        email: string;
        name?: string;
        role: string;
        // Add tenant-specific fields for multi-tenancy
        currentEntityId?: string;
        permissions?: string[];
      };
      sessionId?: string;
      session?: Record<string, any>;
      // Add CSRF token for forms
      csrfToken?: string;
    }
  }
}

// Define environment variables accessible via `import.meta.env`
interface ImportMetaEnv {
  readonly PUBLIC_APP_URL: string;
  readonly PUBLIC_DEV_MODE?: string;
  readonly NODE_ENV?: "development" | "production" | "test";
  // Add public config flags for UnoCSS and Alpine
  readonly PUBLIC_ENABLE_TOASTS?: string;
  readonly PUBLIC_DEFAULT_THEME?: "light" | "dark" | "system";
}

// Augment ImportMeta to include the custom env type.
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// This export is necessary to make the file a module.
export {};
