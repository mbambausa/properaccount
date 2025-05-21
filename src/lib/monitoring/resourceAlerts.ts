// src/lib/monitoring/resourceAlerts.ts
/**
 * Resource Alerts Monitoring System
 * 
 * This module provides utilities for monitoring resource usage,
 * defining thresholds, and generating alerts when thresholds are exceeded.
 */

import { formatDate } from '../../utils/format';

// ----------------
// Types
// ----------------

/**
 * Supported resource types to monitor
 */
export enum ResourceType {
  CPU_USAGE = 'cpu_usage',
  MEMORY_USAGE = 'memory_usage',
  R2_STORAGE = 'r2_storage',
  R2_REQUESTS = 'r2_requests',
  D1_STORAGE = 'd1_storage',
  D1_QUERIES = 'd1_queries',
  KV_STORAGE = 'kv_storage',
  KV_READS = 'kv_reads',
  KV_WRITES = 'kv_writes',
  WORKERS_INVOCATIONS = 'workers_invocations',
  WORKERS_DURATION = 'workers_duration',
  API_REQUESTS = 'api_requests',
  UNIQUE_USERS = 'unique_users',
  ERROR_RATE = 'error_rate',
  LATENCY = 'latency',
  QUEUE_SIZE = 'queue_size',
  CUSTOM = 'custom'
}

/**
 * Unit types for resource measurements
 */
export enum ResourceUnit {
  PERCENTAGE = 'percentage',
  BYTES = 'bytes',
  KILOBYTES = 'kilobytes',
  MEGABYTES = 'megabytes',
  GIGABYTES = 'gigabytes',
  COUNT = 'count',
  MILLISECONDS = 'milliseconds',
  SECONDS = 'seconds',
  REQUESTS_PER_SECOND = 'requests_per_second',
  QUERIES_PER_SECOND = 'queries_per_second',
  ERRORS_PER_MINUTE = 'errors_per_minute',
  CUSTOM = 'custom'
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Alert status
 */
export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  MUTED = 'muted'
}

/**
 * Comparison operators for thresholds
 */
export enum ComparisonOperator {
  GREATER_THAN = '>',
  GREATER_THAN_OR_EQUAL = '>=',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUAL = '<=',
  EQUAL = '==',
  NOT_EQUAL = '!='
}

/**
 * Notification channels for alerts
 */
export enum NotificationChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  PUSH = 'push',
  DASHBOARD = 'dashboard'
}

/**
 * Resource threshold definition
 */
export interface ResourceThreshold {
  /** Unique identifier for this threshold */
  id: string;
  /** Resource type being monitored */
  resourceType: ResourceType;
  /** Specific resource name or ID (e.g., specific worker name) */
  resourceName?: string;
  /** Unit for the measurement */
  unit: ResourceUnit;
  /** Comparison operator for threshold evaluation */
  operator: ComparisonOperator;
  /** Threshold value */
  value: number;
  /** Duration the threshold must be exceeded before alerting (in seconds) */
  durationSeconds?: number;
  /** Alert severity when threshold is exceeded */
  severity: AlertSeverity;
  /** Notification channels to use for alerts */
  notificationChannels: NotificationChannel[];
  /** Human-readable description */
  description?: string;
  /** Whether to send a resolution notification when the issue resolves */
  notifyOnResolution?: boolean;
  /** Tags for categorization and filtering */
  tags?: string[];
  /** Whether this threshold is enabled */
  enabled: boolean;
  /** Custom function to evaluate threshold (for CUSTOM type) */
  customEvaluator?: (metrics: ResourceMetric[]) => boolean;
}

/**
 * Resource measurement data point
 */
export interface ResourceMetric {
  /** Resource type */
  resourceType: ResourceType;
  /** Specific resource name or ID */
  resourceName?: string;
  /** Timestamp of the measurement */
  timestamp: number;
  /** Measured value */
  value: number;
  /** Measurement unit */
  unit: ResourceUnit;
  /** Additional context or dimensions */
  context?: Record<string, any>;
}

/**
 * Alert object representing a threshold violation
 */
export interface Alert {
  /** Unique identifier for this alert */
  id: string;
  /** Threshold that triggered the alert */
  threshold: ResourceThreshold;
  /** Timestamp when the alert was triggered */
  triggeredAt: number;
  /** Metric that triggered the alert */
  triggeringMetric: ResourceMetric;
  /** Current status of the alert */
  status: AlertStatus;
  /** Timestamp when the alert was acknowledged (if applicable) */
  acknowledgedAt?: number;
  /** User who acknowledged the alert (if applicable) */
  acknowledgedBy?: string;
  /** Timestamp when the alert was resolved (if applicable) */
  resolvedAt?: number;
  /** Whether resolution notifications have been sent */
  resolutionNotified?: boolean;
  /** Additional alert context */
  context?: Record<string, any>;
}

/**
 * Alert notification payload
 */
export interface AlertNotification {
  /** Associated alert */
  alert: Alert;
  /** Notification message */
  message: string;
  /** HTML formatted message (for supported channels) */
  htmlMessage?: string;
  /** Channel to send the notification through */
  channel: NotificationChannel;
  /** Additional notification metadata */
  metadata?: Record<string, any>;
}

