# Hybrid Real-time Architecture

This document describes the hybrid real-time architecture used in the application, which combines Server-Sent Events (SSE) with traditional polling to provide reliable real-time updates across all browsers and network conditions.

## Overview

The hybrid approach uses:

1. **Server-Sent Events (SSE)** as the primary method for real-time updates
2. **Polling** as a fallback when SSE is not supported or fails
3. **In-memory event storage** with optional Redis support for multi-instance deployments

This approach provides the best balance of real-time performance and reliability.

## Architecture Components

### Server-Side Components

#### Event Emitter

The Event Emitter is responsible for:

- Storing events in memory
- Emitting events to connected clients
- Providing methods to retrieve events for specific users

There are two implementations:

- `eventEmitter.ts`: In-memory implementation for single-instance deployments
- `redisEventEmitter.ts`: Redis-backed implementation for multi-instance deployments

#### SSE Handler

The SSE Handler is responsible for:

- Managing SSE client connections
- Sending events to connected clients
- Handling connection cleanup

#### Rate Limiter

The Rate Limiter is responsible for:

- Preventing abuse of the SSE endpoints
- Limiting the number of connections per user/IP
- Limiting the number of events per user/IP

#### Monitor

The Monitor is responsible for:

- Tracking connection statistics
- Tracking event statistics
- Tracking performance metrics
- Providing a dashboard for monitoring

### Client-Side Components

#### Hybrid Realtime Hook

The Hybrid Realtime Hook is responsible for:

- Managing the connection to the server
- Automatically switching between SSE and polling
- Handling reconnection and error recovery

#### Dashboard Context

The Dashboard Context is responsible for:

- Providing dashboard data with real-time updates
- Managing the connection to the server
- Handling data fetching and caching

## Flow Diagrams

### Connection Flow

```
Client                                Server
  |                                     |
  |  1. Request SSE connection          |
  | ----------------------------------> |
  |                                     |
  |  2. Check rate limits               |
  |                                     |
  |  3. Establish SSE connection        |
  | <---------------------------------- |
  |                                     |
  |  4. Send initial connection event   |
  | <---------------------------------- |
  |                                     |
  |  5. Connection established          |
  |                                     |
```

### Event Flow

```
Client                                Server
  |                                     |
  |  1. Event occurs (e.g., report      |
  |     approval)                       |
  |                                     |
  |  2. Emit event                      |
  |                                     |
  |  3. Store event in memory/Redis     |
  |                                     |
  |  4. Send event to connected clients |
  | <---------------------------------- |
  |                                     |
  |  5. Process event                   |
  |                                     |
```

### Fallback Flow

```
Client                                Server
  |                                     |
  |  1. SSE connection fails            |
  |                                     |
  |  2. Switch to polling               |
  |                                     |
  |  3. Poll for updates                |
  | ----------------------------------> |
  |                                     |
  |  4. Return events since last poll   |
  | <---------------------------------- |
  |                                     |
  |  5. Process events                  |
  |                                     |
```

## Implementation Details

### Server-Side Implementation

#### Event Emitter

```typescript
// In-memory event emitter
class EventEmitter {
  private events: EventRecord[] = [];

  emit(
    type: string,
    data: any,
    options: { userIds?: string[]; roles?: string[] } = {},
  ): string {
    // Create event record
    // Store in memory
    // Return event ID
  }

  getEventsForUser(userId: string, since?: number): EventRecord[] {
    // Return events for user
  }
}
```

#### SSE Handler

```typescript
// SSE handler
class SSEHandler {
  private clients: Map<string, Client> = new Map();

  handleConnection(
    request: NextRequest,
    userId: string,
    response: any,
  ): string {
    // Create client record
    // Store client
    // Return client ID
  }

  sendEvent(response: any, event: { type: string; data: any }): boolean {
    // Format event
    // Send to client
    // Return success
  }

  broadcastEvent(eventType: string, data: any): number {
    // Send event to all clients
    // Return number of clients
  }
}
```

