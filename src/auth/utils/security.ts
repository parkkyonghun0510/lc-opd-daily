"use client";

import { jwtDecode } from "jwt-decode";
import { useStore } from "@/auth/store";

/**
 * Security enhancement module for authentication
 *
 * This module provides additional security features for authentication.
 */

// Define the security configuration
interface SecurityConfig {
  enabled: boolean;
  tokenValidation: boolean;
  fingerprintValidation: boolean;
  bruteForceProtection: boolean;
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
}

// Default configuration
const defaultConfig: SecurityConfig = {
  enabled: true,
  tokenValidation: true,
  fingerprintValidation: true,
  bruteForceProtection: true,
  maxLoginAttempts: 5,
  lockoutDuration: 15,
};

// Current configuration
let config: SecurityConfig = { ...defaultConfig };

/**
 * Configure the security module
 *
 * @param newConfig The new configuration
 */
export function configureSecurity(newConfig: Partial<SecurityConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get the current security configuration
 *
 * @returns The current security configuration
 */
export function getSecurityConfig(): SecurityConfig {
  return { ...config };
}

/**
 * Validate a JWT token
 *
 * @param token The JWT token to validate
 * @returns Whether the token is valid
 */
export function validateToken(token: string): boolean {
  if (!config.enabled || !config.tokenValidation) return true;

  try {
    // Decode the token
    const decoded = jwtDecode(token);

    // Check if the token has expired
    const expiryTime = decoded.exp ? decoded.exp * 1000 : 0;
    if (expiryTime < Date.now()) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error validating token:", error);
    return false;
  }
}

/**
 * Generate a browser fingerprint
 *
 * @returns A fingerprint string
 */
export function generateFingerprint(): string {
  if (typeof window === "undefined") return "";

  // Collect browser information
  const userAgent = navigator.userAgent;
  const language = navigator.language;
  const platform = navigator.platform;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const colorDepth = window.screen.colorDepth;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Combine information into a fingerprint
  const fingerprintData = [
    userAgent,
    language,
    platform,
    screenWidth,
    screenHeight,
    colorDepth,
    timezone,
  ].join("|");

  // Create a hash of the fingerprint
  return hashString(fingerprintData);
}

/**
 * Validate a browser fingerprint
 *
 * @param storedFingerprint The stored fingerprint
 * @returns Whether the fingerprint is valid
 */
export function validateFingerprint(storedFingerprint: string): boolean {
  if (!config.enabled || !config.fingerprintValidation) return true;

  // Generate the current fingerprint
  const currentFingerprint = generateFingerprint();

  // Compare the fingerprints
  return currentFingerprint === storedFingerprint;
}

/**
 * Track login attempts for brute force protection
 *
 * @param username The username to track
 * @param success Whether the login attempt was successful
 * @returns Whether the account is locked
 */
export function trackLoginAttempt(username: string, success: boolean): boolean {
  if (!config.enabled || !config.bruteForceProtection) return false;

  // Get the login attempts from localStorage
  const storageKey = "auth_login_attempts";
  const storedData = localStorage.getItem(storageKey);
  const loginAttempts = storedData ? JSON.parse(storedData) : {};

  // Get the attempts for this username
  const attempts = loginAttempts[username] || {
    count: 0,
    lastAttempt: 0,
    locked: false,
    lockedUntil: 0,
  };

  // Check if the account is locked
  if (attempts.locked) {
    // Check if the lockout period has expired
    if (attempts.lockedUntil < Date.now()) {
      // Unlock the account
      attempts.locked = false;
      attempts.count = 0;
    } else {
      // Account is still locked
      loginAttempts[username] = attempts;
      localStorage.setItem(storageKey, JSON.stringify(loginAttempts));
      return true;
    }
  }

  // If the login was successful, reset the attempts
  if (success) {
    attempts.count = 0;
    attempts.locked = false;
    loginAttempts[username] = attempts;
    localStorage.setItem(storageKey, JSON.stringify(loginAttempts));
    return false;
  }

  // Increment the attempts
  attempts.count += 1;
  attempts.lastAttempt = Date.now();

  // Check if the account should be locked
  if (attempts.count >= config.maxLoginAttempts) {
    attempts.locked = true;
    attempts.lockedUntil = Date.now() + config.lockoutDuration * 60 * 1000;
  }

  // Save the attempts
  loginAttempts[username] = attempts;
  localStorage.setItem(storageKey, JSON.stringify(loginAttempts));

  // Return whether the account is locked
  return attempts.locked;
}

/**
 * Check if an account is locked
 *
 * @param username The username to check
 * @returns Whether the account is locked
 */
export function isAccountLocked(username: string): boolean {
  if (!config.enabled || !config.bruteForceProtection) return false;

  // Get the login attempts from localStorage
  const storageKey = "auth_login_attempts";
  const storedData = localStorage.getItem(storageKey);
  const loginAttempts = storedData ? JSON.parse(storedData) : {};

  // Get the attempts for this username
  const attempts = loginAttempts[username] || {
    count: 0,
    lastAttempt: 0,
    locked: false,
    lockedUntil: 0,
  };

  // Check if the account is locked
  if (attempts.locked) {
    // Check if the lockout period has expired
    if (attempts.lockedUntil < Date.now()) {
      // Unlock the account
      attempts.locked = false;
      attempts.count = 0;
      loginAttempts[username] = attempts;
      localStorage.setItem(storageKey, JSON.stringify(loginAttempts));
      return false;
    }

    // Account is still locked
    return true;
  }

  return false;
}

/**
 * Get the time until an account is unlocked
 *
 * @param username The username to check
 * @returns The time until the account is unlocked in milliseconds
 */
export function getAccountUnlockTime(username: string): number {
  if (!config.enabled || !config.bruteForceProtection) return 0;

  // Get the login attempts from localStorage
  const storageKey = "auth_login_attempts";
  const storedData = localStorage.getItem(storageKey);
  const loginAttempts = storedData ? JSON.parse(storedData) : {};

  // Get the attempts for this username
  const attempts = loginAttempts[username] || {
    count: 0,
    lastAttempt: 0,
    locked: false,
    lockedUntil: 0,
  };

  // Check if the account is locked
  if (attempts.locked) {
    // Check if the lockout period has expired
    if (attempts.lockedUntil < Date.now()) {
      return 0;
    }

    // Return the time until the account is unlocked
    return attempts.lockedUntil - Date.now();
  }

  return 0;
}

/**
 * Unlock an account
 *
 * @param username The username to unlock
 */
export function unlockAccount(username: string): void {
  if (!config.enabled || !config.bruteForceProtection) return;

  // Get the login attempts from localStorage
  const storageKey = "auth_login_attempts";
  const storedData = localStorage.getItem(storageKey);
  const loginAttempts = storedData ? JSON.parse(storedData) : {};

  // Get the attempts for this username
  const attempts = loginAttempts[username] || {
    count: 0,
    lastAttempt: 0,
    locked: false,
    lockedUntil: 0,
  };

  // Unlock the account
  attempts.locked = false;
  attempts.count = 0;
  loginAttempts[username] = attempts;
  localStorage.setItem(storageKey, JSON.stringify(loginAttempts));
}

/**
 * Create a simple hash of a string
 *
 * @param str The string to hash
 * @returns The hashed string
 */
function hashString(str: string): string {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash.toString(16);
}

/**
 * Security hook for authentication
 *
 * @returns Security utilities
 */
export function useSecurity() {
  const store = useStore();

  return {
    validateToken,
    generateFingerprint,
    validateFingerprint,
    trackLoginAttempt,
    isAccountLocked,
    getAccountUnlockTime,
    unlockAccount,
    getSecurityConfig,
    configureSecurity,
  };
}
