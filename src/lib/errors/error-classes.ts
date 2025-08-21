/**
 * Error classes implementing the error interfaces
 * These replace string-based error messages with proper typed error instances
 */

import {
  BaseError,
  AuthError,
  ValidationError,
  NetworkError,
  CacheError,
  DatabaseError,
  OfflineQueueError,
  AuthErrorCode,
  ValidationErrorCode,
  NetworkErrorCode,
  CacheErrorCode,
  DatabaseErrorCode,
  OfflineQueueErrorCode,
  ErrorSeverity,
  ErrorContext
} from '@/types/errors';

// Base error class
export abstract class AppErrorBase extends Error implements BaseError {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;
  public readonly retryable: boolean;
  public readonly severity: ErrorSeverity;

  constructor(
    code: string,
    message: string,
    options: {
      context?: Record<string, any>;
      retryable?: boolean;
      severity?: ErrorSeverity;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.context = options.context;
    this.retryable = options.retryable ?? false;
    this.severity = options.severity ?? ErrorSeverity.MEDIUM;

    if (options.cause) {
      this.cause = options.cause;
    }

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Serialize error for logging/reporting
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      retryable: this.retryable,
      severity: this.severity,
      stack: this.stack
    };
  }

  // Create error with additional context
  withContext(context: Record<string, any>): this {
    const newError = Object.create(Object.getPrototypeOf(this));
    Object.assign(newError, this, {
      context: { ...this.context, ...context }
    });
    return newError;
  }
}

// Authentication error class
export class AppAuthError extends AppErrorBase implements AuthError {
  public readonly type = 'AUTH_ERROR' as const;
  public readonly authCode: AuthErrorCode;
  public readonly userId?: string;
  public readonly sessionId?: string;

  constructor(
    authCode: AuthErrorCode,
    message?: string,
    options: {
      userId?: string;
      sessionId?: string;
      context?: Record<string, any>;
      retryable?: boolean;
      severity?: ErrorSeverity;
      cause?: Error;
    } = {}
  ) {
    const defaultMessage = AppAuthError.getDefaultMessage(authCode);
    super(
      authCode,
      message || defaultMessage,
      {
        ...options,
        severity: options.severity || AppAuthError.getDefaultSeverity(authCode),
        retryable: options.retryable ?? AppAuthError.isRetryable(authCode)
      }
    );
    
    this.authCode = authCode;
    this.userId = options.userId;
    this.sessionId = options.sessionId;
  }

  private static getDefaultMessage(code: AuthErrorCode): string {
    const messages: Record<AuthErrorCode, string> = {
      [AuthErrorCode.INVALID_CREDENTIALS]: 'Invalid username or password',
      [AuthErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please sign in again',
      [AuthErrorCode.TOKEN_INVALID]: 'Invalid authentication token',
      [AuthErrorCode.TOKEN_EXPIRED]: 'Authentication token has expired',
      [AuthErrorCode.UNAUTHORIZED]: 'You are not authorized to access this resource',
      [AuthErrorCode.FORBIDDEN]: 'Access to this resource is forbidden',
      [AuthErrorCode.ACCOUNT_LOCKED]: 'Your account has been locked. Please contact support',
      [AuthErrorCode.ACCOUNT_DISABLED]: 'Your account has been disabled. Please contact support',
      [AuthErrorCode.RATE_LIMITED]: 'Too many login attempts. Please try again later',
      [AuthErrorCode.MFA_REQUIRED]: 'Multi-factor authentication is required',
      [AuthErrorCode.PASSWORD_EXPIRED]: 'Your password has expired. Please update it',
      [AuthErrorCode.SIGNIN_FAILED]: 'Sign in failed. Please try again',
      [AuthErrorCode.SIGNOUT_FAILED]: 'Sign out failed. Please try again',
      [AuthErrorCode.REFRESH_FAILED]: 'Failed to refresh authentication. Please sign in again'
    };
    return messages[code] || 'Authentication error occurred';
  }

  private static getDefaultSeverity(code: AuthErrorCode): ErrorSeverity {
    const criticalCodes = [AuthErrorCode.ACCOUNT_LOCKED, AuthErrorCode.ACCOUNT_DISABLED];
    const highCodes = [AuthErrorCode.SESSION_EXPIRED, AuthErrorCode.TOKEN_EXPIRED, AuthErrorCode.UNAUTHORIZED];
    const mediumCodes = [AuthErrorCode.INVALID_CREDENTIALS, AuthErrorCode.FORBIDDEN, AuthErrorCode.RATE_LIMITED];
    
    if (criticalCodes.includes(code)) return ErrorSeverity.CRITICAL;
    if (highCodes.includes(code)) return ErrorSeverity.HIGH;
    if (mediumCodes.includes(code)) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  }

  private static isRetryable(code: AuthErrorCode): boolean {
    const nonRetryableCodes = [
      AuthErrorCode.INVALID_CREDENTIALS,
      AuthErrorCode.UNAUTHORIZED,
      AuthErrorCode.FORBIDDEN,
      AuthErrorCode.ACCOUNT_LOCKED,
      AuthErrorCode.ACCOUNT_DISABLED,
      AuthErrorCode.PASSWORD_EXPIRED
    ];
    return !nonRetryableCodes.includes(code);
  }
}

// Validation error class
export class AppValidationError extends AppErrorBase implements ValidationError {
  public readonly type = 'VALIDATION_ERROR' as const;
  public readonly validationCode: ValidationErrorCode;
  public readonly field?: string;
  public readonly value?: any;

