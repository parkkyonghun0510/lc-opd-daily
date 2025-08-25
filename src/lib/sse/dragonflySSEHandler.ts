/**
 * Dragonfly-Optimized SSE Handler
 * 
 * Leverages Dragonfly's enhanced capabilities for superior SSE performance:
 * - Multi-threading support
 * - Enhanced memory management
 * - Optimized pub/sub with persistence
 * - Advanced message routing
 * - Built-in analytics and monitoring
 */

import { BaseSSEHandler, SSEEvent, SSEClient } from './sseHandler';
import { getDragonflyOptimizedClient, DragonflyOptimizedClient } from '@/lib/dragonfly/dragonflyOptimizedClient';
import { DragonflyPubSub, getDragonflyPubSub } from '@/lib/dragonfly/dragonflyPubSub';
import type { Redis } from 'ioredis';

export interface DragonflySSEMessage {
  id: string;
  channel: string;
  data: any;
  timestamp: number;
  ttl?: number;
  priority?: number;
  retryCount?: number;
  headers?: Record<string, string>;
  sseEvent: SSEEvent;
  targetUserId?: string;
  broadcast?: boolean;
  persistence?: boolean;
  analytics?: {
    source: string;
    category: string;
    metadata?: Record<string, any>;
  };
}

export interface DragonflySSEConfig {
  enableAnalytics?: boolean;
  enablePersistence?: boolean;
  maxOfflineMessages?: number;
  messageRetentionHours?: number;
  enableDeadLetterQueue?: boolean;
  enableMessageRouting?: boolean;
}

export class DragonflySSEHandler extends BaseSSEHandler {
  private dragonflyClient: DragonflyOptimizedClient | null = null;
  private pubSub: DragonflyPubSub | null = null;
  private isInitialized = false;
  private config: Required<DragonflySSEConfig>;
  private analytics: Map<string, any> = new Map();
  private messageQueue: Map<string, DragonflySSEMessage[]> = new Map();

  // Channel configurations
  private readonly channels = {
    broadcast: 'dragonfly:sse:broadcast',
    user: 'dragonfly:sse:user:',
    system: 'dragonfly:sse:system',
    analytics: 'dragonfly:sse:analytics'
  };

  constructor(config: DragonflySSEConfig = {}) {
    super();
    
    this.config = {
      enableAnalytics: true,
      enablePersistence: true,
      maxOfflineMessages: 100,
      messageRetentionHours: 24,
      enableDeadLetterQueue: true,
      enableMessageRouting: true,
      ...config
    };

    this.initialize().catch(error => {
      console.error('[DragonflySSE] Failed to initialize:', error);
    });
  }

  /**
   * Initialize Dragonfly connections and pub/sub system
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get optimized Dragonfly client
      this.dragonflyClient = await getDragonflyOptimizedClient();

      // Initialize enhanced pub/sub system
      this.pubSub = getDragonflyPubSub();

      // Subscribe to SSE channels
      await this.setupSubscriptions();

      this.isInitialized = true;
      console.log('[DragonflySSE] Initialized successfully with enhanced capabilities');

      // Start analytics collection if enabled
      if (this.config.enableAnalytics) {
        this.startAnalyticsCollection();
      }
    } catch (error) {
      console.error('[DragonflySSE] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup pub/sub subscriptions
   */
  private async setupSubscriptions(): Promise<void> {
    if (!this.pubSub) return;

    // Subscribe to broadcast channel
    await this.pubSub.subscribe(
      this.channels.broadcast,
      (message: any) => this.handleBroadcastMessage(message as DragonflySSEMessage),
      { persistent: false } // Broadcasts don't need persistence
    );

    // Subscribe to system events
    await this.pubSub.subscribe(
      this.channels.system,
      (message: any) => this.handleSystemMessage(message as DragonflySSEMessage),
      { persistent: true }
    );

    console.log('[DragonflySSE] Subscriptions established');
  }

  /**
   * Handle broadcast messages from pub/sub
   */
  private handleBroadcastMessage(message: DragonflySSEMessage): void {
    try {
      const { sseEvent } = message;
      super.broadcastEvent(sseEvent.type, sseEvent.data, {
        id: sseEvent.id
      });

      // Record analytics
      if (this.config.enableAnalytics && message.analytics) {
        this.recordAnalytics('broadcast', message.analytics);
      }
    } catch (error) {
      console.error('[DragonflySSE] Error handling broadcast message:', error);
    }
  }

  /**
   * Handle system messages
   */
  private handleSystemMessage(message: DragonflySSEMessage): void {
    try {
      const { sseEvent, targetUserId } = message;
      
      if (targetUserId) {
        super.sendEventToUser(targetUserId, sseEvent.type, sseEvent.data, {
          id: sseEvent.id
        });
      } else {
        super.broadcastEvent(sseEvent.type, sseEvent.data, {
          id: sseEvent.id
        });
      }

      // Record analytics
      if (this.config.enableAnalytics && message.analytics) {
        this.recordAnalytics('system', message.analytics);
      }
    } catch (error) {
      console.error('[DragonflySSE] Error handling system message:', error);
    }
  }

