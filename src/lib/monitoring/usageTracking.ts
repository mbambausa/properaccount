// src/lib/monitoring/usageTracking.ts
/**
 * Usage Tracking System
 * 
 * This module provides utilities for tracking user activity, feature usage,
 * resource consumption, and billable metrics to understand application usage
 * patterns and monitor quota utilization.
 */

import { CloudflareMetricsClient } from './cloudflareMetrics';

// ----------------
// Types
// ----------------

/**
 * Types of usage metrics to track
 */
export enum UsageMetricType {
  /** User-initiated actions (e.g., login, search) */
  USER_ACTION = 'user_action',
  /** Feature usage (e.g., export, import) */
  FEATURE_USAGE = 'feature_usage',
  /** API calls or endpoints accessed */
  API_USAGE = 'api_usage',
  /** Resource consumption (e.g., storage, compute) */
  RESOURCE_USAGE = 'resource_usage',
  /** Billable actions that impact quotas */
  BILLABLE_USAGE = 'billable_usage',
  /** Business-relevant metrics (e.g., transactions processed) */
  BUSINESS_METRIC = 'business_metric'
}

/**
 * User session information
 */
export interface UserSession {
  /** Session ID */
  sessionId: string;
  /** User ID */
  userId: string;
  /** Entity/tenant ID */
  entityId?: string;
  /** User email or identifier */
  userIdentifier?: string;
  /** Session start time */
  startTime: number;
  /** Last activity time */
  lastActivityTime: number;
  /** User agent string */
  userAgent?: string;
  /** IP address */
  ipAddress?: string;
  /** Session referrer */
  referrer?: string;
  /** Geographic location */
  geolocation?: {
    /** Country code */
    country?: string;
    /** Region/state */
    region?: string;
    /** City */
    city?: string;
  };
  /** Session attributes */
  attributes?: Record<string, any>;
}

/**
 * Usage event to be tracked
 */
export interface UsageEvent {
  /** Event type */
  type: UsageMetricType;
  /** Event name */
  name: string;
  /** Event timestamp */
  timestamp: number;
  /** Associated user ID */
  userId?: string;
  /** Associated session ID */
  sessionId?: string;
  /** Associated entity ID */
  entityId?: string;
  /** Numeric value (e.g., count, size) */
  value?: number;
  /** Event properties */
  properties?: Record<string, any>;
  /** Event duration in milliseconds */
  durationMs?: number;
  /** Was the action successful */
  success?: boolean;
  /** Associated resources (e.g., document IDs) */
  resources?: string[];
}

/**
 * Resource quota definition
 */
export interface ResourceQuota {
  /** Resource identifier */
  resourceId: string;
  /** Resource name */
  resourceName: string;
  /** Quota limit value */
  limit: number;
  /** Unit of measurement */
  unit: string;
  /** Current usage */
  currentUsage: number;
  /** Peak usage */
  peakUsage: number;
  /** Last updated timestamp */
  lastUpdated: number;
  /** Reset period (daily, monthly, etc.) */
  resetPeriod?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  /** Next reset time */
  nextResetTime?: number;
  /** Quota type (soft or hard) */
  quotaType?: 'soft' | 'hard';
  /** Associated entity ID */
  entityId?: string;
}

/**
 * Usage statistics for a time period
 */
export interface UsageStats {
  /** Time period start */
  periodStart: number;
  /** Time period end */
  periodEnd: number;
  /** Metrics by name */
  metrics: Record<string, {
    /** Total value */
    total: number;
    /** Number of events */
    count: number;
    /** Average value */
    average: number;
    /** Minimum value */
    min: number;
    /** Maximum value */
    max: number;
    /** Metrics by user */
    byUser?: Record<string, number>;
    /** Metrics by entity */
    byEntity?: Record<string, number>;
  }>;
  /** Active user count */
  activeUsers: number;
  /** Most active features */
  topFeatures: Array<{
    /** Feature name */
    name: string;
    /** Usage count */
    count: number;
  }>;
  /** User retention percentage */
  retentionRate?: number;
}

/**
 * Storage interface for usage data
 */
export interface UsageStorage {
  /** Save a usage event */
  saveEvent(event: UsageEvent): Promise<void>;
  /** Save multiple usage events */
  saveEvents(events: UsageEvent[]): Promise<void>;
  /** Save user session */
  saveSession(session: UserSession): Promise<void>;
  /** Update user session */
  updateSession(sessionId: string, updates: Partial<UserSession>): Promise<void>;
  /** Get user session */
  getSession(sessionId: string): Promise<UserSession | null>;
  /** Get active sessions */
  getActiveSessions(cutoffTime: number): Promise<UserSession[]>;
  /** Save resource quota */
  saveQuota(quota: ResourceQuota): Promise<void>;
  /** Get resource quota */
  getQuota(resourceId: string, entityId?: string): Promise<ResourceQuota | null>;
  /** Get all resource quotas */
  getAllQuotas(entityId?: string): Promise<ResourceQuota[]>;
}

