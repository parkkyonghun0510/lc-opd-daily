/**
 * Real-time Connection Monitor
 * 
 * This module provides monitoring and logging for real-time connections.
 */

import Redis from 'ioredis';

// Types
interface RedisMetricsData {
  metrics: Metrics;
  timestamp: number;
}

// Monitoring metrics
interface Metrics {
  connections: {
    total: number;
    active: number;
    peak: number;
  };
  events: {
    sent: number;
    received: number;
    errors: number;
  };
  performance: {
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
  };
  errors: {
    connection: number;
    message: number;
    other: number;
  };
}

class RealtimeMonitor {
  private redis: Redis | null = null;
  private metrics: Metrics = {
    connections: {
      total: 0,
      active: 0,
      peak: 0
    },
    events: {
      sent: 0,
      received: 0,
      errors: 0
    },
    performance: {
      avgLatency: 0,
      p95Latency: 0,
      p99Latency: 0
    },
    errors: {
      connection: 0,
      message: 0,
      other: 0
    }
  };
  private instanceId: string;
  private latencies: number[] = [];
  private maxLatencies: number = 1000;

  constructor() {
    // Generate a unique instance ID
    this.instanceId = `instance:${crypto.randomUUID()}`;

    // Initialize Redis client
    this.initRedis();
  }

  /**
   * Initialize Redis client
   */
  private initRedis() {
    try {
      // Check if the required environment variables are present
      const redisUrl = process.env.DRAGONFLY_URL || 'redis://localhost:6379';
      if (!redisUrl) {
        console.warn(
          "[RealtimeMonitor] Redis URL not found (DRAGONFLY_URL or REDIS_URL). Using in-memory monitoring only."
        );
        return;
      }

      // Initialize Redis client with enhanced configuration
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 5,
        enableOfflineQueue: false,
        connectTimeout: 10000,
        commandTimeout: 5000,
        family: 4, // Force IPv4 to avoid DNS resolution issues
      });
      
