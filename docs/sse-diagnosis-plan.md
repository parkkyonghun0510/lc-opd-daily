# SSE Diagnosis Plan

This document outlines strategies and procedures for diagnosing issues with the Server-Sent Events (SSE) implementation in our application.

## Common SSE Issues

Server-Sent Events (SSE) can encounter various issues that affect their reliability and performance. This guide provides a systematic approach to diagnosing and resolving these issues.

## Diagnostic Tools

### Browser Tools

1. **Browser Developer Tools**
   - Network tab: Filter by "EventSource" to see SSE connections
   - Console: Check for connection errors and event logging
   - Application tab: Monitor EventSource state

2. **Browser Extensions**
   - "SSE Client" extension for Chrome: Test SSE endpoints directly
   - "Network Panel Filter" to isolate SSE traffic

### Server Tools

1. **Logging**
   - Connection establishment logs
   - Event emission logs
   - Error logs with context

2. **Monitoring**
   - Connection count metrics
   - Message delivery metrics
   - Error rate metrics

3. **Debugging Tools**
   - Node.js debugger for server-side code
   - Request/response inspection middleware

## Connection Issues

### Symptoms
- Clients fail to establish SSE connections
- Frequent disconnections
- Connection timeouts

### Diagnostic Steps

1. **Verify Client Configuration**
   ```javascript
   // Check browser console for these issues
   const eventSource = new EventSource('/api/notifications/sse');
   
   eventSource.onerror = (error) => {
     console.error('SSE connection error:', error);
   };
   ```

2. **Check Server Logs**
   - Look for authentication failures
   - Check for connection establishment errors
   - Verify proper headers are being set

3. **Inspect Network Traffic**
   - Verify the request is reaching the server
   - Check response headers:
     ```
     Content-Type: text/event-stream
     Cache-Control: no-cache, no-transform
     Connection: keep-alive
     ```
   - Check for proper CORS headers if cross-origin

4. **Test with Curl**
   ```bash
   curl -N -H "Authorization: Bearer YOUR_TOKEN" https://your-api.com/api/notifications/sse
   ```

5. **Check Load Balancer Configuration**
   - Verify timeout settings (should be higher than default)
   - Check for proper handling of long-lived connections
   - Ensure sticky sessions are enabled if needed

### Common Solutions

1. **Increase Timeouts**
   - Adjust server timeout settings
   - Configure load balancer timeouts
   - Set proper keep-alive intervals

2. **Fix Authentication Issues**
   - Ensure session cookies are being sent
   - Verify token validation logic
   - Check for CORS issues with credentials

3. **Implement Reconnection Logic**
   ```javascript
   function setupEventSource() {
     const eventSource = new EventSource('/api/notifications/sse');
     
     eventSource.onerror = (error) => {
       console.error('SSE connection error:', error);
       eventSource.close();
       
       // Reconnect with exponential backoff
       setTimeout(() => {
         setupEventSource();
       }, calculateBackoff());
     };
     
     return eventSource;
   }
   ```

## Message Delivery Issues

### Symptoms
- Events not received by clients
- Delayed event delivery
- Inconsistent event delivery

### Diagnostic Steps

1. **Verify Event Emission**
   - Add logging to event emission code:
     ```typescript
     console.log(`Emitting event to user ${userId}:`, { event, data });
     ```
   - Check that events are being emitted when expected

2. **Check Client Event Listeners**
   ```javascript
   eventSource.addEventListener('notification', (event) => {
     console.log('Received notification:', JSON.parse(event.data));
   });
   
   // Also check for generic message events
   eventSource.onmessage = (event) => {
     console.log('Received message:', event.data);
   };
   ```

3. **Inspect Event Format**
   - Ensure events follow the correct format:
     ```
     event: notification
     data: {"id":"123","message":"New notification"}
     
     ```
   - Check for missing newlines or malformed JSON

4. **Monitor Connection State**
   ```javascript
   console.log('EventSource readyState:', eventSource.readyState);
   // 0 = connecting, 1 = open, 2 = closed
   ```

