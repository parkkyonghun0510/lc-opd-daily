// Standalone worker script that doesn't rely on complex imports
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';
import 'dotenv/config';

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize SQS client
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

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@example.com',
    vapidPublicKey,
    vapidPrivateKey
  );
  console.log('Web Push initialized with VAPID keys');
} else {
  console.warn('VAPID keys not set, push notifications will not work');
}

// Queue URL
const queueUrl = process.env.AWS_SQS_NOTIFICATION_QUEUE_URL || '';
if (!queueUrl) {
  console.error('AWS_SQS_NOTIFICATION_QUEUE_URL environment variable is not set');
  process.exit(1);
}

// Worker configuration
const BATCH_SIZE = 10;
const POLLING_INTERVAL = 5000; // 5 seconds

// Process a notification message
async function processNotificationMessage(message) {
  try {
    console.log('Processing message:', message.MessageId);
    const notification = JSON.parse(message.Body);
    
    // Skip if no userIds are provided
    if (!notification.userIds || notification.userIds.length === 0) {
      console.log('No users to notify, skipping');
      return true;
    }
    
    console.log(`Processing notification of type ${notification.type} for ${notification.userIds.length} users`);
    
    // Create in-app notifications for each user
    const notifications = notification.userIds.map(userId => ({
      userId,
      title: notification.data.title || 'Notification',
      body: notification.data.body || 'You have a new notification',
      type: notification.type,
      actionUrl: notification.data.url || notification.data.actionUrl || null,
      isRead: false,
      data: notification.data || {}
    }));
    
    if (notifications.length > 0) {
      try {
        const result = await prisma.inAppNotification.createMany({
          data: notifications
        });
        console.log(`Created ${result.count} in-app notifications`);
      } catch (dbError) {
        console.error('Database error creating notifications:', dbError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error processing message:', error);
    return false;
  }
}

// Worker main loop
async function startWorker() {
  console.log('======================================');
  console.log('Starting standalone notification worker...');
  console.log('Worker version: 1.0.0');
  console.log('AWS Region:', process.env.AWS_REGION);
  console.log('Queue URL:', queueUrl);
  console.log('======================================');
  
  while (true) {
    try {
      console.log('Polling for messages...');
      
      // Receive messages from SQS
      const command = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: BATCH_SIZE,
        WaitTimeSeconds: 20,
        AttributeNames: ['All'],
        MessageAttributeNames: ['All']
      });
      
      const response = await sqsClient.send(command);
      const messages = response.Messages || [];
      
      if (messages.length === 0) {
        console.log('No messages received, waiting before next poll');
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        continue;
      }
      
      console.log(`Received ${messages.length} messages`);
      
      // Process each message
      for (const message of messages) {
        const success = await processNotificationMessage(message);
        
        if (success) {
          // Delete message from queue
          const deleteCommand = new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle
          });
          
          await sqsClient.send(deleteCommand);
          console.log('Message deleted from queue');
        }
      }
    } catch (error) {
      console.error('Error in worker loop:', error);
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }
  }
}

// Start the worker
startWorker().catch(error => {
  console.error('Fatal worker error:', error);
  process.exit(1);
}); 