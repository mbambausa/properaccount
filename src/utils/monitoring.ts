// src/utils/monitoring.ts
let errorQueue = [];
const MAX_BATCH_SIZE = 10;
const FLUSH_INTERVAL = 30000; // 30 seconds

export function captureError(error: Error, context?: Record<string, any>) {
  if (import.meta.env.PROD) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      context: context || {},
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
    };
    
    errorQueue.push(errorData);
    
    if (errorQueue.length >= MAX_BATCH_SIZE) {
      flushErrors();
    }
  } else {
    console.error('Error captured:', error, context);
  }
}

function flushErrors() {
  if (errorQueue.length === 0) return;
  
  const errors = [...errorQueue];
  errorQueue = [];
  
  fetch('/api/monitoring/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errors }),
    // Use keepalive to ensure the request completes even during page navigation
    keepalive: true,
  }).catch(err => {
    console.error('Failed to send errors to monitoring endpoint:', err);
    // Re-add errors to queue if submission failed
    errorQueue = [...errorQueue, ...errors];
  });
}

// Set up periodic flushing
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  setInterval(flushErrors, FLUSH_INTERVAL);
  // Also flush on page unload
  window.addEventListener('beforeunload', flushErrors);
}

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    captureError(event.error || new Error(event.message), {
      lineNo: event.lineno,
      colNo: event.colno,
      filename: event.filename,
    });
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? 
      event.reason : 
      new Error(String(event.reason));
    captureError(error, { unhandledRejection: true });
  });
}