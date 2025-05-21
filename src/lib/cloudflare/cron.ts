// src/lib/cloudflare/cron.ts
/**
 * Cloudflare Cron Utilities
 * 
 * This module provides utilities for working with Cloudflare Workers
 * scheduled events (cron triggers), including job registration,
 * schedule parsing, and event handling.
 */

// ----------------
// Types
// ----------------

/**
 * Type for cron schedule expressions
 * Cloudflare supports standard cron syntax with 5 fields: minute, hour, day of month, month, day of week
 */
export type CronSchedule = string;

/**
 * Predefined cron schedules
 */
export enum CronPresets {
  EVERY_MINUTE = '* * * * *',
  EVERY_5_MINUTES = '*/5 * * * *',
  EVERY_10_MINUTES = '*/10 * * * *',
  EVERY_15_MINUTES = '*/15 * * * *',
  EVERY_30_MINUTES = '*/30 * * * *',
  EVERY_HOUR = '0 * * * *',
  EVERY_DAY_MIDNIGHT = '0 0 * * *',
  EVERY_DAY_MORNING = '0 8 * * *',
  EVERY_WEEK = '0 0 * * 0',
  EVERY_MONTH = '0 0 1 * *',
  EVERY_QUARTER = '0 0 1 1,4,7,10 *',
  EVERY_YEAR = '0 0 1 1 *'
}

/**
 * Options for a cron job
 */
export interface CronJobOptions {
  /** Unique identifier for this job */
  id: string;
  /** Cron expression for the schedule */
  schedule: CronSchedule;
  /** Handler function to execute */
  handler: (event: ScheduledEvent, env: any, ctx: ExecutionContext) => Promise<void>;
  /** Human-readable description of the job */
  description?: string;
  /** Retry configuration if job fails */
  retries?: {
    /** Maximum number of retry attempts */
    maxAttempts: number;
    /** Base delay between retries (in ms) */
    backoffMs: number;
    /** Strategy for increasing delay between retries */
    strategy: 'linear' | 'exponential';
  };
  /** Timeout in ms (not directly configurable in CF Workers, but tracked for monitoring) */
  timeoutMs?: number;
  /** Last run time and status (for tracking purposes) */
  lastRun?: {
    /** Timestamp of last run */
    timestamp: number;
    /** Status of last run */
    status: 'success' | 'failure';
    /** Duration of last run in ms */
    durationMs: number;
    /** Error message if failed */
    error?: string;
  };
}

/**
 * Cron job registry configuration
 */
export interface CronRegistryConfig {
  /** Whether to automatically catch and log errors */
  autoHandleErrors?: boolean;
  /** KV namespace for persisting job state */
  stateKVNamespace?: KVNamespace;
  /** Metric name prefix for logging */
  metricPrefix?: string;
}

/**
 * Interface for the expected properties of a Cloudflare Worker ScheduledEvent
 */
interface ScheduledEvent {
  readonly scheduledTime: number;
  readonly cron: string;
  waitUntil(promise: Promise<any>): void;
}

/**
 * Interface for the expected properties of a Cloudflare Worker ExecutionContext
 */
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

// ----------------
// Cron Registry
// ----------------

/**
 * Registry for managing cron jobs in a Cloudflare Worker
 */
export class CronRegistry {
  private jobs: Map<string, CronJobOptions> = new Map();
  private config: CronRegistryConfig;
  
  /**
   * Create a new cron registry
   * 
   * @param config Configuration options
   */
  constructor(config: CronRegistryConfig = {}) {
    this.config = {
      autoHandleErrors: true,
      metricPrefix: 'cron',
      ...config
    };
  }
  
  /**
   * Register a new cron job
   * 
   * @param options Job options
   * @returns The registry instance for chaining
   */
  register(options: CronJobOptions): CronRegistry {
    // Validate the cron expression
    if (!this.isValidCronExpression(options.schedule)) {
      throw new Error(`Invalid cron expression: ${options.schedule}`);
    }
    
    // Check for duplicate job ID
    if (this.jobs.has(options.id)) {
      throw new Error(`Cron job with ID ${options.id} already exists`);
    }
    
    // Store the job
    this.jobs.set(options.id, options);
    
    return this;
  }
  
  /**
   * Unregister a cron job
   * 
   * @param id Job ID to unregister
   * @returns True if the job was unregistered, false if not found
   */
  unregister(id: string): boolean {
    return this.jobs.delete(id);
  }
  