/**
 * Configuration for the usage tracking system
 */
export interface UsageTrackingConfig {
  /** Storage provider for usage data */
  storage?: UsageStorage;
  /** Metrics client for reporting metrics */
  metricsClient?: CloudflareMetricsClient;
  /** Default entity ID to track */
  defaultEntityId?: string;
  /** Auto-flush events after this many are buffered */
  flushThreshold?: number;
  /** Auto-flush interval in milliseconds */
  flushIntervalMs?: number;
  /** Session timeout in milliseconds */
  sessionTimeoutMs?: number;
  /** Whether to track anonymous usage */
  trackAnonymousUsage?: boolean;
  /** Function to enrich events with additional data */
  eventEnricher?: (event: UsageEvent) => UsageEvent;
  /** Debug mode */
  debug?: boolean;
}

// ----------------
// Usage Tracking Manager
// ----------------

/**
 * Main class for tracking usage metrics
 */
export class UsageTrackingManager {
  private config: Required<UsageTrackingConfig>;
  private eventsBuffer: UsageEvent[] = [];
  private activeSessions: Map<string, UserSession> = new Map();
  private flushInterval?: number;
  private quotaCache: Map<string, ResourceQuota> = new Map();
  private isShuttingDown: boolean = false;
  
  /**
   * Create a new usage tracking manager
   * 
   * @param config Configuration options
   */
  constructor(config: UsageTrackingConfig = {}) {
    // Set defaults for config
    this.config = {
      storage: undefined,
      metricsClient: undefined,
      defaultEntityId: 'default',
      flushThreshold: 50,
      flushIntervalMs: 30000, // 30 seconds
      sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
      trackAnonymousUsage: true,
      eventEnricher: (event) => event,
      debug: false,
      ...config
    };
    
    // Start auto-flush interval
    this.startAutoFlush();
    
    // Load active sessions if storage is available
    this.loadActiveSessions();
    
    // Set up shutdown handler
    this.setupShutdownHandler();
  }
  
  /**
   * Track a user action
   * 
   * @param actionName Name of the action
   * @param properties Action properties
   * @param options Additional options
   * @returns Promise that resolves when the action is tracked
   */
  async trackUserAction(
    actionName: string,
    properties: Record<string, any> = {},
    options: {
      /** User ID */
      userId?: string;
      /** Session ID */
      sessionId?: string;
      /** Entity ID */
      entityId?: string;
      /** Associated resources */
      resources?: string[];
      /** Action success */
      success?: boolean;
      /** Action duration in milliseconds */
      durationMs?: number;
      /** Action value */
      value?: number;
    } = {}
  ): Promise<void> {
    await this.trackEvent({
      type: UsageMetricType.USER_ACTION,
      name: actionName,
      timestamp: Date.now(),
      userId: options.userId,
      sessionId: options.sessionId,
      entityId: options.entityId || this.config.defaultEntityId,
      properties,
      resources: options.resources,
      success: options.success !== undefined ? options.success : true,
      durationMs: options.durationMs,
      value: options.value
    });
  }
  
  /**
   * Track feature usage
   * 
   * @param featureName Name of the feature
   * @param properties Feature properties
   * @param options Additional options
   * @returns Promise that resolves when the feature usage is tracked
   */
  async trackFeatureUsage(
    featureName: string,
    properties: Record<string, any> = {},
    options: {
      /** User ID */
      userId?: string;
      /** Session ID */
      sessionId?: string;
      /** Entity ID */
      entityId?: string;
      /** Feature success */
      success?: boolean;
      /** Feature duration in milliseconds */
      durationMs?: number;
      /** Usage count */
      count?: number;
    } = {}
  ): Promise<void> {
    await this.trackEvent({
      type: UsageMetricType.FEATURE_USAGE,
      name: featureName,
      timestamp: Date.now(),
      userId: options.userId,
      sessionId: options.sessionId,
      entityId: options.entityId || this.config.defaultEntityId,
      properties,
      success: options.success !== undefined ? options.success : true,
      durationMs: options.durationMs,
      value: options.count || 1
    });
  }
  
