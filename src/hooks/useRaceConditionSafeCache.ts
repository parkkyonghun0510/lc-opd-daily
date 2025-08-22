/**
 * Race condition safe cache hooks
 * Prevents common race conditions in cache operations
 */

import { useCallback, useRef, useEffect } from 'react';
import { useApiCache } from './useApiCache';
import { raceConditionManager } from '@/lib/sync/race-condition-manager';
import { handleError } from '@/lib/errors/error-handler';
import { createCacheError } from '@/lib/errors/error-classes';
import { CacheErrorCode } from '@/types/errors';

interface SafeCacheOptions {
  preventDuplicateRequests?: boolean;
  requestTimeout?: number;
  maxConcurrentOperations?: number;
  enableSequentialInvalidation?: boolean;
}

export function useRaceConditionSafeCache(options: SafeCacheOptions = {}) {
  const {
    preventDuplicateRequests = true,
    requestTimeout = 30000,
    maxConcurrentOperations = 5,
    enableSequentialInvalidation = true
  } = options;

  const cache = useApiCache();
  const operationCountRef = useRef(0);
  const abortControllersRef = useRef(new Map<string, AbortController>());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort all pending operations
      abortControllersRef.current.forEach(controller => {
        controller.abort();
      });
      abortControllersRef.current.clear();
    };
  }, []);

  const safeGet = useCallback(async <T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttl?: number; force?: boolean } = {}
  ): Promise<T> => {
    const operationKey = `get_${key}`;
    
    try {
      // Check operation limit
      if (operationCountRef.current >= maxConcurrentOperations) {
        throw createCacheError(
          CacheErrorCode.CACHE_CONNECTION_FAILED,
          `Too many concurrent cache operations for key: ${key}`,
          { key }
        );
      }

      operationCountRef.current++;

      const result = await raceConditionManager.preventDuplicateRequest(
        operationKey,
        async (signal) => {
          // Store abort controller
          abortControllersRef.current.set(operationKey, new AbortController());
          
          try {
            // Check if signal is already aborted
            if (signal.aborted) {
              throw createCacheError(
                CacheErrorCode.CACHE_GET_FAILED,
                'Cache get operation was cancelled',
                { key }
              );
            }

            const result = cache.get(key);
            if (result !== null) {
              return result as T;
            }
            
            // If not in cache, use fetcher
            const fetchedData = await fetcher();
            cache.set(key, fetchedData);
            return fetchedData;
          } finally {
            abortControllersRef.current.delete(operationKey);
          }
        },
        {
          timeout: requestTimeout,
          allowConcurrent: !preventDuplicateRequests
        }
      );

      return result;
    } catch (error) {
      handleError(error as Error, {
        userId: undefined,
        sessionId: undefined,
        timestamp: new Date(),
        additionalData: { operation: 'cache_get', key }
      });
      throw error;
    } finally {
      operationCountRef.current--;
    }
  }, [cache, preventDuplicateRequests, requestTimeout, maxConcurrentOperations]);

  const safeSet = useCallback(async <T>(
    key: string,
    value: T,
    ttl?: number
  ): Promise<void> => {
    const operationKey = `set_${key}`;
    
    try {
      operationCountRef.current++;

      await raceConditionManager.withStateLock(
        operationKey,
        'cache_set',
        async () => {
          cache.set(key, value);
        return Promise.resolve();
        },
        5000
      );
    } catch (error) {
      handleError(error as Error, {
        userId: undefined,
        sessionId: undefined,
        timestamp: new Date(),
        additionalData: { operation: 'cache_set', key }
      });
      throw error;
    } finally {
      operationCountRef.current--;
    }
  }, [cache]);

  const safeInvalidate = useCallback(async (
    pattern: string | RegExp
  ): Promise<void> => {
    const operationKey = `invalidate_${pattern.toString()}`;
    
    try {
      operationCountRef.current++;

      if (enableSequentialInvalidation) {
        await raceConditionManager.executeInSequence(
          operationKey,
          async () => {
            // Only support string patterns for now
            if (typeof pattern === 'string') {
              cache.invalidate(pattern);
            }
            return Promise.resolve();
          },
          { timeout: requestTimeout, maxConcurrentOperations: 1 }
        );
      } else {
        await raceConditionManager.withStateLock(
          operationKey,
          'cache_invalidate',
          async () => {
            // Only support string patterns for now
            if (typeof pattern === 'string') {
              cache.invalidate(pattern);
            }
            return Promise.resolve();
          },
          5000
        );
      }
    } catch (error) {
      handleError(error as Error, {
        userId: undefined,
        sessionId: undefined,
        timestamp: new Date(),
        additionalData: { operation: 'cache_invalidate', pattern: pattern.toString() }
      });
      throw error;
    } finally {
      operationCountRef.current--;
    }
  }, [cache, enableSequentialInvalidation, requestTimeout]);

  const safeClear = useCallback(async (): Promise<void> => {
    const operationKey = 'clear_all';
    
    try {
      operationCountRef.current++;

      await raceConditionManager.executeInSequence(
        operationKey,
        async () => {
          cache.clear();
          return Promise.resolve();
        },
        { timeout: requestTimeout, maxConcurrentOperations: 1 }
      );
    } catch (error) {
      handleError(error as Error, {
        userId: undefined,
        sessionId: undefined,
        timestamp: new Date(),
        additionalData: { operation: 'cache_clear' }
      });
      throw error;
    } finally {
      operationCountRef.current--;
    }
  }, [cache, requestTimeout]);

  const batchInvalidate = useCallback(async (
    patterns: (string | RegExp)[],
    options: { batchSize?: number; delay?: number } = {}
  ): Promise<void> => {
    const { batchSize = 3, delay = 100 } = options;
    
    try {
      operationCountRef.current++;

      const operations = patterns.map(pattern => 
        () => {
          // Only support string patterns for now
           if (typeof pattern === 'string') {
             cache.invalidate(pattern);
           }
           return Promise.resolve();
        }
      );

      await raceConditionManager.batchOperations(
        operations,
        { batchSize, delay, failFast: false }
      );
    } catch (error) {
      handleError(error as Error, {
        userId: undefined,
        sessionId: undefined,
        timestamp: new Date(),
        additionalData: { operation: 'cache_batch_invalidate', patterns: patterns.length }
      });
      throw error;
    } finally {
      operationCountRef.current--;
    }
  }, [cache]);

  const cancelAllOperations = useCallback(() => {
    abortControllersRef.current.forEach(controller => {
      controller.abort();
    });
    abortControllersRef.current.clear();
    operationCountRef.current = 0;
  }, []);

  const getOperationStatus = useCallback(() => {
    return {
      activeOperations: operationCountRef.current,
      pendingOperations: Array.from(abortControllersRef.current.keys()),
      canStartNewOperation: operationCountRef.current < maxConcurrentOperations
    };
  }, [maxConcurrentOperations]);

  return {
    // Safe cache operations
    get: safeGet,
    set: safeSet,
    invalidate: safeInvalidate,
    clear: safeClear,
    batchInvalidate,
    
    // Control functions
    cancelAllOperations,
    getOperationStatus,
    
    // Original cache state (read-only)
    // Cache size not available in current interface
    size: 0
  };
}

