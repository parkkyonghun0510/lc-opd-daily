// Dynamic Redis import to avoid bundling issues
let redisInstance: any = null;
let Redis: any = null;

async function getRedisClient() {
  if (!Redis) {
    try {
      const ioredis = await import('ioredis');
      Redis = ioredis.default;
    } catch (error) {
      console.error('Failed to import ioredis:', error);
      return null;
    }
  }
  
  if (!redisInstance && process.env.REDIS_URL) {
    try {
      redisInstance = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      });
    } catch (error) {
      console.error('Failed to create Redis instance:', error);
      return null;
    }
  }
  
  return redisInstance;
}

// Create a proxy that dynamically loads Redis when needed
export const redis = new Proxy({} as any, {
  get(target, prop) {
    return async (...args: any[]) => {
      const client = await getRedisClient();
      if (!client) {
        throw new Error('Redis not configured or failed to initialize');
      }
      return client[prop](...args);
    };
  }
});

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

// Test Redis connection
export async function testRedisConnection() {
  try {
    const client = await getRedisClient();
    if (!client) {
      console.error("❌ Redis connection failed: No client available");
      return false;
    }
    
    // Try to set and get a test value
    await client.set("test:connection", "ok", "EX", 10);
    const testValue = await client.get("test:connection");

    if (testValue !== "ok") {
      throw new Error("Redis test value mismatch");
    }

    //console.log("✅ Redis connection successful");
    return true;
  } catch (error) {
    console.error("❌ Redis connection failed:", error);
    return false;
  }
}

// Helper function to safely interact with Redis
export async function safeRedisOperation<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error("Redis operation failed:", error);
    return fallback;
  }
}
