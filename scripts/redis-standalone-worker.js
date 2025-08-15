// Standalone Redis-based worker script
import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { notificationQueue } from '../src/lib/queue/redis-queue.js';

// Determine script directory and project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables explicitly from .env.local first, then .env
const envLocalPath = path.join(projectRoot, '.env.local');
const envPath = path.join(projectRoot, '.env');

if (fs.existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.warn('No .env.local or .env file found!');
}

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@example.com',
    vapidPublicKey,
    vapidPrivateKey
  );
} else {
  console.warn('VAPID keys not set, push notifications will not work');
}

// Initialize Telegram Bot
let telegramBot = null;
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
if (!telegramToken) {
  console.error('TELEGRAM_BOT_TOKEN not set. Telegram notifications disabled.');
} else {
  try {
    telegramBot = new TelegramBot(telegramToken);
    
    // Print the bot info if available
    telegramBot.getMe().then(botInfo => {
      console.log(`Connected to Telegram bot: @${botInfo.username} (${botInfo.first_name})`);
    }).catch(err => {
      console.error('Failed to get bot info:', err);
    });
  } catch (error) {
    console.error('Error initializing Telegram bot:', error);
  }
}

// Worker configuration
const BATCH_SIZE = 10;
const POLLING_INTERVAL = 5000; // 5 seconds

// Process a notification message
async function processNotificationMessage(message) {
  try {
    console.log('Processing message:', message.id);
    const notification = JSON.parse(message.body);
    
    // Skip if no userIds are provided
    if (!notification.userIds || notification.userIds.length === 0) {
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
    
    // Send Telegram notifications if available
    if (telegramBot && notification.type) {
      try {
        // Get Telegram subscriptions for these users
        const telegramSubs = await prisma.telegramSubscription.findMany({
          where: { userId: { in: notification.userIds } },
          select: { chatId: true, userId: true, username: true }
        });
        
        if (telegramSubs.length > 0) {
          // Simple message formatting
          const message = `*${notification.data.title || 'Notification'}*\n\n${notification.data.body || 'You have a new notification'}`;
          
          // Send to each subscription
          for (const sub of telegramSubs) {
            try {
              await telegramBot.sendMessage(sub.chatId, message, { parse_mode: 'Markdown' });
              console.log(`Successfully sent Telegram message to chat ${sub.chatId}`);
            } catch (telegramError) {
              console.error(`Error sending Telegram message to chat ${sub.chatId}:`, telegramError);
            }
          }
        }
      } catch (telegramError) {
        console.error('Error sending Telegram notifications:', telegramError);
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
  console.log('Starting Redis-based notification worker...');
  console.log('Worker version: 2.0.0');
  console.log('Queue: notifications');
  console.log('Telegram bot enabled:', !!telegramBot);
  console.log('======================================');
  
  // Check queue stats
  const stats = await notificationQueue.getQueueStats();
  console.log('Initial queue stats:', stats);
  
  while (true) {
    try {
      // Receive messages from Redis queue
      const messages = await notificationQueue.receiveMessage({
        QueueUrl: 'redis://notifications',
        MaxNumberOfMessages: BATCH_SIZE
      });
      
      if (messages.length > 0) {
        console.log(`Received ${messages.length} messages from queue`);
        
        // Process each message
        for (const message of messages) {
          const success = await processNotificationMessage(message);
          
          if (success) {
            // Delete the message from queue
            await notificationQueue.deleteMessage({
              QueueUrl: 'redis://notifications',
              ReceiptHandle: message.receiptHandle
            });
            console.log(`Successfully processed and deleted message ${message.id}`);
          } else {
            console.error(`Failed to process message ${message.id}, will retry`);
            // In Redis queue, failed messages will be retried automatically
            // since we don't delete them from the processing queue
          }
        }
        
        // Update queue stats
        const newStats = await notificationQueue.getQueueStats();
        console.log('Updated queue stats:', newStats);
      } else {
        console.log('No messages in queue, waiting...');
      }
      
    } catch (error) {
      console.error('Error in worker loop:', error);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the worker
startWorker().catch(console.error);