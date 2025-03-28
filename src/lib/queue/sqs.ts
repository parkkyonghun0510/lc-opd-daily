import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  DeleteMessageBatchCommand,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
  SendMessageBatchResultEntry,
  BatchResultErrorEntry
} from '@aws-sdk/client-sqs';
import { NotificationType } from '@/utils/notificationTemplates';

// Initialize the SQS client
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.SQS_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.SQS_AWS_SECRET_ACCESS_KEY || ''
  },
  maxAttempts: 3 // Built-in retry mechanism
});

// Queue URL from environment
const queueUrl = process.env.AWS_SQS_NOTIFICATION_QUEUE_URL || '';

// Validate environment configuration
if (!queueUrl && typeof window === 'undefined') {
  console.error('AWS_SQS_NOTIFICATION_QUEUE_URL environment variable is not set');
}

export interface NotificationMessage {
  type: string | NotificationType;
  data: any;
  userIds?: string[];
  timestamp?: string;
  priority?: 'high' | 'normal' | 'low';
  idempotencyKey?: string;
}

/**
 * Send a notification message to the SQS queue
 */
export async function sendToNotificationQueue(message: NotificationMessage): Promise<{ MessageId?: string }> {
  if (!message.timestamp) {
    message.timestamp = new Date().toISOString();
  }

  // Generate idempotency key if not provided to prevent duplicate processing
  if (!message.idempotencyKey) {
    message.idempotencyKey = `${message.type}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  try {
    if (process.env.NODE_ENV === 'production') {
      // Minimal logging in production
      console.log(`Sending ${message.type} notification to ${message.userIds?.length || 0} recipients`);
    } else {
      console.log('Sending notification to queue:', {
        type: message.type,
        targetUsers: message.userIds?.length || 0,
        priority: message.priority || 'normal'
      });
    }

    // Set up message attributes based on priority
    const messageAttributes: Record<string, any> = {};
    if (message.priority) {
      messageAttributes['Priority'] = {
        DataType: 'String',
        StringValue: message.priority
      };
    }

    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: Object.keys(messageAttributes).length > 0 ? messageAttributes : undefined,
      // For FIFO queues
      // MessageGroupId: 'notifications',
      // MessageDeduplicationId: message.idempotencyKey,
    });

    const response = await sqsClient.send(command);
    return { MessageId: response.MessageId };
  } catch (error) {
    console.error('Error sending message to SQS:', error);
    throw error;
  }
}

/**
 * Send multiple notification messages in a batch to the SQS queue
 * More efficient than sending individual messages
 */
export async function sendBatchToNotificationQueue(messages: NotificationMessage[]): Promise<{ 
  Successful: SendMessageBatchResultEntry[], 
  Failed: BatchResultErrorEntry[] 
}> {
  if (!messages.length) return { Successful: [], Failed: [] };

  try {
    // Prepare batch entries
    const entries: SendMessageBatchRequestEntry[] = messages.map((message, index) => {
      // Add timestamp if not provided
      if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
      }
      
      // Generate idempotency key if not provided
      if (!message.idempotencyKey) {
        message.idempotencyKey = `${message.type}-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 10)}`;
      }

      // Set up message attributes based on priority
      const messageAttributes: Record<string, any> = {};
      if (message.priority) {
        messageAttributes['Priority'] = {
          DataType: 'String',
          StringValue: message.priority
        };
      }

      return {
        Id: `msg-${index}`,
        MessageBody: JSON.stringify(message),
        MessageAttributes: Object.keys(messageAttributes).length > 0 ? messageAttributes : undefined,
        // For FIFO queues
        // MessageGroupId: 'notifications',
        // MessageDeduplicationId: message.idempotencyKey,
      };
    });

    // SQS restricts batch size to 10 messages
    const results: { 
      Successful: SendMessageBatchResultEntry[], 
      Failed: BatchResultErrorEntry[] 
    } = { 
      Successful: [], 
      Failed: [] 
    };
    
    // Split into chunks of 10
    for (let i = 0; i < entries.length; i += 10) {
      const chunk = entries.slice(i, i + 10);
      
      const command = new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: chunk
      });

      const response = await sqsClient.send(command);
      
      if (response.Successful) results.Successful.push(...response.Successful);
      if (response.Failed) results.Failed.push(...response.Failed);
    }

    return results;
  } catch (error) {
    console.error('Error sending batch to SQS:', error);
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
      MaxNumberOfMessages: maxMessages > 10 ? 10 : maxMessages, // SQS limits to 10 per request
      WaitTimeSeconds: 20, // Long polling to reduce empty responses
      AttributeNames: ['All'],
      MessageAttributeNames: ['All'],
      VisibilityTimeout: 120 // Give 2 minutes to process before message becomes visible again
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
      console.log('Message deleted from queue:', receiptHandle.substring(0, 20) + '...');
    }
  } catch (error) {
    console.error('Error deleting message from SQS:', error);
    throw error;
  }
}

/**
 * Delete multiple messages from the queue in a batch operation
 */
export async function deleteBatchFromQueue(receiptHandles: string[]) {
  if (!receiptHandles.length) return;
  
  try {
    // Prepare entries for batch deletion
    const entries = receiptHandles.map((handle, index) => ({
      Id: `msg-${index}`,
      ReceiptHandle: handle
    }));
    
    // SQS restricts batch size to 10 messages
    // Split into chunks of 10
    for (let i = 0; i < entries.length; i += 10) {
      const chunk = entries.slice(i, i + 10);
      
      const command = new DeleteMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: chunk
      });

      await sqsClient.send(command);
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Batch deleted ${receiptHandles.length} messages from queue`);
    }
  } catch (error) {
    console.error('Error batch deleting messages from SQS:', error);
    throw error;
  }
} 