  /**
   * Enhanced sendEventToUser with Dragonfly optimizations
   */
  override sendEventToUser(
    userId: string,
    type: string,
    data: any,
    options: {
      id?: string;
      retry?: number;
      localOnly?: boolean;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      persistence?: boolean;
      analytics?: any;
    } = {}
  ): number {
    // Send to local clients first
    const localCount = super.sendEventToUser(userId, type, data, options);

    // If user has no local clients and persistence is enabled, store for offline delivery
    if (localCount === 0 && this.config.enablePersistence && options.persistence !== false) {
      this.storeOfflineMessage(userId, {
        type,
        data,
        id: options.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });
    }

    // Publish to Dragonfly pub/sub for cross-instance delivery
    if (!options.localOnly && this.pubSub) {
      const message: DragonflySSEMessage = {
        id: options.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        channel: `${this.channels.user}${userId}`,
        data: { type, data, targetUserId: userId },
        timestamp: Date.now(),
        priority: this.mapPriorityToNumber(options.priority || 'normal'),
        sseEvent: { type, data, id: options.id },
        targetUserId: userId,
        broadcast: false,
        persistence: options.persistence,
        analytics: options.analytics
      };

      const userChannel = `${this.channels.user}${userId}`;
      this.pubSub.publish(userChannel, message, {
        priority: this.mapPriorityToNumber(options.priority || 'normal'),
        persistence: options.persistence !== false
      }).catch(error => {
        console.error('[DragonflySSE] Error publishing user message:', error);
      });
    }

    // Record analytics
    if (this.config.enableAnalytics && options.analytics) {
      this.recordAnalytics('user_message', {
        userId,
        type,
        localCount,
        ...options.analytics
      });
    }

    return localCount;
  }

  /**
   * Enhanced broadcastEvent with Dragonfly optimizations
   */
  override broadcastEvent(
    type: string,
    data: any,
    options: {
      id?: string;
      retry?: number;
      localOnly?: boolean;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      analytics?: any;
    } = {}
  ): number {
    // Broadcast to local clients first
    const localCount = super.broadcastEvent(type, data, options);

    // Publish to Dragonfly pub/sub for cross-instance delivery
    if (!options.localOnly && this.pubSub) {
      const message: DragonflySSEMessage = {
        id: options.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        channel: this.channels.broadcast,
        data: { type, data, broadcast: true },
        timestamp: Date.now(),
        priority: this.mapPriorityToNumber(options.priority || 'normal'),
        sseEvent: { type, data, id: options.id },
        broadcast: true,
        analytics: options.analytics
      };

      this.pubSub.publish(this.channels.broadcast, message, {
        priority: this.mapPriorityToNumber(options.priority || 'normal'),
        persistence: false // Broadcasts don't need persistence
      }).catch(error => {
        console.error('[DragonflySSE] Error publishing broadcast message:', error);
      });
    }

    // Record analytics
    if (this.config.enableAnalytics && options.analytics) {
      this.recordAnalytics('broadcast', {
        type,
        localCount,
        ...options.analytics
      });
    }

    return localCount;
  }

  /**
   * Store message for offline users using Dragonfly's enhanced capabilities
   */
  private async storeOfflineMessage(userId: string, event: SSEEvent): Promise<void> {
    if (!this.dragonflyClient) return;

    const key = `offline_messages:${userId}`;
    const message = {
      ...event,
      timestamp: Date.now()
    };

    try {
      // Use pipeline for better performance
      const pipeline = await this.dragonflyClient.pipeline([
        ['lpush', key, JSON.stringify(message)],
        ['expire', key, this.config.messageRetentionHours * 60 * 60],
        ['ltrim', key, '0', (this.config.maxOfflineMessages - 1).toString()]
      ]);
    } catch (error) {
      console.error('[DragonflySSE] Error storing offline message:', error);
    }
  }

  /**
   * Deliver offline messages with enhanced performance
   */
  private async deliverOfflineMessages(userId: string): Promise<number> {
    if (!this.dragonflyClient) return 0;

    const key = `offline_messages:${userId}`;
    
    try {
      const messages = await this.dragonflyClient.execute('lrange', key, '0', '-1');

      let deliveredCount = 0;

      for (const messageStr of messages) {
        try {
          const message = JSON.parse(messageStr);
          this.sendEventToUser(userId, message.type, message.data, {
            id: message.id,
            localOnly: true // Don't re-publish
          });
          deliveredCount++;
        } catch (error) {
          console.error('[DragonflySSE] Error parsing offline message:', error);
        }
      }

      // Clear delivered messages
      if (deliveredCount > 0) {
        await this.dragonflyClient.execute('del', key);
      }

      return deliveredCount;
    } catch (error) {
      console.error('[DragonflySSE] Error delivering offline messages:', error);
      return 0;
    }
  }

