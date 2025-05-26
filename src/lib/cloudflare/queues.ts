// src/lib/cloudflare/queues.ts
/**
 * Cloudflare Queues Utilities
 * 
 * Note: Queues are planned for Phase 3+ (Pro tier) per project documentation.
 * This module provides the foundation for future queue implementation.
 */

import type { Queue, MessageBatch, Message } from '@cloudflare/workers-types';

// ----------------
// Types
// ----------------

/**
 * Standard message format for all queues
 */
export interface QueueMessage<T = unknown> {
  id: string;
  type: string;
  timestamp: number;
  entityId?: string;
  userId?: string;
  data: T;
  retryCount?: number;
  maxRetries?: number;
  metadata?: Record<string, any>;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  name: string;
  maxBatchSize?: number;
  maxBatchTimeout?: number;
  maxRetries?: number;
  deadLetterQueue?: string;
  retryDelayMs?: number;
  exponentialBackoff?: boolean;
}

/**
 * Result of processing a message
 */
export interface ProcessResult {
  success: boolean;
  error?: string;
  retry?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Queue metrics for monitoring
 */
export interface QueueMetrics {
  messagesProcessed: number;
  messagesFailed: number;
  messagesRetried: number;
  averageProcessingTimeMs: number;
  lastProcessedAt?: number;
}

// ----------------
// Message Types (for future use)
// ----------------

export enum MessageType {
  // Document processing
  DOCUMENT_UPLOADED = 'document.uploaded',
  DOCUMENT_OCR_REQUIRED = 'document.ocr_required',
  DOCUMENT_EXTRACTED = 'document.extracted',
  
  // Transaction processing
  TRANSACTION_CREATED = 'transaction.created',
  TRANSACTION_RECONCILE = 'transaction.reconcile',
  TRANSACTION_CATEGORIZE = 'transaction.categorize',
  
  // Report generation
  REPORT_GENERATE = 'report.generate',
  REPORT_EXPORT = 'report.export',
  REPORT_SCHEDULE = 'report.schedule',
  
  // Notifications
  EMAIL_SEND = 'email.send',
  SMS_SEND = 'sms.send',
  WEBHOOK_DISPATCH = 'webhook.dispatch',
  
  // Data sync
  ENTITY_SYNC = 'entity.sync',
  BACKUP_DATABASE = 'backup.database',
  IMPORT_DATA = 'import.data',
  
  // Real estate specific
  RENT_DUE_REMINDER = 'rent.due_reminder',
  LEASE_EXPIRY_NOTICE = 'lease.expiry_notice',
  MAINTENANCE_SCHEDULED = 'maintenance.scheduled',
}

// ----------------
// Queue Handler Base Class
// ----------------

/**
 * Base class for queue message handlers
 */
export abstract class QueueHandler<T = unknown> {
  protected config: QueueConfig;
  protected metrics: QueueMetrics = {
    messagesProcessed: 0,
    messagesFailed: 0,
    messagesRetried: 0,
    averageProcessingTimeMs: 0,
  };

  constructor(config: QueueConfig) {
    this.config = config;
  }

  /**
   * Process a batch of messages
   */
  async processBatch(batch: MessageBatch<QueueMessage<T>>): Promise<void> {
    const startTime = Date.now();
    const results = await Promise.allSettled(
      batch.messages.map(message => this.processMessage(message))
    );

    // Handle failed messages
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const message = batch.messages[i];

      if (result.status === 'rejected') {
        await this.handleError(message, result.reason);
      }
    }

    // Update metrics
    this.updateMetrics(batch.messages.length, Date.now() - startTime);
  }

  /**
   * Process a single message
   */
  protected async processMessage(message: Message<QueueMessage<T>>): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Add processing metadata
      const enrichedMessage: QueueMessage<T> = {
        ...message.body,
        metadata: {
          ...message.body.metadata,
          processingStartedAt: startTime,
          attemptNumber: (message.body.retryCount ?? 0) + 1,
        }
      };

      const result = await this.handle(enrichedMessage);
      
      if (!result.success) {
        if (result.retry && this.shouldRetry(message.body)) {
          await this.retryMessage(message);
          this.metrics.messagesRetried++;
        } else {
          await this.sendToDeadLetter(message, result.error || 'Processing failed');
          this.metrics.messagesFailed++;
        }
      } else {
        this.metrics.messagesProcessed++;
      }
      
