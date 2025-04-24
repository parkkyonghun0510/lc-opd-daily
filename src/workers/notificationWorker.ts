// Load environment variables first (before any other imports)
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try to load from .env.local first, then fall back to .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  //console.log(`Loading environment from ${envLocalPath}`);
  config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  //console.log(`Loading environment from ${envPath}`);
  config({ path: envPath });
} else {
  console.warn('No .env.local or .env file found!');
}

// Debug environment variables
//console.log('Environment variables loaded:');
//console.log('- TELEGRAM_BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);
//console.log('- TELEGRAM_BOT_USERNAME exists:', !!process.env.TELEGRAM_BOT_USERNAME);
//console.log('- AWS_REGION exists:', !!process.env.AWS_REGION);
//console.log('- AWS_SQS_NOTIFICATION_QUEUE_URL exists:', !!process.env.AWS_SQS_NOTIFICATION_QUEUE_URL);
//console.log('- Working directory:', process.cwd());

import webpush from 'web-push';
import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '@/lib/prisma';
import { NotificationType, generateNotificationContent } from '@/utils/notificationTemplates';
import {
  receiveFromNotificationQueue,
  deleteMessageFromQueue,
  deleteBatchFromQueue
} from '@/lib/queue/sqs';
import { escapeTelegramMarkdown } from '@/lib/telegram';
import sseHandler from '@/lib/sse/sseHandler';

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

// Initialize Telegram Bot
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
let bot: TelegramBot | null = null;
if (!telegramToken) {
  console.error('TELEGRAM_BOT_TOKEN not set. Telegram notifications disabled.');
  console.error('Please make sure TELEGRAM_BOT_TOKEN is set in your .env.local file.');
  console.error('Current environment variables:', Object.keys(process.env).filter(key =>
    key.includes('TELEGRAM') || key.includes('AWS') || key.includes('VAPID')
  ));
} else {
  try {
    //console.log(`Initializing Telegram bot with token: ${telegramToken.substring(0, 5)}...`);
    bot = new TelegramBot(telegramToken);
    // No polling needed here if only sending messages and handling /start via SQS/worker
    //console.log('Telegram Bot initialized successfully.');
  } catch (error) {
    console.error('Error initializing Telegram bot:', error);
  }
}

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const BATCH_SIZE = 10; // Process 10 messages at a time
const ERROR_THRESHOLD = 10; // Error threshold before pausing
const HEALTH_CHECK_INTERVAL = 300000; // 5 minutes
const LINKING_CODE_EXPIRY_MINUTES = 10;