5. **Test with Simple Events**
   - Send a simple ping event to verify the connection works:
     ```typescript
     sseHandler.sendEventToUser(userId, 'ping', { timestamp: Date.now() });
     ```

### Common Solutions

1. **Fix Event Format**
   - Ensure proper event formatting with double newlines:
     ```typescript
     const eventString = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
     ```

2. **Implement Event Buffering**
   - Store events that couldn't be delivered
   - Resend on reconnection

3. **Add Event Acknowledgment**
   - Implement client-side acknowledgment via a separate API call
   - Track delivery status of important events

## Performance Issues

### Symptoms
- High server CPU usage
- Memory leaks
- Slow event delivery
- Server crashes under load

### Diagnostic Steps

1. **Monitor Resource Usage**
   - Track memory usage over time
   - Monitor CPU usage during peak loads
   - Check for connection count growth

2. **Analyze Connection Patterns**
   - Look for excessive connections from single users
   - Check for connection churn (frequent connect/disconnect)
   - Verify proper connection cleanup

3. **Profile Server Performance**
   - Use Node.js profiling tools
   - Identify bottlenecks in event processing
   - Check for blocking operations

4. **Test with Load Simulation**
   - Simulate multiple concurrent connections
   - Generate high volumes of events
   - Measure response times under load

### Common Solutions

1. **Implement Connection Limits**
   ```typescript
   // In SSE handler
   public addClient(userId: string): { stream: ReadableStream; clientId: string } {
     // Check existing connections for this user
     const userConnectionCount = this.getActiveConnectionsCountByUser(userId);
     
     if (userConnectionCount >= MAX_CONNECTIONS_PER_USER) {
       throw new Error(`Maximum connection limit reached for user ${userId}`);
     }
     
     // Continue with connection creation...
   }
   ```

2. **Optimize Event Processing**
   - Batch events when possible
   - Use efficient data structures
   - Implement event throttling for high-frequency updates

3. **Implement Memory Management**
   - Add periodic cleanup of stale connections
   - Monitor and limit total connection count
   - Implement proper error handling to prevent memory leaks

4. **Scale Horizontally**
   - Distribute SSE connections across multiple servers
   - Use Redis or similar for cross-instance communication
   - Implement proper load balancing

## Browser Compatibility Issues

### Symptoms
- Works in some browsers but not others
- Inconsistent behavior across devices
- Connection issues on mobile devices

### Diagnostic Steps

1. **Test Across Browsers**
   - Chrome, Firefox, Safari, Edge
   - Mobile browsers
   - Older browser versions

2. **Check for Polyfill Needs**
   - Verify if EventSource is natively supported
   - Check if polyfill is properly implemented

3. **Inspect Browser-Specific Behavior**
   - Connection timeout differences
   - Event parsing variations
   - Reconnection handling

### Common Solutions

1. **Add EventSource Polyfill**
   ```javascript
   // In client code
   import EventSourcePolyfill from 'eventsource-polyfill';
   
   const EventSourceClass = window.EventSource || EventSourcePolyfill;
   const eventSource = new EventSourceClass('/api/notifications/sse');
   ```

2. **Implement Fallback Mechanism**
   - Use polling as a fallback when SSE isn't supported
   - Detect support and switch mechanisms automatically

3. **Adjust for Browser Quirks**
   - Set different timeouts based on browser
   - Handle reconnection differently per browser
   - Test thoroughly on all target platforms

## Server-Side Issues

### Symptoms
- SSE connections work but events aren't triggered
- Worker process not sending events
- Events lost between systems

### Diagnostic Steps

1. **Verify Worker Integration**
   - Check that the notification worker is properly integrated with SSE
   - Verify event emission calls are being made

2. **Trace Event Flow**
   - Log each step of the event flow:
     1. Event generation
     2. Queue placement
     3. Worker processing
     4. SSE handler emission
     5. Client receipt