      // Acknowledge the message
      message.ack();
    } catch (error) {
      await this.handleError(message, error);
    }
  }

  /**
   * Handle a message - to be implemented by subclasses
   */
  protected abstract handle(message: QueueMessage<T>): Promise<ProcessResult>;

  /**
   * Handle processing errors
   */
  protected async handleError(message: Message<QueueMessage<T>>, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing message ${message.id}:`, errorMessage, {
      messageType: message.body.type,
      entityId: message.body.entityId,
      userId: message.body.userId,
      retryCount: message.body.retryCount,
    });
    
    if (this.shouldRetry(message.body)) {
      await this.retryMessage(message);
      this.metrics.messagesRetried++;
    } else {
      await this.sendToDeadLetter(message, errorMessage);
      this.metrics.messagesFailed++;
      message.ack(); // Remove from queue
    }
  }

  /**
   * Check if message should be retried
   */
  protected shouldRetry(message: QueueMessage<T>): boolean {
    const maxRetries = message.maxRetries ?? this.config.maxRetries ?? 3;
    const currentRetries = message.retryCount ?? 0;
    return currentRetries < maxRetries;
  }

  /**
   * Calculate retry delay with optional exponential backoff
   */
  protected getRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryDelayMs ?? 1000;
    
    if (this.config.exponentialBackoff) {
      return baseDelay * Math.pow(2, retryCount);
    }
    
    return baseDelay;
  }

  /**
   * Retry a message
   */
  protected async retryMessage(message: Message<QueueMessage<T>>): Promise<void> {
    const retryCount = (message.body.retryCount ?? 0) + 1;
    const delay = this.getRetryDelay(retryCount);
    
    console.warn(`Retrying message ${message.id} (attempt ${retryCount}) with ${delay}ms delay`);
    
    // Update retry metadata
    const retryMessage: QueueMessage<T> = {
      ...message.body,
      retryCount,
      metadata: {
        ...message.body.metadata,
        lastRetryAt: Date.now(),
        nextRetryDelay: delay,
      }
    };
    
    message.retry({
      delaySeconds: Math.ceil(delay / 1000),
    });
  }

  /**
   * Send message to dead letter queue
   */
  protected async sendToDeadLetter(message: Message<QueueMessage<T>>, error: string): Promise<void> {
    console.error(`Sending message ${message.id} to dead letter queue:`, {
      error,
      messageType: message.body.type,
      entityId: message.body.entityId,
      userId: message.body.userId,
      originalTimestamp: message.body.timestamp,
      retryCount: message.body.retryCount,
    });
    
    // In a real implementation, this would send to a dead letter queue
    // with full error context for debugging and potential manual retry
  }

  /**
   * Update processing metrics
   */
  protected updateMetrics(messageCount: number, processingTimeMs: number): void {
    const currentTotal = this.metrics.averageProcessingTimeMs * 
      (this.metrics.messagesProcessed + this.metrics.messagesFailed);
    const newTotal = currentTotal + processingTimeMs;
    const totalMessages = this.metrics.messagesProcessed + 
      this.metrics.messagesFailed + messageCount;
    
    this.metrics.averageProcessingTimeMs = newTotal / totalMessages;
    this.metrics.lastProcessedAt = Date.now();
  }

  /**
   * Get current metrics
   */
  public getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }
}

// ----------------
// Example Handler Implementations
// ----------------

/**
 * Example: Document processing handler
 */
export class DocumentProcessingHandler extends QueueHandler<{ documentId: string; operation: string }> {
  protected async handle(message: QueueMessage<{ documentId: string; operation: string }>): Promise<ProcessResult> {
    // Placeholder implementation
    console.log(`[PLACEHOLDER] Processing document ${message.data.documentId} with operation ${message.data.operation}`);
    
    // In a real implementation:
    // 1. Retrieve document from R2
    // 2. Process based on operation (OCR, extraction, etc.)
    // 3. Store results
    // 4. Update document status
    
    return { success: true };
  }
}

/**
 * Example: Report generation handler
 */
export class ReportGenerationHandler extends QueueHandler<{ reportId: string; type: string; params: any }> {
  protected async handle(message: QueueMessage<{ reportId: string; type: string; params: any }>): Promise<ProcessResult> {
    // Placeholder implementation
    console.log(`[PLACEHOLDER] Generating ${message.data.type} report with ID ${message.data.reportId}`);
    
    // In a real implementation:
    // 1. Generate report based on type and params
    // 2. Store in R2 or cache in KV
    // 3. Send notification when complete
    
    return { success: true };
  }
}

// ----------------
// Factory Functions
// ----------------

/**
 * Create a queue message
 */
export function createQueueMessage<T>(
  type: string,
  data: T,
  options: Partial<QueueMessage<T>> = {}
): QueueMessage<T> {
  return {
    id: crypto.randomUUID(),
    type,
    timestamp: Date.now(),
    data,
    retryCount: 0,
    maxRetries: 3,
    ...options,
  };
}

/**
 * Placeholder for sending messages to a queue
 * Will be implemented when Queues are enabled (Phase 3+)
 */
export async function sendToQueue<T>(
  _queue: Queue<QueueMessage<T>>,
  message: QueueMessage<T>
): Promise<void> {
  // Placeholder implementation
  console.log(`[PLACEHOLDER] Would send message to queue:`, {
    id: message.id,
    type: message.type,
    entityId: message.entityId,
    userId: message.userId,
  });
  // await queue.send(message);
}

/**
 * Placeholder for batch sending messages
 */
export async function sendBatchToQueue<T>(
  _queue: Queue<QueueMessage<T>>,
  messages: QueueMessage<T>[]
): Promise<void> {
  // Placeholder implementation
  console.log(`[PLACEHOLDER] Would send ${messages.length} messages to queue`);
  // await queue.sendBatch(messages);
}

/**
 * Create a queue configuration with defaults
 */
export function createQueueConfig(
  name: string,
  overrides: Partial<QueueConfig> = {}
): QueueConfig {
  return {
    name,
    maxBatchSize: 10,
    maxBatchTimeout: 30000, // 30 seconds
    maxRetries: 3,
    retryDelayMs: 1000,
    exponentialBackoff: true,
    ...overrides,
  };
}

/**
 * Queue registry for managing multiple queues (placeholder)
 */
export class QueueRegistry {
  private queues: Map<string, QueueConfig> = new Map();
  private handlers: Map<string, QueueHandler<any>> = new Map();

  register(config: QueueConfig, handler: QueueHandler<any>): void {
    this.queues.set(config.name, config);
    this.handlers.set(config.name, handler);
  }

  getHandler(queueName: string): QueueHandler<any> | undefined {
    return this.handlers.get(queueName);
  }

  getConfig(queueName: string): QueueConfig | undefined {
    return this.queues.get(queueName);
  }

  getAllMetrics(): Record<string, QueueMetrics> {
    const metrics: Record<string, QueueMetrics> = {};
    
    for (const [name, handler] of this.handlers) {
      metrics[name] = handler.getMetrics();
    }
    
    return metrics;
  }
}