  /**
   * Override addClient to handle offline message delivery and user subscriptions
   */
  override addClient(
    clientId: string,
    userId: string,
    response: any,
    metadata: any = {}
  ): void {
    super.addClient(clientId, userId, response, metadata);

    // Subscribe to user-specific channel
    if (this.pubSub) {
      const userChannel = `${this.channels.user}${userId}`;
      this.pubSub.subscribe(
        userChannel,
        (message: any) => {
          const dragonflyMessage = message as DragonflySSEMessage;
          if (dragonflyMessage.targetUserId === userId) {
            super.sendEventToUser(userId, dragonflyMessage.sseEvent.type, dragonflyMessage.sseEvent.data, {
              id: dragonflyMessage.sseEvent.id
            });
          }
        },
        { persistent: true }
      ).catch(error => {
        console.error('[DragonflySSE] Error subscribing to user channel:', error);
      });
    }

    // Deliver any offline messages
    this.deliverOfflineMessages(userId)
      .then(count => {
        if (count > 0) {
          console.log(`[DragonflySSE] Delivered ${count} offline messages to user ${userId}`);
        }
      })
      .catch(error => {
        console.error('[DragonflySSE] Error delivering offline messages:', error);
      });
  }

  /**
   * Map priority string to number for Dragonfly pub/sub
   */
  private mapPriorityToNumber(priority: 'low' | 'normal' | 'high' | 'critical'): number {
    const priorityMap = {
      low: 1,
      normal: 5,
      high: 8,
      critical: 10
    };
    return priorityMap[priority] || 5;
  }

  /**
   * Record analytics data
   */
  private recordAnalytics(category: string, data: any): void {
    if (!this.config.enableAnalytics) return;

    const analyticsKey = `${category}:${Date.now()}`;
    this.analytics.set(analyticsKey, {
      category,
      timestamp: Date.now(),
      ...data
    });

    // Publish analytics to dedicated channel
    if (this.pubSub) {
      this.pubSub.publish(this.channels.analytics, {
        id: analyticsKey,
        timestamp: Date.now(),
        sseEvent: { type: 'analytics', data: { category, ...data } },
        analytics: { source: 'dragonfly-sse', category: 'internal' }
      }).catch(error => {
        console.error('[DragonflySSE] Error publishing analytics:', error);
      });
    }
  }

  /**
   * Start analytics collection
   */
  private startAnalyticsCollection(): void {
    // Collect analytics every 5 minutes
    setInterval(() => {
      this.collectAndResetAnalytics();
    }, 5 * 60 * 1000);
  }

  /**
   * Collect and reset analytics
   */
  private collectAndResetAnalytics(): void {
    if (this.analytics.size === 0) return;

    const analyticsData = Array.from(this.analytics.values());
    this.analytics.clear();

    // Store analytics in Dragonfly
    if (this.dragonflyClient) {
      const key = `sse_analytics:${Date.now()}`;
      this.dragonflyClient.execute('set', key, JSON.stringify(analyticsData), 'EX', 7 * 24 * 60 * 60).catch((error: any) => {
        console.error('[DragonflySSE] Error storing analytics:', error);
      });
    }
  }

  /**
   * Ensure Dragonfly handler is initialized
   */
  public async ensureInitialized(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      await this.initialize();
      return this.isInitialized;
    } catch (error) {
      console.error('[DragonflySSE] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Get enhanced statistics
   */
  override getStats() {
    const baseStats = super.getStats();
    return {
      ...baseStats,
      dragonfly: {
        client: this.dragonflyClient !== null,
        pubSub: this.pubSub?.getAnalytics(),
        initialized: this.isInitialized,
        config: this.config,
        analytics: {
          collected: this.analytics.size,
          enabled: this.config.enableAnalytics
        },
        offlineMessages: this.messageQueue.size
      }
    };
  }

  /**
   * Enhanced cleanup with Dragonfly-specific resources
   */
  override destroy(): void {
    super.destroy();

    // Collect final analytics
    if (this.config.enableAnalytics) {
      this.collectAndResetAnalytics();
    }

    // Cleanup pub/sub
    if (this.pubSub) {
      this.pubSub.close();
      this.pubSub = null;
    }

    // Clear analytics and message queue
    this.analytics.clear();
    this.messageQueue.clear();

    this.isInitialized = false;
  }
}

// Create and export singleton instance
const dragonflySSEHandlerInstance = new DragonflySSEHandler();

export default dragonflySSEHandlerInstance;