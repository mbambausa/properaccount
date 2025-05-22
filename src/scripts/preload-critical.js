// src/scripts/preload-critical.js

/**
 * @file Preloads critical assets to improve perceived page load performance.
 * This script can be used to dynamically insert <link rel="preload"> tags
 * for assets that are discovered late by the browser but are important
 * for rendering above-the-fold content.
 */

const criticalAssets = [
  // Example:
  // { type: 'style', href: '/path/to/critical.css', as: 'style' },
  // { type: 'font', href: '/fonts/critical-font.woff2', as: 'font', crossOrigin: 'anonymous' },
  // { type: 'script', href: '/js/critical-module.js', as: 'script' },
];

/**
 * Creates and appends a <link rel="preload"> element to the document head.
 * @param {string} href - The URL of the resource to preload.
 * @param {string} asType - The type of content (e.g., 'style', 'script', 'font').
 * @param {string} [crossOrigin] - Cross-origin attribute for fonts.
 */
function preloadAsset(href, asType, crossOrigin) {
  if (!href || !asType) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = asType;
  if (asType === 'font' && crossOrigin) {
    link.crossOrigin = crossOrigin;
  }
  // Add other attributes like 'type' if needed for specific asset types (e.g., 'font/woff2')
  // link.type = 'font/woff2'; // Example for fonts

  document.head.appendChild(link);
  // console.log(`[Preload] Preloading: ${href} as ${asType}`);
}

/**
 * Initiates the preloading of all defined critical assets.
 */
export function preloadCriticalAssets() {
  // console.log('[Preload] Starting to preload critical assets...');
  criticalAssets.forEach(asset => {
    preloadAsset(asset.href, asset.as, asset.crossOrigin);
  });
}

// Automatically preload assets when this script is loaded.
// Consider calling this based on specific conditions or application lifecycle events
// if more control is needed.
// preloadCriticalAssets();
