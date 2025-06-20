/**
 * Dashboard Events
 *
 * This module provides functions to emit dashboard-related events.
 */

import { eventEmitter } from "@/lib/realtime/eventEmitter";
import { sseHandler } from "@/lib/realtime/sseHandler";

// Dashboard event types
export enum DashboardEventTypes {
  REPORT_SUBMITTED = "reportSubmitted",
  REPORT_APPROVED = "reportApproved",
  REPORT_REJECTED = "reportRejected",
  STATS_UPDATED = "statsUpdated",
  METRICS_UPDATED = "metricsUpdated",
}

/**
 * Broadcast a dashboard update to all connected clients
 *
 * @param type - Type of dashboard update
 * @param data - Update data
 * @returns The event ID
 */
export function broadcastDashboardUpdate(
  type: DashboardEventTypes | string,
  data: any,
): string {
  // Create the event data
  const eventData = {
    type,
    data,
    timestamp: Date.now(),
  };

  // Emit the event via the event emitter (for polling)
  const eventId = eventEmitter.emit("dashboardUpdate", eventData);

  // Also send via SSE for immediate delivery
  sseHandler.broadcastEvent("dashboardUpdate", eventData);

  console.log(`[Dashboard] Broadcast ${type} update`);

  return eventId;
}

/**
 * Send a dashboard update to a specific user
 *
 * @param userId - User ID to send the update to
 * @param type - Type of dashboard update
 * @param data - Update data
 * @returns The event ID
 */
export function sendDashboardUpdate(
  userId: string,
  type: DashboardEventTypes | string,
  data: any,
): string {
  // Create the event data
  const eventData = {
    type,
    data,
    timestamp: Date.now(),
  };

  // Emit the event via the event emitter (for polling)
  const eventId = eventEmitter.emit("dashboardUpdate", eventData, {
    userIds: [userId],
  });

  // Also send via SSE for immediate delivery
  sseHandler.sendEventToUser(userId, "dashboardUpdate", eventData);

  console.log(`[Dashboard] Sent ${type} update to user ${userId}`);

  return eventId;
}

/**
 * Send a dashboard update to users with a specific role
 *
 * @param role - Role to send the update to
 * @param type - Type of dashboard update
 * @param data - Update data
 * @returns The event ID
 */
export function sendDashboardUpdateToRole(
  role: string,
  type: DashboardEventTypes | string,
  data: any,
): string {
  // Create the event data
  const eventData = {
    type,
    data,
    timestamp: Date.now(),
  };

  // Emit the event via the event emitter (for polling)
  const eventId = eventEmitter.emit("dashboardUpdate", eventData, {
    roles: [role],
  });

  // For SSE, we would need to know which users have this role
  // This would typically involve a database query
  // For now, we'll just broadcast to all users
  sseHandler.broadcastEvent("dashboardUpdate", eventData);

  console.log(`[Dashboard] Sent ${type} update to role ${role}`);

  return eventId;
}
