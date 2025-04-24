/**
 * SSE Metrics Collection
 * 
 * This module provides metrics collection for SSE connections and events.
 * It can be used for monitoring and alerting.
 */

// Metrics storage
interface MetricsStorage {
  // Connection metrics
  connections: {
    total: number;
    active: number;
    peak: number;
    byUser: Record<string, number>;
  };
  
  // Event metrics
  events: {
    total: number;
    byType: Record<string, number>;
    byUser: Record<string, number>;
  };
  
  // Error metrics
  errors: {
    total: number;
    byType: Record<string, number>;
  };
  
  // Performance metrics
  performance: {
    eventProcessingTime: number[];
    eventProcessingCount: number;
  };
  
  // Timestamp of the last reset
  lastReset: number;
}

class SSEMetrics {
  private metrics: MetricsStorage = {
    connections: {
      total: 0,
      active: 0,
      peak: 0,
      byUser: {}
    },
    events: {
      total: 0,
      byType: {},
      byUser: {}
    },
    errors: {
      total: 0,
      byType: {}
    },
    performance: {
      eventProcessingTime: [],
      eventProcessingCount: 0
    },
    lastReset: Date.now()
  };
  
  // Reset interval in milliseconds (1 hour)
  private readonly RESET_INTERVAL = 60 * 60 * 1000;
  
  // Maximum number of performance samples to keep
  private readonly MAX_PERFORMANCE_SAMPLES = 1000;
  
  /**
   * Record a new connection
   */
  recordConnection(userId: string) {
    this.checkReset();
    
    this.metrics.connections.total++;
    this.metrics.connections.active++;
    
    // Update peak connections if needed
    if (this.metrics.connections.active > this.metrics.connections.peak) {
      this.metrics.connections.peak = this.metrics.connections.active;
    }
    
    // Update user-specific connection count
    this.metrics.connections.byUser[userId] = (this.metrics.connections.byUser[userId] || 0) + 1;
  }
  
  /**
   * Record a connection close
   */
  recordDisconnection(userId: string) {
    this.checkReset();
    
    this.metrics.connections.active = Math.max(0, this.metrics.connections.active - 1);
    
    // Update user-specific connection count
    if (this.metrics.connections.byUser[userId]) {
      this.metrics.connections.byUser[userId] = Math.max(0, this.metrics.connections.byUser[userId] - 1);
    }
  }
  
  /**
   * Record an event
   */
  recordEvent(eventType: string, userId: string) {
    this.checkReset();
    
    this.metrics.events.total++;
    
    // Update event type count
    this.metrics.events.byType[eventType] = (this.metrics.events.byType[eventType] || 0) + 1;
    
    // Update user-specific event count
    this.metrics.events.byUser[userId] = (this.metrics.events.byUser[userId] || 0) + 1;
  }
  
  /**
   * Record an error
   */
  recordError(errorType: string) {
    this.checkReset();
    
    this.metrics.errors.total++;
    
    // Update error type count
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
  }
  
  /**
   * Record event processing time
   */
  recordEventProcessingTime(timeMs: number) {
    this.checkReset();
    
    // Add the processing time to the samples
    this.metrics.performance.eventProcessingTime.push(timeMs);
    this.metrics.performance.eventProcessingCount++;
    
    // Limit the number of samples
    if (this.metrics.performance.eventProcessingTime.length > this.MAX_PERFORMANCE_SAMPLES) {
      this.metrics.performance.eventProcessingTime.shift();
    }
  }
  
  /**
   * Get the current metrics
   */
  getMetrics() {
    this.checkReset();
    
    // Calculate average event processing time
    const avgProcessingTime = this.calculateAverageProcessingTime();
    
    return {
      ...this.metrics,
      performance: {
        ...this.metrics.performance,
        averageEventProcessingTime: avgProcessingTime
      }
    };
  }
  
  /**
   * Reset the metrics
   */
  resetMetrics() {
    // Keep the peak connections value
    const peak = this.metrics.connections.peak;
    
    // Reset the metrics
    this.metrics = {
      connections: {
        total: 0,
        active: this.metrics.connections.active, // Keep the active connections count
        peak,
        byUser: { ...this.metrics.connections.byUser } // Keep the user-specific connection counts
      },
      events: {
        total: 0,
        byType: {},
        byUser: {}
      },
      errors: {
        total: 0,
        byType: {}
      },
      performance: {
        eventProcessingTime: [],
        eventProcessingCount: 0
      },
      lastReset: Date.now()
    };
  }
  
  /**
   * Check if the metrics should be reset
   */
  private checkReset() {
    const now = Date.now();
    
    // Reset the metrics if the reset interval has passed
    if (now - this.metrics.lastReset > this.RESET_INTERVAL) {
      this.resetMetrics();
    }
  }
  
  /**
   * Calculate the average event processing time
   */
  private calculateAverageProcessingTime() {
    if (this.metrics.performance.eventProcessingCount === 0) {
      return 0;
    }
    
    const sum = this.metrics.performance.eventProcessingTime.reduce((a, b) => a + b, 0);
    return sum / this.metrics.performance.eventProcessingTime.length;
  }
}

// Create a singleton instance
export const sseMetrics = new SSEMetrics();
