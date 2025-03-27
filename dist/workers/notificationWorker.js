import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { generateNotificationContent } from '@/utils/notificationTemplates';
import { receiveFromNotificationQueue, deleteMessageFromQueue } from '@/lib/queue/sqs';
// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not set');
}
else {
    webpush.setVapidDetails('mailto:admin@example.com', vapidPublicKey, vapidPrivateKey);
}
// Maximum retries for sending notifications
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
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
            console.log('No users to notify, skipping');
            return true;
        }
        console.log(`Processing notification of type ${notification.type} for ${notification.userIds.length} users`);
        // Get all push subscriptions for the target users
        const subscriptions = await prisma.pushSubscription.findMany({
            where: {
                userId: {
                    in: notification.userIds
                }
            }
        });
        console.log(`Found ${subscriptions.length} push subscriptions`);
        // Generate notification content
        const notificationContent = generateNotificationContent(notification.type, notification.data);
        // Track successful and failed push notification sends
        let successCount = 0;
        let failCount = 0;
        // Send push notification to each subscription
        for (const subscription of subscriptions) {
            try {
                await sendNotificationWithRetry(subscription, notificationContent);
                successCount++;
            }
            catch (error) {
                failCount++;
                console.error(`Failed to send push notification to subscription ${subscription.id}:`, error);
            }
        }
        console.log(`Processed notification: ${successCount} successes, ${failCount} failures`);
        return true;
    }
    catch (error) {
        console.error('Error processing notification message:', error);
        return false;
    }
}
/**
 * Send a push notification with retry logic
 */
async function sendNotificationWithRetry(subscription, notificationContent, retryCount = 0) {
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
        await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth,
            },
        }, JSON.stringify(payload));
    }
    catch (error) {
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
            console.log(`Retrying notification (${retryCount + 1}/${MAX_RETRIES})`);
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
        }
        catch (error) {
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
