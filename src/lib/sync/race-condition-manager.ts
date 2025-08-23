/**
 * Race Condition Prevention and Synchronization Manager
 * Provides utilities to prevent race conditions in asynchronous operations
 */

import { AppError, NetworkErrorCode } from '@/types/errors';
import { createNetworkError } from '@/lib/errors/error-classes';

// Request tracking for preventing duplicate requests
interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
  abortController: AbortController;
}

// Sequence tracking for ordered operations
interface SequenceTracker {
  currentSequence: number;
  pendingOperations: Map<number, Promise<any>>;
}

// State synchronization for preventing overwrites
interface StateLock {
  isLocked: boolean;
  lockId: string;
  timestamp: number;
  operation: string;
}

class RaceConditionManager {
  // Ensure sequential execution by delegating to executeInSequence
  async ensureSequentialExecution<T>(
    key: string,
    operation: () => Promise<T>,
    options: { timeout?: number; maxConcurrentOperations?: number } = {}
  ): Promise<T> {
    return this.executeInSequence(key, operation, options);
  }

  // Retry wrapper with exponential backoff and jitter
  async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 500
  ): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        // Determine retryability
        const isRetryable = typeof error === 'object' && error !== null && 'retryable' in (error as any)
          ? Boolean((error as any).retryable)
          : false;

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay = Math.min(30_000, baseDelay * Math.pow(2, attempt));
        const jitter = Math.random() * (delay * 0.2); // up to 20% jitter
        await new Promise(res => setTimeout(res, delay + jitter));
        attempt += 1;
      }
    }

    // Should not reach here
    throw lastError as any;
  }
  private pendingRequests = new Map<string, PendingRequest>();
  private sequenceTrackers = new Map<string, SequenceTracker>();
  private stateLocks = new Map<string, StateLock>();
  private requestTimeouts = new Map<string, NodeJS.Timeout>();
  
  // Default timeout for requests (30 seconds)
  private readonly DEFAULT_TIMEOUT = 30000;
  
  // Maximum age for pending requests (5 minutes)
  private readonly MAX_REQUEST_AGE = 5 * 60 * 1000;

  /**
   * Prevents duplicate requests by returning existing promise if same request is pending
   */
  async preventDuplicateRequest<T>(
    key: string,
    requestFn: (signal: AbortSignal) => Promise<T>,
    options: {
      timeout?: number;
      allowConcurrent?: boolean;
      maxAge?: number;
    } = {}
  ): Promise<T> {
    const {
      timeout = this.DEFAULT_TIMEOUT,
      allowConcurrent = false,
      maxAge = this.MAX_REQUEST_AGE
    } = options;

    // Check if request is already pending
    const existing = this.pendingRequests.get(key);
    if (existing && !allowConcurrent) {
      // Check if request is too old
      if (Date.now() - existing.timestamp > maxAge) {
        existing.abortController.abort();
        this.pendingRequests.delete(key);
        this.clearRequestTimeout(key);
      } else {
        return existing.promise as Promise<T>;
      }
    }

    // Create new request with abort controller
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
      this.pendingRequests.delete(key);
    }, timeout);

    this.requestTimeouts.set(key, timeoutId);

    const promise = requestFn(abortController.signal)
      .finally(() => {
        this.pendingRequests.delete(key);
        this.clearRequestTimeout(key);
      });

    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
      abortController
    });

    return promise;
  }

  /**
   * Ensures operations execute in sequence to prevent race conditions
   */
  async executeInSequence<T>(
    key: string,
    operation: () => Promise<T>,
    options: {
      timeout?: number;
      maxConcurrentOperations?: number;
    } = {}
  ): Promise<T> {
    const { timeout = this.DEFAULT_TIMEOUT, maxConcurrentOperations = 10 } = options;

    let tracker = this.sequenceTrackers.get(key);
    if (!tracker) {
      tracker = {
        currentSequence: 0,
        pendingOperations: new Map()
      };
      this.sequenceTrackers.set(key, tracker);
    }

    // Limit concurrent operations
    if (tracker.pendingOperations.size >= maxConcurrentOperations) {
      throw createNetworkError(
        NetworkErrorCode.NETWORK_ERROR,
        `Too many concurrent operations for key: ${key}`,
        { retryable: true }
      );
    }

    const sequenceNumber = ++tracker.currentSequence;
    
    // Wait for previous operations to complete
    const previousOperations = Array.from(tracker.pendingOperations.values());
    if (previousOperations.length > 0) {
      try {
        await Promise.allSettled(previousOperations);
      } catch (error) {
        // Continue even if previous operations failed
      }
    }

    // Execute current operation with timeout
    const operationPromise = Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(createNetworkError(
            NetworkErrorCode.TIMEOUT,
            `Operation timed out after ${timeout}ms`,
            { retryable: true }
          ));
        }, timeout);
      })
    ]);

    tracker.pendingOperations.set(sequenceNumber, operationPromise);

    try {
      const result = await operationPromise;
      return result;
    } finally {
      tracker.pendingOperations.delete(sequenceNumber);
      
      // Clean up tracker if no pending operations
      if (tracker.pendingOperations.size === 0) {
        this.sequenceTrackers.delete(key);
      }
    }
  }

  /**
   * Acquires a lock to prevent concurrent state modifications
   */
  async acquireStateLock(
    key: string,
    operation: string,
    timeout: number = 5000
  ): Promise<string> {
    const lockId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const existingLock = this.stateLocks.get(key);
      
      if (!existingLock || Date.now() - existingLock.timestamp > timeout) {
        // Acquire lock
        this.stateLocks.set(key, {
          isLocked: true,
          lockId,
          timestamp: Date.now(),
          operation
        });
        return lockId;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    throw createNetworkError(
      NetworkErrorCode.TIMEOUT,
      `Failed to acquire state lock for key: ${key}`,
      { retryable: true }
    );
  }

  /**
   * Releases a state lock
   */
  releaseStateLock(key: string, lockId: string): boolean {
    const lock = this.stateLocks.get(key);
    if (lock && lock.lockId === lockId) {
      this.stateLocks.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Executes operation with state lock protection
   */
  async withStateLock<T>(
    key: string,
    operation: string,
    fn: () => Promise<T>,
    timeout: number = 5000
  ): Promise<T> {
    const lockId = await this.acquireStateLock(key, operation, timeout);
    
    try {
      return await fn();
    } finally {
      this.releaseStateLock(key, lockId);
    }
  }

  /**
   * Debounces function calls to prevent rapid successive executions
   */
  debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number,
    key?: string
  ): T {
    const debounceKey = key || fn.toString();
    let timeoutId: NodeJS.Timeout;

    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    }) as T;
  }

  /**
   * Throttles function calls to limit execution frequency
   */
  throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number,
    key?: string
  ): T {
    const throttleKey = key || fn.toString();
    let inThrottle = false;

    return ((...args: Parameters<T>) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    }) as T;
  }

  /**
   * Creates a cancellable promise that can be aborted
   */
  createCancellablePromise<T>(
    executor: (resolve: (value: T) => void, reject: (reason?: any) => void, signal: AbortSignal) => void
  ): { promise: Promise<T>; cancel: () => void } {
    const abortController = new AbortController();
    
    const promise = new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        reject(createNetworkError(
          NetworkErrorCode.NETWORK_ERROR,
          'Operation was cancelled',
          { retryable: false }
        ));
      };

      abortController.signal.addEventListener('abort', onAbort);
      
      try {
        executor(resolve, reject, abortController.signal);
      } catch (error) {
        reject(error);
      }
    });

    return {
      promise,
      cancel: () => abortController.abort()
    };
  }

  /**
   * Batches multiple operations to execute together
   */
  async batchOperations<T>(
    operations: Array<() => Promise<T>>,
    options: {
      batchSize?: number;
      delay?: number;
      failFast?: boolean;
    } = {}
  ): Promise<T[]> {
    const { batchSize = 5, delay = 100, failFast = false } = options;
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      
      try {
        const batchResults = failFast
          ? await Promise.all(batch.map(op => op()))
          : await Promise.allSettled(batch.map(op => op()));

        if (failFast) {
          results.push(...(batchResults as T[]));
        } else {
          const settledResults = batchResults as PromiseSettledResult<T>[];
          settledResults.forEach(result => {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            }
          });
        }
      } catch (error) {
        if (failFast) {
          throw error;
        }
      }

      // Add delay between batches
      if (i + batchSize < operations.length && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  /**
   * Cleans up expired requests and locks
   */
  cleanup(): void {
    const now = Date.now();
    
    // Clean up expired pending requests
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.MAX_REQUEST_AGE) {
        request.abortController.abort();
        this.pendingRequests.delete(key);
        this.clearRequestTimeout(key);
      }
    }

    // Clean up expired state locks
    for (const [key, lock] of this.stateLocks.entries()) {
      if (now - lock.timestamp > 60000) { // 1 minute timeout
        this.stateLocks.delete(key);
      }
    }

    // Clean up empty sequence trackers
    for (const [key, tracker] of this.sequenceTrackers.entries()) {
      if (tracker.pendingOperations.size === 0) {
        this.sequenceTrackers.delete(key);
      }
    }
  }

  /**
   * Gets current status for debugging
   */
  getStatus() {
    return {
      pendingRequests: this.pendingRequests.size,
      sequenceTrackers: this.sequenceTrackers.size,
      stateLocks: this.stateLocks.size,
      requestTimeouts: this.requestTimeouts.size
    };
  }

  private clearRequestTimeout(key: string): void {
    const timeoutId = this.requestTimeouts.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.requestTimeouts.delete(key);
    }
  }
}