  /**
   * Get a registered job by ID
   * 
   * @param id Job ID to retrieve
   * @returns The job options or null if not found
   */
  getJob(id: string): CronJobOptions | null {
    return this.jobs.get(id) || null;
  }
  
  /**
   * List all registered jobs
   * 
   * @returns Array of job options
   */
  listJobs(): CronJobOptions[] {
    return Array.from(this.jobs.values());
  }
  
  /**
   * Handle a scheduled event by finding and executing the appropriate job
   * 
   * @param event Cloudflare scheduled event
   * @param env Environment variables
   * @param ctx Execution context
   * @returns Promise that resolves when the job completes
   */
  async handleScheduled(
    event: ScheduledEvent, 
    env: any, 
    ctx: ExecutionContext
  ): Promise<void> {
    // Find jobs matching this cron expression
    const matchingJobs = Array.from(this.jobs.values())
      .filter(job => job.schedule === event.cron);
    
    if (matchingJobs.length === 0) {
      console.warn(`No jobs found for cron schedule: ${event.cron}`);
      return;
    }
    
    // Execute all matching jobs
    const jobPromises = matchingJobs.map(job => this.executeJob(job, event, env, ctx));
    
    // Wait for all jobs to complete
    await Promise.all(jobPromises);
  }
  
  /**
   * Execute a specific job
   * 
   * @param job Job to execute
   * @param event Scheduled event
   * @param env Environment variables
   * @param ctx Execution context
   * @returns Promise that resolves when the job completes
   */
  private async executeJob(
    job: CronJobOptions,
    event: ScheduledEvent,
    env: any,
    ctx: ExecutionContext
  ): Promise<void> {
    const startTime = Date.now();
    let error: Error | null = null;
    let attemptCount = 0;
    
    const executeWithRetries = async (): Promise<void> => {
      attemptCount++;
      
      try {
        // Execute the job handler
        await job.handler(event, env, ctx);
        error = null;
      } catch (err) {
        error = err as Error;
        
        // Check if we should retry
        if (job.retries && attemptCount < job.retries.maxAttempts) {
          // Calculate backoff delay
          let delay = job.retries.backoffMs;
          
          if (job.retries.strategy === 'exponential') {
            delay = job.retries.backoffMs * Math.pow(2, attemptCount - 1);
          } else {
            delay = job.retries.backoffMs * attemptCount;
          }
          
          // Log retry attempt
          console.log(`Retrying job ${job.id} (attempt ${attemptCount + 1}/${job.retries.maxAttempts}) after ${delay}ms`);
          
          // Wait for backoff period
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry the job
          return executeWithRetries();
        }
        
        // If auto error handling is enabled, log the error but don't throw
        if (this.config.autoHandleErrors) {
          console.error(`Error executing job ${job.id}:`, error);
        } else {
          throw error;
        }
      }
    };
    
    // Execute the job with retries if configured
    await executeWithRetries();
    
    // Calculate duration
    const durationMs = Date.now() - startTime;
    
    // Update job last run status
    job.lastRun = {
      timestamp: startTime,
      status: error ? 'failure' : 'success',
      durationMs,
      error: error ? error.message : undefined
    };
    
    // Persist job state if KV namespace is configured
    if (this.config.stateKVNamespace) {
      try {
        await this.config.stateKVNamespace.put(
          `cronJob:${job.id}:lastRun`,
          JSON.stringify(job.lastRun)
        );
      } catch (kvError) {
        console.error(`Failed to persist job state to KV:`, kvError);
      }
    }
    
    // Report metrics if enabled
    this.reportMetrics(job, durationMs, error);
  }
  
  /**
   * Report metrics for a job execution
   * 
   * @param job The executed job
   * @param durationMs Execution duration in ms
   * @param error Error if the job failed
   */
  private reportMetrics(
    job: CronJobOptions,
    durationMs: number,
    error: Error | null
  ): void {
    // In a production environment, this would send metrics to a monitoring system
    // For now, we'll just log them
    
    const metricPrefix = this.config.metricPrefix || 'cron';
    const metricName = `${metricPrefix}.job.${job.id}`;
    
    console.log(`METRIC ${metricName}.duration ${durationMs}ms`);
    console.log(`METRIC ${metricName}.success ${error ? 0 : 1}`);
    
    // Log additional details for monitoring
    console.log(`Job ${job.id} completed in ${durationMs}ms with status ${error ? 'failure' : 'success'}`);
  }
  
