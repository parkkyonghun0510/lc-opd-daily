/**
 * Comprehensive Error Handling and Recovery System for SSE
 * 
 * This module provides centralized error handling, recovery mechanisms,
 * and health monitoring for the SSE system.
 */

import { SSEEventBuilder, ErrorEventData, SSEEventPriority } from './eventTypes';

// Error categories
export enum SSEErrorCategory {
  CONNECTION = 'connection',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  SERVER = 'server',
  CLIENT = 'client',
  VALIDATION = 'validation',
  TIMEOUT = 'timeout'
}

// Error severity levels
export enum SSEErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Recovery strategy types
export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  RESTART = 'restart',
  MANUAL = 'manual',
  NONE = 'none'
}

// Detailed error information
export interface SSEError {
  id: string;
  code: string;
  message: string;
  category: SSEErrorCategory;
  severity: SSEErrorSeverity;
  timestamp: number;
  context?: {
    userId?: string;
    clientId?: string;
    endpoint?: string;
    userAgent?: string;
    ip?: string;
    [key: string]: any;
  };
  originalError?: Error;
  stack?: string;
  recoveryStrategy: RecoveryStrategy;
  retryable: boolean;
  retryAfter?: number; // milliseconds
  maxRetries?: number;
  currentRetries?: number;
}

// Recovery action result
export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  action: string;
  message: string;
  nextRetryDelay?: number;
  shouldEscalate?: boolean;
}

// Health status
export interface SSEHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    connections: 'healthy' | 'degraded' | 'unhealthy';
    authentication: 'healthy' | 'degraded' | 'unhealthy';
    events: 'healthy' | 'degraded' | 'unhealthy';
    storage: 'healthy' | 'degraded' | 'unhealthy';
  };
  metrics: {
    totalConnections: number;
    activeConnections: number;
    errorRate: number;
    avgResponseTime: number;
    uptime: number;
  };
  errors: {
    recent: SSEError[];
    byCategory: Record<SSEErrorCategory, number>;
    bySeverity: Record<SSEErrorSeverity, number>;
  };
  timestamp: number;
}