// Performance metrics
const metrics = {
  messageProcessed: 0,
  pushSuccesses: 0,
  pushFailures: 0,
  telegramSuccesses: 0,
  telegramFailures: 0,
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
  //console.log(`[createInAppNotifications] Creating notifications for ${userIds.length} users of type ${type}`);
  //console.log(`[createInAppNotifications] Notification data:`, JSON.stringify(data, null, 2));

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
    case NotificationType.SYSTEM_NOTIFICATION:
      title = data.title || 'System Notification';
      body = data.body || 'A new system message has been posted.';
      actionUrl = data.actionUrl || '/dashboard';
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

    //console.log(`[createInAppNotifications] Prepared ${notifications.length} notification objects`);

    // Log first notification for debugging
    if (notifications.length > 0) {
      //console.log(`[createInAppNotifications] First notification sample:`, JSON.stringify(notifications[0], null, 2));
    }

    // Insert in-app notifications in bulk
    if (notifications.length > 0) {
      //console.log(`[createInAppNotifications] Attempting to insert ${notifications.length} notifications into database...`);
      try {
        const result = await prisma.inAppNotification.createMany({
          data: notifications
        });
        //console.log(`[createInAppNotifications] Successfully created ${result.count} notifications in database`);
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
      //console.log('No users to notify, skipping');
      return true;
    }

    const priority = notification.priority || 'normal';
    //console.log(`Processing ${priority} priority notification of type ${notification.type} for ${notification.userIds.length} users`);

    // 1. Create in-app notifications
    const inAppCount = await createInAppNotifications(
      notification.type as NotificationType,
      notification.data || {},
      notification.userIds
    );

    // 2. Send Web Push Notifications
    let pushSuccessCount = 0;
    let pushFailCount = 0;
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: notification.userIds } },
      select: { id: true, endpoint: true, p256dh: true, auth: true, userId: true }
    });

    if (subscriptions.length > 0) {
      //console.log(`Found ${subscriptions.length} push subscriptions`);
      const notificationContent = generateNotificationContent(
        notification.type as NotificationType,
        notification.data
      );
      const pushResults = await Promise.allSettled(
        subscriptions.map(sub => sendNotificationWithRetry(sub, notificationContent))
      );
      pushResults.forEach(result => {
        if (result.status === 'fulfilled') pushSuccessCount++;
        else { pushFailCount++; console.error('Push notification failed:', result.reason); }
      });
      metrics.pushSuccesses += pushSuccessCount;
      metrics.pushFailures += pushFailCount;
    }

    // 3. Send Telegram Notifications
    let telegramSuccessCount = 0;
    let telegramFailCount = 0;
    let telegramSubsCount = 0; // Initialize count here
    if (bot) { // Only proceed if bot is initialized
      const telegramSubs = await prisma.telegramSubscription.findMany({
        where: { userId: { in: notification.userIds } },
        select: { chatId: true, userId: true }
      });
      telegramSubsCount = telegramSubs.length; // Assign count here

      if (telegramSubs.length > 0) {
        //console.log(`Found ${telegramSubs.length} Telegram subscriptions`);
        // Generate content specifically for Telegram (maybe simpler)
        const telegramContent = generateTelegramMessage(
          notification.type as NotificationType,
          notification.data
        );

        const telegramResults = await Promise.allSettled(
          telegramSubs.map(sub => sendTelegramMessageWithRetry(bot!, sub.chatId, telegramContent))
        );

        telegramResults.forEach(result => {
          if (result.status === 'fulfilled') telegramSuccessCount++;
          else { telegramFailCount++; console.error('Telegram message failed:', result.reason); }
        });
        metrics.telegramSuccesses += telegramSuccessCount;
        metrics.telegramFailures += telegramFailCount;
      }
    }

    metrics.messageProcessed++;
    //console.log(`Processed notification: ${pushSuccessCount}/${subscriptions.length} push, ${telegramSuccessCount}/${telegramSubsCount} TG, ${inAppCount} in-app`); // Use telegramSubsCount

    // Broadcast SSE event to all relevant users using standardized format
    try {
      notification.userIds.forEach(userId => {
        // Send a properly formatted SSE event using the enhanced handler
        sseHandler.sendEventToUser(
          userId,
          'notification', // Use a standardized event type
          {
            id: crypto.randomUUID(), // Generate a unique ID for the notification
            type: notification.type,
            title: notification.data?.title,
            body: notification.data?.body,
            data: notification.data,
            timestamp: Date.now(),
            priority: notification.priority || 'normal'
          }
        );
      });

      // Log successful SSE broadcast
      console.log(`[SSE] Broadcast notification of type ${notification.type} to ${notification.userIds.length} users`);
    } catch (sseError) {
      console.error("[SSE] Error broadcasting notification:", sseError);
    }

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
        //console.log('Auto-resuming worker after pause period');
        metrics.isPaused = false;
        metrics.consecutiveErrors = 0;
      }, 300000); // 5 minutes
    }

    return false;
  }
}

/**
 * Generate a formatted message suitable for Telegram (MarkdownV2)
 */
function generateTelegramMessage(type: NotificationType, data: any): string {
  let title = '';
  let body = '';
  let details: string[] = [];

  // Simple switch for basic formatting
  switch (type) {
    case NotificationType.REPORT_SUBMITTED:
      title = '📝 Report Submitted';
      body = `A new report from *${escapeTelegramMarkdown(data.branchName || 'Unknown Branch')}* requires approval\.`;
      details.push(`_Submitter:_ ${escapeTelegramMarkdown(data.submitterName || 'Unknown')}`);
      details.push(`_Date:_ ${escapeTelegramMarkdown(data.date || 'N/A')}`);
      break;
    case NotificationType.REPORT_APPROVED:
      title = '✅ Report Approved';
      body = `Your report for *${escapeTelegramMarkdown(data.branchName || 'Unknown Branch')}* \(${escapeTelegramMarkdown(data.date || 'N/A')}\) has been approved\.`;
      details.push(`_Approved by:_ ${escapeTelegramMarkdown(data.approverName || 'A manager')}`);
      break;
    case NotificationType.REPORT_REJECTED:
      title = '❌ Report Rejected';
      body = `Your report for *${escapeTelegramMarkdown(data.branchName || 'Unknown Branch')}* \(${escapeTelegramMarkdown(data.date || 'N/A')}\) was rejected\.`;
      if (data.reason) details.push(`_Reason:_ ${escapeTelegramMarkdown(data.reason)}`);
      details.push(`_Rejected by:_ ${escapeTelegramMarkdown(data.approverName || 'A manager')}`);
      break;
    case NotificationType.SYSTEM_NOTIFICATION:
      title = `📢 ${escapeTelegramMarkdown(data.title || 'System Update')}`; // Use provided title
      body = escapeTelegramMarkdown(data.body || 'Important system update.'); // Use provided body
      if (data.senderName) details.push(`_From:_ ${escapeTelegramMarkdown(data.senderName)}`);
      break;
    // Add other cases as needed
    default:
      title = '🔔 Notification';
      body = 'You have a new update\. Check the app for details\. \(Fallback Message\)';
      details.push(`_Type:_ ${escapeTelegramMarkdown(type)}`);
  }

  let message = `*${title}*

${body}`;
  if (details.length > 0) {
    message += `

${details.join('\n')}`;
  }

  return message;
}

