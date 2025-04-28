/**
 * Redis Load Balancer
 * 
 * This module provides load balancing functionality for Redis operations,
 * distributing the load across multiple Redis instances.
 */

import { Redis } from '@upstash/redis';

// Redis instance configuration
interface RedisInstanceConfig {
  url: string;
  token: string;
  weight?: number; // Higher weight means more traffic
  isActive?: boolean; // Whether this instance is active
}

// Redis operation result
interface RedisOperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  instance?: string; // ID of the Redis instance used
}

/**
 * Redis Load Balancer class
 * 
 * Distributes Redis operations across multiple Redis instances
 * using a weighted round-robin algorithm.
 */
export class RedisLoadBalancer {
  private instances: Map<string, { 
    client: Redis; 
    config: RedisInstanceConfig;
    health: {
      isHealthy: boolean;
      lastCheck: number;
      errorCount: number;
      consecutiveErrors: number;
    };
  }> = new Map();
  
  private currentInstanceIndex: number = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly healthCheckPeriod: number = 30000; // 30 seconds
  private readonly errorThreshold: number = 5; // Number of consecutive errors before marking as unhealthy
  
  /**
   * Constructor
   * 
   * @param configs - Array of Redis instance configurations
   * @param options - Load balancer options
   */
  constructor(
    configs: RedisInstanceConfig[],
    private options: {
      healthCheckPeriod?: number;
      errorThreshold?: number;
      debug?: boolean;
    } = {}
  ) {
    // Set options with defaults
    this.healthCheckPeriod = options.healthCheckPeriod || 30000;
    this.errorThreshold = options.errorThreshold || 5;
    
    // Initialize Redis instances
    this.initializeInstances(configs);
    
    // Start health checks
    this.startHealthChecks();
  }
  
  /**
   * Initialize Redis instances
   * 
   * @param configs - Array of Redis instance configurations
   */
  private initializeInstances(configs: RedisInstanceConfig[]): void {
    // If no configs provided, use environment variables
    if (configs.length === 0) {
      const mainRedisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
      const mainRedisToken = process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
      
      if (mainRedisUrl && mainRedisToken) {
        configs.push({
          url: mainRedisUrl,
          token: mainRedisToken,
          weight: 1,
          isActive: true
        });
      }
    }
    
    // Create Redis clients for each config
    configs.forEach((config, index) => {
      if (!config.url || !config.token) {
        this.log(`Invalid Redis config at index ${index}`);
        return;
      }
      
      try {
        const client = new Redis({
          url: config.url,
          token: config.token
        });
        
        const instanceId = `redis-${index}`;
        this.instances.set(instanceId, {
          client,
          config: {
            ...config,
            weight: config.weight || 1,
            isActive: config.isActive !== false
          },
          health: {
            isHealthy: true,
            lastCheck: Date.now(),
            errorCount: 0,
            consecutiveErrors: 0
          }
        });
        
        this.log(`Initialized Redis instance: ${instanceId}`);
      } catch (error) {
        this.log(`Failed to initialize Redis instance at index ${index}:`, error);
      }
    });
    
    this.log(`Initialized ${this.instances.size} Redis instances`);
  }
  
  /**
   * Start health checks for Redis instances
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => {
      this.checkInstancesHealth();
    }, this.healthCheckPeriod);
    
    // Run an initial health check
    this.checkInstancesHealth();
  }
  
  /**
   * Check health of all Redis instances
   */
  private async checkInstancesHealth(): Promise<void> {
    this.log('Running health checks on Redis instances...');
    
    const healthCheckPromises = Array.from(this.instances.entries()).map(
      async ([instanceId, instance]) => {
        try {
          // Try to ping the Redis instance
          await instance.client.ping();
          
          // Update health status
          instance.health.isHealthy = true;
          instance.health.lastCheck = Date.now();
          instance.health.consecutiveErrors = 0;
          
          this.log(`Health check passed for instance ${instanceId}`);
          return true;
        } catch (error) {
          // Update health status
          instance.health.consecutiveErrors++;
          instance.health.errorCount++;
          instance.health.lastCheck = Date.now();
          
          // Mark as unhealthy if too many consecutive errors
          if (instance.health.consecutiveErrors >= this.errorThreshold) {
            instance.health.isHealthy = false;
            this.log(`Instance ${instanceId} marked as unhealthy after ${instance.health.consecutiveErrors} consecutive errors`);
          }
          
          this.log(`Health check failed for instance ${instanceId}:`, error);
          return false;
        }
      }
    );
    
    await Promise.all(healthCheckPromises);
  }
  
