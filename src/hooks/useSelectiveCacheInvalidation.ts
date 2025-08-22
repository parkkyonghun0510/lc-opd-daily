'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useApiCache } from './useApiCache';
import { 
  selectiveCacheInvalidator,
  CACHE_DEPENDENCIES,
  INVALIDATION_RULES,
  type CacheDependency,
  type InvalidationRule,
  type CacheInvalidationOptions
} from '@/lib/cache/selective-invalidation';
import { handleError } from '@/lib/errors/error-handler';
import { createCacheError } from '@/lib/errors/error-classes';
import { CacheErrorCode } from '@/types/errors';

interface UseSelectiveCacheInvalidationOptions {
  userId?: string;
  sessionId?: string;
  autoRegisterDependencies?: boolean;
  enableBatchInvalidation?: boolean;
  defaultInvalidationOptions?: CacheInvalidationOptions;
}

interface SelectiveCacheInvalidationReturn {
  // Dependency management
  registerDependency: (dependency: CacheDependency) => void;
  unregisterDependency: (key: string) => void;
  getDependentKeys: (key: string) => string[];
  
  // Invalidation methods
  invalidateByKey: (key: string, options?: CacheInvalidationOptions) => Promise<void>;
  invalidateByKeys: (keys: string[], options?: CacheInvalidationOptions) => Promise<void>;
  invalidateByTags: (tags: string[], options?: CacheInvalidationOptions) => Promise<void>;
  invalidateByPattern: (pattern: string | RegExp, options?: CacheInvalidationOptions) => Promise<void>;
  invalidateByRules: (rules: InvalidationRule[], options?: CacheInvalidationOptions) => Promise<void>;
  
  // Predefined invalidation methods
  invalidateBranchCaches: (options?: CacheInvalidationOptions) => Promise<void>;
  invalidateUserCaches: (userId: string, options?: CacheInvalidationOptions) => Promise<void>;
  invalidateApiCaches: (endpoint: string, options?: CacheInvalidationOptions) => Promise<void>;
  invalidateLowPriorityCaches: (options?: CacheInvalidationOptions) => Promise<void>;
  
  // Utility methods
  getStats: () => ReturnType<typeof selectiveCacheInvalidator.getStats>;
  clear: () => void;
  
  // Status
  isProcessing: boolean;
  queueLength: number;
}