  constructor(
    validationCode: ValidationErrorCode,
    message?: string,
    options: {
      field?: string;
      value?: any;
      context?: Record<string, any>;
      severity?: ErrorSeverity;
      cause?: Error;
    } = {}
  ) {
    const defaultMessage = AppValidationError.getDefaultMessage(validationCode, options.field);
    super(
      validationCode,
      message || defaultMessage,
      {
        ...options,
        severity: options.severity || ErrorSeverity.MEDIUM,
        retryable: false // Validation errors are generally not retryable
      }
    );
    
    this.validationCode = validationCode;
    this.field = options.field;
    this.value = options.value;
  }

  private static getDefaultMessage(code: ValidationErrorCode, field?: string): string {
    const fieldName = field || 'field';
    const messages: Record<ValidationErrorCode, string> = {
      [ValidationErrorCode.REQUIRED_FIELD]: `${fieldName} is required`,
      [ValidationErrorCode.INVALID_FORMAT]: `${fieldName} has invalid format`,
      [ValidationErrorCode.INVALID_LENGTH]: `${fieldName} has invalid length`,
      [ValidationErrorCode.INVALID_CHARACTERS]: `${fieldName} contains invalid characters`,
      [ValidationErrorCode.INVALID_EMAIL]: 'Invalid email address format',
      [ValidationErrorCode.WEAK_PASSWORD]: 'Password does not meet security requirements',
      [ValidationErrorCode.PASSWORD_MISMATCH]: 'Passwords do not match',
      [ValidationErrorCode.INVALID_USERNAME]: 'Username format is invalid',
      [ValidationErrorCode.SANITIZATION_FAILED]: `Failed to sanitize ${fieldName}`,
      [ValidationErrorCode.SCHEMA_VALIDATION_FAILED]: 'Data does not match required schema'
    };
    return messages[code] || 'Validation error occurred';
  }
}

// Network error class
export class AppNetworkError extends AppErrorBase implements NetworkError {
  public readonly type = 'NETWORK_ERROR' as const;
  public readonly networkCode: NetworkErrorCode;
  public readonly url?: string;
  public readonly method?: string;
  public readonly statusCode?: number;

  constructor(
    networkCode: NetworkErrorCode,
    message?: string,
    options: {
      url?: string;
      method?: string;
      statusCode?: number;
      context?: Record<string, any>;
      severity?: ErrorSeverity;
      cause?: Error;
    } = {}
  ) {
    const defaultMessage = AppNetworkError.getDefaultMessage(networkCode, options.statusCode);
    super(
      networkCode,
      message || defaultMessage,
      {
        ...options,
        severity: options.severity || AppNetworkError.getDefaultSeverity(networkCode),
        retryable: AppNetworkError.isRetryable(networkCode)
      }
    );
    
    this.networkCode = networkCode;
    this.url = options.url;
    this.method = options.method;
    this.statusCode = options.statusCode;
  }

