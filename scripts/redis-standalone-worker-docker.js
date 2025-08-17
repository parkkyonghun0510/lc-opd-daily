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

console.log(`[Worker] Starting in directory: ${process.cwd()}`);
console.log(`[Worker] Script directory: ${__dirname}`);
console.log(`[Worker] Project root: ${projectRoot}`);

// Load environment variables explicitly from .env.local first, then .env
// In Railway/Docker, environment variables are typically injected directly
const envLocalPath = path.join(projectRoot, '.env.local');
const envPath = path.join(projectRoot, '.env');

if (fs.existsSync(envLocalPath)) {
  console.log(`[Worker] Loading environment from: ${envLocalPath}`);
  config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  console.log(`[Worker] Loading environment from: ${envPath}`);
  config({ path: envPath });
} else {
  console.log('[Worker] No .env files found, using system environment variables (Railway/Docker mode)');
}

// Initialize Redis client for DragonflyDB with Railway support
const redisConfig = {
  host: process.env.DRAGONFLY_HOST || process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.DRAGONFLY_PORT || process.env.REDIS_PORT || '6379'),
  username: process.env.DRAGONFLY_USER || 'default',
  password: process.env.DRAGONFLY_PASSWORD || process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 2000,
  enableReadyCheck: true,
  maxRetriesPerRequest: 5,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  keyPrefix: 'lc-opd-daily:',
  connectTimeout: 10000,
  commandTimeout: 5000,
  retryDelayOnClusterDown: 300,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  retryDelayOnClusterDown: 300,
  enableOfflineQueue: false,
};

console.log(`[Worker] Redis config: ${redisConfig.host}:${redisConfig.port} (DB: ${redisConfig.db})`);
console.log(`[Worker] Environment: NODE_ENV=${process.env.NODE_ENV}`);

// Check if Redis service is available before connecting
let redis;
try {
  redis = new Redis(redisConfig);
} catch (error) {
  console.error('[Worker] Failed to create Redis instance:', error);
  process.exit(1);
}

// Add Redis connection event handlers for better debugging
let redisConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 10;

redis.on('connect', () => {
  console.log('[Worker] Redis connected');
  redisConnected = true;
  connectionAttempts = 0;
});

redis.on('ready', () => {
  console.log('[Worker] Redis ready');
  redisConnected = true;
});

redis.on('error', (err) => {
  console.error('[Worker] Redis error:', err);
  redisConnected = false;
  connectionAttempts++;
  
  if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    console.error(`[Worker] Max Redis connection attempts (${MAX_CONNECTION_ATTEMPTS}) reached. Worker will continue without Redis.`);
    redisConnected = false;
  }
});

redis.on('close', () => {
  console.log('[Worker] Redis connection closed');
  redisConnected = false;
});

redis.on('reconnecting', () => {
  console.log('[Worker] Redis reconnecting...');
  redisConnected = false;
});

// Function to add startup delay for Railway environment
async function initializeWorker() {
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.log('[Worker] Railway environment detected, adding startup delay...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Ensure NODE_ENV is set to production
  if (!process.env.NODE_ENV || !['production', 'development', 'test'].includes(process.env.NODE_ENV)) {
    console.warn(`[Worker] Non-standard NODE_ENV detected: ${process.env.NODE_ENV}. Setting to 'production'.`);
    process.env.NODE_ENV = 'production';
  }
  
  console.log(`[Worker] NODE_ENV is now: ${process.env.NODE_ENV}`);
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
  // Initialize worker with Railway-specific settings
  await initializeWorker();
  
  console.log('======================================');
  console.log('Starting Redis-based notification worker...');
  console.log('Worker version: 3.0.0');
  console.log('Queue:', QUEUE_NAME);
  console.log('Redis host:', process.env.DRAGONFLY_HOST || process.env.REDIS_HOST || 'localhost');
  console.log('Telegram bot enabled:', !!telegramBot);
  console.log('======================================');
  
  // Check initial queue length with error handling
  let queueLength = 0;
  try {
    if (redisConnected) {
      queueLength = await redis.llen(QUEUE_NAME);
      console.log(`Initial queue length: ${queueLength}`);
    } else {
      console.log('Redis not connected, starting worker in degraded mode');
    }
  } catch (error) {
    console.error('Error checking queue length:', error);
    console.log('Starting worker in degraded mode');
  }
  
  while (true) {
    try {
      // Check Redis connection before processing
      if (!redisConnected) {
        console.log('[Worker] Redis not connected, waiting for connection...');
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        continue;
      }
      
      // Receive messages from Redis queue (using RPOP to get oldest first)
      const messages = [];
      try {
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
      } catch (redisError) {
        console.error('[Worker] Redis operation failed:', redisError);
        redisConnected = false;
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        continue;
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
            try {
              if (redisConnected) {
                await redis.lpush(QUEUE_NAME, message.body);
              } else {
                console.error('[Worker] Cannot retry message - Redis disconnected');
              }
            } catch (retryError) {
              console.error('[Worker] Failed to re-queue message:', retryError);
            }
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