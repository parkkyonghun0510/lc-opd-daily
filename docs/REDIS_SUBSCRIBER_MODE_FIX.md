# Redis Subscriber Mode Error - Fix Documentation

## Problem Description

**Error Message:**
```
❌ Error warming charts cache: Error: Connection in subscriber mode, only subscriber commands may be used
❌ Error warming stats cache: Error: Connection in subscriber mode, only subscriber commands may be used
```

## Root Cause

Redis connections that are in **subscriber mode** (used for pub/sub operations) can only execute subscriber commands (`SUBSCRIBE`, `UNSUBSCRIBE`, `PSUBSCRIBE`, `PUNSUBSCRIBE`, etc.). When you try to execute regular Redis commands like `SET`, `GET`, `DEL` on a connection that's in subscriber mode, Redis throws this error.

### What Was Happening

1. **Single Shared Connection**: The application was using a single Redis connection instance via `getRedis()`
2. **Pub/Sub Services**: SSE handlers and real-time services were using this connection for pub/sub operations
3. **Cache Operations**: Cache warming and dashboard APIs were trying to use the same connection for regular operations
4. **Conflict**: Once the connection entered subscriber mode, cache operations failed

## Solution Implemented

### 1. Separate Redis Connection Pools

**Before (Problematic):**
```typescript
// Single connection used for everything
const redis = await getRedis();
await redis.subscribe('channel');  // Puts connection in subscriber mode
await redis.set('key', 'value');   // ❌ FAILS: Connection in subscriber mode
```

**After (Fixed):**
```typescript
// Separate connections for different purposes
const cacheRedis = await getRedis();        // For cache operations
const pubsubRedis = await getRedisPubSub(); // For pub/sub operations

await pubsubRedis.subscribe('channel');     // ✅ Pub/sub connection
await cacheRedis.set('key', 'value');       // ✅ Cache connection
```

### 2. Updated Redis Module (`src/lib/redis.ts`)

#### New Functions Added:
- `getRedisPubSub()`: Returns dedicated connection for pub/sub operations
- `getRedisStatus()`: Returns status of both cache and pub/sub connections
- Enhanced error handling for subscriber mode detection

#### Connection Management:
- **Cache Connection** (`getRedis()`): Used for `SET`, `GET`, `DEL`, etc.
- **Pub/Sub Connection** (`getRedisPubSub()`): Used for `SUBSCRIBE`, `PUBLISH`, etc.

### 3. Updated Pub/Sub Services

#### Files Modified:
- `src/lib/dragonfly/dragonflyPubSub.ts`
- `src/lib/sse/redisSSEHandler.ts`  
- `src/lib/realtime/redisEventEmitter.ts`

#### Changes:
```typescript
// Before
this.publisher = await getRedis();
this.subscriber = await getRedis(); // ❌ Same connection type

// After  
this.publisher = await getRedis();        // For publishing messages
this.subscriber = await getRedisPubSub(); // For subscribing to channels
```

## Error Prevention

### 1. Enhanced Error Detection

The `safeRedisOperation` function now detects subscriber mode errors:

```typescript
if (error.message.includes('Connection in subscriber mode')) {
  console.error('🔴 CRITICAL: Connection in subscriber mode detected!');
  console.error('Use getRedis() for cache operations, getRedisPubSub() for pub/sub');
  break; // Don't retry subscriber mode errors
}
```

### 2. Diagnostic Tools

#### Commands Added:
```bash
npm run diagnose:redis    # Check for subscriber mode issues
npm run test:redis        # Test Redis connections
npm run validate:health   # Validate health endpoints
```

#### Health Test Script:
```bash
./scripts/test-railway-health.sh  # Test deployed health endpoints
```

## Usage Guidelines

### ✅ Correct Usage

```typescript
// Cache operations
import { getRedis } from '@/lib/redis';
const cache = await getRedis();
await cache.set('dashboard:stats', data, 'EX', 300);
await cache.get('dashboard:charts');

// Pub/Sub operations  
import { getRedisPubSub } from '@/lib/redis';
const pubsub = await getRedisPubSub();
await pubsub.subscribe('notifications');
await pubsub.publish('events', message);
```

### ❌ Incorrect Usage

```typescript
// DON'T: Mix operations on same connection
const redis = await getRedis();
await redis.subscribe('channel');     // Puts in subscriber mode
await redis.set('key', 'value');      // ❌ FAILS!

// DON'T: Use pub/sub connection for cache
const pubsub = await getRedisPubSub();
await pubsub.subscribe('channel');
await pubsub.set('key', 'value');     // ❌ FAILS!
```

## Testing the Fix

### 1. Local Testing
```bash
# Check for issues
npm run diagnose:redis

# Test connections (requires Redis URL)
npm run test:redis
```

### 2. Deployment Testing
```bash
# Deploy
railway up --detach

# Monitor logs
railway logs -f

# Test health endpoint
./scripts/test-railway-health.sh

# Check for subscriber mode errors
railway logs | grep "subscriber mode"
```

### 3. Verification

**Before Fix:**
```
❌ Error warming charts cache: Error: Connection in subscriber mode
❌ Error warming stats cache: Error: Connection in subscriber mode
```

**After Fix:**
```
✅ Charts cache warmed successfully
✅ Stats cache warmed successfully
```

## Prevention for Future

### 1. Code Review Checklist
- [ ] Cache operations use `getRedis()`
- [ ] Pub/Sub operations use `getRedisPubSub()`
- [ ] No mixing of cache and pub/sub on same connection
- [ ] Error handling includes subscriber mode detection

### 2. Monitoring
- Monitor Railway logs for "subscriber mode" errors
- Set up alerts for cache warming failures
- Regular health endpoint testing

### 3. Development Guidelines
- Always use appropriate Redis connection for the operation type
- Run diagnostic tools before deployment
- Test health endpoints after deployment

## Related Issues

This fix resolves:
- Cache warming failures on Railway
- "Site can't be reached" errors (caused by health check failures)
- Need to clear browser cache to access application
- Redis pub/sub delivery issues

## Files Modified

1. `src/lib/redis.ts` - Added separate connection management
2. `src/lib/dragonfly/dragonflyPubSub.ts` - Updated to use separate connections
3. `src/lib/sse/redisSSEHandler.ts` - Updated to use separate connections
4. `src/middleware.ts` - Fixed health endpoint authentication exclusions
5. `src/app/api/health/route.ts` - Added cache-control headers
6. `scripts/validate-railway-health.cjs` - Added health validation
7. `scripts/test-railway-health.sh` - Added health testing
8. `scripts/diagnose-redis-subscriber.cjs` - Added diagnostic tool
9. `scripts/test-redis-connections.cjs` - Added connection testing