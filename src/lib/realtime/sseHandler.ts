/**
 * Simple SSE Handler
 *
 * This is a simplified SSE handler that manages client connections
 * and sends events to connected clients.
 */

import { NextRequest } from "next/server";
// Removed unused import: import { eventEmitter } from "./eventEmitter";
import { realtimeMonitor } from "./monitor";

// Client connection interface
interface Client {
  id: string;
  userId: string;
  response: unknown;
  connectedAt: number;
  lastActivity: number;
  metadata?: Record<string, unknown>;
}

class SSEHandler {
  private clients: Map<string, Client> = new Map();
  private readonly INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start the cleanup interval
    this.cleanupInterval = setInterval(
      () => this.cleanupInactiveConnections(),
      60000,
    );
    console.log("[SSE] Simple SSE handler initialized");
  }

  /**
   * Handle a new SSE connection
   */
  async handleConnection(
    request: NextRequest,
    userId: string,
    response: unknown,
    metadata?: Record<string, unknown>,
  ) {
    // Generate a unique client ID
    const clientId = crypto.randomUUID();
    const now = Date.now();

    // Store the client
    this.clients.set(clientId, {
      id: clientId,
      userId,
      response,
      connectedAt: now,
      lastActivity: now,
      metadata,
    });

    // Record the connection in monitoring
    realtimeMonitor.recordConnection();

    console.log(
      `[SSE] Client connected: ${clientId} (User: ${userId}). Total: ${this.clients.size}`,
    );

    // Send initial connection event
    this.sendEvent(response, {
      type: "connected",
      data: {
        clientId,
        userId,
        connectedAt: now,
        message: "Connected to SSE stream",
      },
    });

    // Set up connection close handler
    request.signal.addEventListener("abort", () => {
      this.removeClient(clientId);
    });

    // Return the client ID
    return clientId;
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return false;

    this.clients.delete(clientId);

    // Record the disconnection in monitoring
    realtimeMonitor.recordDisconnection();

    console.log(
      `[SSE] Client disconnected: ${clientId} (User: ${client.userId}). Total: ${this.clients.size}`,
    );

    return true;
  }

  /**
   * Clean up inactive connections
   */
  cleanupInactiveConnections() {
    const now = Date.now();
    let removedCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastActivity > this.INACTIVE_TIMEOUT) {
        this.clients.delete(clientId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(
        `[SSE] Cleaned up ${removedCount} inactive connections. Remaining: ${this.clients.size}`,
      );
    }
  }

  /**
   * Send an event to a specific client
   */
  sendEvent(response: unknown, event: { type: string; data: unknown }) {
    // Type assertion for response
    const typedResponse = response as { write: (data: string) => void };
    try {
      // Format the event according to SSE specification
      let message = "";

      // Add event type
      message += `event: ${event.type}\n`;

      // Add the data
      message += `data: ${JSON.stringify(event.data)}\n\n`;

      // Send the formatted message
      typedResponse.write(message);

      // Record the sent event in monitoring
      realtimeMonitor.recordSentEvent();

      return true;
    } catch (error) {
      console.error(`[SSE] Error sending event:`, error);

      // Record the error in monitoring
      realtimeMonitor.recordError("message");

      return false;
    }
  }

  /**
   * Send an event to a specific user
   */
  sendEventToUser(userId: string, eventType: string, data: unknown) {
    let sentCount = 0;

    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        this.sendEvent(client.response, { type: eventType, data });
        client.lastActivity = Date.now();
        sentCount++;
      }
    }

    if (sentCount > 0) {
      console.log(
        `[SSE] Sent '${eventType}' event to user ${userId} (${sentCount} connections)`,
      );
    }

    return sentCount;
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcastEvent(eventType: string, data: unknown) {
    let sentCount = 0;

    for (const client of this.clients.values()) {
      this.sendEvent(client.response, { type: eventType, data });
      client.lastActivity = Date.now();
      sentCount++;
    }

    if (sentCount > 0) {
      console.log(
        `[SSE] Broadcast '${eventType}' event to all clients (${sentCount} connections)`,
      );
    }

    return sentCount;
  }

  /**
   * Get statistics about connected clients
   */
  getStats() {
    const userCounts: Record<string, number> = {};

    for (const client of this.clients.values()) {
      userCounts[client.userId] = (userCounts[client.userId] || 0) + 1;
    }

    return {
      totalConnections: this.clients.size,
      uniqueUsers: Object.keys(userCounts).length,
      userCounts,
      timestamp: new Date().toISOString(),
    };
  }
}

// Create a singleton instance
export const sseHandler = new SSEHandler();
