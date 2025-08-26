import type { Redis } from 'ioredis';

// Separate connection instances for different purposes
let redis: Redis | null = null;                    // For regular cache operations
let pubSubRedis: Redis | null = null;              // For pub/sub operations only
let isConnecting = false;
let isPubSubConnecting = false;
let connectionRetries = 0;
const MAX_CONNECTION_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

/**
 * Get Redis client instance with enhanced error handling
 */
export async function getRedis(): Promise<Redis> {
  if (!redis && !isConnecting) {
    isConnecting = true;
    
    try {
      const { default: IORedis } = await import('ioredis');
      
      // Railway-compatible Redis URL configuration
      const redisUrl = process.env.DRAGONFLY_URL || process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error('DRAGONFLY_URL or REDIS_URL environment variable is required');
      }
      
      // Railway environment detection
      const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
      
      // Railway-optimized Redis configuration
      const redisConfig = {
        lazyConnect: true,
        maxRetriesPerRequest: isRailway ? 2 : 5,
        enableOfflineQueue: false,
        connectTimeout: isRailway ? 15000 : 10000, // Longer timeout on Railway
        commandTimeout: isRailway ? 8000 : 5000,
        family: 4, // Force IPv4 to avoid DNS resolution issues
        keepAlive: isRailway ? 30000 : 0, // Keep connections alive on Railway
        retryDelayOnFailover: 100,
        ...(isRailway && {
          // Railway-specific optimizations
          enableReadyCheck: true,
        })
      };
      
      redis = new IORedis(redisUrl, redisConfig);
      
      // Add comprehensive error handling
      redis.on('error', (error) => {
        console.error('[Redis] Connection error:', error);
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          console.error('[Redis] DNS resolution failed. Check DRAGONFLY_URL hostname.');
        }
      });
      
      redis.on('connect', () => {
        console.log('[Redis] Connected successfully');
        connectionRetries = 0;
      });
      
      redis.on('ready', () => {
        console.log('[Redis] Ready to accept commands');
      });
      
      redis.on('close', () => {
        console.warn('[Redis] Connection closed');
      });
      
      redis.on('reconnecting', (delay: number) => {
        console.log(`[Redis] Reconnecting in ${delay}ms...`);
      });
      
      redis.on('end', () => {
        console.warn('[Redis] Connection ended');
        redis = null;
      });

      // Explicitly establish the connection when lazyConnect is true
      // This prevents: "Stream isn't writeable and enableOfflineQueue options is false"
      await redis.connect();
      
    } catch (error) {
      console.error('[Redis] Failed to initialize client:', error);
      redis = null;
      throw error;
    } finally {
      isConnecting = false;
    }
  }
  
  // Wait for connection if still connecting
  while (isConnecting) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (!redis) {
    throw new Error('Failed to initialize Redis client');
  }
  
  return redis;
}

// Export the getRedis function as the main export
export { getRedis as redis };

/**
 * Get Redis client instance specifically for pub/sub operations
 * This connection will be in subscriber mode and cannot execute regular commands
 */
export async function getRedisPubSub(): Promise<Redis> {
  if (!pubSubRedis && !isPubSubConnecting) {
    isPubSubConnecting = true;
    
    try {
      const { default: IORedis } = await import('ioredis');
      
      // Railway-compatible Redis URL configuration
      const redisUrl = process.env.DRAGONFLY_URL || process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error('DRAGONFLY_URL or REDIS_URL environment variable is required for pub/sub');
      }
      
      // Railway environment detection
      const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
      
      // Railway-optimized Redis configuration for pub/sub
      const redisConfig = {
        lazyConnect: true,
        maxRetriesPerRequest: isRailway ? 2 : 5,
        enableOfflineQueue: false,
        connectTimeout: isRailway ? 15000 : 10000,
        commandTimeout: isRailway ? 8000 : 5000,
        family: 4, // Force IPv4 to avoid DNS resolution issues
        keepAlive: isRailway ? 30000 : 0,
        retryDelayOnFailover: 100,
        ...(isRailway && {
          enableReadyCheck: true,
        })
      };
      
      pubSubRedis = new IORedis(redisUrl, redisConfig);
      
      // Add error handling for pub/sub connection
      pubSubRedis.on('error', (error) => {
        console.error('[Redis PubSub] Connection error:', error);
      });
      
      pubSubRedis.on('connect', () => {
        console.log('[Redis PubSub] Connected successfully');
      });
      
      pubSubRedis.on('ready', () => {
        console.log('[Redis PubSub] Ready for pub/sub operations');
      });
      
      pubSubRedis.on('close', () => {
        console.warn('[Redis PubSub] Connection closed');
      });
      
      pubSubRedis.on('end', () => {
        console.warn('[Redis PubSub] Connection ended');
        pubSubRedis = null;
      });

      // Explicitly establish the connection
      await pubSubRedis.connect();
      
    } catch (error) {
      console.error('[Redis PubSub] Failed to initialize client:', error);
      pubSubRedis = null;
      throw error;
    } finally {
      isPubSubConnecting = false;
    }
  }
  
  // Wait for connection if still connecting
  while (isPubSubConnecting) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (!pubSubRedis) {
    throw new Error('Failed to initialize Redis pub/sub client');
  }
  
  return pubSubRedis;
}

