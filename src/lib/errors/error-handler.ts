/**
 * Centralized error handling and recovery system
 * Provides consistent error processing, logging, and recovery strategies
 */

import {
  AppError,
  ErrorContext,
  ErrorHandler,
  ErrorRecoveryStrategy,
  ErrorReporter,
  ErrorMetrics,
  ErrorSeverity,
  NetworkErrorCode
} from '@/types/errors';
import {
  AppAuthError,
  AppValidationError,
  AppNetworkError,
  AppCacheError,
  AppDatabaseError,
  AppOfflineQueueError
} from './error-classes';
import toast from 'react-hot-toast';

// Global error metrics
let globalErrorMetrics: ErrorMetrics = {
  errorCount: 0,
  errorRate: 0,
  errorsByType: {},
  errorsBySeverity: {
    [ErrorSeverity.LOW]: 0,
    [ErrorSeverity.MEDIUM]: 0,
    [ErrorSeverity.HIGH]: 0,
    [ErrorSeverity.CRITICAL]: 0
  }
};

// Error handlers registry
const errorHandlers = new Map<string, ErrorHandler>();
const recoveryStrategies = new Map<string, ErrorRecoveryStrategy>();
const errorReporters: ErrorReporter[] = [];

// Default error recovery strategies
const defaultRecoveryStrategies: Record<string, ErrorRecoveryStrategy> = {
  network: {
    canRecover: (error: AppError): boolean => {
      return error.type === 'NETWORK_ERROR' && (error.retryable ?? false);
    },
    recover: async (error: AppError, context?: ErrorContext) => {
      if (error.type === 'NETWORK_ERROR') {
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, context?.additionalData?.retryCount || 0), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return true;
      }
      return false;
    },
    maxRetries: 3,
    retryDelay: 1000
  },
  
  auth: {
    canRecover: (error: AppError): boolean => {
      return error.type === 'AUTH_ERROR' && (error.retryable ?? false);
    },
    recover: async (error: AppError, context?: ErrorContext) => {
      if (error.type === 'AUTH_ERROR') {
        // Try to refresh session or redirect to login
        try {
          const response = await fetch('/api/auth/session', { method: 'GET' });
          if (response.ok) {
            return true;
          }
        } catch {
          // Redirect to login if session refresh fails
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }
      return false;
    },
    maxRetries: 1,
    retryDelay: 0
  },
  
  cache: {
    canRecover: (error: AppError): boolean => {
      return error.type === 'CACHE_ERROR' && (error.retryable ?? false);
    },
    recover: async (error: AppError, context?: ErrorContext) => {
      if (error.type === 'CACHE_ERROR') {
        // For cache errors, we can usually continue without cache
        console.warn('Cache operation failed, continuing without cache:', error.message);
        return true;
      }
      return false;
    },
    maxRetries: 2,
    retryDelay: 500
  },
  
  database: {
    canRecover: (error: AppError): boolean => {
      return error.type === 'DATABASE_ERROR' && (error.retryable ?? false);
    },
    recover: async (error: AppError, context?: ErrorContext) => {
      if (error.type === 'DATABASE_ERROR') {
        // Wait before retry for database errors
        const delay = Math.min(2000 * Math.pow(2, context?.additionalData?.retryCount || 0), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return true;
      }
      return false;
    },
    maxRetries: 2,
    retryDelay: 2000
  }
};

// Initialize default recovery strategies
Object.entries(defaultRecoveryStrategies).forEach(([key, strategy]) => {
  recoveryStrategies.set(key, strategy);
});

// Default error reporter (console + toast)
const defaultErrorReporter: ErrorReporter = {
  report: async (error: AppError, context?: ErrorContext) => {
    // Log to console with full details
    console.error('Error reported:', {
      error: {
        type: error.type,
        code: error.code,
        message: error.message,
        severity: error.severity,
        retryable: error.retryable,
        timestamp: error.timestamp
      },
      context
    });
    
    // Show user-friendly toast notification
    const shouldShowToast = error.severity !== ErrorSeverity.LOW;
    if (shouldShowToast && typeof window !== 'undefined') {
      const toastMessage = getUserFriendlyMessage(error);
      
      switch (error.severity) {
        case ErrorSeverity.CRITICAL:
          toast.error(toastMessage, { duration: 8000 });
          break;
        case ErrorSeverity.HIGH:
          toast.error(toastMessage, { duration: 6000 });
          break;
        case ErrorSeverity.MEDIUM:
          toast.error(toastMessage, { duration: 4000 });
          break;
        default:
          toast(toastMessage, { duration: 3000 });
      }
    }
  },
  
  reportBatch: async (errors: AppError[], context?: ErrorContext) => {
    console.error('Batch error report:', {
      errorCount: errors.length,
      errors: errors.map(e => ({
        type: e.type,
        code: e.code,
        message: e.message,
        severity: e.severity,
        retryable: e.retryable,
        timestamp: e.timestamp
      })),
      context
    });
    
    if (errors.length > 0 && typeof window !== 'undefined') {
      toast.error(`Multiple errors occurred (${errors.length})`, { duration: 5000 });
    }
  }
};

errorReporters.push(defaultErrorReporter);

// Get user-friendly error message
function getUserFriendlyMessage(error: AppError): string {
  switch (error.type) {
    case 'AUTH_ERROR':
      return error.message;
    case 'VALIDATION_ERROR':
      return error.message;
    case 'NETWORK_ERROR':
      if (error.networkCode === 'OFFLINE') {
        return 'You are currently offline. Please check your connection.';
      }
      return 'Network error occurred. Please try again.';
    case 'CACHE_ERROR':
      return 'Temporary issue occurred. Please refresh the page.';
    case 'DATABASE_ERROR':
      return 'Service temporarily unavailable. Please try again later.';
    case 'OFFLINE_QUEUE_ERROR':
      return 'Request queued for when you are back online.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

// Update error metrics
function updateErrorMetrics(error: AppError) {
  globalErrorMetrics.errorCount++;
  globalErrorMetrics.lastError = error;
  globalErrorMetrics.lastErrorTime = new Date();
  
  // Update by type
  const errorType = error.type;
  globalErrorMetrics.errorsByType[errorType] = (globalErrorMetrics.errorsByType[errorType] || 0) + 1;
  
  // Update by severity
  globalErrorMetrics.errorsBySeverity[error.severity]++;
  
  // Calculate error rate (errors per minute over last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  // This is a simplified calculation - in production, you'd want to track timestamps
  globalErrorMetrics.errorRate = globalErrorMetrics.errorCount / 5;
}

// Main error handling function
export async function handleError(
  error: AppError | Error,
  context?: ErrorContext,
  options: {
    skipRecovery?: boolean;
    skipReporting?: boolean;
    customHandler?: ErrorHandler;
  } = {}
): Promise<boolean> {
  // Convert regular Error to AppError if needed
  let appError: AppError;
  if (error instanceof Error && !(error instanceof AppAuthError || 
      error instanceof AppValidationError || error instanceof AppNetworkError ||
      error instanceof AppCacheError || error instanceof AppDatabaseError ||
      error instanceof AppOfflineQueueError)) {
    // Create a generic network error for unknown errors
    appError = new AppNetworkError(NetworkErrorCode.NETWORK_ERROR, error.message, {
      cause: error,
      context: { originalError: error.name }
    });
  } else {
    appError = error as AppError;
  }
  
  // Update metrics
  updateErrorMetrics(appError);
  
  // Use custom handler if provided
  if (options.customHandler) {
    await options.customHandler(appError, context);
  }
  
  // Check for registered handlers
  const handler = errorHandlers.get(appError.type);
  if (handler) {
    await handler(appError, context);
  }
  
  // Report error unless skipped
  if (!options.skipReporting) {
    for (const reporter of errorReporters) {
      try {
        await reporter.report(appError, context);
      } catch (reportError) {
        console.error('Error reporter failed:', reportError);
      }
    }
  }
  
  // Attempt recovery unless skipped
  if (!options.skipRecovery && appError.retryable) {
    for (const [, strategy] of recoveryStrategies) {
      if (strategy.canRecover(appError)) {
        try {
          const recovered = await strategy.recover(appError, context);
          if (recovered) {
            console.log('Error recovery successful:', appError.code);
            return true;
          }
        } catch (recoveryError) {
          console.error('Error recovery failed:', recoveryError);
        }
      }
    }
  }
  
  return false;
}

// Register custom error handler
export function registerErrorHandler(errorType: string, handler: ErrorHandler) {
  errorHandlers.set(errorType, handler);
}

// Register custom recovery strategy
export function registerRecoveryStrategy(name: string, strategy: ErrorRecoveryStrategy) {
  recoveryStrategies.set(name, strategy);
}

// Register custom error reporter
export function registerErrorReporter(reporter: ErrorReporter) {
  errorReporters.push(reporter);
}

// Get current error metrics
export function getErrorMetrics(): ErrorMetrics {
  return { ...globalErrorMetrics };
}

// Reset error metrics
export function resetErrorMetrics() {
  globalErrorMetrics = {
    errorCount: 0,
    errorRate: 0,
    errorsByType: {},
    errorsBySeverity: {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    }
  };
}

// Error boundary helper
export function createErrorBoundaryHandler(componentName: string) {
  return async (error: Error, errorInfo: React.ErrorInfo) => {
    const context: ErrorContext = {
      timestamp: new Date(),
      additionalData: {
        componentName,
        componentStack: errorInfo.componentStack
      }
    };
    
    await handleError(error, context);
  };
}

// Async operation wrapper with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: ErrorContext,
  options?: {
    maxRetries?: number;
    retryDelay?: number;
    skipRecovery?: boolean;
    skipReporting?: boolean;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const retryDelay = options?.retryDelay ?? 1000;
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      const isLastAttempt = attempt === maxRetries;
      const shouldRetry = !isLastAttempt && (error as any).retryable !== false;
      
      // Handle error
      const recovered = await handleError(
        lastError,
        {
          ...context,
          timestamp: context?.timestamp ?? new Date(),
          additionalData: {
            ...context?.additionalData,
            attempt,
            maxRetries,
            isLastAttempt
          }
        },
        {
          skipRecovery: options?.skipRecovery || !shouldRetry,
          skipReporting: options?.skipReporting && !isLastAttempt
        }
      );
      
      if (!shouldRetry || !recovered) {
        throw lastError;
      }
      
      // Wait before retry
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError!;
}

// Export error classes for convenience
export {
  AppAuthError,
  AppValidationError,
  AppNetworkError,
  AppCacheError,
  AppDatabaseError,
  AppOfflineQueueError
} from './error-classes';

export {
  createAuthError,
  createValidationError,
  createNetworkError,
  createCacheError,
  createDatabaseError,
  createOfflineQueueError
} from './error-classes';