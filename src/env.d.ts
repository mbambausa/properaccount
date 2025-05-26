// src/env.d.ts
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

import type { Alpine as AlpineType } from "alpinejs";
import type {
  KVNamespace,
  D1Database,
  R2Bucket,
  Queue, // For future Pro tier, good to have if planning ahead
  CfProperties,
  ExecutionContext,
  DurableObjectNamespace,
  AnalyticsEngineDataset,
} from "@cloudflare/workers-types";

// Assuming your custom Session/User types are correctly defined in './types/auth'
// (or will be, if that file is upcoming in the review sequence)
import type { Session, User } from './types/auth'; 

// ================================
// Cloudflare Environment Interface
// ================================

export interface CloudflareEnv {
  // Core Bindings (ensure these match your wrangler.toml bindings for all environments)
  DATABASE: D1Database;
  SESSION_KV: KVNamespace;
  CONFIG_KV: KVNamespace;
  REPORT_CACHE_KV: KVNamespace;
  DOCUMENTS_BUCKET: R2Bucket;

  // Optional Advanced Bindings (for future scaling or specific features)
  BACKGROUND_TASKS_QUEUE?: Queue<any>; // Specify message type if known, e.g., Queue<BackgroundTaskMessage>
  RATE_LIMITER?: DurableObjectNamespace; // Example: For a Durable Object based rate limiter
  ANALYTICS?: AnalyticsEngineDataset;   // Example: For Cloudflare Analytics Engine

  // Secrets and Configuration (from .dev.vars or Cloudflare dashboard secrets)
  // These are automatically populated by Cloudflare from secrets set in the dashboard.
  AUTH_SECRET: string;        // Critical for Auth.js
  CSRF_SECRET: string;        // For custom CSRF protection (if your middleware solution requires it separately)
  JWT_SECRET?: string;         // If using custom JWTs separately from Auth.js's core session management
  SESSION_SECRET?: string;     // If using custom session management beyond Auth.js defaults or for CSRF

  // OAuth Providers (ensure these are set if providers are enabled)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // Add other OAuth provider secrets as needed (e.g., GITHUB_CLIENT_ID)

  // Environment Configuration
  ENVIRONMENT: "development" | "production" | "preview" | "test"; // Added "test" for Vitest context
  PUBLIC_APP_URL: string;     // Publicly accessible URL of the application (used by Auth.js, etc.)

  // Feature Flags (environment variables are strings; parse to boolean in application logic)
  // Consider prefixing with PUBLIC_ if they need to be accessed by client-side Astro via import.meta.env
  ENABLE_MOJO?: string;         // Example: "true" or "false"
  ENABLE_OCR?: string;          // Example: "true" or "false"
  ENABLE_AI_CATEGORIZATION?: string; // Example: "true" or "false"

  // Performance / Operational Limits (environment variables are strings; parse to number in app logic)
  WORKER_CPU_LIMIT?: string;    // Example: "50" (milliseconds), for app-level logic, not an infra override
  MAX_UPLOAD_SIZE?: string;     // Example: "10485760" (bytes for 10MB)
  CACHE_TTL_SECONDS?: string;   // Example: "300" (seconds for 5 minutes)
}

// ================================
// UI Component Types (Application Specific)
// ================================

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastDetail {
  type: ToastType;
  message: string;
  duration?: number; // Milliseconds
  id?: string;       // Unique ID for managing the toast
  action?: {
    label: string;
    handler: () => void;
  };
}

export interface ToastSystemInterface {
  show: (type: ToastType, message: string, duration?: number, action?: ToastDetail['action']) => string;
  remove: (id: string) => void;
  clear: () => void;
}

// ================================
// ProperAccount Domain Types (Application Specific)
// ================================

export interface ProperAccountGlobals {
  // Feature detection (parsed boolean values)
  isMojoEnabled: boolean;
  isOCREnabled: boolean;
  isAiCategorizationEnabled: boolean;

  // User preferences
  theme: "light" | "dark" | "system";
  locale: string;  // e.g., "en-US"
  currency: string; // e.g., "USD"

