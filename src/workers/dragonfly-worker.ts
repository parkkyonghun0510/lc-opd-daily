import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';
import { getDragonflyQueueService } from '../lib/dragonfly-queue';

// Define interfaces for type safety
interface NotificationPayload {
  title?: string;
  body?: string;
  icon?: string;
  url?: string;
  submitterName?: string;
  approverName?: string;
}

interface Notification {
  type: string;
  userIds: string[];
  data: NotificationPayload;
}

interface Message {
  Body: string;
  ReceiptHandle: string;
}

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Initialize Prisma client with connection pooling for production
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn', 'info']
});

// Initialize Dragonfly Redis queue service
const dragonflyQueue = getDragonflyQueueService();

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const contactEmail = process.env.VAPID_CONTACT_EMAIL || 'admin@example.com';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('VAPID keys not set - push notifications will not work');
} else {
  webpush.setVapidDetails(
    `mailto:${contactEmail}`,
    vapidPublicKey,
    vapidPrivateKey
  );
}

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const POLLING_INTERVAL = process.env.NODE_ENV === 'production' ? 2000 : 5000; // More frequent polling in production
const VISIBILITY_TIMEOUT = 60; // 60 seconds to process a message
const MAX_MESSAGES_PER_BATCH = process.env.NODE_ENV === 'production' ? 10 : 5;

// Track worker state
let isShuttingDown = false;

/**
 * Receive messages from the Dragonfly Redis queue
 */
async function receiveMessages(maxMessages = MAX_MESSAGES_PER_BATCH) {
  try {
    const messages = await dragonflyQueue.receiveMessage({
      QueueUrl: process.env.DRAGONFLY_QUEUE_URL || 'redis://notifications',
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 20, // Long polling simulation
      VisibilityTimeout: VISIBILITY_TIMEOUT
    });

    return messages;
  } catch (error: any) {
    console.error('Error receiving messages from Dragonfly Redis:', error);
    return [];
  }
}

/**
 * Delete a message from the queue after processing
 */
async function deleteMessage(receiptHandle: string) {
  try {
    await dragonflyQueue.deleteMessage({
      QueueUrl: process.env.DRAGONFLY_QUEUE_URL || 'redis://notifications',
      ReceiptHandle: receiptHandle
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('Message deleted from Dragonfly Redis queue:', receiptHandle);
    }
  } catch (error: any) {
    console.error('Error deleting message from Dragonfly Redis:', error);
  }
}

/**
 * Processes a single notification message from the queue
 */
async function processNotificationMessage(message: Message) {
  try {
    if (!message.Body) {
      console.error('Invalid message format, missing Body');
      return false;
    }

    const notification: Notification = JSON.parse(message.Body);

    // Skip if no user IDs are provided
    if (!notification.userIds || notification.userIds.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('No users to notify, skipping');
      }
      return true;
    }

    if (process.env.NODE_ENV === 'production') {
      console.log(`Processing ${notification.type} for ${notification.userIds.length} users`);
    } else {
      console.log(`Processing notification of type ${notification.type} for ${notification.userIds.length} users`);
    }

    // Get all push subscriptions for the target users
    const subscriptions: PushSubscription[] = await prisma.pushSubscription.findMany({
      where: {
        userId: {
          in: notification.userIds
        }
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Found ${subscriptions.length} push subscriptions`);
    }

    // Generate notification content
    let notificationContent = {
      title: 'Notification',
      body: 'You have a new notification',
      icon: '/icons/default.png',
      url: '/'
    };

    if (notification.data && notification.type) {
      // Try to use the data provided for a more specific notification
      if (notification.data.title) notificationContent.title = notification.data.title;
      if (notification.data.body) notificationContent.body = notification.data.body;
      if (notification.data.icon) notificationContent.icon = notification.data.icon;
      if (notification.data.url) notificationContent.url = notification.data.url;

      // Add type-specific content if not provided
      switch (notification.type) {
        case 'REPORT_SUBMITTED':
          if (!notification.data.title) notificationContent.title = 'New Report Submitted';
          if (!notification.data.body) notificationContent.body = `A new report has been submitted by ${notification.data.submitterName || 'a user'} and requires review.`;
          break;
        case 'REPORT_APPROVED':
          if (!notification.data.title) notificationContent.title = 'Report Approved';
          if (!notification.data.body) notificationContent.body = `Your report has been approved by ${notification.data.approverName || 'a manager'}.`;
          break;
        case 'REPORT_REJECTED':
          if (!notification.data.title) notificationContent.title = 'Report Rejected';
          if (!notification.data.body) notificationContent.body = `Your report has been rejected by ${notification.data.approverName || 'a manager'}.`;
          break;
        // Add more types as needed
      }
    }

    // Track successful and failed push notification sends
    let successCount = 0;
    let failCount = 0;

    // Send push notification to each subscription
    for (const subscription of subscriptions) {
      // Skip further processing if shutting down
      if (isShuttingDown) break;

      try {
        await sendNotificationWithRetry(
          subscription,
          notificationContent
        );
        successCount++;
      } catch (error: any) {
        failCount++;
        console.error(`Failed to send push notification to subscription ${subscription.id}:`, error.message || error);
      }
    }

    if (process.env.NODE_ENV === 'production') {
      console.log(`Notification results: ${successCount} sent, ${failCount} failed`);
    } else {
      console.log(`Processed notification: ${successCount} successes, ${failCount} failures`);
    }

    return true;
  } catch (error: any) {
    console.error('Error processing notification message:', error);
    return false;
  }
}

/**
 * Send push notification with retry logic
 */
async function sendNotificationWithRetry(subscription: PushSubscription, notification: any, retries = MAX_RETRIES) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      },
      JSON.stringify(notification)
    );
    return true;
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription expired or not found, remove it
      console.log(`Removing expired subscription: ${subscription.id}`);
      try {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } });
      } catch (e: any) {
        console.error(`Failed to remove subscription from DB: ${e.message}`);
      }
    } else if (retries > 0) {
      // Retry for other errors
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Retrying notification, ${retries} retries left...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return sendNotificationWithRetry(subscription, notification, retries - 1);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Main worker loop
 */
async function startWorker() {
  console.log('Starting Dragonfly Redis notification worker...');

  try {
    await dragonflyQueue.connect();
    console.log('Connected to Dragonfly Redis queue service');
  } catch (error) {
    console.error('Failed to connect to Dragonfly Redis:', error);
    process.exit(1);
  }

  const processMessages = async () => {
    if (isShuttingDown) return;

    try {
      const messages = await receiveMessages();

      if (messages.length > 0) {
        console.log(`Received ${messages.length} messages from Dragonfly Redis`);

        for (const message of messages) {
          if (isShuttingDown) break;

          const processed = await processNotificationMessage(message);
          if (processed) {
            await deleteMessage(message.ReceiptHandle);
          }
        }
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log('No messages received, waiting...');
        }
      }
    } catch (error) {
      console.error('Error in worker loop:', error);
    }

    // Schedule next check
    if (!isShuttingDown) {
      setTimeout(processMessages, POLLING_INTERVAL);
    }
  };

  // Start processing
  processMessages();

  // Cleanup on shutdown
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  async function gracefulShutdown() {
    console.log('Received shutdown signal, finishing current work...');
    isShuttingDown = true;

    try {
      await dragonflyQueue.disconnect();
      await prisma.$disconnect();
      console.log('Worker shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch((error) => {
    console.error('Failed to start Dragonfly worker:', error);
    process.exit(1);
  });
}

export { startWorker as startDragonflyWorker };