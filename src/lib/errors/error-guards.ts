import {
    AppError,
    ValidationError,
    AuthError,
    NotFoundError,
    DatabaseError,
    ForbiddenError,
    ExternalServiceError,
    ConflictError,
    RateLimitError
} from './app-errors';

/**
 * Type guard to check if an error is an AppError
 * @param error The error to check
 * @returns True if the error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Type guard to check if an error is a ValidationError
 * @param error The error to check
 * @returns True if the error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
    return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is an AuthError
 * @param error The error to check
 * @returns True if the error is an AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
    return error instanceof AuthError;
}

/**
 * Type guard to check if an error is a ForbiddenError
 * @param error The error to check
 * @returns True if the error is a ForbiddenError
 */
export function isForbiddenError(error: unknown): error is ForbiddenError {
    return error instanceof ForbiddenError;
}

/**
 * Type guard to check if an error is a NotFoundError
 * @param error The error to check
 * @returns True if the error is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
    return error instanceof NotFoundError;
}

/**
 * Type guard to check if an error is a DatabaseError
 * @param error The error to check
 * @returns True if the error is a DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
    return error instanceof DatabaseError;
}

/**
 * Type guard to check if an error is an ExternalServiceError
 * @param error The error to check
 * @returns True if the error is an ExternalServiceError
 */
export function isExternalServiceError(error: unknown): error is ExternalServiceError {
    return error instanceof ExternalServiceError;
}

/**
 * Type guard to check if an error is a ConflictError
 * @param error The error to check
 * @returns True if the error is a ConflictError
 */
export function isConflictError(error: unknown): error is ConflictError {
    return error instanceof ConflictError;
}

/**
 * Type guard to check if an error is a RateLimitError
 * @param error The error to check
 * @returns True if the error is a RateLimitError
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
    return error instanceof RateLimitError;
}

/**
 * Helper to convert unknown errors to AppError
 * @param error The error to convert
 * @returns An AppError instance
 */
export function toAppError(error: unknown): AppError {
    if (isAppError(error)) {
        return error;
    }

    if (error instanceof Error) {
        return new AppError(
            error.message,
            'INTERNAL_ERROR',
            500,
            false,
            { originalError: error.name, stack: error.stack }
        );
    }

    return new AppError(
        String(error),
        'UNKNOWN_ERROR',
        500,
        false,
        { originalError: error }
    );
}

/**
 * Helper to extract error code from any error
 * @param error The error to extract code from
 * @returns The error code or 'UNKNOWN_ERROR'
 */
export function getErrorCode(error: unknown): string {
    if (isAppError(error)) {
        return error.code;
    }
    return 'UNKNOWN_ERROR';
}

/**
 * Helper to extract HTTP status from any error
 * @param error The error to extract status from
 * @returns The HTTP status code or 500
 */
export function getErrorStatus(error: unknown): number {
    if (isAppError(error)) {
        return error.httpStatus;
    }
    return 500;
}
