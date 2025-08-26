/**
 * Redis-backed SSE Handler
 * 
 * Extends the base SSE handler with Redis pub/sub capabilities for
 * cross-instance communication and message persistence.
 */

import { BaseSSEHandler, SSEEvent } from './sseHandler';
import { getRedis, getRedisPubSub } from '@/lib/redis';
import type { Redis } from 'ioredis';

export interface RedisSSEMessage {
  type: string;
  data: any;
  targetUserId?: string;
  broadcast?: boolean;
  timestamp: number;
  id: string;
}

export class RedisSSEHandler extends BaseSSEHandler {
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
  private isInitialized = false;
  private readonly channelPrefix = 'sse:';
  private readonly broadcastChannel = 'sse:broadcast';
  private readonly userChannelPrefix = 'sse:user:';

  constructor() {
    super();
    this.initialize().catch(error => {
      console.error('[RedisSSE] Failed to initialize:', error);
    });
  }

  /**
   * Initialize Redis connections for pub/sub
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create separate Redis connections for pub/sub
      // Publisher uses regular Redis client (for publishing messages only)
      this.publisher = await getRedis();
      
      // Subscriber uses dedicated pub/sub connection (will be in subscriber mode)
      this.subscriber = await getRedisPubSub();

      // Subscribe to broadcast channel
      await this.subscriber.subscribe(this.broadcastChannel);

      // Handle incoming Redis messages
      this.subscriber.on('message', (channel: string, message: string) => {
        this.handleRedisMessage(channel, message);
      });

      this.subscriber.on('error', (error) => {
        console.error('[RedisSSE] Subscriber error:', error);
      });

      this.publisher.on('error', (error) => {
        console.error('[RedisSSE] Publisher error:', error);
      });

      this.isInitialized = true;
      console.log('[RedisSSE] Initialized successfully with separate connections');
    } catch (error) {
      console.error('[RedisSSE] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Handle incoming Redis pub/sub messages
   */
  private handleRedisMessage(channel: string, message: string): void {
    try {
      const redisMessage: RedisSSEMessage = JSON.parse(message);
      
      if (channel === this.broadcastChannel) {
        // Broadcast to all local clients
        super.broadcastEvent(redisMessage.type, redisMessage.data, {
          id: redisMessage.id
        });
      } else if (channel.startsWith(this.userChannelPrefix)) {
        // Send to specific user's local clients
        const userId = channel.substring(this.userChannelPrefix.length);
        super.sendEventToUser(userId, redisMessage.type, redisMessage.data, {
          id: redisMessage.id
        });
      }
    } catch (error) {
      console.error('[RedisSSE] Error parsing Redis message:', error);
    }
  }

