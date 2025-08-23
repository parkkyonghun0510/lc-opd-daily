'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSelectiveCacheInvalidation } from './useSelectiveCacheInvalidation';
import { globalCacheManager, apiCacheManager, userCacheManager, branchCacheManager } from '@/lib/cache/cache-manager';
import { handleError } from '@/lib/errors/error-handler';
import { createCacheError } from '@/lib/errors/error-classes';
import { CacheErrorCode } from '@/types/errors';

type CacheManagerType = 'global' | 'api' | 'user' | 'branch';

interface UseAdvancedCacheOptions {
  userId?: string;
  sessionId?: string;
  cacheManager?: CacheManagerType;
  enableSelectiveInvalidation?: boolean;
  enableMetrics?: boolean;
  defaultTTL?: number;
  tags?: string[];
  dependencies?: string[];
}

interface AdvancedCacheReturn {
  // Basic cache operations
  get: <T = any>(key: string) => T | null;
  set: <T = any>(key: string, data: T, options?: {
    ttl?: number;
    tags?: string[];
    dependencies?: string[];
  }) => void;
  delete: (key: string) => boolean;
  has: (key: string) => boolean;
  clear: () => void;
  
  // Advanced operations
  getByTags: (tags: string[]) => Array<{ key: string; data: any }>;
  invalidateByPattern: (pattern: string | RegExp) => number;
  invalidateByTags: (tags: string[]) => number;
  
  // Selective invalidation (if enabled)
  selectiveInvalidation?: ReturnType<typeof useSelectiveCacheInvalidation>;
  
  // Metrics and stats
  getMetrics: () => any;
  getStats: () => {
    size: number;
    hitRate: number;
    totalOperations: number;
  };
  
  // Utility methods
  cleanup: () => number;
  prefetch: <T = any>(key: string, fetcher: () => Promise<T>, options?: {
    ttl?: number;
    tags?: string[];
    dependencies?: string[];
  }) => Promise<T>;
  
  // Batch operations
  batchGet: <T = any>(keys: string[]) => Array<{ key: string; data: T | null }>;
  batchSet: <T = any>(entries: Array<{
    key: string;
    data: T;
    options?: {
      ttl?: number;
      tags?: string[];
      dependencies?: string[];
    };
  }>) => void;
  batchDelete: (keys: string[]) => number;
}