/**
 * Configuration for notification channels
 */
export interface NotificationConfig {
  /** Email notification settings */
  email?: {
    /** Recipients */
    recipients: string[];
    /** From address */
    from: string;
    /** Reply-to address */
    replyTo?: string;
  };
  /** Slack notification settings */
  slack?: {
    /** Webhook URL */
    webhookUrl: string;
    /** Channel to post to */
    channel?: string;
    /** Username to post as */
    username?: string;
    /** Icon URL or emoji */
    icon?: string;
  };
  /** Generic webhook settings */
  webhook?: {
    /** Webhook URL */
    url: string;
    /** HTTP method */
    method?: 'POST' | 'PUT';
    /** Custom headers */
    headers?: Record<string, string>;
  };
  /** SMS notification settings */
  sms?: {
    /** Phone numbers to send to */
    phoneNumbers: string[];
    /** Service provider (e.g., twilio, sns) */
    provider: string;
    /** Provider-specific settings */
    providerSettings?: Record<string, any>;
  };
  /** Push notification settings */
  push?: {
    /** Topics or channels */
    topics: string[];
    /** Service settings */
    settings?: Record<string, any>;
  };
}

/**
 * Options for silencing/muting alerts
 */
export interface AlertMute {
  /** Unique identifier for this mute */
  id: string;
  /** When this mute becomes active */
  startTime: number;
  /** When this mute ends (optional for indefinite mutes) */
  endTime?: number;
  /** Match alerts by threshold IDs (if empty, applies to all) */
  thresholdIds?: string[];
  /** Match alerts by resource types */
  resourceTypes?: ResourceType[];
  /** Match alerts by resource names */
  resourceNames?: string[];
  /** Match alerts by severity */
  severities?: AlertSeverity[];
  /** Match alerts by tags */
  tags?: string[];
  /** Reason for the mute */
  reason?: string;
  /** User who created the mute */
  createdBy?: string;
}

/**
 * Configuration for the resource alerts system
 */
export interface ResourceAlertsConfig {
  /** Resource thresholds */
  thresholds: ResourceThreshold[];
  /** Notification configurations */
  notificationConfigs: Record<NotificationChannel, any>;
  /** Active mutes */
  mutes: AlertMute[];
  /** Logging function */
  logger?: (message: string, level: string, data?: any) => void;
  /** Storage provider for alert state */
  storage?: AlertStorage;
  /** Deduplication window in seconds */
  deduplicationWindowSeconds?: number;
  /** Default notification channels if not specified on threshold */
  defaultNotificationChannels?: NotificationChannel[];
}

/**
 * Interface for alert storage provider
 */
export interface AlertStorage {
  /** Save an alert */
  saveAlert(alert: Alert): Promise<void>;
  /** Get an alert by ID */
  getAlert(id: string): Promise<Alert | null>;
  /** Get active alerts */
  getActiveAlerts(): Promise<Alert[]>;
  /** Update an alert */
  updateAlert(alert: Alert): Promise<void>;
  /** Save a mute */
  saveMute(mute: AlertMute): Promise<void>;
  /** Get active mutes */
  getActiveMutes(timestamp?: number): Promise<AlertMute[]>;
  /** Delete a mute */
  deleteMute(id: string): Promise<void>;
}

// ----------------
// Resource Alerts Manager
// ----------------

/**
 * Main class for managing resource alerts
 */
export class ResourceAlertsManager {
  private config: ResourceAlertsConfig;
  private activeAlerts: Map<string, Alert> = new Map();
  private metricsBuffer: ResourceMetric[] = [];
  
  /**
   * Create a new ResourceAlertsManager
   * 
   * @param config Configuration options
   */
  constructor(config: ResourceAlertsConfig) {
    this.config = {
      deduplicationWindowSeconds: 300, // 5 minutes
      ...config
    };
    
    // Load active alerts from storage if available
    this.loadActiveAlerts();
  }
  
  /**
   * Add a new threshold to monitor
   * 
   * @param threshold Threshold definition
   * @returns ID of the added threshold
   */
  addThreshold(threshold: ResourceThreshold): string {
    // Generate ID if not provided
    if (!threshold.id) {
      threshold.id = crypto.randomUUID();
    }
    
    // Add to thresholds list
    this.config.thresholds.push(threshold);
    this.log('info', `Added threshold ${threshold.id}`, threshold);
    
    return threshold.id;
  }
  
  /**
   * Update an existing threshold
   * 
   * @param id Threshold ID
   * @param updates Partial updates to apply
   * @returns Updated threshold or null if not found
   */
  updateThreshold(id: string, updates: Partial<ResourceThreshold>): ResourceThreshold | null {
    const index = this.config.thresholds.findIndex(t => t.id === id);
    
    if (index === -1) {
      return null;
    }
    
    // Apply updates
    this.config.thresholds[index] = {
      ...this.config.thresholds[index],
      ...updates
    };
    
    this.log('info', `Updated threshold ${id}`, this.config.thresholds[index]);
    return this.config.thresholds[index];
  }
  
  /**
   * Remove a threshold
   * 
   * @param id Threshold ID
   * @returns True if removed, false if not found
   */
  removeThreshold(id: string): boolean {
    const index = this.config.thresholds.findIndex(t => t.id === id);
    
    if (index === -1) {
      return false;
    }
    
    // Remove threshold
    this.config.thresholds.splice(index, 1);
    this.log('info', `Removed threshold ${id}`);
    
    return true;
  }
  
