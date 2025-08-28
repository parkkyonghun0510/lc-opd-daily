import { useEffect, useRef, useCallback } from 'react';

// Memory management utilities
export class MemoryManager {
  private static instance: MemoryManager;
  private activeSubscriptions = new Set<string>();
  private timers = new Map<string, NodeJS.Timeout>();
  private intervals = new Map<string, NodeJS.Timeout>();
  private eventListeners = new Map<string, { element: EventTarget; event: string; handler: EventListener }>();
  private abortControllers = new Map<string, AbortController>();
  private cacheEntries = new Map<string, { data: any; timestamp: number; size: number }>();
  private maxCacheSize = 50 * 1024 * 1024; // 50MB
  private currentCacheSize = 0;
  private memoryThreshold = 0.85; // 85% of available memory

  private constructor() {
    this.setupMemoryMonitoring();
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  // Setup memory monitoring
  private setupMemoryMonitoring() {
    if (typeof window === 'undefined') return;

    // Monitor memory usage every 30 seconds
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30000);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Handle visibility change to clean up when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performMaintenanceCleanup();
      }
    });
  }

  // Memory usage monitoring
  private checkMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      if (usageRatio > this.memoryThreshold) {
        console.warn('High memory usage detected:', usageRatio);
        this.forceCleanup();
      }
    }

    // Check cache size
    if (this.currentCacheSize > this.maxCacheSize) {
      this.cleanupCache();
    }
  }

  // Register a subscription for cleanup
  registerSubscription(id: string): () => void {
    this.activeSubscriptions.add(id);
    return () => this.unregisterSubscription(id);
  }

  // Unregister subscription
  private unregisterSubscription(id: string) {
    this.activeSubscriptions.delete(id);
  }

  // Timer management
  registerTimer(id: string, callback: () => void, delay: number): NodeJS.Timeout {
    this.clearTimer(id); // Clear existing timer
    const timer = setTimeout(() => {
      callback();
      this.timers.delete(id);
    }, delay);
    this.timers.set(id, timer);
    return timer;
  }

  clearTimer(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  // Interval management
  registerInterval(id: string, callback: () => void, interval: number): NodeJS.Timeout {
    this.clearInterval(id); // Clear existing interval
    const intervalId = setInterval(callback, interval);
    this.intervals.set(id, intervalId);
    return intervalId;
  }

  clearInterval(id: string) {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
  }

  // Event listener management
  registerEventListener(
    id: string,
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ) {
    this.removeEventListener(id); // Remove existing listener
    element.addEventListener(event, handler, options);
    this.eventListeners.set(id, { element, event, handler });
  }

  removeEventListener(id: string) {
    const listener = this.eventListeners.get(id);
    if (listener) {
      listener.element.removeEventListener(listener.event, listener.handler);
      this.eventListeners.delete(id);
    }
  }

  // Abort controller management
  registerAbortController(id: string): AbortController {
    this.clearAbortController(id);
    const controller = new AbortController();
    this.abortControllers.set(id, controller);
    return controller;
  }

  clearAbortController(id: string) {
    const controller = this.abortControllers.get(id);
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
    this.abortControllers.delete(id);
  }

  // Cache management
  setCacheEntry(key: string, data: any, ttl = 300000) { // 5 minutes default TTL
    const size = this.estimateSize(data);
    const entry = {
      data,
      timestamp: Date.now() + ttl,
      size
    };

    this.cacheEntries.set(key, entry);
    this.currentCacheSize += size;

    // Trigger cleanup if cache is getting full
    if (this.currentCacheSize > this.maxCacheSize * 0.8) {
      this.cleanupCache();
    }
  }

  getCacheEntry(key: string): any | null {
    const entry = this.cacheEntries.get(key);
    if (!entry) return null;

    if (Date.now() > entry.timestamp) {
      this.removeCacheEntry(key);
      return null;
    }

    return entry.data;
  }

  removeCacheEntry(key: string) {
    const entry = this.cacheEntries.get(key);
    if (entry) {
      this.currentCacheSize -= entry.size;
      this.cacheEntries.delete(key);
    }
  }

  // Estimate object size in bytes
  private estimateSize(obj: any): number {
    try {
      return new Blob([JSON.stringify(obj)]).size;
    } catch {
      return 1024; // Fallback estimate
    }
  }

  // Cache cleanup
  private cleanupCache() {
    const now = Date.now();
    const expiredEntries: string[] = [];

    // Remove expired entries
    this.cacheEntries.forEach((entry, key) => {
      if (now > entry.timestamp) {
        expiredEntries.push(key);
      }
    });

    expiredEntries.forEach(key => this.removeCacheEntry(key));

    // If still over limit, remove oldest entries
    if (this.currentCacheSize > this.maxCacheSize) {
      const sortedEntries = Array.from(this.cacheEntries.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      while (this.currentCacheSize > this.maxCacheSize * 0.7 && sortedEntries.length > 0) {
        const [key] = sortedEntries.shift()!;
        this.removeCacheEntry(key);
      }
    }
  }

  // Maintenance cleanup (called when tab becomes hidden)
  private performMaintenanceCleanup() {
    this.cleanupCache();
    
    // Clear non-essential timers and intervals
    this.timers.forEach((timer, id) => {
      if (id.includes('non-essential') || id.includes('background')) {
        this.clearTimer(id);
      }
    });

    // Suggest garbage collection if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch (e) {
        // Ignore errors
      }
    }
  }

  // Force cleanup when memory is high
  private forceCleanup() {
    console.log('Performing force cleanup due to high memory usage');
    
    // Clear all non-critical caches
    this.cacheEntries.clear();
    this.currentCacheSize = 0;

    // Clear all timers and intervals
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();

    // Abort all non-critical requests
    this.abortControllers.forEach((controller, id) => {
      if (!id.includes('critical')) {
        controller.abort();
      }
    });

    // Emit cleanup event for components to respond
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('memory-cleanup', {
        detail: { forced: true }
      }));
    }
  }

  // Complete cleanup
  cleanup() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();

    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();

    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners.clear();

    this.abortControllers.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    });
    this.abortControllers.clear();

    this.cacheEntries.clear();
    this.currentCacheSize = 0;
    this.activeSubscriptions.clear();
  }

  // Get memory stats
  getMemoryStats() {
    const stats = {
      activeSubscriptions: this.activeSubscriptions.size,
      activeTimers: this.timers.size,
      activeIntervals: this.intervals.size,
      activeEventListeners: this.eventListeners.size,
      activeAbortControllers: this.abortControllers.size,
      cacheEntries: this.cacheEntries.size,
      cacheSize: this.currentCacheSize,
      cacheSizeMB: (this.currentCacheSize / 1024 / 1024).toFixed(2),
    };

    if ('memory' in performance) {
      const memory = (performance as any).memory;
      Object.assign(stats, {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        memoryUsageRatio: (memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100).toFixed(2) + '%',
      });
    }

    return stats;
  }
}

