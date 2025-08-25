/**
 * Unified SSE Handler
 * 
 * Consolidates all SSE server-side functionality with automatic fallback mechanisms.
 * Supports Redis, Dragonfly, and in-memory implementations with seamless switching.
 */

import { EventEmitter } from 'events';
import { BaseSSEHandler, SSEClient, SSEEvent } from './sseHandler';

// Import handlers with lazy loading to prevent blocking
let redisSSEHandler: any = null;
let dragonflySSEHandler: any = null;
let baseSSEHandler: BaseSSEHandler | null = null;

// Handler types
export type HandlerType = 'dragonfly' | 'redis' | 'memory';

// Unified configuration
export interface UnifiedSSEConfig {
  preferredHandler?: HandlerType;
  enableFallback?: boolean;
  initializationTimeout?: number;
  enableAnalytics?: boolean;
  enablePersistence?: boolean;
  maxOfflineMessages?: number;
  messageRetentionHours?: number;
  enableDeadLetterQueue?: boolean;
  enableMessageRouting?: boolean;
  enableClustering?: boolean;
}

// Handler status
export interface HandlerStatus {
  type: HandlerType;
  isReady: boolean;
  clientCount: number;
  uptime: number;
  lastError?: string;
  performance: {
    messagesPerSecond: number;
    averageLatency: number;
    errorRate: number;
  };
}

// Message with routing and persistence options
export interface UnifiedSSEMessage extends SSEEvent {
  targetUserId?: string;
  targetClientIds?: string[];
  broadcast?: boolean;
  persistence?: boolean;
  priority?: number;
  ttl?: number;
  retryCount?: number;
  routing?: {
    branches?: string[];
    roles?: string[];
    permissions?: string[];
  };
  analytics?: {
    source: string;
    category: string;
    metadata?: Record<string, any>;
  };
}

class UnifiedSSEHandler extends EventEmitter {
  private activeHandler: BaseSSEHandler | null = null;
  private handlerType: HandlerType = 'memory';
  private config: Required<UnifiedSSEConfig>;
  private initializationPromise: Promise<void> | null = null;
  private startTime: number = Date.now();
  private messageCount: number = 0;
  private errorCount: number = 0;
  private latencySum: number = 0;
  private latencyCount: number = 0;

  constructor(config: UnifiedSSEConfig = {}) {
    super();

    this.config = {
      preferredHandler: 'dragonfly',
      enableFallback: true,
      initializationTimeout: 15000,
      enableAnalytics: true,
      enablePersistence: true,
      maxOfflineMessages: 1000,
      messageRetentionHours: 24,
      enableDeadLetterQueue: true,
      enableMessageRouting: true,
      enableClustering: true,
      ...config
    };

    // Start initialization
    this.initialize();
  }

  /**
   * Initialize the best available handler
   */
  private async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    const handlers: Array<{ type: HandlerType; loader: () => Promise<any> }> = [];

    // Add handlers based on preference
    if (this.config.preferredHandler === 'dragonfly') {
      handlers.push(
        { type: 'dragonfly', loader: () => this.loadDragonflyHandler() },
        { type: 'redis', loader: () => this.loadRedisHandler() },
        { type: 'memory', loader: () => this.loadBaseHandler() }
      );
    } else if (this.config.preferredHandler === 'redis') {
      handlers.push(
        { type: 'redis', loader: () => this.loadRedisHandler() },
        { type: 'dragonfly', loader: () => this.loadDragonflyHandler() },
        { type: 'memory', loader: () => this.loadBaseHandler() }
      );
    } else {
      handlers.push(
        { type: 'memory', loader: () => this.loadBaseHandler() }
      );
    }

    // Try each handler in order
    for (const { type, loader } of handlers) {
      try {
        console.log(`[UnifiedSSE] Attempting to initialize ${type} handler`);

        const handler = await Promise.race([
          loader(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Initialization timeout')), this.config.initializationTimeout)
          )
        ]);

        if (handler && await this.validateHandler(handler)) {
          this.activeHandler = handler;
          this.handlerType = type;
          console.log(`[UnifiedSSE] Successfully initialized ${type} handler`);
          this.emit('handlerReady', { type, handler });
          return;
        }
      } catch (error) {
        console.warn(`[UnifiedSSE] Failed to initialize ${type} handler:`, error);

        if (!this.config.enableFallback) {
          throw error;
        }
      }
    }

