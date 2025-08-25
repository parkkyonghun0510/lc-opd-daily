# SSE Architecture Guide - Enhanced Implementation

## 🚀 Overview

This document describes the enhanced Server-Sent Events (SSE) architecture that provides robust, scalable, and reliable real-time communication for the lc-opd-daily application.

### Key Improvements

- ✅ **Multi-layer Authentication**: Session, JWT tokens, and Bearer tokens
- ✅ **Enhanced Connection Management**: State tracking, automatic cleanup, health monitoring
- ✅ **Standardized Event Format**: Consistent message structure with priorities and metadata
- ✅ **Hybrid Fallback System**: Automatic SSE to polling fallback
- ✅ **Comprehensive Error Handling**: Recovery mechanisms and health monitoring
- ✅ **Advanced Testing Tools**: Real-time debugging and testing interface
- ✅ **Memory Store Fallback**: In-memory event storage when Redis is unavailable

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication System](#authentication-system)
3. [Event Format](#event-format)
4. [Connection Management](#connection-management)
5. [Error Handling](#error-handling)
6. [API Endpoints](#api-endpoints)
7. [Client Usage](#client-usage)
8. [Testing & Debugging](#testing--debugging)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

## 🏗️ Architecture Overview

```mermaid
graph TB
    Client[\"🖥️ Client Application\"]
    Auth[\"🔐 Authentication Layer\"]
    SSE[\"📡 SSE Handler\"]
    Memory[\"💾 Memory Store\"]
    Redis[\"🗄️ Redis Store\"]
    Health[\"🏥 Health Monitor\"]
    Error[\"⚠️ Error Handler\"]
    
    Client -->|\"1. Authenticate\"| Auth
    Auth -->|\"2. Connect\"| SSE
    SSE -->|\"3. Store Events\"| Memory
    SSE -->|\"3. Store Events\"| Redis
    SSE -->|\"4. Monitor\"| Health
    SSE -->|\"5. Handle Errors\"| Error
    
    Error -->|\"6. Recovery\"| SSE
    Health -->|\"7. Diagnostics\"| Client
```

### Core Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **SSE Handler** | Connection management, event distribution | `src/lib/sse/sseHandler.ts` |
| **Event Types** | Standardized event formats and utilities | `src/lib/sse/eventTypes.ts` |
| **Error Handler** | Error tracking, recovery, health monitoring | `src/lib/sse/errorHandler.ts` |
| **Auth System** | Multi-method authentication | `src/lib/sse/sseAuth.ts` |
| **Hybrid Hook** | Client-side connection management | `src/hooks/useHybridRealtimeV2.ts` |
| **Memory Store** | Fallback event storage | `src/lib/realtime/memoryEventStore.ts` |

## 🔐 Authentication System

### Authentication Methods (Priority Order)

1. **Session-based** (Most Secure)
   - Uses NextAuth.js session
   - Automatic for authenticated users
   - No additional setup required

2. **JWT Token** (Secure)
   - Generated via `/api/auth/sse-token`
   - 1-hour expiration with automatic refresh
   - Includes user metadata and permissions

3. **Bearer Token** (API Clients)
   - Authorization header support
   - For programmatic access
   - Same JWT format as method 2

4. **Parameter-based** (Development Only)
   - userId query parameter
   - Only available in development mode
   - Should not be used in production

### Usage Examples

#### Getting an SSE Token

```typescript
import { getSSEToken } from '@/lib/sse/sseAuth';

// Client-side token retrieval
const tokenData = await getSSEToken();
if (tokenData) {
  const { token, expiresAt } = tokenData;
  // Use token for SSE connection
}
```

#### Server-side Authentication

```typescript
import { authenticateSSERequest } from '@/lib/sse/sseAuth';

const auth = await authenticateSSERequest(request);
if (auth.authenticated) {
  const { userId, method, userRole } = auth;
  // Proceed with authenticated user
}
```

## 📨 Event Format

### Standardized Event Structure

```typescript
interface SSEEvent<T = any> {
  id: string;                    // Unique event identifier
  type: SSEEventType | string;   // Event type
  timestamp: number;             // Unix timestamp
  priority: SSEEventPriority;    // Event priority level
  source: string;                // Event source (server, worker, etc.)
  version: string;               // Event format version
  data: T;                       // Event payload
  metadata?: {                   // Optional metadata
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    userIds?: string[];          // Target users
    roles?: string[];            // Target roles
    [key: string]: any;
  };
}
```

### Event Types

```typescript
export enum SSEEventType {
  // Connection events
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  PING = 'ping',
  ERROR = 'error',
  
  // Application events
  NOTIFICATION = 'notification',
  DASHBOARD_UPDATE = 'dashboardUpdate',
  REPORT_UPDATE = 'reportUpdate',
  USER_UPDATE = 'userUpdate',
  SYSTEM_ALERT = 'systemAlert'
}
```

### Priority Levels

```typescript
export enum SSEEventPriority {
  LOW = 'low',        // Background updates
  NORMAL = 'normal',  // Standard events
  HIGH = 'high',      // Important notifications
  CRITICAL = 'critical' // Emergency alerts
}
```

### Creating Events

```typescript
import { SSEEventBuilder } from '@/lib/sse/eventTypes';

// Create a notification event
const notificationEvent = SSEEventBuilder.createNotificationEvent({
  title: 'New Message',
  message: 'You have a new message',
  type: 'info',
  persistent: false
}, ['user-123', 'user-456']);

// Create a custom event
const customEvent = SSEEventBuilder.createEvent(
  'custom-event',
  { message: 'Custom data' },
  {
    priority: SSEEventPriority.HIGH,
    source: 'custom-service',
    metadata: { userIds: ['user-123'] }
  }
);
```

## 🔗 Connection Management

### Connection States

| State | Description | Actions Available |
|-------|-------------|------------------|
| `connecting` | Initial connection attempt | Wait, Cancel |
| `connected` | Active connection | Send events, Ping |
| `idle` | No recent activity | Send events, Health check |
| `stale` | Connection issues detected | Reconnect, Disconnect |
| `disconnecting` | Graceful shutdown | Wait |

### Server-Side Connection Management

```typescript
import sseHandler from '@/lib/sse/sseHandler';

// Get connection statistics
const stats = sseHandler.getStats();
console.log('Active connections:', stats.totalConnections);
console.log('Connection states:', stats.connectionStates);

// Send health check to all connections
const healthCheckSent = sseHandler.sendHealthCheck();

// Get specific client information
const clientInfo = sseHandler.getClientInfo('client-id');

// Force disconnect a problematic client
sseHandler.forceDisconnect('client-id', 'Admin action');
```

### Client-Side Connection Management

```typescript
import { useHybridRealtimeV2 } from '@/hooks/useHybridRealtimeV2';

function MyComponent() {
  const connection = useHybridRealtimeV2({
    debug: true,
    enableTokenAuth: true,
    maxReconnectAttempts: 5,
    eventHandlers: {
      notification: (data) => {
        showNotification(data.title, data.message);
      },
      '*': (event) => {
        console.log('Received event:', event.type);
      }
    }
  });
  
  return (
    <div>
      <div>Status: {connection.connectionStatus}</div>
      <div>Method: {connection.activeMethod}</div>
      <div>Failures: SSE={connection.sseFailureCount}, Polling={connection.pollingFailureCount}</div>
      
      <button onClick={connection.reconnect}>Reconnect</button>
      <button onClick={connection.disconnect}>Disconnect</button>
      <button onClick={connection.forceSSE}>Force SSE</button>
      <button onClick={connection.forcePolling}>Force Polling</button>
    </div>
  );
}
```

## ⚠️ Error Handling

### Error Categories

| Category | Description | Recovery Strategy |
|----------|-------------|------------------|
| `CONNECTION` | Network/connection issues | Retry with backoff |
| `AUTHENTICATION` | Auth failures | Request new token |
| `RATE_LIMIT` | Too many requests | Fallback to polling |
| `SERVER` | Server-side errors | Restart connection |
| `CLIENT` | Client-side issues | None (manual fix) |
| `VALIDATION` | Data validation errors | None (fix data) |
| `TIMEOUT` | Request timeouts | Retry |

### Error Handling Example

```typescript
import { sseErrorHandler, SSEErrorUtils } from '@/lib/sse/errorHandler';

// Create and handle an error
try {
  // Some SSE operation
} catch (error) {
  const sseError = SSEErrorUtils.createConnectionError(
    'Failed to establish connection',
    { userId: 'user-123', endpoint: '/api/sse' },
    error
  );
  
  // Attempt automatic recovery
  const recovery = await SSEErrorUtils.recover(sseError);
  if (recovery.success) {
    console.log('Recovery successful:', recovery.message);
  } else {
    console.error('Recovery failed:', recovery.message);
  }
}

// Get system health
const health = sseErrorHandler.getHealthStatus();
console.log('Overall health:', health.overall);
console.log('Error rate:', health.metrics.errorRate);
```

## 🌐 API Endpoints

### Core SSE Endpoints

| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|---------------|
| `/api/sse` | GET | Main SSE connection | Required |
| `/api/auth/sse-token` | GET | Get authentication token | Session |
| `/api/realtime/sse` | GET | Alternative SSE endpoint | Required |
| `/api/realtime/polling` | GET | Polling fallback | Required |
| `/api/sse/health` | GET | Health monitoring | Optional admin |

### Testing & Admin Endpoints

| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|---------------|
| `/api/realtime/test` | POST | Send test events | Required |
| `/api/sse/health` | POST | Admin health actions | Admin only |
| `/api/realtime/monitor` | GET | Connection monitoring | Admin only |

### SSE Connection

```bash
# Basic connection
curl -N -H \"Accept: text/event-stream\" \\n  -H \"Cookie: next-auth.session-token=...\" \\n  \"http://localhost:3000/api/sse\"

# With token authentication
curl -N -H \"Accept: text/event-stream\" \\n  \"http://localhost:3000/api/sse?token=eyJ...\"

# With Bearer token
curl -N -H \"Accept: text/event-stream\" \\n  -H \"Authorization: Bearer eyJ...\" \\n  \"http://localhost:3000/api/sse\"
```

### Polling Fallback

```bash
# Get events since timestamp
curl -H \"Cookie: next-auth.session-token=...\" \\n  \"http://localhost:3000/api/realtime/polling?since=1672531200000&limit=20\"

# Filter by event types
curl -H \"Cookie: next-auth.session-token=...\" \\n  \"http://localhost:3000/api/realtime/polling?types=notification,alert\"
```

### Send Test Event

```bash
curl -X POST \\n  -H \"Content-Type: application/json\" \\n  -H \"Cookie: next-auth.session-token=...\" \\n  -d '{
    \"type\": \"notification\",
    \"message\": \"Test notification\",
    \"data\": {\"title\": \"Test\", \"body\": \"This is a test\"},
    \"target\": \"user\",
    \"targetValue\": \"user-123\"
  }' \\n  \"http://localhost:3000/api/realtime/test\"
```

### Health Check

```bash
# Basic health status
curl -H \"Cookie: next-auth.session-token=...\" \\n  \"http://localhost:3000/api/sse/health\"

# Detailed health (admin only)
curl -H \"Cookie: next-auth.session-token=...\" \\n  \"http://localhost:3000/api/sse/health?details=true\"
```

## 💻 Client Usage

### React Hook Usage

```typescript
import { useHybridRealtimeV2 } from '@/hooks/useHybridRealtimeV2';
import { toast } from 'sonner';

function NotificationComponent() {
  const { 
    isConnected, 
    connectionStatus, 
    activeMethod, 
    lastEvent,
    error,
    reconnect 
  } = useHybridRealtimeV2({
    debug: true,
    enableTokenAuth: true,
    retryOnError: true,
    maxReconnectAttempts: 5,
    eventHandlers: {
      // Handle notifications
      notification: (data) => {
        toast(data.title, {
          description: data.message,
          action: data.url ? {
            label: 'View',
            onClick: () => window.open(data.url, '_blank')
          } : undefined
        });
      },
      
      // Handle dashboard updates
      dashboardUpdate: (data) => {
        // Update dashboard state
        updateDashboard(data);
      },
      
      // Handle system alerts
      systemAlert: (data) => {
        if (data.severity === 'critical') {
          toast.error(data.title, {
            description: data.message,
            duration: Infinity // Don't auto-dismiss critical alerts
          });
        }
      },
      
      // Catch-all handler
      '*': (event) => {
        console.log('Received event:', event.type, event.data);
      }
    }
  });
  
  return (
    <div className=\"notification-status\">
      <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
        {connectionStatus} via {activeMethod}
      </div>
      
      {error && (
        <div className=\"error-message\">
          {error}
          <button onClick={reconnect}>Retry</button>
        </div>
      )}
      
      {lastEvent && (
        <div className=\"last-event\">
          Last: {lastEvent.type} at {new Date(lastEvent.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
```

### Zustand Store Integration

```typescript
import { useHybridRealtimeSlice } from '@/auth/store/slices/hybridRealtimeSlice';

function useNotificationStore() {
  const { 
    connect, 
    disconnect, 
    isConnected, 
    activeMethod,
    addEventHandler,
    removeEventHandler 
  } = useHybridRealtimeSlice();
  
  useEffect(() => {
    // Add notification handler
    const unsubscribe = addEventHandler('notification', (data) => {
      // Handle notification
    });
    
    // Connect
    connect();
    
    return () => {
      unsubscribe();
      disconnect();
    };
  }, []);
  
  return { isConnected, activeMethod };
}
```

### Manual SSE Connection

```typescript
import { SSEClient } from '@/lib/sse/sseClient';

function createSSEConnection() {
  const client = new SSEClient({
    endpoint: '/api/sse',
    userId: 'user-123',
    clientType: 'dashboard',
    debug: true,
    autoReconnect: true,
    maxReconnectAttempts: 5,
    eventHandlers: {
      notification: (data) => console.log('Notification:', data),
      ping: (data) => console.log('Ping:', data.timestamp),
      connected: (data) => console.log('Connected:', data.clientId)
    }
  });
  
  // Connect
  client.connect();
  
  // Get status
  console.log('Status:', client.getStatus());
  
  // Disconnect when done
  // client.disconnect();
  
  return client;
}
```

## 🧪 Testing & Debugging

### SSE Debugger Interface

Access the SSE debugger at `/debug/sse` for comprehensive testing:

- **Connection Management**: Connect/disconnect, view status
- **Event Testing**: Send custom events with different targets
- **Health Monitoring**: Real-time system health and metrics
- **Debug Logs**: Detailed connection and event logs

### Testing Events

```typescript
// Send test notification
fetch('/api/realtime/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'notification',
    data: {
      title: 'Test Notification',
      message: 'This is a test notification',
      type: 'info'
    },
    target: 'broadcast'
  })
});

// Send targeted event
fetch('/api/realtime/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'dashboard-update',
    data: { stats: { users: 100, reports: 250 } },
    target: 'role',
    targetValue: 'ADMIN'
  })
});
```

### Health Monitoring

```typescript
// Check system health
const health = await fetch('/api/sse/health?details=true')
  .then(r => r.json());

console.log('Overall status:', health.status);
console.log('Connections:', health.connections.total);
console.log('Error rate:', health.errorRate);
console.log('Component health:', health.components);

// Admin actions (admin users only)
fetch('/api/sse/health', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'health_check' // Send health check to all clients
  })
});
```

## 🚀 Deployment

### Environment Variables

```bash
# Required
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=https://your-domain.com

# Optional SSE Configuration
SSE_JWT_SECRET=your-sse-secret  # Defaults to NEXTAUTH_SECRET
DRAGONFLY_URL=redis://...       # For Redis-backed events
REDIS_URL=redis://...           # Fallback Redis URL

# Optional Rate Limiting
RATE_LIMIT_REDIS_URL=redis://... # For distributed rate limiting
```

### Production Considerations

1. **Load Balancing**
   - Use sticky sessions for SSE connections
   - Configure proper WebSocket/SSE support
   - Consider using Redis for cross-instance communication

2. **Monitoring**
   - Monitor connection counts and error rates
   - Set up alerts for high error rates
   - Track memory usage for event stores

3. **Security**
   - Use HTTPS in production
   - Implement proper CORS policies
   - Validate and sanitize all event data
   - Monitor for authentication bypass attempts

4. **Performance**
   - Configure appropriate connection limits
   - Use Redis for event storage in multi-instance deployments
   - Implement proper cleanup intervals
   - Monitor memory usage

### Docker Deployment

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build

EXPOSE 3000
CMD [\"npm\", \"start\"]
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # SSE specific
        proxy_buffering off;
        proxy_read_timeout 24h;
        proxy_send_timeout 24h;
    }
}
```

## 🔧 Troubleshooting

### Common Issues

#### 1. SSE Connection Fails

**Symptoms**: Connection immediately drops, 401 errors

**Solutions**:
- Check authentication (session or token)
- Verify CORS settings
- Check rate limiting
- Review server logs for specific errors

```bash
# Check connection
curl -v -N -H \"Accept: text/event-stream\" \\n  \"http://localhost:3000/api/sse?userId=test\"
```

#### 2. Events Not Received

**Symptoms**: Connection established but no events received

**Solutions**:
- Verify event targeting (user IDs, roles)
- Check event handlers are properly registered
- Test with broadcast events first
- Review debug logs

```typescript
// Test broadcast event
fetch('/api/realtime/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'test',
    data: { message: 'Test' },
    target: 'broadcast'
  })
});
```

#### 3. High Memory Usage

**Symptoms**: Server memory increases over time

**Solutions**:
- Check event store cleanup intervals
- Verify connection cleanup is working
- Monitor for connection leaks
- Adjust event retention settings

```typescript
// Check memory store stats
const stats = memoryEventStore.getStats();
console.log('Event count:', stats.totalEvents);
console.log('Memory usage:', process.memoryUsage());
```

#### 4. Polling Fallback Not Working

**Symptoms**: No events received when SSE fails

**Solutions**:
- Verify polling endpoint is accessible
- Check authentication for polling requests
- Review event storage (Redis/memory)
- Test polling endpoint directly

```bash
# Test polling directly
curl -H \"Cookie: session=...\" \\n  \"http://localhost:3000/api/realtime/polling?since=0&limit=10\"
```

### Debug Checklist

- [ ] Check authentication method and validity
- [ ] Verify endpoint accessibility and CORS
- [ ] Test with SSE debugger interface
- [ ] Review server logs for errors
- [ ] Check rate limiting settings
- [ ] Verify event targeting configuration
- [ ] Test with simple broadcast events
- [ ] Monitor connection health and cleanup
- [ ] Check memory and Redis connectivity
- [ ] Verify environment variables

### Performance Optimization

1. **Connection Management**
   - Set appropriate cleanup intervals
   - Limit maximum connections per user
   - Monitor connection states

2. **Event Optimization**
   - Use appropriate event priorities
   - Implement event filtering
   - Optimize event data size

3. **Storage Optimization**
   - Configure Redis for production
   - Set appropriate event retention
   - Monitor memory usage

---

## 📞 Support

For additional support:

1. Check the [troubleshooting section](#troubleshooting)
2. Use the SSE debugger at `/debug/sse`
3. Review server logs and health endpoints
4. Test with the provided API endpoints

---

*This documentation covers the enhanced SSE implementation. For legacy compatibility, some older endpoints and methods are still supported but not recommended for new development.*"