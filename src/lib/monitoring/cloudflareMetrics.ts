// src/lib/monitoring/cloudflareMetrics.ts
/**
 * Cloudflare Metrics Client
 * 
 * This module provides utilities for collecting, formatting, and reporting 
 * metrics to Cloudflare's monitoring systems, including Workers Analytics Engine
 * and integration with other monitoring services.
 */

// ----------------
// Types
// ----------------

/**
 * Supported metric types
 */
export enum MetricType {
  /** Counter that only increases (e.g., total requests) */
  COUNTER = 'counter',
  /** Gauge that can go up and down (e.g., current connections) */
  GAUGE = 'gauge',
  /** Single measurement observation (e.g., request duration) */
  HISTOGRAM = 'histogram'
}

/**
 * Metric blobs supported by the Analytics Engine
 */
export interface MetricBlob {
  /** Event timestamp (milliseconds since epoch) */
  timestamp: number;
  /** Metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Dimensions (tags) for filtering and grouping */
  dimensions?: Record<string, string>;
  /** Metric type */
  type?: MetricType;
  /** Metric unit (e.g., bytes, ms, percentage) */
  unit?: string;
}

/**
 * Aggregated metric data
 */
export interface AggregatedMetric {
  /** Metric name */
  name: string;
  /** Metric dimensions */
  dimensions: Record<string, string>;
  /** Count of data points */
  count: number;
  /** Sum of values */
  sum: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Last update timestamp */
  lastUpdated: number;
  /** Values for percentile calculation (for histograms) */
  values?: number[];
}

/**
 * Configuration for the Cloudflare Metrics client
 */
export interface CloudflareMetricsConfig {
  /** Dataset name in Analytics Engine */
  dataset?: string;
  /** Maximum batch size for sending metrics */
  maxBatchSize?: number;
  /** Whether to automatically send metrics on an interval */
  autoSend?: boolean;
  /** Interval in milliseconds for auto-sending metrics */
  sendIntervalMs?: number;
  /** Default dimensions to include with all metrics */
  defaultDimensions?: Record<string, string>;
  /** Maximum buffer size (after which oldest entries are dropped) */
  maxBufferSize?: number;
  /** Cloudflare account ID (for some API endpoints) */
  accountId?: string;
  /** Function to handle errors */
  errorHandler?: (error: Error, context: string) => void;
  /** Whether to log debugging information */
  debug?: boolean;
}

/**
 * Metric query options
 */
export interface MetricQueryOptions {
  /** Start time for the query (milliseconds since epoch) */
  start: number;
  /** End time for the query (milliseconds since epoch) */
  end: number;
  /** Maximum number of results to return */
  limit?: number;
  /** Filter by dimensions */
  filter?: Record<string, string>;
  /** Group by dimensions */
  groupBy?: string[];
  /** Sort order */
  orderBy?: {
    /** Field to sort by */
    field: string;
    /** Sort direction */
    direction: 'asc' | 'desc';
  };
}

/**
 * Cloudflare Worker environment bindings for analytics
 */
export interface CloudflareAnalyticsBindings {
  /** Analytics Engine binding */
  ANALYTICS: AnalyticsEngine;
  /** Cloudflare Worker environment */
  env: any;
}

// ----------------
// Cloudflare Metrics Client
// ----------------

/**
 * Client for reporting metrics to Cloudflare monitoring
 */
export class CloudflareMetricsClient {
  private config: Required<CloudflareMetricsConfig>;
  private metricsBuffer: MetricBlob[] = [];
  private aggregatedMetrics: Map<string, AggregatedMetric> = new Map();
  private analyticsEngine?: AnalyticsEngine;
  private sendInterval?: number;
  private lastSendAttempt: number = 0;
  private sendPromise?: Promise<void>;
  private shuttingDown: boolean = false;
  
