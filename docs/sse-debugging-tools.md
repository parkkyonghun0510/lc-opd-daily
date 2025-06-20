# SSE Debugging Tools

This document describes the client-side debugging tools for Server-Sent Events (SSE) in our application.

## SSE Debugger

The SSE Debugger is a client-side tool that helps developers debug SSE connections. It provides a user interface for:

- Connecting to SSE endpoints
- Viewing events in real-time
- Sending test events
- Monitoring connection status

### Features

#### Connection Management

The debugger allows you to:

- Connect to any SSE endpoint
- Specify a user ID and optional token
- Disconnect and reconnect
- Monitor connection status

#### Event Logging

The debugger logs all events received from the SSE connection, including:

- Event type
- Event data
- Timestamp
- Connection status changes
- Errors

The event log supports:

- Auto-scrolling
- Clearing the log
- Color-coding by event type

#### Test Event Sender

The debugger includes a tool for sending test events:

- Select an event type
- Specify a target user ID
- Enter event data in JSON format
- Send the event

#### Connection Information

The debugger displays information about the SSE connection:

- Browser support for SSE
- Last event received
- Connection status

### Usage

To use the SSE Debugger:

1. Navigate to `/debug/sse` in your application
2. Enter the SSE endpoint URL (e.g., `/api/sse`)
3. Enter a user ID
4. Enter an optional token
5. Click "Connect"

Once connected, you'll see events in the event log as they are received.

### Example

```tsx
// Connect to a specific endpoint with a user ID
<SSEDebugger
  endpoint="/api/sse"
  userId="user-123"
/>

// Connect to a specific endpoint with a user ID and token
<SSEDebugger
  endpoint="/api/sse"
  userId="user-123"
  token="jwt-token"
/>
```

## Load Testing Script

In addition to the SSE Debugger, we've created a load testing script for SSE connections. This script helps you test the performance and reliability of your SSE implementation under load.

### Features

- Simulate multiple concurrent connections
- Measure connection times and event latencies
- Track events by type
- Generate performance metrics
- Support for ramp-up periods

### Usage

To use the load testing script:

```bash
node sse-load-test.js --connections=100 --duration=60 --url=http://localhost:3000/api/sse
```

Options:

- `--connections`: Number of concurrent connections (default: 100)
- `--duration`: Test duration in seconds (default: 60)
- `--url`: SSE endpoint URL (default: http://localhost:3000/api/sse)
- `--token`: Authentication token (optional)
- `--interval`: Reporting interval in seconds (default: 5)
- `--ramp-up`: Ramp-up period in seconds (default: 10)

### Metrics

The load testing script reports the following metrics:

- Active connections
- Total connections
- Successful connections
- Failed connections
- Connection success rate
- Average connection time
- Total events received
- Events per second
- Average event latency
- Events by type
- Errors
- Percentile metrics (P95, P99)

## Best Practices

When using these debugging tools, follow these best practices:

1. **Development Environment**: Use these tools in development or staging environments, not in production

2. **Authentication**: Be careful with authentication tokens and user IDs

3. **Load Testing**: Start with a small number of connections and gradually increase

4. **Performance Monitoring**: Monitor server performance during load testing

5. **Error Analysis**: Pay attention to errors and latency spikes

## Conclusion

These debugging tools provide valuable insights into the behavior and performance of your SSE implementation. By using these tools, you can identify and fix issues, optimize performance, and ensure the reliability of your real-time features.
