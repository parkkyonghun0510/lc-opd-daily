import { notificationQueue } from './redis-queue';
import { randomUUID } from 'crypto';

// Configuration for Redis-based queue (SQS-compatible interface)
const queueUrl = process.env.NOTIFICATION_QUEUE_URL || 'redis://notifications';
const LOW_PRIORITY_DELAY_SECONDS = parseInt(process.env.LOW_PRIORITY_DELAY_SECONDS || '30');

// Define notification types locally until proper type definitions are available
export type NotificationType = 
  | 'report_submitted'
  | 'report_approved'
  | 'report_rejected'
  | 'user_created'
  | 'system_maintenance'
  | string; // Allow custom types

export interface NotificationData {
  title: string;
  body: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationMessage {
  type: NotificationType;
  data: NotificationData;
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
    message.idempotencyKey = `${message.type}-${Date.now()}-${randomUUID()}`;
  }

  try {
    if (process.env.NODE_ENV === 'production') {
      // Minimal logging in production
      console.log(`Sending ${message.type} notification to ${message.userIds?.length || 0} recipients`);
    } else {
      console.log('Sending notification to Redis queue:', {
        type: message.type,
        targetUsers: message.userIds?.length || 0,
        priority: message.priority || 'normal'
      });
    }

    // Calculate delay based on priority
    let delaySeconds = 0;
    if (message.priority === 'low') {
      delaySeconds = LOW_PRIORITY_DELAY_SECONDS; // Configurable delay for low priority
    } else if (message.priority === 'high') {
      delaySeconds = 0; // No delay for high priority
    }

    const response = await notificationQueue.sendMessage({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      DelaySeconds: delaySeconds
    });

    return { MessageId: response.MessageId };
  } catch (error) {
    console.error('Error sending message to Redis queue:', error);
    throw error;
  }
}

/**
 * Send multiple notification messages in a batch to the SQS queue
 * More efficient than sending individual messages
 */
export async function sendBatchToNotificationQueue(messages: NotificationMessage[]): Promise<{ 
  Successful: Array<{ Id: string; MessageId: string }>, 
  Failed: Array<{ Id: string; Code?: string; Message?: string }> 
}> {
  if (!messages.length) return { Successful: [], Failed: [] };

  try {
    // Prepare batch entries
    const entries = messages.map((message, index) => {
      // Add timestamp if not provided
      if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
      }
      
      // Generate idempotency key if not provided
      if (!message.idempotencyKey) {
        message.idempotencyKey = `${message.type}-${Date.now()}-${index}-${randomUUID()}`;
      }

      // Calculate delay based on priority
      let delaySeconds = 0;
      if (message.priority === 'low') {
        delaySeconds = LOW_PRIORITY_DELAY_SECONDS;
      } else if (message.priority === 'high') {
        delaySeconds = 0;
      }

      return {
        id: `msg-${index}`,
        body: JSON.stringify(message),
        delaySeconds
      };
    });

    // Optional: chunk to 10 to mimic SQS behavior
    const chunks: typeof entries[] = [];
    for (let i = 0; i < entries.length; i += 10) {
      chunks.push(entries.slice(i, i + 10));
    }

    let Successful: Array<{ Id: string; MessageId: string }> = [];
    let Failed: Array<{ Id: string; Code?: string; Message?: string }> = [];

    for (const chunk of chunks) {
      const response = await notificationQueue.sendMessageBatch({
        QueueUrl: queueUrl,
        Entries: chunk.map(entry => ({
          Id: entry.id,
          MessageBody: entry.body,
          DelaySeconds: entry.delaySeconds
        }))
      });

      Successful = Successful.concat(response.Successful || []);
      Failed = Failed.concat(response.Failed || []);
    }

    return { Successful, Failed };
  } catch (error) {
    console.error('Error sending batch to Redis queue:', error);
    throw error;
  }
}

/**
 * Receive messages from the notification queue
 */
export async function receiveFromNotificationQueue(maxMessages = 10) {
  try {
    const messages = await notificationQueue.receiveMessage({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages
    });

    return messages.map(msg => ({
      MessageId: msg.id,
      ReceiptHandle: msg.receiptHandle,
      Body: msg.body,
      Attributes: msg.attributes || {}
    }));
  } catch (error) {
    console.error('Error receiving messages from Redis queue:', error);
    throw error;
  }
}

/**
 * Delete a message from the queue after processing
 */
export async function deleteMessageFromQueue(receiptHandle: string) {
  try {
    await notificationQueue.deleteMessage({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle
    });
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Message deleted from Redis queue:', receiptHandle.substring(0, 20) + '...');
    }
  } catch (error) {
    console.error('Error deleting message from Redis queue:', error);
    throw error;
  }
}

/**
 * Delete multiple messages from the queue in a batch operation
 */
export async function deleteBatchFromQueue(receiptHandles: string[]) {
  if (!receiptHandles.length) return;
  
  try {
    // Concurrency limit to avoid overwhelming Redis
    const CONCURRENCY = parseInt(process.env.QUEUE_DELETE_CONCURRENCY || '10');
    let index = 0;

    const worker = async () => {
      while (index < receiptHandles.length) {
        const current = index++;
        const handle = receiptHandles[current];
        await notificationQueue.deleteMessage({
          QueueUrl: queueUrl,
          ReceiptHandle: handle
        });
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, receiptHandles.length) }, () => worker());
    await Promise.all(workers);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Batch deleted ${receiptHandles.length} messages from queue`);
    }
  } catch (error) {
    console.error('Error batch deleting messages from Redis queue:', error);
    throw error;
  }
}