  /**
   * Create a new CloudflareMetricsClient
   * 
   * @param config Client configuration
   * @param bindings Optional Cloudflare bindings
   */
  constructor(
    config: CloudflareMetricsConfig = {}, 
    bindings?: CloudflareAnalyticsBindings
  ) {
    // Set defaults for config
    this.config = {
      dataset: 'metrics',
      maxBatchSize: 100,
      autoSend: true,
      sendIntervalMs: 10000, // 10 seconds
      defaultDimensions: {},
      maxBufferSize: 10000,
      accountId: '',
      errorHandler: (error: Error, context: string) => {
        console.error(`CloudflareMetrics error [${context}]:`, error);
      },
      debug: false,
      ...config
    };
    
    // Set up Analytics Engine if provided
    if (bindings?.ANALYTICS) {
      this.analyticsEngine = bindings.ANALYTICS;
    }
    
    // Start auto-sending if enabled
    if (this.config.autoSend) {
      this.startAutoSend();
    }
    
    // Set up shutdown handler for clean exit
    this.setupShutdownHandler();
  }
  
  /**
   * Record a metric
   * 
   * @param name Metric name
   * @param value Metric value
   * @param options Additional options
   * @returns This client for chaining
   */
  record(
    name: string,
    value: number,
    options: {
      /** Additional dimensions */
      dimensions?: Record<string, string>;
      /** Timestamp (defaults to now) */
      timestamp?: number;
      /** Metric type */
      type?: MetricType;
      /** Metric unit */
      unit?: string;
    } = {}
  ): CloudflareMetricsClient {
    const timestamp = options.timestamp || Date.now();
    const dimensions = {
      ...this.config.defaultDimensions,
      ...options.dimensions
    };
    
    // Create the metric blob
    const metric: MetricBlob = {
      timestamp,
      name,
      value,
      dimensions,
      type: options.type || MetricType.GAUGE,
      unit: options.unit
    };
    
    // Add to buffer
    this.addToBuffer(metric);
    
    // Update aggregated metrics
    this.updateAggregation(metric);
    
    return this;
  }
  
  /**
   * Increment a counter metric
   * 
   * @param name Metric name
   * @param incrementBy Amount to increment by (default: 1)
   * @param dimensions Additional dimensions
   * @returns This client for chaining
   */
  increment(
    name: string,
    incrementBy: number = 1,
    dimensions?: Record<string, string>
  ): CloudflareMetricsClient {
    return this.record(name, incrementBy, {
      dimensions,
      type: MetricType.COUNTER
    });
  }
  
  /**
   * Record a gauge metric
   * 
   * @param name Metric name
   * @param value Gauge value
   * @param dimensions Additional dimensions
   * @param unit Optional unit
   * @returns This client for chaining
   */
  gauge(
    name: string,
    value: number,
    dimensions?: Record<string, string>,
    unit?: string
  ): CloudflareMetricsClient {
    return this.record(name, value, {
      dimensions,
      type: MetricType.GAUGE,
      unit
    });
  }
  
  /**
   * Record a histogram observation
   * 
   * @param name Metric name
   * @param value Observation value
   * @param dimensions Additional dimensions
   * @param unit Optional unit (e.g., 'ms' for milliseconds)
   * @returns This client for chaining
   */
  histogram(
    name: string,
    value: number,
    dimensions?: Record<string, string>,
    unit?: string
  ): CloudflareMetricsClient {
    return this.record(name, value, {
      dimensions,
      type: MetricType.HISTOGRAM,
      unit
    });
  }
  
