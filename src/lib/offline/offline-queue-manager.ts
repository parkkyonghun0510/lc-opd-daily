import { NetworkError, NetworkErrorCode, OfflineQueueError, OfflineQueueErrorCode } from '@/types/errors';

// Queue item status
export enum QueueItemStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Queue item priority
export enum QueueItemPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
  MEDIUM
}

// Retry strategy
export enum RetryStrategy {
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR_BACKOFF = 'linear_backoff',
  FIXED_INTERVAL = 'fixed_interval',
  IMMEDIATE = 'immediate',
  EXPONENTIAL = "EXPONENTIAL"
}

// Queue item interface
export interface QueueItem {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  priority: QueueItemPriority;
  status: QueueItemStatus;
  retryCount: number;
  maxRetries: number;
  retryStrategy: RetryStrategy;
  retryDelay: number;
  createdAt: number;
  updatedAt: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  error?: string;
  metadata?: Record<string, any>;
  onSuccess?: (response: any) => void;
  onError?: (error: any) => void;
  onProgress?: (progress: number) => void;
}

// Queue configuration
export interface QueueConfig {
  maxConcurrent: number;
  maxRetries: number;
  defaultRetryStrategy: RetryStrategy;
  defaultRetryDelay: number;
  persistenceKey: string;
  enablePersistence: boolean;
  enableBackgroundSync: boolean;
  maxQueueSize: number;
  cleanupInterval: number;
  networkCheckInterval: number;
}

// Queue metrics
export interface QueueMetrics {
  totalItems: number;
  pendingItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  averageProcessingTime: number;
  successRate: number;
  lastProcessedAt?: number;
}

// Queue event types
export interface QueueEventMap {
  'item-added': QueueItem;
  'item-started': QueueItem;
  'item-completed': QueueItem;
  'item-failed': QueueItem;
  'item-cancelled': QueueItem;
  'queue-empty': void;
  'queue-full': void;
  'network-online': void;
  'network-offline': void;
  'processing-started': void;
  'processing-stopped': void;
}

// Default configuration
const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 3,
  maxRetries: 3,
  defaultRetryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
  defaultRetryDelay: 1000,
  persistenceKey: 'offline-queue',
  enablePersistence: true,
  enableBackgroundSync: true,
  maxQueueSize: 100,
  cleanupInterval: 60000, // 1 minute
  networkCheckInterval: 5000 // 5 seconds
};