3. **Check for Race Conditions**
   - Verify events aren't being sent before connections are established
   - Check for timing issues in event processing

4. **Inspect Cross-Service Communication**
   - If using Redis or other services for SSE in a clustered environment
   - Verify proper message passing between instances

### Common Solutions

1. **Improve Error Handling**
   ```typescript
   try {
     await emitNotificationEvent(userId, notification);
   } catch (error) {
     console.error('Failed to emit SSE event:', error);
     // Implement retry or fallback mechanism
   }
   ```

2. **Add Event Queuing**
   - Queue events for users without active connections
   - Deliver queued events when users connect

3. **Implement Event Persistence**
   - Store important events that must be delivered
   - Implement delivery guarantees for critical notifications

4. **Add Comprehensive Logging**
   - Log the complete event lifecycle
   - Include correlation IDs to track events through the system

## Troubleshooting Checklist

Use this checklist to systematically diagnose SSE issues:

1. **Connection Establishment**
   - [ ] Verify authentication is working
   - [ ] Check proper headers are being set
   - [ ] Confirm network path is clear (firewalls, proxies)
   - [ ] Test with simple curl command

2. **Event Delivery**
   - [ ] Verify events are being emitted server-side
   - [ ] Check client event listeners are properly set up
   - [ ] Confirm event format is correct
   - [ ] Test with simple ping/pong events

3. **Performance**
   - [ ] Check connection counts
   - [ ] Monitor memory usage
   - [ ] Verify CPU usage is reasonable
   - [ ] Test with realistic load

4. **Browser Compatibility**
   - [ ] Test in all target browsers
   - [ ] Verify polyfill if needed
   - [ ] Check mobile behavior

5. **Integration**
   - [ ] Confirm notification worker is triggering events
   - [ ] Verify cross-service communication
   - [ ] Check for timing issues

## Diagnostic Logging

Implement these logging patterns for better diagnosis:

### Connection Logging

```typescript
// In SSE handler
public addClient(userId: string): { stream: ReadableStream; clientId: string } {
  const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  
  console.log(`[SSE] New connection: clientId=${clientId}, userId=${userId}, total=${this.clients.size + 1}`);
  
  // Create stream and add client...
  
  return { stream, clientId };
}

public removeClient(clientId: string): void {
  const client = this.clients.get(clientId);
  if (client) {
    console.log(`[SSE] Connection closed: clientId=${clientId}, userId=${client.userId}, total=${this.clients.size - 1}`);
    this.clients.delete(clientId);
  }
}
```

### Event Emission Logging

```typescript
public sendEventToUser(userId: string, event: string, data: any): void {
  const userClients = Array.from(this.clients.values())
    .filter(client => client.userId === userId);
  
  console.log(`[SSE] Sending event: event=${event}, userId=${userId}, recipients=${userClients.length}`);
  
  if (userClients.length === 0) {
    console.log(`[SSE] No active connections for userId=${userId}`);
    return;
  }
  
  // Send event to clients...
}
```

### Client-Side Logging

```javascript
const eventSource = new EventSource('/api/notifications/sse');

eventSource.addEventListener('connected', (event) => {
  console.log('[SSE] Connected:', JSON.parse(event.data));
});

eventSource.addEventListener('notification', (event) => {
  console.log('[SSE] Notification received:', JSON.parse(event.data));
});

eventSource.onerror = (error) => {
  console.error('[SSE] Connection error:', error);
};
```

## Monitoring Dashboard

Consider implementing a monitoring dashboard with these metrics:

1. **Connection Metrics**
   - Active connections (total and per user)
   - Connection rate (new connections per minute)
   - Disconnection rate
   - Connection duration distribution

2. **Event Metrics**
   - Events sent per minute
   - Events per connection
   - Event delivery success rate
   - Event processing time

3. **Resource Usage**
   - Memory usage
   - CPU usage
   - Network bandwidth

4. **Error Metrics**
   - Connection errors
   - Event delivery errors
   - Client-side errors

This dashboard will help identify patterns and issues in the SSE system.
