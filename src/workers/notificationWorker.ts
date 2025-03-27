import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { NotificationType, generateNotificationContent } from '@/utils/notificationTemplates';
import { receiveFromNotificationQueue, deleteMessageFromQueue } from '@/lib/queue/sqs';

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('VAPID keys not set');
} else {
  webpush.setVapidDetails(
    'mailto:admin@example.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

// Maximum retries for sending notifications
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface NotificationQueueMessage {
  type: string;
  data: any;
  userIds: string[];
  timestamp: string;
}

/**
 * Create in-app notifications in the database
 */
async function createInAppNotifications(
  type: NotificationType, 
  data: Record<string, any>,
  userIds: string[]
) {
  // Generate title and body based on notification type
  let title = 'Notification';
  let body = 'You have a new notification';
  let actionUrl = null;

  switch (type) {
    case NotificationType.REPORT_SUBMITTED:
      title = 'New Report Submitted';
      body = `A new report has been submitted by ${data.submitterName || 'a user'} and requires review.`;
      actionUrl = data.reportId ? `/reports/${data.reportId}` : '/reports';
      break;
    case NotificationType.REPORT_APPROVED:
      title = 'Report Approved';
      body = `Your report has been approved by ${data.approverName || 'a manager'}.`;
      actionUrl = data.reportId ? `/reports/${data.reportId}` : '/reports';
      break;
    case NotificationType.REPORT_REJECTED:
      title = 'Report Rejected';
      body = `Your report has been rejected${data.reason ? ` for the following reason: ${data.reason}` : ''}.`;
      actionUrl = data.reportId ? `/reports/${data.reportId}` : '/reports';
      break;
    case NotificationType.REPORT_REMINDER:
      title = 'Report Reminder';
      body = `You have a report due for ${data.date || 'today'}.`;
      actionUrl = '/reports/create';
      break;
    case NotificationType.REPORT_OVERDUE:
      title = 'Report Overdue';
      body = `Your report for ${data.date || 'a recent date'} is now overdue.`;
      actionUrl = '/reports/create';
      break;
  }

  // Use custom title/body if provided
  if (data.title) title = data.title;
  if (data.body) body = data.body;
  if (data.actionUrl) actionUrl = data.actionUrl;

  // Create notifications for each user
  const notifications = userIds.map(userId => ({
    userId,
    title,
    body,
    type,
    actionUrl,
    isRead: false,
    data: data
  }));

  // Insert in-app notifications in bulk
  if (notifications.length > 0) {
    await prisma.inAppNotification.createMany({
      data: notifications
    });
  }

  return notifications.length;
}

/**
 * Processes a single notification message from the queue
 */
async function processNotificationMessage(message: any): Promise<boolean> {
  try {
    if (!message.Body) {
      console.error('Invalid message format, missing Body');
      return false;
    }

    const notification: NotificationQueueMessage = JSON.parse(message.Body);
    
    // Skip if no user IDs are provided
    if (!notification.userIds || notification.userIds.length === 0) {
      console.log('No users to notify, skipping');
      return true;
    }

    console.log(`Processing notification of type ${notification.type} for ${notification.userIds.length} users`);
    
    // Create in-app notifications first
    const inAppCount = await createInAppNotifications(
      notification.type as NotificationType,
      notification.data || {},
      notification.userIds
    );
    console.log(`Created ${inAppCount} in-app notifications`);
    
    // Get all push subscriptions for the target users
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        userId: {
          in: notification.userIds
        }
      },
      select: {
        id: true,
        endpoint: true,
        p256dh: true,
        auth: true,
        userId: true
      }
    });

    console.log(`Found ${subscriptions.length} push subscriptions for users:`, notification.userIds);

    // Generate notification content
    const notificationContent = generateNotificationContent(
      notification.type as NotificationType,
      notification.data
    );

    // Track successful and failed push notification sends
    let successCount = 0;
    let failCount = 0;

    // Send push notification to each subscription
    for (const subscription of subscriptions) {
      try {
        await sendNotificationWithRetry(
          subscription,
          notificationContent
        );
        successCount++;
        console.log(`Successfully sent notification to user ${subscription.userId}`);
      } catch (error) {
        failCount++;
        console.error(`Failed to send push notification to subscription ${subscription.id} for user ${subscription.userId}:`, error);
      }
    }

    console.log(`Processed notification: ${successCount} push successes, ${failCount} push failures, ${inAppCount} in-app notifications`);
    return true;
  } catch (error) {
    console.error('Error processing notification message:', error);
    return false;
  }
}

/**
 * Send a push notification with retry logic
 */
async function sendNotificationWithRetry(
  subscription: any, 
  notificationContent: any,
  retryCount = 0
): Promise<void> {
  try {
    // Prepare notification payload
    const payload = {
      title: notificationContent.title,
      body: notificationContent.body,
      icon: notificationContent.icon || '/icons/default.png',
      badge: '/icons/badge.png',
      data: {
        url: notificationContent.url,
        ...notificationContent.data
      },
      vibrate: [100, 50, 100],
      requireInteraction: true
    };

    // Send push notification
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    );
  } catch (error: any) {
    // If subscription is invalid or expired, remove it
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log(`Subscription expired or invalid, deleting: ${subscription.id}`);
      await prisma.pushSubscription.delete({
        where: { id: subscription.id },
      });
      return;
    }

    // Retry the notification if we haven't exceeded max retries
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying notification (${retryCount + 1}/${MAX_RETRIES}) for subscription ${subscription.id}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return sendNotificationWithRetry(subscription, notificationContent, retryCount + 1);
    }

    // If we've exhausted retries, rethrow the error
    throw error;
  }
}

/**
 * Main worker function that continuously polls the notification queue
 */
export async function startNotificationWorker() {
  console.log('Starting notification worker...');
  console.log('AWS Region:', process.env.AWS_REGION);
  console.log('Queue URL:', process.env.AWS_SQS_NOTIFICATION_QUEUE_URL);
  
  while (true) {
    try {
      // Receive messages from the notification queue
      const messages = await receiveFromNotificationQueue(10); // Max 10 messages at a time
      
      if (!messages || messages.length === 0) {
        // If no messages, wait a bit before polling again
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      console.log(`Received ${messages.length} notification messages`);
      
      // Process each message
      for (const message of messages) {
        if (!message.ReceiptHandle) {
          console.error('Message missing receipt handle, skipping');
          continue;
        }
        
        const success = await processNotificationMessage(message);
        
        // Delete the message from the queue if processing was successful
        if (success && message.ReceiptHandle) {
          await deleteMessageFromQueue(message.ReceiptHandle);
          console.log(`Deleted processed message: ${message.MessageId}`);
        }
      }
    } catch (error) {
      console.error('Error in notification worker loop:', error);
      // Wait a bit before retrying after an error
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

// If this file is executed directly, start the worker
if (require.main === module) {
  startNotificationWorker().catch(error => {
    console.error('Fatal error in notification worker:', error);
    process.exit(1);
  });
} 