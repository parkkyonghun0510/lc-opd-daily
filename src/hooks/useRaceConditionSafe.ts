'use client';

import { useRaceConditionSafeAuth, useSequentialAuth, useDebouncedAuth } from './useRaceConditionSafeAuth';
import { useRaceConditionSafeCache, useSequentialCache, useDebouncedCache, useRetryableCache } from './useRaceConditionSafeCache';
import { useRaceConditionSafeSSE, useSequentialSSE, useDebouncedSSE, useRetryableSSE } from './useRaceConditionSafeSSE';
import { HybridRealtimeOptions } from '@/hooks/useHybridRealtime';
import { useCallback } from 'react';

interface RaceConditionSafeOptions {
  auth?: {
    enableSequential?: boolean;
    enableDebounced?: boolean;
    enableRetryable?: boolean;
    debounceDelay?: number;
    maxRetries?: number;
  };
  cache?: {
    enableSequential?: boolean;
    enableDebounced?: boolean;
    enableRetryable?: boolean;
    debounceDelay?: number;
    maxRetries?: number;
  };
  sse?: {
    enableSequential?: boolean;
    enableDebounced?: boolean;
    enableRetryable?: boolean;
    debounceDelay?: number;
    maxRetries?: number;
    options?: HybridRealtimeOptions;
  };
}

/**
 * Comprehensive hook that provides race-condition-safe operations for authentication,
 * cache management, and SSE connections with configurable protection strategies.
 * 
 * @param options Configuration options for different protection strategies
 * @returns Object containing all race-condition-safe hooks and utilities
 */
export function useRaceConditionSafe(options: RaceConditionSafeOptions = {}) {
  const {
    auth: authOptions = {},
    cache: cacheOptions = {},
    sse: sseOptions = {}
  } = options;

  // Authentication hooks
  const safeAuth = useRaceConditionSafeAuth();
  const sequentialAuth = authOptions.enableSequential ? useSequentialAuth() : null;
  const debouncedAuth = authOptions.enableDebounced ? useDebouncedAuth(authOptions.debounceDelay) : null;

  // Cache hooks
  const safeCache = useRaceConditionSafeCache();
  const sequentialCache = cacheOptions.enableSequential ? useSequentialCache() : null;
  const debouncedCache = cacheOptions.enableDebounced ? useDebouncedCache(cacheOptions.debounceDelay) : null;
  const retryableCache = cacheOptions.enableRetryable ? useRetryableCache(cacheOptions.maxRetries) : null;

  // SSE hooks
  const safeSSE = useRaceConditionSafeSSE(sseOptions.options);
  const sequentialSSE = sseOptions.enableSequential ? useSequentialSSE(sseOptions.options) : null;
  const debouncedSSE = sseOptions.enableDebounced ? useDebouncedSSE(sseOptions.options, sseOptions.debounceDelay) : null;
  const retryableSSE = sseOptions.enableRetryable ? useRetryableSSE(sseOptions.options, sseOptions.maxRetries) : null;

  // Utility functions for coordinated operations
  const performSafeOperation = useCallback(async (
    operation: () => Promise<void>,
    operationType: 'auth' | 'cache' | 'sse',
    strategy: 'safe' | 'sequential' | 'debounced' | 'retryable' = 'safe'
  ) => {
    try {
      await operation();
    } catch (error) {
      console.error(`Race condition safe ${operationType} operation (${strategy}) failed:`, error);
      throw error;
    }
  }, []);

  const performBatchOperation = useCallback(async (
    operations: Array<{
      operation: () => Promise<void>;
      type: 'auth' | 'cache' | 'sse';
      strategy?: 'safe' | 'sequential' | 'debounced' | 'retryable';
    }>
  ) => {
    const results = await Promise.allSettled(
      operations.map(({ operation, type, strategy = 'safe' }) =>
        performSafeOperation(operation, type, strategy)
      )
    );

    const failures = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ result, index }) => ({
        index,
        operation: operations[index],
        error: (result as PromiseRejectedResult).reason
      }));

    if (failures.length > 0) {
      console.error('Batch operation failures:', failures);
      throw new Error(`${failures.length} operations failed out of ${operations.length}`);
    }
  }, [performSafeOperation]);

  return {
    // Authentication
    auth: {
      safe: safeAuth,
      sequential: sequentialAuth,
      debounced: debouncedAuth
    },

    // Cache
    cache: {
      safe: safeCache,
      sequential: sequentialCache,
      debounced: debouncedCache,
      retryable: retryableCache
    },

    // SSE
    sse: {
      safe: safeSSE,
      sequential: sequentialSSE,
      debounced: debouncedSSE,
      retryable: retryableSSE
    },

    // Utility functions
    utils: {
      performSafeOperation,
      performBatchOperation
    }
  };
}

/**
 * Hook that provides basic race-condition-safe operations without additional strategies.
 * Suitable for most common use cases.
 */
export function useBasicRaceConditionSafe() {
  return useRaceConditionSafe({
    auth: { enableSequential: false, enableDebounced: false },
    cache: { enableSequential: false, enableDebounced: false, enableRetryable: false },
    sse: { enableSequential: false, enableDebounced: false, enableRetryable: false }
  });
}

/**
 * Hook that provides comprehensive race-condition-safe operations with all strategies enabled.
 * Suitable for complex applications with high concurrency requirements.
 */
export function useComprehensiveRaceConditionSafe() {
  return useRaceConditionSafe({
    auth: {
      enableSequential: true,
      enableDebounced: true,
      debounceDelay: 300
    },
    cache: {
      enableSequential: true,
      enableDebounced: true,
      enableRetryable: true,
      debounceDelay: 200,
      maxRetries: 2
    },
    sse: {
      enableSequential: true,
      enableDebounced: true,
      enableRetryable: true,
      debounceDelay: 500,
      maxRetries: 5
    }
  });
}

export default useRaceConditionSafe;