export function useSelectiveCacheInvalidation(
  options: UseSelectiveCacheInvalidationOptions = {}
): SelectiveCacheInvalidationReturn {
  const {
    userId = 'anonymous',
    sessionId = 'default',
    autoRegisterDependencies = true,
    enableBatchInvalidation = true,
    defaultInvalidationOptions = {}
  } = options;

  const cache = useApiCache();
  
  // Auto-register common dependencies
  useEffect(() => {
    if (!autoRegisterDependencies) return;

    try {
      // Register branch hierarchy dependency
      selectiveCacheInvalidator.registerDependency(CACHE_DEPENDENCIES.BRANCH_HIERARCHY);
      
      // Register user-specific dependencies if userId is provided
      if (userId && userId !== 'anonymous') {
        selectiveCacheInvalidator.registerDependency(CACHE_DEPENDENCIES.USER_BRANCHES(userId));
        selectiveCacheInvalidator.registerDependency(CACHE_DEPENDENCIES.USER_PROFILE(userId));
      }
    } catch (error) {
      handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'auto-register-dependencies' }
      });
    }
  }, [userId, sessionId, autoRegisterDependencies]);

  // Dependency management methods
  const registerDependency = useCallback((dependency: CacheDependency) => {
    try {
      selectiveCacheInvalidator.registerDependency(dependency);
    } catch (error) {
      handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'register-dependency', key: dependency.key }
      });
    }
  }, [userId, sessionId]);

  const unregisterDependency = useCallback((key: string) => {
    try {
      selectiveCacheInvalidator.unregisterDependency(key);
    } catch (error) {
      handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'unregister-dependency', key }
      });
    }
  }, [userId, sessionId]);

  const getDependentKeys = useCallback((key: string): string[] => {
    try {
      return selectiveCacheInvalidator.getDependentKeys(key);
    } catch (error) {
      handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'get-dependent-keys', key }
      });
      return [];
    }
  }, [userId, sessionId]);

  // Core invalidation method that integrates with the actual cache
  const performCacheInvalidation = useCallback(async (
    keys: string[],
    options: CacheInvalidationOptions = {}
  ): Promise<void> => {
    const mergedOptions = { ...defaultInvalidationOptions, ...options };
    
    if (mergedOptions.dryRun) {
      console.log('[DRY RUN] Would invalidate cache keys:', keys);
      return;
    }

    try {
      // Invalidate keys individually (batch invalidation not available in current cache interface)
      for (const key of keys) {
        await cache.invalidate(key);
      }
    } catch (error) {
      throw createCacheError(
        CacheErrorCode.CACHE_INVALIDATION_FAILED,
        `Failed to invalidate cache keys: ${keys.join(', ')}`,
        {
          operation: 'invalidate',
          context: { keys, options: mergedOptions }
        }
      );
    }
  }, [cache, enableBatchInvalidation, defaultInvalidationOptions]);

  // Individual invalidation methods
  const invalidateByKey = useCallback(async (
    key: string,
    options: CacheInvalidationOptions = {}
  ): Promise<void> => {
    try {
      const keysToInvalidate = [key];
      
      if (options.cascade) {
        const dependentKeys = selectiveCacheInvalidator.getDependentKeys(key);
        keysToInvalidate.push(...dependentKeys);
      }
      
      await performCacheInvalidation(keysToInvalidate, options);
    } catch (error) {
      await handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'invalidate-by-key', key, options }
      });
    }
  }, [userId, sessionId, performCacheInvalidation]);

  const invalidateByKeys = useCallback(async (
    keys: string[],
    options: CacheInvalidationOptions = {}
  ): Promise<void> => {
    try {
      let keysToInvalidate = [...keys];
      
      if (options.cascade) {
        const allDependentKeys = new Set<string>();
        keys.forEach(key => {
          const dependentKeys = selectiveCacheInvalidator.getDependentKeys(key);
          dependentKeys.forEach(depKey => allDependentKeys.add(depKey));
        });
        keysToInvalidate.push(...Array.from(allDependentKeys));
      }
      
      await performCacheInvalidation(keysToInvalidate, options);
    } catch (error) {
      await handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'invalidate-by-keys', keys, options }
      });
    }
  }, [userId, sessionId, performCacheInvalidation]);

  const invalidateByTags = useCallback(async (
    tags: string[],
    options: CacheInvalidationOptions = {}
  ): Promise<void> => {
    try {
      const keys = selectiveCacheInvalidator.getKeysByTags(tags);
      await invalidateByKeys(keys, options);
    } catch (error) {
      await handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'invalidate-by-tags', tags, options }
      });
    }
  }, [userId, sessionId, invalidateByKeys]);

  const invalidateByPattern = useCallback(async (
    pattern: string | RegExp,
    options: CacheInvalidationOptions = {}
  ): Promise<void> => {
    try {
      const keys = selectiveCacheInvalidator.getKeysByPattern(pattern);
      await invalidateByKeys(keys, options);
    } catch (error) {
      await handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'invalidate-by-pattern', pattern: pattern.toString(), options }
      });
    }
  }, [userId, sessionId, invalidateByKeys]);

  const invalidateByRules = useCallback(async (
    rules: InvalidationRule[],
    options: CacheInvalidationOptions = {}
  ): Promise<void> => {
    try {
      const keys = selectiveCacheInvalidator.applyInvalidationRules(rules);
      await performCacheInvalidation(keys, options);
    } catch (error) {
      await handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'invalidate-by-rules', rulesCount: rules.length, options }
      });
    }
  }, [userId, sessionId, performCacheInvalidation]);

  // Predefined invalidation methods
  const invalidateBranchCaches = useCallback(async (
    options: CacheInvalidationOptions = {}
  ): Promise<void> => {
    await invalidateByRules(INVALIDATION_RULES.BRANCH_UPDATE, options);
  }, [invalidateByRules]);

  const invalidateUserCaches = useCallback(async (
    targetUserId: string,
    options: CacheInvalidationOptions = {}
  ): Promise<void> => {
    await invalidateByRules(INVALIDATION_RULES.USER_UPDATE(targetUserId), options);
  }, [invalidateByRules]);

  const invalidateApiCaches = useCallback(async (
    endpoint: string,
    options: CacheInvalidationOptions = {}
  ): Promise<void> => {
    await invalidateByRules(INVALIDATION_RULES.API_UPDATE(endpoint), options);
  }, [invalidateByRules]);

  const invalidateLowPriorityCaches = useCallback(async (
    options: CacheInvalidationOptions = {}
  ): Promise<void> => {
    await invalidateByRules(INVALIDATION_RULES.CLEANUP_LOW_PRIORITY, options);
  }, [invalidateByRules]);

  // Utility methods
  const getStats = useCallback(() => {
    return selectiveCacheInvalidator.getStats();
  }, []);

  const clear = useCallback(() => {
    try {
      selectiveCacheInvalidator.clear();
    } catch (error) {
      handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'clear-invalidator' }
      });
    }
  }, [userId, sessionId]);

  // Memoized stats for performance
  const stats = useMemo(() => getStats(), [getStats]);

  return {
    // Dependency management
    registerDependency,
    unregisterDependency,
    getDependentKeys,
    
    // Invalidation methods
    invalidateByKey,
    invalidateByKeys,
    invalidateByTags,
    invalidateByPattern,
    invalidateByRules,
    
    // Predefined invalidation methods
    invalidateBranchCaches,
    invalidateUserCaches,
    invalidateApiCaches,
    invalidateLowPriorityCaches,
    
    // Utility methods
    getStats,
    clear,
    
    // Status
    isProcessing: stats.isProcessing,
    queueLength: stats.queueLength
  };
}

