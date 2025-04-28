/**
 * Real-time Connection Monitor
 * 
 * This module provides monitoring and logging for real-time connections.
 */

import { Redis } from '@upstash/redis';

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
      if (
        !process.env.UPSTASH_REDIS_REST_URL ||
        !process.env.UPSTASH_REDIS_REST_TOKEN
      ) {
        console.warn(
          "[RealtimeMonitor] Redis credentials not found. Using in-memory monitoring only."
        );
        return;
      }

      // Initialize Redis client
      this.redis = Redis.fromEnv();
      console.log("[RealtimeMonitor] Redis client initialized");
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

    try {
      // Store metrics in Redis
      await this.redis.set(`realtime:metrics:${this.instanceId}`, {
        metrics: this.metrics,
        timestamp: Date.now()
      }, { ex: 3600 }); // Expire after 1 hour
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
        const metricsData = data as RedisMetricsData | null;
        if (metricsData?.metrics) {
          const instanceId = key.replace('realtime:metrics:', '');
          acc[instanceId] = metricsData.metrics;
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
