/**
 * Environment Variables Validation Service
 * 
 * Comprehensive runtime checks for required environment variables
 * Validates Dragonfly/Redis queue functionality and VAPID push notification settings
 */

import { z } from 'zod';

// Environment variable schemas for validation
const EnvironmentSchema = z.object({
  // Dragonfly/Redis Queue Configuration
  DRAGONFLY_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  DRAGONFLY_QUEUE_NAME: z.string().min(1).default('notifications'),
  DRAGONFLY_QUEUE_URL: z.string().url().optional(),

  // VAPID Push Notification Configuration
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID public key is required'),
  VAPID_PRIVATE_KEY: z.string().min(1, 'VAPID private key is required'),
  VAPID_CONTACT_EMAIL: z.string().email('Valid VAPID contact email is required'),
});

// Type for validated environment variables
type ValidatedEnvironment = z.infer<typeof EnvironmentSchema>;

// Validation result interface
interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  data?: ValidatedEnvironment;
}

// Environment validation service
export class EnvironmentValidator {
  private static instance: EnvironmentValidator;
  private validatedEnv: ValidatedEnvironment | null = null;
  private validationResult: ValidationResult | null = null;

  public static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator();
    }
    return EnvironmentValidator.instance;
  }

  /**
   * Validate all required environment variables
   * @param strict Whether to throw errors on validation failure (default: false)
   * @returns Validation result with detailed error messages
   */
  public validateEnvironment(strict: boolean = false): ValidationResult {
    // Skip validation if already validated (but not in development to allow for env changes)
    if (this.validationResult && process.env.NODE_ENV === 'production') {
      return this.validationResult;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const isBrowser = typeof window !== 'undefined';

      // Validate Dragonfly/Redis configuration
      this.validateDragonflyConfig(errors, warnings);

      // Validate VAPID configuration
      this.validateVapidConfig(errors, warnings);

      // Validate using Zod schema
      // In the browser, server-only secrets are not exposed (by design in Next.js),
      // so we use a lighter schema that only requires public variables.
      const clientSchema = z.object({
        DRAGONFLY_URL: z.string().optional(),
        REDIS_URL: z.string().optional(),
        DRAGONFLY_QUEUE_NAME: z.string().min(1).default('notifications'),
        DRAGONFLY_QUEUE_URL: z.string().optional(),
        NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID public key is required'),
      });

      const validation = (isBrowser ? clientSchema : EnvironmentSchema).safeParse(process.env);

      if (!validation.success) {
        validation.error.errors.forEach(error => {
          errors.push(`${error.path.join('.')}: ${error.message}`);
        });
      } else {
        this.validatedEnv = validation.data as ValidatedEnvironment;
      }

      // Additional custom validations
      this.performCustomValidations(errors, warnings);

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const result: ValidationResult = {
      success: errors.length === 0,
      errors,
      warnings,
      data: this.validatedEnv || undefined
    };

    this.validationResult = result;

    if (strict && !result.success) {
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }

    return result;
  }

  /**
   * Validate Dragonfly/Redis queue configuration
   */
  private validateDragonflyConfig(errors: string[], warnings: string[]): void {
    const isBrowser = typeof window !== 'undefined';
    const dragonflyUrl = process.env.DRAGONFLY_URL || process.env.DRAGONFLY_URL;

    // In the browser, private env vars (non NEXT_PUBLIC_) are unavailable.
    // Do not fail the app; just warn that server needs to be configured.
    if (isBrowser) {
      if (!dragonflyUrl) {
        warnings.push('Queue configuration cannot be validated in the browser. Ensure DRAGONFLY_URL or REDIS_URL is set on the server.');
      }
      // Skip strict URL validation in the browser context
      return;
    }

    if (!dragonflyUrl) {
      errors.push('DRAGONFLY_URL or REDIS_URL must be configured for queue functionality');
    } else {
      // Validate URL format
      try {
        new URL(dragonflyUrl);
      } catch {
        errors.push(`Invalid DRAGONFLY_URL format: ${dragonflyUrl}`);
      }
    }

    const queueName = process.env.DRAGONFLY_QUEUE_NAME;
    if (!queueName || queueName.trim().length === 0) {
      warnings.push('DRAGONFLY_QUEUE_NAME not set, using default: "notifications"');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(queueName)) {
      errors.push('DRAGONFLY_QUEUE_NAME must contain only alphanumeric characters, hyphens, and underscores');
    }

    const queueUrl = process.env.DRAGONFLY_QUEUE_URL;
    if (queueUrl) {
      try {
        new URL(queueUrl);
      } catch {
        errors.push(`Invalid DRAGONFLY_QUEUE_URL format: ${queueUrl}`);
      }
    }
  }

  /**
   * Validate VAPID push notification configuration
   */
  private validateVapidConfig(errors: string[], warnings: string[]): void {
    const isBrowser = typeof window !== 'undefined';
    const isProd = process.env.NODE_ENV === 'production';

    if (isBrowser) {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey || publicKey.trim().length === 0) {
        if (isProd) {
          errors.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY is required for push notifications');
        } else {
          warnings.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set; push notifications will be disabled in development');
        }
      } else if (!this.isValidVapidKey(publicKey)) {
        if (isProd) {
          errors.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY must be a valid Base64URL-encoded VAPID public key');
        } else {
          warnings.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY may be invalid; push notifications may not work in development');
        }
      }

      // Private keys are not exposed to the browser – warn instead of error.
      if (!process.env.VAPID_PRIVATE_KEY) {
        warnings.push('VAPID_PRIVATE_KEY cannot be validated in the browser. Ensure it is configured on the server.');
      }
      if (!process.env.VAPID_CONTACT_EMAIL) {
        warnings.push('VAPID_CONTACT_EMAIL cannot be validated in the browser. Ensure it is configured on the server.');
      }
      return;
    }

    // Server-side validation (production strict, development lenient)
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const contactEmail = process.env.VAPID_CONTACT_EMAIL;

    if (!publicKey || publicKey.trim().length === 0) {
      if (isProd) {
        errors.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY is required for push notifications');
      } else {
        warnings.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set; push notifications will be disabled in development');
      }
    } else if (!this.isValidVapidKey(publicKey)) {
      if (isProd) {
        errors.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY must be a valid Base64URL-encoded VAPID public key');
      } else {
        warnings.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY may be invalid; push notifications may not work in development');
      }
    }

    if (!privateKey || privateKey.trim().length === 0) {
      if (isProd) {
        errors.push('VAPID_PRIVATE_KEY is required for push notifications');
      } else {
        warnings.push('VAPID_PRIVATE_KEY is not set; push notifications will be disabled in development');
      }
    } else if (!this.isValidVapidKey(privateKey)) {
      if (isProd) {
        errors.push('VAPID_PRIVATE_KEY must be a valid Base64URL-encoded VAPID private key');
      } else {
        warnings.push('VAPID_PRIVATE_KEY may be invalid; push notifications may not work in development');
      }
    }

    if (!contactEmail) {
      if (isProd) {
        errors.push('VAPID_CONTACT_EMAIL is required for push notifications');
      } else {
        warnings.push('VAPID_CONTACT_EMAIL is not set; push notifications will be disabled in development');
      }
    }
  }

  /**
   * Perform additional custom validations
   */
  private performCustomValidations(errors: string[], warnings: string[]): void {
    // Check if VAPID keys are paired correctly
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (publicKey && privateKey) {
      // Basic check for key length (VAPID keys are typically 43 characters in Base64URL)
      if (publicKey.length < 40 || publicKey.length > 100) {
        warnings.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY appears to be an unusual length');
      }
      if (privateKey.length < 40 || privateKey.length > 100) {
        warnings.push('VAPID_PRIVATE_KEY appears to be an unusual length');
      }
    }

    // Check for production environment requirements
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.DRAGONFLY_URL && !process.env.DRAGONFLY_URL) {
        warnings.push('In production, it is recommended to configure DRAGONFLY_URL or REDIS_URL');
      }
    }
  }

  /**
   * Validate VAPID key format (Base64URL)
   */
  private isValidVapidKey(key: string): boolean {
    // VAPID keys should be Base64URL encoded without padding
    const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
    return base64UrlRegex.test(key) && key.length >= 20;
  }

  /**
   * Get validated environment variables
   */
  public getValidatedEnvironment(): ValidatedEnvironment | null {
    if (!this.validatedEnv) {
      this.validateEnvironment();
    }
    return this.validatedEnv;
  }

  /**
   * Check if environment is valid
   */
  public isValid(): boolean {
    if (!this.validationResult) {
      this.validateEnvironment();
    }
    return this.validationResult?.success || false;
  }

  /**
   * Get validation errors
   */
  public getErrors(): string[] {
    if (!this.validationResult) {
      this.validateEnvironment();
    }
    return this.validationResult?.errors || [];
  }

  /**
   * Get validation warnings
   */
  public getWarnings(): string[] {
    if (!this.validationResult) {
      this.validateEnvironment();
    }
    return this.validationResult?.warnings || [];
  }

  /**
   * Validate VAPID configuration specifically
   */
  public validateVapidConfiguration(): boolean {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const contactEmail = process.env.VAPID_CONTACT_EMAIL;

    if (!publicKey || !privateKey || !contactEmail) {
      return false;
    }

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return false;
    }

    // Key length validation
    if (publicKey.length < 20 || privateKey.length < 20) {
      return false;
    }

    return true;
  }

  /**
   * Clear validation cache (useful for development)
   */
  public clearCache(): void {
    this.validationResult = null;
    this.validatedEnv = null;
  }

  /**
   * Print validation summary to console
   */
  public printValidationSummary(): void {
    const result = this.validateEnvironment();

    console.log('🔍 Environment Variables Validation Summary');
    console.log('='.repeat(50));

    if (result.success) {
      console.log('✅ All environment variables are valid');
    } else {
      console.log('❌ Environment validation failed');
      console.log('\nErrors:');
      result.errors.forEach(error => console.log(`  • ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    console.log('='.repeat(50));
  }
}

// Utility function for quick validation
export function validateEnvironment(strict: boolean = false): ValidationResult {
  const validator = EnvironmentValidator.getInstance();
  return validator.validateEnvironment(strict);
}

// Utility function to check if environment is ready
export function isEnvironmentReady(): boolean {
  const validator = EnvironmentValidator.getInstance();
  return validator.isValid();
}

// Export types
export type { ValidationResult, ValidatedEnvironment };