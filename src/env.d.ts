// src/env.d.ts
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

import type { Alpine as AlpineType } from "alpinejs";
import type {
  KVNamespace,
  D1Database,
  R2Bucket,
  Queue,
  CfProperties,
  ExecutionContext,
  DurableObjectNamespace,
  AnalyticsEngineDataset,
} from "@cloudflare/workers-types";
import type { Session, User } from "./types/auth";

// ================================
// Cloudflare Environment Interface
// ================================

export interface CloudflareEnv {
  // Core Bindings
  DATABASE: D1Database;
  SESSION_KV: KVNamespace;
  CONFIG_KV: KVNamespace;
  REPORT_CACHE_KV: KVNamespace;
  DOCUMENTS_BUCKET: R2Bucket;
  
  // Optional Advanced Bindings (for future scaling)
  BACKGROUND_TASKS_QUEUE?: Queue;
  RATE_LIMITER?: DurableObjectNamespace;
  ANALYTICS?: AnalyticsEngineDataset;

  // Secrets and Configuration
  AUTH_SECRET: string;
  CSRF_SECRET: string;
  JWT_SECRET?: string;
  SESSION_SECRET?: string;
  
  // OAuth Providers
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  
  // Environment Configuration
  ENVIRONMENT: "development" | "production" | "preview";
  PUBLIC_APP_URL: string;
  
  // Feature Flags
  ENABLE_MOJO?: string;
  ENABLE_OCR?: string;
  ENABLE_AI_CATEGORIZATION?: string;
  
  // Performance Limits
  WORKER_CPU_LIMIT?: string;
  MAX_UPLOAD_SIZE?: string;
  CACHE_TTL_SECONDS?: string;
}

// ================================
// UI Component Types
// ================================

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastDetail {
  type: ToastType;
  message: string;
  duration?: number;
  id?: string;
  action?: {
    label: string;
    handler: () => void;
  };
}

export interface ToastSystemInterface {
  show: (type: ToastType, message: string, duration?: number) => string;
  remove: (id: string) => void;
  clear: () => void;
}

// ================================
// ProperAccount Domain Types
// ================================

export interface ProperAccountGlobals {
  // Feature detection
  isMojoEnabled: boolean;
  isOCREnabled: boolean;
  
  // User preferences
  theme: "light" | "dark" | "system";
  locale: string;
  currency: string;
  
  // Performance metrics
  startTime: number;
  pageLoadTime?: number;
}

// ================================
// Global Declarations
// ================================

declare global {
  // Window extensions
  interface Window {
    // UI Libraries
    Alpine?: AlpineType;
    htmx?: any;
    
    // Toast System
    showToast?: (type: ToastType, message: string, duration?: number) => string;
    toastSystem?: ToastSystemInterface;
    
    // ProperAccount specific
    ProperAccount?: ProperAccountGlobals;
    
    // File system API (for Astro)
    fs?: {
      readFile: (path: string, options?: { encoding?: string }) => Promise<ArrayBuffer | string>;
    };
    
    // Performance tracking
    reportWebVitals?: (metric: any) => void;
  }

  // Astro namespace augmentation
  namespace App {
    interface Locals {
      // Cloudflare runtime
      runtime?: {
        env: CloudflareEnv;
        cf?: CfProperties;
        ctx?: ExecutionContext;
        waitUntil?: (promise: Promise<any>) => void;
      };
      
      // Authentication
      session?: Session | null;
      user?: User | null;
      
      // Security
      csrfToken?: string;
      cspNonce?: string;
      
      // Request metadata
      requestId?: string;
      startTime?: number;
      
      // Feature flags (computed from env)
      features?: {
        mojo: boolean;
        ocr: boolean;
        aiCategorization: boolean;
      };
    }
  }

  // Import meta environment
  interface ImportMetaEnv {
    // Public variables (available in client)
    readonly PUBLIC_APP_URL: string;
    readonly PUBLIC_DEV_MODE?: string;
    readonly PUBLIC_ENABLE_TOASTS?: string;
    readonly PUBLIC_DEFAULT_THEME?: "light" | "dark" | "system";
    readonly PUBLIC_ENABLE_ANALYTICS?: string;
    readonly PUBLIC_MAINTENANCE_MODE?: string;
    readonly PUBLIC_MAX_UPLOAD_SIZE?: string;
    readonly PUBLIC_ENABLE_MOJO?: string;
    
    // Build-time variables
    readonly MODE: "development" | "production";
    readonly PROD: boolean;
    readonly DEV: boolean;
    readonly SSR: boolean;
    
    // Base URL for assets
    readonly BASE_URL: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
    readonly url: URL;
    
    // Hot Module Replacement
    readonly hot?: {
      accept: (cb?: (mod: any) => void) => void;
      decline: () => void;
      dispose: (cb: () => void) => void;
    };
  }
}

// ================================
// Module Augmentations
// ================================

// Augment Astro types
declare module 'astro' {
  interface AstroGlobal {
    locals: App.Locals;
  }
}

// Make this file a module
export {};