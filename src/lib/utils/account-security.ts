/**
 * Account security utility functions
 * These functions help protect against brute force attacks and other security threats
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Maximum number of failed login attempts before account lockout
const MAX_FAILED_ATTEMPTS = 5;

// Lockout duration in minutes
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Records a failed login attempt for a user
 * @param usernameValue The username of the user who failed to login
 * @returns True if the account is now locked, false otherwise
 */
export async function recordFailedLoginAttempt(
  usernameValue: string
): Promise<boolean> {
  // Find the user by username using manual filtering
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });

  const user = allUsers.find(
    (u) => u.username.toLowerCase() === usernameValue.toLowerCase()
  );

  // If user doesn't exist, do nothing (don't reveal if account exists)
  if (!user) return false;

  // Check if account is already locked
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    // Account is already locked, no need to update
    return true;
  }

  // Increment failed login attempts
  const updatedAttempts = (user.failedLoginAttempts || 0) + 1;

  // Determine if account should be locked
  const shouldLock = updatedAttempts >= MAX_FAILED_ATTEMPTS;

  // Calculate lock expiration time if needed
  const lockedUntil = shouldLock
    ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
    : null;

  // Update the user record
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: updatedAttempts,
      lockedUntil: lockedUntil,
    },
  });

  return shouldLock;
}

/**
 * Checks if a user account is currently locked
 * @param usernameValue The username of the user to check
 * @returns True if the account is locked, false otherwise
 */
export async function isAccountLocked(usernameValue: string): Promise<boolean> {
  // Find the user by username using manual filtering
  const allUsers = await prisma.user.findMany({
    select: { username: true, lockedUntil: true },
  });

  const user = allUsers.find(
    (u) => u.username.toLowerCase() === usernameValue.toLowerCase()
  );

  if (!user || !user.lockedUntil) return false;

  return new Date(user.lockedUntil) > new Date();
}

/**
 * Resets the failed login attempts counter for a user after successful login
 * @param userId The ID of the user who successfully logged in
 */
export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

/**
 * Gets the remaining lockout time in minutes
 * @param usernameValue The username of the locked user
 * @returns The number of minutes until the account is unlocked, or 0 if not locked
 */
export async function getRemainingLockoutTime(
  usernameValue: string
): Promise<number> {
  // Find the user by username using manual filtering
  const allUsers = await prisma.user.findMany({
    select: { username: true, lockedUntil: true },
  });

  const user = allUsers.find(
    (u) => u.username.toLowerCase() === usernameValue.toLowerCase()
  );

  if (!user || !user.lockedUntil) return 0;

  const now = new Date();
  const lockUntil = new Date(user.lockedUntil);

  if (lockUntil <= now) return 0;

  // Calculate remaining minutes
  const remainingMs = lockUntil.getTime() - now.getTime();
  return Math.ceil(remainingMs / (60 * 1000));
}