  /**
   * Get all defined thresholds
   */
  getThresholds(): ResourceThreshold[] {
    return [...this.config.thresholds];
  }
  
  /**
   * Report a new resource metric
   * 
   * @param metric Resource metric to report
   * @returns void
   */
  async reportMetric(metric: ResourceMetric): Promise<void> {
    // Add to buffer
    this.metricsBuffer.push(metric);
    
    // Process metrics against thresholds
    await this.evaluateThresholds([metric]);
    
    // Clean up old metrics
    this.cleanupMetricsBuffer();
  }
  
  /**
   * Report multiple metrics at once
   * 
   * @param metrics Resource metrics to report
   * @returns void
   */
  async reportMetrics(metrics: ResourceMetric[]): Promise<void> {
    // Add to buffer
    this.metricsBuffer.push(...metrics);
    
    // Process metrics against thresholds
    await this.evaluateThresholds(metrics);
    
    // Clean up old metrics
    this.cleanupMetricsBuffer();
  }
  
  /**
   * Get active alerts
   * 
   * @returns Active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(
      alert => alert.status === AlertStatus.ACTIVE || alert.status === AlertStatus.ACKNOWLEDGED
    );
  }
  
  /**
   * Acknowledge an alert
   * 
   * @param alertId Alert ID
   * @param userId User ID acknowledging the alert
   * @returns Updated alert or null if not found
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<Alert | null> {
    const alert = this.activeAlerts.get(alertId);
    
    if (!alert) {
      return null;
    }
    
    // Update alert status
    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = Date.now();
    alert.acknowledgedBy = userId;
    
    // Save to storage if available
    if (this.config.storage) {
      await this.config.storage.updateAlert(alert);
    }
    
    this.log('info', `Alert ${alertId} acknowledged by ${userId}`, alert);
    return alert;
  }
  
  /**
   * Manually resolve an alert
   * 
   * @param alertId Alert ID
   * @returns Updated alert or null if not found
   */
  async resolveAlert(alertId: string): Promise<Alert | null> {
    const alert = this.activeAlerts.get(alertId);
    
    if (!alert) {
      return null;
    }
    
    // Update alert status
    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = Date.now();
    
    // Send resolution notification if configured
    if (alert.threshold.notifyOnResolution && !alert.resolutionNotified) {
      await this.sendResolutionNotifications(alert);
      alert.resolutionNotified = true;
    }
    
    // Save to storage if available
    if (this.config.storage) {
      await this.config.storage.updateAlert(alert);
    }
    
    // Remove from active alerts
    this.activeAlerts.delete(alertId);
    
    this.log('info', `Alert ${alertId} resolved manually`, alert);
    return alert;
  }
  
  /**
   * Mute alerts matching certain criteria
   * 
   * @param mute Mute definition
   * @returns ID of the created mute
   */
  async muteAlerts(mute: AlertMute): Promise<string> {
    // Generate ID if not provided
    if (!mute.id) {
      mute.id = crypto.randomUUID();
    }
    
    // Ensure start time is set
    if (!mute.startTime) {
      mute.startTime = Date.now();
    }
    
    // Add to mutes list
    this.config.mutes.push(mute);
    
    // Save to storage if available
    if (this.config.storage) {
      await this.config.storage.saveMute(mute);
    }
    
    this.log('info', `Created mute ${mute.id}`, mute);
    return mute.id;
  }
  
  /**
   * Unmute (remove) a mute
   * 
   * @param muteId Mute ID
   * @returns True if removed, false if not found
   */
  async unmute(muteId: string): Promise<boolean> {
    const index = this.config.mutes.findIndex(m => m.id === muteId);
    
    if (index === -1) {
      return false;
    }
    
    // Remove mute
    this.config.mutes.splice(index, 1);
    
    // Remove from storage if available
    if (this.config.storage) {
      await this.config.storage.deleteMute(muteId);
    }
    
    this.log('info', `Removed mute ${muteId}`);
    return true;
  }
  
  /**
   * Get active mutes
   * 
   * @returns Active mute definitions
   */
  getActiveMutes(): AlertMute[] {
    const now = Date.now();
    
    return this.config.mutes.filter(mute => 
      mute.startTime <= now && (!mute.endTime || mute.endTime > now)
    );
  }
  
  // ----------------
  // Private Methods
  // ----------------
  
  /**
   * Load active alerts from storage
   */
  private async loadActiveAlerts(): Promise<void> {
    if (!this.config.storage) {
      return;
    }
    
    try {
      const alerts = await this.config.storage.getActiveAlerts();
      
      for (const alert of alerts) {
        this.activeAlerts.set(alert.id, alert);
      }
      
      this.log('info', `Loaded ${alerts.length} active alerts from storage`);
    } catch (error) {
      this.log('error', 'Failed to load active alerts from storage', error);
    }
  }
  
