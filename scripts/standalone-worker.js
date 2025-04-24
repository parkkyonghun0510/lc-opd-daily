// Standalone worker script that doesn't rely on complex imports
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Determine script directory and project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables explicitly from .env.local first, then .env
const envLocalPath = path.join(projectRoot, '.env.local');
const envPath = path.join(projectRoot, '.env');

if (fs.existsSync(envLocalPath)) {
  //console.log(`Loading environment from ${envLocalPath}`);
  config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  //console.log(`Loading environment from ${envPath}`);
  config({ path: envPath });
} else {
  console.warn('No .env.local or .env file found!');
}

// Debug environment variable loading
//console.log('Environment check:');
//console.log('- TELEGRAM_BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);
//console.log('- TELEGRAM_BOT_USERNAME exists:', !!process.env.TELEGRAM_BOT_USERNAME);
//console.log('- AWS_REGION exists:', !!process.env.AWS_REGION);
//console.log('- AWS_SQS_NOTIFICATION_QUEUE_URL exists:', !!process.env.AWS_SQS_NOTIFICATION_QUEUE_URL);
//console.log('- Working directory:', process.cwd());
//console.log('- Project root:', projectRoot);

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
  //console.log('Web Push initialized with VAPID keys');
} else {
  console.warn('VAPID keys not set, push notifications will not work');
}

// Initialize Telegram Bot
let telegramBot = null;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
if (!telegramToken) {
  console.error('TELEGRAM_BOT_TOKEN not set. Telegram notifications disabled.');
  console.error('Please make sure TELEGRAM_BOT_TOKEN is set in your .env.local file.');
  console.error('Available environment variables with TELEGRAM:', 
    Object.keys(process.env).filter(key => key.includes('TELEGRAM')));
} else {
  try {
    //console.log(`Initializing Telegram bot with token: ${telegramToken.substring(0, 5)}...`);
    telegramBot = new TelegramBot(telegramToken);
    //console.log('Telegram Bot initialized successfully.');
    
    // Print the bot info if available
    telegramBot.getMe().then(botInfo => {
      //console.log(`Connected to Telegram bot: @${botInfo.username} (${botInfo.first_name})`);
    }).catch(err => {
      console.error('Failed to get bot info:', err);
    });
  } catch (error) {
    console.error('Error initializing Telegram bot:', error);
  }
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
    //console.log('Processing message:', message.MessageId);
    const notification = JSON.parse(message.Body);
    
    // Skip if no userIds are provided
    if (!notification.userIds || notification.userIds.length === 0) {
      //console.log('No users to notify, skipping');
      return true;
    }
    
    //console.log(`Processing notification of type ${notification.type} for ${notification.userIds.length} users`);
    //console.log(`Notification data: ${JSON.stringify(notification.data)}`);
    
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
        //console.log(`Created ${result.count} in-app notifications`);
      } catch (dbError) {
        console.error('Database error creating notifications:', dbError);
      }
    }
    
    // Send Telegram notifications if available
    if (telegramBot && notification.type) {
      try {
        //console.log('Checking for Telegram subscriptions...');
        
        // Get Telegram subscriptions for these users
        const telegramSubs = await prisma.telegramSubscription.findMany({
          where: { userId: { in: notification.userIds } },
          select: { chatId: true, userId: true, username: true }
        });
        
        //console.log(`Found ${telegramSubs.length} Telegram subscriptions of ${notification.userIds.length} possible users`);
        
        if (telegramSubs.length > 0) {
          //console.log(`Found ${telegramSubs.length} Telegram subscriptions to notify: ${JSON.stringify(telegramSubs)}`);
          
          // Simple message formatting
          const message = `*${notification.data.title || 'Notification'}*\n\n${notification.data.body || 'You have a new notification'}`;
          
          // Send to each subscription
          for (const sub of telegramSubs) {
            try {
              //console.log(`Sending Telegram message to chat ${sub.chatId} (${sub.username || 'unknown username'})`);
              await telegramBot.sendMessage(sub.chatId, message, { parse_mode: 'Markdown' });
              //console.log(`Successfully sent Telegram message to chat ${sub.chatId}`);
            } catch (telegramError) {
              console.error(`Error sending Telegram message to chat ${sub.chatId}:`, telegramError);
            }
          }
        } else {
          //console.log('No Telegram subscriptions found for the target users');
          if (notification.userIds.length === 1) {
            //console.log(`User ${notification.userIds[0]} has no Telegram subscription`);
          }
        }
      } catch (telegramError) {
        console.error('Error sending Telegram notifications:', telegramError);
      }
    } else {
      if (!telegramBot) {
        //console.log('Telegram bot not initialized, skipping Telegram notifications');
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
  //console.log('======================================');
  //console.log('Starting standalone notification worker...');
  //console.log('Worker version: 1.0.0');
  //console.log('AWS Region:', process.env.AWS_REGION);
  //console.log('Queue URL:', queueUrl);
  //console.log('Telegram bot enabled:', !!telegramBot);
  //console.log('======================================');
  
  while (true) {
    try {
      //console.log('Polling for messages...');
      
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
        //console.log('No messages received, waiting before next poll');
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        continue;
      }
      
      //console.log(`Received ${messages.length} messages`);
      
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
          //console.log('Message deleted from queue');
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