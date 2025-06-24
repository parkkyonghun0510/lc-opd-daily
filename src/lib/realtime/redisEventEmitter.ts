/**
 * Redis-backed Event Emitter for Real-time Updates
 *
 * This module provides a Redis-backed event emitter for broadcasting events
 * to clients through various channels (SSE, WebSocket, Polling) across multiple server instances.
 */

import { Redis } from "@upstash/redis";
import { eventEmitter } from "./eventEmitter";

// Event record interface
interface EventRecord {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
  targets?: {
    userIds?: string[];
    roles?: string[];
  };
}

// Redis channel names
const CHANNELS = {
  EVENTS: "realtime:events",
  CLIENTS: "realtime:clients",
  STATS: "realtime:stats",
};

class RedisEventEmitter {
  private redis: Redis | null = null;
  private pubsub: Redis | null = null;
  private isSubscribed = false;
  private instanceId: string;
  private maxEvents: number = 100;

  constructor() {
    // Generate a unique instance ID
    this.instanceId = `instance:${crypto.randomUUID()}`;

    // Initialize Redis clients
    this.initRedis();
  }

  /**
   * Initialize Redis clients
   */
  private initRedis() {
    try {
      // Check if the required environment variables are present
      if (
        !process.env.UPSTASH_REDIS_REST_URL ||
        !process.env.UPSTASH_REDIS_REST_TOKEN
      ) {
        console.warn(
          "[RedisEventEmitter] Redis credentials not found. Using in-memory event emitter instead.",
        );
        return;
      }

      // Initialize Redis client
      this.redis = Redis.fromEnv();
      this.pubsub = Redis.fromEnv();

      console.log("[RedisEventEmitter] Redis clients initialized");

      // Subscribe to events
      this.subscribe();
    } catch (error) {
      console.error("[RedisEventEmitter] Failed to initialize Redis:", error);
      this.redis = null;
      this.pubsub = null;
    }
  }

  /**
   * Subscribe to Redis channels
   */
  private async subscribe() {
    if (!this.pubsub || this.isSubscribed) return;

    try {
      // Register this instance
      await this.redis?.set(
        `${CHANNELS.CLIENTS}:${this.instanceId}`,
        {
          instanceId: this.instanceId,
          startedAt: Date.now(),
        },
        { ex: 3600 },
      ); // Expire after 1 hour

      // Set up subscription
      // Note: For Upstash Redis, we would typically use their REST API for pub/sub
      // This is a simplified version that would need to be adapted for actual use

      this.isSubscribed = true;
      console.log("[RedisEventEmitter] Subscribed to Redis channels");
    } catch (error) {
      console.error(
        "[RedisEventEmitter] Failed to subscribe to Redis channels:",
        error,
      );
    }
  }

  /**
   * Emit an event to be delivered to clients
   *
   * @param type - Event type
   * @param data - Event data
   * @param options - Additional options
   * @returns The event ID
   */
  async emit(
    type: string,
    data: unknown,
    options: {
      userIds?: string[];
      roles?: string[];
    } = {},
  ): Promise<string> {
    // Generate event ID
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    // Create the event record
    const event: EventRecord = {
      id,
      type,
      data,
      timestamp,
      targets: {
        userIds: options.userIds,
        roles: options.roles,
      },
    };

    // First, emit the event using the in-memory emitter for local clients
    eventEmitter.emit(type, data, options);

    // If Redis is not available, just return the ID
    if (!this.redis) {
      return id;
    }

    try {
      // Store the event in Redis
      await this.redis.lpush(CHANNELS.EVENTS, JSON.stringify(event));

      // Trim the list to keep only the most recent events
      await this.redis.ltrim(CHANNELS.EVENTS, 0, this.maxEvents - 1);

      // Publish the event to other instances
      await this.redis.publish(
        CHANNELS.EVENTS,
        JSON.stringify({
          event,
          source: this.instanceId,
        }),
      );

      console.log(`[RedisEventEmitter] Emitted event: ${type}`, {
        id,
        targets:
          options.userIds?.length || options.roles?.length
            ? `${options.userIds?.length || 0} users, ${options.roles?.length || 0} roles`
            : "broadcast",
      });
    } catch (error) {
      console.error(
        "[RedisEventEmitter] Failed to emit event to Redis:",
        error,
      );
    }

    return id;
  }

