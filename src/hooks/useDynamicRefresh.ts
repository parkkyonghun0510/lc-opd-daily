'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { 
  DynamicRefreshManager, 
  getDynamicRefreshManager, 
  RefreshStrategy, 
  type RefreshIntervalChangeEvent,
  type DynamicRefreshManagerOptions 
} from '@/lib/refresh/dynamic-refresh-manager';
import { createNetworkError } from '@/lib/errors/error-classes';
import { NetworkErrorCode } from '@/types/errors';

/**
 * Dynamic refresh hook options
 */
export interface UseDynamicRefreshOptions<T = any> extends DynamicRefreshManagerOptions {
  enabled?: boolean;
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  onIntervalChange?: (event: RefreshIntervalChangeEvent) => void;
}

/**
 * Dynamic refresh hook return type
 */
export interface UseDynamicRefreshReturn<T = any> {
  // State
  isLoading: boolean;
  error: Error | null;
  data: T | null;
  interval: number;
  strategy: RefreshStrategy;
  isEnabled: boolean;
  
  // Actions
  refresh: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  forceStrategy: (strategy: RefreshStrategy) => void;
  reportSuccess: () => void;
  reportError: (error?: Error) => void;
  
  // Manager access
  manager: DynamicRefreshManager;
}

/**
 * Hook for dynamic refresh with adaptive intervals
 */
