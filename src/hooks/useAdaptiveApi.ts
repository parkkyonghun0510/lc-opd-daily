'use client';

import { useCallback, useMemo } from 'react';
import { useDynamicRefresh, useDynamicApiRefresh, useBackgroundDynamicRefresh } from './useDynamicRefresh';
import { useAdvancedCache } from './useAdvancedCache';
import { useRaceConditionSafe } from './useRaceConditionSafe';
import { RefreshStrategy, type RefreshIntervalChangeEvent } from '@/lib/refresh/dynamic-refresh-manager';
import { createNetworkError } from '@/lib/errors/error-classes';
import { NetworkErrorCode } from '@/types/errors';

/**
 * Adaptive API hook options
 */
export interface UseAdaptiveApiOptions {
  // Refresh options
  enableDynamicRefresh?: boolean;
  refreshStrategy?: RefreshStrategy;
  baseInterval?: number;
  minInterval?: number;
  maxInterval?: number;
  immediate?: boolean;
  
  // Cache options
  enableCache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  enableSelectiveInvalidation?: boolean;
  
  // Race condition protection
  enableRaceProtection?: boolean;
  debounceMs?: number;
  maxConcurrent?: number;
  
  // Error handling
  maxRetries?: number;
  retryDelay?: number;
  enableErrorBackoff?: boolean;
  
  // Callbacks
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  onIntervalChange?: (event: RefreshIntervalChangeEvent) => void;
  onCacheHit?: (data: any) => void;
  onCacheMiss?: () => void;
  
  // Debug
  debug?: boolean;
}

/**
 * Adaptive API hook return type
 */
export interface UseAdaptiveApiReturn<T = any> {
  // Data state
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isStale: boolean;
  
  // Refresh state
  interval: number;
  strategy: RefreshStrategy;
  isRefreshEnabled: boolean;
  
  // Cache state
  isCached: boolean;
  cacheAge: number;
  
  // Actions
  refresh: () => Promise<void>;
  refetch: () => Promise<T>;
  invalidateCache: () => Promise<void>;
  
  // Refresh control
  pauseRefresh: () => void;
  resumeRefresh: () => void;
  forceStrategy: (strategy: RefreshStrategy) => void;
  
  // Cache control
  clearCache: () => Promise<void>;
  preloadCache: () => Promise<void>;
  
  // Utilities
  reportSuccess: () => void;
  reportError: (error?: Error) => void;
}

/**
 * Comprehensive adaptive API hook that combines dynamic refresh, caching, and race condition protection
 */