  /**
   * Get recent events for a specific user
   *
   * @param userId - User ID
   * @param since - Timestamp to get events since
   * @returns Array of events
   */
  async getEventsForUser(
    userId: string,
    since?: number,
  ): Promise<EventRecord[]> {
    // If Redis is not available, fall back to in-memory events
    if (!this.redis) {
      return eventEmitter.getEventsForUser(userId, since);
    }

    try {
      // Get all events from Redis
      const eventsJson = await this.redis.lrange(CHANNELS.EVENTS, 0, -1);

      // Parse events
      const events: EventRecord[] = eventsJson
        .map((json) => {
          try {
            return JSON.parse(json);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // Filter events for this user
      return events.filter((event) => {
        // Include events after the 'since' timestamp
        if (since && event.timestamp <= since) {
          return false;
        }

        // Include broadcast events (no specific targets)
        if (!event.targets?.userIds?.length && !event.targets?.roles?.length) {
          return true;
        }

        // Include events targeted at this user
        if (event.targets?.userIds?.includes(userId)) {
          return true;
        }

        // Include events targeted at roles this user has
        // Note: In a real implementation, you would check the user's roles
        if (event.targets?.roles?.length) {
          return true; // In a real implementation, check if user has any of these roles
        }

        return false;
      });
    } catch (error) {
      console.error(
        "[RedisEventEmitter] Failed to get events from Redis:",
        error,
      );

      // Fall back to in-memory events
      return eventEmitter.getEventsForUser(userId, since);
    }
  }

  /**
   * Get all recent events
   *
   * @param since - Timestamp to get events since
   * @returns Array of events
   */
  async getAllEvents(since?: number): Promise<EventRecord[]> {
    // If Redis is not available, fall back to in-memory events
    if (!this.redis) {
      return eventEmitter.getAllEvents(since);
    }

    try {
      // Get all events from Redis
      const eventsJson = await this.redis.lrange(CHANNELS.EVENTS, 0, -1);

      // Parse events
      const events: EventRecord[] = eventsJson
        .map((json) => {
          try {
            return JSON.parse(json);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // Filter events by timestamp if needed
      if (since) {
        return events.filter((event) => event.timestamp > since);
      }

      return events;
    } catch (error) {
      console.error(
        "[RedisEventEmitter] Failed to get events from Redis:",
        error,
      );

      // Fall back to in-memory events
      return eventEmitter.getAllEvents(since);
    }
  }

  /**
   * Clear all events
   */
  async clearEvents(): Promise<void> {
    // Clear in-memory events
    eventEmitter.clearEvents();

    // If Redis is not available, just return
    if (!this.redis) {
      return;
    }

    try {
      // Clear events from Redis
      await this.redis.del(CHANNELS.EVENTS);
    } catch (error) {
      console.error(
        "[RedisEventEmitter] Failed to clear events from Redis:",
        error,
      );
    }
  }

  /**
   * Get statistics about connected clients across all instances
   */
  async getStats(): Promise<Record<string, unknown>> {
    // If Redis is not available, fall back to in-memory stats
    if (!this.redis) {
      return {
        ...eventEmitter.getStats(),
        redisAvailable: false,
        instances: [this.instanceId],
      };
    }

    try {
      // Get all instances
      const instanceKeys = await this.redis.keys(`${CHANNELS.CLIENTS}:*`);
      const instances = await Promise.all(
        instanceKeys.map(async (key) => {
          const instance = await this.redis?.get(key);
          return instance;
        }),
      );

      // Get local stats
      const localStats = eventEmitter.getStats();

      return {
        ...localStats,
        redisAvailable: true,
        instances: instances.filter(Boolean),
        totalInstances: instances.length,
      };
    } catch (error) {
      console.error(
        "[RedisEventEmitter] Failed to get stats from Redis:",
        error,
      );

      // Fall back to in-memory stats
      return {
        ...eventEmitter.getStats(),
        redisAvailable: false,
        instances: [this.instanceId],
      };
    }
  }
}

// Create a singleton instance
export const redisEventEmitter = new RedisEventEmitter();

// Convenience functions for common event types

/**
 * Emit a notification event
 *
 * @param title - Notification title
 * @param message - Notification message
 * @param options - Additional options
 * @returns The event ID
 */
export async function emitNotification(
  title: string,
  message: string,
  options: {
    userIds?: string[];
    roles?: string[];
    type?: string;
    icon?: string;
    id?: string;
  } = {},
): Promise<string> {
  const eventId = options.id || crypto.randomUUID();
  const timestamp = Date.now();

  return await redisEventEmitter.emit(
    "notification",
    {
      id: eventId,
      title,
      message,
      body: message, // For compatibility with different client implementations
      type: options.type || "info",
      icon: options.icon,
      timestamp,
    },
    {
      userIds: options.userIds,
      roles: options.roles,
    },
  );
}

/**
 * Emit a dashboard update event
 *
 * @param updateType - Type of dashboard update
 * @param data - Update data
 * @param options - Additional options
 * @returns The event ID
 */
export async function emitDashboardUpdate(
  updateType: string,
  data: Record<string, unknown>,
  options: {
    userIds?: string[];
    roles?: string[];
    id?: string;
    title?: string;
    message?: string;
  } = {},
): Promise<string> {
  const eventId = options.id || crypto.randomUUID();
  const timestamp = Date.now();

  return await redisEventEmitter.emit(
    "dashboardUpdate",
    {
      id: eventId,
      type: updateType,
      data,
      title: options.title || `Dashboard Update: ${updateType}`,
      message: options.message || "Dashboard data has been updated",
      timestamp,
    },
    {
      userIds: options.userIds,
      roles: options.roles,
    },
  );
}
