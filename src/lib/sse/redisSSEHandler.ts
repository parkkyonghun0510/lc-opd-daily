import Redis from 'ioredis';
import { NextResponse } from "next/server";

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
    instanceId: string;
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
 * Redis-backed SSE Handler for multi-instance support
 *
 * This handler uses Redis to track clients across multiple server instances,
 * allowing for broadcasting events to all connected clients regardless of
 * which server instance they're connected to.
 */
class RedisSSEHandler {
    private clients: Map<string, Client> = new Map();
    private readonly INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    private cleanupInterval: NodeJS.Timeout | null = null;
    private redis: Redis;
    private instanceId: string;
    private pubSubChannel = 'sse-events';
    private pubSubClient: Redis;
    private isSubscribed = false;

    constructor(redisUrl: string) {
        // Create Redis client for operations
        this.redis = new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 3,
        });

        // Create a separate Redis client for pub/sub
        this.pubSubClient = new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 3,
        });

        // Generate a unique ID for this server instance
        this.instanceId = `instance-${crypto.randomUUID()}`;

        // Start the cleanup interval to remove stale connections
        this.cleanupInterval = setInterval(() => this.cleanupInactiveConnections(), 60000);

        // Subscribe to the pub/sub channel for cross-instance events
        this.setupPubSub();

        console.log(`[SSE] Redis-backed SSE handler initialized with instance ID: ${this.instanceId}`);
    }

    /**
     * Set up Redis Pub/Sub for cross-instance communication
     */
    private async setupPubSub() {
        try {
            if (this.isSubscribed) return;

            // Subscribe to the channel
            await this.pubSubClient.subscribe(this.pubSubChannel);

            // Poll for messages
            const pollMessages = async () => {
                while (this.isSubscribed) {
                    try {
                        const message = await this.pubSubClient.get(this.pubSubChannel);
                        if (message) {
                            const { sourceInstanceId, event } = JSON.parse(message as string);

                            // Skip messages from this instance to avoid duplicates
                            if (sourceInstanceId === this.instanceId) continue;

                            // Process the cross-instance event
                            this.processCrossInstanceEvent(event);
                        }
                        // Small delay to prevent tight polling
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (error) {
                        console.error('[SSE] Error processing pub/sub message:', error);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            };

            // Start polling
            pollMessages();

            this.isSubscribed = true;
            console.log('[SSE] Successfully subscribed to Redis pub/sub channel');
        } catch (error) {
            console.error('[SSE] Error setting up Redis pub/sub:', error);

            // Retry subscription after a delay
            setTimeout(() => this.setupPubSub(), 5000);
        }
    }

    /**
     * Process an event received from another instance
     */
    private processCrossInstanceEvent(event: any) {
        try {
            const { userId, eventType, data } = event;

            // Ensure the event data has a proper structure
            const eventData = {
                ...data,
                id: data.id || crypto.randomUUID(),
                timestamp: data.timestamp || Date.now()
            };

            // If the event is for a specific user, send it only to that user
            if (userId) {
                // Find local clients for this user
                for (const client of this.clients.values()) {
                    if (client.userId === userId) {
                        this.sendEvent(client.response, { type: eventType, data: eventData });
                    }
                }
            }
            // If no userId, it's a broadcast event
            else {
                // Send to all local clients
                for (const client of this.clients.values()) {
                    this.sendEvent(client.response, { type: eventType, data: eventData });
                }
            }
        } catch (error) {
            console.error('[SSE] Error processing cross-instance event:', error);
        }
    }

    /**
     * Publish an event to Redis for cross-instance communication
     */
    private async publishEvent(event: any) {
        try {
            await this.redis.publish(this.pubSubChannel, JSON.stringify({
                sourceInstanceId: this.instanceId,
                timestamp: Date.now(),
                event
            }));
        } catch (error) {
            console.error('[SSE] Error publishing event to Redis:', error);
        }
    }

    /**
     * Add a new client connection
     */
    async addClient(id: string, userId: string, response: any, metadata?: Record<string, any>) {
        const now = Date.now();
        const client: Client = {
            id,
            userId,
            response,
            connectedAt: now,
            lastActivity: now,
            metadata,
            instanceId: this.instanceId
        };

        // Add to local map
        this.clients.set(id, client);

        // Add to Redis
        try {
            await this.redis.hset(`sse:clients:${userId}`, {
                [id]: JSON.stringify({
                    id,
                    userId,
                    connectedAt: now,
                    lastActivity: now,
                    metadata,
                    instanceId: this.instanceId
                })
            });

            // Update user's active client count
            await this.redis.hincrby('sse:user-counts', userId, 1);

            console.log(`[SSE] Client connected: ${id} for user: ${userId}. Total local: ${this.clients.size}`);
        } catch (error) {
            console.error('[SSE] Error adding client to Redis:', error);
        }

        return id;
    }

    /**
     * Remove a client connection
     */
    async removeClient(id: string) {
        const client = this.clients.get(id);
        if (client) {
            // Remove from local map
            this.clients.delete(id);

            // Remove from Redis
            try {
                await this.redis.hdel(`sse:clients:${client.userId}`, id);

                // Update user's active client count
                await this.redis.hincrby('sse:user-counts', client.userId, -1);

                const duration = Math.round((Date.now() - client.connectedAt) / 1000);
                console.log(`[SSE] Client disconnected: ${id} for user: ${client.userId}. Duration: ${duration}s. Total local: ${this.clients.size}`);
            } catch (error) {
                console.error('[SSE] Error removing client from Redis:', error);
            }
        }
    }

    /**
     * Update client's last activity timestamp
     */
    async updateClientActivity(id: string) {
        const client = this.clients.get(id);
        if (client) {
            const now = Date.now();

            // Update local map
            client.lastActivity = now;

            // Update Redis (less frequently to reduce Redis operations)
            // Only update Redis every 5 minutes or so
            const timeSinceLastUpdate = now - client.lastActivity;
            if (timeSinceLastUpdate > 300000) { // 5 minutes
                try {
                    const clientData = await this.redis.hget(`sse:clients:${client.userId}`, id);
                    if (clientData) {
                        const data = JSON.parse(clientData as string);
                        data.lastActivity = now;
                        await this.redis.hset(`sse:clients:${client.userId}`, {
                            [id]: JSON.stringify(data)
                        });
                    }
                } catch (error) {
                    console.error('[SSE] Error updating client activity in Redis:', error);
                }
            }
        }
    }

    /**
     * Send an event to a specific user
     */
    async sendEventToUser(userId: string, eventType: string, data: any) {
        let localSentCount = 0;

        // Ensure the event has a unique ID and timestamp
        const eventData = {
            ...data,
            id: data.id || crypto.randomUUID(),
            timestamp: data.timestamp || Date.now()
        };

        // Send to local clients
        for (const client of this.clients.values()) {
            if (client.userId === userId) {
                this.sendEvent(client.response, { type: eventType, data: eventData });
                localSentCount++;
            }
        }

        // Publish to Redis for other instances
        await this.publishEvent({
            userId,
            eventType,
            data: eventData
        });

        if (localSentCount > 0) {
            console.log(`[SSE] Sent '${eventType}' event to user ${userId} (${localSentCount} local connections)`);
        }

        return localSentCount;
    }

    /**
     * Broadcast an event to all connected clients
     */
    async broadcastEvent(eventType: string, data: any) {
        // Ensure the event has a unique ID and timestamp
        const eventData = {
            ...data,
            id: data.id || crypto.randomUUID(),
            timestamp: data.timestamp || Date.now()
        };

        // Send to all local clients
        for (const client of this.clients.values()) {
            this.sendEvent(client.response, { type: eventType, data: eventData });
        }

        // Publish to Redis for other instances
        await this.publishEvent({
            eventType,
            data: eventData
        });

        console.log(`[SSE] Broadcast '${eventType}' event to all clients (${this.clients.size} local)`);

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
        } catch (error) {
            console.error(`[SSE] Error sending event:`, error);
        }
    }

    /**
     * Clean up inactive connections
     */
    private async cleanupInactiveConnections() {
        const now = Date.now();
        const inactiveIds: string[] = [];

        // Find inactive local connections
        for (const [id, client] of this.clients.entries()) {
            if (now - client.lastActivity > this.INACTIVE_TIMEOUT) {
                inactiveIds.push(id);
            }
        }

        // Remove inactive local connections
        if (inactiveIds.length > 0) {
            console.log(`[SSE] Cleaning up ${inactiveIds.length} inactive local connections`);

            for (const id of inactiveIds) {
                await this.removeClient(id);
            }
        }

        // Clean up orphaned Redis entries (less frequently)
        // This is a more expensive operation, so do it less often
        if (Math.random() < 0.1) { // 10% chance each time
            try {
                // Get all user IDs with active connections
                const userCounts = await this.redis.hgetall('sse:user-counts');

                // For each user with 0 connections, clean up their client entries
                const entries = userCounts ? Object.entries(userCounts) : [];
                for (const [userId, count] of entries) {
                    if (parseInt(count as string, 10) <= 0) {
                        await this.redis.del(`sse:clients:${userId}`);
                        await this.redis.hdel('sse:user-counts', userId);
                        console.log(`[SSE] Cleaned up Redis entries for user ${userId} with no active connections`);
                    }
                }
            } catch (error) {
                console.error('[SSE] Error cleaning up Redis entries:', error);
            }
        }
    }

    /**
     * Get statistics about current connections
     */
    async getStats() {
        try {
            // Get local stats
            const localUserCounts = new Map<string, number>();
            for (const client of this.clients.values()) {
                localUserCounts.set(client.userId, (localUserCounts.get(client.userId) || 0) + 1);
            }

            // Get global stats from Redis
            const globalUserCounts = await this.redis.hgetall('sse:user-counts');

            // Count total connections across all instances
            let totalConnections = 0;
            const values = globalUserCounts ? Object.values(globalUserCounts) : [];
            for (const count of values) {
                totalConnections += parseInt(count as string, 10);
            }

            return {
                instanceId: this.instanceId,
                localConnections: this.clients.size,
                localUniqueUsers: localUserCounts.size,
                localUserCounts: Object.fromEntries(localUserCounts),
                globalUniqueUsers: globalUserCounts ? Object.keys(globalUserCounts).length : 0,
                globalTotalConnections: totalConnections,
                globalUserCounts: globalUserCounts
            };
        } catch (error) {
            console.error('[SSE] Error getting stats from Redis:', error);

            // Fall back to local stats only
            const localUserCounts = new Map<string, number>();
            for (const client of this.clients.values()) {
                localUserCounts.set(client.userId, (localUserCounts.get(client.userId) || 0) + 1);
            }

            return {
                instanceId: this.instanceId,
                localConnections: this.clients.size,
                localUniqueUsers: localUserCounts.size,
                localUserCounts: Object.fromEntries(localUserCounts),
                globalUniqueUsers: 'unavailable',
                globalTotalConnections: 'unavailable',
                globalUserCounts: 'unavailable'
            };
        }
    }

    /**
     * Shutdown the handler and clean up resources
     */
    async shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Close all local connections
        for (const id of this.clients.keys()) {
            await this.removeClient(id);
        }

        // Unsubscribe from Redis pub/sub
        try {
            // Stop message polling
            this.isSubscribed = false;
            this.isSubscribed = false;
        } catch (error) {
            console.error('[SSE] Error unsubscribing from Redis pub/sub:', error);
        }

        console.log(`[SSE] Handler shutdown complete`);
    }
}

// Create a singleton instance if Redis is configured
let redisSSEHandler: RedisSSEHandler | null = null;

// Initialize the Redis SSE handler if Redis is configured and not in build mode
if (
    process.env.DRAGONFLY_URL &&
    (process.env.NODE_ENV !== 'production' || 
    process.env.NEXT_PHASE !== 'phase-production-build')
) {
    try {
        const redisUrl = process.env.DRAGONFLY_URL;
        
        if (redisUrl) {
            redisSSEHandler = new RedisSSEHandler(redisUrl);
        }
    } catch (error) {
        console.warn('[SSE] Failed to initialize Redis SSE handler:', error);
    }
}

// Export the Redis SSE handler if available, otherwise export the in-memory handler
import sseHandler from './sseHandler';
export default redisSSEHandler || sseHandler;
