# Server-Sent Events (SSE) Implementation Guide

This document provides a comprehensive guide to the standardized Server-Sent Events (SSE) implementation in our application. It covers the architecture, components, best practices, and usage examples.

## Overview

Server-Sent Events (SSE) is a technology that allows a server to push updates to clients over a single HTTP connection. Our implementation provides a standardized way to use SSE across the application, with features like:

- Secure authentication
- Connection management
- Standardized event formatting
- Automatic reconnection
- Activity tracking and cleanup
- Monitoring and statistics

## Architecture

Our SSE implementation consists of the following components:

### 1. SSE Handler (`src/lib/sse/sseHandler.ts`)

The core of our SSE implementation is the `SSEHandler` class, which:

- Manages client connections
- Formats and sends events
- Tracks client activity
- Cleans up inactive connections
- Provides statistics and monitoring

### 2. SSE API Routes

We have standardized SSE endpoints:

- `/api/sse` - General-purpose SSE endpoint
- `/api/dashboard/sse` - Dashboard-specific SSE endpoint

### 3. Client-Side Hooks

- `useSSE` - General-purpose hook for SSE connections
- `useDashboardSSE` - Dashboard-specific SSE hook

## Server-Side Implementation

### SSE Handler

The `SSEHandler` is a singleton that manages all SSE connections:

```typescript
// src/lib/sse/sseHandler.ts
class SSEHandler {
  private clients: Map<string, Client> = new Map();
  
  // Add a client connection
  addClient(id: string, userId: string, response: any, metadata?: Record<string, any>) {
    // Implementation...
  }
  
  // Remove a client connection
  removeClient(id: string) {
    // Implementation...
  }
  
  // Send an event to a specific user
  sendEventToUser(userId: string, eventType: string, data: any) {
    // Implementation...
  }
  
  // Broadcast an event to all clients
  broadcastEvent(eventType: string, data: any) {
    // Implementation...
  }
  
  // Get statistics about current connections
  getStats() {
    // Implementation...
  }
}
```

### SSE API Routes

Our SSE API routes follow a standardized pattern:

```typescript
// src/app/api/sse/route.ts
export async function GET(req: NextRequest) {
  // 1. Authenticate the user
  // 2. Create a ReadableStream
  // 3. Register the client with the SSE handler
  // 4. Set up ping interval
  // 5. Handle connection close
  // 6. Return the stream with appropriate headers
}
```

## Client-Side Implementation

### useSSE Hook

The `useSSE` hook provides a standardized way to connect to SSE endpoints:

```typescript
// src/hooks/useSSE.ts
export function useSSE(options: SSEOptions = {}) {
  // 1. Set up state and refs
  // 2. Connect to the SSE endpoint
  // 3. Handle events
  // 4. Handle reconnection
  // 5. Clean up on unmount
  
  return {
    isConnected,
    error,
    lastEvent,
    reconnect,
    closeConnection
  };
}
```

## Event Format

All SSE events follow a standardized format:

```
event: eventType
data: {"key": "value", ...}
```

Common event types include:

- `connected` - Sent when a client connects
- `notification` - Sent when a notification is created
- `dashboardUpdate` - Sent when dashboard data changes
- `ping` - Sent periodically to keep the connection alive

## Usage Examples

### Server-Side: Sending Events

```typescript
// Send an event to a specific user
sseHandler.sendEventToUser(
  userId,
  'notification',
  {
    id: 'notification-123',
    type: 'REPORT_APPROVED',
    title: 'Report Approved',
    body: 'Your report has been approved',
    timestamp: Date.now()
  }
);

// Broadcast an event to all clients
sseHandler.broadcastEvent(
  'systemUpdate',
  {
    message: 'System maintenance in 10 minutes',
    timestamp: Date.now()
  }
);
```

### Client-Side: Connecting to SSE

```tsx
// Component using SSE
function NotificationListener() {
  const { lastEvent, isConnected, error } = useSSE({
    eventHandlers: {
      notification: (data) => {
        toast({
          title: data.title,
          description: data.body,
          status: 'info'
        });
      }
    }
  });
  
  return (
    <div>
      {isConnected ? 'Connected' : 'Disconnected'}
      {error && <div>Error: {error}</div>}
    </div>
  );
}
```

## Best Practices

1. **Authentication**: Always authenticate users before establishing an SSE connection.

2. **Event Types**: Use consistent event types across the application.

3. **Error Handling**: Implement proper error handling and reconnection logic.

4. **Connection Management**: Clean up connections when they're no longer needed.

5. **Monitoring**: Monitor connection counts and message throughput.

6. **Scaling**: For multi-instance deployments, consider using Redis or another shared storage for client tracking.

## Troubleshooting

### Connection Issues

- Check if the client is authenticated
- Verify that the SSE endpoint is accessible
- Check for network issues or proxies that might be blocking the connection

### Event Delivery Issues

- Check if the client is connected
- Verify that the event is being sent with the correct format
- Check for errors in the event handler

### Performance Issues

- Monitor the number of connections
- Consider implementing rate limiting
- Optimize event payload size

## Monitoring

The SSE handler provides statistics that can be used for monitoring:

```typescript
const stats = sseHandler.getStats();
console.log(`Total connections: ${stats.totalConnections}`);
console.log(`Unique users: ${stats.uniqueUsers}`);
```

## Conclusion

This standardized SSE implementation provides a robust foundation for real-time features in our application. By following these guidelines, we can ensure consistent, reliable, and maintainable real-time communication.