// Convenience hooks for specific use cases
export function useBranchCacheInvalidation(userId?: string) {
  const invalidation = useSelectiveCacheInvalidation({ userId });
  
  const invalidateForBranchUpdate = useCallback(async (branchId?: string) => {
    if (branchId && userId) {
      // Register branch access dependency if not already registered
      invalidation.registerDependency(CACHE_DEPENDENCIES.BRANCH_ACCESS(userId, branchId));
    }
    
    await invalidation.invalidateBranchCaches({ cascade: true });
  }, [invalidation, userId]);
  
  return {
    ...invalidation,
    invalidateForBranchUpdate
  };
}

export function useUserCacheInvalidation(userId: string) {
  const invalidation = useSelectiveCacheInvalidation({ userId });
  
  const invalidateForUserUpdate = useCallback(async () => {
    await invalidation.invalidateUserCaches(userId, { cascade: true });
  }, [invalidation, userId]);
  
  const invalidateForProfileUpdate = useCallback(async () => {
    await invalidation.invalidateByTags([`user:${userId}`, 'profile'], { cascade: false });
  }, [invalidation, userId]);
  
  return {
    ...invalidation,
    invalidateForUserUpdate,
    invalidateForProfileUpdate
  };
}

export function useApiCacheInvalidation() {
  const invalidation = useSelectiveCacheInvalidation();
  
  const invalidateForApiUpdate = useCallback(async (endpoint: string) => {
    await invalidation.invalidateApiCaches(endpoint, { cascade: false });
  }, [invalidation]);
  
  const invalidateForDataMutation = useCallback(async (affectedEndpoints: string[]) => {
    for (const endpoint of affectedEndpoints) {
      await invalidation.invalidateApiCaches(endpoint, { cascade: true });
    }
  }, [invalidation]);
  
  return {
    ...invalidation,
    invalidateForApiUpdate,
    invalidateForDataMutation
  };
}