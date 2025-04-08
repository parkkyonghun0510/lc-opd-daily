import { ValidationError } from './app-errors';

/**
 * Interface for validation rules
 */
interface ValidationRule<T> {
    test: (value: T) => boolean;
    message: string;
}

/**
 * Validate a single value against a set of rules
 * @param value The value to validate
 * @param rules Array of validation rules to apply
 * @param fieldName Name of the field being validated (for error context)
 * @throws ValidationError if validation fails
 */
export function validate<T>(
    value: T,
    rules: ValidationRule<T>[],
    fieldName: string
): void {
    for (const rule of rules) {
        if (!rule.test(value)) {
            throw new ValidationError(
                rule.message,
                'VALIDATION_ERROR',
                400,
                { field: fieldName, value }
            );
        }
    }
}

/**
 * Validate an object against a schema of validation rules
 * @param obj The object to validate
 * @param schema Validation schema with rules for each field
 * @throws ValidationError if validation fails, with all validation errors
 */
export function validateObject<T extends Record<string, any>>(
    obj: T,
    schema: Record<keyof T, ValidationRule<any>[]>
): void {
    const errors: Record<string, string> = {};

    for (const [field, rules] of Object.entries(schema)) {
        try {
            validate(obj[field], rules, field);
        } catch (error) {
            if (error instanceof ValidationError) {
                errors[field] = error.message;
            }
        }
    }

    if (Object.keys(errors).length > 0) {
        throw new ValidationError(
            'Validation failed',
            'VALIDATION_ERROR',
            400,
            { validationErrors: errors }
        );
    }
}

/**
 * Common validation rules
 */
export const ValidationRules = {
    /**
     * Check if a value is required (not null, undefined, or empty string)
     * @param message Custom error message
     * @returns Validation rule
     */
    required: (message = 'This field is required'): ValidationRule<any> => ({
        test: (value) => value !== null && value !== undefined && value !== '',
        message
    }),

    /**
     * Check if a string has a minimum length
     * @param min Minimum length
     * @param message Custom error message
     * @returns Validation rule
     */
    minLength: (min: number, message?: string): ValidationRule<string> => ({
        test: (value) => !value || value.length >= min,
        message: message || `Must be at least ${min} characters`
    }),

    /**
     * Check if a string has a maximum length
     * @param max Maximum length
     * @param message Custom error message
     * @returns Validation rule
     */
    maxLength: (max: number, message?: string): ValidationRule<string> => ({
        test: (value) => !value || value.length <= max,
        message: message || `Must be no more than ${max} characters`
    }),

    /**
     * Check if a value matches a regular expression
     * @param pattern Regular expression to match
     * @param message Custom error message
     * @returns Validation rule
     */
    pattern: (pattern: RegExp, message = 'Invalid format'): ValidationRule<string> => ({
        test: (value) => !value || pattern.test(value),
        message
    }),

    /**
     * Check if a value is a valid email address
     * @param message Custom error message
     * @returns Validation rule
     */
    email: (message = 'Invalid email address'): ValidationRule<string> => ({
        test: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message
    }),

    /**
     * Check if a number is at least a minimum value
     * @param min Minimum value
     * @param message Custom error message
     * @returns Validation rule
     */
    min: (min: number, message?: string): ValidationRule<number> => ({
        test: (value) => value === undefined || value === null || value >= min,
        message: message || `Must be at least ${min}`
    }),

    /**
     * Check if a number is at most a maximum value
     * @param max Maximum value
     * @param message Custom error message
     * @returns Validation rule
     */
    max: (max: number, message?: string): ValidationRule<number> => ({
        test: (value) => value === undefined || value === null || value <= max,
        message: message || `Must be no more than ${max}`
    }),

    /**
     * Check if a value is one of a set of allowed values
     * @param allowed Array of allowed values
     * @param message Custom error message
     * @returns Validation rule
     */
    oneOf: <T>(allowed: T[], message?: string): ValidationRule<T> => ({
        test: (value) => value === undefined || value === null || allowed.includes(value),
        message: message || `Must be one of: ${allowed.join(', ')}`
    }),

    /**
     * Custom validation rule
     * @param testFn Custom test function
     * @param message Error message
     * @returns Validation rule
     */
    custom: <T>(testFn: (value: T) => boolean, message: string): ValidationRule<T> => ({
        test: testFn,
        message
    })
};
