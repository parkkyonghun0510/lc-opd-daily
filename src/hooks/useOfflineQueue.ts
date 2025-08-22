import { useState, useEffect, useCallback, useRef } from 'react';
import { OfflineQueueManager, QueueItem, QueueConfig, QueueMetrics, QueueItemPriority, RetryStrategy } from '@/lib/offline/offline-queue-manager';

export interface UseOfflineQueueOptions {
  config?: Partial<QueueConfig>;
  autoStart?: boolean;
  onItemAdded?: (item: QueueItem) => void;
  onItemRemoved?: (item: QueueItem) => void;
  onItemProcessed?: (item: QueueItem) => void;
  onItemFailed?: (item: QueueItem, error: Error) => void;
  onQueueEmpty?: () => void;
  onNetworkChange?: (isOnline: boolean) => void;
}

export interface UseOfflineQueueReturn {
  queueManager: OfflineQueueManager;
  metrics: QueueMetrics;
  isOnline: boolean;
  isProcessing: boolean;
  addToQueue: (item: Omit<QueueItem, 'id' | 'createdAt' | 'status' | 'retryCount'>) => Promise<string>;
  removeFromQueue: (id: string) => Promise<boolean>;
  clearQueue: () => Promise<void>;
  pauseProcessing: () => void;
  resumeProcessing: () => void;
  retryItem: (id: string) => Promise<boolean>;
  getQueueItems: () => QueueItem[];
  refreshMetrics: () => void;
}

// Global queue manager instance
const globalQueueManager = new OfflineQueueManager();

export function useOfflineQueue(options: UseOfflineQueueOptions = {}): UseOfflineQueueReturn {
  const {
    config,
    autoStart = true,
    onItemAdded,
    onItemRemoved,
    onItemProcessed,
    onItemFailed,
    onQueueEmpty,
    onNetworkChange
  } = options;

  const queueManager = useRef(globalQueueManager);
  const [metrics, setMetrics] = useState<QueueMetrics>(queueManager.current.getMetrics());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize queue manager with config
  useEffect(() => {
    if (config) {
      queueManager.current.updateConfig(config);
    }

    if (autoStart) {
      queueManager.current.start();
    }

    return () => {
      if (!autoStart) {
        queueManager.current.stop();
      }
    };
  }, [config, autoStart]);

  // Set up event listeners
  useEffect(() => {
    const manager = queueManager.current;

    const handleItemAdded = (item: QueueItem) => {
      setMetrics(manager.getMetrics());
      onItemAdded?.(item);
    };

    const handleItemRemoved = (item: QueueItem) => {
      setMetrics(manager.getMetrics());
      onItemRemoved?.(item);
    };

    const handleItemProcessed = (item: QueueItem) => {
      setMetrics(manager.getMetrics());
      onItemProcessed?.(item);
    };

    const handleItemFailed = (item: QueueItem, error: Error) => {
      setMetrics(manager.getMetrics());
      onItemFailed?.(item, error);
    };

    const handleQueueEmpty = () => {
      setMetrics(manager.getMetrics());
      setIsProcessing(false);
      onQueueEmpty?.();
    };

    const handleNetworkChange = (online: boolean) => {
      setIsOnline(online);
      onNetworkChange?.(online);
    };

    const handleProcessingStart = () => {
      setIsProcessing(true);
    };

    const handleProcessingStop = () => {
      setIsProcessing(false);
    };

    // Add event listeners
    manager.on('itemAdded', handleItemAdded);
    manager.on('itemRemoved', handleItemRemoved);
    manager.on('itemProcessed', handleItemProcessed);
    manager.on('itemFailed', handleItemFailed);
    manager.on('queueEmpty', handleQueueEmpty);
    manager.on('networkChange', handleNetworkChange);
    manager.on('processingStart', handleProcessingStart);
    manager.on('processingStop', handleProcessingStop);

    return () => {
      manager.off('itemAdded', handleItemAdded);
      manager.off('itemRemoved', handleItemRemoved);
      manager.off('itemProcessed', handleItemProcessed);
      manager.off('itemFailed', handleItemFailed);
      manager.off('queueEmpty', handleQueueEmpty);
      manager.off('networkChange', handleNetworkChange);
      manager.off('processingStart', handleProcessingStart);
      manager.off('processingStop', handleProcessingStop);
    };
  }, [onItemAdded, onItemRemoved, onItemProcessed, onItemFailed, onQueueEmpty, onNetworkChange]);

  const addToQueue = useCallback(async (item: Omit<QueueItem, 'id' | 'createdAt' | 'status' | 'retryCount'>) => {
    const queueItem: QueueItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: 'pending',
      retryCount: 0,
      maxRetries: item.maxRetries || 3,
      retryStrategy: item.retryStrategy || RetryStrategy.EXPONENTIAL,
      retryDelay: item.retryDelay || 1000
    };

    const id = await queueManager.current.add(queueItem);
    return id;
  }, []);

  const removeFromQueue = useCallback(async (id: string) => {
    return await queueManager.current.remove(id);
  }, []);

  const clearQueue = useCallback(async () => {
    await queueManager.current.clear();
    setMetrics(queueManager.current.getMetrics());
  }, []);

  const pauseProcessing = useCallback(() => {
    queueManager.current.pause();
    setIsProcessing(false);
  }, []);

  const resumeProcessing = useCallback(() => {
    queueManager.current.resume();
  }, []);

  const retryItem = useCallback(async (id: string) => {
    return await queueManager.current.retry(id);
  }, []);

  const getQueueItems = useCallback(() => {
    return queueManager.current.getAll();
  }, []);

  const refreshMetrics = useCallback(() => {
    setMetrics(queueManager.current.getMetrics());
  }, []);

  return {
    queueManager: queueManager.current,
    metrics,
    isOnline,
    isProcessing,
    addToQueue,
    removeFromQueue,
    clearQueue,
    pauseProcessing,
    resumeProcessing,
    retryItem,
    getQueueItems,
    refreshMetrics
  };
}

