/**
 * Comprehensive data validation and sanitization system
 * Provides strict input validation for all form fields with security-focused sanitization
 */

import { ValidationError, ValidationErrorCode } from '@/types/errors';
import { createValidationError } from '@/lib/errors/error-classes';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedValue?: any;
  warnings?: string[];
}

// Field validation options
export interface ValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean | string;
  sanitize?: boolean;
  allowEmpty?: boolean;
  trim?: boolean;
}

// Schema validation interface
export interface ValidationSchema {
  [fieldName: string]: ValidationOptions;
}

// Sanitization options
export interface SanitizationOptions {
  stripHtml?: boolean;
  escapeHtml?: boolean;
  normalizeWhitespace?: boolean;
  removeControlChars?: boolean;
  maxLength?: number;
  allowedChars?: RegExp;
}

// Common validation patterns
export const ValidationPatterns = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  USERNAME: /^[a-zA-Z0-9_-]{3,20}$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  ALPHA: /^[a-zA-Z]+$/,
  NUMERIC: /^[0-9]+$/,
  NO_SCRIPT: /^(?!.*<script).*$/i,
  NO_SQL_INJECTION: /^(?!.*(union|select|insert|update|delete|drop|create|alter|exec|execute)).*$/i
};

// Predefined validation schemas
export const ValidationSchemas = {
  LOGIN: {
    email: {
      required: true,
      pattern: ValidationPatterns.EMAIL,
      maxLength: 254,
      sanitize: true,
      trim: true
    },
    password: {
      required: true,
      minLength: 8,
      maxLength: 128,
      sanitize: true
    }
  },
  
  REGISTER: {
    email: {
      required: true,
      pattern: ValidationPatterns.EMAIL,
      maxLength: 254,
      sanitize: true,
      trim: true
    },
    password: {
      required: true,
      pattern: ValidationPatterns.PASSWORD,
      minLength: 8,
      maxLength: 128,
      sanitize: true
    },
    confirmPassword: {
      required: true,
      sanitize: true
    },
    username: {
      required: true,
      pattern: ValidationPatterns.USERNAME,
      minLength: 3,
      maxLength: 20,
      sanitize: true,
      trim: true
    },
    firstName: {
      required: true,
      pattern: ValidationPatterns.ALPHA,
      minLength: 1,
      maxLength: 50,
      sanitize: true,
      trim: true
    },
    lastName: {
      required: true,
      pattern: ValidationPatterns.ALPHA,
      minLength: 1,
      maxLength: 50,
      sanitize: true,
      trim: true
    }
  },
  
  PROFILE: {
    firstName: {
      required: true,
      pattern: ValidationPatterns.ALPHA,
      minLength: 1,
      maxLength: 50,
      sanitize: true,
      trim: true
    },
    lastName: {
      required: true,
      pattern: ValidationPatterns.ALPHA,
      minLength: 1,
      maxLength: 50,
      sanitize: true,
      trim: true
    },
    phone: {
      required: false,
      pattern: ValidationPatterns.PHONE,
      sanitize: true,
      trim: true
    },
    bio: {
      required: false,
      maxLength: 500,
      sanitize: true,
      trim: true
    }
  }
};

// Sanitization functions
export class Sanitizer {
  /**
   * Sanitize string input with comprehensive security measures
   */
  static sanitizeString(
    value: string,
    options: SanitizationOptions = {}
  ): string {
    if (typeof value !== 'string') {
      return String(value || '');
    }
    
    let sanitized = value;
    
    // Remove control characters
    if (options.removeControlChars !== false) {
      sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    }
    
    // Strip HTML tags
    if (options.stripHtml) {
      sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] });
    }
    
    // Escape HTML entities
    if (options.escapeHtml) {
      sanitized = validator.escape(sanitized);
    }
    
    // Normalize whitespace
    if (options.normalizeWhitespace !== false) {
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
    }
    
    // Filter allowed characters
    if (options.allowedChars) {
      sanitized = sanitized.replace(new RegExp(`[^${options.allowedChars.source}]`, 'g'), '');
    }
    
    // Truncate to max length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize email with strict validation
   */
  static sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      return '';
    }
    
    // Convert to lowercase and trim
    let sanitized = email.toLowerCase().trim();
    
    // Remove any HTML tags
    sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] });
    
    // Validate email format
    if (!validator.isEmail(sanitized)) {
      return '';
    }
    
    return sanitized;
  }
  
  /**
   * Sanitize password with security measures
   */
  static sanitizePassword(password: string): string {
    if (!password || typeof password !== 'string') {
      return '';
    }
    
    // Remove control characters but preserve special characters for password strength
    let sanitized = password.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    // Remove any HTML tags
    sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] });
    
    return sanitized;
  }
  
  /**
   * Sanitize username with alphanumeric and safe characters
   */
  static sanitizeUsername(username: string): string {
    if (!username || typeof username !== 'string') {
      return '';
    }
    
    let sanitized = username.trim().toLowerCase();
    
    // Remove HTML tags
    sanitized = DOMPurify.sanitize(sanitized, { ALLOWED_TAGS: [] });
    
    // Allow only alphanumeric, underscore, and hyphen
    sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '');
    
    return sanitized;
  }
}