// Hook for sequential cache operations
export function useSequentialCache() {
  const cache = useApiCache();
  
  const executeSequentially = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    return raceConditionManager.executeInSequence(
      `cache_sequential_${operationName}`,
      operation,
      { timeout: 30000, maxConcurrentOperations: 1 }
    );
  }, []);

  const sequentialGet = useCallback(async <T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttl?: number; force?: boolean } = {}
  ): Promise<T> => {
    return executeSequentially(
      () => {
        const result = cache.get(key);
        if (result !== null) {
          return Promise.resolve(result as T);
        }
        
        // If not in cache, use fetcher
        return fetcher().then(data => {
          cache.set(key, data);
          return data;
        });
      },
      `get_${key}`
    );
  }, [cache, executeSequentially]);

  const sequentialSet = useCallback(async <T>(
    key: string,
    value: T,
    ttl?: number
  ): Promise<void> => {
    return executeSequentially(
      () => {
        cache.set(key, value);
        return Promise.resolve();
      },
      `set_${key}`
    );
  }, [cache, executeSequentially]);

  const sequentialInvalidate = useCallback(async (
    pattern: string | RegExp
  ): Promise<void> => {
    return executeSequentially(
      () => {
        if (typeof pattern === 'string') {
          cache.invalidate(pattern);
        }
        return Promise.resolve();
      },
      `invalidate_${pattern.toString()}`
    );
  }, [cache, executeSequentially]);

  return {
    get: sequentialGet,
    set: sequentialSet,
    invalidate: sequentialInvalidate,
    executeSequentially,
    
    // Original cache state
    // Cache size not available in current interface
    size: 0
  };
}

