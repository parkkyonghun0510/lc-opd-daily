# Notification Worker Setup

This document explains how to set up and run the notification worker, which processes notifications from the AWS SQS queue.

## Prerequisites

1. AWS SQS queue must be set up and configured
2. Environment variables must be properly configured
3. PM2 must be installed globally (`npm install -g pm2`)

## Environment Configuration

Make sure these variables are set in your `.env.local` file:

```
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_SQS_NOTIFICATION_QUEUE_URL=your_queue_url
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

## Starting the Worker

You can start the notification worker using PM2 with:

```bash
npm run worker:start
```

This will:
1. Load environment variables from `.env.local`
2. Start the worker process using PM2 with the `ecosystem.worker.config.cjs` configuration
3. Configure automatic restarts if the worker crashes

## Managing the Worker

- **Stop the worker**:
  ```bash
  npm run worker:stop
  ```

- **View worker logs**:
  ```bash
  npm run worker:logs
  ```

- **Check worker status**:
  ```bash
  npm run worker:status
  ```

- **Monitor worker performance**:
  ```bash
  pm2 monit
  ```

## PM2 Configuration

The worker uses its own PM2 configuration file:
- **Main file**: `ecosystem.worker.config.cjs` 
- This is separate from the main app configuration in `ecosystem.config.cjs`

## Testing the Worker

You can test the notification system with these commands:

1. **Test SQS connection**:
   ```bash
   npm run test:sqs
   ```

2. **Send a test notification**:
   ```bash
   npm run test:send
   ```

## Troubleshooting

### Worker not processing messages

- Check that AWS credentials are correct
- Verify the SQS queue URL
- Check worker logs for errors: `npm run worker:logs`
- Make sure the worker is running: `npm run worker:status`

### Notifications not appearing in the app

- Check that in-app notifications are being created in the database
- Verify that the frontend notification components are working
- Check for errors in the browser console

## Worker Architecture

The notification worker:

1. Polls the SQS queue for new notification messages
2. Processes each message to create in-app notifications in the database
3. Sends push notifications to subscribed devices (if configured)
4. Deletes processed messages from the queue

The worker runs continuously and will automatically:
- Retry failed messages
- Reconnect on network errors
- Restart if it crashes 