// Individual field validators
export class FieldValidator {
  /**
   * Validate required field
   */
  static validateRequired(value: any, fieldName: string): ValidationError | null {
    if (value === null || value === undefined || 
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)) {
      return createValidationError(
        ValidationErrorCode.REQUIRED_FIELD,
        `${fieldName} is required`,
        { field: fieldName, value }
      );
    }
    return null;
  }
  
  /**
   * Validate string length
   */
  static validateLength(
    value: string,
    fieldName: string,
    minLength?: number,
    maxLength?: number
  ): ValidationError | null {
    if (typeof value !== 'string') {
      return createValidationError(
        ValidationErrorCode.INVALID_FORMAT,
        `${fieldName} must be a string`,
        { field: fieldName, value }
      );
    }
    
    if (minLength !== undefined && value.length < minLength) {
      return createValidationError(
        ValidationErrorCode.INVALID_LENGTH,
        `${fieldName} must be at least ${minLength} characters long`,
        { field: fieldName, value, context: { minLength } }
      );
    }
    
    if (maxLength !== undefined && value.length > maxLength) {
      return createValidationError(
        ValidationErrorCode.INVALID_LENGTH,
        `${fieldName} must be no more than ${maxLength} characters long`,
        { field: fieldName, value, context: { maxLength } }
      );
    }
    
    return null;
  }
  
  /**
   * Validate pattern match
   */
  static validatePattern(
    value: string,
    fieldName: string,
    pattern: RegExp,
    errorMessage?: string
  ): ValidationError | null {
    if (typeof value !== 'string') {
      return createValidationError(
        ValidationErrorCode.INVALID_FORMAT,
        `${fieldName} must be a string`,
        { field: fieldName, value }
      );
    }
    
    if (!pattern.test(value)) {
      return createValidationError(
        ValidationErrorCode.INVALID_FORMAT,
        errorMessage || `${fieldName} format is invalid`,
        { field: fieldName, value, context: { pattern: pattern.source } }
      );
    }
    
    return null;
  }
  
  /**
   * Validate email format
   */
  static validateEmail(email: string, fieldName: string = 'email'): ValidationError | null {
    if (!email || typeof email !== 'string') {
      return createValidationError(
        ValidationErrorCode.INVALID_EMAIL,
        `${fieldName} is required`,
        { field: fieldName, value: email }
      );
    }
    
    const sanitizedEmail = Sanitizer.sanitizeEmail(email);
    if (!sanitizedEmail || !validator.isEmail(sanitizedEmail)) {
      return createValidationError(
        ValidationErrorCode.INVALID_EMAIL,
        `${fieldName} format is invalid`,
        { field: fieldName, value: email }
      );
    }
    
    return null;
  }
  
  /**
   * Validate password strength
   */
  static validatePassword(password: string, fieldName: string = 'password'): ValidationError | null {
    if (!password || typeof password !== 'string') {
      return createValidationError(
        ValidationErrorCode.WEAK_PASSWORD,
        `${fieldName} is required`,
        { field: fieldName, value: password }
      );
    }
    
    const sanitizedPassword = Sanitizer.sanitizePassword(password);
    
    // Check minimum length
    if (sanitizedPassword.length < 8) {
      return createValidationError(
        ValidationErrorCode.WEAK_PASSWORD,
        `${fieldName} must be at least 8 characters long`,
        { field: fieldName, value: password }
      );
    }
    
    // Check password strength pattern
    if (!ValidationPatterns.PASSWORD.test(sanitizedPassword)) {
      return createValidationError(
        ValidationErrorCode.WEAK_PASSWORD,
        `${fieldName} must contain at least one uppercase letter, one lowercase letter, one number, and one special character`,
        { field: fieldName, value: password }
      );
    }
    
    return null;
  }
  
  /**
   * Validate password confirmation
   */
  static validatePasswordConfirmation(
    password: string,
    confirmPassword: string,
    fieldName: string = 'confirmPassword'
  ): ValidationError | null {
    if (password !== confirmPassword) {
      return createValidationError(
        ValidationErrorCode.PASSWORD_MISMATCH,
        'Passwords do not match',
        { field: fieldName, value: confirmPassword }
      );
    }
    
    return null;
  }
}

