import { useState, useCallback } from 'react';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface CacheConfig {
    ttl?: number; // Time to live in milliseconds
    maxEntries?: number;
}

export function useApiCache<T>(config: CacheConfig = {}) {
    const { ttl = 5 * 60 * 1000, maxEntries = 100 } = config;
    const [cache] = useState<Map<string, CacheEntry<T>>>(new Map());

    const set = useCallback((key: string, data: T) => {
        // Remove oldest entries if cache is full
        if (cache.size >= maxEntries) {
            const oldestKey = cache.keys().next().value;
            if (oldestKey !== undefined) {
                cache.delete(oldestKey);
            }
        }

        cache.set(key, {
            data,
            timestamp: Date.now(),
        });
    }, [cache, maxEntries]);

    const get = useCallback((key: string): T | null => {
        const entry = cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if entry has expired
        if (Date.now() - entry.timestamp > ttl) {
            cache.delete(key);
            return null;
        }

        return entry.data;
    }, [cache, ttl]);

    const invalidate = useCallback((key: string) => {
        cache.delete(key);
    }, [cache]);

    const clear = useCallback(() => {
        cache.clear();
    }, [cache]);

    return {
        get,
        set,
        invalidate,
        clear,
    };
}