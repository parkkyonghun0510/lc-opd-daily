/**
 * Consolidated error handling exports
 * Single entry point for all error handling utilities
 */

// Export error types and interfaces
export * from '@/types/errors';

// Export error classes
export {
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

// Export error handler
export {
  handleError,
  registerErrorHandler,
  registerRecoveryStrategy,
  registerErrorReporter,
  getErrorMetrics,
  resetErrorMetrics,
  createErrorBoundaryHandler,
  withErrorHandling
} from './error-handler';

// Export error utilities and patterns
export {
  ErrorUtils,
  ErrorPatterns
} from './error-utils';

// Export error boundary components
export {
  ErrorBoundary,
  withErrorBoundary,
  useErrorHandler,
  SimpleErrorFallback,
  MinimalErrorFallback
} from '@/components/ui/error-boundary';

// Re-export commonly used error codes for convenience
export {
  AuthErrorCode,
  ValidationErrorCode,
  NetworkErrorCode,
  CacheErrorCode,
  DatabaseErrorCode,
  OfflineQueueErrorCode,
  ErrorSeverity
} from '@/types/errors';

// Default export - the main error utility class
export { default } from './error-utils';