import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { NotificationType, generateNotificationContent } from '@/utils/notificationTemplates';
import { 
  receiveFromNotificationQueue, 
  deleteMessageFromQueue, 
  deleteBatchFromQueue 
} from '@/lib/queue/sqs';

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

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const BATCH_SIZE = 10; // Process 10 messages at a time
const ERROR_THRESHOLD = 10; // Error threshold before pausing
const HEALTH_CHECK_INTERVAL = 300000; // 5 minutes

// Performance metrics
const metrics = {
  messageProcessed: 0,
  pushSuccesses: 0,
  pushFailures: 0,
  inAppCreated: 0,
  errors: 0,
  lastError: null as Error | null,
  startTime: Date.now(),
  isPaused: false,
  consecutiveErrors: 0
};

interface NotificationQueueMessage {
  type: string;
  data: any;
  userIds: string[];
  timestamp: string;
  priority?: 'high' | 'normal' | 'low';
  idempotencyKey?: string;
}

/**
 * Create in-app notifications in the database
 */
async function createInAppNotifications(
  type: NotificationType, 
  data: Record<string, any>,
  userIds: string[]
) {
  console.log(`[createInAppNotifications] Creating notifications for ${userIds.length} users of type ${type}`);
  console.log(`[createInAppNotifications] Notification data:`, JSON.stringify(data, null, 2));
  
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
    case NotificationType.REPORT_NEEDS_REVISION:
      title = 'Report Needs Revision';
      body = `Your report requires revision${data.reason ? `: ${data.reason}` : ''}.`;
      actionUrl = data.reportId ? `/reports/${data.reportId}/edit` : '/reports';
      break;
    case NotificationType.APPROVAL_PENDING:
      title = 'Reports Pending Approval';
      body = `There are ${data.count || 'several'} reports waiting for your approval.`;
      actionUrl = '/dashboard/reports/pending';
      break;
    case NotificationType.COMMENT_ADDED:
      title = 'New Comment';
      body = `${data.commenter || 'Someone'} commented on a report.`;
      actionUrl = data.reportId ? `/reports/${data.reportId}` : '/reports';
      break;
  }

  // Use custom title/body if provided
  if (data.title) title = data.title;
  if (data.body) body = data.body;
  if (data.actionUrl) actionUrl = data.actionUrl;

  try {
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

    console.log(`[createInAppNotifications] Prepared ${notifications.length} notification objects`);
    
    // Log first notification for debugging
    if (notifications.length > 0) {
      console.log(`[createInAppNotifications] First notification sample:`, JSON.stringify(notifications[0], null, 2));
    }

    // Insert in-app notifications in bulk
    if (notifications.length > 0) {
      console.log(`[createInAppNotifications] Attempting to insert ${notifications.length} notifications into database...`);
      try {
        const result = await prisma.inAppNotification.createMany({
          data: notifications
        });
        console.log(`[createInAppNotifications] Successfully created ${result.count} notifications in database`);
        metrics.inAppCreated += result.count;
        return result.count;
      } catch (dbError) {
        console.error(`[createInAppNotifications] Database error:`, dbError);
        throw dbError;
      }
    }
    return 0;
  } catch (error) {
    console.error(`[createInAppNotifications] Error creating in-app notifications:`, error);
    if (error instanceof Error) {
      console.error(`[createInAppNotifications] Error stack:`, error.stack);
    }
    metrics.errors++;
    metrics.lastError = error instanceof Error ? error : new Error(String(error));
    // Continue with push notifications even if in-app notifications fail
    return 0;
  }
}

/**
 * Processes a batch of notification messages from the queue
 */
async function processBatchNotifications(messages: any[]): Promise<{
  successful: string[],
  failed: string[]
}> {
  const successful: string[] = [];
  const failed: string[] = [];
  
  // Process messages in parallel with a concurrency limit
  const results = await Promise.allSettled(
    messages.map(message => processNotificationMessage(message))
  );
  
  // Collect results
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      successful.push(messages[index].ReceiptHandle);
    } else {
      failed.push(messages[index].ReceiptHandle);
      if (result.status === 'rejected') {
        console.error('Error processing message:', result.reason);
        metrics.errors++;
        metrics.lastError = result.reason instanceof Error 
          ? result.reason 
          : new Error(String(result.reason));
      }
    }
  });
  
  return { successful, failed };
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

    const priority = notification.priority || 'normal';
    console.log(`Processing ${priority} priority notification of type ${notification.type} for ${notification.userIds.length} users`);
    
    // Create in-app notifications first
    const inAppCount = await createInAppNotifications(
      notification.type as NotificationType,
      notification.data || {},
      notification.userIds
    );
    
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

    if (subscriptions.length > 0) {
      console.log(`Found ${subscriptions.length} push subscriptions for ${notification.userIds.length} users`);
    }

    // Generate notification content
    const notificationContent = generateNotificationContent(
      notification.type as NotificationType,
      notification.data
    );

    // Track successful and failed push notification sends
    let successCount = 0;
    let failCount = 0;

    // Send push notification to each subscription with concurrency limit
    const pushResults = await Promise.allSettled(
      subscriptions.map(subscription => 
        sendNotificationWithRetry(subscription, notificationContent)
      )
    );
    
    // Count successes and failures
    pushResults.forEach(result => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failCount++;
        console.error('Push notification failed:', result.reason);
      }
    });

    metrics.pushSuccesses += successCount;
    metrics.pushFailures += failCount;
    metrics.messageProcessed++;

    console.log(`Processed notification: ${successCount} push successes, ${failCount} push failures, ${inAppCount} in-app notifications`);
    return true;
  } catch (error) {
    console.error('Error processing notification message:', error);
    metrics.errors++;
    metrics.consecutiveErrors++;
    metrics.lastError = error instanceof Error ? error : new Error(String(error));
    
    // If we hit the error threshold, pause processing
    if (metrics.consecutiveErrors >= ERROR_THRESHOLD) {
      console.error(`Error threshold reached (${metrics.consecutiveErrors}/${ERROR_THRESHOLD}), pausing worker`);
      metrics.isPaused = true;
      
      // Auto-resume after 5 minutes
      setTimeout(() => {
        console.log('Auto-resuming worker after pause period');
        metrics.isPaused = false;
        metrics.consecutiveErrors = 0;
      }, 300000); // 5 minutes
    }
    
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
      tag: notificationContent.tag || `notification-${Date.now()}`, // Group similar notifications
      data: {
        url: notificationContent.url,
        timestamp: Date.now(),
        ...notificationContent.data
      },
      vibrate: [100, 50, 100],
      requireInteraction: notificationContent.requireInteraction !== false, // Show notification until user interacts with it
      actions: notificationContent.actions || []
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
      try {
        await prisma.pushSubscription.delete({
          where: { id: subscription.id },
        });
      } catch (deleteError) {
        console.error(`Failed to delete invalid subscription:`, deleteError);
      }
      return;
    }

    // Retry the notification if we haven't exceeded max retries
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying notification (${retryCount + 1}/${MAX_RETRIES}) for subscription ${subscription.id}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1))); // Exponential backoff
      return sendNotificationWithRetry(subscription, notificationContent, retryCount + 1);
    }

    // If we've exhausted retries, rethrow the error
    throw error;
  }
}

