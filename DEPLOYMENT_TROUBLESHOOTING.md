# Deployment Troubleshooting Guide

## Overview
This guide provides solutions for common deployment issues, including Redis connection errors and server action mismatches.

## Redis Connection Issues

### Error: "Stream isn't writeable and enableOfflineQueue option is disabled"

**Cause**: This occurs when Redis operations are attempted before the connection is ready or when the connection is lost.

**Solutions**:
1. **Connection State Checks**: All Redis operations now include connection state validation
2. **Health Monitoring**: Use the RedisHealthChecker utility for safe operations
3. **Graceful Degradation**: Systems fall back to in-memory mode when Redis is unavailable

**Implementation**:
```typescript
import { isRedisReady, safeRedisOperation } from '@/lib/redis/health-check';

// Safe Redis operation example
await safeRedisOperation(redisClient, (client) => {
  return client.set('key', 'value');
}, 'fallback-value');
```

### Error: "Redis connection failed" or DNS resolution errors

**Cause**: Incorrect Redis URL configuration or network connectivity issues.

**Solutions**:
1. Verify environment variables:
   - `DRAGONFLY_URL=redis://username:password@host:port`
   - `REDIS_URL=redis://username:password@host:port`
2. Check DNS resolution with:
   ```bash
   nslookup your-redis-host
   ping your-redis-host
   ```
3. Test Redis connection:
   ```bash
   redis-cli -u redis://your-redis-url ping
   ```

## Server Action Errors

### Error: "Server Action not found" or "incompatible deployment version"

**Cause**: Next.js deployment version mismatch or stale server action references.

**Solutions**:

1. **Clear Build Cache**:
   ```bash
   rm -rf .next
   npm run build
   ```

2. **Update Dependencies**:
   ```bash
   npm update next
   npm run build
   ```

3. **Check Server Action Files**:
   - Ensure all server actions have `"use server"` directive
   - Verify file paths haven't changed
   - Check for circular dependencies

4. **Redeploy with Fresh Build**:
   ```bash
   # For Railway/Vercel
   git commit --allow-empty -m "Force redeploy"
   git push
   ```

## Environment Variables Checklist

### Required Variables
```bash
# Database
DATABASE_URL="postgresql://..."

# Redis/Dragonfly
DRAGONFLY_URL="redis://..."

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret"

# VAPID Keys (for push notifications)
VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
```

### Optional Variables
```bash
# Rate Limiting
RATE_LIMIT_ENABLED=true

# Monitoring
REDIS_MONITORING=true
```

## Health Check Endpoints

### Application Health
```bash
curl https://your-domain.com/api/health
```

### Redis Health
```bash
curl https://your-domain.com/api/admin/redis-health
```

### Server Actions Test
```bash
curl -X POST https://your-domain.com/api/test-server-action
```

## Debugging Commands

### Check Redis Connection
```bash
# Test from application directory
node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.DRAGONFLY_URL);
redis.ping().then(() => console.log('Redis OK')).catch(console.error);
"
```

### Check Server Actions
```bash
# List all server actions
find . -name "*.ts" -o -name "*.tsx" | xargs grep -l "use server"
```

### Build Verification
```bash
# Test build locally
npm run build
npm start
```

## Common Solutions Summary

1. **Redis Issues**: Use connection state checks before all Redis operations
2. **Server Actions**: Clear cache and rebuild
3. **Environment**: Verify all required environment variables
4. **Network**: Check DNS and firewall settings
5. **Dependencies**: Ensure compatible Next.js version

## Monitoring Setup

Add to your monitoring system:
- Redis connection health checks
- Server action availability checks
- Build status notifications
- Error rate monitoring

## Support

If issues persist:
1. Check application logs for detailed error messages
2. Verify deployment platform-specific requirements
3. Review Next.js deployment documentation
4. Test with minimal configuration first