# Notification Worker Update Plan

This document outlines the planned enhancements to the notification worker system to improve reliability, performance, and add new features.

## Current Implementation

The current notification worker:

1. Polls an AWS SQS queue for notification messages
2. Processes each message to create in-app notifications in the database
3. Sends push notifications to subscribed devices (if configured)
4. Deletes processed messages from the queue

While functional, there are several areas for improvement in the current implementation.

## Current Limitations

1. **No Real-time Delivery**: Notifications are only visible when users refresh or poll the API
2. **Limited Error Handling**: Basic error handling without sophisticated retry mechanisms
3. **Minimal Monitoring**: Limited visibility into worker performance and issues
4. **No Prioritization**: All notifications are processed with the same priority
5. **Single-instance Design**: Not optimized for running multiple worker instances
6. **Limited Notification Types**: Support for only basic notification types

## Planned Enhancements

### 1. SSE Integration for Real-time Notifications

Integrate the notification worker with the new Server-Sent Events (SSE) system to provide real-time notification delivery to connected clients.

```typescript
// src/workers/notification-processor.ts
import { emitNotificationEvent } from '@/lib/sse/event-emitter';

async function processNotification(message: SQSMessage) {
  try {
    // Existing notification processing...
    const notification = await createInAppNotification(/* ... */);
    
    // New: Emit SSE event for real-time delivery
    await emitNotificationEvent(notification.userId, notification);
    
    // Continue with existing processing...
  } catch (error) {
    // Enhanced error handling...
  }
}
```

### 2. Enhanced Error Handling and Retry Mechanism

Implement a more sophisticated error handling and retry system with:

- Categorized errors (transient vs. permanent)
- Exponential backoff for retries
- Dead-letter queue for failed messages
- Detailed error logging with context

```typescript
// src/workers/error-handler.ts
export async function processWithRetries<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  context: Record<string, any> = {}
): Promise<T> {
  let attempt = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      // Log the error with context
      console.error(`Error processing notification (attempt ${attempt}/${maxRetries}):`, {
        error: error.message,
        stack: error.stack,
        ...context
      });
      
      // Check if we should retry
      if (isTransientError(error) && attempt < maxRetries) {
        // Calculate backoff time (exponential with jitter)
        const backoffMs = calculateBackoff(attempt);
        console.log(`Retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }
      
      // Move to dead-letter queue if configured
      if (context.messageId && context.receiptHandle) {
        await moveToDeadLetterQueue(context.messageId, context.receiptHandle);
      }
      
      throw error;
    }
  }
}

function isTransientError(error: any): boolean {
  // Determine if error is transient (network issues, temporary DB problems, etc.)
  return (
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    error.name === 'TransientDatabaseError' ||
    /temporary/i.test(error.message)
  );
}

function calculateBackoff(attempt: number): number {
  // Exponential backoff with jitter
  const base = Math.min(30, Math.pow(2, attempt)) * 1000;
  const jitter = Math.random() * 0.3 * base;
  return base + jitter;
}
```

### 3. Advanced Monitoring and Logging

Implement comprehensive monitoring and logging:

- Structured logging with correlation IDs
- Performance metrics collection
- Health check endpoints
- Detailed processing statistics

```typescript
// src/workers/monitoring.ts
import { createLogger } from '@/lib/logger';

const logger = createLogger('notification-worker');
const metrics = new MetricsCollector('notification-worker');

export function logProcessingStart(messageId: string, messageType: string): string {
  const correlationId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  
  logger.info('Processing notification message', {
    correlationId,
    messageId,
    messageType,
    timestamp: new Date().toISOString()
  });
  
  metrics.increment('notifications.processing.started', {
    messageType
  });
  
  return correlationId;
}

export function logProcessingComplete(correlationId: string, messageId: string, durationMs: number): void {
  logger.info('Notification processing complete', {
    correlationId,
    messageId,
    durationMs,
    timestamp: new Date().toISOString()
  });
  
  metrics.histogram('notifications.processing.duration', durationMs, {
    success: 'true'
  });
  
  metrics.increment('notifications.processing.completed');
}

