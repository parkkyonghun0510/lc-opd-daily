# Server-Sent Events (SSE) Testing Guide

This guide provides instructions for testing the Server-Sent Events (SSE) functionality before integrating it into your real files.

## Overview

The test setup includes:

1. **Simple SSE Server** (`test-sse-server.js`): A basic Node.js server that demonstrates SSE functionality
2. **Advanced SSE Server** (`advanced-sse-server.js`): A more comprehensive server that mimics your production SSE architecture
3. **SSE Client** (`test-sse-client.html`): A browser client for testing SSE connections
4. **Integration Test** (`test-sse-integration.js`): A script to test various SSE scenarios

## Getting Started

### Option 1: Simple SSE Server

This is a basic implementation to understand the core concepts of SSE.

```bash
# Start the simple SSE server
node test-sse-server.js
```

Then open your browser to http://localhost:3001 to see the client interface.

### Option 2: Advanced SSE Server (Recommended)

This implementation is closer to your production architecture and includes more features.

```bash
# Start the advanced SSE server
node advanced-sse-server.js
```

Then open your browser to http://localhost:3001 to see the advanced client interface.

### Running Integration Tests

After starting the advanced server and opening the client in your browser:

```bash
# Run the integration test script
node test-sse-integration.js
```

This will simulate various events and you can observe them in the browser client.

## Testing Features

### 1. Connection Management

- Connect and disconnect from the SSE server
- Test automatic reconnection by stopping and restarting the server
- Observe connection statistics

### 2. Event Types

Test different event types:

- **Notifications**: Personal messages for users
- **Dashboard Updates**: Real-time dashboard data changes
- **System Alerts**: System-wide announcements
- **Ping**: Connection keep-alive messages

### 3. User Targeting

- Send events to specific users
- Broadcast events to all connected clients

### 4. Error Handling

- Test connection errors and reconnection
- Observe error reporting in the client

## Integration with Your Codebase

After testing, you can integrate SSE into your real files by:

1. Implementing the SSE handler based on `src/lib/sse/sseHandler.ts`
2. Creating API routes for SSE endpoints
3. Implementing client-side hooks for connecting to SSE
4. Adding event emitters in your business logic

## Key Files in Your Codebase

Based on the documentation, these are the key files for SSE implementation:

- `src/lib/sse/sseHandler.ts`: Core SSE handler
- `src/app/api/sse/route.ts`: Main SSE endpoint
- `src/app/api/dashboard/sse/route.ts`: Dashboard-specific SSE endpoint
- `src/hooks/useSSE.ts`: Client-side hook for SSE connections

## Next Steps

1. Review the implementation guide in `docs/sse-implementation-guide.md`
2. Test the SSE functionality using this test setup
3. Implement SSE in your real files following the architecture in the guide
4. Add monitoring and error handling for production use

## Troubleshooting

### Connection Issues

- Check if the server is running
- Verify that the client is connecting to the correct endpoint
- Check for network issues or proxies that might be blocking the connection

### Event Delivery Issues

- Check if the client is connected
- Verify that the event is being sent with the correct format
- Check for errors in the event handler

### Performance Issues

- Monitor the number of connections
- Consider implementing rate limiting
- Optimize event payload size
