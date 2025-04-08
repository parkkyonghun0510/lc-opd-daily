import { AppError } from './app-errors';
import { NextResponse } from 'next/server';

/**
 * Structured logging with severity levels
 */
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    FATAL = 'fatal'
}

/**
 * Structure for log entries
 */
interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    error?: Error;
    context?: Record<string, any>;
}

/**
 * Structured logger for consistent error logging
 * @param error The error to log
 * @param level The severity level
 * @param context Additional context information
 */
export function logError(
    error: Error,
    level: LogLevel = LogLevel.ERROR,
    context?: Record<string, any>
): void {
    const logEntry: LogEntry = {
        level,
        message: error.message,
        timestamp: new Date().toISOString(),
        error,
        context
    };

    // For now, use console.error, but this could be replaced with a proper logging service
    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
        console.error(JSON.stringify(logEntry, (key, value) => {
            if (key === 'error') {
                return {
                    name: value.name,
                    message: value.message,
                    stack: value.stack,
                    ...(value instanceof AppError ? {
                        code: value.code,
                        httpStatus: value.httpStatus,
                        isOperational: value.isOperational,
                        context: value.context
                    } : {})
                };
            }
            return value;
        }, 2));
    } else if (level === LogLevel.WARN) {
        console.warn(JSON.stringify(logEntry));
    } else {
        console.log(JSON.stringify(logEntry));
    }
}

/**
 * Helper for API routes to handle errors consistently
 * @param error The error to handle
 * @returns NextResponse with appropriate status and error details
 */
export function handleApiError(error: unknown): NextResponse {
    if (error instanceof AppError) {
        logError(error, error.isOperational ? LogLevel.WARN : LogLevel.ERROR);

        return NextResponse.json(
            {
                error: error.message,
                code: error.code
            },
            { status: error.httpStatus }
        );
    }

    // For unknown errors
    const unknownError = error instanceof Error
        ? error
        : new Error(String(error));

    logError(unknownError, LogLevel.ERROR);

    return NextResponse.json(
        { error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' },
        { status: 500 }
    );
}

/**
 * Helper for server actions to handle errors consistently
 * @param error The error to handle
 * @returns Standardized error response object
 */
export function handleActionError(error: unknown): {
    success: false;
    error: string;
    code?: string;
} {
    if (error instanceof AppError) {
        logError(error, error.isOperational ? LogLevel.WARN : LogLevel.ERROR);

        return {
            success: false,
            error: error.message,
            code: error.code
        };
    }

    // For unknown errors
    const unknownError = error instanceof Error
        ? error
        : new Error(String(error));

    logError(unknownError, LogLevel.ERROR);

    return {
        success: false,
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
    };
}

/**
 * Async error wrapper for cleaner try/catch blocks
 * @param fn The async function to execute
 * @param errorHandler Optional custom error handler
 * @returns The result of the function or the error handler
 */
export async function tryCatch<T>(
    fn: () => Promise<T>,
    errorHandler?: (error: unknown) => any
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (errorHandler) {
            return errorHandler(error);
        }
        throw error;
    }
}

/**
 * Non-critical operation wrapper that won't throw
 * @param fn The async function to execute
 * @param fallbackValue Value to return if the operation fails
 * @param context Additional context for logging
 * @returns The result of the function or the fallback value
 */
export async function tryNonCritical<T>(
    fn: () => Promise<T>,
    fallbackValue: T,
    context?: Record<string, any>
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        logError(
            error instanceof Error ? error : new Error(String(error)),
            LogLevel.WARN,
            { context, operation: 'non-critical' }
        );
        return fallbackValue;
    }
}
