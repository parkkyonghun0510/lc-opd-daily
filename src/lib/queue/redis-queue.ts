import { getRedis } from '../redis';
import type { Redis } from 'ioredis';

export interface RedisQueueMessage {
  id: string;
  body: string;
  receiptHandle?: string;
  attributes?: Record<string, any>;
}

export interface SendMessageRequest {
  QueueUrl: string;
  MessageBody: string;
  DelaySeconds?: number;
}

export interface SendMessageBatchRequest {
  QueueUrl: string;
  Entries: Array<{
    Id: string;
    MessageBody: string;
    DelaySeconds?: number;
  }>;
}

export interface ReceiveMessageRequest {
  QueueUrl: string;
  MaxNumberOfMessages?: number;
  WaitTimeSeconds?: number;
  VisibilityTimeout?: number;
}

export interface DeleteMessageRequest {
  QueueUrl: string;
  ReceiptHandle: string;
}

export interface MessageResponse {
  MessageId?: string;
  Successful?: Array<{
    Id: string;
    MessageId: string;
  }>;
  Failed?: Array<{
    Id: string;
    SenderFault?: boolean;
    Code?: string;
    Message?: string;
  }>;
}

export class RedisQueueService {
  private readonly queueKey: string;
  private readonly processingKey: string;
  private readonly visibilityTimeout: number;

  constructor(queueName: string = 'notifications', visibilityTimeout: number = 300) {
    this.queueKey = `queue:${queueName}`;
    this.processingKey = `queue:${queueName}:processing`;
    this.visibilityTimeout = visibilityTimeout;
  }

  private async getRedis(): Promise<Redis> {
    return await getRedis();
  }

  /**
   * Send a single message to the queue
   */
  async sendMessage(request: SendMessageRequest): Promise<MessageResponse> {
    const messageId = this.generateMessageId();
    const message = {
      id: messageId,
      body: request.MessageBody,
      timestamp: Date.now()
    };

    const redisClient = await this.getRedis();

    if (request.DelaySeconds && request.DelaySeconds > 0) {
      // Use Redis sorted set for delayed messages
      const delayedKey = `${this.queueKey}:delayed`;
      const score = Date.now() + (request.DelaySeconds * 1000);
      await redisClient.zadd(delayedKey, score, JSON.stringify(message));
    } else {
      // Add to main queue
      await redisClient.lpush(this.queueKey, JSON.stringify(message));
    }

    return { MessageId: messageId };
  }

