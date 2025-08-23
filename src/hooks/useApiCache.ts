'use client';

import { useCallback, useMemo } from 'react';
import { apiCacheManager } from '@/lib/cache/cache-manager';

interface UseApiCacheOptions {
  ttl?: number; // Time to live in milliseconds
  tags?: string[];
  enableMetrics?: boolean;
}

interface ApiCacheReturn {
  get: <T = any>(key: string) => T | null;
  set: <T = any>(key: string, data: T, options?: { ttl?: number; tags?: string[] }) => void;
  delete: (key: string) => boolean;
  has: (key: string) => boolean;
  clear: () => void;
  invalidateByPattern: (pattern: string | RegExp) => number;
  invalidateByTags: (tags: string[]) => number;
}

/**
 * Simple API cache hook that provides basic caching functionality
 * Uses the apiCacheManager for consistent caching across the application
 */
export function useApiCache(options: UseApiCacheOptions = {}): ApiCacheReturn {
  const {
    ttl = 300000, // 5 minutes default
    tags = [],
    enableMetrics = false
  } = options;

  const get = useCallback(<T = any>(key: string): T | null => {
    try {
      const cached = apiCacheManager.get(key);
      if (enableMetrics && cached) {
        // Log cache hit if metrics are enabled
        console.debug(`Cache hit for key: ${key}`);
      }
      return cached as T | null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }, [enableMetrics]);

  const set = useCallback(<T = any>(
    key: string, 
    data: T, 
    setOptions: { ttl?: number; tags?: string[] } = {}
  ): void => {
    try {
      const finalTtl = setOptions.ttl ?? ttl;
      const finalTags = [...tags, ...(setOptions.tags || [])];
      
      apiCacheManager.set(key, data, {
        ttl: finalTtl,
        tags: finalTags
      });
      
      if (enableMetrics) {
        console.debug(`Cache set for key: ${key}, TTL: ${finalTtl}ms`);
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }, [ttl, tags, enableMetrics]);

  const deleteKey = useCallback((key: string): boolean => {
    try {
      const result = apiCacheManager.delete(key);
      if (enableMetrics) {
        console.debug(`Cache delete for key: ${key}, success: ${result}`);
      }
      return result;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }, [enableMetrics]);

  const has = useCallback((key: string): boolean => {
    try {
      return apiCacheManager.has(key);
    } catch (error) {
      console.error('Cache has error:', error);
      return false;
    }
  }, []);

  const clear = useCallback((): void => {
    try {
      apiCacheManager.clear();
      if (enableMetrics) {
        console.debug('Cache cleared');
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }, [enableMetrics]);

  const invalidateByPattern = useCallback((pattern: string | RegExp): number => {
    try {
      const count = apiCacheManager.invalidateByPattern(pattern);
      if (enableMetrics) {
        console.debug(`Cache invalidated ${count} entries by pattern:`, pattern);
      }
      return count;
    } catch (error) {
      console.error('Cache invalidate by pattern error:', error);
      return 0;
    }
  }, [enableMetrics]);

  const invalidateByTags = useCallback((tagsToInvalidate: string[]): number => {
    try {
      const count = apiCacheManager.invalidateByTags(tagsToInvalidate);
      if (enableMetrics) {
        console.debug(`Cache invalidated ${count} entries by tags:`, tagsToInvalidate);
      }
      return count;
    } catch (error) {
      console.error('Cache invalidate by tags error:', error);
      return 0;
    }
  }, [enableMetrics]);

  return useMemo(() => ({
    get,
    set,
    delete: deleteKey,
    has,
    clear,
    invalidateByPattern,
    invalidateByTags
  }), [get, set, deleteKey, has, clear, invalidateByPattern, invalidateByTags]);
}

/**
 * Hook for simple key-value caching with automatic TTL
 */
export function useSimpleCache(defaultTtl: number = 300000) {
  return useApiCache({ ttl: defaultTtl });
}

/**
 * Hook for tagged caching with invalidation support
 */
export function useTaggedCache(tags: string[], ttl: number = 300000) {
  return useApiCache({ tags, ttl });
}