  /**
   * Evaluate metrics against thresholds
   */
  private async evaluateThresholds(metrics: ResourceMetric[]): Promise<void> {
    const now = Date.now();
    const activeMutes = this.getActiveMutes();
    
    // Loop through enabled thresholds
    for (const threshold of this.config.thresholds.filter(t => t.enabled)) {
      // Skip if threshold is muted
      if (this.isThresholdMuted(threshold, activeMutes)) {
        continue;
      }
      
      // Filter metrics relevant for this threshold
      const relevantMetrics = metrics.filter(metric => 
        metric.resourceType === threshold.resourceType &&
        (!threshold.resourceName || metric.resourceName === threshold.resourceName)
      );
      
      if (relevantMetrics.length === 0) {
        continue;
      }
      
      // Evaluate metrics against threshold
      for (const metric of relevantMetrics) {
        const thresholdExceeded = this.evaluateThreshold(threshold, metric);
        
        if (thresholdExceeded) {
          // Check if duration requirement is met (if specified)
          if (threshold.durationSeconds) {
            const durationStart = now - (threshold.durationSeconds * 1000);
            
            // Get historical metrics for this resource
            const historicalMetrics = this.metricsBuffer.filter(m => 
              m.resourceType === metric.resourceType &&
              m.resourceName === metric.resourceName &&
              m.timestamp >= durationStart
            );
            
            // Check if all historical metrics exceed the threshold
            const allExceed = historicalMetrics.every(m => 
              this.evaluateThreshold(threshold, m)
            );
            
            if (!allExceed || historicalMetrics.length < 2) {
              continue;
            }
          }
          
          // Check for existing alert for this threshold
          const existingAlert = Array.from(this.activeAlerts.values()).find(alert => 
            alert.threshold.id === threshold.id &&
            (alert.status === AlertStatus.ACTIVE || alert.status === AlertStatus.ACKNOWLEDGED) &&
            // Check for resource match
            (alert.triggeringMetric.resourceType === metric.resourceType) &&
            (alert.triggeringMetric.resourceName === metric.resourceName)
          );
          
          if (existingAlert) {
            // Skip if within deduplication window
            const dedupeWindow = this.config.deduplicationWindowSeconds * 1000;
            if ((now - existingAlert.triggeredAt) < dedupeWindow) {
              continue;
            }
            
            // Update existing alert with new metric
            existingAlert.triggeringMetric = metric;
            
            // Store updated alert
            if (this.config.storage) {
              await this.config.storage.updateAlert(existingAlert);
            }
          } else {
            // Create new alert
            const alert: Alert = {
              id: crypto.randomUUID(),
              threshold,
              triggeredAt: now,
              triggeringMetric: metric,
              status: AlertStatus.ACTIVE
            };
            
            // Add to active alerts
            this.activeAlerts.set(alert.id, alert);
            
            // Store alert if storage is available
            if (this.config.storage) {
              await this.config.storage.saveAlert(alert);
            }
            
            // Send notifications
            await this.sendAlertNotifications(alert);
            
            this.log('info', `Created new alert ${alert.id}`, alert);
          }
        } else {
          // Check for existing alert that should be resolved
          const existingAlert = Array.from(this.activeAlerts.values()).find(alert => 
            alert.threshold.id === threshold.id &&
            (alert.status === AlertStatus.ACTIVE || alert.status === AlertStatus.ACKNOWLEDGED) &&
            // Check for resource match
            (alert.triggeringMetric.resourceType === metric.resourceType) &&
            (alert.triggeringMetric.resourceName === metric.resourceName)
          );
          
          if (existingAlert) {
            // Only auto-resolve if below threshold for the duration period
            if (threshold.durationSeconds) {
              const durationStart = now - (threshold.durationSeconds * 1000);
              
              // Get historical metrics for this resource
              const historicalMetrics = this.metricsBuffer.filter(m => 
                m.resourceType === metric.resourceType &&
                m.resourceName === metric.resourceName &&
                m.timestamp >= durationStart
              );
              
              // Check if all historical metrics are below the threshold
              const allBelow = historicalMetrics.every(m => 
                !this.evaluateThreshold(threshold, m)
              );
              
              if (!allBelow || historicalMetrics.length < 2) {
                continue;
              }
            }
            
            // Auto-resolve the alert
            existingAlert.status = AlertStatus.RESOLVED;
            existingAlert.resolvedAt = now;
            
            // Send resolution notification if configured
            if (threshold.notifyOnResolution && !existingAlert.resolutionNotified) {
              await this.sendResolutionNotifications(existingAlert);
              existingAlert.resolutionNotified = true;
            }
            
            // Store updated alert
            if (this.config.storage) {
              await this.config.storage.updateAlert(existingAlert);
            }
            
            // Remove from active alerts
            this.activeAlerts.delete(existingAlert.id);
            
            this.log('info', `Auto-resolved alert ${existingAlert.id}`, existingAlert);
          }
        }
      }
    }
  }
  