export function useDynamicRefresh<T = any>(
  refreshFn: () => Promise<T>,
  options: UseDynamicRefreshOptions = {}
): UseDynamicRefreshReturn {
  const {
    enabled = true,
    immediate = true,
    onSuccess,
    onError,
    onIntervalChange,
    ...managerOptions
  } = options;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [interval, setInterval] = useState(0);
  const [strategy, setStrategy] = useState<RefreshStrategy>(RefreshStrategy.NORMAL);
  const [isEnabled, setIsEnabled] = useState(enabled);

  // Refs
  const managerRef = useRef<DynamicRefreshManager | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const refreshFnRef = useRef(refreshFn);

  // Update refresh function ref
  refreshFnRef.current = refreshFn;

  // Initialize manager
  useEffect(() => {
    const manager = getDynamicRefreshManager({
      ...managerOptions,
      onIntervalChange: (event) => {
        if (isUnmountedRef.current) return;
        
        setInterval(event.newInterval);
        setStrategy(event.newStrategy);
        setIsEnabled(manager.isEnabled());
        
        onIntervalChange?.(event);
        
        // Reschedule next refresh
        scheduleNextRefresh();
      }
    });
    
    managerRef.current = manager;
    setInterval(manager.getCurrentInterval());
    setStrategy(manager.getCurrentStrategy());
    setIsEnabled(manager.isEnabled());
    
    return () => {
      isUnmountedRef.current = true;
      clearTimeout();
    };
  }, []);

  // Clear timeout helper
  const clearTimeout = useCallback(() => {
    if (timeoutRef.current) {
      global.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Execute refresh function
  const executeRefresh = useCallback(async (): Promise<void> => {
    if (isUnmountedRef.current || !managerRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await refreshFnRef.current();
      
      if (isUnmountedRef.current) return;
      
      setData(result);
      managerRef.current.reportSuccess();
      onSuccess?.(result);
      
    } catch (err) {
      if (isUnmountedRef.current) return;
      
      const error = err instanceof Error ? err : createNetworkError(
        NetworkErrorCode.CONNECTION_FAILED,
        'Refresh operation failed',
        { context: { operation: 'refresh' } }
      );
      
      setError(error);
      managerRef.current?.reportError(error);
      onError?.(error);
      
    } finally {
      if (!isUnmountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [onSuccess, onError]);

  // Schedule next refresh
  const scheduleNextRefresh = useCallback(() => {
    if (isUnmountedRef.current || !managerRef.current) return;
    
    clearTimeout();
    
    const currentInterval = managerRef.current.getCurrentInterval();
    const managerEnabled = managerRef.current.isEnabled();
    
    if (!enabled || !managerEnabled || currentInterval <= 0) {
      return;
    }
    
    timeoutRef.current = global.setTimeout(() => {
      if (!isUnmountedRef.current) {
        executeRefresh().then(() => {
          scheduleNextRefresh();
        });
      }
    }, currentInterval);
  }, [enabled, executeRefresh, clearTimeout]);

  // Manual refresh
  const refresh = useCallback(async (): Promise<void> => {
    clearTimeout();
    await executeRefresh();
    scheduleNextRefresh();
  }, [executeRefresh, scheduleNextRefresh, clearTimeout]);

  // Pause refresh
  const pause = useCallback(() => {
    managerRef.current?.pause('Manually paused');
    clearTimeout();
  }, [clearTimeout]);

  // Resume refresh
  const resume = useCallback(() => {
    managerRef.current?.resume('Manually resumed');
    scheduleNextRefresh();
  }, [scheduleNextRefresh]);

  // Force strategy
  const forceStrategy = useCallback((newStrategy: RefreshStrategy) => {
    managerRef.current?.forceStrategy(newStrategy, 'Manually set strategy');
  }, []);

  // Report success
  const reportSuccess = useCallback(() => {
    managerRef.current?.reportSuccess();
  }, []);

  // Report error
  const reportError = useCallback((error?: Error) => {
    managerRef.current?.reportError(error);
  }, []);

  // Start refresh cycle
  useEffect(() => {
    if (!enabled) return;
    
    if (immediate) {
      executeRefresh().then(() => {
        scheduleNextRefresh();
      });
    } else {
      scheduleNextRefresh();
    }
    
    return () => {
      clearTimeout();
    };
  }, [enabled, immediate, executeRefresh, scheduleNextRefresh, clearTimeout]);

  // Update enabled state when option changes
  useEffect(() => {
    setIsEnabled(enabled && managerRef.current?.isEnabled() || false);
    
    if (enabled) {
      scheduleNextRefresh();
    } else {
      clearTimeout();
    }
  }, [enabled, scheduleNextRefresh, clearTimeout]);

  return {
    // State
    isLoading,
    error,
    data,
    interval,
    strategy,
    isEnabled,
    
    // Actions
    refresh,
    pause,
    resume,
    forceStrategy,
    reportSuccess,
    reportError,
    
    // Manager access
    manager: managerRef.current!
  };
}

/**
 * Hook for dynamic API refresh with built-in error handling
 */
export function useDynamicApiRefresh<T = any>(
  apiCall: () => Promise<T>,
  options: UseDynamicRefreshOptions = {}
): UseDynamicRefreshReturn {
  return useDynamicRefresh(apiCall, {
    enableNetworkAdaptation: true,
    enableActivityAdaptation: true,
    enableErrorBackoff: true,
    ...options
  });
}

/**
 * Hook for dynamic data polling with customizable intervals
 */
export function useDynamicPolling<T = any>(
  pollFn: () => Promise<T>,
  options: UseDynamicRefreshOptions & {
    pollInterval?: number;
    maxPolls?: number;
    stopOnError?: boolean;
  } = {}
): UseDynamicRefreshReturn & {
  pollCount: number;
  maxReached: boolean;
} {
  const {
    pollInterval = 5000,
    maxPolls,
    stopOnError = false,
    ...refreshOptions
  } = options;

  const [pollCount, setPollCount] = useState(0);
  const [maxReached, setMaxReached] = useState(false);

  const wrappedPollFn = useCallback(async () => {
    if (maxPolls && pollCount >= maxPolls) {
      setMaxReached(true);
      throw createNetworkError(
        NetworkErrorCode.CONNECTION_FAILED,
        'Maximum poll count reached',
        { context: { operation: 'poll', maxPolls, pollCount } }
      );
    }
    
    const result = await pollFn();
    setPollCount(prev => prev + 1);
    return result;
  }, [pollFn, maxPolls, pollCount]);

  const refreshResult = useDynamicRefresh(wrappedPollFn, {
    baseInterval: pollInterval,
    ...refreshOptions,
    onError: (error) => {
      refreshOptions.onError?.(error);
      if (stopOnError) {
        refreshResult.pause();
      }
    }
  });

  return {
    ...refreshResult,
    pollCount,
    maxReached
  };
}

/**
 * Hook for conditional dynamic refresh based on dependencies
 */
export function useConditionalDynamicRefresh<T = any>(
  refreshFn: () => Promise<T>,
  dependencies: any[],
  options: UseDynamicRefreshOptions = {}
): UseDynamicRefreshReturn {
  const [shouldRefresh, setShouldRefresh] = useState(true);
  
  // Check if dependencies changed
  const prevDepsRef = useRef<any[]>(dependencies);
  
  useEffect(() => {
    const depsChanged = dependencies.some((dep, index) => 
      dep !== prevDepsRef.current[index]
    );
    
    if (depsChanged) {
      setShouldRefresh(true);
      prevDepsRef.current = dependencies;
    }
  }, dependencies);

  return useDynamicRefresh(refreshFn, {
    ...options,
    enabled: shouldRefresh && (options.enabled !== false),
    onSuccess: (data) => {
      setShouldRefresh(false);
      options.onSuccess?.(data);
    }
  });
}

/**
 * Hook for background dynamic refresh (minimal impact on UI)
 */
export function useBackgroundDynamicRefresh<T = any>(
  refreshFn: () => Promise<T>,
  options: UseDynamicRefreshOptions = {}
): UseDynamicRefreshReturn {
  return useDynamicRefresh(refreshFn, {
    baseInterval: 60000, // 1 minute default
    enableActivityAdaptation: true,
    enableNetworkAdaptation: true,
    immediate: false,
    ...options
  });
}