/**
 * Send a Telegram message (simplified retry)
 */
async function sendTelegramMessageWithRetry(
  botInstance: TelegramBot,
  chatId: string,
  messageText: string,
  retryCount = 0
): Promise<void> {
  try {
    await botInstance.sendMessage(chatId, messageText, { parse_mode: 'MarkdownV2' });
  } catch (error: any) {
    // Log the error details
    console.error(
      `Telegram Send Error (Chat ID: ${chatId}, Retry: ${retryCount}): `,
      error.response?.body || error.message || error
    );

    // Simple retry based only on count, not error content
    if (retryCount < MAX_RETRIES) {
      //console.log(`Retrying Telegram message (${retryCount + 1}/${MAX_RETRIES}) for chat ${chatId}`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      // Recursively call, passing the incremented retry count
      return sendTelegramMessageWithRetry(botInstance, chatId, messageText, retryCount + 1);
    }

    // If retries exhausted, throw the last error
    console.error(`Telegram message failed after ${MAX_RETRIES} retries for chat ${chatId}.`);
    throw error;
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
      //console.log(`Subscription expired or invalid, deleting: ${subscription.id}`);
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
      //console.log(`Retrying notification (${retryCount + 1}/${MAX_RETRIES}) for subscription ${subscription.id}`);
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
    //console.log(`[METRICS] Worker running for ${runTime} minutes:`);
    //console.log(`- Messages processed: ${metrics.messageProcessed}`);
    //console.log(`- Push notifications: ${metrics.pushSuccesses} successful, ${metrics.pushFailures} failed`);
    //console.log(`- In-app notifications created: ${metrics.inAppCreated}`);
    //console.log(`- Errors: ${metrics.errors}`);
    //console.log(`- Status: ${metrics.isPaused ? 'PAUSED' : 'RUNNING'}`);
    //console.log(`- Telegram messages: ${metrics.telegramSuccesses} successful, ${metrics.telegramFailures} failed`);

    // Reset consecutive errors counter if things are working well
    if (metrics.consecutiveErrors > 0 && !metrics.isPaused) {
      metrics.consecutiveErrors = 0;
    }
  }, HEALTH_CHECK_INTERVAL);
}

/**
 * Handle /start command for Telegram linking
 */