// Global instance
export const raceConditionManager = new RaceConditionManager();

// Cleanup interval (every 5 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    raceConditionManager.cleanup();
  }, 5 * 60 * 1000);
}

// React hooks for race condition prevention
export function useRaceConditionPrevention() {
  return {
    preventDuplicateRequest: raceConditionManager.preventDuplicateRequest.bind(raceConditionManager),
    executeInSequence: raceConditionManager.executeInSequence.bind(raceConditionManager),
    withStateLock: raceConditionManager.withStateLock.bind(raceConditionManager),
    debounce: raceConditionManager.debounce.bind(raceConditionManager),
    throttle: raceConditionManager.throttle.bind(raceConditionManager),
    createCancellablePromise: raceConditionManager.createCancellablePromise.bind(raceConditionManager),
    batchOperations: raceConditionManager.batchOperations.bind(raceConditionManager)
  };
}

// Utility functions for common patterns
export function createSequentialFetcher<T>(
  key: string,
  fetcher: () => Promise<T>
) {
  return () => raceConditionManager.executeInSequence(key, fetcher);
}

export function createDebouncedUpdater<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): T {
  return raceConditionManager.debounce(fn, delay);
}

export function createThrottledAction<T extends (...args: any[]) => any>(
  fn: T,
  limit: number = 1000
): T {
  return raceConditionManager.throttle(fn, limit);
}

// Higher-order component for race condition protection
export function withRaceConditionProtection<T extends Record<string, any>>(
  component: T,
  options: {
    debounceDelay?: number;
    throttleLimit?: number;
    sequenceKey?: string;
  } = {}
): T {
  const { debounceDelay = 300, throttleLimit = 1000, sequenceKey } = options;
  
  const protectedComponent = { ...component } as T;
  
  // Wrap async methods with protection
  Object.keys(component).forEach(key => {
    const method = component[key];
    if (typeof method === 'function' && method.constructor.name === 'AsyncFunction') {
      if (sequenceKey) {
        (protectedComponent as any)[key] = createSequentialFetcher(`${sequenceKey}_${key}`, method);
      } else {
        (protectedComponent as any)[key] = createDebouncedUpdater(method, debounceDelay);
      }
    }
  });
  
  return protectedComponent;
}