  /**
   * Evaluate a single metric against a threshold
   */
  private evaluateThreshold(threshold: ResourceThreshold, metric: ResourceMetric): boolean {
    // Use custom evaluator if provided (for CUSTOM type)
    if (threshold.resourceType === ResourceType.CUSTOM && threshold.customEvaluator) {
      return threshold.customEvaluator([metric]);
    }
    
    // Ensure units match or convert
    let metricValue = metric.value;
    if (metric.unit !== threshold.unit) {
      metricValue = this.convertUnit(metricValue, metric.unit, threshold.unit);
    }
    
    // Compare using the specified operator
    switch (threshold.operator) {
      case ComparisonOperator.GREATER_THAN:
        return metricValue > threshold.value;
      case ComparisonOperator.GREATER_THAN_OR_EQUAL:
        return metricValue >= threshold.value;
      case ComparisonOperator.LESS_THAN:
        return metricValue < threshold.value;
      case ComparisonOperator.LESS_THAN_OR_EQUAL:
        return metricValue <= threshold.value;
      case ComparisonOperator.EQUAL:
        return metricValue === threshold.value;
      case ComparisonOperator.NOT_EQUAL:
        return metricValue !== threshold.value;
      default:
        return false;
    }
  }
  
  /**
   * Send notifications for a new alert
   */
  private async sendAlertNotifications(alert: Alert): Promise<void> {
    // Determine notification channels
    const channels = alert.threshold.notificationChannels.length > 0
      ? alert.threshold.notificationChannels
      : this.config.defaultNotificationChannels || [NotificationChannel.DASHBOARD];
    
    // Prepare alert message
    const message = this.formatAlertMessage(alert);
    const htmlMessage = this.formatAlertHtmlMessage(alert);
    
    // Send notification to each channel
    for (const channel of channels) {
      const notification: AlertNotification = {
        alert,
        message,
        htmlMessage,
        channel
      };
      
      try {
        await this.sendNotification(notification);
      } catch (error) {
        this.log('error', `Failed to send notification to ${channel}`, error);
      }
    }
  }
  
  /**
   * Send resolution notifications for a resolved alert
   */
  private async sendResolutionNotifications(alert: Alert): Promise<void> {
    // Determine notification channels
    const channels = alert.threshold.notificationChannels.length > 0
      ? alert.threshold.notificationChannels
      : this.config.defaultNotificationChannels || [NotificationChannel.DASHBOARD];
    
    // Prepare resolution message
    const message = this.formatResolutionMessage(alert);
    const htmlMessage = this.formatResolutionHtmlMessage(alert);
    
    // Send notification to each channel
    for (const channel of channels) {
      const notification: AlertNotification = {
        alert,
        message,
        htmlMessage,
        channel
      };
      
      try {
        await this.sendNotification(notification);
      } catch (error) {
        this.log('error', `Failed to send resolution notification to ${channel}`, error);
      }
    }
  }
  
  /**
   * Send a notification to a specific channel
   */
  private async sendNotification(notification: AlertNotification): Promise<void> {
    const { channel } = notification;
    
    // Get channel config
    const channelConfig = this.config.notificationConfigs[channel];
    
    if (!channelConfig) {
      this.log('error', `No configuration found for channel ${channel}`);
      return;
    }
    
    switch (channel) {
      case NotificationChannel.EMAIL:
        await this.sendEmailNotification(notification, channelConfig);
        break;
      case NotificationChannel.SLACK:
        await this.sendSlackNotification(notification, channelConfig);
        break;
      case NotificationChannel.WEBHOOK:
        await this.sendWebhookNotification(notification, channelConfig);
        break;
      case NotificationChannel.SMS:
        await this.sendSmsNotification(notification, channelConfig);
        break;
      case NotificationChannel.PUSH:
        await this.sendPushNotification(notification, channelConfig);
        break;
      case NotificationChannel.DASHBOARD:
        // Dashboard notifications are handled automatically by storing the alert
        break;
      default:
        this.log('warning', `Unsupported notification channel: ${channel}`);
    }
  }
  
  /**
   * Send an email notification
   */
  private async sendEmailNotification(
    notification: AlertNotification,
    config: any
  ): Promise<void> {
    // In a real implementation, this would send an email using a service
    // For now, we'll just log the email details
    
    this.log('info', `[EMAIL NOTIFICATION] To: ${config.recipients.join(', ')}
From: ${config.from}
Subject: ${this.getAlertSubject(notification.alert)}

${notification.message}`);
  }
  
  /**
   * Send a Slack notification
   */
  private async sendSlackNotification(
    notification: AlertNotification,
    config: any
  ): Promise<void> {
    // In a real implementation, this would send a message to Slack
    // For now, we'll just log the Slack details
    
    // Format severity color
    const color = this.getSeverityColor(notification.alert.threshold.severity);
    
    // Create Slack payload
    const payload = {
      channel: config.channel,
      username: config.username || 'Resource Alerts',
      icon_emoji: config.icon && config.icon.startsWith(':') ? config.icon : undefined,
      icon_url: config.icon && !config.icon.startsWith(':') ? config.icon : undefined,
      attachments: [
        {
          color,
          title: this.getAlertSubject(notification.alert),
          text: notification.message,
          ts: Math.floor(notification.alert.triggeredAt / 1000)
        }
      ]
    };
    
    this.log('info', `[SLACK NOTIFICATION] Webhook: ${config.webhookUrl}`, payload);
  }
  