export function logProcessingError(correlationId: string, messageId: string, error: any, durationMs: number): void {
  logger.error('Notification processing failed', {
    correlationId,
    messageId,
    error: error.message,
    stack: error.stack,
    durationMs,
    timestamp: new Date().toISOString()
  });
  
  metrics.histogram('notifications.processing.duration', durationMs, {
    success: 'false'
  });
  
  metrics.increment('notifications.processing.failed', {
    errorType: error.name || 'Unknown'
  });
}
```

### 4. Notification Prioritization

Implement a priority system for notifications:

- Multiple queues with different priorities
- Priority-based processing order
- SLA tracking for high-priority notifications

```typescript
// src/workers/queue-manager.ts
const QUEUE_URLS = {
  HIGH: process.env.AWS_SQS_HIGH_PRIORITY_QUEUE_URL,
  NORMAL: process.env.AWS_SQS_NOTIFICATION_QUEUE_URL,
  LOW: process.env.AWS_SQS_LOW_PRIORITY_QUEUE_URL
};

export async function pollQueues(): Promise<SQSMessage | null> {
  // Try high priority queue first
  const highPriorityMessage = await receiveMessage(QUEUE_URLS.HIGH);
  if (highPriorityMessage) {
    return {
      ...highPriorityMessage,
      priority: 'HIGH'
    };
  }
  
  // Then try normal priority
  const normalPriorityMessage = await receiveMessage(QUEUE_URLS.NORMAL);
  if (normalPriorityMessage) {
    return {
      ...normalPriorityMessage,
      priority: 'NORMAL'
    };
  }
  
  // Finally try low priority
  const lowPriorityMessage = await receiveMessage(QUEUE_URLS.LOW);
  if (lowPriorityMessage) {
    return {
      ...lowPriorityMessage,
      priority: 'LOW'
    };
  }
  
  return null;
}
```

### 5. Multi-instance Support

Enhance the worker to support running multiple instances:

- Distributed locking for singleton operations
- Work distribution mechanisms
- Instance coordination

```typescript
// src/workers/distributed-lock.ts
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const LOCK_TTL = 30000; // 30 seconds

export async function acquireLock(lockName: string, ttlMs: number = LOCK_TTL): Promise<boolean> {
  const workerId = process.env.WORKER_ID || `worker-${Math.random().toString(36).substring(2, 10)}`;
  const lockKey = `lock:${lockName}`;
  
  // Try to acquire the lock with NX (only if it doesn't exist)
  const result = await redis.set(lockKey, workerId, 'PX', ttlMs, 'NX');
  
  return result === 'OK';
}

export async function releaseLock(lockName: string): Promise<boolean> {
  const workerId = process.env.WORKER_ID || `worker-${Math.random().toString(36).substring(2, 10)}`;
  const lockKey = `lock:${lockName}`;
  
  // Only release if we own the lock
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  
  const result = await redis.eval(script, 1, lockKey, workerId);
  
  return result === 1;
}

export async function withLock<T>(lockName: string, fn: () => Promise<T>, ttlMs: number = LOCK_TTL): Promise<T | null> {
  const acquired = await acquireLock(lockName, ttlMs);
  
  if (!acquired) {
    console.log(`Failed to acquire lock: ${lockName}`);
    return null;
  }
  
  try {
    return await fn();
  } finally {
    await releaseLock(lockName);
  }
}
```

### 6. Enhanced Notification Types

Expand the notification system to support:

- Rich text notifications with HTML formatting
- Interactive notifications with action buttons
- Scheduled/delayed notifications
- Notification templates with variables

```typescript
// src/lib/notifications/templates.ts
export interface NotificationTemplate {
  id: string;
  title: string;
  message: string;
  htmlContent?: string;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  url?: string;
  apiEndpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, any>;
}

export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  REPORT_SUBMITTED: {
    id: 'REPORT_SUBMITTED',
    title: 'New Report Submitted',
    message: '{{submitterName}} has submitted a new report for {{branchName}}',
    htmlContent: '<p><strong>{{submitterName}}</strong> has submitted a new report for <strong>{{branchName}}</strong></p>',
    actions: [
      {
        id: 'view',
        label: 'View Report',
        url: '/reports/{{reportId}}'
      },
      {
        id: 'approve',
        label: 'Approve',
        apiEndpoint: '/api/reports/{{reportId}}/approve',
        method: 'POST'
      }
    ]
  },
  // More templates...
};

export function renderTemplate(
  templateId: string,
  variables: Record<string, any>
): NotificationTemplate {
  const template = NOTIFICATION_TEMPLATES[templateId];
  
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  
  // Clone the template
  const rendered = { ...template };
  
  // Replace variables in title and message
  rendered.title = replaceVariables(template.title, variables);
  rendered.message = replaceVariables(template.message, variables);
  
  // Replace variables in HTML content if present
  if (template.htmlContent) {
    rendered.htmlContent = replaceVariables(template.htmlContent, variables);
  }
  
  // Replace variables in actions if present
  if (template.actions) {
    rendered.actions = template.actions.map(action => ({
      ...action,
      url: action.url ? replaceVariables(action.url, variables) : undefined,
      apiEndpoint: action.apiEndpoint ? replaceVariables(action.apiEndpoint, variables) : undefined,
      data: action.data ? replaceVariablesInObject(action.data, variables) : undefined
    }));
  }
  
  return rendered;
}

