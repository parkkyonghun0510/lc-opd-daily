/**
 * Enhanced Redis Notification Service
 *
 * This service extends the Redis notification service with load balancing,
 * rate limiting, and improved error handling.
 */

import {
  executeRedisOperation,
  getRedisLoadBalancer,
} from "./redisLoadBalancer";
import { prisma } from "@/lib/prisma";
import {
  NotificationType,
  generateNotificationContent,
} from "@/utils/notificationTemplates";
import { emitNotification } from "@/lib/realtime/redisEventEmitter";
import { NotificationEventType } from "@/types/notifications";
import { rateLimiter } from "@/lib/rate-limit";

// Constants
const NOTIFICATION_QUEUE_KEY = "notifications:queue";
const NOTIFICATION_PROCESSING_KEY = "notifications:processing";
const NOTIFICATION_HISTORY_KEY = "notifications:history";
const MAX_HISTORY_SIZE = 1000;

// Notification interface
export interface NotificationMessage {
  id: string;
  type: string;
  data: any;
  userIds: string[];
  timestamp: string;
  priority?: "high" | "normal" | "low";
  idempotencyKey?: string;
}

// Rate limit configuration
const RATE_LIMITS = {
  // Maximum notifications per user per minute
  USER_NOTIFICATIONS: { max: 10, window: 60 },
  // Maximum notifications per type per minute
  TYPE_NOTIFICATIONS: { max: 30, window: 60 },
};

/**
 * Check if a notification is rate limited
 *
 * @param notification - The notification to check
 * @returns Whether the notification is rate limited
 */
async function isRateLimited(
  notification: Omit<NotificationMessage, "id" | "timestamp">,
): Promise<boolean> {
  try {
    // Skip rate limiting for high priority notifications
    if (notification.priority === "high") {
      return false;
    }

    // Check rate limits for each user
    for (const userId of notification.userIds) {
      const userKey = `rate-limit:notification:user:${userId}`;

      // Get current count from Redis
      const result = await executeRedisOperation(async (redis) => {
        const count = (await redis.get(userKey)) as number | null;

        if (count === null) {
          // Set initial count with expiry
          await redis.set(userKey, 1, {
            ex: RATE_LIMITS.USER_NOTIFICATIONS.window,
          });
          return false;
        }

        if (count >= RATE_LIMITS.USER_NOTIFICATIONS.max) {
          return true; // Rate limited
        }

        // Increment count
        await redis.incr(userKey);
        return false;
      });

      if (!result.success || result.data === true) {
        return true; // Rate limited or error
      }
    }

    // Check rate limit for notification type
    const typeKey = `rate-limit:notification:type:${notification.type}`;
    const result = await executeRedisOperation(async (redis) => {
      const count = (await redis.get(typeKey)) as number | null;

      if (count === null) {
        // Set initial count with expiry
        await redis.set(typeKey, 1, {
          ex: RATE_LIMITS.TYPE_NOTIFICATIONS.window,
        });
        return false;
      }

      if (count >= RATE_LIMITS.TYPE_NOTIFICATIONS.max) {
        return true; // Rate limited
      }

      // Increment count
      await redis.incr(typeKey);
      return false;
    });

    return !result.success || result.data === true;
  } catch (error) {
    console.error("Error checking rate limit:", error);
    return false; // On error, allow the notification
  }
}

/**
 * Send a notification using Redis with load balancing
 *
 * This function:
 * 1. Creates in-app notifications in the database
 * 2. Emits real-time notifications via Redis
 * 3. Stores the notification in Redis for tracking
 *
 * @param notification - The notification message
 * @returns The notification ID
 */
export async function sendNotification(
  notification: Omit<NotificationMessage, "id" | "timestamp">,
): Promise<string> {
  try {
    // Check for rate limiting
    const isLimited = await isRateLimited(notification);
    if (isLimited) {
      console.warn(
        `Rate limit exceeded for notification type: ${notification.type}`,
      );

      // For rate-limited notifications, we'll still process high-priority ones
      if (notification.priority !== "high") {
        throw new Error("Rate limit exceeded for notifications");
      }
    }

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
      priority: notification.priority || "normal",
      idempotencyKey: notification.idempotencyKey,
    };

    // Store notification in Redis using load balancer
    const queueResult = await executeRedisOperation(async (redis) => {
      await redis.lpush(
        NOTIFICATION_QUEUE_KEY,
        JSON.stringify(fullNotification),
      );
      // Trim the queue to prevent unbounded growth
      await redis.ltrim(NOTIFICATION_QUEUE_KEY, 0, 999);
      return true;
    });

    if (!queueResult.success) {
      throw queueResult.error || new Error("Failed to queue notification");
    }

    // Process the notification immediately
    await processNotification(fullNotification);

    return id;
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error;
  }
}

