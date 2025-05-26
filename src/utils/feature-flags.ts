// src/utils/feature-flags.ts
/**
 * WebAssembly support and feature flag utilities.
 */

/**
 * Defines the structure for reporting basic WebAssembly support.
 * For detailed Wasm feature detection (SIMD, threads, exceptions, etc.),
 * a more specialized library or micro-feature tests would be required.
 */
export interface WebAssemblySupportInfo {
  isSupported: boolean; // Basic WebAssembly compilation and instantiation support
  isSecureContext: boolean; // Relevant for features like SharedArrayBuffer (threads)
  platform: 'browser' | 'node' | 'worker' | 'unknown';
  errorMessage?: string; // If basic support check fails
}

/**
 * Performs a basic check for WebAssembly support in the current environment.
 * Does NOT perform exhaustive feature detection for advanced Wasm proposals.
 */
export async function getWebAssemblySupport(): Promise<WebAssemblySupportInfo> {
  const info: WebAssemblySupportInfo = {
    isSupported: false,
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : true, // Assume secure for non-browser or default true
    platform: 'unknown',
  };

  if (typeof self !== 'undefined' && (self as any).DedicatedWorkerGlobalScope !== undefined) {
    info.platform = 'worker';
  } else if (typeof window !== 'undefined') {
    info.platform = 'browser';
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    info.platform = 'node';
  }
  
  if (typeof WebAssembly !== 'object' || WebAssembly === null) {
    info.errorMessage = 'WebAssembly global object not found.';
    return info;
  }
  if (typeof WebAssembly.compile !== 'function' || typeof WebAssembly.instantiate !== 'function') {
    info.errorMessage = 'Basic WebAssembly compile/instantiate functions not supported.';
    return info;
  }

  try {
    // A minimal valid Wasm module: (module)
    const minimalWasmModule = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    const module = await WebAssembly.compile(minimalWasmModule);
    await WebAssembly.instantiate(module);
    info.isSupported = true;
  } catch (e: unknown) {
    info.errorMessage = `Basic Wasm instantiation failed: ${e instanceof Error ? e.message : String(e)}`;
    // isSupported remains false
  }

  return info;
}

/**
 * Interface defining the shape of the feature flags for Mojo functionality.
 * These flags might control whether certain computationally intensive tasks
 * attempt to use Mojo (Wasm) implementations or fall back to JavaScript.
 */
export interface MojoFeatureFlags {
  useMojoBigDecimal: boolean;       // Example: Use Mojo for high-precision decimal math
  preferJSImplementation: boolean;  // Fallback flag: if true, prefer JS even if Mojo is available
  enableMojoTaxEngine: boolean;
  enableMojoReportingEngine: boolean;
  enableMojoBatchProcessor: boolean;
  enableMojoLoanEngine: boolean;
  debugMode: boolean;               // Enable verbose logging or diagnostics for Mojo modules
  // Advanced Wasm features - flags to enable experimental Mojo builds using these.
  // Actual support should be checked separately if critical for a specific Mojo module.
  simdOptimizations: boolean;
  threadOptimizations: boolean;
  maxMemoryBudgetMB: number;        // Informational budget for Mojo Wasm modules
}

let cachedFeatureFlags: MojoFeatureFlags | null = null;
const FEATURE_FLAGS_LOCAL_STORAGE_KEY = 'properAccountMojoFeatureFlags';

/**
 * Retrieves a boolean setting.
 * Order of precedence:
 * 1. Environment variable (server-side/build-time: process.env.YOUR_VAR; client-side build-time: import.meta.env.PUBLIC_YOUR_VAR).
 * 2. Value from localStorage (user override).
 * 3. Default value.
 * @param envKey The key for the environment variable. For client-side access via `import.meta.env`, it must be prefixed `PUBLIC_`.
 * @param defaultValue The default boolean value.
 * @param localStorageValue Optional value retrieved from localStorage.
 */
function getBooleanSetting(
  envKey: string,
  defaultValue: boolean,
  localStorageValue?: boolean 
): boolean {
  // Check environment variables
  // Server-side (Node.js in Worker) or build-time for non-PUBLIC_ vars
  const processEnvValue = (typeof process !== 'undefined' && process.env) ? process.env[envKey] : undefined;
  // Client-side (for PUBLIC_ prefixed vars available via import.meta.env)
  const importMetaEnvValue = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env as any)[envKey] : undefined;
  
  const envValue = processEnvValue !== undefined ? processEnvValue : importMetaEnvValue;

  if (envValue !== undefined) {
    const envLower = String(envValue).toLowerCase();
    if (envLower === 'true' || envLower === '1' || envLower === 'yes') return true;
    if (envLower === 'false' || envLower === '0' || envLower === 'no') return false;
  }
  
  // Check value from localStorage
  if (typeof localStorageValue === 'boolean') {
    return localStorageValue;
  }
  
  // Fall back to default
  return defaultValue;
}

/**
 * Retrieves a numeric setting.
 * Order of precedence: Environment variable -> localStorage -> default.
 * @param envKey The key for the environment variable.
 * @param defaultValue The default numeric value.
 * @param localStorageValue Optional value retrieved from localStorage.
 */
