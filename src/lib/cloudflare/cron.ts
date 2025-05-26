// src/lib/cloudflare/cron.ts
/**
 * Cloudflare Cron Utilities
 * This module provides utilities for working with Cloudflare Workers
 * scheduled events (cron triggers), including job registration,
 * schedule parsing, and event handling.
 */
import type { KVNamespace, ScheduledEvent, ExecutionContext } from '@cloudflare/workers-types';

export type CronSchedule = string;

export enum CronPresets {
  EVERY_MINUTE = '* * * * *',
  EVERY_5_MINUTES = '*/5 * * * *',
  EVERY_HOUR = '0 * * * *',
  EVERY_DAY_MIDNIGHT = '0 0 * * *',
}

export interface CronJobOptions {
  id: string;
  schedule: CronSchedule;
  handler: (event: ScheduledEvent, env: any, ctx: ExecutionContext) => Promise<void>;
  description?: string;
  retries?: {
    maxAttempts: number;
    backoffMs: number;
    strategy: 'linear' | 'exponential';
  };
  lastRun?: {
    timestamp: number;
    status: 'success' | 'failure';
    durationMs: number;
    error?: string; // Optional error message
  };
}

export interface CronRegistryConfig {
  autoHandleErrors?: boolean;
  stateKVNamespace?: KVNamespace;
  metricPrefix?: string;
}

export class CronRegistry {
  private jobs: Map<string, CronJobOptions> = new Map();
  private config: CronRegistryConfig;

  constructor(config: CronRegistryConfig = {}) {
    this.config = {
      autoHandleErrors: true,
      metricPrefix: 'cron',
      ...config
    };
  }

  register(options: CronJobOptions): CronRegistry {
    if (this.jobs.has(options.id)) {
      throw new Error(`Cron job with ID ${options.id} already exists`);
    }
    this.jobs.set(options.id, options);
    return this;
  }

  async handleScheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext): Promise<void> {
    const matchingJobs = Array.from(this.jobs.values()).filter(job => job.schedule === event.cron);
    if (matchingJobs.length === 0) {
      console.warn(`No jobs found for cron schedule: ${event.cron}`);
      return;
    }
    const jobPromises = matchingJobs.map(job => this.executeJob(job, event, env, ctx));
    await Promise.all(jobPromises);
  }

  private async executeJob(job: CronJobOptions, event: ScheduledEvent, env: any, ctx: ExecutionContext): Promise<void> {
    const startTime = Date.now();
    let caughtErrorValue: Error | null = null;
    let attemptCount = 0;

    const executeWithRetries = async (): Promise<void> => {
      attemptCount++;
      try {
        await job.handler(event, env, ctx);
        caughtErrorValue = null;
      } catch (err: unknown) {
        if (err instanceof Error) {
          caughtErrorValue = err;
        } else {
          caughtErrorValue = new Error(String(err));
        }
        
        if (job.retries && attemptCount < job.retries.maxAttempts) {
          const delay = job.retries.strategy === 'exponential'
            ? job.retries.backoffMs * Math.pow(2, attemptCount - 1)
            : job.retries.backoffMs * attemptCount;
          console.log(`Retrying job ${job.id} (attempt ${attemptCount + 1}/${job.retries.maxAttempts}) after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeWithRetries();
        }
        if (this.config.autoHandleErrors) {
          console.error(`Error executing job ${job.id}:`, caughtErrorValue);
        } else {
          if (caughtErrorValue) throw caughtErrorValue;
          else throw new Error("Unknown error during retry exhaustion for job " + job.id);
        }
      }
    };

    await executeWithRetries();
    const durationMs = Date.now() - startTime;

    const currentStatus: 'success' | 'failure' = caughtErrorValue ? 'failure' : 'success';
    
    // Directly check caughtErrorValue before accessing .message for the error property
    const lastRunInfo: NonNullable<CronJobOptions['lastRun']> = {
      timestamp: startTime,
      status: currentStatus,
      durationMs,
      error: caughtErrorValue ? caughtErrorValue.message : undefined,
    };
    
    job.lastRun = lastRunInfo;

    if (this.config.stateKVNamespace) {
      try {
        await this.config.stateKVNamespace.put(
          `cronJob:${job.id}:lastRun`,
          JSON.stringify(lastRunInfo)
        );
      } catch (kvError: unknown) {
        const message = kvError instanceof Error ? kvError.message : String(kvError);
        console.error(`Failed to persist job state to KV for job ${job.id}:`, message);
      }
    }
  }
}