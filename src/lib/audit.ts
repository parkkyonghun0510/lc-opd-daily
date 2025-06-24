/**
 * Utility functions for creating and working with audit logs
 */

import { prisma } from "./prisma";

/**
 * Common audit action types to ensure consistency in logging
 */
export const AuditAction = {
  // User-related actions
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED",
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  USER_PASSWORD_RESET: "USER_PASSWORD_RESET",
  USER_PASSWORD_CHANGED: "USER_PASSWORD_CHANGED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",

  // Branch-related actions
  BRANCH_CREATED: "BRANCH_CREATED",
  BRANCH_UPDATED: "BRANCH_UPDATED",
  BRANCH_DELETED: "BRANCH_DELETED",
  BRANCH_USER_ASSIGNED: "BRANCH_USER_ASSIGNED",
  BRANCH_USER_REMOVED: "BRANCH_USER_REMOVED",

  // Report-related actions
  REPORT_CREATED: "REPORT_CREATED",
  REPORT_UPDATED: "REPORT_UPDATED",
  REPORT_DELETED: "REPORT_DELETED",
  REPORT_SUBMITTED: "REPORT_SUBMITTED",
  REPORT_APPROVED: "REPORT_APPROVED",
  REPORT_REJECTED: "REPORT_REJECTED",
  REPORT_EXPORTED: "REPORT_EXPORTED",

  // Settings-related actions
  SETTINGS_UPDATED: "SETTINGS_UPDATED",

  // System-related actions
  SYSTEM_BACKUP: "SYSTEM_BACKUP",
  SYSTEM_RESTORE: "SYSTEM_RESTORE",
  SYSTEM_MAINTENANCE: "SYSTEM_MAINTENANCE",
  SYSTEM_ERROR: "SYSTEM_ERROR",
};

/**
 * Creates an audit log entry directly in the database (server-side use only)
 *
 * @param userId The ID of the user performing the action
 * @param action The action being performed (use AuditAction constants for consistency)
 * @param details Object containing relevant details about the action
 * @param requestInfo Object containing request information like IP address and user agent
 * @param type The type of audit log (activity or userActivity)
 * @returns Promise that resolves when the log is created
 */
export async function createServerAuditLog({
  userId,
  action,
  details,
  requestInfo = { ipAddress: "unknown", userAgent: "unknown" },
  type = "activity",
}: {
  userId: string;
  action: string;
  details: Record<string, unknown> | string;
  requestInfo?: { ipAddress?: string | null; userAgent?: string | null };
  type?: "activity" | "userActivity";
}): Promise<void> {
  try {
    // Create the main activity log
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        details:
          typeof details === "string" ? details : JSON.stringify(details),
        ipAddress: requestInfo.ipAddress || "unknown",
        userAgent: requestInfo.userAgent || "unknown",
      },
    });

    // Also create a UserActivity entry for the user dashboard
    // This is useful for showing users their recent activities
    if (type === "userActivity") {
      await prisma.userActivity.create({
        data: {
          userId,
          action,
          details,
          ipAddress: requestInfo.ipAddress || "unknown",
          userAgent: requestInfo.userAgent || "unknown",
        },
      });
    }

    //console.log(`Audit log created: ${action}`);
  } catch (error) {
    console.error("Error creating audit log:", error);
    // We don't want audit logging failures to block the main application flow
    // so we just log the error and continue
  }
}

/**
 * Create an audit log entry via API (client-side use)
 * @param action The action being performed
 * @param details Additional details about the action
 * @param type The type of audit log (activity or userActivity)
 * @returns A promise that resolves when the audit log is created
 */
export async function createAuditLog(
  action: string,
  details: string | Record<string, unknown>,
  type: "activity" | "userActivity" = "activity",
): Promise<boolean> {
  try {
    const response = await fetch("/api/audit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        details,
        type,
      }),
    });

    if (!response.ok) {
      console.error("Failed to create audit log:", await response.json());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error creating audit log:", error);
    return false;
  }
}