function getNumericSetting(
  envKey: string,
  defaultValue: number,
  localStorageValue?: number
): number {
  const processEnvValue = (typeof process !== 'undefined' && process.env) ? process.env[envKey] : undefined;
  const importMetaEnvValue = (typeof import.meta !== 'undefined' && import.meta.env) ? (import.meta.env as any)[envKey] : undefined;
  const envValue = processEnvValue !== undefined ? processEnvValue : importMetaEnvValue;

  if (envValue !== undefined) {
    const parsed = parseInt(String(envValue), 10);
    if (!isNaN(parsed)) return parsed;
  }
  
  if (typeof localStorageValue === 'number' && !isNaN(localStorageValue)) {
    return localStorageValue;
  }
  
  return defaultValue;
}

/**
 * Gets the current feature flags, from cache, localStorage, environment variables, or defaults.
 * Note: For server-side Mojo (in Workers), flags would typically be determined from `CloudflareEnv` (secrets/vars).
 * localStorage is primarily for client-side overrides or development toggles.
 */
export function getFeatureFlags(): MojoFeatureFlags {
  if (cachedFeatureFlags) {
    return { ...cachedFeatureFlags };
  }

  let settingsFromLocalStorage: Partial<MojoFeatureFlags> = {};
  if (typeof localStorage !== 'undefined') {
    try {
      const storedSettings = localStorage.getItem(FEATURE_FLAGS_LOCAL_STORAGE_KEY);
      if (storedSettings) {
        settingsFromLocalStorage = JSON.parse(storedSettings);
      }
    } catch (e) { console.warn("Could not parse Mojo feature flags from localStorage", e); }
  }

  // Ensure environment variable keys match what's set (e.g. PUBLIC_MOJO_DEBUG_MODE for client-side Vite)
  cachedFeatureFlags = {
    useMojoBigDecimal: getBooleanSetting('PUBLIC_MOJO_USE_BIG_DECIMAL', true, settingsFromLocalStorage.useMojoBigDecimal),
    preferJSImplementation: getBooleanSetting('PUBLIC_MOJO_PREFER_JS', false, settingsFromLocalStorage.preferJSImplementation),
    enableMojoTaxEngine: getBooleanSetting('PUBLIC_MOJO_ENABLE_TAX_ENGINE', true, settingsFromLocalStorage.enableMojoTaxEngine),
    enableMojoReportingEngine: getBooleanSetting('PUBLIC_MOJO_ENABLE_REPORTING_ENGINE', true, settingsFromLocalStorage.enableMojoReportingEngine),
    enableMojoBatchProcessor: getBooleanSetting('PUBLIC_MOJO_ENABLE_BATCH_PROCESSOR', true, settingsFromLocalStorage.enableMojoBatchProcessor),
    enableMojoLoanEngine: getBooleanSetting('PUBLIC_MOJO_ENABLE_LOAN_ENGINE', true, settingsFromLocalStorage.enableMojoLoanEngine),
    debugMode: getBooleanSetting('PUBLIC_MOJO_DEBUG_MODE', import.meta.env.DEV, settingsFromLocalStorage.debugMode), // Default debugMode to DEV status
    simdOptimizations: getBooleanSetting('PUBLIC_MOJO_SIMD_OPTIMIZATIONS', true, settingsFromLocalStorage.simdOptimizations),
    threadOptimizations: getBooleanSetting('PUBLIC_MOJO_THREAD_OPTIMIZATIONS', true, settingsFromLocalStorage.threadOptimizations),
    maxMemoryBudgetMB: getNumericSetting('PUBLIC_MOJO_MAX_MEMORY_MB', 64, settingsFromLocalStorage.maxMemoryBudgetMB),
  };
  return { ...cachedFeatureFlags };
}

/**
 * Updates specific feature flags and persists them to localStorage if available.
 * @param newFlags A partial object of MojoFeatureFlags to update.
 * @returns The new complete set of feature flags.
 */
export function updateFeatureFlags(newFlags: Partial<MojoFeatureFlags>): MojoFeatureFlags {
  const currentFlags = cachedFeatureFlags || getFeatureFlags(); // Ensure currentFlags is initialized
  cachedFeatureFlags = { ...currentFlags, ...newFlags };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(FEATURE_FLAGS_LOCAL_STORAGE_KEY, JSON.stringify(cachedFeatureFlags));
    } catch (e) { console.warn("Could not save Mojo feature flags to localStorage", e); }
  }
  return { ...cachedFeatureFlags };
}

/**
 * Resets feature flags to their default values (determined by env vars and then hardcoded defaults)
 * and clears them from localStorage.
 * @returns The reset feature flags.
 */
export function resetFeatureFlags(): MojoFeatureFlags {
  cachedFeatureFlags = null; // Clear memory cache
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(FEATURE_FLAGS_LOCAL_STORAGE_KEY);
  }
  return getFeatureFlags(); // Re-initialize from ENV and defaults
}