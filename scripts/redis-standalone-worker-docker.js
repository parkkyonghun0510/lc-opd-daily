// Standalone Redis-based worker script for Docker
import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';
import TelegramBot from 'node-telegram-bot-api';
import Redis from 'ioredis';
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
  config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.warn('No .env.local or .env file found!');
}

// Initialize Redis client for DragonflyDB
const redis = new Redis({
  host: process.env.DRAGONFLY_HOST || process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.DRAGONFLY_PORT || process.env.REDIS_PORT || '6379'),
  username: process.env.DRAGONFLY_USER || 'default',
  password: process.env.DRAGONFLY_PASSWORD || process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  keyPrefix: 'lc-opd-daily:',
});

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
const QUEUE_NAME = 'notifications';

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
  console.log('Worker version: 3.0.0');
  console.log('Queue:', QUEUE_NAME);
  console.log('Redis host:', process.env.REDIS_HOST || 'localhost');
  console.log('Telegram bot enabled:', !!telegramBot);
  console.log('======================================');
  
  // Check initial queue length
  const queueLength = await redis.llen(QUEUE_NAME);
  console.log(`Initial queue length: ${queueLength}`);
  
  while (true) {
    try {
      // Receive messages from Redis queue (using RPOP to get oldest first)
      const messages = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        const message = await redis.rpop(QUEUE_NAME);
        if (message) {
          messages.push({
            id: Date.now() + Math.random(),
            body: message,
            receiptHandle: Date.now() + Math.random()
          });
        }
      }
      
      if (messages.length > 0) {
        console.log(`Received ${messages.length} messages from Redis queue`);
        
        // Process each message
        for (const message of messages) {
          const success = await processNotificationMessage(message);
          
          if (success) {
            console.log(`Successfully processed message ${message.id}`);
          } else {
            console.error(`Failed to process message ${message.id}, will retry`);
            // Re-add failed message to the end of the queue for retry
            await redis.lpush(QUEUE_NAME, message.body);
          }
        }
        
        // Check updated queue length
        const newQueueLength = await redis.llen(QUEUE_NAME);
        console.log(`Updated queue length: ${newQueueLength}`);
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
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
});

// Start the worker
startWorker().catch(console.error);