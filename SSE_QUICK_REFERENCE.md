# SSE Quick Reference Guide

## 🚀 Quick Start

### 1. Basic Client Setup

```typescript
import { useHybridRealtimeV2 } from '@/hooks/useHybridRealtimeV2';

function MyComponent() {
  const connection = useHybridRealtimeV2({
    debug: true,
    eventHandlers: {
      notification: (data) => toast(data.title, { description: data.message }),
      '*': (event) => console.log('Event:', event.type)
    }
  });
  
  return (
    <div>
      Status: {connection.connectionStatus} ({connection.activeMethod})
      {connection.error && <div>Error: {connection.error}</div>}
    </div>
  );
}
```

### 2. Send Events (Server-side)

```typescript
import sseHandler from '@/lib/sse/sseHandler';
import { SSEEventBuilder } from '@/lib/sse/eventTypes';

// Send to specific user
sseHandler.sendEventToUser('user-123', 'notification', {
  title: 'New Message',
  message: 'You have a new message'
});

// Broadcast to all
sseHandler.broadcastEvent('system-alert', {
  type: 'maintenance',
  message: 'System maintenance in 5 minutes'
});

// Send standardized event
const event = SSEEventBuilder.createNotificationEvent({
  title: 'Alert',
  message: 'Important notification',
  type: 'warning'
}, ['user-123']);
```

### 3. Test Events

```bash
# Send test notification
curl -X POST http://localhost:3000/api/realtime/test \\n  -H \"Content-Type: application/json\" \\n  -d '{
    \"type\": \"notification\",
    \"data\": {\"title\": \"Test\", \"message\": \"Hello World\"},
    \"target\": \"broadcast\"
  }'
```

## 📋 Common Use Cases

### Real-time Notifications

```typescript
// Client
const { isConnected } = useHybridRealtimeV2({
  eventHandlers: {
    notification: (data) => {
      toast(data.title, {
        description: data.message,
        action: data.url ? {
          label: 'View',
          onClick: () => window.open(data.url)
        } : undefined
      });
    }
  }
});

// Server
import { MemoryEventStoreUtils } from '@/lib/realtime/memoryEventStore';

MemoryEventStoreUtils.addEvent('notification', {
  title: 'New Comment',
  message: 'Someone commented on your post',
  url: '/posts/123'
}, ['user-456']);
```

### Dashboard Updates

```typescript
// Client
const [dashboardData, setDashboardData] = useState(null);

useHybridRealtimeV2({
  eventHandlers: {
    dashboardUpdate: (data) => {
      setDashboardData(prev => ({ ...prev, ...data }));
    }
  }
});

// Server
sseHandler.broadcastEvent('dashboardUpdate', {
  totalUsers: 150,
  totalReports: 300,
  growth: 5.2
});
```

### System Alerts

```typescript
// Client
useHybridRealtimeV2({
  eventHandlers: {
    systemAlert: (data) => {
      if (data.severity === 'critical') {
        toast.error(data.title, {
          description: data.message,
          duration: Infinity
        });
      }
    }
  }
});

// Server
const alertEvent = SSEEventBuilder.createSystemAlertEvent({
  alertType: 'maintenance',
  severity: 'high',
  title: 'Scheduled Maintenance',
  message: 'System will be down for maintenance at 2 AM',
  startTime: '2024-01-15T02:00:00Z',
  endTime: '2024-01-15T04:00:00Z'
});
```

## 🔧 Debugging

### Debug Interface
Visit `/debug/sse` for comprehensive debugging tools.

### Health Check
```bash
curl http://localhost:3000/api/sse/health?details=true
```

### Connection Test
```bash
# Test SSE connection
curl -N -H \"Accept: text/event-stream\" \\n  http://localhost:3000/api/sse?userId=test

# Test polling
curl http://localhost:3000/api/realtime/polling?since=0
```

### Common Debug Steps

1. **Check Authentication**
   ```typescript
   import { getSSEToken } from '@/lib/sse/sseAuth';
   const token = await getSSEToken();
   console.log('Token:', token);
   ```

2. **Monitor Connection**
   ```typescript
   const connection = useHybridRealtimeV2({ debug: true });
   console.log('Status:', connection.connectionStatus);
   console.log('Method:', connection.activeMethod);
   console.log('Failures:', connection.sseFailureCount, connection.pollingFailureCount);
   ```

3. **Check Health**
   ```typescript
   import { sseErrorHandler } from '@/lib/sse/errorHandler';
   const health = sseErrorHandler.getHealthStatus();
   console.log('Health:', health.overall);
   ```

## ⚡ Performance Tips

### Client-side
- Use specific event handlers instead of catch-all
- Implement proper cleanup in useEffect
- Use debouncing for frequent events
- Consider using Zustand store for global state

### Server-side
- Filter events by user/role when possible
- Use appropriate event priorities
- Monitor connection counts
- Implement proper error handling

## 🚨 Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| No events received | Connection OK but silent | Check event targeting, use broadcast test |
| 401 Unauthorized | Connection fails immediately | Verify authentication, check session/token |
| High memory usage | Server memory grows | Check cleanup intervals, connection limits |
| Connection drops | Frequent reconnections | Check network stability, rate limits |
| Polling not working | No fallback when SSE fails | Verify polling endpoint, check Redis/memory store |

## 📚 API Reference

### Key Hooks

```typescript
// Primary hook (recommended)
useHybridRealtimeV2(options: HybridRealtimeOptions)

// Zustand store slice
useHybridRealtimeSlice()

// Legacy hook (deprecated)
useHybridRealtime(options)
```

### Key Utilities

```typescript
// Event creation
SSEEventBuilder.createEvent(type, data, options)
SSEEventBuilder.createNotificationEvent(notification, targetUsers)
SSEEventBuilder.createSystemAlertEvent(alert)

// Error handling
SSEErrorUtils.createConnectionError(message, context, error)
SSEErrorUtils.recover(error)

// Memory store
MemoryEventStoreUtils.addEvent(type, data, targetUsers, targetRoles)
MemoryEventStoreUtils.getFormattedEventsForUser(userId, since, userRole)
```

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sse` | GET | Main SSE connection |
| `/api/realtime/polling` | GET | Polling fallback |
| `/api/realtime/test` | POST | Send test events |
| `/api/sse/health` | GET | System health |
| `/api/auth/sse-token` | GET | Get auth token |

---

💡 **Pro Tip**: Start with the debug interface at `/debug/sse` to understand the system and test your events before implementing in your application.

📖 **Full Documentation**: See `SSE_ARCHITECTURE_GUIDE.md` for complete implementation details."