  /**
   * Send event to a specific user (with Redis pub/sub)
   */
  override sendEventToUser(
    userId: string, 
    type: string, 
    data: any, 
    options: { id?: string; retry?: number; localOnly?: boolean } = {}
  ): number {
    // Send to local clients first
    const localCount = super.sendEventToUser(userId, type, data, options);

    // If not local-only, also publish to Redis for cross-instance delivery
    if (!options.localOnly && this.isInitialized && this.publisher) {
      const redisMessage: RedisSSEMessage = {
        type,
        data,
        targetUserId: userId,
        broadcast: false,
        timestamp: Date.now(),
        id: options.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      const userChannel = `${this.userChannelPrefix}${userId}`;
      this.publisher.publish(userChannel, JSON.stringify(redisMessage))
        .catch(error => {
          console.error('[RedisSSE] Error publishing user message:', error);
        });
    }

    return localCount;
  }

  /**
   * Broadcast event to all clients (with Redis pub/sub)
   */
  override broadcastEvent(
    type: string, 
    data: any, 
    options: { id?: string; retry?: number; localOnly?: boolean } = {}
  ): number {
    // Broadcast to local clients first
    const localCount = super.broadcastEvent(type, data, options);

    // If not local-only, also publish to Redis for cross-instance delivery
    if (!options.localOnly && this.isInitialized && this.publisher) {
      const redisMessage: RedisSSEMessage = {
        type,
        data,
        broadcast: true,
        timestamp: Date.now(),
        id: options.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      this.publisher.publish(this.broadcastChannel, JSON.stringify(redisMessage))
        .catch(error => {
          console.error('[RedisSSE] Error publishing broadcast message:', error);
        });
    }

    return localCount;
  }

  /**
   * Subscribe to user-specific events
   */
  async subscribeToUser(userId: string): Promise<void> {
    if (!this.isInitialized || !this.subscriber) {
      await this.initialize();
    }

    const userChannel = `${this.userChannelPrefix}${userId}`;
    await this.subscriber!.subscribe(userChannel);
    console.log(`[RedisSSE] Subscribed to user channel: ${userChannel}`);
  }

  /**
   * Unsubscribe from user-specific events
   */
  async unsubscribeFromUser(userId: string): Promise<void> {
    if (!this.subscriber) return;

    const userChannel = `${this.userChannelPrefix}${userId}`;
    await this.subscriber.unsubscribe(userChannel);
    console.log(`[RedisSSE] Unsubscribed from user channel: ${userChannel}`);
  }

  /**
   * Store message for offline users (persistence)
   */
  async storeOfflineMessage(userId: string, event: SSEEvent): Promise<void> {
    if (!this.publisher) return;

    const key = `offline_messages:${userId}`;
    const message = {
      ...event,
      timestamp: Date.now()
    };

    try {
      // Store message with expiration (24 hours)
      await this.publisher.lpush(key, JSON.stringify(message));
      await this.publisher.expire(key, 24 * 60 * 60);
      
      // Keep only last 100 messages per user
      await this.publisher.ltrim(key, 0, 99);
    } catch (error) {
      console.error('[RedisSSE] Error storing offline message:', error);
    }
  }

  /**
   * Retrieve and send stored messages for a user
   */
  async deliverOfflineMessages(userId: string): Promise<number> {
    if (!this.publisher) return 0;

    const key = `offline_messages:${userId}`;
    
    try {
      const messages = await this.publisher.lrange(key, 0, -1);
      let deliveredCount = 0;

      for (const messageStr of messages) {
        try {
          const message = JSON.parse(messageStr);
          this.sendEventToUser(userId, message.type, message.data, {
            id: message.id,
            localOnly: true // Don't re-publish to Redis
          });
          deliveredCount++;
        } catch (error) {
          console.error('[RedisSSE] Error parsing offline message:', error);
        }
      }

      // Clear delivered messages
      if (deliveredCount > 0) {
        await this.publisher.del(key);
      }

      return deliveredCount;
    } catch (error) {
      console.error('[RedisSSE] Error delivering offline messages:', error);
      return 0;
    }
  }

  /**
   * Override addClient to handle offline message delivery
   */
  override addClient(
    clientId: string,
    userId: string,
    response: any,
    metadata: any = {}
  ): void {
    super.addClient(clientId, userId, response, metadata);

    // Deliver any offline messages
    this.deliverOfflineMessages(userId)
      .then(count => {
        if (count > 0) {
          console.log(`[RedisSSE] Delivered ${count} offline messages to user ${userId}`);
        }
      })
      .catch(error => {
        console.error('[RedisSSE] Error delivering offline messages:', error);
      });
  }

  /**
   * Get Redis connection status
   */
  getRedisStatus(): {
    publisher: boolean;
    subscriber: boolean;
    initialized: boolean;
  } {
    return {
      publisher: this.publisher?.status === 'ready',
      subscriber: this.subscriber?.status === 'ready',
      initialized: this.isInitialized
    };
  }

  /**
   * Enhanced stats including Redis status
   */
  override getStats() {
    const baseStats = super.getStats();
    return {
      ...baseStats,
      redis: this.getRedisStatus()
    };
  }

  /**
   * Cleanup Redis connections
   */
  override destroy(): void {
    super.destroy();

    if (this.subscriber) {
      this.subscriber.disconnect();
      this.subscriber = null;
    }

    if (this.publisher) {
      this.publisher.disconnect();
      this.publisher = null;
    }

    this.isInitialized = false;
  }
}

// Create and export singleton instance
let redisSSEHandler: RedisSSEHandler | null = null;

try {
  redisSSEHandler = new RedisSSEHandler();
} catch (error) {
  console.error('[RedisSSE] Failed to create handler, falling back to base handler:', error);
}

export default redisSSEHandler;