export function useAdvancedCache(options: UseAdvancedCacheOptions = {}): AdvancedCacheReturn {
  const {
    userId = 'anonymous',
    sessionId = 'default',
    cacheManager = 'global',
    enableSelectiveInvalidation = true,
    enableMetrics = true,
    defaultTTL,
    tags = [],
    dependencies = []
  } = options;

  // Get the appropriate cache manager
  const manager = useMemo(() => {
    switch (cacheManager) {
      case 'api': return apiCacheManager;
      case 'user': return userCacheManager;
      case 'branch': return branchCacheManager;
      default: return globalCacheManager;
    }
  }, [cacheManager]);

  // Selective invalidation (optional)
  const selectiveInvalidation = enableSelectiveInvalidation 
    ? useSelectiveCacheInvalidation({ userId, sessionId })
    : undefined;

  // Error handling helper
  const handleCacheError = useCallback(async (error: Error, operation: string, context?: any) => {
    await handleError(error, {
      userId,
      sessionId,
      timestamp: new Date(),
      additionalData: { operation, context, cacheManager }
    });
  }, [userId, sessionId, cacheManager]);

  // Basic cache operations
  const get = useCallback(<T = any>(key: string): T | null => {
    try {
      return manager.get<T>(key);
    } catch (error) {
      handleCacheError(error as Error, 'get', { key });
      return null;
    }
  }, [manager, handleCacheError]);

  const set = useCallback(<T = any>(
    key: string, 
    data: T, 
    setOptions: {
      ttl?: number;
      tags?: string[];
      dependencies?: string[];
    } = {}
  ): void => {
    try {
      const mergedOptions = {
        ttl: setOptions.ttl ?? defaultTTL,
        tags: [...tags, ...(setOptions.tags || [])],
        dependencies: [...dependencies, ...(setOptions.dependencies || [])]
      };
      
      manager.set(key, data, mergedOptions);
    } catch (error) {
      handleCacheError(error as Error, 'set', { key, options: setOptions });
    }
  }, [manager, defaultTTL, tags, dependencies, handleCacheError]);

  const deleteKey = useCallback((key: string): boolean => {
    try {
      return manager.delete(key);
    } catch (error) {
      handleCacheError(error as Error, 'delete', { key });
      return false;
    }
  }, [manager, handleCacheError]);

  const has = useCallback((key: string): boolean => {
    try {
      return manager.has(key);
    } catch (error) {
      handleCacheError(error as Error, 'has', { key });
      return false;
    }
  }, [manager, handleCacheError]);

  const clear = useCallback((): void => {
    try {
      manager.clear();
    } catch (error) {
      handleCacheError(error as Error, 'clear');
    }
  }, [manager, handleCacheError]);

  // Advanced operations
  const getByTags = useCallback((searchTags: string[]): Array<{ key: string; data: any }> => {
    try {
      return manager.getByTags(searchTags);
    } catch (error) {
      handleCacheError(error as Error, 'getByTags', { tags: searchTags });
      return [];
    }
  }, [manager, handleCacheError]);

  const invalidateByPattern = useCallback((pattern: string | RegExp): number => {
    try {
      return manager.invalidateByPattern(pattern);
    } catch (error) {
      handleCacheError(error as Error, 'invalidateByPattern', { pattern: pattern.toString() });
      return 0;
    }
  }, [manager, handleCacheError]);

  const invalidateByTags = useCallback((invalidateTags: string[]): number => {
    try {
      return manager.invalidateByTags(invalidateTags);
    } catch (error) {
      handleCacheError(error as Error, 'invalidateByTags', { tags: invalidateTags });
      return 0;
    }
  }, [manager, handleCacheError]);

  // Metrics and stats
  const getMetrics = useCallback(() => {
    try {
      return manager.getMetrics();
    } catch (error) {
      handleCacheError(error as Error, 'getMetrics');
      return {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        size: 0,
        hitRate: 0
      };
    }
  }, [manager, handleCacheError]);

  const getStats = useCallback(() => {
    try {
      const metrics = manager.getMetrics();
      return {
        size: metrics.size,
        hitRate: metrics.hitRate,
        totalOperations: metrics.hits + metrics.misses + metrics.sets + metrics.deletes
      };
    } catch (error) {
      handleCacheError(error as Error, 'getStats');
      return {
        size: 0,
        hitRate: 0,
        totalOperations: 0
      };
    }
  }, [manager, handleCacheError]);

  // Utility methods
  const cleanup = useCallback((): number => {
    try {
      return manager.cleanup();
    } catch (error) {
      handleCacheError(error as Error, 'cleanup');
      return 0;
    }
  }, [manager, handleCacheError]);

  const prefetch = useCallback(async <T = any>(
    key: string,
    fetcher: () => Promise<T>,
    prefetchOptions: {
      ttl?: number;
      tags?: string[];
      dependencies?: string[];
    } = {}
  ): Promise<T> => {
    try {
      // Check if already cached
      const cached = get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Fetch and cache
      const data = await fetcher();
      set(key, data, prefetchOptions);
      return data;
    } catch (error) {
      await handleCacheError(error as Error, 'prefetch', { key, options: prefetchOptions });
      throw createCacheError(
        CacheErrorCode.CACHE_GET_FAILED,
        `Failed to prefetch data for key: ${key}`,
        {
          key,
          operation: 'prefetch'
        }
      );
    }
  }, [get, set, handleCacheError]);

  // Batch operations
  const batchGet = useCallback(<T = any>(keys: string[]): Array<{ key: string; data: T | null }> => {
    try {
      return keys.map(key => ({
        key,
        data: get<T>(key)
      }));
    } catch (error) {
      handleCacheError(error as Error, 'batchGet', { keys });
      return keys.map(key => ({ key, data: null }));
    }
  }, [get, handleCacheError]);

  const batchSet = useCallback(<T = any>(entries: Array<{
    key: string;
    data: T;
    options?: {
      ttl?: number;
      tags?: string[];
      dependencies?: string[];
    };
  }>): void => {
    try {
      entries.forEach(({ key, data, options }) => {
        set(key, data, options);
      });
    } catch (error) {
      handleCacheError(error as Error, 'batchSet', { entriesCount: entries.length });
    }
  }, [set, handleCacheError]);

  const batchDelete = useCallback((keys: string[]): number => {
    try {
      let deletedCount = 0;
      keys.forEach(key => {
        if (deleteKey(key)) {
          deletedCount++;
        }
      });
      return deletedCount;
    } catch (error) {
      handleCacheError(error as Error, 'batchDelete', { keys });
      return 0;
    }
  }, [deleteKey, handleCacheError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Perform any necessary cleanup
      try {
        cleanup();
      } catch (error) {
        console.warn('Cache cleanup on unmount failed:', error);
      }
    };
  }, [cleanup]);

  return {
    // Basic operations
    get,
    set,
    delete: deleteKey,
    has,
    clear,
    
    // Advanced operations
    getByTags,
    invalidateByPattern,
    invalidateByTags,
    
    // Selective invalidation
    selectiveInvalidation,
    
    // Metrics and stats
    getMetrics,
    getStats,
    
    // Utility methods
    cleanup,
    prefetch,
    
    // Batch operations
    batchGet,
    batchSet,
    batchDelete
  };
}