  /**
   * Time a function execution and record as histogram
   * 
   * @param name Metric name
   * @param fn Function to time
   * @param dimensions Additional dimensions
   * @returns Result of the function
   */
  async timeAsync<T>(
    name: string,
    fn: () => Promise<T>,
    dimensions?: Record<string, string>
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.histogram(name, duration, dimensions, 'ms');
    }
  }
  
  /**
   * Time a synchronous function execution and record as histogram
   * 
   * @param name Metric name
   * @param fn Function to time
   * @param dimensions Additional dimensions
   * @returns Result of the function
   */
  timeSync<T>(
    name: string,
    fn: () => T,
    dimensions?: Record<string, string>
  ): T {
    const start = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - start;
      this.histogram(name, duration, dimensions, 'ms');
    }
  }
  
  /**
   * Send metrics to Cloudflare
   * 
   * @param forceFlushAll Whether to flush all metrics even if over batch size
   * @returns Promise that resolves when metrics are sent
   */
  async send(forceFlushAll: boolean = false): Promise<void> {
    // If no analytics engine, log and exit
    if (!this.analyticsEngine) {
      this.debug('No Analytics Engine binding provided, metrics will not be sent');
      return;
    }
    
    // If already sending, wait for current batch to complete
    if (this.sendPromise) {
      await this.sendPromise;
    }
    
    // If no metrics to send, exit
    if (this.metricsBuffer.length === 0) {
      return;
    }
    
    // Set last send attempt timestamp
    this.lastSendAttempt = Date.now();
    
    // Create a promise for the current send operation
    this.sendPromise = this.sendInternal(forceFlushAll);
    
    try {
      await this.sendPromise;
    } catch (error) {
      this.handleError(error, 'send');
    } finally {
      this.sendPromise = undefined;
    }
  }
  
  /**
   * Get aggregated metrics
   * 
   * @param name Optional metric name to filter by
   * @returns Array of aggregated metrics
   */
  getAggregatedMetrics(name?: string): AggregatedMetric[] {
    const metrics = Array.from(this.aggregatedMetrics.values());
    
    if (name) {
      return metrics.filter(metric => metric.name === name);
    }
    
    return metrics;
  }
  
  /**
   * Calculate percentiles for a histogram metric
   * 
   * @param name Metric name
   * @param percentiles Array of percentiles to calculate (0-100)
   * @param dimensions Optional dimensions to filter by
   * @returns Object with percentile values
   */
  calculatePercentiles(
    name: string,
    percentiles: number[] = [50, 90, 95, 99],
    dimensions?: Record<string, string>
  ): Record<string, number> {
    // Get all matching metrics
    const metrics = this.getAggregatedMetrics(name)
      .filter(metric => {
        // Filter by dimensions if provided
        if (!dimensions) return true;
        
        // Check if all requested dimensions match
        return Object.entries(dimensions).every(
          ([key, value]) => metric.dimensions[key] === value
        );
      });
    
    // Combine all values
    const allValues: number[] = [];
    metrics.forEach(metric => {
      if (metric.values) {
        allValues.push(...metric.values);
      }
    });
    
    // Sort values for percentile calculation
    allValues.sort((a, b) => a - b);
    
    // Calculate percentiles
    const result: Record<string, number> = {};
    
    percentiles.forEach(p => {
      if (p < 0 || p > 100) {
        throw new Error(`Percentile must be between 0 and 100, got ${p}`);
      }
      
      if (allValues.length === 0) {
        result[`p${p}`] = 0;
        return;
      }
      
      const index = Math.ceil((p / 100) * allValues.length) - 1;
      result[`p${p}`] = allValues[Math.max(0, Math.min(index, allValues.length - 1))];
    });
    
    return result;
  }
  
  /**
   * Reset all metrics
   * 
   * @returns This client for chaining
   */
  reset(): CloudflareMetricsClient {
    this.metricsBuffer = [];
    this.aggregatedMetrics.clear();
    return this;
  }
  
  /**
   * Stop auto-sending metrics
   * 
   * @returns This client for chaining
   */
  stopAutoSend(): CloudflareMetricsClient {
    if (this.sendInterval !== undefined) {
      clearInterval(this.sendInterval);
      this.sendInterval = undefined;
    }
    return this;
  }
  
  /**
   * Start auto-sending metrics
   * 
   * @returns This client for chaining
   */
  startAutoSend(): CloudflareMetricsClient {
    // Stop any existing interval
    this.stopAutoSend();
    
    // Start new interval
    this.sendInterval = setInterval(() => {
      this.send().catch(error => {
        this.handleError(error, 'autoSend');
      });
    }, this.config.sendIntervalMs);
    
    return this;
  }
  
  /**
   * Shutdown the client, flushing any pending metrics
   * 
   * @returns Promise that resolves when shutdown is complete
   */
  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    this.stopAutoSend();
    
    // Flush all remaining metrics
    await this.send(true);
  }
  
  // ----------------
  // Cloudflare-specific Metrics
  // ----------------
  
  /**
   * Record worker invocation metrics
   * 
   * @param workerName Worker name
   * @param durationMs Execution duration in milliseconds
   * @param success Whether the invocation was successful
   * @param region Cloudflare region
   * @returns This client for chaining
   */
  recordWorkerInvocation(
    workerName: string,
    durationMs: number,
    success: boolean = true,
    region?: string
  ): CloudflareMetricsClient {
    // Record invocation count
    this.increment('worker.invocations', 1, {
      worker: workerName,
      success: success.toString(),
      region: region || 'unknown'
    });
    
    // Record duration
    this.histogram('worker.duration', durationMs, {
      worker: workerName,
      success: success.toString(),
      region: region || 'unknown'
    }, 'ms');
    
    return this;
  }
  
  /**
   * Record KV operation metrics
   * 
   * @param namespace KV namespace
   * @param operation Operation type (read, write, delete, list)
   * @param durationMs Operation duration in milliseconds
   * @param size Size in bytes (for writes)
   * @param success Whether the operation was successful
   * @returns This client for chaining
   */
  recordKVOperation(
    namespace: string,
    operation: 'read' | 'write' | 'delete' | 'list',
    durationMs: number,
    size?: number,
    success: boolean = true
  ): CloudflareMetricsClient {
    // Record operation count
    this.increment('kv.operations', 1, {
      namespace,
      operation,
      success: success.toString()
    });
    
    // Record duration
    this.histogram('kv.duration', durationMs, {
      namespace,
      operation,
      success: success.toString()
    }, 'ms');
    
    // Record size for writes
    if (operation === 'write' && size !== undefined) {
      this.histogram('kv.size', size, {
        namespace,
        operation
      }, 'bytes');
    }
    
    return this;
  }
  
  /**
   * Record R2 operation metrics
   * 
   * @param bucketName Bucket name
   * @param operation Operation type
   * @param durationMs Operation duration in milliseconds
   * @param size Size in bytes (for uploads/downloads)
   * @param success Whether the operation was successful
   * @returns This client for chaining
   */
  recordR2Operation(
    bucketName: string,
    operation: 'upload' | 'download' | 'delete' | 'head' | 'list',
    durationMs: number,
    size?: number,
    success: boolean = true
  ): CloudflareMetricsClient {
    // Record operation count
    this.increment('r2.operations', 1, {
      bucket: bucketName,
      operation,
      success: success.toString()
    });
    
    // Record duration
    this.histogram('r2.duration', durationMs, {
      bucket: bucketName,
      operation,
      success: success.toString()
    }, 'ms');
    
    // Record size for uploads and downloads
    if ((operation === 'upload' || operation === 'download') && size !== undefined) {
      this.histogram('r2.size', size, {
        bucket: bucketName,
        operation
      }, 'bytes');
    }
    
    return this;
  }
  
  /**
   * Record D1 query metrics
   * 
   * @param database Database name
   * @param queryType Query type
   * @param durationMs Query duration in milliseconds
   * @param rowCount Number of rows affected/returned
   * @param success Whether the query was successful
   * @returns This client for chaining
   */
  recordD1Query(
    database: string,
    queryType: 'select' | 'insert' | 'update' | 'delete' | 'other',
    durationMs: number,
    rowCount?: number,
    success: boolean = true
  ): CloudflareMetricsClient {
    // Record query count
    this.increment('d1.queries', 1, {
      database,
      type: queryType,
      success: success.toString()
    });
    
    // Record duration
    this.histogram('d1.duration', durationMs, {
      database,
      type: queryType,
      success: success.toString()
    }, 'ms');
    
    // Record row count if available
    if (rowCount !== undefined) {
      this.histogram('d1.rows', rowCount, {
        database,
        type: queryType
      }, 'count');
    }
    
    return this;
  }
  
  /**
   * Record HTTP request metrics
   * 
   * @param path Request path
   * @param method HTTP method
   * @param statusCode Response status code
   * @param durationMs Request duration in milliseconds
   * @param size Response size in bytes
   * @returns This client for chaining
   */
  recordHttpRequest(
    path: string,
    method: string,
    statusCode: number,
    durationMs: number,
    size?: number
  ): CloudflareMetricsClient {
    const success = statusCode < 400;
    const statusCategory = `${Math.floor(statusCode / 100)}xx`;
    
    // Record request count
    this.increment('http.requests', 1, {
      path,
      method,
      status: statusCode.toString(),
      statusCategory,
      success: success.toString()
    });
    
    // Record duration
    this.histogram('http.duration', durationMs, {
      path,
      method,
      status: statusCode.toString(),
      statusCategory,
      success: success.toString()
    }, 'ms');
    
    // Record response size if available
    if (size !== undefined) {
      this.histogram('http.response.size', size, {
        path,
        method,
        status: statusCode.toString(),
        statusCategory
      }, 'bytes');
    }
    
    return this;
  }
  
  // ----------------
  // Private Methods
  // ----------------
  
  /**
   * Add a metric to the buffer
   */
  private addToBuffer(metric: MetricBlob): void {
    // Add to buffer
    this.metricsBuffer.push(metric);
    
    // If buffer exceeds max size, remove oldest entries
    if (this.metricsBuffer.length > this.config.maxBufferSize) {
      this.metricsBuffer = this.metricsBuffer.slice(
        this.metricsBuffer.length - this.config.maxBufferSize
      );
    }
  }
  
  /**
   * Update aggregated metrics with a new value
   */
  private updateAggregation(metric: MetricBlob): void {
    // Create a key from name and dimensions
    const dimensionsKey = JSON.stringify(metric.dimensions || {});
    const key = `${metric.name}:${dimensionsKey}`;
    
    // Get or create aggregation
    let aggregation = this.aggregatedMetrics.get(key);
    
    if (!aggregation) {
      aggregation = {
        name: metric.name,
        dimensions: metric.dimensions || {},
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        lastUpdated: 0,
        values: metric.type === MetricType.HISTOGRAM ? [] : undefined
      };
    }
    
    // Update aggregation
    aggregation.count++;
    aggregation.sum += metric.value;
    aggregation.min = Math.min(aggregation.min, metric.value);
    aggregation.max = Math.max(aggregation.max, metric.value);
    aggregation.lastUpdated = metric.timestamp;
    
    // Store values for histograms
    if (metric.type === MetricType.HISTOGRAM && aggregation.values) {
      // Keep the most recent values, up to 1000
      if (aggregation.values.length >= 1000) {
        aggregation.values.shift();
      }
      
      aggregation.values.push(metric.value);
    }
    
    // Store updated aggregation
    this.aggregatedMetrics.set(key, aggregation);
  }
  
  /**
   * Internal send function
   */
  private async sendInternal(forceFlushAll: boolean): Promise<void> {
    // Get metrics to send
    const batchSize = forceFlushAll ? this.metricsBuffer.length : Math.min(
      this.metricsBuffer.length,
      this.config.maxBatchSize
    );
    
    const batch = this.metricsBuffer.slice(0, batchSize);
    
    if (batch.length === 0) {
      return;
    }
    
    this.debug(`Sending ${batch.length} metrics to Analytics Engine`);
    
    try {
      // Send metrics to Analytics Engine
      await this.analyticsEngine.writeDataPoints(
        this.config.dataset,
        batch.map(metric => ({
          indexes: {
            'metric_name': metric.name,
            ...metric.dimensions
          },
          doubles: {
            'value': metric.value
          },
          blobs: {
            'type': metric.type || MetricType.GAUGE,
            'unit': metric.unit || ''
          },
          timestamp: new Date(metric.timestamp)
        }))
      );
      
      // Remove sent metrics from buffer
      this.metricsBuffer = this.metricsBuffer.slice(batchSize);
      
      this.debug(`Successfully sent ${batch.length} metrics`);
    } catch (error) {
      this.debug(`Failed to send metrics: ${error}`);
      throw error;
    }
  }
  
  /**
   * Handle errors
   */
  private handleError(error: any, context: string): void {
    this.config.errorHandler(error instanceof Error ? error : new Error(String(error)), context);
  }
  
  /**
   * Log debug messages if debug is enabled
   */
  private debug(message: string): void {
    if (this.config.debug) {
      console.debug(`[CloudflareMetrics] ${message}`);
    }
  }
  
  /**
   * Set up handler for worker shutdown
   */
  private setupShutdownHandler(): void {
    // For Cloudflare Workers, we can listen for event.passThroughOnException()
    // In a real environment, this would be handled by the worker runtime
    
    // Example for a hypothetical shutdown handler:
    if (typeof addEventListener === 'function') {
      addEventListener('unload', () => {
        if (!this.shuttingDown) {
          this.shutdown().catch(error => {
            this.handleError(error, 'shutdown');
          });
        }
      });
    }
  }
}