  private static getDefaultMessage(code: NetworkErrorCode, statusCode?: number): string {
    const messages: Record<NetworkErrorCode, string> = {
      [NetworkErrorCode.CONNECTION_FAILED]: 'Failed to connect to server',
      [NetworkErrorCode.TIMEOUT]: 'Request timed out',
      [NetworkErrorCode.OFFLINE]: 'You are currently offline',
      [NetworkErrorCode.SERVER_ERROR]: `Server error${statusCode ? ` (${statusCode})` : ''}`,
      [NetworkErrorCode.BAD_REQUEST]: 'Invalid request',
      [NetworkErrorCode.NOT_FOUND]: 'Resource not found',
      [NetworkErrorCode.CONFLICT]: 'Request conflict',
      [NetworkErrorCode.TOO_MANY_REQUESTS]: 'Too many requests. Please try again later',
      [NetworkErrorCode.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
      [NetworkErrorCode.GATEWAY_TIMEOUT]: 'Gateway timeout',
      [NetworkErrorCode.NETWORK_ERROR]: 'Network error occurred',
      [NetworkErrorCode.CORS_ERROR]: 'Cross-origin request blocked'
    };
    return messages[code] || 'Network error occurred';
  }

  private static getDefaultSeverity(code: NetworkErrorCode): ErrorSeverity {
    const criticalCodes = [NetworkErrorCode.SERVICE_UNAVAILABLE, NetworkErrorCode.GATEWAY_TIMEOUT];
    const highCodes = [NetworkErrorCode.SERVER_ERROR, NetworkErrorCode.CONNECTION_FAILED];
    const mediumCodes = [NetworkErrorCode.TIMEOUT, NetworkErrorCode.TOO_MANY_REQUESTS];
    
    if (criticalCodes.includes(code)) return ErrorSeverity.CRITICAL;
    if (highCodes.includes(code)) return ErrorSeverity.HIGH;
    if (mediumCodes.includes(code)) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  }

  private static isRetryable(code: NetworkErrorCode): boolean {
    const nonRetryableCodes = [
      NetworkErrorCode.BAD_REQUEST,
      NetworkErrorCode.NOT_FOUND,
      NetworkErrorCode.CONFLICT,
      NetworkErrorCode.CORS_ERROR
    ];
    return !nonRetryableCodes.includes(code);
  }
}

// Cache error class
export class AppCacheError extends AppErrorBase implements CacheError {
  public readonly type = 'CACHE_ERROR' as const;
  public readonly cacheCode: CacheErrorCode;
  public readonly key?: string;
  public readonly operation?: 'get' | 'set' | 'delete' | 'invalidate';

  constructor(
    cacheCode: CacheErrorCode,
    message?: string,
    options: {
      key?: string;
      operation?: 'get' | 'set' | 'delete' | 'invalidate';
      context?: Record<string, any>;
      severity?: ErrorSeverity;
      cause?: Error;
    } = {}
  ) {
    const defaultMessage = AppCacheError.getDefaultMessage(cacheCode, options.operation);
    super(
      cacheCode,
      message || defaultMessage,
      {
        ...options,
        severity: options.severity || ErrorSeverity.LOW,
        retryable: AppCacheError.isRetryable(cacheCode)
      }
    );
    
    this.cacheCode = cacheCode;
    this.key = options.key;
    this.operation = options.operation;
  }

  private static getDefaultMessage(code: CacheErrorCode, operation?: string): string {
    const op = operation || 'operation';
    const messages: Record<CacheErrorCode, string> = {
      [CacheErrorCode.CACHE_MISS]: 'Cache miss occurred',
      [CacheErrorCode.CACHE_SET_FAILED]: 'Failed to set cache value',
      [CacheErrorCode.CACHE_GET_FAILED]: 'Failed to get cache value',
      [CacheErrorCode.CACHE_DELETE_FAILED]: 'Failed to delete cache value',
      [CacheErrorCode.CACHE_INVALIDATION_FAILED]: 'Failed to invalidate cache',
      [CacheErrorCode.CACHE_CONNECTION_FAILED]: 'Failed to connect to cache server',
      [CacheErrorCode.CACHE_SERIALIZATION_FAILED]: 'Failed to serialize cache data',
      [CacheErrorCode.CACHE_DESERIALIZATION_FAILED]: 'Failed to deserialize cache data'
    };
    return messages[code] || `Cache ${op} failed`;
  }