    throw new Error('Failed to initialize any SSE handler');
  }

  /**
   * Load Dragonfly handler with lazy initialization
   */
  private async loadDragonflyHandler(): Promise<any> {
    if (!dragonflySSEHandler) {
      const module = await import('./dragonflySSEHandler');
      dragonflySSEHandler = module.default;
    }

    if (dragonflySSEHandler && typeof dragonflySSEHandler.ensureInitialized === 'function') {
      const isReady = await dragonflySSEHandler.ensureInitialized();
      if (isReady) {
        return dragonflySSEHandler;
      }
    }

    throw new Error('Dragonfly handler not available or failed to initialize');
  }

  /**
   * Load Redis handler with lazy initialization
   */
  private async loadRedisHandler(): Promise<any> {
    if (!redisSSEHandler) {
      const module = await import('./redisSSEHandler');
      redisSSEHandler = module.default;
    }

    if (redisSSEHandler) {
      return redisSSEHandler;
    }

    throw new Error('Redis handler not available');
  }

  /**
   * Load base handler (always available)
   */
  private async loadBaseHandler(): Promise<BaseSSEHandler> {
    if (!baseSSEHandler) {
      const { BaseSSEHandler } = await import('./sseHandler');
      baseSSEHandler = new BaseSSEHandler();
    }

    return baseSSEHandler;
  }

  /**
   * Validate that a handler is working correctly
   */
  private async validateHandler(handler: any): Promise<boolean> {
    try {
      // Check if handler has required methods
      const requiredMethods = ['addClient', 'removeClient', 'sendEventToUser', 'broadcastEvent'];
      for (const method of requiredMethods) {
        if (typeof handler[method] !== 'function') {
          console.warn(`[UnifiedSSE] Handler missing required method: ${method}`);
          return false;
        }
      }

      // Test basic functionality if possible
      if (typeof handler.getStats === 'function') {
        handler.getStats();
      }

      return true;
    } catch (error) {
      console.warn('[UnifiedSSE] Handler validation failed:', error);
      return false;
    }
  }

  /**
   * Ensure handler is ready before operations
   */
  private async ensureReady(): Promise<void> {
    if (!this.activeHandler) {
      await this.initialize();
    }

    if (!this.activeHandler) {
      throw new Error('No SSE handler available');
    }
  }

  /**
   * Add a client to the SSE handler
   */
  async addClient(
    clientId: string,
    userId: string,
    response: any,
    metadata: any = {}
  ): Promise<void> {
    await this.ensureReady();

    try {
      this.activeHandler!.addClient(clientId, userId, response, {
        ...metadata,
        handlerType: this.handlerType,
        connectedAt: new Date(),
        lastActivity: new Date()
      });

      this.emit('clientAdded', { clientId, userId, handlerType: this.handlerType });
    } catch (error) {
      this.errorCount++;
      console.error('[UnifiedSSE] Error adding client:', error);
      throw error;
    }
  }

  /**
   * Remove a client from the SSE handler
   */
  async removeClient(clientId: string): Promise<void> {
    await this.ensureReady();

    try {
      this.activeHandler!.removeClient(clientId);
      this.emit('clientRemoved', { clientId, handlerType: this.handlerType });
    } catch (error) {
      this.errorCount++;
      console.error('[UnifiedSSE] Error removing client:', error);
      throw error;
    }
  }

  /**
   * Send event to a specific user with enhanced routing
   */
  async sendEventToUser(
    userId: string,
    type: string,
    data: any,
    options: Partial<UnifiedSSEMessage> = {}
  ): Promise<number> {
    await this.ensureReady();

    const startTime = Date.now();

    try {
      const message: UnifiedSSEMessage = {
        type,
        data,
        id: options.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        retry: options.retry,
        targetUserId: userId,
        ...options
      };

      // Apply message routing if enabled
      if (this.config.enableMessageRouting && options.routing) {
        // TODO: Implement advanced routing logic
        console.log('[UnifiedSSE] Message routing:', options.routing);
      }

      // Send via active handler
      const sentCount = this.activeHandler!.sendEventToUser(userId, type, data, {
        id: message.id,
        retry: message.retry
      });

      // Track analytics
      if (this.config.enableAnalytics) {
        this.trackMessage(message, Date.now() - startTime);
      }

      // Handle persistence if enabled
      if (this.config.enablePersistence && options.persistence) {
        await this.persistMessage(message);
      }

      this.messageCount++;
      this.emit('messageSent', { message, sentCount, handlerType: this.handlerType });

      return sentCount;
    } catch (error) {
      this.errorCount++;
      console.error('[UnifiedSSE] Error sending event to user:', error);

      // Handle dead letter queue if enabled
      if (this.config.enableDeadLetterQueue) {
        await this.handleDeadLetter({ userId, type, data, options, error });
      }

      throw error;
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  async broadcastEvent(
    type: string,
    data: any,
    options: Partial<UnifiedSSEMessage> = {}
  ): Promise<number> {
    await this.ensureReady();

    const startTime = Date.now();

    try {
      const message: UnifiedSSEMessage = {
        type,
        data,
        id: options.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        retry: options.retry,
        broadcast: true,
        ...options
      };

      const sentCount = this.activeHandler!.broadcastEvent(type, data, {
        id: message.id,
        retry: message.retry
      });

      // Track analytics
      if (this.config.enableAnalytics) {
        this.trackMessage(message, Date.now() - startTime);
      }

      this.messageCount++;
      this.emit('messageBroadcast', { message, sentCount, handlerType: this.handlerType });

      return sentCount;
    } catch (error) {
      this.errorCount++;
      console.error('[UnifiedSSE] Error broadcasting event:', error);
      throw error;
    }
  }

  /**
   * Update client activity
   */
  async updateClientActivity(clientId: string): Promise<void> {
    await this.ensureReady();

    try {
      if (typeof this.activeHandler!.updateClientActivity === 'function') {
        this.activeHandler!.updateClientActivity(clientId);
      }
    } catch (error) {
      console.error('[UnifiedSSE] Error updating client activity:', error);
    }
  }

  /**
   * Get handler status and metrics
   */
  async getStatus(): Promise<HandlerStatus> {
    await this.ensureReady();

    const uptime = Date.now() - this.startTime;
    let clientCount = 0;

    if (typeof this.activeHandler!.getStats === 'function') {
      const stats = this.activeHandler!.getStats();
      clientCount = stats.totalClients || 0;
    }

    return {
      type: this.handlerType,
      isReady: !!this.activeHandler,
      clientCount,
      uptime,
      performance: {
        messagesPerSecond: this.messageCount / (uptime / 1000),
        averageLatency: this.latencyCount > 0 ? this.latencySum / this.latencyCount : 0,
        errorRate: this.messageCount > 0 ? this.errorCount / this.messageCount : 0
      }
    };
  }

  /**
   * Get detailed connection statistics from the active handler
   */
  async getStats(): Promise<{ totalClients: number; totalUsers: number; clientsByUser: Record<string, number> }> {
    await this.ensureReady();

    if (this.activeHandler && typeof this.activeHandler.getStats === 'function') {
      // Base/extended handlers expose getStats synchronously
      return this.activeHandler.getStats();
    }

    return { totalClients: 0, totalUsers: 0, clientsByUser: {} };
  }

  /**
   * Get client count
   */
  async getClientCount(): Promise<number> {
    await this.ensureReady();

    if (typeof this.activeHandler!.getStats === 'function') {
      const stats = this.activeHandler!.getStats();
      return stats.totalClients || 0;
    }

    return 0;
  }

  /**
   * Switch to a different handler type
   */
  async switchHandler(type: HandlerType): Promise<void> {
    console.log(`[UnifiedSSE] Switching to ${type} handler`);

    // Store current clients if possible
    const currentClients = this.activeHandler ? await this.exportClients() : [];

    // Reset state
    this.activeHandler = null;
    this.initializationPromise = null;

    // Update config and reinitialize
    this.config.preferredHandler = type;
    await this.initialize();

    // Restore clients if possible
    if (currentClients.length > 0) {
      await this.importClients(currentClients);
    }

    this.emit('handlerSwitched', { from: this.handlerType, to: type });
  }

  /**
   * Track message analytics
   */
  private trackMessage(message: UnifiedSSEMessage, latency: number): void {
    this.latencySum += latency;
    this.latencyCount++;

    if (message.analytics) {
      this.emit('messageAnalytics', {
        ...message.analytics,
        latency,
        handlerType: this.handlerType,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Persist message for offline delivery
   */
  private async persistMessage(message: UnifiedSSEMessage): Promise<void> {
    // TODO: Implement message persistence logic
    console.log('[UnifiedSSE] Persisting message:', message.id);
  }

  /**
   * Handle dead letter queue
   */
  private async handleDeadLetter(context: any): Promise<void> {
    // TODO: Implement dead letter queue logic
    console.log('[UnifiedSSE] Adding to dead letter queue:', context);
  }

  /**
   * Export current clients (for handler switching)
   */
  private async exportClients(): Promise<any[]> {
    // TODO: Implement client export logic
    return [];
  }

  /**
   * Import clients (for handler switching)
   */
  private async importClients(clients: any[]): Promise<void> {
    // TODO: Implement client import logic
    console.log('[UnifiedSSE] Importing clients:', clients.length);
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[UnifiedSSE] Shutting down');

    if (this.activeHandler && typeof this.activeHandler.destroy === 'function') {
      this.activeHandler.destroy();
    }

    this.activeHandler = null;
    this.removeAllListeners();
  }
}

// Create singleton instance
const defaultInitTimeoutMs = (() => {
  const val = process.env.SSE_INIT_TIMEOUT_MS;
  const parsed = val ? parseInt(val, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
})();

console.log(`[UnifiedSSE] Using initialization timeout: ${defaultInitTimeoutMs}ms`);
const unifiedSSEHandler = new UnifiedSSEHandler({ initializationTimeout: defaultInitTimeoutMs });

// Export singleton and class
export default unifiedSSEHandler;
export { UnifiedSSEHandler };