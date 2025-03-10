/**
 * Password validation utility functions
 * These functions help enforce password security requirements
 */

// Password strength levels
export enum PasswordStrength {
  Weak = "weak",
  Medium = "medium",
  Strong = "strong",
  VeryStrong = "very-strong",
}

// Password validation options
export interface PasswordValidationOptions {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
}

// Default password validation options
const defaultOptions: PasswordValidationOptions = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

/**
 * Validates a password against the specified options
 * @param password The password to validate
 * @param options Password validation options
 * @returns An object containing validation result and any error messages
 */
export function validatePassword(
  password: string,
  options: PasswordValidationOptions = defaultOptions
): { isValid: boolean; errors: string[] } {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = true,
  } = options;

  const errors: string[] = [];

  // Check minimum length
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  // Check for uppercase letters
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Check for lowercase letters
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Check for numbers
  if (requireNumbers && !/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Check for special characters
  if (requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates the strength of a password
 * @param password The password to evaluate
 * @returns The password strength level
 */
export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;

  // Length check
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety checks
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  // Determine strength based on score
  if (score < 3) return PasswordStrength.Weak;
  if (score < 5) return PasswordStrength.Medium;
  if (score < 7) return PasswordStrength.Strong;
  return PasswordStrength.VeryStrong;
}

/**
 * Generates a password strength message based on the password strength
 * @param strength The password strength level
 * @returns A user-friendly message describing the password strength
 */
export function getPasswordStrengthMessage(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.Weak:
      return "This password is too weak and easily guessable";
    case PasswordStrength.Medium:
      return "This password provides moderate security but could be stronger";
    case PasswordStrength.Strong:
      return "This is a strong password with good security";
    case PasswordStrength.VeryStrong:
      return "This is a very strong password with excellent security";
    default:
      return "Password strength could not be determined";
  }
}
