// src/utils/feature-flags.ts

/**
 * Interface defining WebAssembly support and feature detection results.
 */
export interface WebAssemblySupport {
  isSupported: boolean;
  features: {
    bulkMemory: boolean;
    exceptions: boolean;
    multiValue: boolean;
    referenceTypes: boolean;
    simd: boolean;
    threads: boolean;
    tailCall: boolean;
  };
  maxMemoryPages: number;
  errorMessage?: string;
  platform: {
    name: string;
    version?: string;
    isSecureContext: boolean;
  };
}

/**
 * Performs comprehensive detection of WebAssembly support and available features.
 */
export async function getWebAssemblySupport(): Promise<WebAssemblySupport> {
  const result: WebAssemblySupport = {
    isSupported: false,
    features: {
      bulkMemory: false, exceptions: false, multiValue: false,
      referenceTypes: false, simd: false, threads: false, tailCall: false,
    },
    maxMemoryPages: 0,
    platform: {
        name: typeof window !== 'undefined' ? 'browser' : (typeof process !== 'undefined' && process.env && process.versions?.node ? 'node' : 'unknown'),
        isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : true,
    }
  };

  if (typeof WebAssembly !== 'object' || WebAssembly === null) {
    result.errorMessage = 'WebAssembly global object not found.';
    return result;
  }
  if (typeof WebAssembly.compile !== 'function' || typeof WebAssembly.instantiate !== 'function') {
    result.errorMessage = 'Basic WebAssembly compile/instantiate functions not supported.';
    return result;
  }

  try {
    const module = await WebAssembly.compile(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
    await WebAssembly.instantiate(module);
    result.isSupported = true;
  } catch (e: unknown) {
    result.errorMessage = `Basic Wasm instantiation failed: ${e instanceof Error ? e.message : String(e)}`;
    return result;
  }

  try {
    const simdModule = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,6,1,4,0,65,0,11]);
    result.features.simd = WebAssembly.validate(simdModule);
  } catch (e) { result.features.simd = false; }

  result.features.threads = typeof SharedArrayBuffer === 'function' && result.platform.isSecureContext === true;
  if (result.features.threads) {
    try {
      const threadModule = new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,5,3,1,0,1]);
      await WebAssembly.compile(threadModule);
    } catch (e) {
      result.features.threads = false;
    }
  }

  result.features.bulkMemory = result.isSupported;
  result.features.referenceTypes = result.isSupported;
  result.features.multiValue = result.isSupported;
  result.features.exceptions = false;
  result.features.tailCall = false;
  result.maxMemoryPages = 1024;

  return result;
}

/**
 * Interface defining the shape of the feature flags for Mojo functionality.
 */
export interface MojoFeatureFlags {
  useMojoBigDecimal: boolean;
  preferJSImplementation: boolean;
  enableMojoTaxEngine: boolean;
  enableMojoReportingEngine: boolean;
  enableMojoBatchProcessor: boolean;
  enableMojoLoanEngine: boolean;
  debugMode: boolean;
  simdOptimizations: boolean;
  threadOptimizations: boolean;
  maxMemoryBudgetMB: number;
}

let cachedFeatureFlags: MojoFeatureFlags | null = null;

// FIXED: Parameter order and logic revised.
// envKey is the NAME of the environment variable.
// settingValue is the value from localStorage (optional).
// defaultValue is the ultimate fallback.
function getBooleanSetting(
  envKey: string,
  defaultValue: boolean,
  settingValue?: boolean // This value comes from localStorage, can be undefined
): boolean {
  // 1. Check environment variables (server-side or build-time)
  const envValue = typeof process !== 'undefined' && process.env ? process.env[envKey] : undefined;
  if (envValue !== undefined) {
    const envLower = envValue.toLowerCase();
    if (envLower === 'true' || envLower === '1' || envLower === 'yes') return true;
    if (envLower === 'false' || envLower === '0' || envLower === 'no') return false;
  }
  // 2. Check value from settings (localStorage)
  if (typeof settingValue === 'boolean') {
    return settingValue;
  }
  // 3. Fall back to default
  return defaultValue;
}

// FIXED: Parameter order and logic revised.
function getNumericSetting(
  envKey: string,
  defaultValue: number,
  settingValue?: number // This value comes from localStorage, can be undefined
): number {
  // 1. Check environment variables
  const envValue = typeof process !== 'undefined' && process.env ? process.env[envKey] : undefined;
  if (envValue !== undefined) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed)) return parsed;
  }
  // 2. Check value from settings (localStorage)
  if (typeof settingValue === 'number' && !isNaN(settingValue)) {
    return settingValue;
  }
  // 3. Fall back to default
  return defaultValue;
}

export function getFeatureFlags(): MojoFeatureFlags {
  if (cachedFeatureFlags) {
    return { ...cachedFeatureFlags };
  }

  let settings: Partial<MojoFeatureFlags> = {};
  if (typeof localStorage !== 'undefined') {
    try {
      const storedSettings = localStorage.getItem('properAccountMojoFeatureFlags');
      if (storedSettings) {
        settings = JSON.parse(storedSettings);
      }
    } catch (e) { console.warn("Could not parse feature flags from localStorage", e); }
  }

  // FIXED: Pass the ENV_KEY name directly to the helper functions.
  cachedFeatureFlags = {
    useMojoBigDecimal: getBooleanSetting('MOJO_USE_BIG_DECIMAL', true, settings.useMojoBigDecimal),
    preferJSImplementation: getBooleanSetting('MOJO_PREFER_JS', false, settings.preferJSImplementation),
    enableMojoTaxEngine: getBooleanSetting('MOJO_ENABLE_TAX_ENGINE', true, settings.enableMojoTaxEngine),
    enableMojoReportingEngine: getBooleanSetting('MOJO_ENABLE_REPORTING_ENGINE', true, settings.enableMojoReportingEngine),
    enableMojoBatchProcessor: getBooleanSetting('MOJO_ENABLE_BATCH_PROCESSOR', true, settings.enableMojoBatchProcessor),
    enableMojoLoanEngine: getBooleanSetting('MOJO_ENABLE_LOAN_ENGINE', true, settings.enableMojoLoanEngine),
    debugMode: getBooleanSetting('MOJO_DEBUG_MODE', false, settings.debugMode),
    simdOptimizations: getBooleanSetting('MOJO_SIMD_OPTIMIZATIONS', true, settings.simdOptimizations),
    threadOptimizations: getBooleanSetting('MOJO_THREAD_OPTIMIZATIONS', true, settings.threadOptimizations),
    maxMemoryBudgetMB: getNumericSetting('MOJO_MAX_MEMORY_MB', 64, settings.maxMemoryBudgetMB),
  };
  return { ...cachedFeatureFlags };
}

export function updateFeatureFlags(newFlags: Partial<MojoFeatureFlags>): MojoFeatureFlags {
  const currentFlags = cachedFeatureFlags || getFeatureFlags();
  cachedFeatureFlags = { ...currentFlags, ...newFlags };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('properAccountMojoFeatureFlags', JSON.stringify(cachedFeatureFlags));
    } catch (e) { console.warn("Could not save feature flags to localStorage", e); }
  }
  return { ...cachedFeatureFlags };
}

export function resetFeatureFlags(): MojoFeatureFlags {
  cachedFeatureFlags = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('properAccountMojoFeatureFlags');
  }
  return getFeatureFlags();
}