// Specialized hooks for different use cases with optimized TTL strategies
export function useApiCache(userId?: string) {
  return useAdvancedCache({
    userId,
    cacheManager: 'global', // Using unified cache manager
    tags: ['api'],
    defaultTTL: 5 * 60 * 1000 // 5 minutes
  });
}

export function useUserCache(userId: string) {
  return useAdvancedCache({
    userId,
    cacheManager: 'global', // Using unified cache manager
    tags: ['user', `user:${userId}`],
    defaultTTL: 15 * 60 * 1000 // 15 minutes
  });
}

export function useBranchCache(userId?: string) {
  return useAdvancedCache({
    userId,
    cacheManager: 'global', // Using unified cache manager
    tags: ['branch'],
    defaultTTL: 30 * 60 * 1000 // 30 minutes
  });
}

// Hook for cache-aware data fetching
export function useCacheAwareQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    cacheManager?: CacheManagerType;
    ttl?: number;
    tags?: string[];
    dependencies?: string[];
    enabled?: boolean;
    refetchOnMount?: boolean;
  } = {}
) {
  const {
    cacheManager = 'global',
    ttl,
    tags,
    dependencies,
    enabled = true,
    refetchOnMount = false
  } = options;

  const cache = useAdvancedCache({ cacheManager, defaultTTL: ttl, tags, dependencies });
  const isInitialMount = useRef(true);

  const query = useCallback(async (): Promise<T> => {
    if (!enabled) {
      throw createCacheError(
          CacheErrorCode.CACHE_GET_FAILED,
          'Query is disabled',
          { key, operation: 'get' }
      );
    }

    // Check cache first (unless refetchOnMount is true and it's initial mount)
    if (!(refetchOnMount && isInitialMount.current)) {
      const cached = cache.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    }

    // Fetch and cache
    const data = await fetcher();
    cache.set(key, data, { ttl, tags, dependencies });
    
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
    
    return data;
  }, [key, fetcher, enabled, refetchOnMount, cache, ttl, tags, dependencies]);

  const invalidate = useCallback(() => {
    cache.delete(key);
  }, [cache, key]);

  const refresh = useCallback(async (): Promise<T> => {
    cache.delete(key); // Force refresh
    return query();
  }, [cache, key, query]);

  return {
    query,
    invalidate,
    refresh,
    cache
  };
}