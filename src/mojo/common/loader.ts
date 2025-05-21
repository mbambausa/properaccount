// src/lib/mojo/common/loader.ts

/**
 * Manages WebAssembly module loading and initialization for Mojo modules.
 */

// Store WebAssembly modules and instances
let wasmModules: Map<string, WebAssembly.Module> = new Map();
let wasmInstances: Map<string, WebAssembly.Instance> = new Map();

/**
 * Interface representing a loaded Mojo module with proper type safety
 */
export interface MojoModule<T = any> {
  isInitialized: boolean;
  exports: T;
}

/**
 * Initialize a Mojo WebAssembly module
 * @param moduleName The name of the module (without .wasm extension)
 * @param importObject Optional WebAssembly import object
 * @param path Optional custom path to the .wasm file
 */
export async function initMojoModule<T = any>(
  moduleName: string, 
  importObject?: WebAssembly.Imports,
  path?: string
): Promise<MojoModule<T>> {
  const module: MojoModule<T> = {
    isInitialized: false,
    exports: {} as T
  };
  
  try {
    // If already initialized, return cached instance
    if (wasmInstances.has(moduleName)) {
      const instance = wasmInstances.get(moduleName);
      if (instance) {
        module.exports = instance.exports as unknown as T;
        module.isInitialized = true;
        return module;
      }
    }
    
    // Default path is /mojo/[moduleName].wasm
    const wasmPath = path || `/mojo/${moduleName}.wasm`;
    
    console.info(`Loading Mojo module: ${moduleName} from ${wasmPath}`);
    const wasmResponse = await fetch(wasmPath);
    if (!wasmResponse.ok) {
      throw new Error(`Failed to fetch WebAssembly module: ${wasmPath} (${wasmResponse.status} ${wasmResponse.statusText})`);
    }
    
    const wasmBytes = await wasmResponse.arrayBuffer();
    const wasmModule = await WebAssembly.compile(wasmBytes);
    wasmModules.set(moduleName, wasmModule);
    
    // Use provided import object or create default one
    const defaultImportObject = {
      env: {
        memory: new WebAssembly.Memory({ initial: 256, maximum: 10240 }),
        // Add any other required environment functions here
      }
    };
    
    const wasmInstance = await WebAssembly.instantiate(
      wasmModule, 
      importObject || defaultImportObject
    );
    
    wasmInstances.set(moduleName, wasmInstance);
    module.exports = wasmInstance.exports as unknown as T;
    module.isInitialized = true;
    
    console.info(`Successfully initialized Mojo module: ${moduleName}`);
    return module;
  } catch (error) {
    console.error(`Failed to initialize Mojo module ${moduleName}:`, error);
    throw error;
  }
}

/**
 * Check if a Mojo module is already initialized
 * @param moduleName The name of the module
 */
export function isMojoModuleInitialized(moduleName: string): boolean {
  return wasmInstances.has(moduleName);
}

/**
 * Get the exports of an initialized Mojo module
 * @param moduleName The name of the module
 */
export function getMojoModuleExports<T = any>(moduleName: string): T | null {
  const instance = wasmInstances.get(moduleName);
  return instance ? (instance.exports as unknown as T) : null;
}

/**
 * Reset all Mojo modules (useful for testing or when reloading the application)
 */
export function resetMojoModules(): void {
  wasmModules.clear();
  wasmInstances.clear();
}