// Specialized hooks for different use cases
export function useOfflineQueueForApi(options: UseOfflineQueueOptions = {}) {
  return useOfflineQueue({
    ...options,
    config: {
      maxSize: 100,
      maxRetries: 3,
      retryDelay: 1000,
      persistenceKey: 'api-queue',
      ...options.config
    }
  });
}

export function useOfflineQueueForUploads(options: UseOfflineQueueOptions = {}) {
  return useOfflineQueue({
    ...options,
    config: {
      maxSize: 50,
      maxRetries: 5,
      retryDelay: 2000,
      persistenceKey: 'upload-queue',
      ...options.config
    }
  });
}

export function useOfflineQueueForAnalytics(options: UseOfflineQueueOptions = {}) {
  return useOfflineQueue({
    ...options,
    config: {
      maxSize: 200,
      maxRetries: 2,
      retryDelay: 500,
      persistenceKey: 'analytics-queue',
      ...options.config
    }
  });
}

// Hook for offline-aware API calls
export function useOfflineAwareApi<T = any>(options: UseOfflineQueueOptions = {}) {
  const queue = useOfflineQueue(options);

  const executeRequest = useCallback(async (
    request: () => Promise<T>,
    fallbackData?: T,
    queueOptions?: {
      priority?: QueueItemPriority;
      retryStrategy?: RetryStrategy;
      maxRetries?: number;
      retryDelay?: number;
    }
  ): Promise<T> => {
    if (queue.isOnline) {
      try {
        return await request();
      } catch (error) {
        // If request fails and we're online, queue it for retry
        await queue.addToQueue({
          data: { request: request.toString() },
          priority: queueOptions?.priority || QueueItemPriority.MEDIUM,
          retryStrategy: queueOptions?.retryStrategy || RetryStrategy.EXPONENTIAL,
          maxRetries: queueOptions?.maxRetries || 3,
          retryDelay: queueOptions?.retryDelay || 1000,
          operation: 'api-request'
        });
        
        if (fallbackData !== undefined) {
          return fallbackData;
        }
        throw error;
      }
    } else {
      // If offline, queue the request
      await queue.addToQueue({
        data: { request: request.toString() },
        priority: queueOptions?.priority || QueueItemPriority.MEDIUM,
        retryStrategy: queueOptions?.retryStrategy || RetryStrategy.EXPONENTIAL,
        maxRetries: queueOptions?.maxRetries || 3,
        retryDelay: queueOptions?.retryDelay || 1000,
        operation: 'api-request'
      });
      
      if (fallbackData !== undefined) {
        return fallbackData;
      }
      
      throw new Error('Request queued for offline processing');
    }
  }, [queue]);

  return {
    ...queue,
    executeRequest
  };
}

// Hook for batch operations
export function useOfflineBatchQueue(options: UseOfflineQueueOptions = {}) {
  const queue = useOfflineQueue({
    ...options,
    config: {
      maxSize: 500,
      maxRetries: 3,
      retryDelay: 1000,
      persistenceKey: 'batch-queue',
      ...options.config
    }
  });

  const addBatch = useCallback(async (
    items: Array<Omit<QueueItem, 'id' | 'createdAt' | 'status' | 'retryCount'>>
  ) => {
    const ids: string[] = [];
    for (const item of items) {
      const id = await queue.addToQueue(item);
      ids.push(id);
    }
    return ids;
  }, [queue]);

  const removeBatch = useCallback(async (ids: string[]) => {
    const results: boolean[] = [];
    for (const id of ids) {
      const result = await queue.removeFromQueue(id);
      results.push(result);
    }
    return results;
  }, [queue]);

  return {
    ...queue,
    addBatch,
    removeBatch
  };
}

// Hook for priority-based queue management
export function usePriorityOfflineQueue(options: UseOfflineQueueOptions = {}) {
  const queue = useOfflineQueue(options);

  const addHighPriority = useCallback(async (
    item: Omit<QueueItem, 'id' | 'createdAt' | 'status' | 'retryCount' | 'priority'>
  ) => {
    return await queue.addToQueue({
      ...item,
      priority: QueueItemPriority.HIGH
    });
  }, [queue]);

  const addLowPriority = useCallback(async (
    item: Omit<QueueItem, 'id' | 'createdAt' | 'status' | 'retryCount' | 'priority'>
  ) => {
    return await queue.addToQueue({
      ...item,
      priority: QueueItemPriority.LOW
    });
  }, [queue]);

  const getItemsByPriority = useCallback((priority: QueueItemPriority) => {
    return queue.getQueueItems().filter(item => item.priority === priority);
  }, [queue]);

  return {
    ...queue,
    addHighPriority,
    addLowPriority,
    getItemsByPriority
  };
}