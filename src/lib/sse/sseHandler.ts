import { NextResponse } from "next/server";
import { sseMetrics } from "./sseMetrics";

/**
 * Client connection information
 */
type Client = {
  id: string;
  userId: string;
  response: any;
  connectedAt: number;
  lastActivity: number;
  metadata?: Record<string, any>;
};

/**
 * Event data structure for SSE events
 */
interface SSEEvent<T = any> {
  type: string;
  data: T;
  id?: string;
  retry?: number;
}

/**
 * Enhanced SSE Handler with improved connection management,
 * standardized event formatting, and activity tracking
 */
class SSEHandler {
  private clients: Map<string, Client> = new Map();
  private readonly INACTIVE_TIMEOUT = 3 * 60 * 1000; // 3 minutes (reduced from 5)
  private readonly STALE_TIMEOUT = 15 * 60 * 1000; // 15 minutes (reduced from 30)
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start the cleanup interval to remove stale connections
    // Run cleanup more frequently (every 30 seconds instead of 60)
    this.cleanupInterval = setInterval(
      () => this.cleanupInactiveConnections(),
      30000,
    );

    // Run an initial cleanup immediately
    this.cleanupInactiveConnections();
  }

  /**
   * Add a new client connection
   */
  addClient(
    id: string,
    userId: string,
    response: any,
    metadata?: Record<string, any>,
  ) {
    const now = Date.now();
    this.clients.set(id, {
      id,
      userId,
      response,
      connectedAt: now,
      lastActivity: now,
      metadata,
    });

    // Record the connection in metrics
    sseMetrics.recordConnection(userId);

    console.log(
      `[SSE] Client connected: ${id} for user: ${userId}. Total: ${this.clients.size}`,
    );
    return id;
  }

  /**
   * Remove a client connection
   */
  removeClient(id: string) {
    const client = this.clients.get(id);
    if (client) {
      this.clients.delete(id);

      // Record the disconnection in metrics
      sseMetrics.recordDisconnection(client.userId);

      const duration = Math.round((Date.now() - client.connectedAt) / 1000);
      console.log(
        `[SSE] Client disconnected: ${id} for user: ${client.userId}. Duration: ${duration}s. Total: ${this.clients.size}`,
      );
    }
  }

  /**
   * Update client's last activity timestamp
   */
  updateClientActivity(id: string) {
    const client = this.clients.get(id);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  /**
   * Send an event to a specific user
   * @param userId - The user ID to send the event to
   * @param eventType - The type of event
   * @param data - The event data
   * @param options - Additional options (retry, id)
   */
  sendEventToUser(
    userId: string,
    eventType: string,
    data: any,
    options: { retry?: number; id?: string } = {},
  ) {
    const startTime = performance.now();
    let sentCount = 0;

    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        this.sendEvent(client.response, {
          type: eventType,
          data,
          retry: options.retry,
          id: options.id,
        });
        sentCount++;
      }
    }

    // Record the event in metrics
    if (sentCount > 0) {
      sseMetrics.recordEvent(eventType, userId);

      // Record processing time
      const processingTime = performance.now() - startTime;
      sseMetrics.recordEventProcessingTime(processingTime);

      console.log(
        `[SSE] Sent '${eventType}' event to user ${userId} (${sentCount} connections)`,
      );
    }

    return sentCount;
  }

  /**
   * Broadcast an event to all connected clients
   * @param eventType - The type of event
   * @param data - The event data
   * @param options - Additional options (retry, id)
   */
  broadcastEvent(
    eventType: string,
    data: any,
    options: { retry?: number; id?: string } = {},
  ) {
    const startTime = performance.now();
    console.log(
      `[SSE] Broadcasting '${eventType}' event to all clients (${this.clients.size})`,
    );

    // Track unique users that received the event
    const userIds = new Set<string>();

    for (const client of this.clients.values()) {
      this.sendEvent(client.response, {
        type: eventType,
        data,
        retry: options.retry,
        id: options.id,
      });
      userIds.add(client.userId);
    }

    // Record the event in metrics for each user
    for (const userId of userIds) {
      sseMetrics.recordEvent(eventType, userId);
    }

    // Record processing time
    const processingTime = performance.now() - startTime;
    sseMetrics.recordEventProcessingTime(processingTime);

    return this.clients.size;
  }

  /**
   * Send a properly formatted SSE event
   */
  private sendEvent(response: any, event: SSEEvent) {
    try {
      // Format the event according to SSE specification
      let message = "";

      // Add event type if provided
      if (event.type) {
        message += `event: ${event.type}\n`;
      }

      // Add event ID if provided
      if (event.id) {
        message += `id: ${event.id}\n`;
      }

      // Add retry if provided
      if (event.retry) {
        message += `retry: ${event.retry}\n`;
      }

      // Add the data (required)
      message += `data: ${JSON.stringify(event.data)}\n\n`;

      // Send the formatted message
      response.write(message);
    } catch (error) {
      console.error(`[SSE] Error sending event:`, error);

      // Record the error in metrics
      sseMetrics.recordError("send_event_error");
    }
  }

  /**
   * Clean up inactive connections
   */
  private cleanupInactiveConnections() {
    const now = Date.now();
    const inactiveIds: string[] = [];
    const staleIds: string[] = [];

    // Find inactive and stale connections
    for (const [id, client] of this.clients.entries()) {
      // Check for inactive connections (no activity for 3 minutes)
      if (now - client.lastActivity > this.INACTIVE_TIMEOUT) {
        inactiveIds.push(id);
      }

      // Also check for very old connections (connected for more than 15 minutes)
      // This helps prevent zombie connections that might still be sending pings
      if (now - client.connectedAt > this.STALE_TIMEOUT) {
        staleIds.push(id);
      }
    }

    // Remove inactive connections
    if (inactiveIds.length > 0) {
      console.log(
        `[SSE] Cleaning up ${inactiveIds.length} inactive connections`,
      );

      for (const id of inactiveIds) {
        this.removeClient(id);
      }
    }

    // Remove stale connections
    if (staleIds.length > 0) {
      console.log(
        `[SSE] Cleaning up ${staleIds.length} stale connections (connected > 30 min)`,
      );

      for (const id of staleIds) {
        // Only remove if not already removed as inactive
        if (!inactiveIds.includes(id)) {
          this.removeClient(id);
        }
      }
    }
  }

  /**
   * Get statistics about current connections
   */
  getStats() {
    const userCounts = new Map<string, number>();

    // Count connections per user
    for (const client of this.clients.values()) {
      userCounts.set(client.userId, (userCounts.get(client.userId) || 0) + 1);
    }

    return {
      totalConnections: this.clients.size,
      uniqueUsers: userCounts.size,
      userCounts: Object.fromEntries(userCounts),
    };
  }

  /**
   * Shutdown the handler and clean up resources
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all connections
    for (const id of this.clients.keys()) {
      this.removeClient(id);
    }

    console.log(`[SSE] Handler shutdown complete`);
  }
}

const sseHandler = new SSEHandler();
export default sseHandler;
