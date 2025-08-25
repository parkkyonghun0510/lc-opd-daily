/**
 * Memory-based Event Store for SSE Polling Fallback
 * 
 * This module provides an in-memory event store that can be used as a fallback
 * when Redis is not available or for development environments.
 */

import { SSEEvent, SSEEventUtils } from '../sse/eventTypes';

interface StoredEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  targets?: {
    userIds?: string[];
    roles?: string[];
  };
  // Add SSE event fields if it's a standardized event
  priority?: string;
  source?: string;
  version?: string;
  metadata?: any;
}

class MemoryEventStore {
  private events: StoredEvent[] = [];
  private maxEvents: number = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxAge: number = 60 * 60 * 1000; // 1 hour

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  /**
   * Add an event to the store
   */
  addEvent(
    type: string,
    data: any,
    options: {
      userIds?: string[];
      roles?: string[];
      eventId?: string;
      priority?: string;
      source?: string;
    } = {}
  ): string {
    const id = options.eventId || crypto.randomUUID();
    const timestamp = Date.now();

    const event: StoredEvent = {
      id,
      type,
      data,
      timestamp,
      targets: {
        userIds: options.userIds,
        roles: options.roles
      },
      priority: options.priority,
      source: options.source
    };

    // Add to beginning of array (most recent first)
    this.events.unshift(event);

    // Trim to max events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    console.log(`[MemoryEventStore] Added event: ${type} (${this.events.length} total)`);
    return id;
  }

  /**
   * Get events for a specific user
   */
  getEventsForUser(userId: string, since?: number, userRole?: string): StoredEvent[] {
    const sinceTimestamp = since || (Date.now() - (5 * 60 * 1000)); // Default to 5 minutes ago

    return this.events.filter(event => {
      // Filter by timestamp
      if (event.timestamp < sinceTimestamp) {
        return false;
      }

      // Check if this event should be sent to this user
      if (event.targets) {
        // Check user ID targeting
        if (event.targets.userIds && event.targets.userIds.length > 0) {
          if (!event.targets.userIds.includes(userId)) {
            return false;
          }
        }

        // Check role targeting
        if (event.targets.roles && event.targets.roles.length > 0 && userRole) {
          if (!event.targets.roles.includes(userRole)) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Get all events (for admin/debugging)
   */
  getAllEvents(limit: number = 100): StoredEvent[] {
    return this.events.slice(0, limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: string, limit: number = 50): StoredEvent[] {
    return this.events
      .filter(event => event.type === type)
      .slice(0, limit);
  }

  /**
   * Clean up old events
   */
  private cleanup() {
    const before = this.events.length;
    const cutoff = Date.now() - this.maxAge;
    
    this.events = this.events.filter(event => event.timestamp > cutoff);
    
    const after = this.events.length;
    if (before !== after) {
      console.log(`[MemoryEventStore] Cleaned up ${before - after} old events (${after} remaining)`);
    }
  }

  /**
   * Get store statistics
   */
  getStats() {
    const now = Date.now();
    const recentEvents = this.events.filter(event => 
      (now - event.timestamp) < (5 * 60 * 1000) // Last 5 minutes
    );

    const eventTypes = new Map<string, number>();
    this.events.forEach(event => {
      eventTypes.set(event.type, (eventTypes.get(event.type) || 0) + 1);
    });

    return {
      totalEvents: this.events.length,
      recentEvents: recentEvents.length,
      eventTypes: Object.fromEntries(eventTypes),
      oldestEvent: this.events.length > 0 ? this.events[this.events.length - 1].timestamp : null,
      newestEvent: this.events.length > 0 ? this.events[0].timestamp : null,
      maxEvents: this.maxEvents,
      maxAge: this.maxAge
    };
  }

  /**
   * Clear all events (for testing)
   */
  clear() {
    this.events = [];
    console.log('[MemoryEventStore] Cleared all events');
  }

  /**
   * Destroy the store and cleanup
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.events = [];
    console.log('[MemoryEventStore] Destroyed');
  }
}

// Create a singleton instance
export const memoryEventStore = new MemoryEventStore();

// Export the class for testing
export { MemoryEventStore };

/**
 * Utility functions for working with the memory event store
 */
export const MemoryEventStoreUtils = {
  /**
   * Add a standardized SSE event to the store
   */
  addSSEEvent(event: SSEEvent): string {
    return memoryEventStore.addEvent(
      event.type,
      event.data,
      {
        eventId: event.id,
        userIds: event.metadata?.userIds,
        roles: event.metadata?.roles,
        priority: event.priority,
        source: event.source
      }
    );
  },

  /**
   * Add a simple event to the store
   */
  addEvent(
    type: string,
    data: any,
    targetUsers?: string[],
    targetRoles?: string[]
  ): string {
    return memoryEventStore.addEvent(type, data, {
      userIds: targetUsers,
      roles: targetRoles
    });
  },

  /**
   * Get formatted events for a user (compatible with polling API)
   */
  getFormattedEventsForUser(
    userId: string,
    since?: number,
    userRole?: string
  ): any[] {
    const events = memoryEventStore.getEventsForUser(userId, since, userRole);
    
    // Convert to format expected by polling clients
    return events.map(event => ({
      id: event.id,
      type: event.type,
      data: event.data,
      timestamp: event.timestamp,
      // Include SSE event fields if present
      ...(event.priority && { priority: event.priority }),
      ...(event.source && { source: event.source }),
      ...(event.version && { version: event.version })
    }));
  }
};