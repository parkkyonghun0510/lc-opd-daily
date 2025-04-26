/**
 * Simple Event Emitter for Real-time Updates
 * 
 * This module provides a simple event emitter for broadcasting events
 * to clients through various channels (SSE, WebSocket, Polling).
 */

// In-memory store for recent events (used for polling)
interface EventRecord {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  targets?: {
    userIds?: string[];
    roles?: string[];
  };
}

class RealtimeEventEmitter {
  private events: EventRecord[] = [];
  private maxEvents: number = 100; // Maximum number of events to keep in memory

  /**
   * Emit an event to be delivered to clients
   * 
   * @param type - Event type
   * @param data - Event data
   * @param options - Additional options
   * @returns The event ID
   */
  emit(type: string, data: any, options: {
    userIds?: string[];
    roles?: string[];
  } = {}): string {
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
        roles: options.roles
      }
    };

    // Add to the in-memory store
    this.events.unshift(event);

    // Trim the events array if it gets too large
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    console.log(`[EventEmitter] Emitted event: ${type}`, {
      id,
      targets: options.userIds?.length || options.roles?.length
        ? `${options.userIds?.length || 0} users, ${options.roles?.length || 0} roles`
        : 'broadcast'
    });

    return id;
  }

  /**
   * Get recent events for a specific user
   * 
   * @param userId - User ID
   * @param since - Timestamp to get events since
   * @returns Array of events
   */
  getEventsForUser(userId: string, since?: number): EventRecord[] {
    // Filter events that are either broadcast or targeted at this user
    return this.events
      .filter(event => {
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
        // For now, we'll just include all role-targeted events
        if (event.targets?.roles?.length) {
          return true; // In a real implementation, check if user has any of these roles
        }

        return false;
      });
  }

  /**
   * Get all recent events
   * 
   * @param since - Timestamp to get events since
   * @returns Array of events
   */
  getAllEvents(since?: number): EventRecord[] {
    if (since) {
      return this.events.filter(event => event.timestamp > since);
    }
    return [...this.events];
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get statistics about the event emitter
   */
  getStats(): any {
    return {
      eventsInMemory: this.events.length,
      maxEvents: this.maxEvents,
      oldestEventTimestamp: this.events.length ? this.events[this.events.length - 1].timestamp : null,
      newestEventTimestamp: this.events.length ? this.events[0].timestamp : null
    };
  }
}

// Create a singleton instance
export const eventEmitter = new RealtimeEventEmitter();

// Convenience functions for common event types

/**
 * Emit a notification event
 * 
 * @param title - Notification title
 * @param message - Notification message
 * @param options - Additional options
 * @returns The event ID
 */
export function emitNotification(
  title: string,
  message: string,
  options: {
    userIds?: string[];
    roles?: string[];
    type?: string;
    icon?: string;
  } = {}
): string {
  return eventEmitter.emit('notification', {
    title,
    message,
    type: options.type || 'info',
    icon: options.icon,
    timestamp: Date.now()
  }, {
    userIds: options.userIds,
    roles: options.roles
  });
}

/**
 * Emit a dashboard update event
 * 
 * @param updateType - Type of dashboard update
 * @param data - Update data
 * @param options - Additional options
 * @returns The event ID
 */
export function emitDashboardUpdate(
  updateType: string,
  data: any,
  options: {
    userIds?: string[];
    roles?: string[];
  } = {}
): string {
  return eventEmitter.emit('dashboardUpdate', {
    type: updateType,
    data,
    timestamp: Date.now()
  }, options);
}

/**
 * Emit a system alert
 * 
 * @param alertType - Type of alert (info, warning, error)
 * @param message - Alert message
 * @param options - Additional options
 * @returns The event ID
 */
export function emitSystemAlert(
  alertType: 'info' | 'warning' | 'error',
  message: string,
  options: {
    userIds?: string[];
    roles?: string[];
    data?: any;
  } = {}
): string {
  return eventEmitter.emit('systemAlert', {
    type: alertType,
    message,
    ...options.data,
    timestamp: Date.now()
  }, {
    userIds: options.userIds,
    roles: options.roles
  });
}
