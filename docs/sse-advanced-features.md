# SSE Advanced Features

This document describes the advanced features implemented for the Server-Sent Events (SSE) system in our application.

## Multi-Instance Support with Redis

Our SSE implementation supports multiple server instances through Redis-backed client tracking and pub/sub messaging.

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Instance 1 │     │  Instance 2 │     │  Instance 3 │
│             │     │             │     │             │
│  SSEHandler ├────►│  SSEHandler ├────►│  SSEHandler │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │                   ▼                   │
       │           ┌───────────────┐           │
       └──────────►│  Redis Pub/Sub├◄──────────┘
                   └───────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │  Redis Store  │
                   └───────────────┘
```

### Implementation

The Redis-backed SSE handler (`redisSSEHandler.ts`) provides:

1. **Client Tracking**: Stores client connection information in Redis, allowing any instance to know about all connected clients.

2. **Cross-Instance Communication**: Uses Redis Pub/Sub to broadcast events to clients connected to other instances.

3. **Connection Statistics**: Provides global statistics about all connected clients across all instances.

4. **Automatic Cleanup**: Removes stale connections and orphaned Redis entries.

### Usage

The system automatically uses the Redis-backed handler if Redis is configured:

```typescript
// Use Redis-backed SSE handler if available
const handler = redisSSEHandler || sseHandler;
```

## Rate Limiting

Rate limiting is implemented to prevent abuse of the SSE endpoints.

### Implementation

The rate limiter (`rate-limit.ts`) provides:

1. **Per-User/IP Limits**: Limits the number of connections per user or IP address.

2. **Time Windows**: Applies limits within configurable time windows.

3. **Redis-Backed Storage**: Uses Redis to track rate limits across multiple instances.

4. **Standard Headers**: Returns standard rate limit headers (`X-RateLimit-*`).

### Configuration

Rate limits are configured per endpoint:

```typescript
const rateLimitResponse = await rateLimiter.applyRateLimit(req, {
  identifier: 'sse',
  limit: 5, // Maximum 5 connections per user/IP
  window: 60 // Within a 60-second window
});
```

## Client-Side Caching

Client-side caching is implemented to handle temporary disconnections and improve user experience.

### Implementation

The event cache (`eventCache.ts`) provides:

1. **In-Memory Cache**: Stores events in memory for immediate access.

2. **LocalStorage Persistence**: Persists events to localStorage for access across page refreshes.

3. **Automatic Expiration**: Automatically expires old events.

4. **Type-Based Organization**: Organizes events by type for efficient retrieval.

### Usage

The cache is used in the `useSSE` hook:

```typescript
// Cache the event if caching is enabled
if (enableCache) {
  eventCache.addEvent({
    id: data.id || crypto.randomUUID(),
    type: eventType,
    data,
    timestamp
  });
}
```

## Monitoring

A monitoring system is implemented to track SSE connections and performance.

### Implementation

The monitoring system includes:

1. **Admin API**: An API endpoint (`/api/admin/sse-monitor`) that provides statistics about SSE connections.

2. **Admin UI**: A React component (`SSEMonitor.tsx`) that displays connection statistics.

3. **Real-Time Updates**: Support for auto-refreshing statistics.

### Statistics

The monitoring system provides the following statistics:

- **Handler Type**: Whether using in-memory or Redis-backed handler
- **Instance ID**: Unique identifier for the current server instance
- **Local Connections**: Number of connections on the current instance
- **Local Unique Users**: Number of unique users on the current instance
- **Global Connections**: Total number of connections across all instances
- **Global Unique Users**: Total number of unique users across all instances
- **Per-User Connections**: Number of connections per user

## Best Practices

When using these advanced features, follow these best practices:

1. **Redis Configuration**: Ensure Redis is properly configured for production use, with appropriate memory limits and persistence settings.

2. **Rate Limit Tuning**: Adjust rate limits based on your application's needs and server capacity.

3. **Cache Size Management**: Configure cache size limits based on expected event volume and client memory constraints.

4. **Monitoring**: Regularly monitor SSE connection statistics to detect issues and optimize performance.

5. **Error Handling**: Implement proper error handling for Redis connection issues and other potential failures.

## Conclusion

These advanced features provide a robust, scalable, and maintainable SSE implementation for production use. By leveraging Redis for multi-instance support, implementing rate limiting, adding client-side caching, and providing monitoring tools, the system can handle high loads and provide a reliable real-time experience for users.
