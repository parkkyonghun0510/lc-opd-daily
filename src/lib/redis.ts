import { Redis } from "@upstash/redis";

// Create a Redis client
export const redis = new Redis({
  url: process.env.REDIS_URL || "",
  token: process.env.REDIS_TOKEN || "",
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
    // Try to set and get a test value
    await redis.set("test:connection", "ok", { ex: 10 });
    const testValue = await redis.get("test:connection");

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
  fallback: T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error("Redis operation failed:", error);
    return fallback;
  }
}
