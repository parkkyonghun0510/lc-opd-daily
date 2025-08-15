/**
 * Redis Notification Service
 *
 * This service replaces the SQS-based notification system with a Redis-based approach.
 * It handles creating in-app notifications and sending real-time notifications via Redis.
 */

import { prisma } from '@/lib/prisma';
import { NotificationType, generateNotificationContent } from '@/utils/notificationTemplates';
import { emitNotification } from '@/lib/realtime/redisEventEmitter';
import { redis } from '@/lib/redis';
import { trackNotificationEvent } from '@/utils/notificationTracking';
import { NotificationEventType } from '@/types/notifications';

// Constants
const NOTIFICATION_QUEUE_KEY = 'notifications:queue';
const NOTIFICATION_PROCESSING_KEY = 'notifications:processing';
const NOTIFICATION_HISTORY_KEY = 'notifications:history';
const MAX_HISTORY_SIZE = 1000;

// Notification interface
export interface NotificationMessage {
  id: string;
  type: string;
  data: any;
  userIds: string[];
  timestamp: string;
  priority?: 'high' | 'normal' | 'low';
  idempotencyKey?: string;
}

/**
 * Send a notification using Redis
 *
 * This function:
 * 1. Creates in-app notifications in the database
 * 2. Emits real-time notifications via Redis
 * 3. Stores the notification in Redis for tracking
 *
 * @param notification - The notification message
 * @returns The notification ID
 */