  /**
   * Get the next Redis instance using weighted round-robin
   * 
   * @returns The next Redis instance to use
   */
  private getNextInstance(): { client: Redis; instanceId: string } | null {
    const activeInstances = Array.from(this.instances.entries())
      .filter(([_, instance]) => instance.config.isActive && instance.health.isHealthy);
    
    if (activeInstances.length === 0) {
      this.log('No healthy Redis instances available');
      return null;
    }
    
    // Create a weighted list of instances
    const weightedInstances: Array<{ instanceId: string; client: Redis }> = [];
    
    activeInstances.forEach(([instanceId, instance]) => {
      const weight = instance.config.weight || 1;
      for (let i = 0; i < weight; i++) {
        weightedInstances.push({
          instanceId,
          client: instance.client
        });
      }
    });
    
    // Get the next instance using round-robin
    this.currentInstanceIndex = (this.currentInstanceIndex + 1) % weightedInstances.length;
    return weightedInstances[this.currentInstanceIndex];
  }
  
  /**
   * Execute a Redis operation with load balancing
   * 
   * @param operation - The Redis operation to execute
   * @returns The result of the operation
   */
  public async execute<T>(
    operation: (client: Redis) => Promise<T>
  ): Promise<RedisOperationResult<T>> {
    const instance = this.getNextInstance();
    
    if (!instance) {
      return {
        success: false,
        error: new Error('No healthy Redis instances available')
      };
    }
    
    try {
      const result = await operation(instance.client);
      
      return {
        success: true,
        data: result,
        instance: instance.instanceId
      };
    } catch (error) {
      // Update instance health on error
      const instanceData = this.instances.get(instance.instanceId);
      if (instanceData) {
        instanceData.health.consecutiveErrors++;
        instanceData.health.errorCount++;
        
        // Mark as unhealthy if too many consecutive errors
        if (instanceData.health.consecutiveErrors >= this.errorThreshold) {
          instanceData.health.isHealthy = false;
          this.log(`Instance ${instance.instanceId} marked as unhealthy after operation error`);
        }
      }
      
      this.log(`Error executing Redis operation on instance ${instance.instanceId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        instance: instance.instanceId
      };
    }
  }
  
  /**
   * Get statistics about Redis instances
   * 
   * @returns Statistics about Redis instances
   */
  public getStats(): {
    totalInstances: number;
    healthyInstances: number;
    unhealthyInstances: number;
    instanceStats: Record<string, {
      isHealthy: boolean;
      errorCount: number;
      lastCheck: number;
    }>;
  } {
    const instanceStats: Record<string, {
      isHealthy: boolean;
      errorCount: number;
      lastCheck: number;
    }> = {};
    
    let healthyCount = 0;
    let unhealthyCount = 0;
    
    this.instances.forEach((instance, instanceId) => {
      instanceStats[instanceId] = {
        isHealthy: instance.health.isHealthy,
        errorCount: instance.health.errorCount,
        lastCheck: instance.health.lastCheck
      };
      
      if (instance.health.isHealthy) {
        healthyCount++;
      } else {
        unhealthyCount++;
      }
    });
    
    return {
      totalInstances: this.instances.size,
      healthyInstances: healthyCount,
      unhealthyInstances: unhealthyCount,
      instanceStats
    };
  }
  
  /**
   * Reset health status of all instances
   */
  public resetHealth(): void {
    this.instances.forEach((instance) => {
      instance.health.isHealthy = true;
      instance.health.consecutiveErrors = 0;
    });
    
    this.log('Reset health status of all Redis instances');
  }
  
  /**
   * Stop the load balancer
   */
  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.log('Redis load balancer stopped');
  }
  
  /**
   * Log a message if debug is enabled
   * 
   * @param message - The message to log
   * @param error - Optional error to log
   */
  private log(message: string, error?: any): void {
    if (this.options.debug) {
      console.log(`[RedisLoadBalancer] ${message}`);
      if (error) {
        console.error(error);
      }
    }
  }
}

// Create a singleton instance
let loadBalancerInstance: RedisLoadBalancer | null = null;

/**
 * Get the Redis load balancer instance
 * 
 * @param configs - Optional Redis instance configurations
 * @param options - Optional load balancer options
 * @returns The Redis load balancer instance
 */
export function getRedisLoadBalancer(
  configs: RedisInstanceConfig[] = [],
  options: {
    healthCheckPeriod?: number;
    errorThreshold?: number;
    debug?: boolean;
  } = {}
): RedisLoadBalancer {
  if (!loadBalancerInstance) {
    loadBalancerInstance = new RedisLoadBalancer(configs, options);
  }
  
  return loadBalancerInstance;
}

/**
 * Execute a Redis operation with load balancing
 * 
 * @param operation - The Redis operation to execute
 * @returns The result of the operation
 */
export async function executeRedisOperation<T>(
  operation: (client: Redis) => Promise<T>
): Promise<RedisOperationResult<T>> {
  const loadBalancer = getRedisLoadBalancer();
  return loadBalancer.execute(operation);
}
