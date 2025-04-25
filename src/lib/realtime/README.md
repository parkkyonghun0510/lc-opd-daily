# Hybrid Real-time Updates

This module provides a hybrid approach for real-time updates, combining Server-Sent Events (SSE) with traditional polling to ensure reliable updates across all browsers and network conditions.

## Overview

The hybrid approach uses:

1. **Server-Sent Events (SSE)** as the primary method for real-time updates
2. **Polling** as a fallback when SSE is not supported or fails
3. **In-memory event storage** to ensure events can be retrieved via polling

This approach provides the best balance of real-time performance and reliability.

## Components

### Server-Side Components

- **Event Emitter (`eventEmitter.ts`)**: In-memory store for events with methods to emit and retrieve events
- **SSE Handler (`sseHandler.ts`)**: Manages SSE client connections and sends events to connected clients
- **API Endpoints**:
  - `/api/realtime/sse`: SSE endpoint for real-time updates
  - `/api/realtime/polling`: Polling endpoint for fallback
  - `/api/realtime/test`: Test endpoint to send events

### Client-Side Components

- **Hybrid Realtime Hook (`useHybridRealtime.ts`)**: Combines SSE and polling in a single hook
- **Dashboard Realtime Hook (`useDashboardRealtime.ts`)**: Specialized hook for dashboard updates

## Usage

### Server-Side Usage

```typescript
// Import the event emitter
import { eventEmitter, emitNotification, emitDashboardUpdate } from '@/lib/realtime/eventEmitter';

// Emit a general event
eventEmitter.emit('customEvent', { message: 'Hello, world!' });

// Emit a notification to specific users
emitNotification(
  'New Message',
  'You have a new message',
  { userIds: ['user-123', 'user-456'] }
);

// Emit a dashboard update to all users
emitDashboardUpdate('STATS_UPDATED', {
  totalUsers: 100,
  totalReports: 250
});
```

### Client-Side Usage

```tsx
// Basic usage with the hybrid hook
import { useHybridRealtime } from '@/hooks/useHybridRealtime';

function MyComponent() {
  const {
    isConnected,
    activeMethod,
    lastEvent,
    error,
    reconnect
  } = useHybridRealtime({
    eventHandlers: {
      notification: (data) => {
        console.log('Received notification:', data);
      },
      customEvent: (data) => {
        console.log('Received custom event:', data);
      }
    }
  });

  return (
    <div>
      <p>Connection status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <p>Method: {activeMethod || 'None'}</p>
      <button onClick={reconnect}>Reconnect</button>
    </div>
  );
}
```

```tsx
// Dashboard-specific usage
import { useHybridDashboard } from '@/contexts/HybridDashboardContext';

function DashboardComponent() {
  const {
    dashboardData,
    isLoading,
    isConnected,
    connectionMethod,
    refreshDashboardData
  } = useHybridDashboard();

  return (
    <div>
      <p>Connection: {isConnected ? 'Connected' : 'Disconnected'} ({connectionMethod})</p>
      <button onClick={refreshDashboardData}>Refresh</button>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <pre>{JSON.stringify(dashboardData, null, 2)}</pre>
      )}
    </div>
  );
}
```

## Benefits

1. **Reliability**: Multiple fallback mechanisms ensure updates reach clients
2. **Compatibility**: Works across all browsers and network conditions
3. **Simplicity**: Simpler implementation with fewer edge cases
4. **Performance**: Uses the most efficient method available for each client
5. **Stability**: Less likely to break with a simpler approach

## Future Improvements

- Add Redis or another persistence layer for events to support multi-instance deployments
- Add monitoring and logging to track performance and reliability
- Add WebSocket support for bidirectional communication
- Add authentication and authorization for event subscriptions
