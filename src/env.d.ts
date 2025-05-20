// src/env.d.ts
/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/env" /> 
/// <reference types="@cloudflare/workers-types" />

import type { Alpine as AlpineType } from 'alpinejs';

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
  
  /**
   * Primary secret for Auth.js. Used for signing/encrypting session cookies, JWTs, etc.
   * CRITICAL for security. Must be a strong, random string (at least 32 characters).
   */
  AUTH_SECRET: string;

  /**
   * Secret for CSRF protection (e.g., used by csrf-csrf library).
   * CRITICAL for security. Must be a strong, random string (at least 32 characters).
   */
  CSRF_SECRET: string;
  
  // Optional: Define these if they serve purposes DISTINCT from AUTH_SECRET.
  // If AUTH_SECRET handles all JWT and session needs for Auth.js, these might be redundant.
  // JWT_SECRET?: string; // For custom API tokens not managed by Auth.js
  // SESSION_SECRET?: string; // For encrypting specific custom session data beyond Auth.js

  // OAuth Provider Secrets
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  // Environment identifier (e.g., 'development', 'staging', 'production')
  // Useful for environment-specific logic. Set this in your Cloudflare env vars / .dev.vars
  ENVIRONMENT?: 'development' | 'production' | 'staging' | string;
}

declare global {
  interface Window {
    eruda?: { init: (config?: any) => void; };
    Alpine?: AlpineType;
    // Global function for theme toggling, typically defined in a script in your layout.
    toggleTheme?: () => void;
    // For global toast notifications
    toastSystem?: {
      show: (type: 'success' | 'error' | 'warning' | 'info', message: string, duration?: number) => string;
      remove: (id: string) => void;
    };
    // Convenience function for showing toasts
    showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string, duration?: number) => string | null;
  }
  // Make eruda and Alpine available globally if they are loaded via <script> tags.
  const eruda: Window['eruda'];
  const Alpine: AlpineType;
}

// Augment Astro's App.Locals to ensure Cloudflare types and custom locals are available.
declare namespace App {
  interface Locals {
    runtime: {
      env: CloudflareEnv; // Provides access to Cloudflare bindings and secrets.
      cf?: CfProperties; // Cloudflare-specific request properties.
      ctx?: ExecutionContext; // Execution context (waitUntil, passThroughOnException).
      // name?: string; // Optional: name of the service/function if needed.
    };
    cspNonce?: string; // To pass the CSP nonce to components.
    // User session information, typically populated by an auth middleware/handler.
    user?: {
      id: string;
      email: string;
      name?: string;
      role: string; // e.g., 'user', 'admin'
    };
    sessionId?: string; // ID of the current session.
    session?: Record<string, any>; // Decoded session data.
  }
}

// Define environment variables accessible via `import.meta.env`
// `PUBLIC_` prefixed variables are exposed to client-side JavaScript by Astro.
interface ImportMetaEnv {
  readonly PUBLIC_APP_URL: string; // Base URL of the application.
  readonly PUBLIC_DEV_MODE?: string; // Typically "true" in development.

  // Standard Node.js environment variable, often set by the platform.
  // Astro also provides import.meta.env.DEV and import.meta.env.PROD.
  readonly NODE_ENV?: 'development' | 'production' | 'test';
}

// Augment ImportMeta to include the custom env type.
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// This export is necessary to make the file a module.
export {};