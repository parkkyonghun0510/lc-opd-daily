/**
 * Comprehensive error type definitions and interfaces for the authentication system
 * This replaces string-based error messages with proper typed error classes
 */

// Base error interface
export interface BaseError {
  code: string;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  stack?: string;
  retryable?: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Authentication specific error types
export interface AuthError extends BaseError {
  type: 'AUTH_ERROR';
  authCode: AuthErrorCode;
  userId?: string;
  sessionId?: string;
}

export interface ValidationError extends BaseError {
  type: 'VALIDATION_ERROR';
  field?: string;
  validationCode: ValidationErrorCode;
  value?: any;
}

export interface NetworkError extends BaseError {
  type: 'NETWORK_ERROR';
  networkCode: NetworkErrorCode;
  url?: string;
  method?: string;
  statusCode?: number;
}

export interface CacheError extends BaseError {
  type: 'CACHE_ERROR';
  cacheCode: CacheErrorCode;
  key?: string;
  operation?: 'get' | 'set' | 'delete' | 'invalidate';
}

export interface DatabaseError extends BaseError {
  type: 'DATABASE_ERROR';
  dbCode: DatabaseErrorCode;
  query?: string;
  table?: string;
}

// Error code enums
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  RATE_LIMITED = 'RATE_LIMITED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  PASSWORD_EXPIRED = 'PASSWORD_EXPIRED',
  SIGNIN_FAILED = 'SIGNIN_FAILED',
  SIGNOUT_FAILED = 'SIGNOUT_FAILED',
  REFRESH_FAILED = 'REFRESH_FAILED'
}

export enum ValidationErrorCode {
  REQUIRED_FIELD = 'REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_LENGTH = 'INVALID_LENGTH',
  INVALID_CHARACTERS = 'INVALID_CHARACTERS',
  INVALID_EMAIL = 'INVALID_EMAIL',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  PASSWORD_MISMATCH = 'PASSWORD_MISMATCH',
  INVALID_USERNAME = 'INVALID_USERNAME',
  SANITIZATION_FAILED = 'SANITIZATION_FAILED',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED'
}

export enum NetworkErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  OFFLINE = 'OFFLINE',
  SERVER_ERROR = 'SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CORS_ERROR = 'CORS_ERROR',
  OPERATION_CANCELLED = "OPERATION_CANCELLED"
}

export enum CacheErrorCode {
  CACHE_MISS = 'CACHE_MISS',
  CACHE_SET_FAILED = 'CACHE_SET_FAILED',
  CACHE_GET_FAILED = 'CACHE_GET_FAILED',
  CACHE_DELETE_FAILED = 'CACHE_DELETE_FAILED',
  CACHE_INVALIDATION_FAILED = 'CACHE_INVALIDATION_FAILED',
  CACHE_CONNECTION_FAILED = 'CACHE_CONNECTION_FAILED',
  CACHE_SERIALIZATION_FAILED = 'CACHE_SERIALIZATION_FAILED',
  CACHE_DESERIALIZATION_FAILED = 'CACHE_DESERIALIZATION_FAILED'
}

export enum DatabaseErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  DUPLICATE_KEY = 'DUPLICATE_KEY',
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
  NOT_NULL_VIOLATION = 'NOT_NULL_VIOLATION',
  CHECK_VIOLATION = 'CHECK_VIOLATION',
  SERIALIZATION_FAILURE = 'SERIALIZATION_FAILURE',
  DEADLOCK_DETECTED = 'DEADLOCK_DETECTED'
}

// Union type for all error types
export type AppError = AuthError | ValidationError | NetworkError | CacheError | DatabaseError | OfflineQueueError;

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error context interfaces
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  url?: string;
  method?: string;
  timestamp: Date;
  additionalData?: Record<string, any>;
}

// Error handler function type
export type ErrorHandler<T extends BaseError = BaseError> = (
  error: T,
  context?: ErrorContext
) => void | Promise<void>;

// Error recovery strategy interface
export interface ErrorRecoveryStrategy {
  canRecover: (error: AppError) => boolean;
  recover: (error: AppError, context?: ErrorContext) => Promise<boolean>;
  maxRetries?: number;
  retryDelay?: number;
}

// Error reporting interface
export interface ErrorReporter {
  report: (error: AppError, context?: ErrorContext) => Promise<void>;
  reportBatch: (errors: AppError[], context?: ErrorContext) => Promise<void>;
}

// Error metrics interface
export interface ErrorMetrics {
  errorCount: number;
  errorRate: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  lastError?: AppError;
  lastErrorTime?: Date;
}

// Error boundary state interface
export interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
  retryCount: number;
  canRetry: boolean;
}

// Offline queue error interface
export interface OfflineQueueError extends BaseError {
  type: 'OFFLINE_QUEUE_ERROR';
  queueCode: OfflineQueueErrorCode;
  requestId?: string;
  queueSize?: number;
}

export enum OfflineQueueErrorCode {
  QUEUE_FULL = 'QUEUE_FULL',
  QUEUE_STORAGE_FAILED = 'QUEUE_STORAGE_FAILED',
  QUEUE_RETRIEVAL_FAILED = 'QUEUE_RETRIEVAL_FAILED',
  QUEUE_PROCESSING_FAILED = 'QUEUE_PROCESSING_FAILED',
  QUEUE_SERIALIZATION_FAILED = 'QUEUE_SERIALIZATION_FAILED',
  QUEUE_DESERIALIZATION_FAILED = 'QUEUE_DESERIALIZATION_FAILED'
}