#### Rate Limiter

```typescript
// Rate limiter
class RateLimiter {
  async checkUserLimit(userId: string, limitType: string): Promise<boolean> {
    // Check if user has exceeded limit
    // Return true if limit exceeded
  }

  async checkIpLimit(ip: string, limitType: string): Promise<boolean> {
    // Check if IP has exceeded limit
    // Return true if limit exceeded
  }
}
```

### Client-Side Implementation

#### Hybrid Realtime Hook

```typescript
// Hybrid realtime hook
function useHybridRealtime(options: HybridRealtimeOptions = {}) {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [activeMethod, setActiveMethod] = useState<"sse" | "polling" | null>(
    null,
  );

  // Set up SSE connection
  const setupSSE = () => {
    // Create EventSource
    // Set up event listeners
    // Return success
  };

  // Set up polling
  const startPolling = () => {
    // Set up polling interval
    // Return cleanup function
  };

  // Initialize connection
  useEffect(() => {
    // Try SSE first
    // Fall back to polling if SSE fails
    // Return cleanup function
  }, []);

  // Return hook API
  return {
    isConnected,
    activeMethod,
    lastEvent,
    error,
    reconnect,
  };
}
```

## API Endpoints

### SSE Endpoint

```
GET /api/realtime/sse
```

Establishes an SSE connection for real-time updates.

### Polling Endpoint

```
GET /api/realtime/polling
```

Returns events since the last poll.

### Test Endpoint

```
POST /api/realtime/test
```

Sends a test event to connected clients.

### Monitor Endpoint

```
GET /api/realtime/monitor
```

Returns monitoring data for real-time connections.

## Configuration

### Environment Variables

```
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### Rate Limits

```typescript
const DEFAULT_LIMITS = {
  // Max 5 connections per user per minute
  USER_CONNECTIONS: { max: 5, window: 60 },
  // Max 10 connections per IP per minute
  IP_CONNECTIONS: { max: 10, window: 60 },
  // Max 100 events per user per minute
  USER_EVENTS: { max: 100, window: 60 },
  // Max 200 events per IP per minute
  IP_EVENTS: { max: 200, window: 60 },
};
```

## Monitoring

The monitoring dashboard provides:

- Connection statistics
- Event statistics
- Performance metrics
- Error tracking
- Instance information

## Best Practices

1. **Use the Hybrid Approach**: Always use the hybrid approach to ensure reliability across all browsers and network conditions.
2. **Handle Errors Gracefully**: Always handle errors gracefully and provide fallback mechanisms.
3. **Monitor Performance**: Regularly monitor performance metrics to ensure the system is working efficiently.
4. **Use Redis for Multi-Instance Deployments**: Use Redis for multi-instance deployments to ensure events are shared across instances.
5. **Implement Rate Limiting**: Implement rate limiting to prevent abuse of the SSE endpoints.

## Troubleshooting

### Common Issues

#### SSE Connection Fails

If the SSE connection fails, the system will automatically fall back to polling. Check the browser console for error messages.

#### Redis Connection Fails

If the Redis connection fails, the system will fall back to in-memory storage. Check the server logs for error messages.

#### Rate Limits Exceeded

If rate limits are exceeded, the system will return a 429 Too Many Requests response. Check the server logs for rate limit warnings.

## Future Improvements

1. **WebSocket Support**: Add WebSocket support for bidirectional communication.
2. **Persistent Storage**: Add persistent storage for events to support long-term event history.
3. **Advanced Monitoring**: Add more advanced monitoring features, such as alerting and anomaly detection.
4. **Client-Side Caching**: Add client-side caching to reduce server load.
5. **Compression**: Add compression to reduce bandwidth usage.

## Conclusion

The hybrid real-time architecture provides a reliable and efficient way to deliver real-time updates to clients. By combining SSE with polling, we ensure that all clients receive updates regardless of browser support or network conditions.
