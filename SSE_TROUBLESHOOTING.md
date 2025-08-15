# SSE Connection Troubleshooting Guide

## Overview
This guide provides comprehensive troubleshooting steps for diagnosing and resolving Server-Sent Events (SSE) connection issues in the report updates system.

## Error Types and Solutions

### 1. Connection Refused / 404 Not Found
**Symptoms:**
- Browser console shows `GET /api/reports/updates 404 (Not Found)`
- EventSource fails to connect immediately

**Solutions:**
- ✅ **Fixed**: The `/api/reports/updates` endpoint has been created
- Verify endpoint accessibility: `curl -I http://localhost:3000/api/reports/updates`
- Check if the server is running and accessible

### 2. Authentication Errors (401 Unauthorized)
**Symptoms:**
- Browser shows `401 Unauthorized` responses
- Missing or invalid authentication tokens

**Solutions:**
- Ensure user is logged in and has valid session
- Check browser cookies for authentication tokens
- Verify CORS settings if running from different domain
- Test with credentials: `curl -H "Cookie: your-auth-cookie" http://localhost:3000/api/reports/updates`

### 3. Rate Limiting (429 Too Many Requests)
**Symptoms:**
- `429 Too Many Requests` responses
- Connection throttling after multiple attempts

**Solutions:**
- Wait 60 seconds before retrying (automatic retry in the hook)
- Check if multiple browser tabs are open
- Reduce connection frequency in development

### 4. Browser Compatibility Issues
**Symptoms:**
- `EventSource is not defined` error
- No connection attempts visible in Network tab

**Solutions:**
- Use modern browsers (Chrome 6+, Firefox 6+, Safari 5+, Edge 12+)
- Check for browser extensions blocking connections
- Verify HTTPS requirements for secure contexts

### 5. Network/Proxy Issues
**Symptoms:**
- Connection timeouts
- Intermittent disconnections

**Solutions:**
- Check firewall settings
- Verify proxy configurations
- Ensure WebSocket/SSE support in reverse proxies (Nginx, Apache)
- Test with direct connection bypassing proxy

### 6. Web Worker Issues
**Symptoms:**
- Real-time updates are delayed or not received
- Unexpected behavior in the browser console related to workers

**Solutions:**
- **Check Worker Registration**: Ensure the `reports.worker.ts` and `notificationWorker.ts` are correctly registered and running.
- **Monitor Worker Performance**: Use browser developer tools to inspect the web workers and check for errors or performance bottlenecks.
- **Review Worker Logs**: Check the browser console for any logs or errors originating from the web workers.

## Diagnostic Tools

### Browser Developer Tools
1. **Network Tab**: Monitor `/api/reports/updates` requests
2. **Console Tab**: Check for JavaScript errors
3. **Application Tab**: Verify authentication cookies

### Manual Testing
```bash
# Test endpoint accessibility
curl -N -H "Accept: text/event-stream" http://localhost:3000/api/reports/updates

# Test with authentication
curl -N -H "Accept: text/event-stream" -H "Cookie: next-auth.session-token=your-token" http://localhost:3000/api/reports/updates
```

### JavaScript Console Testing
```javascript
// Test basic connectivity
const es = new EventSource('/api/reports/updates');
es.onopen = () => console.log('Connected');
es.onerror = (e) => console.error('Error:', e);
es.onmessage = (e) => console.log('Message:', e.data);

// Test specific event types
es.addEventListener('report-update', (e) => {
  console.log('Report update:', JSON.parse(e.data));
});
```

## Configuration Checklist

### Server Configuration
- [ ] `/api/reports/updates` route exists and is accessible
- [ ] Authentication middleware is properly configured
- [ ] Rate limiting is not overly restrictive
- [ ] CORS settings allow the connection

### Client Configuration
- [ ] Browser supports EventSource
- [ ] Authentication tokens are present
- [ ] No ad blockers or security extensions interfering
- [ ] HTTPS/SSL certificates are valid (if using HTTPS)

### Network Configuration
- [ ] Server is accessible from client location
- [ ] Firewalls allow SSE connections
- [ ] Reverse proxy (Nginx/Apache) is configured for SSE
- [ ] No corporate VPN/proxy blocking connections

## Common Error Messages and Solutions

### "Failed to construct 'EventSource': Invalid URL"
- **Cause**: Invalid endpoint URL
- **Solution**: Verify the endpoint URL is correct: `/api/reports/updates`

### "NetworkError when attempting to fetch resource"
- **Cause**: Network connectivity or CORS issues
- **Solution**: Check network connectivity and CORS headers

### "401 Unauthorized"
- **Cause**: Missing or invalid authentication
- **Solution**: Ensure user is logged in and has valid session

### "429 Too Many Requests"
- **Cause**: Rate limiting triggered
- **Solution**: Wait for cooldown period or adjust rate limits

## Monitoring and Debugging

### Real-time Diagnostics
Use the provided `ReportSSEDiagnostics` component:
```tsx
import { ReportSSEDiagnostics } from '@/components/debug/ReportSSEDiagnostics';

// Add to your component
<ReportSSEDiagnostics />
```

### Log Analysis
Check server logs for:
- Authentication failures
- Rate limiting events
- Connection errors
- Performance metrics

### Performance Monitoring
Monitor these metrics:
- Connection success rate
- Average connection time
- Error frequency
- User connection distribution

## Advanced Troubleshooting

### Custom Headers
For debugging, you can add custom headers:
```javascript
// Note: EventSource doesn't support custom headers
// Use fetch-based SSE or WebSocket for custom headers
```

### Connection Pooling
Monitor concurrent connections:
- Each user is limited to 3 connections
- Global rate limits apply per IP/user

### Error Recovery
The system implements exponential backoff:
- Initial retry: 1 second
- Maximum retry: 30 seconds
- Maximum attempts: 5

## Getting Help

If issues persist after following this guide:

1. **Check the diagnostic component** for real-time status
2. **Review browser console** for detailed error messages
3. **Test with minimal reproduction** using the provided curl commands
4. **Check server logs** for authentication and rate limiting information
5. **Verify network configuration** with your system administrator

## Quick Fix Summary

For immediate resolution:
1. ✅ **Endpoint Created**: `/api/reports/updates` now exists
2. **Check Authentication**: Ensure user is logged in
3. **Check Browser Support**: Use modern browser
4. **Check Network**: Verify connectivity to server
5. **Use Diagnostic Tool**: Add `<ReportSSEDiagnostics />` to your page

The enhanced logging and diagnostic tools should provide clear visibility into any remaining connection issues.