export class OfflineQueueManager {
  updateConfig(config: Partial<QueueConfig>) {
    throw new Error('Method not implemented.');
  }
  start() {
    throw new Error('Method not implemented.');
  }
  stop() {
    throw new Error('Method not implemented.');
  }
  pause() {
    throw new Error('Method not implemented.');
  }
  resume() {
    throw new Error('Method not implemented.');
  }
  retry(id: string): any {
    throw new Error('Method not implemented.');
  }
  private queue: Map<string, QueueItem> = new Map();
  private processing: Set<string> = new Set();
  private config: QueueConfig;
  private isOnline: boolean = navigator.onLine;
  private isProcessing: boolean = false;
  private listeners: Map<keyof QueueEventMap, Set<Function>> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private networkCheckTimer?: NodeJS.Timeout;
  private processingStartTime?: number;
  private metrics: QueueMetrics = {
    totalItems: 0,
    pendingItems: 0,
    processingItems: 0,
    completedItems: 0,
    failedItems: 0,
    averageProcessingTime: 0,
    successRate: 0
  };

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialize();
  }

  private initialize(): void {
    // Load persisted queue items
    if (this.config.enablePersistence) {
      this.loadFromStorage();
    }

    // Setup network monitoring
    this.setupNetworkMonitoring();

    // Setup cleanup timer
    this.setupCleanupTimer();

    // Setup background sync if available
    if (this.config.enableBackgroundSync && 'serviceWorker' in navigator) {
      this.setupBackgroundSync();
    }

    // Start processing if online
    if (this.isOnline) {
      this.startProcessing();
    }
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.emit('network-online', undefined);
    this.startProcessing();
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.emit('network-offline', undefined);
    this.stopProcessing();
  };

  private setupNetworkMonitoring(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }

    // Periodic network check
    this.networkCheckTimer = setInterval(() => {
      this.checkNetworkStatus();
    }, this.config.networkCheckInterval);
  }

  private async checkNetworkStatus(): Promise<void> {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const wasOnline = this.isOnline;
      this.isOnline = response.ok;
      
      if (!wasOnline && this.isOnline) {
        this.emit('network-online', undefined);
        this.startProcessing();
      } else if (wasOnline && !this.isOnline) {
        this.emit('network-offline', undefined);
        this.stopProcessing();
      }
    } catch {
      const wasOnline = this.isOnline;
      this.isOnline = false;
      
      if (wasOnline) {
        this.emit('network-offline', undefined);
        this.stopProcessing();
      }
    }
  }

  private setupCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private async setupBackgroundSync(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await (registration as any).sync.register('offline-queue-sync');
      }
    } catch (error) {
      console.warn('Background sync not available:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.persistenceKey);
      if (stored) {
        const items: QueueItem[] = JSON.parse(stored);
        items.forEach(item => {
          // Reset processing status on load
          if (item.status === QueueItemStatus.PROCESSING) {
            item.status = QueueItemStatus.PENDING;
          }
          this.queue.set(item.id, item);
        });
        this.updateMetrics();
      }
    } catch (error) {
      console.error('Failed to load queue from storage:', error);
    }
  }

  private saveToStorage(): void {
    if (!this.config.enablePersistence) return;

    try {
      const items = Array.from(this.queue.values());
      localStorage.setItem(this.config.persistenceKey, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save queue to storage:', error);
    }
  }

  // Add item to queue
  public add(item: Omit<QueueItem, 'id' | 'status' | 'createdAt' | 'updatedAt'>): string {
    if (this.queue.size >= this.config.maxQueueSize) {
      this.emit('queue-full', undefined);
      const error: OfflineQueueError = {
        type: 'OFFLINE_QUEUE_ERROR',
        code: OfflineQueueErrorCode.QUEUE_FULL,
        queueCode: OfflineQueueErrorCode.QUEUE_FULL,
        message: 'Queue is full',
        timestamp: new Date(),
        severity: 'high',
        queueSize: this.queue.size,
        context: { operation: 'add', queueSize: this.queue.size }
      };
      throw error;
    }

    const queueItem: QueueItem = {
      ...item,
      id: crypto.randomUUID(),
      status: QueueItemStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: item.maxRetries ?? this.config.maxRetries,
      retryStrategy: item.retryStrategy ?? this.config.defaultRetryStrategy,
      retryDelay: item.retryDelay ?? this.config.defaultRetryDelay,
      priority: item.priority ?? QueueItemPriority.NORMAL
    };

    this.queue.set(queueItem.id, queueItem);
    this.saveToStorage();
    this.updateMetrics();
    this.emit('item-added', queueItem);

    // Start processing if online and not already processing
    if (this.isOnline && !this.isProcessing) {
      this.startProcessing();
    }

    return queueItem.id;
  }

  // Remove item from queue
  public remove(id: string): boolean {
    const item = this.queue.get(id);
    if (!item) return false;

    // Cancel if currently processing
    if (item.status === QueueItemStatus.PROCESSING) {
      item.status = QueueItemStatus.CANCELLED;
      this.processing.delete(id);
      this.emit('item-cancelled', item);
    }

    this.queue.delete(id);
    this.saveToStorage();
    this.updateMetrics();
    return true;
  }

  // Get item by ID
  public get(id: string): QueueItem | undefined {
    return this.queue.get(id);
  }

  // Get all items
  public getAll(): QueueItem[] {
    return Array.from(this.queue.values());
  }

  // Get items by status
  public getByStatus(status: QueueItemStatus): QueueItem[] {
    return Array.from(this.queue.values()).filter(item => item.status === status);
  }

  // Get items by priority
  public getByPriority(priority: QueueItemPriority): QueueItem[] {
    return Array.from(this.queue.values()).filter(item => item.priority === priority);
  }

  // Clear queue
  public clear(): void {
    this.queue.clear();
    this.processing.clear();
    this.saveToStorage();
    this.updateMetrics();
  }

  // Start processing queue
  public startProcessing(): void {
    if (this.isProcessing || !this.isOnline) return;

    this.isProcessing = true;
    this.processingStartTime = Date.now();
    this.emit('processing-started', undefined);
    this.processQueue();
  }

  // Stop processing queue
  public stopProcessing(): void {
    this.isProcessing = false;
    this.emit('processing-stopped', undefined);
  }

  // Process queue items
  private async processQueue(): Promise<void> {
    while (this.isProcessing && this.isOnline) {
      // Get next items to process
      const itemsToProcess = this.getNextItems();
      
      if (itemsToProcess.length === 0) {
        this.emit('queue-empty', undefined);
        break;
      }

      // Process items concurrently
      const promises = itemsToProcess.map(item => this.processItem(item));
      await Promise.allSettled(promises);

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
    this.emit('processing-stopped', undefined);
  }

  // Get next items to process based on priority and retry schedule
  private getNextItems(): QueueItem[] {
    const now = Date.now();
    const availableSlots = this.config.maxConcurrent - this.processing.size;
    
    if (availableSlots <= 0) return [];

    return Array.from(this.queue.values())
      .filter(item => 
        item.status === QueueItemStatus.PENDING &&
        (!item.nextRetryAt || item.nextRetryAt <= now)
      )
      .sort((a, b) => {
        // Sort by priority first, then by creation time
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.createdAt - b.createdAt;
      })
      .slice(0, availableSlots);
  }

  // Process individual item
  private async processItem(item: QueueItem): Promise<void> {
    this.processing.add(item.id);
    item.status = QueueItemStatus.PROCESSING;
    item.lastAttemptAt = Date.now();
    item.updatedAt = Date.now();
    
    this.saveToStorage();
    this.updateMetrics();
    this.emit('item-started', item);

    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body ? JSON.stringify(item.body) : undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Success
      item.status = QueueItemStatus.COMPLETED;
      item.updatedAt = Date.now();
      this.processing.delete(item.id);
      
      this.saveToStorage();
      this.updateMetrics();
      this.emit('item-completed', item);
      
      // Call success callback
      item.onSuccess?.(result);
      
    } catch (error) {
      this.processing.delete(item.id);
      await this.handleItemError(item, error);
    }
  }

  // Handle item processing error
  private async handleItemError(item: QueueItem, error: any): Promise<void> {
    item.retryCount++;
    item.error = error instanceof Error ? error.message : String(error);
    item.updatedAt = Date.now();

    if (item.retryCount >= item.maxRetries) {
      // Max retries reached
      item.status = QueueItemStatus.FAILED;
      this.emit('item-failed', item);
      item.onError?.(error);
    } else {
      // Schedule retry
      item.status = QueueItemStatus.PENDING;
      item.nextRetryAt = Date.now() + this.calculateRetryDelay(item);
    }

    this.saveToStorage();
    this.updateMetrics();
  }

  // Calculate retry delay based on strategy
  private calculateRetryDelay(item: QueueItem): number {
    const baseDelay = item.retryDelay;
    const retryCount = item.retryCount;

    switch (item.retryStrategy) {
      case RetryStrategy.EXPONENTIAL_BACKOFF:
        return baseDelay * Math.pow(2, retryCount - 1);
      
      case RetryStrategy.LINEAR_BACKOFF:
        return baseDelay * retryCount;
      
      case RetryStrategy.FIXED_INTERVAL:
        return baseDelay;
      
      case RetryStrategy.IMMEDIATE:
        return 0;
      
      default:
        return baseDelay;
    }
  }

  // Cleanup completed and old failed items
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    const itemsToRemove: string[] = [];
    
    this.queue.forEach((item, id) => {
      const age = now - item.updatedAt;
      
      if (
        (item.status === QueueItemStatus.COMPLETED && age > maxAge) ||
        (item.status === QueueItemStatus.FAILED && age > maxAge) ||
        (item.status === QueueItemStatus.CANCELLED && age > maxAge)
      ) {
        itemsToRemove.push(id);
      }
    });
    
    itemsToRemove.forEach(id => this.queue.delete(id));
    
    if (itemsToRemove.length > 0) {
      this.saveToStorage();
      this.updateMetrics();
    }
  }

  // Update metrics
  private updateMetrics(): void {
    const items = Array.from(this.queue.values());
    
    this.metrics = {
      totalItems: items.length,
      pendingItems: items.filter(item => item.status === QueueItemStatus.PENDING).length,
      processingItems: items.filter(item => item.status === QueueItemStatus.PROCESSING).length,
      completedItems: items.filter(item => item.status === QueueItemStatus.COMPLETED).length,
      failedItems: items.filter(item => item.status === QueueItemStatus.FAILED).length,
      averageProcessingTime: this.calculateAverageProcessingTime(items),
      successRate: this.calculateSuccessRate(items),
      lastProcessedAt: this.getLastProcessedTime(items)
    };
  }

  private calculateAverageProcessingTime(items: QueueItem[]): number {
    const completedItems = items.filter(item => 
      item.status === QueueItemStatus.COMPLETED && 
      item.lastAttemptAt && 
      item.createdAt
    );
    
    if (completedItems.length === 0) return 0;
    
    const totalTime = completedItems.reduce((sum, item) => 
      sum + (item.lastAttemptAt! - item.createdAt), 0
    );
    
    return totalTime / completedItems.length;
  }

  private calculateSuccessRate(items: QueueItem[]): number {
    const processedItems = items.filter(item => 
      item.status === QueueItemStatus.COMPLETED || 
      item.status === QueueItemStatus.FAILED
    );
    
    if (processedItems.length === 0) return 0;
    
    const successfulItems = processedItems.filter(item => 
      item.status === QueueItemStatus.COMPLETED
    );
    
    return (successfulItems.length / processedItems.length) * 100;
  }

  private getLastProcessedTime(items: QueueItem[]): number | undefined {
    const processedItems = items.filter(item => 
      item.lastAttemptAt && (
        item.status === QueueItemStatus.COMPLETED || 
        item.status === QueueItemStatus.FAILED
      )
    );
    
    if (processedItems.length === 0) return undefined;
    
    return Math.max(...processedItems.map(item => item.lastAttemptAt!));
  }

  // Get current metrics
  public getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  // Event handling
  public on<K extends keyof QueueEventMap>(
    event: K,
    listener: (data: QueueEventMap[K]) => void
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  public off<K extends keyof QueueEventMap>(
    event: K,
    listener: (data: QueueEventMap[K]) => void
  ): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  private emit<K extends keyof QueueEventMap>(event: K, data: QueueEventMap[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in queue event listener for ${event}:`, error);
        }
      });
    }
  }

  // Destroy queue manager
  public destroy(): void {
    this.stopProcessing();
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    if (this.networkCheckTimer) {
      clearInterval(this.networkCheckTimer);
      this.networkCheckTimer = undefined;
    }
    
    // Remove network event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    
    this.listeners.clear();
    this.queue.clear();
    this.processing.clear();
  }
}

// Global queue manager instance
export const globalOfflineQueue = new OfflineQueueManager();

// Factory function for creating specialized queue managers
export function createOfflineQueue(config: Partial<QueueConfig> = {}): OfflineQueueManager {
  return new OfflineQueueManager(config);
}

// Specialized queue managers
export const apiOfflineQueue = createOfflineQueue({
  persistenceKey: 'api-offline-queue',
  maxConcurrent: 5,
  maxRetries: 5,
  defaultRetryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF
});

export const userOfflineQueue = createOfflineQueue({
  persistenceKey: 'user-offline-queue',
  maxConcurrent: 2,
  maxRetries: 3,
  defaultRetryStrategy: RetryStrategy.LINEAR_BACKOFF
});

export const criticalOfflineQueue = createOfflineQueue({
  persistenceKey: 'critical-offline-queue',
  maxConcurrent: 1,
  maxRetries: 10,
  defaultRetryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
  defaultRetryDelay: 500
});