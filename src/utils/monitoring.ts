// src/utils/monitoring.ts
/**
 * Client-side error monitoring and reporting utility.
 * This module captures JavaScript errors and unhandled promise rejections on the client-side,
 * batches them, and periodically sends them to a server-side monitoring endpoint.
 *
 * IMPORTANT: This utility is designed for client-side (browser) execution.
 * It relies on `window` and `Workspace` with `keepalive`. It is not intended for
 * server-side error reporting within Cloudflare Workers directly, though a Worker
 * would typically host the `/api/monitoring/errors` endpoint.
 */

interface ErrorData {
  message: string;
  stack?: string;
  context: Record<string, any>; // Additional context about the error
  url: string;                   // URL where the error occurred
  timestamp: string;             // ISO string timestamp
  lineNo?: number;                // Line number of the error
  colNo?: number;                 // Column number of the error
  filename?: string;              // Filename where the error occurred
  unhandledRejection?: boolean;   // True if it was an unhandled promise rejection
  userAgent?: string;             // Browser user agent
  // Add other useful client-side info like screen resolution, cookies enabled, etc. if needed
}

let errorQueue: ErrorData[] = [];
const MAX_BATCH_SIZE = 10;      // Send errors in batches of up to 10
const FLUSH_INTERVAL = 30000; // Flush errors every 30 seconds

const MONITORING_ENDPOINT = '/api/monitoring/errors'; // Ensure this endpoint is implemented server-side

/**
 * Captures an error and adds it to the queue for reporting.
 * Only operates in production environments to avoid noise during development.
 *
 * @param error The error object.
 * @param context Optional additional context to include with the error report.
 */
export function captureError(error: Error, context?: Record<string, any>): void {
  // Only capture errors in production environments or if explicitly enabled for other envs
  if (import.meta.env.PROD || (typeof import.meta.env.PUBLIC_ENABLE_ERROR_MONITORING === 'string' && import.meta.env.PUBLIC_ENABLE_ERROR_MONITORING.toLowerCase() === 'true')) {
    if (typeof window === 'undefined') return; // Ensure this only runs client-side

    const errorData: ErrorData = {
      message: error.message,
      stack: error.stack,
      context: context || {},
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ...(context?.lineNo && { lineNo: context.lineNo as number }),
      ...(context?.colNo && { colNo: context.colNo as number }),
      ...(context?.filename && { filename: context.filename as string }),
      ...(context?.unhandledRejection && { unhandledRejection: context.unhandledRejection as boolean }),
    };

    errorQueue.push(errorData);

    // If the queue reaches the max batch size, flush it immediately.
    if (errorQueue.length >= MAX_BATCH_SIZE) {
      flushErrors();
    }
  } else {
    // In development, just log the error to the console for immediate visibility.
    console.error('Dev Error Captured (not sent to backend):', error, context);
  }
}

/**
 * Sends the queued errors to the server-side monitoring endpoint.
 * This function is typically called by a timer or when the page is unloading.
 */
function flushErrors(): void {
  if (typeof window === 'undefined' || errorQueue.length === 0) {
    return;
  }

  const errorsToSend = [...errorQueue]; // Copy the current queue
  errorQueue = []; // Clear the queue immediately

  // Use `navigator.sendBeacon` if available and appropriate (for `beforeunload`)
  // or `Workspace` with `keepalive` for sending data when the page might be closing.
  // For simplicity, using fetch with keepalive here.
  try {
    fetch(MONITORING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errors: errorsToSend }),
      keepalive: true, // Important for sending data during page unload events
    }).catch(fetchError => {
      // If sending fails, log locally and potentially try to re-queue or store in localStorage if critical.
      console.error('Failed to send monitoring errors to endpoint:', fetchError);
      // Re-queue errors if sending failed (be careful of infinite loops if endpoint is always down)
      // errorQueue.unshift(...errorsToSend); 
    });
  } catch (e) {
    // Catch synchronous errors from fetch call setup if any
    console.error('Synchronous error during fetch setup for monitoring:', e);
  }
}

// --- Initialize Global Error Handlers (Client-Side Only) ---
if (typeof window !== 'undefined') {
  // Setup periodic flushing of the error queue.
  // This ensures errors are sent even if MAX_BATCH_SIZE isn't reached or beforeunload doesn't fire.
  // No need to store intervalId if not clearing it later, but good practice if you might.
  const flushIntervalId = setInterval(flushErrors, FLUSH_INTERVAL);

  // Attempt to flush errors when the page is being unloaded.
  window.addEventListener('beforeunload', flushErrors);
  // 'unload' is less reliable than 'beforeunload' or 'pagehide'.
  // 'visibilitychange' with document.visibilityState === 'hidden' can also be a trigger.
  window.addEventListener('pagehide', flushErrors);


  // Global handler for uncaught synchronous errors.
  window.addEventListener('error', (event: ErrorEvent) => {
    // Avoid capturing errors that are not actual script errors (e.g., resource load errors on img tags)
    if (event.error instanceof Error) { // Check if event.error is an actual Error object
      captureError(event.error, {
        lineNo: event.lineno,
        colNo: event.colno,
        filename: event.filename,
        source: 'window.onerror',
      });
    } else if (typeof event.message === 'string' && event.message) {
      // Handle cases where event.error might not be an Error instance but message is present
      captureError(new Error(event.message), {
        lineNo: event.lineno,
        colNo: event.colno,
        filename: event.filename,
        source: 'window.onerror (non-Error object)',
      });
    }
    // For other types of ErrorEvents (e.g. resource loading errors), you might choose to ignore them
    // or log them differently if they are not JavaScript execution errors.
  });

  // Global handler for unhandled promise rejections.
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason || 'Unknown unhandled promise rejection'));
    captureError(error, { unhandledRejection: true, source: 'window.onunhandledrejection' });
  });

  // Consider adding cleanup if this module could be "destroyed" or re-initialized,
  // e.g., in a single-page application context:
  // export function cleanupMonitoring() {
  //   clearInterval(flushIntervalId);
  //   window.removeEventListener('beforeunload', flushErrors);
  //   window.removeEventListener('pagehide', flushErrors);
  //   window.removeEventListener('error', ...);
  //   window.removeEventListener('unhandledrejection', ...);
  // }
}