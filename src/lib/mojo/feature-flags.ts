// src/lib/mojo/feature-flags.ts

/**
 * Feature flags for Mojo acceleration
 * 
 * This module provides feature flags to control the use of Mojo WebAssembly modules.
 * These flags can be modified at runtime to toggle between Mojo and JavaScript implementations.
 */

// Default feature flags
let featureFlags = {
  // Core modules
  useMojoBigDecimal: true,       // Use Mojo for high-precision decimal calculations
  
  // Financial modules
  useMojoLoanEngine: true,       // Use Mojo for loan calculations
  useMojoTaxEngine: true,        // Use Mojo for tax calculations
  useMojoBatchProcessor: true,   // Use Mojo for batch transaction processing
  useMojoReportingEngine: true,  // Use Mojo for financial reporting
  
  // Development flags
  logMojoPerformance: false,     // Log performance metrics for Mojo vs JS
  preferJSImplementation: false  // Force JavaScript implementation for all modules
};

/**
 * Get the current feature flags
 */
export function getFeatureFlags(): Readonly<typeof featureFlags> {
  // Merge stored flags with defaults if available
  try {
    if (typeof localStorage !== 'undefined') {
      const storedFlags = localStorage.getItem('mojoFeatureFlags');
      if (storedFlags) {
        featureFlags = { ...featureFlags, ...JSON.parse(storedFlags) };
      }
    }
  } catch (error) {
    console.warn('Could not retrieve feature flags from localStorage:', error);
  }
  
  // If global override flag is set, disable all Mojo modules
  if (featureFlags.preferJSImplementation) {
    return {
      ...featureFlags,
      useMojoBigDecimal: false,
      useMojoLoanEngine: false,
      useMojoTaxEngine: false,
      useMojoBatchProcessor: false,
      useMojoReportingEngine: false
    };
  }
  
  return { ...featureFlags };
}

/**
 * Update feature flags
 * @param flags Partial set of flags to update
 */
export function updateFeatureFlags(flags: Partial<typeof featureFlags>): void {
  featureFlags = { ...featureFlags, ...flags };
  
  // Persist to localStorage if available
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mojoFeatureFlags', JSON.stringify(featureFlags));
    }
  } catch (error) {
    console.warn('Could not save feature flags to localStorage:', error);
  }
}

/**
 * Detect WebAssembly support and adjust feature flags accordingly
 */
export function detectWebAssemblySupport(): boolean {
  try {
    if (typeof WebAssembly === 'undefined') {
      updateFeatureFlags({ preferJSImplementation: true });
      console.warn('WebAssembly not supported in this environment. Using JavaScript implementations.');
      return false;
    }
    
    // Check for specific WebAssembly features needed by Mojo
    const requiredFeatures = [
      typeof WebAssembly.compile === 'function',
      typeof WebAssembly.instantiate === 'function',
      typeof WebAssembly.Memory === 'function'
    ];
    
    if (!requiredFeatures.every(Boolean)) {
      updateFeatureFlags({ preferJSImplementation: true });
      console.warn('Required WebAssembly features not supported. Using JavaScript implementations.');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error detecting WebAssembly support:', error);
    updateFeatureFlags({ preferJSImplementation: true });
    return false;
  }
}

// Run detection on module load
detectWebAssemblySupport();