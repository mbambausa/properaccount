// src/lib/mojo/loader.ts
let wasmModules: Map<string, WebAssembly.Module> = new Map();
let wasmInstances: Map<string, WebAssembly.Instance> = new Map();

export interface MojoModule {
  isInitialized: boolean;
  exports: any;
}

/**
 * Initialize a Mojo WebAssembly module
 * @param moduleName The name of the module (without .wasm extension)
 * @param path Optional custom path to the .wasm file
 */
export async function initMojoModule(
  moduleName: string, 
  path?: string
): Promise<MojoModule> {
  const module: MojoModule = {
    isInitialized: false,
    exports: {}
  };
  
  try {
    // If already initialized, return cached instance
    if (wasmInstances.has(moduleName)) {
      module.exports = wasmInstances.get(moduleName)?.exports;
      module.isInitialized = true;
      return module;
    }
    
    // Default path is /mojo/[moduleName].wasm
    const wasmPath = path || `/mojo/${moduleName}.wasm`;
    
    const wasmResponse = await fetch(wasmPath);
    if (!wasmResponse.ok) {
      throw new Error(`Failed to fetch WebAssembly module: ${wasmPath}`);
    }
    
    const wasmBytes = await wasmResponse.arrayBuffer();
    const wasmModule = await WebAssembly.compile(wasmBytes);
    wasmModules.set(moduleName, wasmModule);
    
    const wasmInstance = await WebAssembly.instantiate(wasmModule, {
      env: {
        memory: new WebAssembly.Memory({ initial: 10, maximum: 100 }),
        // Add any other required environment functions here
      },
      // Add other required imports here
    });
    
    wasmInstances.set(moduleName, wasmInstance);
    module.exports = wasmInstance.exports;
    module.isInitialized = true;
    
    return module;
  } catch (error) {
    console.error(`Failed to initialize Mojo module ${moduleName}:`, error);
    throw error;
  }
}