  /**
   * Track API usage
   * 
   * @param endpoint API endpoint
   * @param properties Request properties
   * @param options Additional options
   * @returns Promise that resolves when the API usage is tracked
   */
  async trackApiUsage(
    endpoint: string,
    properties: Record<string, any> = {},
    options: {
      /** User ID */
      userId?: string;
      /** Session ID */
      sessionId?: string;
      /** Entity ID */
      entityId?: string;
      /** HTTP method */
      method?: string;
      /** Status code */
      statusCode?: number;
      /** Response time in milliseconds */
      responseTimeMs?: number;
      /** Request size in bytes */
      requestSize?: number;
      /** Response size in bytes */
      responseSize?: number;
    } = {}
  ): Promise<void> {
    // Determine success from status code
    const success = options.statusCode ? options.statusCode < 400 : true;
    
    // Merge method and status code into properties
    const apiProperties = {
      ...properties,
      method: options.method || 'GET',
      statusCode: options.statusCode,
      requestSize: options.requestSize,
      responseSize: options.responseSize
    };
    
    await this.trackEvent({
      type: UsageMetricType.API_USAGE,
      name: endpoint,
      timestamp: Date.now(),
      userId: options.userId,
      sessionId: options.sessionId,
      entityId: options.entityId || this.config.defaultEntityId,
      properties: apiProperties,
      success,
      durationMs: options.responseTimeMs,
      value: 1
    });
  }
  
