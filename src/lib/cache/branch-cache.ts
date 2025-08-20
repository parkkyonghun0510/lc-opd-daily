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

// Dynamic Redis import to avoid bundling issues
let redisInstance: any = null;
let Redis: any = null;

const getRedisClient = async () => {
  if (!Redis) {
    try {
      const ioredis = await import('ioredis');
      Redis = ioredis.default;
    } catch (error) {
      console.error('Failed to import ioredis:', error);
      return null;
    }
  }
  
  if (!redisInstance && process.env.DRAGONFLY_URL) {
    try {
      redisInstance = new Redis(process.env.DRAGONFLY_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 5,
        enableOfflineQueue: false,
        connectTimeout: 10000,
        commandTimeout: 5000,
        family: 4, // Force IPv4 to avoid DNS resolution issues
      });
      
      // Add comprehensive error handling
      redisInstance.on('error', (error: Error) => {
        console.error('[BranchCache] Redis error:', error);
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          console.error('[BranchCache] DNS resolution failed. Check DRAGONFLY_URL hostname.');
        }
      });
      
      redisInstance.on('connect', () => {
        console.log('[BranchCache] Redis connected successfully');
      });
      
      redisInstance.on('ready', () => {
        console.log('[BranchCache] Redis ready to accept commands');
      });
      
      redisInstance.on('close', () => {
        console.warn('[BranchCache] Redis connection closed');
      });
      
      redisInstance.on('end', () => {
        console.warn('[BranchCache] Redis connection ended');
      });
      
    } catch (error) {
      console.error('Failed to create Redis instance:', error);
      return null;
    }
  }
  
  return redisInstance;
};

/**
 * Helper function to safely execute Redis operations
 * Returns null if Redis is not configured
 */
const safeRedisOperation = async <T>(
  operation: (client: any) => Promise<T>,
  fallback: T
): Promise<T> => {
  const client = await getRedisClient();
  if (!client) {
    return fallback;
  }

  try {
    return await operation(client);
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
    (client) =>
      client.setex(CACHE_KEYS.BRANCH_HIERARCHY, CACHE_TTL.BRANCH_HIERARCHY, JSON.stringify(hierarchy)),
    undefined
  );
}

/**
 * Gets branch hierarchy from cache
 */
export async function getBranchHierarchyCache(): Promise<
  BranchHierarchy[] | null
> {
  return safeRedisOperation(async (client) => {
    const data = await client.get(CACHE_KEYS.BRANCH_HIERARCHY);
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
    (client) =>
      client.setex(CACHE_KEYS.USER_BRANCHES(userId), CACHE_TTL.USER_BRANCHES, JSON.stringify(branchIds)),
    undefined
  );
}

/**
 * Gets user branches from cache
 */
export async function getUserBranchesCache(
  userId: string
): Promise<string[] | null> {
  return safeRedisOperation(async (client) => {
    const data = await client.get(CACHE_KEYS.USER_BRANCHES(userId));
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
    (client) =>
      client.setex(
        CACHE_KEYS.BRANCH_ACCESS(userId, branchId),
        CACHE_TTL.BRANCH_ACCESS,
        hasAccess ? "1" : "0"
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
  return safeRedisOperation(async (client) => {
    const data = await client.get(
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
    (client) => client.del(CACHE_KEYS.BRANCH_HIERARCHY),
    undefined
  );
}

/**
 * Invalidates branch access caches for a specific user
 */
export async function invalidateUserBranchCaches(
  userId: string
): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    console.log(
    `[Redis Cache] Skipping cache invalidation for user ${userId} - Redis not configured`
    );
    return;
  }

  // Try to delete the user branches cache first
  await safeRedisOperation(
    (client) => client.del(CACHE_KEYS.USER_BRANCHES(userId)),
    undefined
  );

  // Then try to scan and delete branch access caches
  await safeRedisOperation(async (client) => {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `access:${userId}:*`, 'COUNT', 100);

      cursor = parseInt(nextCursor);

      if (keys.length > 0) {
        await Promise.all(keys.map((key: string) => client.del(key)));
      }
    } while (cursor !== 0);
    return;
  }, undefined);
}
