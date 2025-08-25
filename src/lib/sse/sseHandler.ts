/**
 * Base SSE Handler
 * 
 * Provides core Server-Sent Events functionality for real-time communication.
 * This is the base implementation that can be extended by Redis-backed or
 * Dragonfly-optimized handlers.
 */

import { EventEmitter } from 'events';

export interface SSEClient {
  id: string;
  userId: string;
  response: {
    write: (data: string) => void;
    close?: () => void;
    error?: (err: Error) => void;
  };
  metadata: {
    clientType?: string;
    role?: string;
    userAgent?: string;
    ip?: string;
    connectedAt: Date;
    lastActivity: Date;
  };
}

export interface SSEEvent {
  type: string;
  data: any;
  id?: string;
  retry?: number;
}

export class BaseSSEHandler extends EventEmitter {
  private clients: Map<string, SSEClient> = new Map();
  private userClients: Map<string, Set<string>> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    
    // Clean up inactive clients every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveClients();
    }, 5 * 60 * 1000);
  }

  /**
   * Add a new SSE client
   */
  addClient(
    clientId: string,
    userId: string,
    response: SSEClient['response'],
    metadata: Partial<SSEClient['metadata']> = {}
  ): void {
    const client: SSEClient = {
      id: clientId,
      userId,
      response,
      metadata: {
        ...metadata,
        connectedAt: new Date(),
        lastActivity: new Date()
      }
    };

    this.clients.set(clientId, client);

    // Track user's clients
    if (!this.userClients.has(userId)) {
      this.userClients.set(userId, new Set());
    }
    this.userClients.get(userId)!.add(clientId);

    console.log(`[SSE] Client ${clientId} connected for user ${userId}`);
    this.emit('clientConnected', { clientId, userId });
  }

  /**
   * Remove an SSE client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { userId } = client;

    // Remove from clients map
    this.clients.delete(clientId);

    // Remove from user's clients
    const userClientSet = this.userClients.get(userId);
    if (userClientSet) {
      userClientSet.delete(clientId);
      if (userClientSet.size === 0) {
        this.userClients.delete(userId);
      }
    }

    console.log(`[SSE] Client ${clientId} disconnected for user ${userId}`);
    this.emit('clientDisconnected', { clientId, userId });
  }

  /**
   * Update client activity timestamp
   */
  updateClientActivity(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.metadata.lastActivity = new Date();
    }
  }

  /**
   * Send event to a specific user
   */
  sendEventToUser(userId: string, type: string, data: any, options: { id?: string; retry?: number } = {}): number {
    const userClientIds = this.userClients.get(userId);
    if (!userClientIds || userClientIds.size === 0) {
      return 0;
    }

    let sentCount = 0;
    const event: SSEEvent = {
      type,
      data,
      id: options.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      retry: options.retry
    };

    for (const clientId of userClientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          this.sendEventToClient(client, event);
          sentCount++;
        } catch (error) {
          console.error(`[SSE] Error sending event to client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }

    return sentCount;
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcastEvent(type: string, data: any, options: { id?: string; retry?: number } = {}): number {
    const event: SSEEvent = {
      type,
      data,
      id: options.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      retry: options.retry
    };

    let sentCount = 0;
    for (const client of this.clients.values()) {
      try {
        this.sendEventToClient(client, event);
        sentCount++;
      } catch (error) {
        console.error(`[SSE] Error broadcasting to client ${client.id}:`, error);
        this.removeClient(client.id);
      }
    }

    return sentCount;
  }

  /**
   * Send event to a specific client
   */
  private sendEventToClient(client: SSEClient, event: SSEEvent): void {
    const sseData = this.formatSSEData(event);
    client.response.write(sseData);
    client.metadata.lastActivity = new Date();
  }

  /**
   * Format data for SSE transmission
   */
  private formatSSEData(event: SSEEvent): string {
    let sseData = '';
    
    if (event.id) {
      sseData += `id: ${event.id}\n`;
    }
    
    if (event.retry) {
      sseData += `retry: ${event.retry}\n`;
    }
    
    sseData += `event: ${event.type}\n`;
    sseData += `data: ${JSON.stringify(event.data)}\n\n`;
    
    return sseData;
  }

  /**
   * Clean up inactive clients
   */
  private cleanupInactiveClients(): void {
    const now = new Date();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [clientId, client] of this.clients.entries()) {
      const timeSinceActivity = now.getTime() - client.metadata.lastActivity.getTime();
      if (timeSinceActivity > inactiveThreshold) {
        console.log(`[SSE] Removing inactive client ${clientId}`);
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalClients: number;
    totalUsers: number;
    clientsByUser: Record<string, number>;
  } {
    const clientsByUser: Record<string, number> = {};
    
    for (const [userId, clientIds] of this.userClients.entries()) {
      clientsByUser[userId] = clientIds.size;
    }

    return {
      totalClients: this.clients.size,
      totalUsers: this.userClients.size,
      clientsByUser
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Close all client connections
    for (const client of this.clients.values()) {
      try {
        client.response.close?.();
      } catch (error) {
        console.error(`[SSE] Error closing client ${client.id}:`, error);
      }
    }
    
    this.clients.clear();
    this.userClients.clear();
    this.removeAllListeners();
  }
}

// Create and export singleton instance
const sseHandler = new BaseSSEHandler();
export default sseHandler;