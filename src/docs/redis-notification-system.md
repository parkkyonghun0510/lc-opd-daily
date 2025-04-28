# Enhanced Redis Notification System

This document describes the enhanced Redis-based notification system that replaces the previous SQS-based approach.

## Overview

The enhanced Redis notification system provides a streamlined approach to handling notifications in the application. It eliminates the need for separate SQS queues and worker processes, instead using Redis for both real-time delivery and reliable message processing. The system now includes load balancing, rate limiting, and improved error handling.

## Architecture

The enhanced Redis notification system consists of the following components:

1. **Enhanced Redis Notification Service**: A centralized service that handles creating in-app notifications and sending real-time notifications via Redis with load balancing and rate limiting.
2. **Redis Load Balancer**: Distributes Redis operations across multiple Redis instances for improved reliability and performance.
3. **Redis Event Emitter**: Handles broadcasting events to clients through various channels (SSE, WebSocket, Polling) across multiple server instances.
4. **Zustand State Management**: Manages the client-side state of notifications, including caching, UI updates, and user interactions.

## Benefits

- **Simplified Architecture**: Eliminates the need for separate SQS queues and worker processes.
- **Real-time Delivery**: Notifications are delivered in real-time to connected clients.
- **Reliability**: Redis provides reliable message delivery with built-in persistence and load balancing.
- **Scalability**: The system can scale horizontally across multiple server instances and Redis nodes.
- **Monitoring**: Built-in metrics and history tracking for monitoring and debugging.
- **Rate Limiting**: Prevents notification flooding and ensures fair resource usage.
- **Load Balancing**: Distributes Redis operations across multiple instances for improved performance.
- **Error Handling**: Improved error handling with detailed error tracking and fallback mechanisms.

## Components

### Enhanced Redis Notification Service

The enhanced Redis notification service (`enhancedRedisNotificationService.ts`) provides the following functionality:

- **Send Notification**: Creates in-app notifications and sends real-time notifications via Redis with load balancing and rate limiting.
- **Process Notification**: Processes a notification, creating in-app notifications and emitting real-time events.
- **Get Metrics**: Provides metrics about the notification system, including queue length, error count, and load balancer stats.
- **Get History**: Retrieves recent notification history for monitoring and debugging.
- **Rate Limiting**: Prevents notification flooding by limiting the number of notifications per user and type.

### Redis Load Balancer

The Redis load balancer (`redisLoadBalancer.ts`) provides the following functionality:

- **Execute Operation**: Executes a Redis operation with load balancing across multiple Redis instances.
- **Health Checks**: Performs regular health checks on Redis instances to ensure availability.
- **Failover**: Automatically fails over to healthy Redis instances when one becomes unavailable.
- **Metrics**: Provides metrics about the load balancer, including instance health and operation counts.

### Redis Event Emitter

The Redis event emitter (`redisEventEmitter.ts`) provides the following functionality:

- **Emit Event**: Broadcasts an event to clients through various channels.
- **Emit Notification**: Convenience function for emitting notification events.
- **Emit Dashboard Update**: Convenience function for emitting dashboard update events.

### Zustand State Management

The Zustand state management (`hybridRealtimeSlice.ts`) provides the following functionality:

- **Process Event**: Processes incoming events, updating the UI and triggering callbacks.
- **Cache Event**: Caches events for offline access and persistence.
- **Load Cached Events**: Loads cached events from localStorage.

## API Endpoints

The following API endpoints are available for interacting with the notification system:

- **POST /api/notifications/send**: Sends a notification to one or more users.
- **POST /api/push/send**: Sends a push notification to one or more users.
- **GET /api/notifications/metrics/redis**: Gets metrics about the notification system.
- **GET /api/notifications/history**: Gets recent notification history.
- **POST /api/test/redis-notification**: Sends a test notification using the enhanced Redis notification system.
- **GET /api/test/redis-notification**: Gets metrics about the enhanced Redis notification system.
- **POST /api/test/sse-notification**: Sends a test notification using the SSE system.

## Usage

### Sending a Notification

```typescript
import { sendNotification } from '@/lib/redis/enhancedRedisNotificationService';

// Send a notification
const notificationId = await sendNotification({
  type: 'REPORT_APPROVED',
  data: {
    reportId: '123',
    title: 'Report Approved',
    body: 'Your report has been approved',
    actionUrl: '/reports/123'
  },
  userIds: ['user-123'],
  priority: 'high',
  idempotencyKey: `report-123-approved-${Date.now()}`
});
```

### Emitting a Real-time Event

```typescript
import { emitNotification } from '@/lib/realtime/redisEventEmitter';

// Emit a notification event
const eventId = await emitNotification(
  'New Message',
  'You have a new message',
  {
    userIds: ['user-123'],
    type: 'info'
  }
);
```

## Monitoring

The notification system provides built-in monitoring through the following endpoints:

- **GET /api/notifications/metrics/redis**: Gets metrics about the notification system.
- **GET /api/notifications/history**: Gets recent notification history.

## Testing

The system includes a dedicated test page for verifying the Redis notification system:

- **Test Page**: `/test/redis-notification` - A UI for testing Redis notifications and viewing metrics.

This page allows you to:

1. Check the real-time connection status
2. View Redis metrics (queue length, processing count, etc.)
3. Send test notifications via Redis and SSE
4. View recent events and notifications

## Troubleshooting

### Notifications Not Being Delivered

1. Check Redis connection: Make sure Redis is running and accessible.
2. Check notification metrics: Use the `/api/test/redis-notification` endpoint to check for errors.
3. Check load balancer health: Verify that Redis instances are healthy in the load balancer stats.
4. Check rate limiting: Ensure that notifications aren't being rate limited.

### Real-time Updates Not Working

1. Check client connection: Make sure the client is connected to the real-time update system.
2. Check connection method: Verify if the client is using SSE, WebSocket, or polling.
3. Check event handlers: Make sure the appropriate event handlers are registered.
4. Check Redis connection: Make sure Redis is running and accessible.

### Performance Issues

1. Check Redis metrics: Monitor queue length and processing count for bottlenecks.
2. Check load balancer stats: Ensure Redis instances are properly distributing load.
3. Adjust rate limits: Modify rate limits in the enhanced Redis notification service if needed.
4. Scale Redis instances: Add more Redis instances to the load balancer for increased capacity.