// ----------------
// Middleware and Integration
// ----------------

/**
 * Create a metrics middleware for worker requests
 * 
 * @param metricsClient CloudflareMetricsClient instance
 * @param options Middleware options
 * @returns Middleware function
 */
export function createMetricsMiddleware(
  metricsClient: CloudflareMetricsClient,
  options: {
    /** Paths to exclude from metrics */
    excludePaths?: string[];
    /** Whether to record request sizes */
    recordSizes?: boolean;
    /** Function to normalize paths for grouping */
    normalizePath?: (path: string) => string;
  } = {}
): (request: Request, env: any, ctx: any) => Promise<Response> {
  return async (request: Request, env: any, ctx: any) => {
    const startTime = performance.now();
    const url = new URL(request.url);
    const path = options.normalizePath ? options.normalizePath(url.pathname) : url.pathname;
    
    // Skip metrics for excluded paths
    if (options.excludePaths && options.excludePaths.some(p => path.startsWith(p))) {
      return await ctx.next();
    }
    
    let response: Response;
    try {
      // Pass to next middleware or handler
      response = await ctx.next();
      
      // Record request metrics
      const durationMs = performance.now() - startTime;
      const size = options.recordSizes && response.headers.has('content-length')
        ? parseInt(response.headers.get('content-length') || '0', 10)
        : undefined;
      
      metricsClient.recordHttpRequest(
        path,
        request.method,
        response.status,
        durationMs,
        size
      );
      
      return response;
    } catch (error) {
      // Record error metrics
      const durationMs = performance.now() - startTime;
      
      metricsClient.recordHttpRequest(
        path,
        request.method,
        500, // Assume 500 for errors
        durationMs
      );
      
      // Also record as a specific error
      metricsClient.increment('http.errors', 1, {
        path,
        method: request.method,
        errorType: error.name || 'UnknownError'
      });
      
      // Re-throw the error
      throw error;
    }
  };
}

/**
 * Create a CloudflareMetricsClient instance
 * 
 * @param config Configuration options
 * @param bindings Cloudflare runtime bindings
 * @returns Configured CloudflareMetricsClient
 */
export function createMetricsClient(
  config: CloudflareMetricsConfig = {},
  bindings?: CloudflareAnalyticsBindings
): CloudflareMetricsClient {
  return new CloudflareMetricsClient(config, bindings);
}

/**
 * Helper function to normalize URLs by replacing IDs with placeholders
 * 
 * @param path URL path to normalize
 * @returns Normalized path
 */
export function normalizeUrlPath(path: string): string {
  // Replace UUID pattern
  path = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );
  
  // Replace numeric IDs
  path = path.replace(/\/\d+\/?/g, '/:id/');
  
  // Replace common ID patterns
  path = path.replace(/\/([\w-]+)\/[\w-]{10,}/, '/$1/:id');
  
  return path;
}

export default {
  CloudflareMetricsClient,
  createMetricsClient,
  createMetricsMiddleware,
  normalizeUrlPath,
  MetricType
};