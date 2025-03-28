import { prisma } from "@/lib/prisma";
import { NotificationType } from "./notificationTemplates";

/**
 * Create notifications directly in the database
 * This can be used as a fallback when SQS queue is unavailable
 */
export async function createDirectNotifications(
  type: NotificationType | string,
  title: string,
  body: string,
  userIds: string[],
  actionUrl?: string | null,
  data?: Record<string, any>
) {
  if (!userIds || userIds.length === 0) {
    console.log("No users to notify, skipping direct notification creation");
    return { count: 0 };
  }
  
  console.log(`Creating ${userIds.length} direct notifications of type ${type}`);
  
  try {
    // Create notification objects for each user
    const notifications = userIds.map(userId => ({
      userId,
      title,
      body,
      type,
      actionUrl: actionUrl || null,
      isRead: false,
      data: {
        ...(data || {}),
        method: "direct-create",
        timestamp: new Date().toISOString()
      }
    }));
    
    // Create all notifications in a single database operation
    const result = await prisma.inAppNotification.createMany({
      data: notifications
    });
    
    console.log(`Successfully created ${result.count} direct notifications`);
    
    // For complete tracking, we would also create notification events
    // This would require getting the IDs of the created notifications
    
    return result;
  } catch (error) {
    console.error("Error creating direct notifications:", error);
    throw error;
  }
}

/**
 * Create a single notification directly in the database
 */
export async function createDirectNotification(
  userId: string,
  type: NotificationType | string,
  title: string,
  body: string,
  actionUrl?: string | null,
  data?: Record<string, any>
) {
  try {
    console.log(`Creating direct notification for user ${userId}`);
    
    const notification = await prisma.inAppNotification.create({
      data: {
        userId,
        title,
        body,
        type,
        actionUrl: actionUrl || null,
        isRead: false,
        data: {
          ...(data || {}),
          method: "direct-create-single",
          timestamp: new Date().toISOString()
        }
      }
    });
    
    console.log(`Successfully created direct notification: ${notification.id}`);
    
    // Create a delivery event for tracking
    await prisma.notificationEvent.create({
      data: {
        notificationId: notification.id,
        event: "DELIVERED",
        metadata: {
          method: "direct-create",
          timestamp: new Date().toISOString()
        }
      }
    });
    
    return notification;
  } catch (error) {
    console.error(`Error creating direct notification for user ${userId}:`, error);
    throw error;
  }
} 