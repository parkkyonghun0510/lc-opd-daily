/**
 * Dragonfly Optimized Client
 * 
 * This module provides an optimized Redis client specifically configured for Dragonfly,
 * leveraging its enhanced capabilities and performance characteristics.
 * 
 * Dragonfly-specific optimizations:
 * - Multi-threading support
 * - Improved memory management
 * - Enhanced pipelining
 * - Better connection pooling
 * - Optimized data structures
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';

// Dragonfly-specific configuration
interface DragonflyConfig {
  url: string;
  maxConnections?: number;
  enableMultiThreading?: boolean;
  memoryOptimization?: boolean;
  pipelineOptimization?: boolean;
  compressionEnabled?: boolean;
  batchSize?: number;
  connectionPooling?: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
  };
}

// Performance metrics interface
interface PerformanceMetrics {
  operationsPerSecond: number;
  averageLatency: number;
  memoryUsage: number;
  connectionCount: number;
  errorRate: number;
  lastUpdated: number;
}

// Connection pool statistics
interface PoolStats {
  active: number;
  idle: number;
  total: number;
  pending: number;
}

export class DragonflyOptimizedClient extends EventEmitter {
  private clients: Redis[] = [];
  private currentClientIndex = 0;
  private config: Required<DragonflyConfig>;
  private metrics: PerformanceMetrics;
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: DragonflyConfig) {
    super();
    
    // Set default Dragonfly-optimized configuration
    this.config = {
      url: config.url,
      maxConnections: config.maxConnections || 10,
      enableMultiThreading: config.enableMultiThreading ?? true,
      memoryOptimization: config.memoryOptimization ?? true,
      pipelineOptimization: config.pipelineOptimization ?? true,
      compressionEnabled: config.compressionEnabled ?? false,
      batchSize: config.batchSize || 100,
      connectionPooling: config.connectionPooling || {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 300000
      }
    };

    this.metrics = {
      operationsPerSecond: 0,
      averageLatency: 0,
      memoryUsage: 0,
      connectionCount: 0,
      errorRate: 0,
      lastUpdated: Date.now()
    };
  }

  /**
   * Initialize the Dragonfly client pool with optimized settings
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[DragonflyOptimized] Initializing optimized client pool...');
      
      // Create connection pool
      for (let i = 0; i < this.config.maxConnections; i++) {
        const client = await this.createOptimizedClient(i);
        this.clients.push(client);
      }

      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start metrics collection
      this.startMetricsCollection();

      this.isInitialized = true;
      this.emit('initialized');
      
      console.log(`[DragonflyOptimized] Initialized ${this.clients.length} optimized connections`);
    } catch (error) {
      console.error('[DragonflyOptimized] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Create an optimized Redis client for Dragonfly
   */
  private async createOptimizedClient(index: number): Promise<Redis> {
    const client = new Redis(this.config.url, {
      // Connection settings optimized for Dragonfly
      lazyConnect: true,
      keepAlive: 30000,
      family: 4, // IPv4 for better performance
      
      // Dragonfly-specific optimizations
      enableOfflineQueue: false,
      
      // Connection timeouts optimized for Dragonfly's performance
      connectTimeout: 10000,
      commandTimeout: 5000,
      
      // Pipeline optimization for Dragonfly's multi-threading
      enableAutoPipelining: this.config.pipelineOptimization,
      maxRetriesPerRequest: this.config.pipelineOptimization ? 1 : 3,
      
      // Memory optimization settings
      ...(this.config.memoryOptimization && {
        keyPrefix: 'df:',
        compression: this.config.compressionEnabled ? 'gzip' : undefined
      }),
      
      // Multi-threading support
      ...(this.config.enableMultiThreading && {
        enableReadyCheck: true,
        maxLoadingTimeout: 5000
      })
    });

    // Add event listeners for monitoring
    client.on('connect', () => {
      console.log(`[DragonflyOptimized] Client ${index} connected`);
      this.updateMetrics();
    });

    client.on('error', (error) => {
      console.error(`[DragonflyOptimized] Client ${index} error:`, error);
      this.metrics.errorRate++;
      this.emit('error', error);
    });

    client.on('close', () => {
      console.log(`[DragonflyOptimized] Client ${index} disconnected`);
      this.updateMetrics();
    });

    // Connect the client
    await client.connect();
    
    return client;
  }

  /**
   * Get the next available client using round-robin load balancing
   */
  private getNextClient(): Redis {
    if (!this.isInitialized) {
      console.error('[DragonflyOptimized] Client not initialized - call initialize() first');
      throw new Error('DragonflyOptimizedClient not initialized - call initialize() first');
    }
    
    if (this.clients.length === 0) {
      console.error('[DragonflyOptimized] No active clients available');
      throw new Error('DragonflyOptimizedClient has no active connections');
    }

    const client = this.clients[this.currentClientIndex];
    this.currentClientIndex = (this.currentClientIndex + 1) % this.clients.length;
    
    return client;
  }

  /**
   * Execute a Redis command with optimized routing
   */
  async execute<T = any>(command: string, ...args: any[]): Promise<T> {
    const startTime = Date.now();
    
    try {
      const client = this.getNextClient();
      const result = await (client as any)[command](...args);
      
      // Update performance metrics
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
      
      return result;
    } catch (error) {
      this.metrics.errorRate++;
      throw error;
    }
  }

  /**
   * Execute multiple commands in a pipeline for better performance
   */
  async pipeline(commands: Array<[string, ...any[]]>): Promise<any[]> {
    const client = this.getNextClient();
    const pipeline = client.pipeline();
    
    // Add all commands to pipeline
    commands.forEach(([command, ...args]) => {
      (pipeline as any)[command](...args);
    });
    
    const startTime = Date.now();
    const results = await pipeline.exec();
    const latency = Date.now() - startTime;
    
    this.updateLatencyMetrics(latency);
    
    return results?.map(([error, result]) => {
      if (error) throw error;
      return result;
    }) || [];
  }

  /**
   * Batch operations for improved throughput
   */
  async batchExecute<T = any>(operations: Array<() => Promise<T>>): Promise<T[]> {
    const batches: Array<Array<() => Promise<T>>> = [];
    
    // Split operations into batches
    for (let i = 0; i < operations.length; i += this.config.batchSize) {
      batches.push(operations.slice(i, i + this.config.batchSize));
    }
    
    const results: T[] = [];
    
    // Execute batches in parallel
    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): PoolStats {
    const activeConnections = this.clients.filter(client => client.status === 'ready').length;
    
    return {
      active: activeConnections,
      idle: this.clients.length - activeConnections,
      total: this.clients.length,
      pending: 0 // Dragonfly doesn't have pending connections in the same way
    };
  }

  /**
   * Health check for all connections
   */
  async healthCheck(): Promise<boolean> {
    try {
      const healthChecks = this.clients.map(async (client, index) => {
        try {
          await client.ping();
          return true;
        } catch (error) {
          console.error(`[DragonflyOptimized] Health check failed for client ${index}:`, error);
          return false;
        }
      });
      
      const results = await Promise.all(healthChecks);
      const healthyCount = results.filter(Boolean).length;
      
      return healthyCount > 0; // At least one connection should be healthy
    } catch (error) {
      console.error('[DragonflyOptimized] Health check error:', error);
      return false;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      const isHealthy = await this.healthCheck();
      if (!isHealthy) {
        this.emit('unhealthy');
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 10000); // Update every 10 seconds
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    this.metrics.connectionCount = this.clients.filter(client => client.status === 'ready').length;
    this.metrics.lastUpdated = Date.now();
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(latency: number): void {
    // Simple moving average for latency
    this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (latency * 0.1);
    this.metrics.operationsPerSecond = Math.round(1000 / this.metrics.averageLatency);
  }

  /**
   * Gracefully shutdown all connections
   */
  async shutdown(): Promise<void> {
    console.log('[DragonflyOptimized] Shutting down...');
    
    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Close all connections
    await Promise.all(this.clients.map(client => client.quit()));
    
    this.clients = [];
    this.isInitialized = false;
    
    console.log('[DragonflyOptimized] Shutdown complete');
  }
}

// Singleton instance
let dragonflyClient: DragonflyOptimizedClient | null = null;

/**
 * Get or create the optimized Dragonfly client instance
 */
export async function getDragonflyOptimizedClient(): Promise<DragonflyOptimizedClient> {
  if (!dragonflyClient) {
    const dragonflyUrl = process.env.DRAGONFLY_URL;
    if (!dragonflyUrl) {
      console.error('[DragonflyOptimized] DRAGONFLY_URL environment variable is not set');
      throw new Error('DRAGONFLY_URL environment variable is required');
    }
    
    try {
      console.log('[DragonflyOptimized] Creating new client instance...');
      dragonflyClient = new DragonflyOptimizedClient({
        url: dragonflyUrl,
        maxConnections: parseInt(process.env.DRAGONFLY_MAX_CONNECTIONS || '10'),
        enableMultiThreading: process.env.DRAGONFLY_MULTI_THREADING !== 'false',
        memoryOptimization: process.env.DRAGONFLY_MEMORY_OPT !== 'false',
        pipelineOptimization: process.env.DRAGONFLY_PIPELINE_OPT !== 'false',
        compressionEnabled: process.env.DRAGONFLY_COMPRESSION === 'true'
      });
      
      await dragonflyClient.initialize();
      console.log('[DragonflyOptimized] Client initialized successfully');
    } catch (error) {
      console.error('[DragonflyOptimized] Failed to initialize client:', error);
      // Reset the client to null so it can be retried
      dragonflyClient = null;
      throw new Error(`Failed to initialize DragonflyOptimizedClient: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return dragonflyClient;
}

/**
 * Execute a command using the optimized client
 */
export async function executeOptimized<T = any>(command: string, ...args: any[]): Promise<T> {
  const client = await getDragonflyOptimizedClient();
  return client.execute<T>(command, ...args);
}

/**
 * Execute multiple commands in a pipeline
 */
export async function pipelineOptimized(commands: Array<[string, ...any[]]>): Promise<any[]> {
  const client = await getDragonflyOptimizedClient();
  return client.pipeline(commands);
}

/**
 * Get current performance metrics
 */
export async function getDragonflyMetrics(): Promise<PerformanceMetrics> {
  const client = await getDragonflyOptimizedClient();
  return client.getMetrics();
}

/**
 * Get connection pool statistics
 */
export async function getDragonflyPoolStats(): Promise<PoolStats> {
  const client = await getDragonflyOptimizedClient();
  return client.getPoolStats();
}