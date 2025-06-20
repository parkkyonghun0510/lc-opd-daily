# Zustand Realtime Implementation

This document describes the enhanced implementation of real-time updates using Zustand for state management.

## Overview

We've implemented a robust hybrid real-time update system that uses Server-Sent Events (SSE) with a polling fallback. This system is integrated with Zustand for state management, providing a centralized, reactive, and type-safe way to handle real-time updates.

## Components

### 1. Zustand Store Slices

- **HybridRealtimeSlice**: Manages the state and logic for real-time connections, including SSE and polling.
- **SSESlice**: Provides basic SSE functionality.

### 2. Custom Hooks

- **useHybridRealtime**: A hook that provides access to the hybrid realtime functionality from the Zustand store.
- **useSSE**: A hook that provides access to the SSE functionality from the Zustand store.

### 3. Provider Components

- **HybridRealtimeProvider**: A generic provider component that initializes the hybrid realtime connection.
- **ZustandHybridRealtimeProvider**: A dashboard-specific provider that integrates with the dashboard store.

## Features

- **Type Safety**: Comprehensive TypeScript types for all components and APIs.
- **Connection Methods**: Supports SSE, polling, and automatic fallback.
- **Reconnection Strategy**: Exponential backoff with configurable parameters.
- **Event Caching**: Persistent caching of events in localStorage.
- **Network Awareness**: Automatic reconnection on network status changes.
- **Performance Optimizations**: Memoization and selective updates.
- **Debug Mode**: Comprehensive logging for development.
- **Toast Notifications**: Configurable toast notifications for events.

## Usage

### Basic Usage

```tsx
import { useHybridRealtime } from "@/hooks/useHybridRealtime";

function MyComponent() {
  const {
    isConnected,
    activeMethod,
    connectionStatus,
    lastEvent,
    error,
    reconnect,
    getCachedEvents,
    getTimeSinceLastEvent,
  } = useHybridRealtime({
    eventHandlers: {
      notification: (data) => {
        console.log("Received notification:", data);
      },
      dashboardUpdate: (data) => {
        console.log("Dashboard updated:", data);
      },
      // Wildcard handler for all events
      "*": (event) => {
        console.log(`Received ${event.type} event:`, event);
      },
    },
    preferredMethod: "auto",
    pollingInterval: 15000,
    maxReconnectAttempts: 10,
    reconnectBackoffFactor: 1.5,
    enableCache: true,
    debug: true,
  });

  // Get cached events
  const notifications = getCachedEvents("notification");

  // Get time since last event
  const secondsSinceLastEvent = Math.round(getTimeSinceLastEvent() / 1000);

  return (
    <div>
      <p>Connection status: {connectionStatus}</p>
      <p>Active method: {activeMethod || "none"}</p>
      <p>
        Last event:{" "}
        {lastEvent ? new Date(lastEvent.timestamp).toLocaleString() : "None"}
      </p>
      <p>Cached notifications: {notifications.length}</p>
      <p>
        Time since last event:{" "}
        {secondsSinceLastEvent === Infinity
          ? "N/A"
          : `${secondsSinceLastEvent}s`}
      </p>
      <button onClick={reconnect}>Reconnect</button>
    </div>
  );
}
```

### Using the Provider

```tsx
import { HybridRealtimeProvider } from "@/components/providers/HybridRealtimeProvider";

function App({ children }) {
  return (
    <HybridRealtimeProvider
      options={{
        preferredMethod: "auto",
        pollingInterval: 15000,
        maxReconnectAttempts: 10,
        reconnectBackoffFactor: 1.5,
        enableCache: true,
      }}
      onEvent={(eventType, data) => {
        console.log(`Received ${eventType} event:`, data);
      }}
      showToasts={true}
      autoReconnect={true}
      debug={process.env.NODE_ENV === "development"}
    >
      {children}
    </HybridRealtimeProvider>
  );
}
```

### Dashboard-Specific Provider

```tsx
import { ZustandHybridRealtimeProvider } from "@/components/dashboard/ZustandHybridRealtimeProvider";

function DashboardLayout({ children }) {
  return (
    <ZustandHybridRealtimeProvider
      autoRefreshInterval={10000}
      showToasts={true}
      debug={process.env.NODE_ENV === "development"}
    >
      {children}
    </ZustandHybridRealtimeProvider>
  );
}
```

## Architecture

### State Management

The real-time functionality is implemented as a Zustand store slice, which provides:

1. **State**: Connection status, active method, last event, error, cached events, etc.
2. **Actions**: Connect, disconnect, reconnect, process events, cache events, etc.
3. **Selectors**: Helper functions to derive additional state, such as time since last event.

### Connection Methods

1. **SSE**: The primary method for real-time updates, using the EventSource API.
2. **Polling**: A fallback method that periodically fetches updates from the server.
3. **Auto**: Automatically tries SSE first, then falls back to polling if SSE is not supported.

### Event Handling

Events are processed through a central event handler that:

1. Updates the last event state.
2. Calls the appropriate event handler from the options.
3. Caches events for offline access.
4. Dispatches DOM events for components to listen for.

### Reconnection Strategy

The reconnection strategy uses exponential backoff with configurable parameters:

1. **maxReconnectAttempts**: Maximum number of reconnection attempts.
2. **reconnectBackoffFactor**: Factor by which to increase the delay between attempts.
3. **maxReconnectDelay**: Maximum delay between reconnection attempts.

### Event Caching

Events are cached in both memory and localStorage:

1. **In-Memory Cache**: Stores events in a Map for quick access.
2. **LocalStorage Cache**: Persists events across page reloads.
3. **Cache Size Limit**: Configurable maximum number of events to cache.
4. **Cache TTL**: Configurable time-to-live for cached events.

## Benefits of Zustand Integration

1. **Centralized State**: All real-time state is managed in one place.
2. **Reactive Updates**: Components automatically re-render when the state changes.
3. **Persistence**: State can be persisted across page reloads.
4. **DevTools Integration**: Easy debugging with Redux DevTools.
5. **Middleware Support**: Logging, performance tracking, etc.
6. **Type Safety**: Comprehensive TypeScript types for all components and APIs.
7. **Performance**: Optimized for performance with memoization and selective updates.

## Server-Side Implementation

The server-side implementation includes:

1. **SSE Endpoint**: `/api/realtime/sse` - Provides a stream of events.
2. **Polling Endpoint**: `/api/realtime/polling` - Provides a snapshot of events since a given timestamp.
3. **Event Emitters**: Server-side code that emits events to connected clients.
4. **Authentication**: Secure authentication for real-time connections.
5. **Rate Limiting**: Protection against excessive connection attempts.

## Migration from React State

This implementation replaces the previous approach that used React state and refs. The main differences are:

1. **State Management**: Zustand instead of React useState and useRef.
2. **Connection Lifecycle**: Managed by the store instead of component effects.
3. **Event Handling**: Centralized in the store instead of component callbacks.
4. **Type Safety**: Comprehensive TypeScript types for all components and APIs.
5. **Performance**: Optimized for performance with memoization and selective updates.

The API remains largely the same for backward compatibility, but with additional features and improvements.