  private static isRetryable(code: CacheErrorCode): boolean {
    const retryableCodes = [
      CacheErrorCode.CACHE_CONNECTION_FAILED,
      CacheErrorCode.CACHE_SET_FAILED,
      CacheErrorCode.CACHE_GET_FAILED,
      CacheErrorCode.CACHE_DELETE_FAILED,
      CacheErrorCode.CACHE_INVALIDATION_FAILED
    ];
    return retryableCodes.includes(code);
  }
}

// Database error class
export class AppDatabaseError extends AppErrorBase implements DatabaseError {
  public readonly type = 'DATABASE_ERROR' as const;
  public readonly dbCode: DatabaseErrorCode;
  public readonly query?: string;
  public readonly table?: string;

  constructor(
    dbCode: DatabaseErrorCode,
    message?: string,
    options: {
      query?: string;
      table?: string;
      context?: Record<string, any>;
      severity?: ErrorSeverity;
      cause?: Error;
    } = {}
  ) {
    const defaultMessage = AppDatabaseError.getDefaultMessage(dbCode);
    super(
      dbCode,
      message || defaultMessage,
      {
        ...options,
        severity: options.severity || AppDatabaseError.getDefaultSeverity(dbCode),
        retryable: AppDatabaseError.isRetryable(dbCode)
      }
    );
    
    this.dbCode = dbCode;
    this.query = options.query;
    this.table = options.table;
  }

  private static getDefaultMessage(code: DatabaseErrorCode): string {
    const messages: Record<DatabaseErrorCode, string> = {
      [DatabaseErrorCode.CONNECTION_FAILED]: 'Database connection failed',
      [DatabaseErrorCode.QUERY_FAILED]: 'Database query failed',
      [DatabaseErrorCode.TRANSACTION_FAILED]: 'Database transaction failed',
      [DatabaseErrorCode.CONSTRAINT_VIOLATION]: 'Database constraint violation',
      [DatabaseErrorCode.DUPLICATE_KEY]: 'Duplicate key violation',
      [DatabaseErrorCode.FOREIGN_KEY_VIOLATION]: 'Foreign key constraint violation',
      [DatabaseErrorCode.NOT_NULL_VIOLATION]: 'Not null constraint violation',
      [DatabaseErrorCode.CHECK_VIOLATION]: 'Check constraint violation',
      [DatabaseErrorCode.SERIALIZATION_FAILURE]: 'Database serialization failure',
      [DatabaseErrorCode.DEADLOCK_DETECTED]: 'Database deadlock detected'
    };
    return messages[code] || 'Database error occurred';
  }

  private static getDefaultSeverity(code: DatabaseErrorCode): ErrorSeverity {
    const criticalCodes = [DatabaseErrorCode.CONNECTION_FAILED, DatabaseErrorCode.DEADLOCK_DETECTED];
    const highCodes = [DatabaseErrorCode.TRANSACTION_FAILED, DatabaseErrorCode.SERIALIZATION_FAILURE];
    const mediumCodes = [DatabaseErrorCode.QUERY_FAILED, DatabaseErrorCode.CONSTRAINT_VIOLATION];
    
    if (criticalCodes.includes(code)) return ErrorSeverity.CRITICAL;
    if (highCodes.includes(code)) return ErrorSeverity.HIGH;
    if (mediumCodes.includes(code)) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  }

  private static isRetryable(code: DatabaseErrorCode): boolean {
    const retryableCodes = [
      DatabaseErrorCode.CONNECTION_FAILED,
      DatabaseErrorCode.SERIALIZATION_FAILURE,
      DatabaseErrorCode.DEADLOCK_DETECTED
    ];
    return retryableCodes.includes(code);
  }
}

// Offline queue error class
export class AppOfflineQueueError extends AppErrorBase implements OfflineQueueError {
  public readonly type = 'OFFLINE_QUEUE_ERROR' as const;
  public readonly queueCode: OfflineQueueErrorCode;
  public readonly requestId?: string;
  public readonly queueSize?: number;