  /**
   * Send a webhook notification
   */
  private async sendWebhookNotification(
    notification: AlertNotification,
    config: any
  ): Promise<void> {
    // In a real implementation, this would send a POST request to the webhook URL
    // For now, we'll just log the webhook details
    
    const payload = {
      alert: notification.alert,
      message: notification.message,
      timestamp: Date.now()
    };
    
    this.log('info', `[WEBHOOK NOTIFICATION] URL: ${config.url}, Method: ${config.method || 'POST'}`, payload);
  }
  
  /**
   * Send an SMS notification
   */
  private async sendSmsNotification(
    notification: AlertNotification,
    config: any
  ): Promise<void> {
    // In a real implementation, this would send an SMS using a service
    // For now, we'll just log the SMS details
    
    this.log('info', `[SMS NOTIFICATION] To: ${config.phoneNumbers.join(', ')}
Provider: ${config.provider}

${notification.message.substring(0, 160)}`);
  }
  
  /**
   * Send a push notification
   */
  private async sendPushNotification(
    notification: AlertNotification,
    config: any
  ): Promise<void> {
    // In a real implementation, this would send a push notification
    // For now, we'll just log the push details
    
    this.log('info', `[PUSH NOTIFICATION] Topics: ${config.topics.join(', ')}
Title: ${this.getAlertSubject(notification.alert)}

${notification.message.substring(0, 200)}`);
  }
  
  /**
   * Format an alert subject line
   */
  private getAlertSubject(alert: Alert): string {
    const { threshold, triggeringMetric } = alert;
    const status = alert.status === AlertStatus.RESOLVED ? '[RESOLVED] ' : '';
    const severity = threshold.severity.toUpperCase();
    
    return `${status}[${severity}] ${threshold.resourceType} alert for ${triggeringMetric.resourceName || 'system'}`;
  }
  
  /**
   * Format an alert message
   */
  private formatAlertMessage(alert: Alert): string {
    const { threshold, triggeringMetric, triggeredAt } = alert;
    const triggerTime = formatDate(new Date(triggeredAt));
    const resource = triggeringMetric.resourceName || 'system';
    
    let message = `[${threshold.severity.toUpperCase()}] ${threshold.resourceType} alert for ${resource}\n\n`;
    message += `Threshold: ${triggeringMetric.value} ${triggeringMetric.unit} ${threshold.operator} ${threshold.value} ${threshold.unit}\n`;
    message += `Triggered at: ${triggerTime}\n`;
    
    if (threshold.description) {
      message += `\nDescription: ${threshold.description}\n`;
    }
    
    message += `\nAlert ID: ${alert.id}`;
    
    return message;
  }
  
  /**
   * Format an alert HTML message
   */
  private formatAlertHtmlMessage(alert: Alert): string {
    const { threshold, triggeringMetric, triggeredAt } = alert;
    const triggerTime = formatDate(new Date(triggeredAt));
    const resource = triggeringMetric.resourceName || 'system';
    const severityColor = this.getSeverityColor(threshold.severity);
    
    let message = `<div style="border-left: 4px solid ${severityColor}; padding-left: 10px;">`;
    message += `<h3 style="margin: 0; color: ${severityColor};">[${threshold.severity.toUpperCase()}] ${threshold.resourceType} alert for ${resource}</h3>`;
    message += `<p><strong>Threshold:</strong> ${triggeringMetric.value} ${triggeringMetric.unit} ${threshold.operator} ${threshold.value} ${threshold.unit}</p>`;
    message += `<p><strong>Triggered at:</strong> ${triggerTime}</p>`;
    
    if (threshold.description) {
      message += `<p><strong>Description:</strong> ${threshold.description}</p>`;
    }
    
    message += `<p><small>Alert ID: ${alert.id}</small></p>`;
    message += `</div>`;
    
    return message;
  }
  
  /**
   * Format a resolution message
   */
  private formatResolutionMessage(alert: Alert): string {
    const { threshold, triggeringMetric, resolvedAt } = alert;
    const resolveTime = formatDate(new Date(resolvedAt));
    const resource = triggeringMetric.resourceName || 'system';
    
    let message = `[RESOLVED] ${threshold.resourceType} alert for ${resource}\n\n`;
    message += `Threshold: ${triggeringMetric.value} ${triggeringMetric.unit} ${threshold.operator} ${threshold.value} ${threshold.unit}\n`;
    message += `Resolved at: ${resolveTime}\n`;
    message += `Duration: ${this.formatDuration(resolvedAt - alert.triggeredAt)}\n`;
    
    message += `\nAlert ID: ${alert.id}`;
    
    return message;
  }
  
  /**
   * Format a resolution HTML message
   */
  private formatResolutionHtmlMessage(alert: Alert): string {
    const { threshold, triggeringMetric, resolvedAt } = alert;
    const resolveTime = formatDate(new Date(resolvedAt));
    const resource = triggeringMetric.resourceName || 'system';
    
    let message = `<div style="border-left: 4px solid #28a745; padding-left: 10px;">`;
    message += `<h3 style="margin: 0; color: #28a745;">[RESOLVED] ${threshold.resourceType} alert for ${resource}</h3>`;
    message += `<p><strong>Threshold:</strong> ${triggeringMetric.value} ${triggeringMetric.unit} ${threshold.operator} ${threshold.value} ${threshold.unit}</p>`;
    message += `<p><strong>Resolved at:</strong> ${resolveTime}</p>`;
    message += `<p><strong>Duration:</strong> ${this.formatDuration(resolvedAt - alert.triggeredAt)}</p>`;
    
    message += `<p><small>Alert ID: ${alert.id}</small></p>`;
    message += `</div>`;
    
    return message;
  }
  
