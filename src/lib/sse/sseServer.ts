import { NextRequest, NextResponse } from 'next/server';
import { sseMetrics } from './sseMetrics';

/**
 * Client connection information
 */
export type Client = {
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
export interface SSEEvent<T = any> {
  type: string;
  data: T;
  id?: string;
  retry?: number;
}

/**
 * SSE Handler Class
 * 
 * This class manages SSE connections and events.
 */
export class SSEHandler {
  private clients: Map<string, Client>;
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    this.clients = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupInactiveConnections(), 30000);
    console.log('[SSE] Handler initialized');
  }
  
  /**
   * Add a new client connection
   */
  addClient(id: string, userId: string, response: any, metadata: Record<string, any> = {}) {
    const now = Date.now();
    this.clients.set(id, {
      id,
      userId,
      response,
      connectedAt: now,
      lastActivity: now,
      metadata
    });
    
    console.log(`[SSE] Client connected: ${id} for user: ${userId}. Total: ${this.clients.size}`);
    return id;
  }
  
  /**
   * Remove a client connection
   */
  removeClient(id: string) {
    const client = this.clients.get(id);
    if (client) {
      console.log(`[SSE] Client disconnected: ${id} for user: ${client.userId}. Total before removal: ${this.clients.size}`);
      this.clients.delete(id);
      return true;
    }
    return false;
  }
  
  /**
   * Send an event to a specific user
   */
  sendEventToUser(userId: string, eventType: string, data: any, options: { retry?: number, id?: string } = {}) {
    const startTime = performance.now();
    let sentCount = 0;
    
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        this.sendEvent(client.response, {
          type: eventType,
          data,
          retry: options.retry,
          id: options.id
        });
        client.lastActivity = Date.now();
        sentCount++;
      }
    }
    
    // Record the event in metrics
    if (sentCount > 0) {
      sseMetrics.recordEvent(eventType, userId);
      
      // Record processing time
      const processingTime = performance.now() - startTime;
      sseMetrics.recordEventProcessingTime(processingTime);
      
      console.log(`[SSE] Sent '${eventType}' event to user ${userId} (${sentCount} connections) in ${processingTime.toFixed(2)}ms`);
    }
    
    return sentCount;
  }
  
  /**
   * Send an event to clients with a specific role
   */
  sendEventToRole(role: string, eventType: string, data: any, options: { retry?: number, id?: string } = {}) {
    const startTime = performance.now();
    let sentCount = 0;
    
    for (const client of this.clients.values()) {
      if (client.metadata?.role === role) {
        this.sendEvent(client.response, {
          type: eventType,
          data,
          retry: options.retry,
          id: options.id
        });
        client.lastActivity = Date.now();
        sentCount++;
      }
    }
    
    // Record the event in metrics
    if (sentCount > 0) {
      sseMetrics.recordEvent(`${eventType}_role_${role}`, 'role-based');
      
      // Record processing time
      const processingTime = performance.now() - startTime;
      sseMetrics.recordEventProcessingTime(processingTime);
      
      console.log(`[SSE] Sent '${eventType}' event to role ${role} (${sentCount} connections) in ${processingTime.toFixed(2)}ms`);
    }
    
    return sentCount;
  }
  
  /**
   * Broadcast an event to all connected clients
   */
  broadcastEvent(eventType: string, data: any, options: { retry?: number, id?: string } = {}) {
    const startTime = performance.now();
    console.log(`[SSE] Broadcasting '${eventType}' event to all clients (${this.clients.size})`);
    
    // Track unique users that received the event
    const userIds = new Set<string>();
    
    for (const client of this.clients.values()) {
      this.sendEvent(client.response, {
        type: eventType,
        data,
        retry: options.retry,
        id: options.id
      });
      client.lastActivity = Date.now();
      userIds.add(client.userId);
    }
    
    // Record the event in metrics
    for (const userId of userIds) {
      sseMetrics.recordEvent(eventType, userId);
    }
    
    // Record processing time
    const processingTime = performance.now() - startTime;
    sseMetrics.recordEventProcessingTime(processingTime);
    
    console.log(`[SSE] Broadcast complete: Sent to ${this.clients.size} connections (${userIds.size} unique users) in ${processingTime.toFixed(2)}ms`);
    
    return this.clients.size;
  }
  
  /**
   * Send a properly formatted SSE event
   */
  private sendEvent(response: any, event: SSEEvent) {
    try {
      // Format the event according to SSE specification
      let message = '';
      
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
      return true;
    } catch (error) {
      console.error('[SSE] Error sending event:', error);
      
      // Record the error in metrics
      sseMetrics.recordError('send_event_error');
      return false;
    }
  }
  
  /**
   * Clean up inactive connections
   */
  private cleanupInactiveConnections() {
    const now = Date.now();
    const INACTIVE_TIMEOUT = 3 * 60 * 1000; // 3 minutes
    const STALE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
    
    let inactiveCount = 0;
    let staleCount = 0;
    
    for (const [id, client] of this.clients.entries()) {
      const inactiveDuration = now - client.lastActivity;
      const totalDuration = now - client.connectedAt;
      
      // Remove inactive clients
      if (inactiveDuration > INACTIVE_TIMEOUT) {
        console.log(`[SSE] Removing inactive client: ${id} (inactive for ${Math.round(inactiveDuration / 1000)}s)`);
        this.clients.delete(id);
        inactiveCount++;
        continue;
      }
      
      // Remove stale clients (connected for too long)
      if (totalDuration > STALE_TIMEOUT) {
        console.log(`[SSE] Removing stale client: ${id} (connected for ${Math.round(totalDuration / 1000)}s)`);
        this.clients.delete(id);
        staleCount++;
        continue;
      }
    }
    
    if (inactiveCount > 0 || staleCount > 0) {
      console.log(`[SSE] Cleanup complete: Removed ${inactiveCount} inactive and ${staleCount} stale connections. Remaining: ${this.clients.size}`);
    }
  }
  
  /**
   * Get statistics about current connections
   */
  getStats() {
    // Count connections per user
    const userCounts: Record<string, number> = {};
    for (const client of this.clients.values()) {
      userCounts[client.userId] = (userCounts[client.userId] || 0) + 1;
    }
    
    // Count connections per client type
    const clientTypes: Record<string, number> = {};
    for (const client of this.clients.values()) {
      const clientType = client.metadata?.clientType || 'unknown';
      clientTypes[clientType] = (clientTypes[clientType] || 0) + 1;
    }
    
    // Count connections per role
    const roleCounts: Record<string, number> = {};
    for (const client of this.clients.values()) {
      const role = client.metadata?.role || 'unknown';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    }
    
    return {
      totalConnections: this.clients.size,
      uniqueUsers: Object.keys(userCounts).length,
      userCounts,
      clientTypes,
      roleCounts,
      timestamp: new Date().toISOString()
    };
  }
}

