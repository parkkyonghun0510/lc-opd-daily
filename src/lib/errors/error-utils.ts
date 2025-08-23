/**
 * Consolidated error utilities and common patterns
 * Provides unified error handling, validation, and recovery utilities
 */

import {
  AppError,
  ErrorContext,
  ErrorSeverity,
  AuthErrorCode,
  ValidationErrorCode,
  NetworkErrorCode,
  CacheErrorCode,
  DatabaseErrorCode,
  OfflineQueueErrorCode
} from '@/types/errors';
import {
  AppAuthError,
  AppValidationError,
  AppNetworkError,
  AppCacheError,
  AppDatabaseError,
  AppOfflineQueueError,
  createAuthError,
  createValidationError,
  createNetworkError,
  createCacheError,
  createDatabaseError,
  createOfflineQueueError
} from './error-classes';
import { handleError, withErrorHandling } from './error-handler';

// Common error patterns and utilities
export class ErrorUtils {
  // Check if error is retryable
  static isRetryable(error: AppError | Error): boolean {
    if ('retryable' in error && typeof error.retryable === 'boolean') {
      return error.retryable;
    }
    return false;
  }

  // Get error severity
  static getSeverity(error: AppError | Error): ErrorSeverity {
    if ('severity' in error && typeof error.severity === 'string') {
      return error.severity as ErrorSeverity;
    }
    return ErrorSeverity.MEDIUM;
  }

  // Check if error is of specific type
  static isAuthError(error: AppError | Error): error is AppAuthError {
    return error instanceof AppAuthError || (error as AppError).type === 'AUTH_ERROR';
  }

  static isValidationError(error: AppError | Error): error is AppValidationError {
    return error instanceof AppValidationError || (error as AppError).type === 'VALIDATION_ERROR';
  }

  static isNetworkError(error: AppError | Error): error is AppNetworkError {
    return error instanceof AppNetworkError || (error as AppError).type === 'NETWORK_ERROR';
  }

  static isCacheError(error: AppError | Error): error is AppCacheError {
    return error instanceof AppCacheError || (error as AppError).type === 'CACHE_ERROR';
  }

  static isDatabaseError(error: AppError | Error): error is AppDatabaseError {
    return error instanceof AppDatabaseError || (error as AppError).type === 'DATABASE_ERROR';
  }

  static isOfflineQueueError(error: AppError | Error): error is AppOfflineQueueError {
    return error instanceof AppOfflineQueueError || (error as AppError).type === 'OFFLINE_QUEUE_ERROR';
  }

  // Convert regular Error to AppError
  static toAppError(error: Error | AppError): AppError {
    if (error instanceof AppAuthError || 
        error instanceof AppValidationError || 
        error instanceof AppNetworkError ||
        error instanceof AppCacheError || 
        error instanceof AppDatabaseError ||
        error instanceof AppOfflineQueueError) {
      return error;
    }

    // Convert regular Error to NetworkError
    return createNetworkError(
      NetworkErrorCode.NETWORK_ERROR,
      error.message,
      {
        cause: error instanceof Error ? error : undefined,
        context: { originalError: error.constructor.name }
      }
    );
  }