  /**
   * Send multiple messages in batch
   */
  async sendMessageBatch(request: SendMessageBatchRequest): Promise<MessageResponse> {
    const successful: any[] = [];
    const failed: any[] = [];

    for (const entry of request.Entries) {
      try {
        const messageId = this.generateMessageId();
        const message = {
          id: messageId,
          body: entry.MessageBody,
          timestamp: Date.now()
        };

        const redisClient = await this.getRedis();

        if (entry.DelaySeconds && entry.DelaySeconds > 0) {
          const delayedKey = `${this.queueKey}:delayed`;
          const score = Date.now() + (entry.DelaySeconds * 1000);
          await redisClient.zadd(delayedKey, score, JSON.stringify(message));
        } else {
          await redisClient.lpush(this.queueKey, JSON.stringify(message));
        }

        successful.push({ Id: entry.Id, MessageId: messageId });
      } catch (error) {
        failed.push({
          Id: entry.Id,
          SenderFault: true,
          Code: 'InternalError',
          Message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { Successful: successful, Failed: failed };
  }

  /**
   * Receive messages from the queue
   */
  async receiveMessage(request: ReceiveMessageRequest): Promise<RedisQueueMessage[]> {
    const maxMessages = Math.min(request.MaxNumberOfMessages || 1, 10);
    const messages: RedisQueueMessage[] = [];
    const redisClient = await this.getRedis();

    // Process delayed messages first
    await this.processDelayedMessages();

    for (let i = 0; i < maxMessages; i++) {
      const messageStr = await redisClient.rpoplpush(this.queueKey, this.processingKey);
      if (!messageStr) break;

      try {
        const messageData = JSON.parse(messageStr);
        const receiptHandle = this.generateReceiptHandle(messageData.id);
        
        // Set expiration for processing key
        await redisClient.expire(this.processingKey, this.visibilityTimeout);

        messages.push({
          id: messageData.id,
          body: messageData.body,
          receiptHandle
        });
      } catch (error) {
        console.error('Error parsing message:', error);
        // Put back invalid message to main queue
        await redisClient.lpush(this.queueKey, messageStr);
      }
    }

    return messages;
  }

  /**
   * Delete a message from the queue
   */
  async deleteMessage(request: DeleteMessageRequest): Promise<void> {
    const messageId = this.extractMessageIdFromReceiptHandle(request.ReceiptHandle);
    const redisClient = await this.getRedis();
    
    // Remove from processing queue
    const processingMessages = await redisClient.lrange(this.processingKey, 0, -1);
    for (let i = 0; i < processingMessages.length; i++) {
      const messageStr = processingMessages[i];
      try {
        const messageData = JSON.parse(messageStr);
        if (messageData.id === messageId) {
          await redisClient.lrem(this.processingKey, 0, messageStr);
          break;
        }
      } catch (error) {
        console.error('Error parsing message for deletion:', error);
      }
    }
  }

  /**
   * Process delayed messages that are ready to be queued
   */
  private async processDelayedMessages(): Promise<void> {
    const delayedKey = `${this.queueKey}:delayed`;
    const now = Date.now();
    const redisClient = await this.getRedis();
    
    const readyMessages = await redisClient.zrangebyscore(delayedKey, 0, now);
    
    for (const messageStr of readyMessages) {
      await redisClient.zrem(delayedKey, messageStr);
      await redisClient.lpush(this.queueKey, messageStr);
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
    const redisClient = await this.getRedis();
    const [queueLength, processingLength, delayedLength] = await Promise.all([
      redisClient.llen(this.queueKey),
      redisClient.llen(this.processingKey),
      redisClient.zcard(`${this.queueKey}:delayed`)
    ]);

    return { queueLength, processingLength, delayedLength };
  }

  /**
   * Purge all messages from the queue
   */
  async purgeQueue(): Promise<void> {
    const redisClient = await this.getRedis();
    await Promise.all([
      redisClient.del(this.queueKey),
      redisClient.del(this.processingKey),
      redisClient.del(`${this.queueKey}:delayed`)
    ]);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReceiptHandle(messageId: string): string {
    return `receipt_${messageId}_${Date.now()}`;
  }

  private extractMessageIdFromReceiptHandle(receiptHandle: string): string {
    return receiptHandle.split('_')[1];
  }
}

// Export singleton instances for compatibility
export const notificationQueue = new RedisQueueService('notifications');

// Export compatible functions for SQS replacement
export async function sendToNotificationQueue(messageBody: string, delaySeconds?: number) {
  return notificationQueue.sendMessage({
    QueueUrl: 'redis://notifications',
    MessageBody: messageBody,
    DelaySeconds: delaySeconds
  });
}

export async function sendBatchToNotificationQueue(messages: Array<{ id: string; body: string; delaySeconds?: number }>) {
  return notificationQueue.sendMessageBatch({
    QueueUrl: 'redis://notifications',
    Entries: messages.map(msg => ({
      Id: msg.id,
      MessageBody: msg.body,
      DelaySeconds: msg.delaySeconds
    }))
  });
}

export async function receiveFromNotificationQueue(maxMessages: number = 10) {
  return notificationQueue.receiveMessage({
    QueueUrl: 'redis://notifications',
    MaxNumberOfMessages: maxMessages,
    WaitTimeSeconds: 0
  });
}

export async function deleteMessageFromQueue(receiptHandle: string) {
  return notificationQueue.deleteMessage({
    QueueUrl: 'redis://notifications',
    ReceiptHandle: receiptHandle
  });
}