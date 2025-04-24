/**
 * SSE Event Emitter
 * 
 * This module provides functions to emit events to SSE clients.
 * It's a convenient wrapper around the SSE handler for use in business logic.
 */

import sseHandler from './sseHandler';
import redisSSEHandler from './redisSSEHandler';

// Use Redis-backed SSE handler if available
const handler = redisSSEHandler || sseHandler;

/**
 * Emit a notification event to a specific user
 * 
 * @param userId - The user ID to send the notification to
 * @param notification - The notification data
 */
export async function emitNotificationEvent(
  userId: string,
  notification: any
): Promise<number> {
  return handler.sendEventToUser(
    userId,
    'notification',
    {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message || notification.body,
      createdAt: notification.createdAt || new Date().toISOString(),
      timestamp: Date.now()
    }
  );
}

/**
 * Emit a dashboard update event to a specific user
 * 
 * @param userId - The user ID to send the update to
 * @param data - The update data
 */
export async function emitDashboardUpdateEvent(
  userId: string,
  data: any
): Promise<number> {
  return handler.sendEventToUser(
    userId,
    'dashboardUpdate',
    {
      ...data,
      timestamp: Date.now()
    }
  );
}

/**
 * Emit a system event to a specific user
 * 
 * @param userId - The user ID to send the event to
 * @param eventType - The type of event
 * @param data - The event data
 */
export async function emitSystemEvent(
  userId: string,
  eventType: string,
  data: any
): Promise<number> {
  return handler.sendEventToUser(
    userId,
    eventType,
    {
      ...data,
      timestamp: Date.now()
    }
  );
}

/**
 * Broadcast a system alert to all connected clients
 * 
 * @param alertType - The type of alert (info, warning, error)
 * @param message - The alert message
 * @param data - Additional data
 */
export async function broadcastSystemAlert(
  alertType: 'info' | 'warning' | 'error',
  message: string,
  data: any = {}
): Promise<number> {
  return handler.broadcastEvent(
    'systemAlert',
    {
      type: alertType,
      message,
      ...data,
      timestamp: Date.now(),
      id: `alert-${Date.now()}`
    }
  );
}

/**
 * Broadcast a dashboard update to all connected clients
 * 
 * @param updateType - The type of update
 * @param data - The update data
 */
export async function broadcastDashboardUpdate(
  updateType: string,
  data: any
): Promise<number> {
  return handler.broadcastEvent(
    'dashboardUpdate',
    {
      type: updateType,
      ...data,
      timestamp: Date.now()
    }
  );
}

/**
 * Broadcast a general event to all connected clients
 * 
 * @param eventType - The type of event
 * @param data - The event data
 */
export async function broadcastEvent(
  eventType: string,
  data: any
): Promise<number> {
  return handler.broadcastEvent(
    eventType,
    {
      ...data,
      timestamp: Date.now()
    }
  );
}
