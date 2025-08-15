import { createClient, RedisClientType } from 'redis';
import { randomUUID } from 'crypto';

// Dragonfly Redis configuration
const DRAGONFLY_URL = process.env.DRAGONFLY_URL || process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = process.env.DRAGONFLY_QUEUE_NAME || 'notifications';
const VISIBILITY_TIMEOUT = 60; // seconds

// Dragonfly Redis Queue Service - SQS Compatible Interface
export class DragonflyQueueService {
  private client: RedisClientType;
  private queueName: string;
  private dlqName: string;
  private isConnected: boolean = false;

  constructor(queueName: string = QUEUE_NAME) {
    this.queueName = queueName;
    this.dlqName = `${queueName}-dlq`;
    
    this.client = createClient({
      url: DRAGONFLY_URL,
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    this.client.on('error', (err) => {
      console.error('Dragonfly Redis connection error:', err);
    });

    this.client.on('connect', () => {
      console.log('Connected to Dragonfly Redis');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      console.log('Disconnected from Dragonfly Redis');
      this.isConnected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  /**
   * Send a message to the queue (SQS sendMessage equivalent)
   */
  async sendMessage(params: {
    QueueUrl: string;
    MessageBody: string;
    DelaySeconds?: number;
    MessageAttributes?: Record<string, any>;
  }): Promise<{ MessageId: string }> {
    await this.connect();
    
    const messageId = randomUUID();
    const timestamp = Date.now();
    const delaySeconds = params.DelaySeconds || 0;
    
    const message = {
      MessageId: messageId,
      Body: params.MessageBody,
      Attributes: params.MessageAttributes || {},
      Timestamp: timestamp,
      DelaySeconds: delaySeconds,
    };

    if (delaySeconds > 0) {
      // Use sorted set for delayed messages
      const delayedTime = timestamp + (delaySeconds * 1000);
      await this.client.zAdd(`${this.queueName}:delayed`, {
        score: delayedTime,
        value: JSON.stringify(message),
      });
    } else {
      // Add to main queue
      await this.client.lPush(this.queueName, JSON.stringify(message));
    }

    return { MessageId: messageId };
  }

  /**
   * Send multiple messages in batch (SQS sendMessageBatch equivalent)
   */
  async sendMessageBatch(params: {
    QueueUrl: string;
    Entries: Array<{
      Id: string;
      MessageBody: string;
      DelaySeconds?: number;
    }>;
  }): Promise<{
    Successful: Array<{ Id: string; MessageId: string }>;
    Failed: Array<{ Id: string; Code?: string; Message?: string }>;
  }> {
    await this.connect();
    
    const successful: Array<{ Id: string; MessageId: string }> = [];
    const failed: Array<{ Id: string; Code?: string; Message?: string }> = [];

    for (const entry of params.Entries) {
      try {
        const result = await this.sendMessage({
          QueueUrl: params.QueueUrl,
          MessageBody: entry.MessageBody,
          DelaySeconds: entry.DelaySeconds,
        });
        
        successful.push({
          Id: entry.Id,
          MessageId: result.MessageId,
        });
      } catch (error) {
        failed.push({
          Id: entry.Id,
          Code: 'InternalError',
          Message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { Successful: successful, Failed: failed };
  }

  /**
   * Receive messages from the queue (SQS receiveMessage equivalent)
   */
  async receiveMessage(params: {
    QueueUrl: string;
    MaxNumberOfMessages?: number;
    WaitTimeSeconds?: number;
    VisibilityTimeout?: number;
  }): Promise<Array<{
    MessageId: string;
    ReceiptHandle: string;
    Body: string;
    Attributes: Record<string, any>;
  }>> {
    await this.connect();

    // Process delayed messages first
    await this.processDelayedMessages();

    const maxMessages = params.MaxNumberOfMessages || 1;
    const messages = [];

    for (let i = 0; i < maxMessages; i++) {
      const messageData = await this.client.rPop(this.queueName);
      if (!messageData) break;

      try {
        const message = JSON.parse(messageData);
        const receiptHandle = randomUUID();
        
        // Store message in processing set with visibility timeout
        const visibilityTimeout = params.VisibilityTimeout || VISIBILITY_TIMEOUT;
        const expiryTime = Date.now() + (visibilityTimeout * 1000);
        
        await this.client.zAdd(`${this.queueName}:processing`, {
          score: expiryTime,
          value: JSON.stringify({
            ...message,
            ReceiptHandle: receiptHandle,
          }),
        });

        messages.push({
          MessageId: message.MessageId,
          ReceiptHandle: receiptHandle,
          Body: message.Body,
          Attributes: message.Attributes || {},
        });
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    }

    return messages;
  }

  /**
   * Delete a message from the queue (SQS deleteMessage equivalent)
   */
  async deleteMessage(params: {
    QueueUrl: string;
    ReceiptHandle: string;
  }): Promise<void> {
    await this.connect();
    
    // Remove from processing set
    const processingMessages = await this.client.zRange(`${this.queueName}:processing`, 0, -1);
    for (const messageData of processingMessages) {
      try {
        const message = JSON.parse(messageData);
        if (message.ReceiptHandle === params.ReceiptHandle) {
          await this.client.zRem(`${this.queueName}:processing`, messageData);
          break;
        }
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }
  }

  /**
   * Process delayed messages that are ready to be moved to main queue
   */
  private async processDelayedMessages(): Promise<void> {
    const now = Date.now();
    const delayedMessages = await this.client.zRangeByScore(
      `${this.queueName}:delayed`,
      0,
      now
    );

    for (const messageData of delayedMessages) {
      try {
        const message = JSON.parse(messageData);
        await this.client.lPush(this.queueName, JSON.stringify(message));
        await this.client.zRem(`${this.queueName}:delayed`, messageData);
      } catch (error) {
        console.error('Error processing delayed message:', error);
      }
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queueLength: number;
    processingLength: number;
    delayedLength: number;
  }> {
    await this.connect();
    
    const [queueLength, processingLength, delayedLength] = await Promise.all([
      this.client.lLen(this.queueName),
      this.client.zCard(`${this.queueName}:processing`),
      this.client.zCard(`${this.queueName}:delayed`),
    ]);

    return { queueLength, processingLength, delayedLength };
  }

  /**
   * Clean up expired messages from processing set
   */
  async cleanupExpiredMessages(): Promise<number> {
    await this.connect();

    const now = Date.now();
    const expiredMessages = await this.client.zRangeByScore(
      `${this.queueName}:processing`,
      0,
      now
    );

    let cleaned = 0;
    for (const messageData of expiredMessages) {
      try {
        const message = JSON.parse(messageData);
        // Move back to main queue
        await this.client.lPush(this.queueName, JSON.stringify(message));
        await this.client.zRem(`${this.queueName}:processing`, messageData);
        cleaned++;
      } catch (error) {
        console.error('Error cleaning up expired message:', error);
      }
    }

    return cleaned;
  }
}

let dragonflyQueueService: DragonflyQueueService | null = null;

export function getDragonflyQueueService(): DragonflyQueueService {
  if (!dragonflyQueueService) {
    dragonflyQueueService = new DragonflyQueueService();
  }
  return dragonflyQueueService;
}

// Minimal SQS-compatible interface wrapper for dragonfly service usage
export const dragonflySQS = {
  sendMessage: async (params: any) => {
    const service = getDragonflyQueueService();
    return service.sendMessage(params);
  },
  sendMessageBatch: async (params: any) => {
    const service = getDragonflyQueueService();
    return service.sendMessageBatch(params);
  },
  receiveMessage: async (params: any) => {
    const service = getDragonflyQueueService();
    return service.receiveMessage(params);
  },
  deleteMessage: async (params: any) => {
    const service = getDragonflyQueueService();
    return service.deleteMessage(params);
  },
};

export default DragonflyQueueService;