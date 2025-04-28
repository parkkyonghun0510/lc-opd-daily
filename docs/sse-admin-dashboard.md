# SSE Admin Dashboard

This document describes the SSE Admin Dashboard, a comprehensive monitoring and management interface for the Server-Sent Events (SSE) system in our application.

## Overview

The SSE Admin Dashboard provides real-time monitoring and management of SSE connections, events, errors, and performance. It allows administrators to:

- Monitor active connections and connection trends
- Track event types and volumes
- Identify and troubleshoot errors
- Monitor performance metrics
- Configure alerting thresholds
- Manage rate limiting
- Perform administrative actions

## Dashboard Components

### Overview Tab

The Overview tab provides a high-level summary of the SSE system:

- **Summary Cards**: Quick view of active connections, total events, total errors, and average processing time
- **Mini Charts**: Compact visualizations of connections and events
- **Recent Alerts**: List of the most recent alerts

### Connections Tab

The Connections tab provides detailed information about SSE connections:

- **Connection Metrics**: Chart showing total, active, peak, and unique user connections
- **User Connections Table**: Table showing connections per user, with local and global counts

### Events Tab

The Events tab provides detailed information about SSE events:

- **Event Metrics**: Chart showing event counts by type
- **Event Types Table**: Table showing event types, counts, and distribution

### Errors Tab

The Errors tab provides detailed information about SSE errors:

- **Error Metrics**: Pie chart showing error distribution by type
- **Error Types Table**: Table showing error types, counts, and percentages

### Performance Tab

The Performance tab provides detailed information about SSE performance:

- **Performance Metrics**: Gauge chart showing average event processing time
- **Performance Cards**: Cards showing average processing time, events processed, and last reset time

### Alerts Tab

The Alerts tab provides information about SSE alerts:

- **Alert List**: List of alerts, grouped by type
- **Alert Filtering**: Ability to filter alerts by text
- **Alert Actions**: Buttons to acknowledge or clear alerts

### Control Panel Tab

The Control Panel tab provides configuration options for the SSE system:

- **Alert Settings**: Configure alerting thresholds
- **Rate Limit Settings**: Configure rate limiting parameters
- **SSE Settings**: Configure SSE connection parameters
- **Admin Actions**: Perform administrative actions like resetting metrics or disconnecting clients

## API Endpoints

The dashboard uses the following API endpoints:

- `/api/admin/sse-monitor`: Get SSE connection statistics
- `/api/admin/sse-metrics`: Get detailed SSE metrics
- `/api/admin/sse-alerts`: Get SSE alerts

## Authentication and Authorization

The dashboard requires admin privileges to access. It checks the user's role from the session and only displays the dashboard if the user has the `ADMIN` or `SUPER_ADMIN` role.

## Auto-Refresh

The dashboard supports auto-refresh functionality, allowing administrators to see real-time updates without manually refreshing the page. The refresh interval can be configured from the dashboard.

## Customization

The dashboard is designed to be customizable:

- **Charts**: The charts can be replaced with more sophisticated charting libraries like Chart.js or D3.js
- **Themes**: The dashboard supports both light and dark themes
- **Layout**: The layout can be adjusted to fit different screen sizes

## Best Practices

When using the SSE Admin Dashboard, follow these best practices:

1. **Regular Monitoring**: Check the dashboard regularly to identify trends and potential issues

2. **Alert Configuration**: Configure alerts based on your application's specific needs and traffic patterns

3. **Performance Optimization**: Use the performance metrics to identify and address performance bottlenecks

4. **Security**: Ensure that only authorized administrators have access to the dashboard

5. **Documentation**: Document any changes made to the SSE configuration through the dashboard

## Conclusion

The SSE Admin Dashboard provides a comprehensive interface for monitoring and managing the SSE system. By using this dashboard, administrators can ensure the reliability, performance, and security of real-time features in the application.