  // Performance metrics (example)
  startTime?: number; // Initial page load start time
  pageLoadTime?: number;
}

// ================================
// Global Declarations
// ================================

declare global {
  // Window extensions for client-side context
  interface Window {
    // UI Libraries (if exposed globally, common for Alpine.js)
    Alpine?: AlpineType;
    htmx?: any; // Consider using a more specific htmx type if available from @types/htmx.org or similar

    // Toast System (if exposed globally on the window object)
    showToast?: ToastSystemInterface['show'];
    toastSystem?: ToastSystemInterface;

    // ProperAccount specific globals (if exposed on window for client-side scripts)
    ProperAccount?: ProperAccountGlobals;

    // Performance tracking / Web Vitals (example)
    reportWebVitals?: (metric: any) => void;
  }

  // Astro namespace augmentation for context.locals (server-side context)
  namespace App {
    interface Locals {
      // Cloudflare runtime environment (populated by Astro's Cloudflare adapter)
      runtime?: {
        env: CloudflareEnv;       // Parsed environment variables and bindings
        cf?: CfProperties;         // Cloudflare request properties (geolocation, colo, etc.)
        ctx?: ExecutionContext;    // Execution context (waitUntil, passThroughOnException)
        waitUntil?: (promise: Promise<any>) => void; // Convenience access to ctx.waitUntil
      };

      // Authentication state, populated by middleware
      session?: Session | null;    // Your application's custom session type from ./types/auth
      user?: User | null;          // Your application's custom user type from ./types/auth

      // Security features, populated by middleware
      csrfToken?: string;          // For CSRF protection in forms
      cspNonce?: string;           // For Content Security Policy nonces

      // Request metadata for logging or tracking, populated by middleware
      requestId?: string;          // Unique ID for the request
      requestStartTime?: number;   // Timestamp for tracking request duration

      // Parsed feature flags for easy use in server-side application logic
      features?: {
        mojo: boolean;
        ocr: boolean;
        aiCategorization: boolean;
      };
    }
  }

  // Augmenting ImportMetaEnv for Vite/Astro environment variables (accessible in .astro, .ts, .js)
  interface ImportMetaEnv {
    // Public variables (available on the client, MUST be prefixed with PUBLIC_)
    readonly PUBLIC_APP_URL: string;
    readonly PUBLIC_DEFAULT_THEME?: "light" | "dark" | "system"; // From .env.example
    readonly PUBLIC_ENABLE_TOASTS?: string;         // From .env.example, parsed to boolean in app
    readonly PUBLIC_ENABLE_ANALYTICS?: string;      // From .env.example, parsed to boolean in app
    readonly PUBLIC_MAINTENANCE_MODE?: string;      // From .env.example, parsed to boolean in app
    readonly PUBLIC_MAX_UPLOAD_SIZE?: string;       // From .env.example, parsed to number in app
    readonly PUBLIC_ENABLE_MOJO?: string;           // From .env.example, parsed to boolean in app

    // Standard Vite build-time variables
    readonly MODE: "development" | "production" | "test"; // "test" is typical for Vitest
    readonly PROD: boolean;
    readonly DEV: boolean;
    readonly SSR: boolean; // True if server-side rendering context

    // Base URL (usually '/' or a subpath if deployed under one)
    readonly BASE_URL: string;
  }

  // Augmenting ImportMeta for standard and HMR properties
  interface ImportMeta {
    readonly env: ImportMetaEnv;
    readonly url: string; // Changed from URL to string, as import.meta.url is a string

    // Hot Module Replacement API (provided by Vite)
    readonly hot?: {
      readonly data: any;
      accept: (cb?: (mod: any) => void) => void;
      acceptDeps: (deps: string[], cb?: (mods: any[]) => void) => void;
      dispose: (cb: (data: any) => void) => void;
      decline: () => void;
      invalidate: () => void;
      on: (event: string, cb: (...args: any[]) => void) => void;
    };
  }
}

// Make this file a module (ensures it's treated as a module and can augment global scope)
export {};