  constructor(
    queueCode: OfflineQueueErrorCode,
    message?: string,
    options: {
      requestId?: string;
      queueSize?: number;
      context?: Record<string, any>;
      severity?: ErrorSeverity;
      cause?: Error;
    } = {}
  ) {
    const defaultMessage = AppOfflineQueueError.getDefaultMessage(queueCode);
    super(
      queueCode,
      message || defaultMessage,
      {
        ...options,
        severity: options.severity || ErrorSeverity.MEDIUM,
        retryable: AppOfflineQueueError.isRetryable(queueCode)
      }
    );
    
    this.queueCode = queueCode;
    this.requestId = options.requestId;
    this.queueSize = options.queueSize;
  }

  private static getDefaultMessage(code: OfflineQueueErrorCode): string {
    const messages: Record<OfflineQueueErrorCode, string> = {
      [OfflineQueueErrorCode.QUEUE_FULL]: 'Offline queue is full',
      [OfflineQueueErrorCode.QUEUE_STORAGE_FAILED]: 'Failed to store request in offline queue',
      [OfflineQueueErrorCode.QUEUE_RETRIEVAL_FAILED]: 'Failed to retrieve request from offline queue',
      [OfflineQueueErrorCode.QUEUE_PROCESSING_FAILED]: 'Failed to process offline queue request',
      [OfflineQueueErrorCode.QUEUE_SERIALIZATION_FAILED]: 'Failed to serialize offline queue data',
      [OfflineQueueErrorCode.QUEUE_DESERIALIZATION_FAILED]: 'Failed to deserialize offline queue data'
    };
    return messages[code] || 'Offline queue error occurred';
  }

  private static isRetryable(code: OfflineQueueErrorCode): boolean {
    const retryableCodes = [
      OfflineQueueErrorCode.QUEUE_STORAGE_FAILED,
      OfflineQueueErrorCode.QUEUE_RETRIEVAL_FAILED,
      OfflineQueueErrorCode.QUEUE_PROCESSING_FAILED
    ];
    return retryableCodes.includes(code);
  }
}

// Error factory functions for easy creation
export const createAuthError = (
  code: AuthErrorCode,
  message?: string,
  options?: {
    userId?: string;
    sessionId?: string;
    context?: Record<string, any>;
    retryable?: boolean;
    severity?: ErrorSeverity;
    cause?: Error;
  }
) => new AppAuthError(code, message, options);

export const createValidationError = (
  code: ValidationErrorCode,
  message?: string,
  options?: {
    field?: string;
    value?: any;
    context?: Record<string, any>;
    severity?: ErrorSeverity;
    cause?: Error;
  }
) => new AppValidationError(code, message, options);

export const createNetworkError = (
  code: NetworkErrorCode,
  message?: string,
  options?: {
    url?: string;
    method?: string;
    statusCode?: number;
    context?: Record<string, any>;
    severity?: ErrorSeverity;
    cause?: Error;
  }
) => new AppNetworkError(code, message, options);

export const createCacheError = (
  code: CacheErrorCode,
  message?: string,
  options?: {
    key?: string;
    operation?: 'get' | 'set' | 'delete' | 'invalidate';
    context?: Record<string, any>;
    severity?: ErrorSeverity;
    cause?: Error;
  }
) => new AppCacheError(code, message, options);

export const createDatabaseError = (
  code: DatabaseErrorCode,
  message?: string,
  options?: {
    query?: string;
    table?: string;
    context?: Record<string, any>;
    severity?: ErrorSeverity;
    cause?: Error;
  }
) => new AppDatabaseError(code, message, options);

export const createOfflineQueueError = (
  code: OfflineQueueErrorCode,
  message?: string,
  options?: {
    requestId?: string;
    queueSize?: number;
    context?: Record<string, any>;
    severity?: ErrorSeverity;
    cause?: Error;
  }
) => new AppOfflineQueueError(code, message, options);

export { NetworkErrorCode };