// Main validator class
export class Validator {
  /**
   * Validate a single field
   */
  static validateField(
    value: any,
    fieldName: string,
    options: ValidationOptions
  ): ValidationResult {
    const errors: ValidationError[] = [];
    let sanitizedValue = value;
    const warnings: string[] = [];
    
    // Trim string values if specified
    if (options.trim && typeof value === 'string') {
      sanitizedValue = value.trim();
    }
    
    // Check if field is required
    if (options.required) {
      const requiredError = FieldValidator.validateRequired(sanitizedValue, fieldName);
      if (requiredError) {
        errors.push(requiredError);
        return { isValid: false, errors, sanitizedValue };
      }
    }
    
    // Skip further validation if empty and not required
    if (!options.required && (sanitizedValue === '' || sanitizedValue == null)) {
      return { isValid: true, errors: [], sanitizedValue };
    }
    
    // Sanitize value if specified
    if (options.sanitize && typeof sanitizedValue === 'string') {
      const originalValue = sanitizedValue;
      sanitizedValue = Sanitizer.sanitizeString(sanitizedValue, {
        stripHtml: true,
        normalizeWhitespace: true,
        removeControlChars: true
      });
      
      if (originalValue !== sanitizedValue) {
        warnings.push(`${fieldName} was sanitized for security`);
      }
    }
    
    // Validate length
    if (typeof sanitizedValue === 'string') {
      const lengthError = FieldValidator.validateLength(
        sanitizedValue,
        fieldName,
        options.minLength,
        options.maxLength
      );
      if (lengthError) {
        errors.push(lengthError);
      }
    }
    
    // Validate pattern
    if (options.pattern && typeof sanitizedValue === 'string') {
      const patternError = FieldValidator.validatePattern(
        sanitizedValue,
        fieldName,
        options.pattern
      );
      if (patternError) {
        errors.push(patternError);
      }
    }
    
    // Run custom validator
    if (options.customValidator) {
      const customResult = options.customValidator(sanitizedValue);
      if (customResult !== true) {
        const errorMessage = typeof customResult === 'string' ? customResult : `${fieldName} is invalid`;
        errors.push(createValidationError(
          ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
          errorMessage,
          { field: fieldName, value: sanitizedValue }
        ));
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
  
  /**
   * Validate an object against a schema
   */
  static validateSchema(
    data: Record<string, any>,
    schema: ValidationSchema
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const sanitizedData: Record<string, any> = {};
    const warnings: string[] = [];
    
    // Validate each field in the schema
    for (const [fieldName, options] of Object.entries(schema)) {
      const fieldValue = data[fieldName];
      const fieldResult = this.validateField(fieldValue, fieldName, options);
      
      if (!fieldResult.isValid) {
        errors.push(...fieldResult.errors);
      }
      
      sanitizedData[fieldName] = fieldResult.sanitizedValue;
      
      if (fieldResult.warnings) {
        warnings.push(...fieldResult.warnings);
      }
    }
    
    // Special validation for password confirmation
    if (schema.password && schema.confirmPassword && data.password && data.confirmPassword) {
      const passwordMatchError = FieldValidator.validatePasswordConfirmation(
        sanitizedData.password,
        sanitizedData.confirmPassword
      );
      if (passwordMatchError) {
        errors.push(passwordMatchError);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitizedData,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
  
  /**
   * Validate login credentials with strict security
   */
  static validateLoginCredentials(credentials: {
    email: string;
    password: string;
  }): ValidationResult {
    return this.validateSchema(credentials, ValidationSchemas.LOGIN);
  }
  
  /**
   * Validate registration data
   */
  static validateRegistrationData(data: {
    email: string;
    password: string;
    confirmPassword: string;
    username: string;
    firstName: string;
    lastName: string;
  }): ValidationResult {
    return this.validateSchema(data, ValidationSchemas.REGISTER);
  }
  
  /**
   * Validate profile data
   */
  static validateProfileData(data: {
    firstName: string;
    lastName: string;
    phone?: string;
    bio?: string;
  }): ValidationResult {
    return this.validateSchema(data, ValidationSchemas.PROFILE);
  }
}

// Export convenience functions
export const validateEmail = FieldValidator.validateEmail;
export const validatePassword = FieldValidator.validatePassword;
export const validateRequired = FieldValidator.validateRequired;
export const sanitizeString = Sanitizer.sanitizeString;
export const sanitizeEmail = Sanitizer.sanitizeEmail;
export const sanitizePassword = Sanitizer.sanitizePassword;
export const sanitizeUsername = Sanitizer.sanitizeUsername;