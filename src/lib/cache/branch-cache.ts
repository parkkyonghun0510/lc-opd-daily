import { Redis } from "@upstash/redis";
import { BranchHierarchy } from "@/lib/types/branch";

// Define cache keys
const CACHE_KEYS = {
  BRANCH_HIERARCHY: "branch:hierarchy",
  USER_BRANCHES: (userId: string) => `user:${userId}:branches`,
  BRANCH_ACCESS: (userId: string, branchId: string) =>
    `access:${userId}:${branchId}`,
};

// Cache TTL in seconds
const CACHE_TTL = {
  BRANCH_HIERARCHY: 60 * 60, // 1 hour
  USER_BRANCHES: 30 * 60, // 30 minutes
  BRANCH_ACCESS: 10 * 60, // 10 minutes
};

// Initialize Redis client (singleton pattern)
// This works better with Upstash Redis which is designed for serverless environments
const getRedisClient = () => {
  try {
    // Check if the required environment variables are present
    if (
      !process.env.UPSTASH_REDIS_REST_URL ||
      !process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      console.warn(
        "[Redis Cache] Redis credentials not found. Cache operations will be skipped."
      );
      return null;
    }

    // Use environment variables for Redis configuration
    // Upstash Redis client automatically uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env variables
    return Redis.fromEnv();
  } catch (error) {
    console.error("[Redis Cache] Failed to initialize Redis client:", error);
    return null;
  }
};

// Create a singleton instance
const redis = getRedisClient();

/**
 * Helper function to safely execute Redis operations
 * Returns null if Redis is not configured
 */
const safeRedisOperation = async <T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> => {
  if (!redis) {
    return fallback;
  }

  try {
    return await operation();
  } catch (error) {
    console.error("[Redis Cache] Error executing Redis operation:", error);
    return fallback;
  }
};

/**
 * Sets branch hierarchy in cache
 */
export async function setBranchHierarchyCache(
  hierarchy: BranchHierarchy[]
): Promise<void> {
  await safeRedisOperation(
    () =>
      redis!.set(CACHE_KEYS.BRANCH_HIERARCHY, JSON.stringify(hierarchy), {
        ex: CACHE_TTL.BRANCH_HIERARCHY,
      }),
    undefined
  );
}

/**
 * Gets branch hierarchy from cache
 */
export async function getBranchHierarchyCache(): Promise<
  BranchHierarchy[] | null
> {
  return safeRedisOperation(async () => {
    const data = await redis!.get<string>(CACHE_KEYS.BRANCH_HIERARCHY);
    return data ? JSON.parse(data) : null;
  }, null);
}

/**
 * Sets user branches in cache
 */
export async function setUserBranchesCache(
  userId: string,
  branchIds: string[]
): Promise<void> {
  await safeRedisOperation(
    () =>
      redis!.set(CACHE_KEYS.USER_BRANCHES(userId), JSON.stringify(branchIds), {
        ex: CACHE_TTL.USER_BRANCHES,
      }),
    undefined
  );
}

/**
 * Gets user branches from cache
 */
export async function getUserBranchesCache(
  userId: string
): Promise<string[] | null> {
  return safeRedisOperation(async () => {
    const data = await redis!.get<string>(CACHE_KEYS.USER_BRANCHES(userId));
    return data ? JSON.parse(data) : null;
  }, null);
}

/**
 * Sets branch access check in cache
 */
export async function setBranchAccessCache(
  userId: string,
  branchId: string,
  hasAccess: boolean
): Promise<void> {
  await safeRedisOperation(
    () =>
      redis!.set(
        CACHE_KEYS.BRANCH_ACCESS(userId, branchId),
        hasAccess ? "1" : "0",
        { ex: CACHE_TTL.BRANCH_ACCESS }
      ),
    undefined
  );
}

/**
 * Gets branch access check from cache
 */
export async function getBranchAccessCache(
  userId: string,
  branchId: string
): Promise<boolean | null> {
  return safeRedisOperation(async () => {
    const data = await redis!.get<string>(
      CACHE_KEYS.BRANCH_ACCESS(userId, branchId)
    );
    if (data === null) return null;
    return data === "1";
  }, null);
}

/**
 * Invalidates branch hierarchy cache
 */
export async function invalidateBranchHierarchyCache(): Promise<void> {
  await safeRedisOperation(
    () => redis!.del(CACHE_KEYS.BRANCH_HIERARCHY),
    undefined
  );
}

/**
 * Invalidates branch access caches for a specific user
 */
export async function invalidateUserBranchCaches(
  userId: string
): Promise<void> {
  if (!redis) {
    console.log(
      `[Redis Cache] Skipping cache invalidation for user ${userId} - Redis not configured`
    );
    return;
  }

  // Try to delete the user branches cache first
  await safeRedisOperation(
    () => redis!.del(CACHE_KEYS.USER_BRANCHES(userId)),
    undefined
  );

  // Then try to scan and delete branch access caches
  await safeRedisOperation(async () => {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis!.scan(cursor, {
        match: `access:${userId}:*`,
        count: 100,
      });

      cursor = parseInt(nextCursor);

      if (keys.length > 0) {
        await Promise.all(keys.map((key) => redis!.del(key)));
      }
    } while (cursor !== 0);
    return;
  }, undefined);
}