// Create a singleton instance of the SSE handler
export const sseHandler = new SSEHandler();

/**
 * Create an SSE endpoint handler for Next.js API routes
 */
export function createSSEHandler(options: {
  onConnect?: (request: NextRequest, userId: string, clientId: string) => void;
  onDisconnect?: (userId: string, clientId: string) => void;
  pingInterval?: number;
}) {
  const {
    onConnect,
    onDisconnect,
    pingInterval = 10000
  } = options;
  
  return async function handleSSE(request: NextRequest) {
    // Get user ID from query parameters or session
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 'anonymous-user';
    const clientType = url.searchParams.get('clientType') || 'browser';
    const clientInfo = url.searchParams.get('clientInfo') || request.headers.get('user-agent') || '';
    const role = url.searchParams.get('role') || 'user';
    
    console.log(`[SSE] New connection request from user: ${userId}, client: ${clientType}, role: ${role}`);
    
    // Set SSE headers
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Important for Nginx
    };
    
    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const clientId = crypto.randomUUID();
        
        // Create response object that the SSE handler will use
        const response = {
          write: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
        };
        
        // Register client with the SSE handler
        sseHandler.addClient(clientId, userId, response, {
          clientType,
          clientInfo,
          role,
          ip: request.headers.get('x-forwarded-for') || undefined,
          userAgent: request.headers.get('user-agent') || undefined
        });
        
        // Call the onConnect callback if provided
        if (onConnect) {
          onConnect(request, userId, clientId);
        }
        
        // Send a ping every 10 seconds to keep the connection alive
        const pingIntervalId = setInterval(() => {
          try {
            sseHandler.sendEventToUser(userId, 'ping', {
              time: new Date().toISOString(),
              timestamp: Date.now()
            });
          } catch (error) {
            console.error('[SSE] Error sending ping:', error);
            clearInterval(pingIntervalId);
            sseHandler.removeClient(clientId);
            controller.close();
          }
        }, pingInterval);
        
        // Handle connection close
        request.signal.addEventListener('abort', () => {
          clearInterval(pingIntervalId);
          sseHandler.removeClient(clientId);
          
          // Call the onDisconnect callback if provided
          if (onDisconnect) {
            onDisconnect(userId, clientId);
          }
          
          controller.close();
        });
        
        // Send initial connection event with retry parameter
        sseHandler.sendEventToUser(userId, 'connected', {
          clientId,
          timestamp: Date.now(),
          message: 'SSE connection established'
        }, {
          retry: 10000 // Suggest client to wait 10 seconds before reconnecting
        });
      }
    });
    
    return new NextResponse(stream, { headers });
  };
}
