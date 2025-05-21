// src/utils/monitoring.ts

interface ErrorData {
  message: string;
  stack?: string;
  context: Record<string, any>;
  url: string;
  timestamp: string;
  lineNo?: number;
  colNo?: number;
  filename?: string;
  unhandledRejection?: boolean;
}

let errorQueue: ErrorData[] = [];
const MAX_BATCH_SIZE = 10;
const FLUSH_INTERVAL = 30000; // 30 seconds

export function captureError(error: Error, context?: Record<string, any>) {
  if (import.meta.env.PROD) {
    const errorData: ErrorData = {
      message: error.message,
      stack: error.stack,
      context: context || {},
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
      ...(context?.lineNo && { lineNo: context.lineNo as number }),
      ...(context?.colNo && { colNo: context.colNo as number }),
      ...(context?.filename && { filename: context.filename as string }),
      ...(context?.unhandledRejection && { unhandledRejection: context.unhandledRejection as boolean }),
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

  const errorsToSend = [...errorQueue];
  errorQueue = [];

  fetch('/api/monitoring/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errors: errorsToSend }),
    keepalive: true,
  }).catch(err => {
    console.error('Failed to send errors to monitoring endpoint:', err);
    errorQueue.unshift(...errorsToSend);
  });
}

// Set up periodic flushing
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  // FIXED: No need to store intervalId if not used for clearInterval
  setInterval(flushErrors, FLUSH_INTERVAL);
  window.addEventListener('beforeunload', flushErrors);
}

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event: ErrorEvent) => {
    captureError(event.error || new Error(event.message || 'Unknown error'), {
      lineNo: event.lineno,
      colNo: event.colno,
      filename: event.filename,
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason || 'Unknown unhandled rejection'));
    captureError(error, { unhandledRejection: true });
  });
}