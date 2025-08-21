'use client';

import { selectiveCacheInvalidator, type CacheDependency } from './selective-invalidation';
import { handleError } from '@/lib/errors/error-handler';
import { createCacheError } from '@/lib/errors/error-classes';
import { CacheErrorCode } from '@/types/errors';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: string[];
  dependencies: string[];
  accessCount: number;
  lastAccessed: number;
}

interface CacheManagerOptions {
  maxSize?: number;
  defaultTTL?: number;
  cleanupInterval?: number;
  enableMetrics?: boolean;
  enableDependencyTracking?: boolean;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  size: number;
  hitRate: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    size: 0,
    hitRate: 0
  };
  private cleanupTimer?: NodeJS.Timeout;
  private options: Required<CacheManagerOptions>;

  constructor(options: CacheManagerOptions = {}) {
    this.options = {
      maxSize: options.maxSize ?? 1000,
      defaultTTL: options.defaultTTL ?? 5 * 60 * 1000, // 5 minutes
      cleanupInterval: options.cleanupInterval ?? 60 * 1000, // 1 minute
      enableMetrics: options.enableMetrics ?? true,
      enableDependencyTracking: options.enableDependencyTracking ?? true
    };

    this.startCleanupTimer();
  }

  /**
   * Get a value from the cache
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.updateMetrics('miss');
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.updateMetrics('miss');
      return null;
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    this.updateMetrics('hit');
    return entry.data as T;
  }

  /**
   * Set a value in the cache
   */
  set<T = any>(
    key: string, 
    data: T, 
    options: {
      ttl?: number;
      tags?: string[];
      dependencies?: string[];
    } = {}
  ): void {
    const {
      ttl = this.options.defaultTTL,
      tags = [],
      dependencies = []
    } = options;

    // Check if we need to evict entries
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      tags,
      dependencies,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    this.updateMetrics('set');

    // Register dependency if tracking is enabled
    if (this.options.enableDependencyTracking && (tags.length > 0 || dependencies.length > 0)) {
      const cacheDependency: CacheDependency = {
        key,
        dependsOn: dependencies,
        tags,
        ttl,
        priority: this.determinePriority(tags)
      };
      
      try {
        selectiveCacheInvalidator.registerDependency(cacheDependency);
      } catch (error) {
        // Log error but don't fail the cache operation
        console.warn('Failed to register cache dependency:', error);
      }
    }
  }

  /**
   * Delete a value from the cache
   */
  delete(key: string): boolean {
    const existed = this.cache.has(key);
    
    if (existed) {
      this.cache.delete(key);
      this.updateMetrics('delete');
      
      // Unregister dependency if tracking is enabled
      if (this.options.enableDependencyTracking) {
        try {
          selectiveCacheInvalidator.unregisterDependency(key);
        } catch (error) {
          console.warn('Failed to unregister cache dependency:', error);
        }
      }
    }
    
    return existed;
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.resetMetrics();
    
    if (this.options.enableDependencyTracking) {
      try {
        selectiveCacheInvalidator.clear();
      } catch (error) {
        console.warn('Failed to clear cache dependencies:', error);
      }
    }
  }

  /**
   * Get all keys in the cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const currentMetrics = { ...this.metrics };
    currentMetrics.size = this.cache.size;
    currentMetrics.hitRate = currentMetrics.hits + currentMetrics.misses > 0 
      ? currentMetrics.hits / (currentMetrics.hits + currentMetrics.misses)
      : 0;
    return currentMetrics;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateByPattern(pattern: string | RegExp): number {
    let invalidatedCount = 0;
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      const matches = typeof pattern === 'string' 
        ? key.includes(pattern)
        : pattern.test(key);
        
      if (matches) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      if (this.delete(key)) {
        invalidatedCount++;
      }
    });
    
    return invalidatedCount;
  }

  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): number {
    let invalidatedCount = 0;
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      const hasMatchingTag = tags.some(tag => entry.tags.includes(tag));
      if (hasMatchingTag) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      if (this.delete(key)) {
        invalidatedCount++;
      }
    });
    
    return invalidatedCount;
  }

  /**
   * Get entries by tags
   */
  getByTags(tags: string[]): Array<{ key: string; data: any }> {
    const results: Array<{ key: string; data: any }> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        continue;
      }
      
      const hasMatchingTag = tags.some(tag => entry.tags.includes(tag));
      if (hasMatchingTag) {
        results.push({ key, data: entry.data });
      }
    }
    
    return results;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    let cleanedCount = 0;
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      cleanedCount++;
    });
    
    return cleanedCount;
  }

  /**
   * Destroy the cache manager
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    this.clear();
  }

  // Private methods
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.updateMetrics('eviction');
    }
  }

  private updateMetrics(operation: 'hit' | 'miss' | 'set' | 'delete' | 'eviction'): void {
    if (!this.options.enableMetrics) return;
    
    switch (operation) {
      case 'hit':
        this.metrics.hits++;
        break;
      case 'miss':
        this.metrics.misses++;
        break;
      case 'set':
        this.metrics.sets++;
        break;
      case 'delete':
        this.metrics.deletes++;
        break;
      case 'eviction':
        this.metrics.evictions++;
        break;
    }
  }

  private resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      hitRate: 0
    };
  }

  private determinePriority(tags: string[]): 'high' | 'medium' | 'low' {
    // Determine priority based on tags
    if (tags.includes('critical') || tags.includes('auth') || tags.includes('user')) {
      return 'high';
    }
    if (tags.includes('api') || tags.includes('branch')) {
      return 'medium';
    }
    return 'low';
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanup();
      } catch (error) {
        console.warn('Cache cleanup failed:', error);
      }
    }, this.options.cleanupInterval);
  }
}

// Global cache manager instance
const globalCacheManager = new CacheManager({
  maxSize: 2000,
  defaultTTL: 10 * 60 * 1000, // 10 minutes
  cleanupInterval: 2 * 60 * 1000, // 2 minutes
  enableMetrics: true,
  enableDependencyTracking: true
});

// Cache manager factory for creating specialized instances
export function createCacheManager(options: CacheManagerOptions = {}): CacheManager {
  return new CacheManager(options);
}

// Specialized cache managers
export const apiCacheManager = createCacheManager({
  maxSize: 500,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  enableDependencyTracking: true
});

export const userCacheManager = createCacheManager({
  maxSize: 200,
  defaultTTL: 15 * 60 * 1000, // 15 minutes
  enableDependencyTracking: true
});

export const branchCacheManager = createCacheManager({
  maxSize: 300,
  defaultTTL: 30 * 60 * 1000, // 30 minutes
  enableDependencyTracking: true
});

export { globalCacheManager };
export type { CacheEntry, CacheManagerOptions, CacheMetrics };