  /**
   * Format a duration in milliseconds to a human-readable string
   */
  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    
    if (seconds < 60) {
      return `${seconds} second${seconds === 1 ? '' : 's'}`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours < 24) {
      if (remainingMinutes === 0) {
        return `${hours} hour${hours === 1 ? '' : 's'}`;
      }
      return `${hours} hour${hours === 1 ? '' : 's'}, ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
    }
    
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (remainingHours === 0) {
      return `${days} day${days === 1 ? '' : 's'}`;
    }
    return `${days} day${days === 1 ? '' : 's'}, ${remainingHours} hour${remainingHours === 1 ? '' : 's'}`;
  }
  
  /**
   * Get a color for a severity level
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.INFO:
        return '#17a2b8'; // Info blue
      case AlertSeverity.WARNING:
        return '#ffc107'; // Warning yellow
      case AlertSeverity.ERROR:
        return '#dc3545'; // Error red
      case AlertSeverity.CRITICAL:
        return '#6f42c1'; // Critical purple
      default:
        return '#6c757d'; // Default gray
    }
  }
  
  /**
   * Check if a threshold is currently muted
   */
  private isThresholdMuted(threshold: ResourceThreshold, mutes: AlertMute[]): boolean {
    return mutes.some(mute => {
      // Check threshold ID match
      if (mute.thresholdIds && mute.thresholdIds.length > 0) {
        if (!mute.thresholdIds.includes(threshold.id)) {
          return false;
        }
      }
      
      // Check resource type match
      if (mute.resourceTypes && mute.resourceTypes.length > 0) {
        if (!mute.resourceTypes.includes(threshold.resourceType)) {
          return false;
        }
      }
      
      // Check resource name match
      if (mute.resourceNames && mute.resourceNames.length > 0) {
        if (!threshold.resourceName || !mute.resourceNames.includes(threshold.resourceName)) {
          return false;
        }
      }
      
      // Check severity match
      if (mute.severities && mute.severities.length > 0) {
        if (!mute.severities.includes(threshold.severity)) {
          return false;
        }
      }
      
      // Check tag match
      if (mute.tags && mute.tags.length > 0 && threshold.tags) {
        const hasMatchingTag = threshold.tags.some(tag => mute.tags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Convert a value between different units
   */
  private convertUnit(
    value: number,
    fromUnit: ResourceUnit,
    toUnit: ResourceUnit
  ): number {
    // Simple unit conversion for common cases
    
    // Bytes-based conversions
    if (
      [ResourceUnit.BYTES, ResourceUnit.KILOBYTES, ResourceUnit.MEGABYTES, ResourceUnit.GIGABYTES].includes(fromUnit) &&
      [ResourceUnit.BYTES, ResourceUnit.KILOBYTES, ResourceUnit.MEGABYTES, ResourceUnit.GIGABYTES].includes(toUnit)
    ) {
      // Convert to bytes first
      let bytes = value;
      switch (fromUnit) {
        case ResourceUnit.KILOBYTES:
          bytes = value * 1024;
          break;
        case ResourceUnit.MEGABYTES:
          bytes = value * 1024 * 1024;
          break;
        case ResourceUnit.GIGABYTES:
          bytes = value * 1024 * 1024 * 1024;
          break;
      }
      
      // Convert bytes to target unit
      switch (toUnit) {
        case ResourceUnit.BYTES:
          return bytes;
        case ResourceUnit.KILOBYTES:
          return bytes / 1024;
        case ResourceUnit.MEGABYTES:
          return bytes / (1024 * 1024);
        case ResourceUnit.GIGABYTES:
          return bytes / (1024 * 1024 * 1024);
      }
    }
    
    // Time-based conversions
    if (
      [ResourceUnit.MILLISECONDS, ResourceUnit.SECONDS].includes(fromUnit) &&
      [ResourceUnit.MILLISECONDS, ResourceUnit.SECONDS].includes(toUnit)
    ) {
      if (fromUnit === ResourceUnit.MILLISECONDS && toUnit === ResourceUnit.SECONDS) {
        return value / 1000;
      }
      if (fromUnit === ResourceUnit.SECONDS && toUnit === ResourceUnit.MILLISECONDS) {
        return value * 1000;
      }
    }
    
    // If no conversion rule is defined, return the original value
    return value;
  }
  
  /**
   * Clean up old metrics from the buffer
   */
  private cleanupMetricsBuffer(): void {
    // Keep metrics for at most 1 hour
    const cutoff = Date.now() - (60 * 60 * 1000);
    
    this.metricsBuffer = this.metricsBuffer.filter(metric => 
      metric.timestamp >= cutoff
    );
  }
  
  /**
   * Log a message
   */
  private log(level: string, message: string, data?: any): void {
    if (this.config.logger) {
      this.config.logger(message, level, data);
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`, data ? data : '');
    }
  }
}

// ----------------
// Helper Functions
// ----------------

/**
 * Create a resource metric object
 * 
 * @param type Resource type
 * @param name Resource name
 * @param value Metric value
 * @param unit Unit of measurement
 * @param context Additional context
 * @returns ResourceMetric object
 */
