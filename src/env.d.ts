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
import type { Session, User } from "./types/auth";

// Defines the shape of Cloudflare bindings and secrets
// available via `Astro.locals.runtime.env`.
export interface CloudflareEnv {
  DATABASE: D1Database;
  CONFIG_KV: KVNamespace;
  REPORT_CACHE_KV: KVNamespace;
  SESSION_KV: KVNamespace;
  DOCUMENTS_BUCKET: R2Bucket;
  BACKGROUND_TASKS_QUEUE?: Queue;

  AUTH_SECRET: string;
  CSRF_SECRET: string;
  SESSION_SECRET: string;
  JWT_SECRET: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  ENVIRONMENT: "development" | "production" | "staging" | string;
}

// Forward declaration for ToastSystem class used in Window interface
// This avoids needing to import the actual class implementation here.
interface ToastSystemInterface {
  show: (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    duration?: number
  ) => string | null; // Assuming show returns toast ID or null
  remove: (id: string) => void;
  // Add other methods if ToastSystem has more public methods used globally
}


declare global {
  interface Window {
    Alpine?: AlpineType;
    showToast?: (
      type: 'success' | 'error' | 'info' | 'warning',
      message: string,
      duration?: number
    ) => string | null; // Ensure return type matches what showToast actually returns
    toggleTheme?: () => void;
    // Add the declaration for toastSystem
    toastSystem?: ToastSystemInterface; // Use the interface defined above
  }

  namespace App {
    interface Locals {
      runtime: {
        env: CloudflareEnv;
        cf?: CfProperties;
        ctx: ExecutionContext;
      };
      cspNonce?: string;
      user?: User;
      sessionId?: string;
      session?: Session;
      csrfToken?: string;
      currentEntityId?: string;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_APP_URL: string;
  readonly PUBLIC_DEV_MODE?: string;
  readonly NODE_ENV: "development" | "production" | "test";
  readonly PUBLIC_ENABLE_TOASTS?: string;
  readonly PUBLIC_DEFAULT_THEME?: "light" | "dark" | "system";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};