  /**
   * Validate a cron expression
   * 
   * @param expression Cron expression to validate
   * @returns True if the expression is valid
   */
  private isValidCronExpression(expression: string): boolean {
    // Basic validation for cron expressions
    const cronRegex = /^(\S+\s+){4}\S+$/;
    if (!cronRegex.test(expression)) {
      return false;
    }
    
    // Split into fields
    const fields = expression.split(/\s+/);
    
    // Validate each field (simplified validation)
    const validators = [
      // Minutes: 0-59
      (val: string) => /^(\*|\d+)$/.test(val) || /^\*\/\d+$/.test(val) || /^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(val),
      // Hours: 0-23
      (val: string) => /^(\*|\d+)$/.test(val) || /^\*\/\d+$/.test(val) || /^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(val),
      // Day of month: 1-31
      (val: string) => /^(\*|\d+)$/.test(val) || /^\*\/\d+$/.test(val) || /^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(val),
      // Month: 1-12 or JAN-DEC
      (val: string) => /^(\*|\d+|[A-Za-z]{3})$/.test(val) || /^\*\/\d+$/.test(val) || /^(\d+|[A-Za-z]{3})(-(\d+|[A-Za-z]{3}))?(,(\d+|[A-Za-z]{3})(-(\d+|[A-Za-z]{3}))?)*$/.test(val),
      // Day of week: 0-6 or SUN-SAT
      (val: string) => /^(\*|\d+|[A-Za-z]{3})$/.test(val) || /^\*\/\d+$/.test(val) || /^(\d+|[A-Za-z]{3})(-(\d+|[A-Za-z]{3}))?(,(\d+|[A-Za-z]{3})(-(\d+|[A-Za-z]{3}))?)*$/.test(val)
    ];
    
    return fields.every((field, index) => validators[index](field));
  }
}

// ----------------
// Helper Functions
// ----------------

/**
 * Parse a cron schedule to get the next run time
 * 
 * @param schedule Cron schedule to parse
 * @param fromDate Base date to calculate from (defaults to now)
 * @returns Date object representing the next run time
 */
