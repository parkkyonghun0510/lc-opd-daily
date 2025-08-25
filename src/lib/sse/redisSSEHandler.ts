import type { Redis } from 'ioredis'
import { getRedis } from '@/lib/redis'

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
    private redis: Redis | null = null;
    private instanceId: string;
    private pubSubChannel = 'sse-events';
    private pubSubClient: Redis | null = null;
    private isSubscribed = false;

    constructor() {
        // Generate a unique ID for this server instance
        this.instanceId = `instance-${crypto.randomUUID()}`;
        
        // Start the cleanup interval to remove stale connections
        this.cleanupInterval = setInterval(() => this.cleanupInactiveConnections(), 60000);
        
        // Async initialize Redis clients using centralized singleton
        (async () => {
            try {
                this.redis = await getRedis();
                // Create a dedicated pub/sub connection by duplicating
                const dup = (this.redis as any).duplicate ? (this.redis as any).duplicate() : null;
                if (dup) {
                    this.pubSubClient = dup as Redis;
                    // Attach basic listeners for visibility
                    this.pubSubClient.on('error', (error: any) => {
                        console.error('[SSE] Redis pub/sub client error:', error);
                    });
                    this.pubSubClient.on('connect', () => {
                        console.log('[SSE] Pub/sub client connected');
                    });
                    this.pubSubClient.on('ready', () => {
                        console.log('[SSE] Pub/sub client ready');
                    });
                    this.pubSubClient.on('close', () => {
                        console.warn('[SSE] Pub/sub client connection closed');
                        this.isSubscribed = false;
                    });
                    this.pubSubClient.on('end', () => {
                        console.warn('[SSE] Pub/sub client connection ended');
                        this.isSubscribed = false;
                    });
                    await (this.pubSubClient as any).connect?.();
                }
                await this.setupPubSub();
            } catch (error) {
                console.warn('[SSE] Failed to initialize Redis clients for SSE handler:', error);
            }
        })();
        
        console.log(`[SSE] Redis-backed SSE handler initialized with instance ID: ${this.instanceId}`);
    }

    /**
     * Set up Redis Pub/Sub for cross-instance communication
     */
    private async setupPubSub() {
        try {
            if (this.isSubscribed) return;

            console.log(`[SSE] Setting up pub/sub subscription to channel: ${this.pubSubChannel}`);
            
            // Ensure pub/sub client is connected
            if (!this.pubSubClient) {
                console.warn('[SSE] Pub/sub client not initialized, skipping subscription');
                return;
            }
            // Ensure pub/sub client is connected
            if ((this.pubSubClient as any).status !== 'ready') {
                await (this.pubSubClient as any).connect?.();
            }
 
             // Subscribe to the channel using proper pub/sub pattern
             await (this.pubSubClient as any).subscribe(this.pubSubChannel);
             
             // Listen for messages using the 'message' event
             this.pubSubClient.on('message', (channel: string, message: string) => {
                 try {
                     if (channel === this.pubSubChannel) {
                         const { sourceInstanceId, event } = JSON.parse(message);
 
                         // Skip messages from this instance to avoid duplicates
                         if (sourceInstanceId === this.instanceId) return;
 
                         // Process the cross-instance event
                         this.processCrossInstanceEvent(event);
                     }
                 } catch (error) {
                     console.error('[SSE] Error processing pub/sub message:', error);
                 }
             });
             
             // Handle subscription confirmation
             this.pubSubClient.on('subscribe', (channel: string, count: number) => {
                 console.log(`[SSE] Successfully subscribed to channel '${channel}' (${count} total subscriptions)`);
                 this.isSubscribed = true;
             });
             
             // Handle unsubscription
             this.pubSubClient.on('unsubscribe', (channel: string, count: number) => {
                 console.log(`[SSE] Unsubscribed from channel '${channel}' (${count} remaining subscriptions)`);
                 if (count === 0) {
                     this.isSubscribed = false;
                 }
             });
 
             console.log('[SSE] Pub/sub setup initiated');
         } catch (error) {
             console.error('[SSE] Failed to subscribe to Redis channels:', error);
             this.isSubscribed = false;
 
             // Retry subscription after a delay with exponential backoff
             const retryDelay = Math.min(5000 * Math.pow(2, Math.random()), 30000);
             console.log(`[SSE] Retrying pub/sub setup in ${retryDelay}ms...`);
             setTimeout(() => this.setupPubSub(), retryDelay);
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
            if (!this.redis || this.redis.status !== 'ready') {
                console.warn('[SSE] Redis not ready, skipping event publishing');
                return;
            }
            const message = JSON.stringify({
                sourceInstanceId: this.instanceId,
                event,
                timestamp: Date.now()
            });
            
            // Use the main Redis client for publishing
            const result = await (this.redis as any).publish(this.pubSubChannel, message);
            console.log(`[SSE] Published event to ${result} subscribers`);
        } catch (error) {
            console.error('[SSE] Error publishing event:', error);
            
            // If publishing fails, try to reconnect the Redis client
            if (error instanceof Error && error.message.includes('Connection is closed')) {
                console.log('[SSE] Attempting to reconnect Redis client for publishing...');
                try {
                    await (this.redis as any)?.connect?.();
                } catch (reconnectError) {
                    console.error('[SSE] Failed to reconnect Redis client:', reconnectError);
                }
            }
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

        // Add to Redis with proper connection checking
        try {
            // Ensure Redis client is connected before attempting operations
            if (!this.redis || this.redis.status !== 'ready') {
                console.warn(`[SSE] Redis client not ready (status: ${this.redis?.status || 'null'}), attempting to connect...`);
                
                if (this.redis && this.redis.status === 'connecting') {
                    // Wait for existing connection attempt
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('Redis connection timeout'));
                        }, 5000);
                        
                        this.redis!.once('ready', () => {
                            clearTimeout(timeout);
                            resolve(void 0);
                        });
                        
                        this.redis!.once('error', (error) => {
                            clearTimeout(timeout);
                            reject(error);
                        });
                    });
                } else if (this.redis) {
                    // Attempt to connect
                    await this.redis.connect();
                }
            }
            
            // Only proceed with Redis operations if client is ready
            if (this.redis && this.redis.status === 'ready') {
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
            } else {
                console.warn(`[SSE] Redis client still not ready after connection attempt, client ${id} added to local map only`);
            }
        } catch (error) {
            console.error('[SSE] Error adding client to Redis:', error);
            // Client is still added to local map, so SSE will work locally even if Redis fails
            console.log(`[SSE] Client ${id} added to local map only due to Redis error. Total local: ${this.clients.size}`);
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

            // Remove from Redis with proper connection checking
            try {
                // Only attempt Redis operations if client is ready
                if (this.redis && this.redis.status === 'ready') {
                    await this.redis.hdel(`sse:clients:${client.userId}`, id);

                    // Update user's active client count
                    await this.redis.hincrby('sse:user-counts', client.userId, -1);
                }

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
                    // Only attempt Redis operations if client is ready
                    if (this.redis && this.redis.status === 'ready') {
                        const clientData = await this.redis.hget(`sse:clients:${client.userId}`, id);
                        if (clientData) {
                            const data = JSON.parse(clientData as string);
                            data.lastActivity = now;
                            await this.redis.hset(`sse:clients:${client.userId}`, {
                                [id]: JSON.stringify(data)
                            });
                        }
                    } else {
                        console.warn(`[SSE] Redis client not ready (status: ${this.redis?.status || 'null'}), skipping activity update for client ${id}`);
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
                // Skip Redis operations if connection isn't ready
                if (!this.redis || this.redis.status !== 'ready') {
                    console.warn('[SSE] Redis not ready, skipping cleanup of orphaned entries');
                    return;
                }

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

            // Get global stats from Redis only if client is ready
            if (this.redis && this.redis.status === 'ready') {
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
            } else {
                console.warn(`[SSE] Redis client not ready (status: ${this.redis?.status || 'null'}), returning local stats only`);
                
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
            if (this.pubSubClient && (this.pubSubClient as any).status === 'ready' && this.isSubscribed) {
                await (this.pubSubClient as any).unsubscribe(this.pubSubChannel);
                await (this.pubSubClient as any).disconnect?.();
            }
            
            if (this.redis && this.redis.status === 'ready') {
                await this.redis.disconnect();
            }
            
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
        redisSSEHandler = new RedisSSEHandler();
    } catch (error) {
        console.warn('[SSE] Failed to initialize Redis SSE handler:', error);
    }
}

// Export the Redis SSE handler if available, otherwise export the in-memory handler
import sseHandler from './sseHandler'
export default redisSSEHandler || sseHandler
