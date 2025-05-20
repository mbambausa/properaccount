// src/lib/mojo/feature-detection.ts
/**
 * WebAssembly feature detection for Mojo modules.
 * Determines what WebAssembly features are available in the current environment
 * and configures the application accordingly.
 */

import { updateFeatureFlags } from './feature-flags';

/**
 * Results of WebAssembly feature detection
 */
export interface WebAssemblySupport {
  supported: boolean;
  features: {
    basic: boolean;        // Basic WebAssembly support
    streaming: boolean;    // WebAssembly.instantiateStreaming
    simd: boolean;         // SIMD instructions
    threads: boolean;      // Shared memory & atomics
    bigInt: boolean;       // BigInt integration
    exceptions: boolean;   // Exception handling
  };
  platform: {
    name: string;          // Platform name (browser, node, etc.)
    version?: string;      // Version if available
  };
}

/**
 * Object containing test modules for various WebAssembly features.
 * These are minimal WebAssembly modules encoded as Uint8Arrays that
 * test for specific features.
 */
const testModules = {
  // Basic WASM module
  basic: new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
  
  // SIMD test module
  simd: new Uint8Array([
    0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,7,8,1,4,
    116,101,115,116,0,0,10,10,1,8,0,65,0,253,15,253,98,11
  ]),
  
  // Threads test module (shared memory)
  threads: new Uint8Array([
    0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,3,1,0,1,
    7,8,1,4,116,101,115,116,0,0,10,4,1,2,0,11
  ]),
  
  // Exception handling test module
  exceptions: new Uint8Array([
    0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,11,1,9,0,
    6,64,0,7,65,0,253,186,1,11
  ])
};

/**
 * Detects WebAssembly support and available features in the current environment.
 * Updates feature flags based on the detection results.
 * 
 * @returns Object containing detailed information about WebAssembly support
 */
export async function detectWebAssemblySupport(): Promise<WebAssemblySupport> {
  // Initialize result object
  const result: WebAssemblySupport = {
    supported: false,
    features: {
      basic: false,
      streaming: false,
      simd: false,
      threads: false,
      bigInt: false,
      exceptions: false
    },
    platform: {
      name: determinePlatform()
    }
  };
  
  // Check if WebAssembly is available
  if (typeof WebAssembly !== 'object') {
    console.warn('WebAssembly not supported in this environment.');
    updateFeatureFlags({ preferJSImplementation: true });
    return result;
  }
  
  // Check basic WebAssembly support
  result.features.basic = typeof WebAssembly.compile === 'function';
  result.supported = result.features.basic;
  
  if (!result.supported) {
    console.warn('Basic WebAssembly functions not supported.');
    updateFeatureFlags({ preferJSImplementation: true });
    return result;
  }
  
  // Check for streaming API support
  result.features.streaming = 
    typeof WebAssembly.instantiateStreaming === 'function';
  
  // Check for BigInt support
  result.features.bigInt = typeof BigInt === 'function';
  
  // Test SIMD support
  try {
    await WebAssembly.compile(testModules.simd);
    result.features.simd = true;
  } catch (e) {
    console.info('WebAssembly SIMD not supported.');
  }
  
  // Test threads support
  try {
    await WebAssembly.compile(testModules.threads);
    // Need to also check if SharedArrayBuffer is available
    if (typeof SharedArrayBuffer === 'function') {
      // Create a small shared memory to verify threads really work
      const memory = new WebAssembly.Memory({ 
        initial: 1, 
        maximum: 1, 
        shared: true 
      });
      result.features.threads = true;
    }
  } catch (e) {
    console.info('WebAssembly threads not supported.');
  }
  
  // Test exception handling support
  try {
    await WebAssembly.compile(testModules.exceptions);
    result.features.exceptions = true;
  } catch (e) {
    console.info('WebAssembly exception handling not supported.');
  }
  
  // Update feature flags based on detection results
  updateFeatureFlags({
    // Only prefer JS if basic WebAssembly is not supported
    preferJSImplementation: !result.supported,
    
    // We can still use modules that don't require threads or SIMD
    // even if those specific features aren't available
    useMojoBigDecimal: result.supported,
    
    // For more advanced modules, we should check their specific requirements
    useMojoLoanEngine: result.supported && (
      // Loan engine might need SIMD for performance
      result.features.simd
    ),
    
    // Batch processor might need threads for parallelism
    useMojoBatchProcessor: result.supported && (
      result.features.threads
    )
  });
  
  console.info('WebAssembly support detected:', result);
  return result;
}

/**
 * Determines the current platform name
 */
function determinePlatform(): string {
  if (typeof window !== 'undefined') {
    return 'browser';
  } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return `node-${process.versions.node}`;
  } else if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Cloudflare-Workers')) {
    return 'cloudflare-workers';
  } else {
    return 'unknown';
  }
}

/**
 * Returns the optimal Wasm memory configuration based on detected features
 */
export function getOptimalWasmMemoryConfig(): WebAssembly.MemoryDescriptor {
  const features = detectWebAssemblySupport();
  
  if (features.features.threads) {
    // Use shared memory with threads if supported
    return {
      initial: 16,
      maximum: 100,
      shared: true
    };
  } else {
    // Fall back to standard memory
    return {
      initial: 16,
      maximum: 100
    };
  }
}

/**
 * Initializes WebAssembly feature detection and updates feature flags.
 * Call this at application startup.
 */
export async function initializeWebAssemblyFeatureDetection(): Promise<void> {
  try {
    await detectWebAssemblySupport();
  } catch (error) {
    console.error('Error during WebAssembly feature detection:', error);
    // If detection fails, fall back to JavaScript implementations
    updateFeatureFlags({ preferJSImplementation: true });
  }
}