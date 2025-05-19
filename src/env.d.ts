// src/env.d.ts
/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/env" /> 
/// <reference types="@cloudflare/workers-types" />

import type { Alpine as AlpineType } from 'alpinejs';

// This interface defines the shape of your Cloudflare bindings and secrets.
export interface CloudflareEnv {
  DATABASE: D1Database;
  CONFIG_KV: KVNamespace;
  REPORT_CACHE_KV: KVNamespace;
  SESSION_KV: KVNamespace;
  DOCUMENTS_BUCKET: R2Bucket;
  BACKGROUND_TASKS_QUEUE: Queue;

  // Secrets
  JWT_SECRET: string;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  CSRF_SECRET: string;
}

declare global {
  interface Window {
    eruda?: { init: (config?: any) => void; };
    Alpine?: AlpineType;
    // Added global toggleTheme function from ThemeScript.astro
    toggleTheme?: () => void;
  }
  const eruda: Window['eruda'];
  const Alpine: AlpineType;
}

// Explicitly augment Astro's App.Locals to ensure Cloudflare types work
declare namespace App {
  interface Locals {
    // Using explicit reference to avoid type confusion
    runtime: {
      env: CloudflareEnv;
      cf?: import('@cloudflare/workers-types').CfProperties;
      ctx?: ExecutionContext;
      name?: string;
    };

    user?: {
      id: string;
      email: string;
      name?: string;
      role: string;
    };
    sessionId?: string;
    session?: Record<string, any>;
  }
}

declare global {
  interface Window {
    toastSystem?: {
      show: (type: 'success' | 'error' | 'warning' | 'info', message: string, duration?: number) => string;
      remove: (id: string) => void;
    };
    showToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string, duration?: number) => string | null;
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_APP_URL: string;
  readonly PUBLIC_DEV_MODE?: string;
  readonly NODE_ENV?: 'development' | 'production' | 'test';
}
interface ImportMeta { readonly env: ImportMetaEnv; }

export {};