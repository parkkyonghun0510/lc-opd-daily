# Notification Queue System

This document explains the architecture, setup, and usage of the asynchronous notification queue system in the LC-OPD-Daily project. The system leverages AWS SQS to decouple notification processing from API requests, improving responsiveness and scalability.

It complements the [Notification Worker](./notification-worker.md), which processes queued notifications, and the [Error Handling Guide](./error-handling-guide.md).

## Overview

The notification system uses AWS SQS (Simple Queue Service) to handle notification processing in the background. This allows the application to:

1. Process notifications asynchronously, improving API response times
2. Handle large volumes of notifications without affecting the main application
3. Retry failed notifications automatically
4. Scale notification processing separately from the main application

## Components

The notification system consists of the following components:

1. **API Endpoint** (`/api/push/send`) - Receives notification requests and places them in the queue
2. **SQS Queue** - Stores notification messages for processing
3. **Worker Process** - Processes messages from the queue and sends push notifications
4. **In-App Notification Storage** - Stores notifications in the database for in-app display

## Setup Steps

### 1. Create AWS SQS Queue

1. Log in to the AWS Management Console
2. Navigate to the SQS service
3. Create a new Standard Queue named `lc-opd-daily-notifications`
4. Note the Queue URL and region

### 2. Create IAM User with SQS Permissions

1. Navigate to the IAM service in AWS
2. Create a new user with programmatic access
3. Attach the `AmazonSQSFullAccess` policy (or create a custom policy with limited permissions)
4. Note the Access Key ID and Secret Access Key

### 3. Configure Environment Variables

Add the following to your `.env.local` file:

```
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_SQS_NOTIFICATION_QUEUE_URL=your_queue_url
```

### 4. Build the Worker

```bash
npm run build:worker
```

### 5. Run the Worker

For development:
```bash
npm run start:worker
```

For production, you can use a process manager like PM2:
```bash
pm2 start npm --name "notification-worker" -- run start:worker
```

## Sending Notifications

To send a notification, make a POST request to `/api/push/send` with the following payload:

```json
{
  "type": "REPORT_SUBMITTED",
  "data": {
    "reportId": "123",
    "submitterName": "John Doe"
  },
  "userIds": ["user1", "user2"]  // Optional: specific users to target
}
```

The API will:

1. Queue the notification message in SQS asynchronously (non-blocking)
2. Create in-app notifications immediately in the database
3. Return a success response with the message ID

The actual push notification delivery is handled separately by the [Notification Worker](./notification-worker.md).

## Troubleshooting

### Worker Not Processing Notifications

1. Check if AWS credentials are correct
2. Verify the SQS queue URL is correct
3. Check worker logs for errors
4. Verify that the worker process is running

### Notifications Not Appearing In-App

1. Check the database `inAppNotification` table
2. Verify that notification creation isn't failing in the API route
3. Check for errors in the application logs

### Push Notifications Not Being Sent

1. Verify that subscriptions exist in the database
2. Check worker logs for push notification sending errors
3. Verify that VAPID keys are set correctly
4. Check browser console for service worker errors

## Monitoring

Monitor the following metrics:

1. SQS queue depth
2. Worker process memory usage
3. Notification success/failure ratios
4. API response times

## Scaling

To scale the notification system:

1. Run multiple worker processes on different machines
2. Configure the SQS queue for higher throughput
## Related Documentation

- [Notification Worker](./notification-worker.md)
- [Code Organization](./code-organization.md)
- [Error Handling Guide](./error-handling-guide.md)
- [Performance Optimizations](./performance-optimizations.md)
- [Production Deployment](./production-deployment.md)

3. Monitor queue depth and adjust number of workers accordingly 