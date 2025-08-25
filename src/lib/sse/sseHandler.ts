import { NextResponse } from "next/server";
import { 
    SSEEvent, 
    SSEEventBuilder, 
    SSEMessageFormatter, 
    SSEEventUtils,
    SSEEventType,
    SSEEventPriority 
} from './eventTypes';

/**
 * Client connection information with enhanced state tracking
 */
type Client = {
    id: string;
    userId: string;
    response: any;
    connectedAt: number;
    lastActivity: number;
    lastPing: number;
    connectionState: 'connecting' | 'connected' | 'idle' | 'stale' | 'disconnecting';
    metadata?: Record<string, any>;
    eventsSent: number;
    errorsCount: number;
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
        this.cleanupInterval = setInterval(() => this.cleanupInactiveConnections(), 30000);

        // Run an initial cleanup immediately
        this.cleanupInactiveConnections();
    }

    /**
     * Add a new client connection with comprehensive state tracking
     */
    addClient(id: string, userId: string, response: any, metadata?: Record<string, any>) {
        const now = Date.now();
        
        // Create client with enhanced tracking
        const client: Client = {
            id,
            userId,
            response,
            connectedAt: now,
            lastActivity: now,
            lastPing: now,
            connectionState: 'connecting',
            metadata,
            eventsSent: 0,
            errorsCount: 0
        };
        
        this.clients.set(id, client);

        // Immediately mark as connected
        setTimeout(() => {
            const existingClient = this.clients.get(id);
            if (existingClient) {
                existingClient.connectionState = 'connected';
            }
        }, 100);

        console.log(`[SSE] Client connected: ${id} for user: ${userId}. Total: ${this.clients.size}`);
        
        // Send standardized connection confirmation
        const connectionEvent = SSEEventBuilder.createConnectionEvent(
            id,
            'SSE connection established successfully',
            {
                version: '1.0',
                capabilities: ['ping', 'reconnect', 'error_recovery', 'standardized_events'],
                pingInterval: 30000
            },
            {
                userAgent: metadata?.userAgent,
                ip: metadata?.ip,
                connectedAt: new Date(now).toISOString(),
                authMethod: metadata?.authMethod
            }
        );
        
        this.sendEvent(response, connectionEvent, id);
    }

    /**
     * Remove a client connection with proper cleanup
     */
    removeClient(id: string, reason?: string) {
        const client = this.clients.get(id);
        if (client) {
            // Mark as disconnecting
            client.connectionState = 'disconnecting';
            
            // Try to send disconnection event
            try {
                this.sendEvent(client.response, {
                    type: 'disconnecting',
                    data: {
                        clientId: id,
                        reason: reason || 'Connection closed',
                        timestamp: Date.now()
                    }
                });
            } catch (error) {
                // Silent fail - connection might already be closed
            }
            
            // Remove from map
            this.clients.delete(id);

            const duration = Math.round((Date.now() - client.connectedAt) / 1000);
            const stats = {
                duration: `${duration}s`,
                eventsSent: client.eventsSent,
                errors: client.errorsCount,
                reason: reason || 'Normal closure'
            };
            
            console.log(`[SSE] Client disconnected: ${id} for user: ${client.userId}. Stats:`, stats, `Total: ${this.clients.size}`);
        }
    }

    /**
     * Update client's last activity timestamp and connection state
     */
    updateClientActivity(id: string, isPing: boolean = false) {
        const client = this.clients.get(id);
        if (client) {
            const now = Date.now();
            client.lastActivity = now;
            
            if (isPing) {
                client.lastPing = now;
            }
            
            // Update connection state based on activity
            if (client.connectionState === 'idle' || client.connectionState === 'stale') {
                client.connectionState = 'connected';
            }
        }
    }

    /**
     * Send an event to a specific user with enhanced error handling
     * @param userId - The user ID to send the event to
     * @param eventType - The type of event
     * @param data - The event data
     * @param options - Additional options (retry, id, priority, source)
     */
    sendEventToUser(
        userId: string, 
        eventType: string, 
        data: any, 
        options: { 
            retry?: number, 
            id?: string, 
            priority?: SSEEventPriority,
            source?: string,
            useStandardFormat?: boolean 
        } = {}
    ) {
        let sentCount = 0;
        let errorCount = 0;

        for (const client of this.clients.values()) {
            if (client.userId === userId && client.connectionState === 'connected') {
                try {
                    if (options.useStandardFormat !== false) {
                        // Use standardized event format (default)
                        const event = SSEEventBuilder.createEvent(
                            eventType,
                            data,
                            {
                                id: options.id,
                                priority: options.priority || SSEEventPriority.NORMAL,
                                source: options.source || 'server',
                                metadata: {
                                    userId: userId
                                }
                            }
                        );
                        
                        this.sendEvent(client.response, event, client.id);
                    } else {
                        // Use legacy format for backward compatibility
                        this.sendLegacyEvent(
                            client.response,
                            eventType,
                            data,
                            {
                                retry: options.retry,
                                id: options.id
                            },
                            client.id
                        );
                    }
                    sentCount++;
                } catch (error) {
                    errorCount++;
                    console.error(`[SSE] Failed to send event to client ${client.id}:`, error);
                    
                    // Mark client for potential removal if connection is broken
                    client.connectionState = 'stale';
                }
            }
        }

        if (sentCount > 0) {
            console.log(`[SSE] Sent '${eventType}' event to user ${userId} (${sentCount} connections, ${errorCount} errors)`);
        }

        return { sent: sentCount, errors: errorCount };
    }

    /**
     * Broadcast an event to all connected clients
     * @param eventType - The type of event
     * @param data - The event data
     * @param options - Additional options (retry, id)
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
            userIds.add(client.userId);
        }

        // Removed metrics recording to streamline handler

        return this.clients.size;
    }

    /**
     * Send a properly formatted SSE event with standardized format
     */
    private sendEvent(response: any, event: SSEEvent, clientId?: string) {
        try {
            // Use standardized formatter
            const message = SSEMessageFormatter.formatEvent(event);
            
            // Send the formatted message
            response.write(message);
            
            // Update client statistics if clientId provided
            if (clientId) {
                const client = this.clients.get(clientId);
                if (client) {
                    client.eventsSent++;
                    client.lastActivity = Date.now();
                }
            }
        } catch (error) {
            console.error(`[SSE] Error sending event:`, error);
            
            // Update error count if clientId provided
            if (clientId) {
                const client = this.clients.get(clientId);
                if (client) {
                    client.errorsCount++;
                    
                    // Mark client as stale if too many errors
                    if (client.errorsCount > 5) {
                        client.connectionState = 'stale';
                    }
                }
            }
            
            throw error;
        }
    }

    /**
     * Send a legacy-format event (for backward compatibility)
     */
    private sendLegacyEvent(response: any, eventType: string, data: any, options: { retry?: number, id?: string } = {}, clientId?: string) {
        try {
            // Use simple formatter for backward compatibility
            const message = SSEMessageFormatter.formatSimpleMessage(eventType, data, options.id);
            
            // Send the formatted message
            response.write(message);
            
            // Update client statistics if clientId provided
            if (clientId) {
                const client = this.clients.get(clientId);
                if (client) {
                    client.eventsSent++;
                    client.lastActivity = Date.now();
                }
            }
        } catch (error) {
            console.error(`[SSE] Error sending legacy event:`, error);
            
            // Update error count if clientId provided
            if (clientId) {
                const client = this.clients.get(clientId);
                if (client) {
                    client.errorsCount++;
                    
                    // Mark client as stale if too many errors
                    if (client.errorsCount > 5) {
                        client.connectionState = 'stale';
                    }
                }
            }
            
            throw error;
        }
    }

    /**
     * Clean up inactive connections with improved state tracking
     */
    private cleanupInactiveConnections() {
        const now = Date.now();
        const toRemove: { id: string; reason: string }[] = [];
        const toMarkIdle: string[] = [];
        const toMarkStale: string[] = [];

        // Analyze all connections
        for (const [id, client] of this.clients.entries()) {
            const timeSinceActivity = now - client.lastActivity;
            const timeSincePing = now - client.lastPing;
            const timeSinceConnected = now - client.connectedAt;

            // Check for connections that should be removed
            if (timeSinceActivity > this.STALE_TIMEOUT) {
                toRemove.push({ id, reason: 'Stale connection (no activity)' });
            } else if (timeSinceConnected > this.STALE_TIMEOUT && client.eventsSent === 0) {
                toRemove.push({ id, reason: 'Inactive connection (no events sent)' });
            } else if (client.errorsCount > 10) {
                toRemove.push({ id, reason: 'Too many errors' });
            } else if (client.connectionState === 'stale' && timeSinceActivity > this.INACTIVE_TIMEOUT) {
                toRemove.push({ id, reason: 'Stale connection timeout' });
            }
            // Mark connections with different states
            else if (timeSinceActivity > this.INACTIVE_TIMEOUT && client.connectionState === 'connected') {
                toMarkIdle.push(id);
            } else if (timeSincePing > (2 * 60 * 1000) && client.connectionState === 'connected') { // 2 minutes without ping
                toMarkStale.push(id);
            }
        }

        // Update connection states
        toMarkIdle.forEach(id => {
            const client = this.clients.get(id);
            if (client) {
                client.connectionState = 'idle';
            }
        });

        toMarkStale.forEach(id => {
            const client = this.clients.get(id);
            if (client) {
                client.connectionState = 'stale';
            }
        });

        // Remove problematic connections
        if (toRemove.length > 0) {
            console.log(`[SSE] Cleaning up ${toRemove.length} connections (${toMarkIdle.length} marked idle, ${toMarkStale.length} marked stale)`);
            
            toRemove.forEach(({ id, reason }) => {
                this.removeClient(id, reason);
            });
        }

        // Log state summary if there are state changes
        if (toMarkIdle.length > 0 || toMarkStale.length > 0 || toRemove.length > 0) {
            const states = this.getConnectionStates();
            console.log(`[SSE] Connection states:`, states);
        }
    }

    /**
     * Get statistics about current connections with state breakdown
     */
    getStats() {
        const userCounts = new Map<string, number>();
        const stateStats = {
            connecting: 0,
            connected: 0,
            idle: 0,
            stale: 0,
            disconnecting: 0
        };
        
        let totalEventsSent = 0;
        let totalErrors = 0;

        // Count connections per user and analyze states
        for (const client of this.clients.values()) {
            userCounts.set(client.userId, (userCounts.get(client.userId) || 0) + 1);
            stateStats[client.connectionState]++;
            totalEventsSent += client.eventsSent;
            totalErrors += client.errorsCount;
        }

        return {
            totalConnections: this.clients.size,
            uniqueUsers: userCounts.size,
            userCounts: Object.fromEntries(userCounts),
            connectionStates: stateStats,
            performance: {
                totalEventsSent,
                totalErrors,
                errorRate: this.clients.size > 0 ? (totalErrors / totalEventsSent * 100).toFixed(2) + '%' : '0%'
            }
        };
    }

    /**
     * Get connection states summary
     */
    getConnectionStates() {
        const states = { connecting: 0, connected: 0, idle: 0, stale: 0, disconnecting: 0 };
        
        for (const client of this.clients.values()) {
            states[client.connectionState]++;
        }
        
        return states;
    }

    /**
     * Get client information for debugging
     */
    getClientInfo(clientId: string) {
        const client = this.clients.get(clientId);
        if (!client) return null;
        
        const now = Date.now();
        return {
            id: client.id,
            userId: client.userId,
            connectionState: client.connectionState,
            connectedAt: new Date(client.connectedAt).toISOString(),
            duration: `${Math.round((now - client.connectedAt) / 1000)}s`,
            lastActivity: new Date(client.lastActivity).toISOString(),
            timeSinceActivity: `${Math.round((now - client.lastActivity) / 1000)}s`,
            eventsSent: client.eventsSent,
            errorsCount: client.errorsCount,
            metadata: client.metadata
        };
    }

    /**
     * Force cleanup of specific client
     */
    forceDisconnect(clientId: string, reason: string = 'Forced disconnect') {
        this.removeClient(clientId, reason);
    }

    /**
     * Send a health check ping to all connections using standardized format
     */
    sendHealthCheck() {
        const timestamp = Date.now();
        let sent = 0;
        let sequence = 0;
        
        for (const client of this.clients.values()) {
            if (client.connectionState === 'connected') {
                try {
                    const pingEvent = SSEEventBuilder.createPingEvent(client.id, ++sequence);
                    this.sendEvent(client.response, pingEvent, client.id);
                    
                    this.updateClientActivity(client.id, true);
                    sent++;
                } catch (error) {
                    console.error(`[SSE] Health check failed for client ${client.id}:`, error);
                    client.connectionState = 'stale';
                }
            }
        }
        
        console.log(`[SSE] Health check sent to ${sent} clients`);
        return sent;
    }
}

const sseHandler = new SSEHandler();
export default sseHandler;