# Environment Variables Validation Guide

This guide provides comprehensive information about the environment variable validation system implemented in the LC OPD Daily Reports application.

## Overview

The application includes a robust environment validation system that checks all required configuration during:
- Application startup (client-side)
- Build/deployment process (server-side)
- Runtime operation

## Required Environment Variables

### Dragonfly/Redis Queue Configuration

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| `DRAGONFLY_URL` | Dragonfly Redis connection URL | Yes | - | `redis://localhost:6379` |
| `REDIS_URL` | Alternative Redis connection URL | No | - | `redis://localhost:6379` |
| `DRAGONFLY_QUEUE_NAME` | Queue name for notifications | No | `notifications` | `lc-notifications` |
| `DRAGONFLY_QUEUE_URL` | Custom queue endpoint | No | - | `http://localhost:6379` |

*`DRAGONFLY_URL` must be set for queue functionality.

### VAPID Push Notification Configuration

| Variable | Description | Required | Format |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key for browser push | Yes | Base64URL string |
| `VAPID_PRIVATE_KEY` | VAPID private key for server-side push | Yes | Base64URL string |
| `VAPID_CONTACT_EMAIL` | Contact email for VAPID notifications | Yes | Valid email address |

## Validation Features

### 1. Runtime Validation (Client-Side)

The application validates environment variables during startup with user-friendly feedback:

- **Loading Screen**: Shows initialization progress
- **Error Screen**: Displays detailed error messages for missing/invalid variables
- **Warning Screen**: Shows non-critical configuration issues
- **Retry Mechanism**: Allows users to retry validation after fixing issues

### 2. Build-Time Validation (Server-Side)

Validation scripts run during build/deployment:

```bash
# Validate environment before build
npm run validate:env

# Build with validation
npm run validate:build

# Production validation
npm run validate:production
```

### 3. Validation Checks

#### URL Format Validation
- Ensures Redis/Dragonfly URLs are properly formatted
- Validates protocol (redis:// or rediss://)
- Checks for required host and port

#### Email Format Validation
- Validates VAPID contact email format
- Ensures proper email structure

#### Key Format Validation
- Validates VAPID key Base64URL encoding
- Checks key length requirements
- Ensures proper character set

#### Connection Testing
- Tests actual Redis/Dragonfly connectivity
- Validates authentication
- Checks service availability

## Getting Started

### 1. Generate VAPID Keys

```bash
# Generate VAPID keys for push notifications
npx web-push generate-vapid-keys

# Output will be:
# Public Key: BIXzZ5D9f5Y8... (use for NEXT_PUBLIC_VAPID_PUBLIC_KEY)
# Private Key: 4mXG9k8mZ8f... (use for VAPID_PRIVATE_KEY)
```

### 2. Create Environment File

```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env
```

### 3. Validate Configuration

```bash
# Test validation
npm run validate:env

# Test with production settings
NODE_ENV=production npm run validate:env
```

## Common Issues & Solutions

### Dragonfly/Redis Connection Issues

**Error**: `Redis connection failed`
- **Solution**: Ensure Dragonfly/Redis is running and accessible
- **Check**: Verify the URL format: `redis://host:port`
- **Test**: Use `redis-cli -h host -p port ping`

### VAPID Key Issues

**Error**: `Invalid VAPID key format`
- **Solution**: Regenerate keys using `npx web-push generate-vapid-keys`
- **Check**: Ensure keys are complete Base64URL strings
- **Note**: Keys should be ~43 characters long

### Missing Environment Variables

**Error**: `Missing required environment variable`
- **Solution**: Add the variable to your `.env` file
- **Check**: Ensure the file is loaded (restart your development server)

### Email Format Issues

**Error**: `Invalid email format for VAPID_CONTACT_EMAIL`
- **Solution**: Use a valid email address format
- **Example**: `admin@yourdomain.com`

## Integration with Deployment

### Railway Deployment

The validation automatically runs during Railway deployment:

1. Environment variables are loaded from Railway dashboard
2. Validation script checks all required variables
3. Build fails gracefully with clear error messages
4. Deployment continues if validation passes

### Docker Deployment

Include validation in your Dockerfile:

```dockerfile
# Validate environment before starting
RUN npm run validate:env

# Or use as health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD npm run validate:env || exit 1
```

## Monitoring & Debugging

### Environment Status API

Access environment validation status via API:

```javascript
// In your application
import { ApplicationInitializer } from '@/lib/initializer';

const initializer = ApplicationInitializer.getInstance();
const result = await initializer.initialize();
console.log('Environment Status:', result);
```

### Console Output

The validation system provides detailed console output:

```
🔍 Environment Variables Validation Summary
==================================================
✅ DRAGONFLY_URL is configured
✅ NEXT_PUBLIC_VAPID_PUBLIC_KEY is configured
✅ VAPID_PRIVATE_KEY is configured
✅ VAPID_CONTACT_EMAIL is configured

📊 Service Status:
   Environment: ✅ Valid
   Redis/Dragonfly: ✅ Connected
   Dragonfly Queue: ✅ Ready
   VAPID Push: ✅ Configured

==================================================
```

## Best Practices

1. **Always validate before deployment**:
   ```bash
   npm run validate:build
   ```

2. **Use environment-specific validation**:
   ```bash
   # Development
   npm run validate:env
   
   # Production
   NODE_ENV=production npm run validate:production
   ```

3. **Monitor validation warnings**:
   - Review warnings during startup
   - Address non-critical issues promptly
   - Document any intentional deviations

4. **Secure sensitive variables**:
   - Never commit `.env` files to version control
   - Use environment-specific configurations
   - Rotate keys regularly

## Support

For issues with environment validation:

1. Check the validation output for specific error messages
2. Verify your `.env` file syntax
3. Test individual components using the validation scripts
4. Review this guide for common solutions
5. Check application logs for detailed error information

## Related Documentation

- [Dragonfly Integration Guide](./DRAGONFLY_INTEGRATION.md)
- [Deployment Guide](./README.md#deployment)
- [Environment Variables Reference](./.env.example)