  // Get user-friendly error message
  static getUserMessage(error: AppError | Error): string {
    const appError = this.toAppError(error);
    
    switch (appError.type) {
      case 'AUTH_ERROR':
        return this.getAuthErrorMessage(appError as AppAuthError);
      case 'VALIDATION_ERROR':
        return this.getValidationErrorMessage(appError as AppValidationError);
      case 'NETWORK_ERROR':
        return this.getNetworkErrorMessage(appError as AppNetworkError);
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

  private static getAuthErrorMessage(error: AppAuthError): string {
    switch (error.authCode) {
      case AuthErrorCode.SESSION_EXPIRED:
        return 'Your session has expired. Please sign in again.';
      case AuthErrorCode.UNAUTHORIZED:
        return 'You are not authorized to access this resource.';
      case AuthErrorCode.FORBIDDEN:
        return 'Access to this resource is forbidden.';
      case AuthErrorCode.ACCOUNT_LOCKED:
        return 'Your account has been locked. Please contact support.';
      case AuthErrorCode.RATE_LIMITED:
        return 'Too many attempts. Please try again later.';
      default:
        return error.message;
    }
  }

  private static getValidationErrorMessage(error: AppValidationError): string {
    return error.message;
  }

  private static getNetworkErrorMessage(error: AppNetworkError): string {
    switch (error.networkCode) {
      case NetworkErrorCode.OFFLINE:
        return 'You are currently offline. Please check your connection.';
      case NetworkErrorCode.TIMEOUT:
        return 'Request timed out. Please try again.';
      case NetworkErrorCode.SERVER_ERROR:
        return 'Server error occurred. Please try again later.';
      case NetworkErrorCode.SERVICE_UNAVAILABLE:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return 'Network error occurred. Please try again.';
    }
  }

  // Create context for error reporting
  static createContext(
    additionalData?: Record<string, any>,
    timestamp?: Date
  ): ErrorContext {
    return {
      timestamp: timestamp || new Date(),
      additionalData: {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
        url: typeof window !== 'undefined' ? window.location.href : 'server',
        ...additionalData
      }
    };
  }
}

// Common error handling patterns
export class ErrorPatterns {
  // Handle API errors with common patterns
  static async handleApiError(
    error: Error,
    context?: { url?: string; method?: string; statusCode?: number }
  ): Promise<AppError> {
    let appError: AppError;

    if (context?.statusCode) {
      switch (context.statusCode) {
        case 401:
          appError = createAuthError(
            AuthErrorCode.UNAUTHORIZED,
            'Authentication required',
            { context: { url: context.url, method: context.method } }
          );
          break;
        case 403:
          appError = createAuthError(
            AuthErrorCode.FORBIDDEN,
            'Access forbidden',
            { context: { url: context.url, method: context.method } }
          );
          break;
        case 404:
          appError = createNetworkError(
            NetworkErrorCode.NOT_FOUND,
            'Resource not found',
            { url: context.url, method: context.method, statusCode: context.statusCode }
          );
          break;
        case 429:
          appError = createNetworkError(
            NetworkErrorCode.TOO_MANY_REQUESTS,
            'Too many requests',
            { url: context.url, method: context.method, statusCode: context.statusCode }
          );
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          appError = createNetworkError(
            NetworkErrorCode.SERVER_ERROR,
            'Server error',
            { url: context.url, method: context.method, statusCode: context.statusCode }
          );
          break;
        default:
          appError = createNetworkError(
            NetworkErrorCode.NETWORK_ERROR,
            error.message,
            { url: context.url, method: context.method, statusCode: context.statusCode, cause: error }
          );
      }
    } else {
      appError = ErrorUtils.toAppError(error);
    }

    await handleError(appError, ErrorUtils.createContext(context));
    return appError;
  }

  // Handle form validation errors
  static handleValidationErrors(
    errors: Record<string, string[]>
  ): AppValidationError[] {
    const validationErrors: AppValidationError[] = [];

    Object.entries(errors).forEach(([field, messages]) => {
      messages.forEach(message => {
        const error = createValidationError(
          ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
          message,
          { field }
        );
        validationErrors.push(error);
      });
    });

    return validationErrors;
  }

  // Handle cache operations with error handling
  static async withCacheErrorHandling<T>(
    operation: () => Promise<T>,
    cacheKey?: string,
    cacheOperation?: 'get' | 'set' | 'delete' | 'invalidate'
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const cacheError = createCacheError(
        CacheErrorCode.CACHE_GET_FAILED,
        error instanceof Error ? error.message : 'Cache operation failed',
        {
          key: cacheKey,
          operation: cacheOperation,
          cause: error instanceof Error ? error : undefined
        }
      );
      
      await handleError(cacheError, ErrorUtils.createContext({ cacheKey, cacheOperation }));
      return null;
    }
  }

  // Handle database operations with error handling
  static async withDatabaseErrorHandling<T>(
    operation: () => Promise<T>,
    context?: { query?: string; table?: string }
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      let dbError: AppDatabaseError;
      
      if (error instanceof Error) {
        // Map common database errors
        if (error.message.includes('duplicate key') || error.message.includes('UNIQUE constraint')) {
          dbError = createDatabaseError(
            DatabaseErrorCode.DUPLICATE_KEY,
            'Duplicate entry found',
            { ...context, cause: error }
          );
        } else if (error.message.includes('foreign key') || error.message.includes('FOREIGN KEY constraint')) {
          dbError = createDatabaseError(
            DatabaseErrorCode.FOREIGN_KEY_VIOLATION,
            'Foreign key constraint violation',
            { ...context, cause: error }
          );
        } else if (error.message.includes('not null') || error.message.includes('NOT NULL constraint')) {
          dbError = createDatabaseError(
            DatabaseErrorCode.NOT_NULL_VIOLATION,
            'Required field is missing',
            { ...context, cause: error }
          );
        } else {
          dbError = createDatabaseError(
            DatabaseErrorCode.QUERY_FAILED,
            error.message,
            { ...context, cause: error }
          );
        }
      } else {
        dbError = createDatabaseError(
          DatabaseErrorCode.QUERY_FAILED,
          'Database operation failed',
          context
        );
      }
      
      await handleError(dbError, ErrorUtils.createContext(context));
      throw dbError;
    }
  }
}

// Export commonly used functions
export {
  handleError,
  withErrorHandling,
  createAuthError,
  createValidationError,
  createNetworkError,
  createCacheError,
  createDatabaseError,
  createOfflineQueueError
};

// Export error classes
export {
  AppAuthError,
  AppValidationError,
  AppNetworkError,
  AppCacheError,
  AppDatabaseError,
  AppOfflineQueueError
};

// Default export
export default ErrorUtils;