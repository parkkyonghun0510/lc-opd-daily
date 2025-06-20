/**
 * Account security utility functions
 * These functions help protect against brute force attacks and other security threats
 */

"use server";

import { getPrisma } from "@/lib/prisma-server";

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
  usernameValue: string,
): Promise<boolean> {
  const prisma = await getPrisma();

  // Find the user by username
  const user = await prisma.user.findUnique({
    where: { username: usernameValue },
    select: {
      id: true,
      username: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });

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
 * Resets failed login attempts for a user
 * @param userId The ID of the user
 */
export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

/**
 * Checks if an account is locked
 * @param username The username to check
 * @returns True if the account is locked, false otherwise
 */
export async function isAccountLocked(username: string): Promise<boolean> {
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      lockedUntil: true,
    },
  });

  if (!user) return false;

  return user.lockedUntil ? new Date(user.lockedUntil) > new Date() : false;
}

/**
 * Gets the remaining lockout time in minutes
 * @param username The username to check
 * @returns The remaining lockout time in minutes, or 0 if not locked
 */
export async function getRemainingLockoutTime(
  username: string,
): Promise<number> {
  const prisma = await getPrisma();
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      lockedUntil: true,
    },
  });

  if (!user?.lockedUntil) return 0;

  const now = new Date();
  const lockUntil = new Date(user.lockedUntil);
  const remainingMs = lockUntil.getTime() - now.getTime();

  return Math.max(0, Math.ceil(remainingMs / (60 * 1000)));
}