/**
 * Process a notification
 *
 * @param notification - The notification to process
 * @returns Whether the notification was processed successfully
 */
export async function processNotification(
  notification: NotificationMessage,
): Promise<boolean> {
  try {
    // Mark notification as being processed
    await executeRedisOperation(async (redis) => {
      await redis.set(
        `${NOTIFICATION_PROCESSING_KEY}:${notification.id}`,
        JSON.stringify(notification),
        { ex: 300 }, // Expire after 5 minutes
      );
      return true;
    });

    // 1. Create in-app notifications
    const inAppCount = await createInAppNotifications(
      notification.type as NotificationType,
      notification.data || {},
      notification.userIds,
    );

    // 2. Emit real-time notifications via Redis
    const notificationContent = generateNotificationContent(
      notification.type as NotificationType,
      notification.data,
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
          id: notification.id,
        },
      );
    }

    // 3. Store notification in history
    await executeRedisOperation(async (redis) => {
      await redis.lpush(
        NOTIFICATION_HISTORY_KEY,
        JSON.stringify({
          ...notification,
          processedAt: new Date().toISOString(),
          inAppCount,
        }),
      );

      // Trim history to prevent unbounded growth
      await redis.ltrim(NOTIFICATION_HISTORY_KEY, 0, MAX_HISTORY_SIZE - 1);
      return true;
    });

    // 4. Remove from processing
    await executeRedisOperation(async (redis) => {
      await redis.del(`${NOTIFICATION_PROCESSING_KEY}:${notification.id}`);
      return true;
    });

    return true;
  } catch (error) {
    console.error("Error processing notification:", error);

    // Store the error in Redis for debugging
    await executeRedisOperation(async (redis) => {
      await redis.set(
        `notifications:errors:${notification.id}`,
        JSON.stringify({
          notification,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }),
        { ex: 86400 }, // Expire after 24 hours
      );
      return true;
    });

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
  userIds: string[],
): Promise<number> {
  try {
    // Generate notification content
    const content = generateNotificationContent(type, data);

    // Create notifications for each user
    const notifications = userIds.map((userId) => ({
      userId,
      title: data.title || content.title,
      body: data.body || content.body,
      type,
      actionUrl: data.actionUrl || content.url,
      isRead: false,
      data,
    }));

    // Skip if no notifications to create
    if (notifications.length === 0) {
      return 0;
    }

    // Insert in-app notifications in bulk
    const result = await prisma.inAppNotification.createMany({
      data: notifications,
    });

    // Create notification events for tracking
    if (result.count > 0) {
      // Get the created notifications to get their IDs
      const createdNotifications = await prisma.inAppNotification.findMany({
        where: {
          userId: { in: userIds },
          type,
          createdAt: { gte: new Date(Date.now() - 5000) }, // Created in the last 5 seconds
        },
        select: { id: true },
      });

      // Create events for each notification
      if (createdNotifications.length > 0) {
        await prisma.notificationEvent.createMany({
          data: createdNotifications.map((notification) => ({
            notificationId: notification.id,
            event: NotificationEventType.DELIVERED,
            metadata: {
              method: "redis-notification-service",
              timestamp: new Date().toISOString(),
            },
          })),
        });
      }
    }

    return result.count;
  } catch (error) {
    console.error("Error creating in-app notifications:", error);
    return 0;
  }
}

/**
 * Get notification metrics
 *
 * @returns Notification metrics
 */
export async function getNotificationMetrics(): Promise<any> {
  try {
    // Get Redis metrics using load balancer
    const result = await executeRedisOperation(async (redis) => {
      // Get queue length
      const queueLength = await redis.llen(NOTIFICATION_QUEUE_KEY);

      // Get processing count
      const processingKeys = await redis.keys(
        `${NOTIFICATION_PROCESSING_KEY}:*`,
      );
      const processingCount = processingKeys.length;

      // Get history count
      const historyCount = await redis.llen(NOTIFICATION_HISTORY_KEY);

      // Get error count
      const errorKeys = await redis.keys("notifications:errors:*");
      const errorCount = errorKeys.length;

      return {
        queueLength,
        processingCount,
        historyCount,
        errorCount,
        timestamp: new Date().toISOString(),
      };
    });

    if (!result.success) {
      throw result.error || new Error("Failed to get notification metrics");
    }

    // Get load balancer stats
    const loadBalancerStats = getRedisLoadBalancer().getStats();

    return {
      ...result.data,
      loadBalancer: loadBalancerStats,
    };
  } catch (error) {
    console.error("Error getting notification metrics:", error);
    return {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}