// React hook for memory management
export function useMemoryManagement(componentId: string) {
  const memoryManager = MemoryManager.getInstance();
  const cleanupFunctions = useRef<(() => void)[]>([]);

  // Register component with memory manager
  useEffect(() => {
    const unregister = memoryManager.registerSubscription(componentId);
    cleanupFunctions.current.push(unregister);

    return () => {
      cleanupFunctions.current.forEach(cleanup => cleanup());
      cleanupFunctions.current = [];
    };
  }, [componentId, memoryManager]);

  const registerTimer = useCallback((id: string, callback: () => void, delay: number) => {
    const fullId = `${componentId}-${id}`;
    return memoryManager.registerTimer(fullId, callback, delay);
  }, [componentId, memoryManager]);

  const clearTimer = useCallback((id: string) => {
    const fullId = `${componentId}-${id}`;
    memoryManager.clearTimer(fullId);
  }, [componentId, memoryManager]);

  const registerInterval = useCallback((id: string, callback: () => void, interval: number) => {
    const fullId = `${componentId}-${id}`;
    return memoryManager.registerInterval(fullId, callback, interval);
  }, [componentId, memoryManager]);

  const clearInterval = useCallback((id: string) => {
    const fullId = `${componentId}-${id}`;
    memoryManager.clearInterval(fullId);
  }, [componentId, memoryManager]);

  const registerEventListener = useCallback((
    id: string,
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ) => {
    const fullId = `${componentId}-${id}`;
    memoryManager.registerEventListener(fullId, element, event, handler, options);
  }, [componentId, memoryManager]);

  const removeEventListener = useCallback((id: string) => {
    const fullId = `${componentId}-${id}`;
    memoryManager.removeEventListener(fullId);
  }, [componentId, memoryManager]);

  const registerAbortController = useCallback((id: string) => {
    const fullId = `${componentId}-${id}`;
    return memoryManager.registerAbortController(fullId);
  }, [componentId, memoryManager]);

  const clearAbortController = useCallback((id: string) => {
    const fullId = `${componentId}-${id}`;
    memoryManager.clearAbortController(fullId);
  }, [componentId, memoryManager]);

  const setCacheEntry = useCallback((key: string, data: any, ttl?: number) => {
    const fullKey = `${componentId}-${key}`;
    memoryManager.setCacheEntry(fullKey, data, ttl);
  }, [componentId, memoryManager]);

  const getCacheEntry = useCallback((key: string) => {
    const fullKey = `${componentId}-${key}`;
    return memoryManager.getCacheEntry(fullKey);
  }, [componentId, memoryManager]);

  const getMemoryStats = useCallback(() => {
    return memoryManager.getMemoryStats();
  }, [memoryManager]);

  return {
    registerTimer,
    clearTimer,
    registerInterval,
    clearInterval,
    registerEventListener,
    removeEventListener,
    registerAbortController,
    clearAbortController,
    setCacheEntry,
    getCacheEntry,
    getMemoryStats,
  };
}

// Hook for automatic cleanup of refs and state
export function useCleanupEffect(cleanupFn: () => void, deps?: React.DependencyList) {
  useEffect(() => {
    return cleanupFn;
  }, deps);
}

// Hook for debounced cleanup
export function useDebouncedCleanup(
  cleanupFn: () => void,
  delay: number = 300,
  deps?: React.DependencyList
) {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(cleanupFn, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, deps);
}

// Memory-safe component wrapper
export function withMemoryManagement<P extends object>(
  Component: React.ComponentType<P>,
  componentId?: string
) {
  const WrappedComponent = (props: P) => {
    const id = componentId || Component.displayName || Component.name || 'anonymous';
    useMemoryManagement(id);
    return <Component {...props} />;
  };

  WrappedComponent.displayName = `withMemoryManagement(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

export default MemoryManager;