  /**
   * Track resource usage
   * 
   * @param resourceName Name of the resource
   * @param amount Amount of resource used
   * @param options Additional options
   * @returns Promise that resolves when the resource usage is tracked
   */
  async trackResourceUsage(
    resourceName: string,
    amount: number,
    options: {
      /** Resource unit */
      unit?: string;
      /** User ID */
      userId?: string;
      /** Entity ID */
      entityId?: string;
      /** Operation type */
      operation?: string;
      /** Resource usage context */
      context?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const properties = {
      unit: options.unit || 'count',
      operation: options.operation || 'use',
      ...(options.context || {})
    };
    
    await this.trackEvent({
      type: UsageMetricType.RESOURCE_USAGE,
      name: resourceName,
      timestamp: Date.now(),
      userId: options.userId,
      entityId: options.entityId || this.config.defaultEntityId,
      properties,
      value: amount
    });
    
    // Update quota if applicable
    await this.updateResourceQuota(resourceName, amount, options);
  }
  
  /**
   * Track billable usage
   * 
   * @param serviceName Name of the billable service
   * @param amount Usage amount
   * @param options Additional options
   * @returns Promise that resolves when the billable usage is tracked
   */
  async trackBillableUsage(
    serviceName: string,
    amount: number,
    options: {
      /** Unit of measurement */
      unit?: string;
      /** User ID */
      userId?: string;
      /** Entity ID */
      entityId?: string;
      /** Plan or tier */
      plan?: string;
      /** Extra usage info */
      usageInfo?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const properties = {
      unit: options.unit || 'count',
      plan: options.plan || 'default',
      ...(options.usageInfo || {})
    };
    
    await this.trackEvent({
      type: UsageMetricType.BILLABLE_USAGE,
      name: serviceName,
      timestamp: Date.now(),
      userId: options.userId,
      entityId: options.entityId || this.config.defaultEntityId,
      properties,
      value: amount
    });
  }
  
  /**
   * Track a business metric
   * 
   * @param metricName Name of the metric
   * @param value Metric value
   * @param options Additional options
   * @returns Promise that resolves when the business metric is tracked
   */
  async trackBusinessMetric(
    metricName: string,
    value: number,
    options: {
      /** User ID */
      userId?: string;
      /** Entity ID */
      entityId?: string;
      /** Metric properties */
      properties?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.trackEvent({
      type: UsageMetricType.BUSINESS_METRIC,
      name: metricName,
      timestamp: Date.now(),
      userId: options.userId,
      entityId: options.entityId || this.config.defaultEntityId,
      properties: options.properties,
      value
    });
  }
  
  /**
   * Create or update a user session
   * 
   * @param session Session information
   * @returns Session ID
   */
  async trackSession(session: Omit<UserSession, 'startTime' | 'lastActivityTime'>): Promise<string> {
    const now = Date.now();
    const sessionId = session.sessionId || crypto.randomUUID();
    
    // Check if session exists
    const existingSession = this.activeSessions.get(sessionId);
    
    if (existingSession) {
      // Update existing session
      const updatedSession: UserSession = {
        ...existingSession,
        ...session,
        sessionId,
        lastActivityTime: now
      };
      
      this.activeSessions.set(sessionId, updatedSession);
      
      // Store in persistent storage if available
      if (this.config.storage) {
        await this.config.storage.updateSession(sessionId, {
          lastActivityTime: now,
          ...session
        });
      }
    } else {
      // Create new session
      const newSession: UserSession = {
        ...session,
        sessionId,
        startTime: now,
        lastActivityTime: now
      };
      
      this.activeSessions.set(sessionId, newSession);
      
      // Store in persistent storage if available
      if (this.config.storage) {
        await this.config.storage.saveSession(newSession);
      }
      
      // Track session start event
      await this.trackEvent({
        type: UsageMetricType.USER_ACTION,
        name: 'session_start',
        timestamp: now,
        userId: session.userId,
        sessionId,
        entityId: session.entityId || this.config.defaultEntityId,
        properties: {
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          referrer: session.referrer,
          geolocation: session.geolocation
        }
      });
    }
    
    return sessionId;
  }
  
  /**
   * Update a user session with activity
   * 
   * @param sessionId Session ID
   * @param updates Optional updates to the session
   * @returns Whether the session was found and updated
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<UserSession, 'sessionId' | 'startTime'>> = {}
  ): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return false;
    }
    
    // Update last activity time and other fields
    const updatedSession: UserSession = {
      ...session,
      ...updates,
      lastActivityTime: Date.now()
    };
    
    this.activeSessions.set(sessionId, updatedSession);
    
    // Store in persistent storage if available
    if (this.config.storage) {
      await this.config.storage.updateSession(sessionId, {
        lastActivityTime: updatedSession.lastActivityTime,
        ...updates
      });
    }
    
    return true;
  }
  
  /**
   * End a user session
   * 
   * @param sessionId Session ID
   * @param reason Reason for ending the session
   * @returns Session duration in milliseconds, or null if session not found
   */
  async endSession(sessionId: string, reason?: string): Promise<number | null> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    const now = Date.now();
    const duration = now - session.startTime;
    
    // Remove from active sessions
    this.activeSessions.delete(sessionId);
    
    // Track session end event
    await this.trackEvent({
      type: UsageMetricType.USER_ACTION,
      name: 'session_end',
      timestamp: now,
      userId: session.userId,
      sessionId,
      entityId: session.entityId || this.config.defaultEntityId,
      properties: {
        duration,
        reason
      },
      durationMs: duration
    });
    
    // Update storage if available
    if (this.config.storage) {
      await this.config.storage.updateSession(sessionId, {
        lastActivityTime: now,
        attributes: {
          ...session.attributes,
          sessionEndedAt: now,
          sessionEndReason: reason
        }
      });
    }
    
    return duration;
  }
  
  /**
   * Get a resource quota
   * 
   * @param resourceId Resource ID
   * @param entityId Entity ID
   * @returns Resource quota or null if not found
   */
  async getResourceQuota(
    resourceId: string,
    entityId: string = this.config.defaultEntityId
  ): Promise<ResourceQuota | null> {
    // Check cache first
    const cacheKey = `${entityId}:${resourceId}`;
    const cachedQuota = this.quotaCache.get(cacheKey);
    
    if (cachedQuota) {
      return cachedQuota;
    }
    
    // Try to get from storage
    if (this.config.storage) {
      const quota = await this.config.storage.getQuota(resourceId, entityId);
      
      if (quota) {
        // Update cache
        this.quotaCache.set(cacheKey, quota);
        return quota;
      }
    }
    
    return null;
  }
  
  /**
   * Set a resource quota
   * 
   * @param quota Resource quota
   * @returns Promise that resolves when the quota is set
   */
  async setResourceQuota(quota: ResourceQuota): Promise<void> {
    // Cache the quota
    const cacheKey = `${quota.entityId || this.config.defaultEntityId}:${quota.resourceId}`;
    this.quotaCache.set(cacheKey, quota);
    
    // Save to storage if available
    if (this.config.storage) {
      await this.config.storage.saveQuota(quota);
    }
  }
  
  /**
   * Check if a resource usage would exceed quota
   * 
   * @param resourceId Resource ID
   * @param amount Usage amount to check
   * @param entityId Entity ID
   * @returns Whether the usage would exceed quota (null if no quota)
   */
  async checkQuotaExceeded(
    resourceId: string,
    amount: number,
    entityId: string = this.config.defaultEntityId
  ): Promise<boolean | null> {
    const quota = await this.getResourceQuota(resourceId, entityId);
    
    if (!quota) {
      return null; // No quota defined
    }
    
    return (quota.currentUsage + amount) > quota.limit;
  }
  
  /**
   * Get active user count for a time period
   * 
   * @param period Time period in milliseconds
   * @param entityId Optional entity ID to filter by
   * @returns Number of active users
   */
  async getActiveUserCount(
    period: number,
    entityId?: string
  ): Promise<number> {
    const cutoff = Date.now() - period;
    
    // If we have storage, query it for more accurate results
    if (this.config.storage) {
      const sessions = await this.config.storage.getActiveSessions(cutoff);
      
      if (entityId) {
        return new Set(
          sessions
            .filter(session => session.entityId === entityId)
            .map(session => session.userId)
        ).size;
      } else {
        return new Set(sessions.map(session => session.userId)).size;
      }
    }
    
    // Otherwise use active sessions in memory
    const activeUsers = new Set<string>();
    
    for (const session of this.activeSessions.values()) {
      if (session.lastActivityTime >= cutoff) {
        if (!entityId || session.entityId === entityId) {
          activeUsers.add(session.userId);
        }
      }
    }
    
    return activeUsers.size;
  }
  
  /**
   * Get usage statistics for a time period
   * 
   * @param startTime Period start time
   * @param endTime Period end time
   * @param options Query options
   * @returns Usage statistics
   */
  async getUsageStats(
    startTime: number,
    endTime: number,
    options: {
      /** Filter by entity ID */
      entityId?: string;
      /** Filter by metric type */
      metricType?: UsageMetricType;
      /** Get stats by user */
      byUser?: boolean;
      /** Get stats by entity */
      byEntity?: boolean;
      /** Maximum number of top features to return */
      topFeaturesLimit?: number;
    } = {}
  ): Promise<UsageStats | null> {
    // If no storage, return null
    if (!this.config.storage) {
      return null;
    }
    
    // This would typically query your data store for aggregated stats
    // For now, we'll return a placeholder implementation
    
    // Calculate active users
    const activeUsers = await this.getActiveUserCount(endTime - startTime, options.entityId);
    
    // Return placeholder stats
    return {
      periodStart: startTime,
      periodEnd: endTime,
      metrics: {},
      activeUsers,
      topFeatures: [],
      retentionRate: 0
    };
  }
  
  /**
   * Flush events to storage and metrics
   * 
   * @returns Promise that resolves when events are flushed
   */
  async flushEvents(): Promise<void> {
    if (this.eventsBuffer.length === 0) {
      return;
    }
    
    const eventsToFlush = [...this.eventsBuffer];
    this.eventsBuffer = [];
    
    // Save to storage if available
    if (this.config.storage) {
      try {
        await this.config.storage.saveEvents(eventsToFlush);
      } catch (error) {
        this.debug(`Error saving events to storage: ${error}`);
        // Put events back in buffer
        this.eventsBuffer = [...eventsToFlush, ...this.eventsBuffer];
        throw error;
      }
    }
    
    // Report to metrics if available
    if (this.config.metricsClient) {
      try {
        // Group events by type and name
        const eventGroups = new Map<string, UsageEvent[]>();
        
        for (const event of eventsToFlush) {
          const key = `${event.type}:${event.name}`;
          const group = eventGroups.get(key) || [];
          group.push(event);
          eventGroups.set(key, group);
        }
        
        // Report each group
        for (const [key, events] of eventGroups.entries()) {
          const [type, name] = key.split(':');
          
          // Count events
          this.config.metricsClient.increment(`usage.${type}.count`, events.length, {
            name,
            entity: events[0].entityId || this.config.defaultEntityId
          });
          
          // Sum values (if present)
          const totalValue = events.reduce((sum, event) => sum + (event.value || 1), 0);
          this.config.metricsClient.gauge(`usage.${type}.value`, totalValue, {
            name,
            entity: events[0].entityId || this.config.defaultEntityId
          });
          
          // Track average duration (if present)
          const durationsCount = events.filter(e => e.durationMs !== undefined).length;
          if (durationsCount > 0) {
            const totalDuration = events.reduce((sum, event) => sum + (event.durationMs || 0), 0);
            this.config.metricsClient.gauge(`usage.${type}.duration`, totalDuration / durationsCount, {
              name,
              entity: events[0].entityId || this.config.defaultEntityId
            }, 'ms');
          }
          
          // Track success rate (if applicable)
          const successCount = events.filter(e => e.success === true).length;
          this.config.metricsClient.gauge(`usage.${type}.success_rate`, 
            (successCount / events.length) * 100, 
            {
              name,
              entity: events[0].entityId || this.config.defaultEntityId
            }, 
            'percentage'
          );
        }
      } catch (error) {
        this.debug(`Error reporting metrics: ${error}`);
        // Don't re-add to buffer since storage already saved them
      }
    }
  }
  
  /**
   * Shutdown the usage tracking system
   * 
   * @returns Promise that resolves when shutdown is complete
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    // Stop auto-flush
    if (this.flushInterval !== undefined) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }
    
    // Flush remaining events
    await this.flushEvents();
    
    // End all sessions
    const sessionIds = Array.from(this.activeSessions.keys());
    for (const sessionId of sessionIds) {
      await this.endSession(sessionId, 'application_shutdown');
    }
  }
  
  // ----------------
  // Private Methods
  // ----------------
  
  /**
   * Track a usage event
   */
  private async trackEvent(event: UsageEvent): Promise<void> {
    // Skip if not tracking anonymous and no user ID
    if (!this.config.trackAnonymousUsage && !event.userId) {
      return;
    }
    
    // Apply event enricher
    const enrichedEvent = this.config.eventEnricher(event);
    
    // Add to buffer
    this.eventsBuffer.push(enrichedEvent);
    
    // Report to metrics immediately if available
    if (this.config.metricsClient) {
      try {
        const metricName = `usage.${enrichedEvent.type}`;
        const metricValue = enrichedEvent.value || 1;
        
        const dimensions: Record<string, string> = {
          name: enrichedEvent.name,
          entity: enrichedEvent.entityId || this.config.defaultEntityId
        };
        
        if (enrichedEvent.userId) {
          dimensions.user = enrichedEvent.userId;
        }
        
        if (enrichedEvent.success !== undefined) {
          dimensions.success = enrichedEvent.success.toString();
        }
        
        // Report based on event type
        switch (enrichedEvent.type) {
          case UsageMetricType.USER_ACTION:
          case UsageMetricType.FEATURE_USAGE:
          case UsageMetricType.API_USAGE:
            this.config.metricsClient.increment(metricName, metricValue, dimensions);
            break;
            
          case UsageMetricType.RESOURCE_USAGE:
          case UsageMetricType.BILLABLE_USAGE:
          case UsageMetricType.BUSINESS_METRIC:
            this.config.metricsClient.gauge(metricName, metricValue, dimensions);
            break;
        }
        
        // Track duration if available
        if (enrichedEvent.durationMs !== undefined) {
          this.config.metricsClient.histogram(`${metricName}.duration`, enrichedEvent.durationMs, dimensions, 'ms');
        }
      } catch (error) {
        this.debug(`Error reporting immediate metric: ${error}`);
      }
    }
    
    // Check if buffer exceeds threshold
    if (this.eventsBuffer.length >= this.config.flushThreshold) {
      await this.flushEvents();
    }
  }
  
  /**
   * Start auto-flush interval
   */
  private startAutoFlush(): void {
    if (this.flushInterval !== undefined) {
      clearInterval(this.flushInterval);
    }
    
    this.flushInterval = setInterval(() => {
      this.flushEvents().catch(error => {
        this.debug(`Error in auto-flush: ${error}`);
      });
    }, this.config.flushIntervalMs);
  }
  
  /**
   * Load active sessions from storage
   */
  private async loadActiveSessions(): Promise<void> {
    if (!this.config.storage) {
      return;
    }
    
    try {
      const cutoff = Date.now() - this.config.sessionTimeoutMs;
      const sessions = await this.config.storage.getActiveSessions(cutoff);
      
      for (const session of sessions) {
        this.activeSessions.set(session.sessionId, session);
      }
      
      this.debug(`Loaded ${sessions.length} active sessions from storage`);
    } catch (error) {
      this.debug(`Error loading active sessions: ${error}`);
    }
  }
  
  /**
   * Update resource quota with new usage
   */
  private async updateResourceQuota(
    resourceName: string,
    amount: number,
    options: {
      unit?: string;
      userId?: string;
      entityId?: string;
    }
  ): Promise<void> {
    const entityId = options.entityId || this.config.defaultEntityId;
    
    // Try to get existing quota
    const quota = await this.getResourceQuota(resourceName, entityId);
    
    if (!quota) {
      return; // No quota to update
    }
    
    // Update usage
    const now = Date.now();
    const newUsage = quota.currentUsage + amount;
    const newPeak = Math.max(quota.peakUsage, newUsage);
    
    // Check if quota should be reset
    let shouldReset = false;
    if (quota.resetPeriod && quota.nextResetTime && now >= quota.nextResetTime) {
      shouldReset = true;
    }
    
    // Calculate next reset time
    let nextResetTime = quota.nextResetTime;
    if (shouldReset || !nextResetTime) {
      nextResetTime = this.calculateNextResetTime(now, quota.resetPeriod);
    }
    
    // Update quota
    const updatedQuota: ResourceQuota = {
      ...quota,
      currentUsage: shouldReset ? amount : newUsage,
      peakUsage: shouldReset ? amount : newPeak,
      lastUpdated: now,
      nextResetTime
    };
    
    // Save updated quota
    await this.setResourceQuota(updatedQuota);
    
    // Check if exceeded and report warning
    if (updatedQuota.currentUsage > updatedQuota.limit) {
      this.debug(`Quota exceeded for ${resourceName} (${entityId}): ${updatedQuota.currentUsage}/${updatedQuota.limit} ${updatedQuota.unit}`);
      
      // Report to metrics if available
      if (this.config.metricsClient) {
        this.config.metricsClient.increment('quota.exceeded', 1, {
          resource: resourceName,
          entity: entityId
        });
        
        // Report usage percentage
        const usagePercent = (updatedQuota.currentUsage / updatedQuota.limit) * 100;
        this.config.metricsClient.gauge('quota.usage_percent', usagePercent, {
          resource: resourceName,
          entity: entityId
        }, 'percentage');
      }
    }
  }
  
  /**
   * Calculate the next reset time for a quota
   */
  private calculateNextResetTime(
    fromTime: number,
    resetPeriod?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  ): number | undefined {
    if (!resetPeriod || resetPeriod === 'never') {
      return undefined;
    }
    
    const date = new Date(fromTime);
    
    switch (resetPeriod) {
      case 'hourly':
        // Next hour
        date.setHours(date.getHours() + 1);
        date.setMinutes(0, 0, 0);
        break;
        
      case 'daily':
        // Next day
        date.setDate(date.getDate() + 1);
        date.setHours(0, 0, 0, 0);
        break;
        
      case 'weekly':
        // Next week (Sunday)
        date.setDate(date.getDate() + (7 - date.getDay()));
        date.setHours(0, 0, 0, 0);
        break;
        
      case 'monthly':
        // First day of next month
        date.setMonth(date.getMonth() + 1);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
        
      case 'yearly':
        // January 1 of next year
        date.setFullYear(date.getFullYear() + 1);
        date.setMonth(0, 1);
        date.setHours(0, 0, 0, 0);
        break;
    }
    
    return date.getTime();
  }
  
  /**
   * Set up shutdown handler
   */
  private setupShutdownHandler(): void {
    // For Cloudflare Workers, we can listen for event.passThroughOnException()
    // In a real environment, this would be handled by the worker runtime
    
    // Example for a hypothetical shutdown handler:
    if (typeof addEventListener === 'function') {
      addEventListener('unload', () => {
        if (!this.isShuttingDown) {
          this.shutdown().catch(error => {
            this.debug(`Error in shutdown: ${error}`);
          });
        }
      });
    }
  }
  
  /**
   * Debug logging
   */
  private debug(message: string): void {
    if (this.config.debug) {
      console.debug(`[UsageTracking] ${message}`);
    }
  }
}

// ----------------
// Factory Functions
// ----------------

/**
 * Create a usage tracking manager
 * 
 * @param config Configuration options
 * @returns UsageTrackingManager instance
 */
export function createUsageTracker(
  config: UsageTrackingConfig = {}
): UsageTrackingManager {
  return new UsageTrackingManager(config);
}

/**
 * Create a D1-based usage storage provider
 * 
 * @param db D1 database
 * @returns UsageStorage implementation
 */
export function createD1UsageStorage(db: D1Database): UsageStorage {
  // This is a placeholder implementation - in a real system,
  // you would implement the methods to store and retrieve data from D1
  return {
    saveEvent: async (event: UsageEvent) => {
      // Store event in D1
    },
    saveEvents: async (events: UsageEvent[]) => {
      // Store events in D1 in a batch
    },
    saveSession: async (session: UserSession) => {
      // Store session in D1
    },
    updateSession: async (sessionId: string, updates: Partial<UserSession>) => {
      // Update session in D1
    },
    getSession: async (sessionId: string) => {
      // Get session from D1
      return null;
    },
    getActiveSessions: async (cutoffTime: number) => {
      // Get active sessions from D1
      return [];
    },
    saveQuota: async (quota: ResourceQuota) => {
      // Store quota in D1
    },
    getQuota: async (resourceId: string, entityId?: string) => {
      // Get quota from D1
      return null;
    },
    getAllQuotas: async (entityId?: string) => {
      // Get all quotas from D1
      return [];
    }
  };
}

/**
 * Create middleware for tracking API usage
 * 
 * @param usageTracker UsageTrackingManager instance
 * @param options Middleware options
 * @returns Middleware function
 */
export function createUsageTrackingMiddleware(
  usageTracker: UsageTrackingManager,
  options: {
    /** Exclude paths from tracking */
    excludePaths?: string[];
    /** Function to extract user ID from request */
    getUserId?: (request: Request) => string | undefined;
    /** Function to extract entity ID from request */
    getEntityId?: (request: Request) => string | undefined;
    /** Function to extract session ID from request */
    getSessionId?: (request: Request) => string | undefined;
    /** Function to normalize API path */
    normalizePath?: (path: string) => string;
  } = {}
): (request: Request, env: any, ctx: any) => Promise<Response> {
  return async (request: Request, env: any, ctx: any) => {
    const startTime = performance.now();
    const url = new URL(request.url);
    const path = options.normalizePath 
      ? options.normalizePath(url.pathname) 
      : url.pathname;
    
    // Skip excluded paths
    if (options.excludePaths && options.excludePaths.some(p => path.startsWith(p))) {
      return await ctx.next();
    }
    
    // Extract IDs
    const userId = options.getUserId ? options.getUserId(request) : undefined;
    const entityId = options.getEntityId ? options.getEntityId(request) : undefined;
    const sessionId = options.getSessionId ? options.getSessionId(request) : undefined;
    
    // Get content length if available
    const requestSize = request.headers.has('content-length')
      ? parseInt(request.headers.get('content-length') || '0', 10)
      : undefined;
    
    let response: Response;
    try {
      // Get response from next middleware
      response = await ctx.next();
      
      // Calculate duration
      const duration = performance.now() - startTime;
      
      // Get response size if available
      const responseSize = response.headers.has('content-length')
        ? parseInt(response.headers.get('content-length') || '0', 10)
        : undefined;
      
      // Track API usage
      await usageTracker.trackApiUsage(path, {
        method: request.method,
        pathname: url.pathname,
        search: url.search,
      }, {
        userId,
        entityId,
        sessionId,
        method: request.method,
        statusCode: response.status,
        responseTimeMs: duration,
        requestSize,
        responseSize
      });
      
      return response;
    } catch (error) {
      // Track API error
      const duration = performance.now() - startTime;
      
      await usageTracker.trackApiUsage(path, {
        method: request.method,
        pathname: url.pathname,
        search: url.search,
        error: error.message || 'Unknown error'
      }, {
        userId,
        entityId,
        sessionId,
        method: request.method,
        statusCode: 500,
        responseTimeMs: duration,
        requestSize
      });
      
      throw error;
    }
  };
}

/**
 * Create resource quota with safe defaults
 * 
 * @param resourceId Resource identifier
 * @param resourceName Human-readable name
 * @param limit Quota limit
 * @param options Additional options
 * @returns ResourceQuota object
 */
export function createResourceQuota(
  resourceId: string,
  resourceName: string,
  limit: number,
  options: {
    /** Unit of measurement */
    unit?: string;
    /** Entity ID */
    entityId?: string;
    /** Reset period */
    resetPeriod?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    /** Quota type */
    quotaType?: 'soft' | 'hard';
  } = {}
): ResourceQuota {
  const now = Date.now();
  
  return {
    resourceId,
    resourceName,
    limit,
    unit: options.unit || 'count',
    currentUsage: 0,
    peakUsage: 0,
    lastUpdated: now,
    resetPeriod: options.resetPeriod || 'monthly',
    nextResetTime: options.resetPeriod === 'never' ? undefined : calculateNextResetTime(now, options.resetPeriod || 'monthly'),
    quotaType: options.quotaType || 'soft',
    entityId: options.entityId
  };
}

/**
 * Helper function to calculate next reset time
 */
function calculateNextResetTime(
  fromTime: number,
  resetPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
): number | undefined {
  if (resetPeriod === 'never') {
    return undefined;
  }
  
  const date = new Date(fromTime);
  
  switch (resetPeriod) {
    case 'hourly':
      date.setHours(date.getHours() + 1);
      date.setMinutes(0, 0, 0);
      break;
      
    case 'daily':
      date.setDate(date.getDate() + 1);
      date.setHours(0, 0, 0, 0);
      break;
      
    case 'weekly':
      date.setDate(date.getDate() + (7 - date.getDay()));
      date.setHours(0, 0, 0, 0);
      break;
      
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      break;
      
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      date.setMonth(0, 1);
      date.setHours(0, 0, 0, 0);
      break;
  }
  
  return date.getTime();
}

export default {
  UsageTrackingManager,
  createUsageTracker,
  createD1UsageStorage,
  createUsageTrackingMiddleware,
  createResourceQuota,
  UsageMetricType
};