/**
 * Gracefully close Redis connections
 */
export async function closeRedis(): Promise<void> {
  const promises = [];
  
  if (redis) {
    promises.push(
      redis.quit().then(() => {
        console.log('[Redis] Cache connection closed gracefully');
        redis = null;
      }).catch(error => {
        console.error('[Redis] Error closing cache connection:', error);
        redis = null;
      })
    );
  }
  
  if (pubSubRedis) {
    promises.push(
      pubSubRedis.quit().then(() => {
        console.log('[Redis PubSub] Connection closed gracefully');
        pubSubRedis = null;
      }).catch(error => {
        console.error('[Redis PubSub] Error closing connection:', error);
        pubSubRedis = null;
      })
    );
  }
  
  await Promise.all(promises);
}

/**
 * Get Redis connection status for both cache and pub/sub connections
 */
export function getRedisStatus(): { 
  cache: { connected: boolean; status: string };
  pubsub: { connected: boolean; status: string };
} {
  return {
    cache: {
      connected: redis?.status === 'ready',
      status: redis?.status || 'not_initialized'
    },
    pubsub: {
      connected: pubSubRedis?.status === 'ready',
      status: pubSubRedis?.status || 'not_initialized'
    }
  };
}

// Cache TTL in seconds
export const CACHE_TTL = {
  STATS: 5 * 60, // 5 minutes
  CHARTS: 15 * 60, // 15 minutes
};

// Cache keys
export const CACHE_KEYS = {
  DASHBOARD_STATS: "dashboard:stats",
  DASHBOARD_CHARTS: "dashboard:charts",
};

/**
 * Test Redis connection with retry logic
 */
export async function testRedisConnection(): Promise<boolean> {
  let attempts = 0;
  
  while (attempts < MAX_CONNECTION_RETRIES) {
    try {
      const client = await getRedis();
      await client.ping();
      console.log(`[Redis] Connection test successful (attempt ${attempts + 1})`);
      return true;
    } catch (error) {
      attempts++;
      console.error(`[Redis] Connection test failed (attempt ${attempts}/${MAX_CONNECTION_RETRIES}):`, error);
      
      if (attempts < MAX_CONNECTION_RETRIES) {
        console.log(`[Redis] Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        // Reset redis instance to force reconnection
        redis = null;
      }
    }
  }
  
  return false;
}

/**
 * Execute Redis operation with enhanced error handling and retries
 */
export async function safeRedisOperation<T>(
  operation: (redis: Redis) => Promise<T>,
  fallback?: T,
  maxRetries: number = 3
): Promise<T | null> {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      const client = await getRedis();
      return await operation(client);
    } catch (error) {
      attempts++;
      console.error(`[Redis] Operation failed (attempt ${attempts}/${maxRetries}):`, error);
      
      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('Connection in subscriber mode')) {
          console.error('[Redis] ❌ CRITICAL: Connection in subscriber mode detected!');
          console.error('[Redis] This means you\'re trying to use a pub/sub connection for cache operations');
          console.error('[Redis] Use getRedis() for cache operations, getRedisPubSub() for pub/sub');
          console.error('[Redis] Error details:', error.message);
          break; // Don't retry subscriber mode errors
        }
        
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          console.error('[Redis] DNS resolution error - check DRAGONFLY_URL hostname');
          break; // Don't retry DNS errors
        }
        
        if (error.message.includes('MaxRetriesPerRequestError')) {
          console.error('[Redis] Max retries exceeded - Redis server may be unavailable');
        }
        
        if (error.message.includes('Connection is closed')) {
          console.warn('[Redis] Connection closed, resetting client');
          redis = null; // Force reconnection
        }
      }
      
      if (attempts < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000); // Exponential backoff
        console.log(`[Redis] Retrying operation in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`[Redis] Operation failed after ${maxRetries} attempts, using fallback`);
  return fallback ?? null;
}