export function createResourceMetric(
  type: ResourceType,
  name: string,
  value: number,
  unit: ResourceUnit,
  context?: Record<string, any>
): ResourceMetric {
  return {
    resourceType: type,
    resourceName: name,
    timestamp: Date.now(),
    value,
    unit,
    context
  };
}

/**
 * Create a common CPU usage metric
 * 
 * @param name Resource name (e.g., worker name)
 * @param percentUsage CPU usage percentage (0-100)
 * @returns ResourceMetric object
 */
export function createCpuMetric(name: string, percentUsage: number): ResourceMetric {
  return createResourceMetric(
    ResourceType.CPU_USAGE,
    name,
    percentUsage,
    ResourceUnit.PERCENTAGE
  );
}

/**
 * Create a common memory usage metric
 * 
 * @param name Resource name
 * @param bytes Memory usage in bytes
 * @returns ResourceMetric object
 */
export function createMemoryMetric(name: string, bytes: number): ResourceMetric {
  return createResourceMetric(
    ResourceType.MEMORY_USAGE,
    name,
    bytes,
    ResourceUnit.BYTES
  );
}

/**
 * Create a common error rate metric
 * 
 * @param name Resource name
 * @param errorsPerMinute Error rate
 * @returns ResourceMetric object
 */
export function createErrorRateMetric(name: string, errorsPerMinute: number): ResourceMetric {
  return createResourceMetric(
    ResourceType.ERROR_RATE,
    name,
    errorsPerMinute,
    ResourceUnit.ERRORS_PER_MINUTE
  );
}

/**
 * Create a common latency metric
 * 
 * @param name Resource name
 * @param milliseconds Latency in milliseconds
 * @returns ResourceMetric object
 */
export function createLatencyMetric(name: string, milliseconds: number): ResourceMetric {
  return createResourceMetric(
    ResourceType.LATENCY,
    name,
    milliseconds,
    ResourceUnit.MILLISECONDS
  );
}

/**
 * Create a threshold for CPU usage
 * 
 * @param name Resource name
 * @param threshold Percentage threshold (0-100)
 * @param severity Alert severity
 * @returns ResourceThreshold object
 */
export function createCpuThreshold(
  name: string,
  threshold: number,
  severity: AlertSeverity = AlertSeverity.WARNING
): ResourceThreshold {
  return {
    id: crypto.randomUUID(),
    resourceType: ResourceType.CPU_USAGE,
    resourceName: name,
    unit: ResourceUnit.PERCENTAGE,
    operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
    value: threshold,
    durationSeconds: 60, // Sustained for 1 minute
    severity,
    notificationChannels: [NotificationChannel.DASHBOARD, NotificationChannel.EMAIL],
    description: `CPU usage for ${name} exceeded ${threshold}%`,
    notifyOnResolution: true,
    enabled: true
  };
}

/**
 * Create a threshold for memory usage
 * 
 * @param name Resource name
 * @param thresholdMb Threshold in megabytes
 * @param severity Alert severity
 * @returns ResourceThreshold object
 */
export function createMemoryThreshold(
  name: string,
  thresholdMb: number,
  severity: AlertSeverity = AlertSeverity.WARNING
): ResourceThreshold {
  return {
    id: crypto.randomUUID(),
    resourceType: ResourceType.MEMORY_USAGE,
    resourceName: name,
    unit: ResourceUnit.MEGABYTES,
    operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
    value: thresholdMb,
    durationSeconds: 120, // Sustained for 2 minutes
    severity,
    notificationChannels: [NotificationChannel.DASHBOARD, NotificationChannel.EMAIL],
    description: `Memory usage for ${name} exceeded ${thresholdMb} MB`,
    notifyOnResolution: true,
    enabled: true
  };
}

/**
 * Create a threshold for error rate
 * 
 * @param name Resource name
 * @param threshold Errors per minute threshold
 * @param severity Alert severity
 * @returns ResourceThreshold object
 */
export function createErrorRateThreshold(
  name: string,
  threshold: number,
  severity: AlertSeverity = AlertSeverity.ERROR
): ResourceThreshold {
  return {
    id: crypto.randomUUID(),
    resourceType: ResourceType.ERROR_RATE,
    resourceName: name,
    unit: ResourceUnit.ERRORS_PER_MINUTE,
    operator: ComparisonOperator.GREATER_THAN_OR_EQUAL,
    value: threshold,
    durationSeconds: 60, // Sustained for 1 minute
    severity,
    notificationChannels: [NotificationChannel.DASHBOARD, NotificationChannel.EMAIL, NotificationChannel.SLACK],
    description: `Error rate for ${name} exceeded ${threshold} errors per minute`,
    notifyOnResolution: true,
    enabled: true
  };
}

export default {
  ResourceAlertsManager,
  createResourceMetric,
  createCpuMetric,
  createMemoryMetric,
  createErrorRateMetric,
  createLatencyMetric,
  createCpuThreshold,
  createMemoryThreshold,
  createErrorRateThreshold,
  ResourceType,
  ResourceUnit,
  AlertSeverity,
  AlertStatus,
  ComparisonOperator,
  NotificationChannel
};