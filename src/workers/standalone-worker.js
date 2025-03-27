import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs';

// Initialize Prisma client with connection pooling for production
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query', 'error', 'warn', 'info']
});

// Initialize SQS client with AWS SDK v3
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

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

// The queue URL - mandatory for production
const queueUrl = process.env.AWS_SQS_NOTIFICATION_QUEUE_URL;
if (!queueUrl) {
  console.error('AWS_SQS_NOTIFICATION_QUEUE_URL environment variable is not set');
  process.exit(1);
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
 * Receive messages from the notification queue
 */
async function receiveMessages(maxMessages = MAX_MESSAGES_PER_BATCH) {
  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 20, // Long polling
      AttributeNames: ['All'],
      MessageAttributeNames: ['All'],
      VisibilityTimeout: VISIBILITY_TIMEOUT
    });

    const response = await sqsClient.send(command);
    return response.Messages || [];
  } catch (error) {
    console.error('Error receiving messages from SQS:', error);
    return [];
  }
}

/**
 * Delete a message from the queue after processing
 */
async function deleteMessage(receiptHandle) {
  try {
    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle
    });

    await sqsClient.send(command);
    if (process.env.NODE_ENV !== 'production') {
      console.log('Message deleted from queue:', receiptHandle);
    }
  } catch (error) {
    console.error('Error deleting message from SQS:', error);
  }
}

/**
 * Processes a single notification message from the queue
 */
async function processNotificationMessage(message) {
  try {
    if (!message.Body) {
      console.error('Invalid message format, missing Body');
      return false;
    }

    const notification = JSON.parse(message.Body);
    
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
    const subscriptions = await prisma.pushSubscription.findMany({
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
      } catch (error) {
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
  } catch (error) {
    console.error('Error processing notification message:', error);
    return false;
  }
}

/**
 * Send a push notification with retry logic
 */
async function sendNotificationWithRetry(
  subscription, 
  notificationContent,
  retryCount = 0
) {
  try {
    // Prepare notification payload
    const payload = {
      title: notificationContent.title,
      body: notificationContent.body,
      icon: notificationContent.icon || '/icons/default.png',
      badge: '/icons/badge.png',
      data: {
        url: notificationContent.url,
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
  } catch (error) {
    // If subscription is invalid or expired, remove it
    if (error.statusCode === 410 || error.statusCode === 404) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Subscription expired or invalid, deleting: ${subscription.id}`);
      }
      await prisma.pushSubscription.delete({
        where: { id: subscription.id },
      });
      return;
    }

    // Retry the notification if we haven't exceeded max retries
    if (retryCount < MAX_RETRIES) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Retrying notification (${retryCount + 1}/${MAX_RETRIES})`);
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1))); // Exponential backoff
      return sendNotificationWithRetry(subscription, notificationContent, retryCount + 1);
    }

    // If we've exhausted retries, rethrow the error
    throw error;
  }
}

/**
 * Gracefully shutdown the worker
 */
async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('Shutting down notification worker...');
  try {
    await prisma.$disconnect();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error disconnecting from database:', error);
  }
  
  console.log('Worker shutdown complete');
  process.exit(0);
}

/**
 * Main worker function that continuously polls the notification queue
 */
export async function startNotificationWorker() {
  console.log(`Starting notification worker in ${process.env.NODE_ENV || 'development'} mode`);
  
  // Set up signal handlers for graceful shutdown
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  while (!isShuttingDown) {
    try {
      // Receive messages from the notification queue
      const messages = await receiveMessages();
      
      if (!messages || messages.length === 0) {
        // If no messages, wait a bit before polling again
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        continue;
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Received ${messages.length} notification messages`);
      }
      
      // Process each message
      for (const message of messages) {
        // Skip further processing if shutting down
        if (isShuttingDown) break;
        
        if (!message.ReceiptHandle) {
          console.error('Message missing receipt handle, skipping');
          continue;
        }
        
        const success = await processNotificationMessage(message);
        
        // Delete the message from the queue if processing was successful
        if (success && message.ReceiptHandle) {
          await deleteMessage(message.ReceiptHandle);
          if (process.env.NODE_ENV !== 'production') {
            console.log(`Deleted processed message: ${message.MessageId}`);
          }
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
if (process.argv[1].includes('standalone-worker')) {
  startNotificationWorker().catch(error => {
    console.error('Fatal error in notification worker:', error);
    process.exit(1);
  });
} 