function replaceVariables(text: string, variables: Record<string, any>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
    return variables[variable] !== undefined ? String(variables[variable]) : match;
  });
}

function replaceVariablesInObject(obj: Record<string, any>, variables: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = replaceVariables(value, variables);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = replaceVariablesInObject(value, variables);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}
```

### 7. Notification Batching and Rate Limiting

Implement batching and rate limiting to improve efficiency and prevent overwhelming users:

- Group similar notifications
- Implement user-specific rate limits
- Batch database operations

```typescript
// src/workers/notification-batcher.ts
interface BatchedNotification {
  userId: string;
  notifications: any[];
  createdAt: Date;
}

const batchedNotifications = new Map<string, BatchedNotification>();
const BATCH_WINDOW_MS = 60000; // 1 minute

export function addToBatch(userId: string, notification: any): void {
  const key = `${userId}:${notification.type}`;
  
  if (batchedNotifications.has(key)) {
    // Add to existing batch
    batchedNotifications.get(key)!.notifications.push(notification);
  } else {
    // Create new batch
    batchedNotifications.set(key, {
      userId,
      notifications: [notification],
      createdAt: new Date()
    });
  }
}

export async function processBatches(): Promise<void> {
  const now = new Date();
  const batchesToProcess: BatchedNotification[] = [];
  
  // Find batches that are ready to process
  for (const [key, batch] of batchedNotifications.entries()) {
    if (now.getTime() - batch.createdAt.getTime() >= BATCH_WINDOW_MS) {
      batchesToProcess.push(batch);
      batchedNotifications.delete(key);
    }
  }
  
  // Process each batch
  for (const batch of batchesToProcess) {
    if (batch.notifications.length === 1) {
      // Single notification, process normally
      await processNotification(batch.notifications[0]);
    } else {
      // Multiple notifications, create a grouped notification
      await processGroupedNotification(batch.userId, batch.notifications);
    }
  }
}

// Start batch processing interval
setInterval(processBatches, BATCH_WINDOW_MS / 2);
```

## Implementation Timeline

### Phase 1: Core Improvements (Weeks 1-2)

1. Enhanced error handling and retry mechanism
2. Advanced monitoring and logging
3. Basic SSE integration for real-time notifications

### Phase 2: Scaling Enhancements (Weeks 3-4)

1. Multi-instance support
2. Notification prioritization
3. Performance optimizations

### Phase 3: Feature Enhancements (Weeks 5-6)

1. Enhanced notification types
2. Notification batching and rate limiting
3. Scheduled notifications

## Migration Strategy

1. **Parallel Operation**: Run the new worker alongside the existing one initially
2. **Feature Flags**: Use feature flags to gradually enable new functionality
3. **Monitoring**: Implement comprehensive monitoring before full deployment
4. **Rollback Plan**: Maintain the ability to revert to the old worker if issues arise

## Testing Strategy

### Unit Tests

- Test individual components (error handling, batching, templates)
- Mock external dependencies (SQS, database)
- Test edge cases and error scenarios

### Integration Tests

- Test the complete notification flow
- Verify SSE integration
- Test multi-instance coordination

### Load Tests

- Simulate high message volumes
- Test performance under load
- Verify resource usage remains within acceptable limits

## Monitoring and Alerting

### Key Metrics

1. **Processing Metrics**
   - Messages processed per minute
   - Processing time per message
   - Error rate
   - Queue depth

2. **Resource Usage**
   - Memory usage
   - CPU usage
   - Network I/O

3. **Notification Delivery**
   - Delivery success rate
   - End-to-end delivery time
   - SSE connection count

### Alerts

1. **Critical Alerts**
   - Worker process crash
   - Error rate above threshold
   - Queue depth growing continuously
   - Dead-letter queue messages

2. **Warning Alerts**
   - Processing time increasing
   - Memory usage high
   - Temporary processing failures

## Conclusion

These enhancements will significantly improve the notification system's reliability, performance, and feature set. The integration with SSE will provide real-time notifications, while the other improvements will ensure the system can scale and handle a growing user base.