/**
 * Log performance metrics at regular intervals
 */
function startMetricsReporting() {
  setInterval(() => {
    const runTime = Math.floor((Date.now() - metrics.startTime) / 1000 / 60); // runtime in minutes
    console.log(`[METRICS] Worker running for ${runTime} minutes:`);
    console.log(`- Messages processed: ${metrics.messageProcessed}`);
    console.log(`- Push notifications: ${metrics.pushSuccesses} successful, ${metrics.pushFailures} failed`);
    console.log(`- In-app notifications created: ${metrics.inAppCreated}`);
    console.log(`- Errors: ${metrics.errors}`);
    console.log(`- Status: ${metrics.isPaused ? 'PAUSED' : 'RUNNING'}`);
    
    // Reset consecutive errors counter if things are working well
    if (metrics.consecutiveErrors > 0 && !metrics.isPaused) {
      metrics.consecutiveErrors = 0;
    }
  }, HEALTH_CHECK_INTERVAL);
}

/**
 * Main worker function that continuously polls the notification queue
 */
export async function startNotificationWorker() {
  console.log('======================================');
  console.log('Starting notification worker...');
  console.log('Worker version: 1.1.0 (debug)');
  console.log('AWS Region:', process.env.AWS_REGION);
  console.log('Queue URL:', process.env.AWS_SQS_NOTIFICATION_QUEUE_URL);
  console.log('======================================');
  
  // Start metrics reporting
  startMetricsReporting();
  
  while (true) {
    try {
      // Skip processing if worker is paused due to errors
      if (metrics.isPaused) {
        console.log('Worker is paused due to errors, waiting before retrying...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        continue;
      }
      
      console.log('[WORKER] Polling for messages from SQS queue...');
      
      // Receive messages from the notification queue
      const messages = await receiveFromNotificationQueue(BATCH_SIZE);
      
      if (!messages || messages.length === 0) {
        // If no messages, wait a bit before polling again
        console.log('[WORKER] No messages received, waiting before next poll');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      console.log(`[WORKER] Received ${messages.length} messages from queue`);
      
      // Log info about the first message
      if (messages.length > 0 && messages[0].Body) {
        try {
          const firstMessage = JSON.parse(messages[0].Body);
          console.log(`[WORKER] First message sample: type=${firstMessage.type}, userIds=${firstMessage.userIds?.length || 0}`);
        } catch (parseError) {
          console.error('[WORKER] Could not parse first message:', parseError);
        }
      }
      
      // Process the batch of messages
      const { successful, failed } = await processBatchNotifications(messages);
      
      console.log(`[WORKER] Processed batch: ${successful.length} successful, ${failed.length} failed`);
      
      // Delete successful messages in batch
      if (successful.length > 0) {
        console.log(`[WORKER] Deleting ${successful.length} processed messages`);
        await deleteBatchFromQueue(successful);
      }
      
      // Reset consecutive errors if we successfully processed some messages
      if (successful.length > 0) {
        metrics.consecutiveErrors = 0;
      }
      
    } catch (error) {
      console.error('[WORKER] Error in notification worker loop:', error);
      metrics.errors++;
      metrics.lastError = error instanceof Error ? error : new Error(String(error));
      metrics.consecutiveErrors++;
      
      // If too many consecutive errors, pause the worker temporarily
      if (metrics.consecutiveErrors >= ERROR_THRESHOLD) {
        console.error(`Error threshold reached (${metrics.consecutiveErrors}/${ERROR_THRESHOLD}), pausing worker for 5 minutes`);
        metrics.isPaused = true;
        
        // Auto-resume after 5 minutes
        setTimeout(() => {
          console.log('Auto-resuming worker after pause period');
          metrics.isPaused = false;
          metrics.consecutiveErrors = 0;
        }, 300000); // 5 minutes
        
        // Wait before next iteration
        await new Promise(resolve => setTimeout(resolve, 30000));
      } else {
        // Just wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
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