export async function sendNotification(notification: Omit<NotificationMessage, 'id' | 'timestamp'>): Promise<string> {
  try {
    // Generate a unique ID for the notification
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Create the full notification object
    const fullNotification: NotificationMessage = {
      id,
      type: notification.type,
      data: notification.data || {},
      userIds: notification.userIds || [],
      timestamp,
      priority: notification.priority || 'normal',
      idempotencyKey: notification.idempotencyKey
    };

    // Store notification in Redis
    await redis.lpush(NOTIFICATION_QUEUE_KEY, JSON.stringify(fullNotification));

    // Trim the queue to prevent unbounded growth
    await redis.ltrim(NOTIFICATION_QUEUE_KEY, 0, 999);

    // Process the notification immediately
    await processNotification(fullNotification);

    return id;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

/**
 * Process a notification
 *
 * @param notification - The notification to process
 * @returns Whether the notification was processed successfully
 */
export async function processNotification(notification: NotificationMessage): Promise<boolean> {
  try {
    // Mark notification as being processed
    await redis.set(
      `${NOTIFICATION_PROCESSING_KEY}:${notification.id}`,
      JSON.stringify(notification),
      'EX',
      300 // Expire after 5 minutes
    );

    // 1. Create in-app notifications
    const inAppCount = await createInAppNotifications(
      notification.type as NotificationType,
      notification.data || {},
      notification.userIds
    );

    // 2. Emit real-time notifications via Redis
    const notificationContent = generateNotificationContent(
      notification.type as NotificationType,
      notification.data
    );

    // Send to each user
    for (const userId of notification.userIds) {
      await emitNotification(
        notificationContent.title,
        notificationContent.body,
        {
          userIds: [userId],
          type: notification.type,
          icon: notificationContent.icon,
          id: notification.id
        }
      );
    }

    // 3. Store notification in history
    await redis.lpush(
      NOTIFICATION_HISTORY_KEY,
      JSON.stringify({
        ...notification,
        processedAt: new Date().toISOString(),
        inAppCount
      })
    );

    // Trim history to prevent unbounded growth
    await redis.ltrim(NOTIFICATION_HISTORY_KEY, 0, MAX_HISTORY_SIZE - 1);

    // 4. Remove from processing
    await redis.del(`${NOTIFICATION_PROCESSING_KEY}:${notification.id}`);

    return true;
  } catch (error) {
    console.error('Error processing notification:', error);

    // Store the error in Redis for debugging
    await redis.set(
      `notifications:errors:${notification.id}`,
      JSON.stringify({
        notification,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      'EX',
      86400 // Expire after 24 hours
    );

    return false;
  }
}

/**
 * Create in-app notifications in the database
 *
 * @param type - The notification type
 * @param data - The notification data
 * @param userIds - The user IDs to notify
 * @returns The number of notifications created
 */
async function createInAppNotifications(
  type: NotificationType,
  data: Record<string, any>,
  userIds: string[]
): Promise<number> {
  try {
    // Generate notification content
    const content = generateNotificationContent(type, data);

    // Create notifications for each user
    const notifications = userIds.map(userId => ({
      userId,
      title: content.title,
      body: content.body,
      type,
      actionUrl: content.url,
      isRead: false,
      data: {
        ...data,
        icon: content.icon
      }
    }));

    // Create all notifications in a single database operation
    const result = await prisma.inAppNotification.createMany({
      data: notifications
    });

    // Create notification events for tracking
    if (result.count > 0) {
      // Get the created notifications to get their IDs
      const createdNotifications = await prisma.inAppNotification.findMany({
        where: {
          userId: { in: userIds },
          type,
          createdAt: { gte: new Date(Date.now() - 5000) } // Created in the last 5 seconds
        },
        select: { id: true }
      });

      // Create events for each notification
      if (createdNotifications.length > 0) {
        await prisma.notificationEvent.createMany({
          data: createdNotifications.map(notification => ({
            notificationId: notification.id,
            event: NotificationEventType.DELIVERED,
            metadata: {
              method: 'redis-notification-service',
              timestamp: new Date().toISOString()
            }
          }))
        });
      }
    }

    return result.count;
  } catch (error) {
    console.error('Error creating in-app notifications:', error);
    throw error;
  }
}

/**
 * Get recent notifications from history
 *
 * @param limit - Maximum number of notifications to return
 * @returns Array of recent notifications
 */
export async function getRecentNotifications(limit: number = 100): Promise<any[]> {
  try {
    const notifications = await redis.lrange(NOTIFICATION_HISTORY_KEY, 0, limit - 1);
    return notifications.map(n => JSON.parse(n));
  } catch (error) {
    console.error('Error getting recent notifications:', error);
    return [];
  }
}

/**
 * Get notification metrics
 *
 * @returns Notification metrics
 */
export async function getNotificationMetrics(): Promise<any> {
  try {
    // Get queue length
    const queueLength = await redis.llen(NOTIFICATION_QUEUE_KEY);

    // Get processing count
    const processingKeys = await redis.keys(`${NOTIFICATION_PROCESSING_KEY}:*`);
    const processingCount = processingKeys.length;

    // Get history count
    const historyCount = await redis.llen(NOTIFICATION_HISTORY_KEY);

    // Get error count
    const errorKeys = await redis.keys('notifications:errors:*');
    const errorCount = errorKeys.length;

    return {
      queueLength,
      processingCount,
      historyCount,
      errorCount,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting notification metrics:', error);
    return {
      error: 'Failed to get metrics',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Mark a notification as read
 *
 * @param notificationId - The ID of the notification to mark as read
 * @param userId - The ID of the user who owns the notification
 * @returns Whether the operation was successful
 */
export async function markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    // Update the notification in the database
    const notification = await prisma.inAppNotification.updateMany({
      where: {
        id: notificationId,
        userId: userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    // Create a notification event for tracking
    if (notification.count > 0) {
      await prisma.notificationEvent.create({
        data: {
          notificationId: notificationId,
          event: NotificationEventType.CLICKED,
          metadata: {
            method: 'redis-notification-service',
            timestamp: new Date().toISOString()
          }
        }
      });
    }

    return notification.count > 0;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 *
 * @param userId - The ID of the user
 * @returns The number of notifications marked as read
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  try {
    // Get all unread notifications for the user
    const unreadNotifications = await prisma.inAppNotification.findMany({
      where: {
        userId: userId,
        isRead: false
      },
      select: {
        id: true
      }
    });

    // Update all notifications
    const result = await prisma.inAppNotification.updateMany({
      where: {
        userId: userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    // Create notification events for tracking
    if (unreadNotifications.length > 0) {
      await prisma.notificationEvent.createMany({
        data: unreadNotifications.map(notification => ({
          notificationId: notification.id,
          event: NotificationEventType.CLICKED,
          metadata: {
            method: 'redis-notification-service-bulk',
            timestamp: new Date().toISOString()
          }
        }))
      });
    }

    return result.count;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return 0;
  }
}
