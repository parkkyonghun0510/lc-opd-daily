/**
 * Base application error class that extends the standard Error
 * All custom errors should extend this class
 */
export class AppError extends Error {
    public readonly code: string;
    public readonly httpStatus: number;
    public readonly isOperational: boolean;
    public readonly context?: Record<string, any>;

    constructor(
        message: string,
        code: string = 'INTERNAL_ERROR',
        httpStatus: number = 500,
        isOperational: boolean = true,
        context?: Record<string, any>
    ) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.httpStatus = httpStatus;
        this.isOperational = isOperational; // Operational errors are expected errors
        this.context = context;

        // Maintains proper stack trace
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Authentication error - used when user is not authenticated
 */
export class AuthError extends AppError {
    constructor(
        message: string = 'Authentication failed',
        code: string = 'AUTH_ERROR',
        httpStatus: number = 401,
        context?: Record<string, any>
    ) {
        super(message, code, httpStatus, true, context);
    }
}

/**
 * Authorization error - used when user doesn't have permission
 */
export class ForbiddenError extends AppError {
    constructor(
        message: string = 'Access denied',
        code: string = 'FORBIDDEN',
        httpStatus: number = 403,
        context?: Record<string, any>
    ) {
        super(message, code, httpStatus, true, context);
    }
}

/**
 * Validation error - used for input validation failures
 */
export class ValidationError extends AppError {
    constructor(
        message: string = 'Validation failed',
        code: string = 'VALIDATION_ERROR',
        httpStatus: number = 400,
        context?: Record<string, any>
    ) {
        super(message, code, httpStatus, true, context);
    }
}

/**
 * Not found error - used when a requested resource doesn't exist
 */
export class NotFoundError extends AppError {
    constructor(
        message: string = 'Resource not found',
        code: string = 'NOT_FOUND',
        httpStatus: number = 404,
        context?: Record<string, any>
    ) {
        super(message, code, httpStatus, true, context);
    }
}

/**
 * Database error - used for database operation failures
 */
export class DatabaseError extends AppError {
    constructor(
        message: string = 'Database operation failed',
        code: string = 'DB_ERROR',
        httpStatus: number = 500,
        context?: Record<string, any>
    ) {
        super(message, code, httpStatus, false, context);
    }
}

/**
 * External service error - used for failures in external API calls
 */
export class ExternalServiceError extends AppError {
    constructor(
        message: string = 'External service error',
        code: string = 'EXTERNAL_ERROR',
        httpStatus: number = 502,
        context?: Record<string, any>
    ) {
        super(message, code, httpStatus, false, context);
    }
}

/**
 * Conflict error - used for resource conflicts (e.g., duplicate entries)
 */
export class ConflictError extends AppError {
    constructor(
        message: string = 'Resource conflict',
        code: string = 'CONFLICT',
        httpStatus: number = 409,
        context?: Record<string, any>
    ) {
        super(message, code, httpStatus, true, context);
    }
}

/**
 * Rate limit error - used when rate limits are exceeded
 */
export class RateLimitError extends AppError {
    constructor(
        message: string = 'Rate limit exceeded',
        code: string = 'RATE_LIMIT',
        httpStatus: number = 429,
        context?: Record<string, any>
    ) {
        super(message, code, httpStatus, true, context);
    }
}
