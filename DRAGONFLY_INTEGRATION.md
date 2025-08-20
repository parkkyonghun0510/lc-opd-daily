# Dragonfly Queue Integration Guide

This guide covers migrating from the legacy Redis notification service to the new Dragonfly-based queue system.

## Overview

The Dragonfly queue system provides:
- **Redis-compatible interface** with enhanced performance
- **SQS-compatible API** for familiarity and portability
- **Immediate in-app notifications** with queued push delivery
- **Automatic retry and DLQ handling**
- **Better scalability** than direct Redis operations

## Architecture

```
API Routes → dragonflyNotificationService → Dragonfly Redis Queue
                    ↓ (immediate)                    ↓ (queued)
            In-App + Real-time              dragonfly-worker
                                                    ↓
                                            Push Notifications
```

## Environment Variables

### Required Environment Variables

```bash
# Dragonfly/Redis Connection
DRAGONFLY_URL=redis://localhost:6379
# Note: REDIS_URL is no longer supported

# Queue Configuration
DRAGONFLY_QUEUE_NAME=notifications  # default
DRAGONFLY_QUEUE_URL=redis://notifications  # used by worker

# Push Notifications (for worker)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_CONTACT_EMAIL=admin@yourapp.com
```

### Optional Environment Variables

```bash
# Worker Performance Tuning
NODE_ENV=production  # Affects polling intervals and logging
```

## Migration Steps

### Step 1: Update Service Imports

Replace imports from `redisNotificationService` to `dragonflyNotificationService`:

**Before:**
```typescript
import { sendNotification } from "@/lib/notifications/redisNotificationService";
```

**After:**
```typescript
import { sendNotification } from "@/lib/notifications/dragonflyNotificationService";
```

**Files Updated:**
- `src/app/api/users/route.ts`
- `src/app/api/users/me/request-approval/route.ts`

### Step 2: Start Dragonfly Worker

The worker processes queued push notifications:

```bash
# Build the worker first
npm run build:worker

# Development - direct run
node dist/workers/dragonfly-worker.js

# Production (with PM2) - requires ecosystem worker config
# Create ecosystem.worker.config.cjs with dragonfly-worker app definition
pm2 start ecosystem.worker.config.cjs --only dragonfly-worker

# Alternative: Direct PM2 start
pm2 start dist/workers/dragonfly-worker.js --name dragonfly-worker
```

### Step 3: Verify Configuration

Check that your Dragonfly/Redis instance is running and accessible:

```bash
redis-cli -h localhost -p 6379 ping
# Should return: PONG
```

## Service Comparison

### Legacy Redis Service
```typescript
// Direct Redis operations in API routes
// Manual pub/sub for real-time notifications
// Push notifications sent immediately (blocking)
```

### Dragonfly Service
```typescript
// Immediate: In-app notifications + real-time events
// Queued: Push notifications via worker
// Automatic retry logic and error handling
```

## Key Components

### DragonflyNotificationService
- **Location:** `src/lib/notifications/dragonflyNotificationService.ts`
- **Purpose:** Main service API, handles immediate notifications and queues push delivery
- **Usage:** Import `{ sendNotification }` in API routes

### DragonflyQueueService
- **Location:** `src/lib/dragonfly-queue.ts`
- **Purpose:** SQS-compatible Redis queue implementation
- **Features:** Delayed messages, visibility timeout, automatic cleanup

### Dragonfly Worker
- **Location:** `src/workers/dragonfly-worker.ts`
- **Purpose:** Processes queued push notifications
- **Features:** Retry logic, subscription cleanup, batch processing

## API Usage

### Sending Notifications

```typescript
import { sendNotification } from "@/lib/notifications/dragonflyNotificationService";

// Example: User approval request
await sendNotification({
  type: "USER_APPROVAL_REQUESTED",
  data: {
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    branchId: user.branchId
  }
});
```

### Notification Flow

1. **API Route** calls `sendNotification()`
2. **Service** determines recipients via `getUsersForNotification()`
3. **Service** creates in-app notifications immediately
4. **Service** emits real-time events immediately
5. **Service** queues push notification job
6. **Worker** processes push notifications asynchronously

## Monitoring

### Queue Statistics

```typescript
import { getDragonflyQueueService } from "@/lib/dragonfly-queue";

const stats = await getDragonflyQueueService().getQueueStats();
console.log({
  queueLength: stats.queueLength,        // Pending messages
  processingLength: stats.processingLength, // Being processed
  delayedLength: stats.delayedLength     // Delayed messages
});
```

### Worker Health

Check worker logs for processing status:
```bash
# PM2 logs
pm2 logs dragonfly-worker

# Direct logs
tail -f logs/dragonfly-worker.log
```

## Performance Considerations

### Development vs Production

**Development:**
- Polling interval: 5000ms
- Max messages per batch: 5
- Verbose logging enabled

**Production:**
- Polling interval: 2000ms
- Max messages per batch: 10
- Error/warn logging only

### Scaling

- **Horizontal:** Run multiple worker instances
- **Vertical:** Increase `MAX_MESSAGES_PER_BATCH`
- **Queue:** Use Redis Cluster for high throughput

## Troubleshooting

### Common Issues

1. **Connection Errors**
   ```
   Error: connect ECONNREFUSED 127.0.0.1:6379
   ```
   - Check `DRAGONFLY_URL` environment variable
   - Verify Redis/Dragonfly is running

2. **VAPID Key Errors**
   ```
   Error: VAPID keys not set
   ```
   - Ensure `VAPID_PRIVATE_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are set
   - Generate new keys if needed: `npx web-push generate-vapid-keys`

3. **Worker Not Processing**
   - Check worker is running: `pm2 list`
   - Verify queue has messages: use `getQueueStats()`
   - Check worker logs for errors

### Debug Mode

Enable debug logging in development:
```typescript
// In dragonflyNotificationService.ts
const DEBUG = process.env.NODE_ENV !== 'production';
if (DEBUG) console.log('Processing notification:', { type, userIds });
```

## Rollback Plan

If you need to rollback to Redis service:

1. **Update imports:**
   ```typescript
   // Change back to:
   import { sendNotification } from "@/lib/notifications/redisNotificationService";
   ```

2. **Stop Dragonfly worker:**
   ```bash
   pm2 stop dragonfly-worker
   ```

3. **Start Redis worker (if used):**
   ```bash
   pm2 start ecosystem.config.cjs --only redis-worker
   ```

## Testing

### Unit Tests
```bash
npm run test -- --grep="dragonfly"
```

### Integration Tests
```bash
# Test notification flow
curl -X POST http://localhost:3002/api/users/me/request-approval \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json"
```

### Manual Verification

1. **Check queue length:**
   ```redis
   LLEN notifications
   ```

2. **Inspect messages:**
   ```redis
   LRANGE notifications 0 -1
   ```

3. **Check processing set:**
   ```redis
   ZRANGE notifications:processing 0 -1
   ```

## Support

For issues or questions:
1. Check logs first: `pm2 logs` or application logs
2. Verify environment variables are set correctly
3. Test Redis connectivity: `redis-cli ping`
4. Review this documentation for configuration details

---

**Note:** This integration maintains backward compatibility with existing notification targeting and templates. No changes to `notificationTargeting.ts` or `notificationTemplates.ts` are required.