      // Add comprehensive error handling
      this.redis.on('error', (error) => {
        console.error('[RealtimeMonitor] Redis error:', error);
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          console.error('[RealtimeMonitor] DNS resolution failed. Check DRAGONFLY_URL hostname.');
        }
      });
      
      this.redis.on('connect', () => {
        console.log('[RealtimeMonitor] Redis connected successfully');
      });
      
      this.redis.on('ready', () => {
        console.log('[RealtimeMonitor] Redis ready to accept commands');
      });
      
      this.redis.on('close', () => {
        console.warn('[RealtimeMonitor] Redis connection closed');
      });
      
      this.redis.on('end', () => {
        console.warn('[RealtimeMonitor] Redis connection ended');
      });
      
      console.log("[RealtimeMonitor] Redis client initialized with enhanced error handling");

      // Explicitly connect so commands are not issued before the stream is writable
      // Avoids: "Stream isn't writeable and enableOfflineQueue options is false"
      this.redis.connect().catch((err) => {
        console.error('[RealtimeMonitor] Failed to connect Redis client:', err);
      });
    } catch (error) {
      console.error("[RealtimeMonitor] Failed to initialize Redis:", error);
      this.redis = null;
    }
  }

  /**
   * Record a new connection
   */
  recordConnection() {
    // Update local metrics
    this.metrics.connections.total++;
    this.metrics.connections.active++;

    // Update peak if needed
    if (this.metrics.connections.active > this.metrics.connections.peak) {
      this.metrics.connections.peak = this.metrics.connections.active;
    }

    // Update Redis metrics if available
    this.updateRedisMetrics();
  }

  /**
   * Record a connection close
   */
  recordDisconnection() {
    // Update local metrics
    this.metrics.connections.active = Math.max(0, this.metrics.connections.active - 1);

    // Update Redis metrics if available
    this.updateRedisMetrics();
  }

  /**
   * Record a sent event
   */
  recordSentEvent() {
    // Update local metrics
    this.metrics.events.sent++;

    // Update Redis metrics if available
    this.updateRedisMetrics();
  }

  /**
   * Record a received event
   */
  recordReceivedEvent() {
    // Update local metrics
    this.metrics.events.received++;

    // Update Redis metrics if available
    this.updateRedisMetrics();
  }

  /**
   * Record an error
   * 
   * @param type - Error type
   */
  recordError(type: 'connection' | 'message' | 'other') {
    // Update local metrics
    this.metrics.errors[type]++;
    this.metrics.events.errors++;

    // Update Redis metrics if available
    this.updateRedisMetrics();
  }

  /**
   * Record latency
   * 
   * @param latency - Latency in milliseconds
   */
  recordLatency(latency: number) {
    // Add to latencies array
    this.latencies.push(latency);

    // Trim latencies array if it gets too large
    if (this.latencies.length > this.maxLatencies) {
      this.latencies = this.latencies.slice(-this.maxLatencies);
    }

    // Calculate new average
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    this.metrics.performance.avgLatency = sum / this.latencies.length;

    // Calculate percentiles
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    this.metrics.performance.p95Latency = sortedLatencies[p95Index] || 0;
    this.metrics.performance.p99Latency = sortedLatencies[p99Index] || 0;

    // Update Redis metrics if available
    this.updateRedisMetrics();
  }

  /**
   * Update Redis metrics
   */
  private async updateRedisMetrics() {
    if (!this.redis) {
      return;
    }

    // If client isn't ready yet, skip writing to avoid stream write errors
    if (this.redis.status !== 'ready') {
      return;
    }

    try {
      // Store metrics in Redis
      await this.redis.setex(`realtime:metrics:${this.instanceId}`, 3600, JSON.stringify({
        metrics: this.metrics,
        timestamp: Date.now()
      })); // Expire after 1 hour
    } catch (error) {
      console.error("[RealtimeMonitor] Failed to update Redis metrics:", error);
    }
  }

  /**
   * Get current metrics
   * 
   * @returns Current metrics
   */
  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics from all instances
   * 
   * @returns Metrics from all instances
   */
  async getAllInstancesMetrics(): Promise<{ [instanceId: string]: Metrics }> {
    // If Redis is not available, return only local metrics
    if (!this.redis) {
      return { [this.instanceId]: this.metrics };
    }

    try {
      // Get all instance metrics
      const instanceKeys = await this.redis.keys('realtime:metrics:*');
      const instanceMetrics = await Promise.all(
        instanceKeys.map(async key => {
          const data = await this.redis?.get(key);
          return { key, data };
        })
      );

      // Convert to object with proper typing
      return instanceMetrics.reduce((acc, { key, data }) => {
        if (data) {
          try {
            const metricsData = JSON.parse(data) as RedisMetricsData;
            if (metricsData?.metrics) {
              const instanceId = key.replace('realtime:metrics:', '');
              acc[instanceId] = metricsData.metrics;
            }
          } catch (e) {
            console.error("[RealtimeMonitor] Failed to parse metrics data:", e);
          }
        }
        return acc;
      }, {} as { [instanceId: string]: Metrics });
    } catch (error) {
      console.error("[RealtimeMonitor] Failed to get all instance metrics:", error);

      // Fall back to local metrics
      return { [this.instanceId]: this.metrics };
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      connections: {
        total: 0,
        active: this.metrics.connections.active, // Keep active connections
        peak: this.metrics.connections.peak // Keep peak
      },
      events: {
        sent: 0,
        received: 0,
        errors: 0
      },
      performance: {
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0
      },
      errors: {
        connection: 0,
        message: 0,
        other: 0
      }
    };

    this.latencies = [];

    // Update Redis metrics if available
    this.updateRedisMetrics();
  }
}

// Create a singleton instance
export const realtimeMonitor = new RealtimeMonitor();
