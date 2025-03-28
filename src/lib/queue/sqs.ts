import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs';
import { NotificationType } from '@/utils/notificationTemplates';

// Initialize the SQS client
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.SQS_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.SQS_AWS_SECRET_ACCESS_KEY || ''
  }
});

// Queue URL from environment
const queueUrl = process.env.AWS_SQS_NOTIFICATION_QUEUE_URL || '';

// Validate environment configuration
if (!queueUrl) {
  console.error('AWS_SQS_NOTIFICATION_QUEUE_URL environment variable is not set');
}

interface NotificationMessage {
  type: string | NotificationType;
  data: any;
  userIds?: string[];
  timestamp?: string;
}

/**
 * Send a notification message to the SQS queue
 */
export async function sendToNotificationQueue(message: NotificationMessage): Promise<{ MessageId?: string }> {
  if (!message.timestamp) {
    message.timestamp = new Date().toISOString();
  }

  try {
    if (process.env.NODE_ENV === 'production') {
      // Minimal logging in production
      console.log(`Sending ${message.type} notification to ${message.userIds?.length || 0} recipients`);
    } else {
      console.log('Sending notification to queue:', {
        type: message.type,
        targetUsers: message.userIds?.length || 0
      });
    }

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      // FIFO queue configuration can be uncommented if using a FIFO queue
      // MessageGroupId: 'notifications',
      // MessageDeduplicationId: `${message.type}-${Date.now()}`,
    });

    const response = await sqsClient.send(command);
    return { MessageId: response.MessageId };
  } catch (error) {
    console.error('Error sending message to SQS:', error);
    throw error;
  }
}

/**
 * Receive messages from the notification queue
 */
export async function receiveFromNotificationQueue(maxMessages = 10) {
  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 20, // Long polling
      AttributeNames: ['All'],
      MessageAttributeNames: ['All'],
      VisibilityTimeout: 60 // Give 60 seconds to process before message becomes visible again
    });

    const response = await sqsClient.send(command);
    return response.Messages || [];
  } catch (error) {
    console.error('Error receiving messages from SQS:', error);
    throw error;
  }
}

/**
 * Delete a message from the queue after processing
 */
export async function deleteMessageFromQueue(receiptHandle: string) {
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
    throw error;
  }
} 