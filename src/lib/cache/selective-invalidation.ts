'use client';

import { handleError } from '@/lib/errors/error-handler';
import { createCacheError } from '@/lib/errors/error-classes';

interface CacheDependency {
  key: string;
  dependsOn: string[];
  tags: string[];
  ttl?: number;
  priority: 'high' | 'medium' | 'low';
}

interface InvalidationRule {
  pattern: string | RegExp;
  tags?: string[];
  cascade?: boolean;
  condition?: (key: string, data: any) => boolean;
}

interface CacheInvalidationOptions {
  cascade?: boolean;
  dryRun?: boolean;
  batchSize?: number;
  delay?: number;
  priority?: 'high' | 'medium' | 'low';
}

class SelectiveCacheInvalidator {
  private dependencies = new Map<string, CacheDependency>();
  private reverseDependencies = new Map<string, Set<string>>();
  private tagIndex = new Map<string, Set<string>>();
  private invalidationQueue: Array<{ key: string; options: CacheInvalidationOptions }> = [];
  private isProcessing = false;

  /**
   * Register a cache dependency relationship
   */
  registerDependency(dependency: CacheDependency): void {
    this.dependencies.set(dependency.key, dependency);

    // Build reverse dependency index
    dependency.dependsOn.forEach(parentKey => {
      if (!this.reverseDependencies.has(parentKey)) {
        this.reverseDependencies.set(parentKey, new Set());
      }
      this.reverseDependencies.get(parentKey)!.add(dependency.key);
    });

    // Build tag index
    dependency.tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(dependency.key);
    });
  }

  /**
   * Remove a dependency registration
   */
  unregisterDependency(key: string): void {
    const dependency = this.dependencies.get(key);
    if (!dependency) return;

    // Clean up reverse dependencies
    dependency.dependsOn.forEach(parentKey => {
      const children = this.reverseDependencies.get(parentKey);
      if (children) {
        children.delete(key);
        if (children.size === 0) {
          this.reverseDependencies.delete(parentKey);
        }
      }
    });

    // Clean up tag index
    dependency.tags.forEach(tag => {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    });

    this.dependencies.delete(key);
  }

  /**
   * Get all keys that depend on a given key
   */
  getDependentKeys(key: string, visited = new Set<string>()): string[] {
    if (visited.has(key)) return [];
    visited.add(key);

    const directDependents = this.reverseDependencies.get(key) || new Set();
    const allDependents = Array.from(directDependents);

    // Recursively get dependents of dependents
    directDependents.forEach(dependentKey => {
      allDependents.push(...this.getDependentKeys(dependentKey, visited));
    });

    return [...new Set(allDependents)];
  }

  /**
   * Get all keys associated with specific tags
   */
  getKeysByTags(tags: string[]): string[] {
    const keys = new Set<string>();
    tags.forEach(tag => {
      const tagKeys = this.tagIndex.get(tag);
      if (tagKeys) {
        tagKeys.forEach(key => keys.add(key));
      }
    });
    return Array.from(keys);
  }

  /**
   * Get keys matching a pattern
   */
  getKeysByPattern(pattern: string | RegExp): string[] {
    const allKeys = Array.from(this.dependencies.keys());
    if (typeof pattern === 'string') {
      return allKeys.filter(key => key.includes(pattern));
    }
    return allKeys.filter(key => pattern.test(key));
  }

  /**
   * Apply invalidation rules to determine which keys to invalidate
   */
  applyInvalidationRules(rules: InvalidationRule[]): string[] {
    const keysToInvalidate = new Set<string>();

    rules.forEach(rule => {
      let matchingKeys: string[] = [];

      // Get keys by pattern
      if (rule.pattern) {
        matchingKeys = this.getKeysByPattern(rule.pattern);
      }

      // Get keys by tags
      if (rule.tags && rule.tags.length > 0) {
        const tagKeys = this.getKeysByTags(rule.tags);
        matchingKeys = matchingKeys.length > 0 
          ? matchingKeys.filter(key => tagKeys.includes(key))
          : tagKeys;
      }

      // Apply condition filter
      if (rule.condition) {
        matchingKeys = matchingKeys.filter(key => {
          const dependency = this.dependencies.get(key);
          return dependency && rule.condition!(key, dependency);
        });
      }

      // Add matching keys
      matchingKeys.forEach(key => keysToInvalidate.add(key));

      // Add dependent keys if cascade is enabled
      if (rule.cascade) {
        matchingKeys.forEach(key => {
          const dependents = this.getDependentKeys(key);
          dependents.forEach(dependent => keysToInvalidate.add(dependent));
        });
      }
    });

    return Array.from(keysToInvalidate);
  }

  /**
   * Queue keys for invalidation
   */
  queueInvalidation(keys: string[], options: CacheInvalidationOptions = {}): void {
    keys.forEach(key => {
      this.invalidationQueue.push({ key, options });
    });

    // Sort queue by priority
    this.invalidationQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.options.priority || 'medium'];
      const bPriority = priorityOrder[b.options.priority || 'medium'];
      return bPriority - aPriority;
    });

    if (!this.isProcessing) {
      this.processInvalidationQueue();
    }
  }

  /**
   * Process the invalidation queue
   */
  private async processInvalidationQueue(): Promise<void> {
    if (this.isProcessing || this.invalidationQueue.length === 0) return;

    this.isProcessing = true;
    const userId = 'system';
    const sessionId = 'cache-invalidation';

    try {
      while (this.invalidationQueue.length > 0) {
        const batch = this.invalidationQueue.splice(0, 10); // Process in batches of 10

        await Promise.allSettled(
          batch.map(async ({ key, options }) => {
            try {
              if (options.dryRun) {
                console.log(`[DRY RUN] Would invalidate cache key: ${key}`);
                return;
              }

              // Perform actual cache invalidation
              await this.invalidateCacheKey(key);

              // Handle cascade invalidation
              if (options.cascade) {
                const dependents = this.getDependentKeys(key);
                if (dependents.length > 0) {
                  this.queueInvalidation(dependents, { ...options, cascade: false });
                }
              }

              console.log(`Cache key invalidated: ${key}`);
            } catch (error) {
              await handleError(error as Error, {
                userId,
                sessionId,
                timestamp: new Date(),
                additionalData: { operation: 'cache-invalidation', key }
              });
            }
          })
        );

        // Add delay between batches if specified
        if (batch.length > 0 && batch[0].options.delay) {
          await new Promise(resolve => setTimeout(resolve, batch[0].options.delay));
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Invalidate a specific cache key (to be implemented by specific cache implementations)
   */
  private async invalidateCacheKey(key: string): Promise<void> {
    // This would be implemented by specific cache backends
    // For now, we'll just log the invalidation
    console.log(`Invalidating cache key: ${key}`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalDependencies: number;
    totalTags: number;
    queueLength: number;
    isProcessing: boolean;
  } {
    return {
      totalDependencies: this.dependencies.size,
      totalTags: this.tagIndex.size,
      queueLength: this.invalidationQueue.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Clear all dependencies and queues
   */
  clear(): void {
    this.dependencies.clear();
    this.reverseDependencies.clear();
    this.tagIndex.clear();
    this.invalidationQueue = [];
    this.isProcessing = false;
  }
}

// Global instance
const selectiveCacheInvalidator = new SelectiveCacheInvalidator();

// Predefined cache dependency configurations
export const CACHE_DEPENDENCIES = {
  // Branch-related dependencies
  BRANCH_HIERARCHY: {
    key: 'branch:hierarchy',
    dependsOn: [],
    tags: ['branch', 'hierarchy'],
    ttl: 60 * 60 * 1000, // 1 hour
    priority: 'high' as const
  },
  
  USER_BRANCHES: (userId: string) => ({
    key: `user:${userId}:branches`,
    dependsOn: ['branch:hierarchy'],
    tags: ['user', 'branch', `user:${userId}`],
    ttl: 30 * 60 * 1000, // 30 minutes
    priority: 'medium' as const
  }),
  
  BRANCH_ACCESS: (userId: string, branchId: string) => ({
    key: `access:${userId}:${branchId}`,
    dependsOn: [`user:${userId}:branches`, 'branch:hierarchy'],
    tags: ['access', 'branch', `user:${userId}`, `branch:${branchId}`],
    ttl: 10 * 60 * 1000, // 10 minutes
    priority: 'low' as const
  }),

  // API cache dependencies
  API_RESPONSE: (endpoint: string, params?: string) => ({
    key: `api:${endpoint}${params ? `:${params}` : ''}`,
    dependsOn: [],
    tags: ['api', endpoint.split('/')[0]],
    ttl: 5 * 60 * 1000, // 5 minutes
    priority: 'medium' as const
  }),

  // User profile dependencies
  USER_PROFILE: (userId: string) => ({
    key: `profile:${userId}`,
    dependsOn: [],
    tags: ['profile', `user:${userId}`],
    ttl: 15 * 60 * 1000, // 15 minutes
    priority: 'medium' as const
  })
};

// Predefined invalidation rules
export const INVALIDATION_RULES = {
  // Invalidate all branch-related caches
  BRANCH_UPDATE: [
    {
      tags: ['branch'],
      cascade: true
    }
  ] as InvalidationRule[],

  // Invalidate user-specific caches
  USER_UPDATE: (userId: string) => [
    {
      tags: [`user:${userId}`],
      cascade: true
    }
  ] as InvalidationRule[],

  // Invalidate API caches for specific endpoint
  API_UPDATE: (endpoint: string) => [
    {
      pattern: new RegExp(`^api:${endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      cascade: false
    }
  ] as InvalidationRule[],

  // Invalidate all caches with low priority
  CLEANUP_LOW_PRIORITY: [
    {
      pattern: /.*/,
      condition: (key: string, data: any) => data.priority === 'low',
      cascade: false
    }
  ] as InvalidationRule[]
};

export { selectiveCacheInvalidator };
export type { CacheDependency, InvalidationRule, CacheInvalidationOptions };