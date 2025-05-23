// Script to send a test notification to SQS
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { PrismaClient } from '@prisma/client';
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

// Queue URL
const queueUrl = process.env.AWS_SQS_NOTIFICATION_QUEUE_URL || '';
if (!queueUrl) {
  console.error('AWS_SQS_NOTIFICATION_QUEUE_URL environment variable is not set');
  process.exit(1);
}

async function sendTestNotification() {
  try {
    // Find a user to send notification to
    const user = await prisma.user.findFirst({
      select: { id: true, email: true, name: true }
    });
    
    if (!user) {
      console.error('No users found in database');
      return;
    }
    
    //console.log(`Sending test notification to user: ${user.email} (${user.id})`);
    
    // Current date and time for the notification
    const now = new Date();
    const formattedDate = now.toISOString().split('T')[0];
    const formattedTime = now.toTimeString().split(' ')[0];
    
    // Create notification payload
    const notification = {
      type: 'SYSTEM_NOTIFICATION',
      data: {
        title: 'Telegram Integration Test',
        body: `This is a test notification sent at ${formattedTime} to verify Telegram integration is working properly.`,
        branchName: 'Test Branch',
        date: formattedDate,
        senderName: 'System Administrator',
        actionUrl: '/dashboard',
        source: 'test-script',
        priority: 'high'
      },
      userIds: [user.id],
      timestamp: now.toISOString(),
      priority: 'high',
      idempotencyKey: `telegram-test-${Date.now()}`
    };
    
    //console.log('Sending notification with data:', JSON.stringify(notification.data, null, 2));
    
    // Send message to SQS
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(notification),
      MessageAttributes: {
        'Priority': {
          DataType: 'String',
          StringValue: 'high'
        }
      }
    });
    
    const response = await sqsClient.send(command);
    
    //console.log('Notification sent to SQS queue!');
    //console.log('Message ID:', response.MessageId);
    //console.log('Target user:', user.id);
    
    // Also create a direct in-app notification for comparison
    const directNotification = await prisma.inAppNotification.create({
      data: {
        userId: user.id,
        title: 'Direct Test Notification',
        body: 'This notification was created directly in the database (bypassing SQS)',
        type: 'SYSTEM_NOTIFICATION',
        isRead: false,
        data: { source: 'test-script', method: 'direct' }
      }
    });
    
    //console.log('Direct notification created:', directNotification.id);
    
    // Check if user has a Telegram subscription
    const telegramSub = await prisma.telegramSubscription.findFirst({
      where: { userId: user.id }
    });
    
    if (telegramSub) {
      //console.log('User has a Telegram subscription:', telegramSub.chatId);
    } else {
      //console.log('User does not have a Telegram subscription. Notification will appear in-app only.');
    }
    
  } catch (error) {
    console.error('Error sending test notification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
sendTestNotification().catch(console.error); 