// Hook for debounced cache operations
export function useDebouncedCache(delay: number = 300) {
  const cache = useApiCache();
  
  const debouncedSet = useCallback(
    raceConditionManager.debounce(
      async <T>(key: string, value: T) => {
        cache.set(key, value);
        return Promise.resolve();
      },
      delay,
      'debounced_cache_set'
    ),
    [cache, delay]
  );

  const debouncedInvalidate = useCallback(
    raceConditionManager.debounce(
      async (pattern: string) => {
        cache.invalidate(pattern);
        return Promise.resolve();
      },
      delay,
      'debounced_cache_invalidate'
    ),
    [cache, delay]
  );

  return {
    get: cache.get,
    set: debouncedSet,
    invalidate: debouncedInvalidate,
    clear: cache.clear,
    
    // Cache stats not available in current interface
    size: 0
  };
}

// Hook for cache operations with automatic retry
export function useRetryableCache(maxRetries: number = 3, retryDelay: number = 1000) {
  const cache = useApiCache();
  
  const retryOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          handleError(lastError, {
            userId: undefined,
            sessionId: undefined,
            timestamp: new Date(),
            additionalData: { 
              operation: operationName, 
              attempt, 
              maxRetries 
            }
          });
          throw lastError;
        }
        
        // Wait before retry with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }, [maxRetries, retryDelay]);

  const retryableGet = useCallback(async <T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttl?: number; force?: boolean } = {}
  ): Promise<T> => {
    return retryOperation(
      () => {
        const result = cache.get(key);
        if (result !== null) {
          return Promise.resolve(result as T);
        }
        
        // If not in cache, use fetcher
        return fetcher().then(data => {
          cache.set(key, data);
          return data;
        });
      },
      `get_${key}`
    );
  }, [cache, retryOperation]);

  const retryableSet = useCallback(async <T>(
    key: string,
    value: T,
    ttl?: number
  ): Promise<void> => {
    return retryOperation(
      () => {
        cache.set(key, value);
        return Promise.resolve();
      },
      `set_${key}`
    );
  }, [cache, retryOperation]);

  const retryableInvalidate = useCallback(async (
    pattern: string | RegExp
  ): Promise<void> => {
    return retryOperation(
      () => {
        if (typeof pattern === 'string') {
          cache.invalidate(pattern);
        }
        return Promise.resolve();
      },
      `invalidate_${pattern.toString()}`
    );
  }, [cache, retryOperation]);

  return {
    get: retryableGet,
    set: retryableSet,
    invalidate: retryableInvalidate,
    clear: () => retryOperation(() => {
      cache.clear();
      return Promise.resolve();
    }, 'clear'),
    
    // Cache stats not available in current interface
    size: 0
  };
}