export function getNextRunTime(
  schedule: CronSchedule,
  fromDate: Date = new Date()
): Date {
  // This is a simplified implementation that doesn't handle all cron syntax
  // A production implementation would use a library like cron-parser
  
  const fields = schedule.split(/\s+/);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  
  // Start with the from date
  const nextRun = new Date(fromDate);
  
  // Reset seconds and milliseconds
  nextRun.setSeconds(0);
  nextRun.setMilliseconds(0);
  
  // Simple handling for common patterns
  if (minute === '*') {
    // Every minute - use the next minute
    nextRun.setMinutes(nextRun.getMinutes() + 1);
  } else if (minute.startsWith('*/')) {
    // Every n minutes
    const interval = parseInt(minute.substring(2), 10);
    const currentMinute = nextRun.getMinutes();
    const nextMinute = currentMinute + (interval - (currentMinute % interval || interval));
    
    if (nextMinute > 59) {
      nextRun.setHours(nextRun.getHours() + 1);
      nextRun.setMinutes(nextMinute % 60);
    } else {
      nextRun.setMinutes(nextMinute);
    }
  } else if (/^\d+$/.test(minute)) {
    // Specific minute
    const targetMinute = parseInt(minute, 10);
    const currentMinute = nextRun.getMinutes();
    
    if (targetMinute <= currentMinute) {
      // Move to next hour
      nextRun.setHours(nextRun.getHours() + 1);
    }
    
    nextRun.setMinutes(targetMinute);
  }
  
  // Handle specific hour if not wildcard
  if (hour !== '*' && !/^\*\//.test(hour) && /^\d+$/.test(hour)) {
    const targetHour = parseInt(hour, 10);
    const currentHour = nextRun.getHours();
    
    if (
      targetHour < currentHour || 
      (targetHour === currentHour && nextRun.getMinutes() <= fromDate.getMinutes())
    ) {
      // Move to next day
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    nextRun.setHours(targetHour);
  }
  
  // This is a simplified implementation - a complete one would handle
  // all cron syntax and edge cases
  
  return nextRun;
}

/**
 * Format a cron schedule as a human-readable string
 * 
 * @param schedule Cron schedule to format
 * @returns Human-readable description
 */
export function formatCronSchedule(schedule: CronSchedule): string {
  // Map common patterns to readable strings
  const patterns: Record<string, string> = {
    '* * * * *': 'Every minute',
    '*/5 * * * *': 'Every 5 minutes',
    '*/10 * * * *': 'Every 10 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '*/30 * * * *': 'Every 30 minutes',
    '0 * * * *': 'Every hour',
    '0 0 * * *': 'Every day at midnight',
    '0 8 * * *': 'Every day at 8:00 AM',
    '0 0 * * 0': 'Every Sunday at midnight',
    '0 0 1 * *': 'First day of every month at midnight',
    '0 0 1 1,4,7,10 *': 'First day of every quarter at midnight',
    '0 0 1 1 *': 'January 1st at midnight'
  };
  
  // Return the pattern if found
  if (patterns[schedule]) {
    return patterns[schedule];
  }
  
  // Otherwise, provide a basic description
  const fields = schedule.split(/\s+/);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  
  let description = '';
  
  // Parse minute field
  if (minute === '*') {
    description += 'Every minute';
  } else if (minute.startsWith('*/')) {
    const interval = parseInt(minute.substring(2), 10);
    description += `Every ${interval} minutes`;
  } else {
    description += `At minute ${minute}`;
  }
  
  // Parse hour field
  if (hour !== '*') {
    if (hour.startsWith('*/')) {
      const interval = parseInt(hour.substring(2), 10);
      description += ` of every ${interval} hours`;
    } else {
      description += ` of hour ${hour}`;
    }
  }
  
  // Parse day of month
  if (dayOfMonth !== '*') {
    description += ` on day ${dayOfMonth} of the month`;
  }
  
  // Parse month
  if (month !== '*') {
    description += ` in month ${month}`;
  }
  
  // Parse day of week
  if (dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (/^\d+$/.test(dayOfWeek)) {
      const day = parseInt(dayOfWeek, 10);
      description += ` on ${days[day]}`;
    } else {
      description += ` on day ${dayOfWeek} of the week`;
    }
  }
  
  return description;
}

/**
 * Create a cron job handler function for a Cloudflare Worker
 * 
 * @param registry Cron registry to use
 * @returns Handler function for scheduled events
 */
export function createCronHandler(registry: CronRegistry): (event: ScheduledEvent, env: any, ctx: ExecutionContext) => Promise<void> {
  return async (event: ScheduledEvent, env: any, ctx: ExecutionContext) => {
    await registry.handleScheduled(event, env, ctx);
  };
}

// ----------------
// Factory Functions
// ----------------

/**
 * Create a daily job that runs at a specific time
 * 
 * @param id Job ID
 * @param hour Hour to run (0-23)
 * @param minute Minute to run (0-59)
 * @param handler Job handler function
 * @param description Optional job description
 * @returns Job options object
 */
export function createDailyJob(
  id: string,
  hour: number,
  minute: number,
  handler: (event: ScheduledEvent, env: any, ctx: ExecutionContext) => Promise<void>,
  description?: string
): CronJobOptions {
  return {
    id,
    schedule: `${minute} ${hour} * * *`,
    handler,
    description: description || `Daily job at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  };
}

/**
 * Create a weekly job that runs on a specific day and time
 * 
 * @param id Job ID
 * @param dayOfWeek Day of week (0-6, Sunday = 0)
 * @param hour Hour to run (0-23)
 * @param minute Minute to run (0-59)
 * @param handler Job handler function
 * @param description Optional job description
 * @returns Job options object
 */
export function createWeeklyJob(
  id: string,
  dayOfWeek: number,
  hour: number,
  minute: number,
  handler: (event: ScheduledEvent, env: any, ctx: ExecutionContext) => Promise<void>,
  description?: string
): CronJobOptions {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return {
    id,
    schedule: `${minute} ${hour} * * ${dayOfWeek}`,
    handler,
    description: description || `Weekly job on ${days[dayOfWeek]} at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  };
}

/**
 * Create a monthly job that runs on a specific day and time
 * 
 * @param id Job ID
 * @param dayOfMonth Day of month (1-31)
 * @param hour Hour to run (0-23)
 * @param minute Minute to run (0-59)
 * @param handler Job handler function
 * @param description Optional job description
 * @returns Job options object
 */
export function createMonthlyJob(
  id: string,
  dayOfMonth: number,
  hour: number,
  minute: number,
  handler: (event: ScheduledEvent, env: any, ctx: ExecutionContext) => Promise<void>,
  description?: string
): CronJobOptions {
  return {
    id,
    schedule: `${minute} ${hour} ${dayOfMonth} * *`,
    handler,
    description: description || `Monthly job on day ${dayOfMonth} at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  };
}

export default {
  CronRegistry,
  CronPresets,
  getNextRunTime,
  formatCronSchedule,
  createCronHandler,
  createDailyJob,
  createWeeklyJob,
  createMonthlyJob
};