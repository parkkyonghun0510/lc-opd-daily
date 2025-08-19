/**
 * Dragonfly Notification Service
 *
 * This service provides the same API as the Redis notification service
 * but uses Dragonfly Redis queue for message processing, providing better
 * performance and reliability for high-throughput notification scenarios.
 */

import { prisma } from '@/lib/prisma';
import { NotificationType, generateNotificationContent } from '@/utils/notificationTemplates';
import { getUsersForNotification } from '@/utils/notificationTargeting';
import { emitNotification } from '@/lib/realtime/redisEventEmitter';
import { getDragonflyQueueService } from '@/lib/dragonfly-queue';
import { NotificationEventType } from '@/types/notifications';

// Constants
const NOTIFICATION_QUEUE_NAME = process.env.DRAGONFLY_QUEUE_NAME || 'notifications';
const NOTIFICATION_HISTORY_KEY = 'dragonfly:notifications:history';
const MAX_HISTORY_SIZE = 1000;

// Get Dragonfly queue service
const dragonflyQueue = getDragonflyQueueService();

// Notification interface - compatible with Redis service
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
 * Send a notification using Dragonfly queue
 *
 * This function:
 * 1. Computes target users using notification targeting utility
 * 2. Queues the notification in Dragonfly Redis for worker processing
 * 3. Immediately creates in-app notifications and emits real-time notifications
 *
 * @param notification - The notification message
 * @returns The notification ID
 */
export async function sendNotification(notification: Omit<NotificationMessage, 'id' | 'timestamp'>): Promise<string> {
  try {
    // Generate a unique ID for the notification
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Compute target users if not explicitly provided
    let targetUserIds = notification.userIds || [];
    if (targetUserIds.length === 0 && notification.type && notification.data) {
      targetUserIds = await getUsersForNotification(
        notification.type as NotificationType,
        notification.data
      );
    }

    // Create the full notification object
    const fullNotification: NotificationMessage = {
      id,
      type: notification.type,
      data: notification.data || {},
      userIds: targetUserIds,
      timestamp,
      priority: notification.priority || 'normal',
      idempotencyKey: notification.idempotencyKey
    };

    // Skip if no users to notify
    if (targetUserIds.length === 0) {
      console.warn(`No target users found for notification type: ${notification.type}`);
      return id;
    }

    // Queue the notification for background processing (push notifications)
    const delaySeconds = notification.priority === 'high' ? 0 : 1; // Process high priority immediately
    await dragonflyQueue.sendMessage({
      QueueUrl: `dragonfly://${NOTIFICATION_QUEUE_NAME}`,
      MessageBody: JSON.stringify(fullNotification),
      DelaySeconds: delaySeconds,
      MessageAttributes: {
        priority: notification.priority || 'normal',
        type: notification.type,
        userCount: targetUserIds.length.toString()
      }
    });

    // Process the notification immediately for in-app and real-time notifications
    await processNotificationImmediate(fullNotification);

    console.log(`Dragonfly notification queued: ${notification.type} for ${targetUserIds.length} users`);
    return id;
  } catch (error) {
    console.error('Error sending Dragonfly notification:', error);
    throw error;
  }
}

/**
 * Process a notification immediately (for in-app and real-time)
 * This runs synchronously while push notifications are processed by workers
 *
 * @param notification - The notification to process
 * @returns Whether the notification was processed successfully
 */
export async function processNotificationImmediate(notification: NotificationMessage): Promise<boolean> {
  try {
    // 1. Create in-app notifications in database
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

    // Send real-time notification to each user
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

    // 3. Store notification in history using Redis (for metrics)
    try {
      const { client } = dragonflyQueue as any; // Access the internal Redis client
      if (client) {
        await client.lPush(
          NOTIFICATION_HISTORY_KEY,
          JSON.stringify({
            ...notification,
            processedAt: new Date().toISOString(),
            inAppCount,
            method: 'dragonfly-service'
          })
        );

        // Trim history to prevent unbounded growth
        await client.lTrim(NOTIFICATION_HISTORY_KEY, 0, MAX_HISTORY_SIZE - 1);
      }
    } catch (historyError) {
      console.warn('Failed to store notification in history:', historyError);
      // Don't fail the notification for history storage issues
    }

    return true;
  } catch (error) {
    console.error('Error processing Dragonfly notification immediately:', error);
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

      // Track delivery events
      if (createdNotifications.length > 0) {
        await prisma.notificationEvent.createMany({
          data: createdNotifications.map(notification => ({
            notificationId: notification.id,
            event: NotificationEventType.DELIVERED,
            metadata: {
              method: 'dragonfly-notification-service',
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
    const { client } = dragonflyQueue as any; // Access the internal Redis client
    if (!client) {
      return [];
    }

    // Ensure connection handled by DragonflyQueueService; client is assumed connected
    const notificationsJson = await client.lRange(NOTIFICATION_HISTORY_KEY, 0, limit - 1);

    return notificationsJson
      .map((json: string) => {
        try {
          return JSON.parse(json);
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);
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
    // Get queue statistics
    const queueStats = await dragonflyQueue.getQueueStats();
    
    // Get history count
    let historyCount = 0;
    try {
      const { client } = dragonflyQueue as any; // Access the internal Redis client
      if (client) {
        // Ensure connection handled by DragonflyQueueService
        historyCount = await client.lLen(NOTIFICATION_HISTORY_KEY);
      }
    } catch (historyError) {
      console.warn('Failed to get history count:', historyError);
    }

    return {
      queueLength: queueStats.queueLength,
      processingLength: queueStats.processingLength,
      delayedLength: queueStats.delayedLength,
      historyCount,
      timestamp: new Date().toISOString(),
      backend: 'dragonfly'
    };
  } catch (error) {
    console.error('Error getting Dragonfly notification metrics:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      backend: 'dragonfly'
    };
  }
}

/**
 * Mark a notification as read
 *
 * @param notificationId - The notification ID
 * @param userId - The user ID
 * @returns Whether the operation was successful
 */
export async function markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    const result = await prisma.inAppNotification.updateMany({
      where: {
        id: notificationId,
        userId: userId
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    if (result.count > 0) {
      // Track read event - align with existing implementation using CLICKED
      await prisma.notificationEvent.create({
        data: {
          notificationId,
          event: NotificationEventType.CLICKED,
          metadata: {
            userId,
            method: 'dragonfly-notification-service',
            timestamp: new Date().toISOString()
          }
        }
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 *
 * @param userId - The user ID
 * @returns The number of notifications marked as read
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  try {
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

    if (result.count > 0) {
      // Get the updated notification IDs for tracking
      const updatedNotifications = await prisma.inAppNotification.findMany({
        where: {
          userId: userId,
          isRead: true,
          readAt: { gte: new Date(Date.now() - 5000) } // Updated in the last 5 seconds
        },
        select: { id: true }
      });

      // Track read events - use CLICKED to match existing service
      if (updatedNotifications.length > 0) {
        await prisma.notificationEvent.createMany({
          data: updatedNotifications.map(notification => ({
            notificationId: notification.id,
            event: NotificationEventType.CLICKED,
            metadata: {
              userId,
              method: 'dragonfly-notification-service-bulk',
              timestamp: new Date().toISOString()
            }
          }))
        });
      }
    }

    return result.count;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return 0;
  }
}