class SSEErrorHandler {
  private errors: SSEError[] = [];
  private maxErrors: number = 1000;
  private errorRetention: number = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupInterval: NodeJS.Timeout | null = null;
  private healthMetrics: {
    connectionCount: number;
    errorCount: number;
    requestCount: number;
    responseTimeSum: number;
    startTime: number;
  } = {
    connectionCount: 0,
    errorCount: 0,
    requestCount: 0,
    responseTimeSum: 0,
    startTime: Date.now()
  };

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000); // Cleanup every 10 minutes
  }

  /**
   * Create and log an error
   */
  createError(
    code: string,
    message: string,
    category: SSEErrorCategory,
    severity: SSEErrorSeverity,
    context?: SSEError['context'],
    originalError?: Error
  ): SSEError {
    const error: SSEError = {
      id: crypto.randomUUID(),
      code,
      message,
      category,
      severity,
      timestamp: Date.now(),
      context,
      originalError,
      stack: originalError?.stack || new Error().stack,
      recoveryStrategy: this.determineRecoveryStrategy(category, severity),
      retryable: this.isRetryable(category, code),
      retryAfter: this.calculateRetryDelay(category, severity),
      maxRetries: this.getMaxRetries(category),
      currentRetries: 0
    };

    this.logError(error);
    this.updateMetrics(error);
    
    return error;
  }

  /**
   * Log an error
   */
  private logError(error: SSEError) {
    // Add to error list
    this.errors.unshift(error);
    
    // Trim to max errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Console logging based on severity
    const logMessage = `[SSE Error ${error.severity.toUpperCase()}] ${error.code}: ${error.message}`;
    const logContext = {
      id: error.id,
      category: error.category,
      context: error.context,
      stack: error.stack
    };

    switch (error.severity) {
      case SSEErrorSeverity.LOW:
        console.log(logMessage, logContext);
        break;
      case SSEErrorSeverity.MEDIUM:
        console.warn(logMessage, logContext);
        break;
      case SSEErrorSeverity.HIGH:
      case SSEErrorSeverity.CRITICAL:
        console.error(logMessage, logContext);
        break;
    }
  }

  /**
   * Update error metrics
   */
  private updateMetrics(error: SSEError) {
    this.healthMetrics.errorCount++;
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(error: SSEError): Promise<RecoveryResult> {
    const strategy = error.recoveryStrategy;
    
    console.log(`[SSE Recovery] Attempting ${strategy} recovery for error ${error.code}`);
    
    try {
      switch (strategy) {
        case RecoveryStrategy.RETRY:
          return await this.retryOperation(error);
        
        case RecoveryStrategy.FALLBACK:
          return await this.fallbackOperation(error);
        
        case RecoveryStrategy.RESTART:
          return await this.restartOperation(error);
        
        case RecoveryStrategy.MANUAL:
          return {
            success: false,
            strategy,
            action: 'escalate',
            message: 'Manual intervention required',
            shouldEscalate: true
          };
        
        case RecoveryStrategy.NONE:
        default:
          return {
            success: false,
            strategy,
            action: 'none',
            message: 'No recovery strategy available'
          };
      }
    } catch (recoveryError) {
      console.error(`[SSE Recovery] Recovery attempt failed:`, recoveryError);
      
      return {
        success: false,
        strategy,
        action: 'failed',
        message: `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`,
        shouldEscalate: error.severity === SSEErrorSeverity.CRITICAL
      };
    }
  }

  /**
   * Retry operation
   */
  private async retryOperation(error: SSEError): Promise<RecoveryResult> {
    if (!error.retryable || (error.currentRetries || 0) >= (error.maxRetries || 0)) {
      return {
        success: false,
        strategy: RecoveryStrategy.RETRY,
        action: 'max_retries_exceeded',
        message: 'Maximum retry attempts exceeded',
        shouldEscalate: true
      };
    }

    // Increment retry count
    error.currentRetries = (error.currentRetries || 0) + 1;
    
    // Calculate exponential backoff
    const baseDelay = error.retryAfter || 1000;
    const delay = Math.min(baseDelay * Math.pow(2, error.currentRetries - 1), 30000);
    
    return {
      success: true,
      strategy: RecoveryStrategy.RETRY,
      action: 'scheduled_retry',
      message: `Retry scheduled (attempt ${error.currentRetries}/${error.maxRetries})`,
      nextRetryDelay: delay
    };
  }

  /**
   * Fallback operation
   */
  private async fallbackOperation(error: SSEError): Promise<RecoveryResult> {
    let fallbackAction = 'unknown';
    
    switch (error.category) {
      case SSEErrorCategory.CONNECTION:
        fallbackAction = 'switch_to_polling';
        break;
      case SSEErrorCategory.AUTHENTICATION:
        fallbackAction = 'request_new_token';
        break;
      case SSEErrorCategory.NETWORK:
        fallbackAction = 'reduce_frequency';
        break;
      default:
        fallbackAction = 'graceful_degradation';
    }
    
    return {
      success: true,
      strategy: RecoveryStrategy.FALLBACK,
      action: fallbackAction,
      message: `Fallback activated: ${fallbackAction}`
    };
  }

  /**
   * Restart operation
   */
  private async restartOperation(error: SSEError): Promise<RecoveryResult> {
    return {
      success: true,
      strategy: RecoveryStrategy.RESTART,
      action: 'restart_connection',
      message: 'Connection restart initiated'
    };
  }

  /**
   * Determine recovery strategy based on error category and severity
   */
  private determineRecoveryStrategy(category: SSEErrorCategory, severity: SSEErrorSeverity): RecoveryStrategy {
    if (severity === SSEErrorSeverity.CRITICAL) {
      return RecoveryStrategy.MANUAL;
    }
    
    switch (category) {
      case SSEErrorCategory.CONNECTION:
      case SSEErrorCategory.NETWORK:
        return RecoveryStrategy.RETRY;
      
      case SSEErrorCategory.AUTHENTICATION:
        return RecoveryStrategy.FALLBACK;
      
      case SSEErrorCategory.RATE_LIMIT:
        return RecoveryStrategy.FALLBACK;
      
      case SSEErrorCategory.SERVER:
        return severity === SSEErrorSeverity.HIGH ? RecoveryStrategy.RESTART : RecoveryStrategy.RETRY;
      
      case SSEErrorCategory.CLIENT:
      case SSEErrorCategory.VALIDATION:
        return RecoveryStrategy.NONE;
      
      case SSEErrorCategory.TIMEOUT:
        return RecoveryStrategy.RETRY;
      
      default:
        return RecoveryStrategy.RETRY;
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(category: SSEErrorCategory, code: string): boolean {
    const nonRetryableCodes = [
      'AUTH_INVALID_TOKEN',
      'AUTH_EXPIRED_TOKEN',
      'VALIDATION_INVALID_FORMAT',
      'CLIENT_UNSUPPORTED',
      'RATE_LIMIT_EXCEEDED'
    ];
    
    if (nonRetryableCodes.includes(code)) {
      return false;
    }
    
    switch (category) {
      case SSEErrorCategory.CONNECTION:
      case SSEErrorCategory.NETWORK:
      case SSEErrorCategory.TIMEOUT:
      case SSEErrorCategory.SERVER:
        return true;
      
      case SSEErrorCategory.AUTHENTICATION:
      case SSEErrorCategory.RATE_LIMIT:
      case SSEErrorCategory.CLIENT:
      case SSEErrorCategory.VALIDATION:
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Calculate retry delay based on category and severity
   */
  private calculateRetryDelay(category: SSEErrorCategory, severity: SSEErrorSeverity): number {
    const baseDelays = {
      [SSEErrorSeverity.LOW]: 1000,
      [SSEErrorSeverity.MEDIUM]: 2000,
      [SSEErrorSeverity.HIGH]: 5000,
      [SSEErrorSeverity.CRITICAL]: 10000
    };
    
    const categoryMultipliers = {
      [SSEErrorCategory.CONNECTION]: 1,
      [SSEErrorCategory.NETWORK]: 1.5,
      [SSEErrorCategory.SERVER]: 2,
      [SSEErrorCategory.TIMEOUT]: 1.2,
      [SSEErrorCategory.AUTHENTICATION]: 3,
      [SSEErrorCategory.RATE_LIMIT]: 5,
      [SSEErrorCategory.CLIENT]: 1,
      [SSEErrorCategory.VALIDATION]: 1
    };
    
    return Math.round(baseDelays[severity] * categoryMultipliers[category]);
  }

  /**
   * Get maximum retries for a category
   */
  private getMaxRetries(category: SSEErrorCategory): number {
    switch (category) {
      case SSEErrorCategory.CONNECTION:
      case SSEErrorCategory.NETWORK:
        return 5;
      case SSEErrorCategory.TIMEOUT:
        return 3;
      case SSEErrorCategory.SERVER:
        return 3;
      case SSEErrorCategory.AUTHENTICATION:
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): SSEHealthStatus {
    const now = Date.now();
    const recentErrors = this.errors.filter(error => 
      (now - error.timestamp) < (5 * 60 * 1000) // Last 5 minutes
    );
    
    const errorsByCategory = recentErrors.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<SSEErrorCategory, number>);
    
    const errorsBySeverity = recentErrors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<SSEErrorSeverity, number>);
    
    const totalRequests = this.healthMetrics.requestCount;
    const errorRate = totalRequests > 0 ? (this.healthMetrics.errorCount / totalRequests) * 100 : 0;
    const avgResponseTime = totalRequests > 0 ? this.healthMetrics.responseTimeSum / totalRequests : 0;
    
    // Determine component health
    const components = {
      connections: this.determineComponentHealth('connections', recentErrors),
      authentication: this.determineComponentHealth('authentication', recentErrors),
      events: this.determineComponentHealth('events', recentErrors),
      storage: this.determineComponentHealth('storage', recentErrors)
    };
    
    // Determine overall health
    const unhealthyComponents = Object.values(components).filter(status => status === 'unhealthy').length;
    const degradedComponents = Object.values(components).filter(status => status === 'degraded').length;
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyComponents > 0 || errorRate > 10) {
      overall = 'unhealthy';
    } else if (degradedComponents > 0 || errorRate > 5) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }
    
    return {
      overall,
      components,
      metrics: {
        totalConnections: this.healthMetrics.connectionCount,
        activeConnections: this.healthMetrics.connectionCount, // TODO: track active separately
        errorRate: Number(errorRate.toFixed(2)),
        avgResponseTime: Number(avgResponseTime.toFixed(2)),
        uptime: now - this.healthMetrics.startTime
      },
      errors: {
        recent: recentErrors.slice(0, 10), // Last 10 errors
        byCategory: errorsByCategory,
        bySeverity: errorsBySeverity
      },
      timestamp: now
    };
  }

  /**
   * Determine component health based on recent errors
   */
  private determineComponentHealth(component: string, recentErrors: SSEError[]): 'healthy' | 'degraded' | 'unhealthy' {
    const componentErrors = recentErrors.filter(error => {
      switch (component) {
        case 'connections':
          return error.category === SSEErrorCategory.CONNECTION || error.category === SSEErrorCategory.NETWORK;
        case 'authentication':
          return error.category === SSEErrorCategory.AUTHENTICATION;
        case 'events':
          return error.category === SSEErrorCategory.VALIDATION || error.category === SSEErrorCategory.SERVER;
        case 'storage':
          return error.context?.component === 'storage';
        default:
          return false;
      }
    });
    
    const criticalErrors = componentErrors.filter(error => error.severity === SSEErrorSeverity.CRITICAL).length;
    const highErrors = componentErrors.filter(error => error.severity === SSEErrorSeverity.HIGH).length;
    
    if (criticalErrors > 0 || highErrors > 2) {
      return 'unhealthy';
    } else if (componentErrors.length > 3 || highErrors > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Update request metrics
   */
  updateRequestMetrics(responseTime: number) {
    this.healthMetrics.requestCount++;
    this.healthMetrics.responseTimeSum += responseTime;
  }

  /**
   * Update connection metrics
   */
  updateConnectionMetrics(count: number) {
    this.healthMetrics.connectionCount = count;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): SSEError[] {
    return this.errors.slice(0, limit);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: SSEErrorCategory): SSEError[] {
    return this.errors.filter(error => error.category === category);
  }

  /**
   * Clean up old errors
   */
  private cleanup() {
    const before = this.errors.length;
    const cutoff = Date.now() - this.errorRetention;
    
    this.errors = this.errors.filter(error => error.timestamp > cutoff);
    
    const after = this.errors.length;
    if (before !== after) {
      console.log(`[SSE ErrorHandler] Cleaned up ${before - after} old errors (${after} remaining)`);
    }
  }

  /**
   * Clear all errors (for testing)
   */
  clear() {
    this.errors = [];
    console.log('[SSE ErrorHandler] Cleared all errors');
  }

  /**
   * Destroy the error handler
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.errors = [];
    console.log('[SSE ErrorHandler] Destroyed');
  }
}

// Create a singleton instance
export const sseErrorHandler = new SSEErrorHandler();

// Export convenience functions
export const SSEErrorUtils = {
  /**
   * Create a connection error
   */
  createConnectionError(
    message: string,
    context?: SSEError['context'],
    originalError?: Error
  ): SSEError {
    return sseErrorHandler.createError(
      'CONNECTION_ERROR',
      message,
      SSEErrorCategory.CONNECTION,
      SSEErrorSeverity.MEDIUM,
      context,
      originalError
    );
  },

  /**
   * Create an authentication error
   */
  createAuthError(
    message: string,
    context?: SSEError['context'],
    originalError?: Error
  ): SSEError {
    return sseErrorHandler.createError(
      'AUTH_ERROR',
      message,
      SSEErrorCategory.AUTHENTICATION,
      SSEErrorSeverity.HIGH,
      context,
      originalError
    );
  },

  /**
   * Create a rate limit error
   */
  createRateLimitError(
    message: string,
    context?: SSEError['context']
  ): SSEError {
    return sseErrorHandler.createError(
      'RATE_LIMIT_EXCEEDED',
      message,
      SSEErrorCategory.RATE_LIMIT,
      SSEErrorSeverity.MEDIUM,
      context
    );
  },

  /**
   * Create a server error
   */
  createServerError(
    message: string,
    context?: SSEError['context'],
    originalError?: Error
  ): SSEError {
    return sseErrorHandler.createError(
      'SERVER_ERROR',
      message,
      SSEErrorCategory.SERVER,
      SSEErrorSeverity.HIGH,
      context,
      originalError
    );
  },

  /**
   * Attempt recovery for an error
   */
  async recover(error: SSEError): Promise<RecoveryResult> {
    return await sseErrorHandler.attemptRecovery(error);
  }
};