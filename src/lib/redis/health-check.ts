/**
 * Redis Health Check Utility
 * 
 * Provides centralized Redis connection health monitoring and safe operation wrappers
 * to prevent "Stream isn't writeable" errors across the application.
 */

import Redis from 'ioredis';

export interface RedisHealthStatus {
  isReady: boolean;
  status: string;
  lastError?: string;
  lastCheck: number;
}

export class RedisHealthChecker {
  private static instance: RedisHealthChecker;
  private healthStatus: Map<string, RedisHealthStatus> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  static getInstance(): RedisHealthChecker {
    if (!RedisHealthChecker.instance) {
      RedisHealthChecker.instance = new RedisHealthChecker();
    }
    return RedisHealthChecker.instance;
  }

  /**
   * Check if Redis client is healthy and ready for operations
   */
  isHealthy(redisClient?: Redis): boolean {
    if (!redisClient) {
      return false;
    }

    const clientId = this.getClientId(redisClient);
    const status = this.healthStatus.get(clientId);
    
    if (!status) {
      // First time checking this client
      return this.checkConnection(redisClient);
    }

    return status.isReady;
  }

  /**
   * Get current health status for a Redis client
   */
  getStatus(redisClient?: Redis): RedisHealthStatus {
    if (!redisClient) {
      return {
        isReady: false,
        status: 'disconnected',
        lastCheck: Date.now()
      };
    }

    const clientId = this.getClientId(redisClient);
    return this.healthStatus.get(clientId) || {
      isReady: false,
      status: 'unknown',
      lastCheck: Date.now()
    };
  }

  /**
   * Safely execute a Redis operation with automatic connection checking
   */
  async safeExecute<T>(
    redisClient: Redis | undefined,
    operation: (client: Redis) => Promise<T>,
    fallback: T
  ): Promise<T> {
    if (!this.isHealthy(redisClient)) {
      console.warn('[RedisHealth] Skipping Redis operation - client not healthy');
      return fallback;
    }

    try {
      return await operation(redisClient!);
    } catch (error) {
      console.error('[RedisHealth] Error executing Redis operation:', error);
      
      // Update health status on error
      if (redisClient) {
        const clientId = this.getClientId(redisClient);
        this.healthStatus.set(clientId, {
          isReady: false,
          status: 'error',
          lastError: error instanceof Error ? error.message : String(error),
          lastCheck: Date.now()
        });
      }

      return fallback;
    }
  }

  /**
   * Start periodic health checks for Redis clients
   */
  startHealthChecks(redisClients: Redis[], intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      for (const client of redisClients) {
        await this.checkConnection(client);
      }
    }, intervalMs);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Force health check for a specific client
   */
  async forceHealthCheck(redisClient: Redis): Promise<boolean> {
    return this.checkConnection(redisClient);
  }

  private checkConnection(redisClient: Redis): boolean {
    const clientId = this.getClientId(redisClient);
    
    try {
      const isReady = redisClient.status === 'ready';
      
      this.healthStatus.set(clientId, {
        isReady,
        status: redisClient.status || 'unknown',
        lastCheck: Date.now()
      });

      return isReady;
    } catch (error) {
      this.healthStatus.set(clientId, {
        isReady: false,
        status: 'error',
        lastError: error instanceof Error ? error.message : String(error),
        lastCheck: Date.now()
      });

      return false;
    }
  }

  private getClientId(redisClient: Redis): string {
    // Use a combination of options to create a unique ID
    const options = redisClient.options || {};
    return `${options.host || 'localhost'}:${options.port || 6379}`;
  }
}

/**
 * Helper function to safely check Redis connection status
 */
export function isRedisReady(redisClient?: Redis): boolean {
  if (!redisClient) return false;
  return redisClient.status === 'ready';
}

/**
 * Helper function to safely execute Redis operations
 */
export async function safeRedisOperation<T>(
  redisClient: Redis | undefined,
  operation: (client: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  const checker = RedisHealthChecker.getInstance();
  return checker.safeExecute(redisClient, operation, fallback);
}

// Export singleton instance
export const redisHealthChecker = RedisHealthChecker.getInstance();