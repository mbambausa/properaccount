// src/scripts/performance-monitor.js

/**
 * @file Performance monitoring utilities.
 * This module can be used to track custom performance metrics,
 * log long tasks, or integrate with performance monitoring services.
 */

/**
 * Records a custom performance metric.
 * @param {string} metricName - The name of the metric (e.g., 'custom.loadTime.componentX').
 * @param {number} value - The value of the metric.
 * @param {object} [tags] - Optional tags or dimensions to associate with the metric.
 */
export function recordMetric(metricName, value, tags = {}) {
  if (typeof console !== 'undefined' && console.log) {
    console.log(`[Performance] Metric: ${metricName}, Value: ${value}`, tags);
  }
  // Example: Send to a performance monitoring service
  // if (window.myPerformanceTracker) {
  //   window.myPerformanceTracker.track(metricName, value, tags);
  // }
}

/**
 * Measures the duration of a function execution.
 * @param {string} functionName - A descriptive name for the function being measured.
 * @param {function} fn - The function to execute and measure.
 * @returns {any} The result of the function execution.
 */
export function measureFunction(functionName, fn) {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    recordMetric(`function.${functionName}.duration`, duration);
    // console.log(`[Performance] ${functionName} took ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordMetric(`function.${functionName}.error.duration`, duration);
    // console.error(`[Performance] ${functionName} threw an error after ${duration.toFixed(2)}ms`, error);
    throw error;
  }
}

/**
 * Initializes performance monitoring.
 */
export function initPerformanceMonitoring() {
  // console.log('[Performance] Performance monitoring initialized.');
  // Example: Log Core Web Vitals or other standard metrics if available
  // For example, using the web-vitals library:
  // import {onCLS, onINP, onLCP} from 'web-vitals';
  // onCLS(console.log);
  // onINP(console.log);
  // onLCP(console.log);
}

// To make it tree-shakable, avoid auto-initializing here.
// Call initPerformanceMonitoring() from your main application script if needed.