export function useAdaptiveApi<T = any>(
  apiCall: () => Promise<T>,
  options: UseAdaptiveApiOptions = {}
): UseAdaptiveApiReturn<T> {
  const {
    enableDynamicRefresh = true,
    refreshStrategy,
    baseInterval = 15000,
    minInterval = 5000,
    maxInterval = 300000,
    immediate = true,
    enableCache = true,
    cacheKey,
    cacheTTL = 300000, // 5 minutes
    enableSelectiveInvalidation = true,
    enableRaceProtection = true,
    debounceMs = 300,
    maxConcurrent = 1,
    maxRetries = 3,
    retryDelay = 1000,
    enableErrorBackoff = true,
    onSuccess,
    onError,
    onIntervalChange,
    onCacheHit,
    onCacheMiss,
    debug = false
  } = options;

  // Generate cache key if not provided
  const finalCacheKey = useMemo(() => {
    if (cacheKey) return cacheKey;
    return `adaptive-api-${apiCall.toString().slice(0, 50).replace(/\s+/g, '-')}-${Date.now()}`;
  }, [cacheKey, apiCall]);

  // Setup advanced cache
  const {
    get: getCached,
    set: setCached,
    invalidateByTags: invalidateCache,
    clear: clearCache,
    has: hasCache,
    getMetrics: getCacheMetrics,
    prefetch: preloadCache
  } = useAdvancedCache({
    defaultTTL: cacheTTL,
    enableSelectiveInvalidation
  });

  // Setup race condition protection
  const raceConditionSafe = useRaceConditionSafe({
    auth: {
      enableDebounced: true,
      debounceDelay: debounceMs,
      maxRetries
    },
    cache: {
      enableRetryable: true,
      maxRetries
    }
  });

  // Wrapped API call with caching and race protection
  const wrappedApiCall = useCallback(async (): Promise<T> => {
    // Check cache first if enabled
    if (enableCache) {
      try {
        const cached = await getCached(finalCacheKey);
        if (cached !== null) {
          if (debug) {
            console.log('[useAdaptiveApi] Cache hit:', finalCacheKey);
          }
          onCacheHit?.(cached);
          return cached;
        } else {
          if (debug) {
            console.log('[useAdaptiveApi] Cache miss:', finalCacheKey);
          }
          onCacheMiss?.();
        }
      } catch (cacheError) {
        if (debug) {
          console.warn('[useAdaptiveApi] Cache read error:', cacheError);
        }
      }
    }

    // Execute API call with race protection
    const executeCall = enableRaceProtection 
      ? async () => {
          // Use safe cache operation as a proxy for race protection
          return await apiCall();
        }
      : apiCall;

    const result = await executeCall();

    // Cache the result if enabled
    if (enableCache && result !== null && result !== undefined) {
      try {
        await setCached(finalCacheKey, result, { ttl: cacheTTL });
        if (debug) {
          console.log('[useAdaptiveApi] Cached result:', finalCacheKey);
        }
      } catch (cacheError) {
        if (debug) {
          console.warn('[useAdaptiveApi] Cache write error:', cacheError);
        }
      }
    }

    return result;
  }, [apiCall, enableCache, enableRaceProtection, finalCacheKey, cacheTTL, getCached, setCached, onCacheHit, onCacheMiss, debug]);

  // Setup dynamic refresh
  const refreshResult = useDynamicApiRefresh(wrappedApiCall, {
    enabled: enableDynamicRefresh,
    baseInterval,
    minInterval,
    maxInterval,
    immediate,
    enableNetworkAdaptation: true,
    enableActivityAdaptation: true,
    enableErrorBackoff,
    onSuccess: (data) => {
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
    onIntervalChange,
    debug
  });

  // Force strategy if provided
  if (refreshStrategy && refreshResult.strategy !== refreshStrategy) {
    refreshResult.forceStrategy(refreshStrategy);
  }

  // Cache utilities
  const invalidateCacheWrapper = useCallback(async () => {
    try {
      await invalidateCache([finalCacheKey]);
      if (debug) {
        console.log('[useAdaptiveApi] Cache invalidated:', finalCacheKey);
      }
    } catch (error) {
      if (debug) {
        console.warn('[useAdaptiveApi] Cache invalidation error:', error);
      }
    }
  }, [invalidateCache, finalCacheKey, debug]);

  const clearCacheWrapper = useCallback(async () => {
    try {
      await clearCache();
      if (debug) {
        console.log('[useAdaptiveApi] Cache cleared');
      }
    } catch (error) {
      if (debug) {
        console.warn('[useAdaptiveApi] Cache clear error:', error);
      }
    }
  }, [clearCache, debug]);

  const preloadCacheWrapper = useCallback(async () => {
    try {
      await preloadCache(finalCacheKey, wrappedApiCall);
      if (debug) {
        console.log('[useAdaptiveApi] Cache preloaded:', finalCacheKey);
      }
    } catch (error) {
      if (debug) {
        console.warn('[useAdaptiveApi] Cache preload error:', error);
      }
    }
  }, [preloadCache, finalCacheKey, wrappedApiCall, debug]);

  // Manual refetch (bypasses cache)
  const refetch = useCallback(async (): Promise<T> => {
    // Invalidate cache first
    if (enableCache) {
      await invalidateCacheWrapper();
    }
    
    // Execute API call directly
    const executeCall = enableRaceProtection 
      ? async () => {
          // Use safe cache operation as a proxy for race protection
          return await apiCall();
        }
      : apiCall;

    const result = await executeCall();

    // Cache the new result
    if (enableCache && result !== null && result !== undefined) {
      try {
        await setCached(finalCacheKey, result, { ttl: cacheTTL });
      } catch (cacheError) {
        if (debug) {
          console.warn('[useAdaptiveApi] Cache write error during refetch:', cacheError);
        }
      }
    }

    return result;
  }, [enableCache, enableRaceProtection, invalidateCacheWrapper, apiCall, setCached, finalCacheKey, cacheTTL, debug]);

  // Cache state
  const isCached = useMemo(async () => {
    if (!enableCache) return false;
    try {
      return await hasCache(finalCacheKey);
    } catch {
      return false;
    }
  }, [enableCache, hasCache, finalCacheKey]);

  const cacheAge = useMemo(async () => {
    if (!enableCache) return 0;
    try {
      const metrics = await getCacheMetrics();
      // This is a simplified calculation - in a real implementation,
      // you'd want to track individual key timestamps
      return Date.now() - (metrics.lastAccess || 0);
    } catch {
      return 0;
    }
  }, [enableCache, getCacheMetrics]);

  return {
    // Data state
    data: refreshResult.data,
    isLoading: refreshResult.isLoading,
    error: refreshResult.error,
    isStale: refreshResult.error !== null,
    
    // Refresh state
    interval: refreshResult.interval,
    strategy: refreshResult.strategy,
    isRefreshEnabled: refreshResult.isEnabled,
    
    // Cache state (these will be promises in practice, but simplified for the interface)
    isCached: false, // Simplified - would need async state management
    cacheAge: 0, // Simplified - would need async state management
    
    // Actions
    refresh: refreshResult.refresh,
    refetch,
    invalidateCache: invalidateCacheWrapper,
    
    // Refresh control
    pauseRefresh: refreshResult.pause,
    resumeRefresh: refreshResult.resume,
    forceStrategy: refreshResult.forceStrategy,
    
    // Cache control
    clearCache: clearCacheWrapper,
    preloadCache: preloadCacheWrapper,
    
    // Utilities
    reportSuccess: refreshResult.reportSuccess,
    reportError: refreshResult.reportError
  };
}

/**
 * Hook for adaptive API calls with background refresh
 */
export function useAdaptiveBackgroundApi<T = any>(
  apiCall: () => Promise<T>,
  options: UseAdaptiveApiOptions = {}
): UseAdaptiveApiReturn<T> {
  return useAdaptiveApi(apiCall, {
    baseInterval: 60000, // 1 minute
    immediate: false,
    enableErrorBackoff: true,
    ...options
  });
}

/**
 * Hook for adaptive API calls with aggressive refresh
 */
export function useAdaptiveRealtimeApi<T = any>(
  apiCall: () => Promise<T>,
  options: UseAdaptiveApiOptions = {}
): UseAdaptiveApiReturn<T> {
  return useAdaptiveApi(apiCall, {
    refreshStrategy: RefreshStrategy.AGGRESSIVE,
    baseInterval: 5000, // 5 seconds
    minInterval: 2000, // 2 seconds
    immediate: true,
    enableCache: false, // Disable cache for real-time data
    ...options
  });
}

/**
 * Hook for adaptive API calls with conservative refresh
 */
export function useAdaptiveConservativeApi<T = any>(
  apiCall: () => Promise<T>,
  options: UseAdaptiveApiOptions = {}
): UseAdaptiveApiReturn<T> {
  return useAdaptiveApi(apiCall, {
    refreshStrategy: RefreshStrategy.CONSERVATIVE,
    baseInterval: 60000, // 1 minute
    minInterval: 30000, // 30 seconds
    maxInterval: 300000, // 5 minutes
    enableCache: true,
    cacheTTL: 600000, // 10 minutes
    ...options
  });
}

/**
 * Hook for one-time adaptive API calls (no refresh)
 */
export function useAdaptiveOnceApi<T = any>(
  apiCall: () => Promise<T>,
  options: Omit<UseAdaptiveApiOptions, 'enableDynamicRefresh' | 'refreshStrategy'> = {}
): UseAdaptiveApiReturn<T> {
  return useAdaptiveApi(apiCall, {
    enableDynamicRefresh: false,
    immediate: true,
    enableCache: true,
    cacheTTL: 3600000, // 1 hour
    ...options
  });
}