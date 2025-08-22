import type { Redis } from 'ioredis';

let redis: Redis | null = null;
let isConnecting = false;
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
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
      console.log('[Redis] Connection closed gracefully');
    } catch (error) {
      console.error('[Redis] Error closing connection:', error);
    } finally {
      redis = null;
    }
  }
}

/**
 * Get Redis connection status
 */
export function getRedisStatus(): { connected: boolean; status: string } {
  if (!redis) {
    return { connected: false, status: 'not_initialized' };
  }
  
  return {
    connected: redis.status === 'ready',
    status: redis.status
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