async function handleTelegramStartCommand(msg: TelegramBot.Message) {
  if (!bot) return;
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const match = text.match(/^\/start\s+([A-Za-z0-9]+)$/); // Match /start CODE

  if (!match) {
    await bot.sendMessage(chatId, "Hi\! To link your account, please go to your user settings in the web app and click 'Link Telegram Account'\.");
    return;
  }

  const code = match[1];
  //console.log(`Received /start command with code: ${code} from chat ID: ${chatId}`);

  try {
    // 1. Find the linking code
    const linkingCode = await prisma.telegramLinkingCode.findUnique({
      where: { code },
      include: { user: true } // Include user data
    });

    if (!linkingCode) {
      //console.log(`Linking code ${code} not found.`);
      await bot.sendMessage(chatId, "Invalid or expired linking code\. Please try generating a new one from your settings\.");
      return;
    }

    // 2. Check if expired
    if (new Date() > linkingCode.expiresAt) {
      //console.log(`Linking code ${code} has expired.`);
      await prisma.telegramLinkingCode.delete({ where: { id: linkingCode.id } }); // Clean up expired code
      await bot.sendMessage(chatId, "This linking code has expired\. Please try generating a new one from your settings\.");
      return;
    }

    // 3. Check if user already has a subscription
    const existingSub = await prisma.telegramSubscription.findFirst({
      where: { OR: [{ userId: linkingCode.userId }, { chatId: String(chatId) }] }
    });

    if (existingSub) {
      if (existingSub.userId === linkingCode.userId && existingSub.chatId === String(chatId)) {
        //console.log(`User ${linkingCode.userId} is already linked to chat ${chatId}.`);
        await bot.sendMessage(chatId, "Your account is already linked to this Telegram chat\.");
      } else if (existingSub.userId === linkingCode.userId) {
        //console.log(`User ${linkingCode.userId} is already linked to another chat (${existingSub.chatId}).`);
        await bot.sendMessage(chatId, "Your app account is already linked to a different Telegram chat\. Please unlink it first if you want to use this one\.");
      } else {
        //console.log(`Chat ${chatId} is already linked to another user (${existingSub.userId}).`);
        await bot.sendMessage(chatId, "This Telegram chat is already linked to a different app account\. Please use a different Telegram account or unlink the other app account first\.");
      }
      await prisma.telegramLinkingCode.delete({ where: { id: linkingCode.id } }); // Clean up used/conflicting code
      return;
    }

    // 4. Create the subscription
    await prisma.telegramSubscription.create({
      data: {
        userId: linkingCode.userId,
        chatId: String(chatId),
        username: msg.chat.username,
      },
    });

    // 5. Clean up the code
    await prisma.telegramLinkingCode.delete({ where: { id: linkingCode.id } });

    //console.log(`Successfully linked user ${linkingCode.userId} to chat ID ${chatId}`);
    await bot.sendMessage(chatId, `✅ Success\! Your account \(${escapeTelegramMarkdown(linkingCode.user.email)}\) is now linked to receive Telegram notifications\.`, { parse_mode: 'MarkdownV2' });

  } catch (error) {
    console.error('Error handling /start command:', error);
    await bot.sendMessage(chatId, "An error occurred while linking your account\. Please try again later or contact support\.");
  }
}

/**
 * Main worker function that continuously polls the notification queue
 */
export async function startNotificationWorker() {
  //console.log('======================================');
  //console.log('Starting notification worker...');
  //console.log('Worker version: 1.1.0 (debug)');
  //console.log('AWS Region:', process.env.AWS_REGION);
  //console.log('Queue URL:', process.env.AWS_SQS_NOTIFICATION_QUEUE_URL);
  //console.log('======================================');

  // Setup Telegram listener if bot exists
  if (bot) {
    bot.onText(/^\/start(?:\s+(.*))?$/, (msg) => {
      // Offload processing to avoid blocking the listener
      handleTelegramStartCommand(msg).catch(err => {
        console.error("Error in handleTelegramStartCommand:", err);
      });
    });
    bot.on('polling_error', (error) => {
      console.error('Telegram Polling Error:', error.name, error.message);
      // Potentially add logic to restart bot or handle specific errors
    });
    // Start polling explicitly if needed for /start commands
    bot.startPolling();
    //console.log("Telegram Bot polling started for /start commands.");
  }

  // Start metrics reporting
  startMetricsReporting();

  while (true) {
    try {
      // Skip processing if worker is paused due to errors
      if (metrics.isPaused) {
        //console.log('Worker is paused due to errors, waiting before retrying...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        continue;
      }

      //console.log('[WORKER] Polling for messages from SQS queue...');

      // Receive messages from the notification queue
      const messages = await receiveFromNotificationQueue(BATCH_SIZE);

      if (!messages || messages.length === 0) {
        // If no messages, wait a bit before polling again
        //console.log('[WORKER] No messages received, waiting before next poll');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      //console.log(`[WORKER] Received ${messages.length} messages from queue`);

      // Log info about the first message
      if (messages.length > 0 && messages[0].Body) {
        try {
          const firstMessage = JSON.parse(messages[0].Body);
          //console.log(`[WORKER] First message sample: type=${firstMessage.type}, userIds=${firstMessage.userIds?.length || 0}`);
        } catch (parseError) {
          console.error('[WORKER] Could not parse first message:', parseError);
        }
      }

      // Process the batch of messages
      const { successful, failed } = await processBatchNotifications(messages);

      //console.log(`[WORKER] Processed batch: ${successful.length} successful, ${failed.length} failed`);

      // Delete successful messages in batch
      if (successful.length > 0) {
        //console.log(`[WORKER] Deleting ${successful.length} processed messages`);
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
          //console.log('Auto-resuming worker after pause period');
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