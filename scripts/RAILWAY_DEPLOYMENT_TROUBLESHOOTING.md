# Railway Deployment Troubleshooting Guide

This guide helps you understand and resolve common warnings and errors during Railway deployment.

## Common Warnings and Their Solutions

### 1. Redis Connection Warnings
```
[RealtimeMonitor] Redis URL not found. Using in-memory monitoring only.
[RateLimiter] Redis URL not found. Rate limiting will be disabled.
```

**Solution:**
- Set Redis environment variables in Railway dashboard:
  - `DRAGONFLY_HOST=<your-redis-host>`
  - `DRAGONFLY_PORT=<your-redis-port>`
  - `DRAGONFLY_USER=<your-redis-user>`
  - `DRAGONFLY_PASSWORD=<your-redis-password>`
- Or accept in-memory fallback for development/testing

### 2. VAPID Keys Warning
```
VAPID keys not set
VAPID keys not configured. Push notifications will not work.
```

**Solution:**
- Set PWA push notification keys in Railway dashboard:
  - `VAPID_PUBLIC_KEY=<your-vapid-public-key>`
  - `VAPID_PRIVATE_KEY=<your-vapid-private-key>`
- Or disable push notifications in your PWA configuration

### 3. Build Trace Copy Errors
```
⚠ Failed to copy traced files for /app/.next/server/app/(dashboard)/page.js
[Error: ENOENT: no such file or directory, copyfile ...]
```

**Solution:**
- Ensure `output: "standalone"` is set in `next.config.cjs`
- Run `npm run build` locally to verify build works
- Clear `.next` directory and rebuild if issues persist
- Check that all required dependencies are installed

### 4. Health Check Authentication Issues
```
ERR_FAILED
This site can't be reached
Webpage might be temporarily down
```

**Solution:**
- Ensure `/api/health` is excluded from authentication middleware
- Add health endpoints to middleware exclusions:
  ```typescript
  path === "/api/health" ||
  path.startsWith("/api/health/") ||
  ```
- Update middleware matcher to exclude health endpoints
- Run validation: `npm run validate:health`

### 5. Redis Subscriber Mode Errors
```
❌ Error warming charts cache: Error: Connection in subscriber mode, only subscriber commands may be used
❌ Error warming stats cache: Error: Connection in subscriber mode, only subscriber commands may be used
```

**Solution:**
- This indicates mixing cache and pub/sub operations on same Redis connection
- Ensure separate connections are used:
  - `getRedis()` for cache operations (SET, GET, DEL)
  - `getRedisPubSub()` for pub/sub operations (SUBSCRIBE, PUBLISH)
- Run diagnostic: `npm run diagnose:redis`
- Test connections: `npm run test:redis`

### 6. SSE Handler Initialization
```
[SSE] Simple SSE handler initialized
```

**This is normal** - Server-Sent Events are working correctly.

## Pre-Deployment Validation

Run the validation script before deploying:

```bash
node scripts/railway-deployment-validation.cjs
```

This script checks:
- ✅ PM2 configuration files
- ✅ Docker configuration
- ✅ Railway deployment settings
- ✅ Next.js build configuration
- ✅ PWA and service worker setup
- ✅ Redis fallback handling
- ✅ Environment variable requirements

## Deployment Checklist

### Before Deploying:
1. ✅ Run validation script
2. ✅ Test build locally: `npm run build`
3. ✅ Commit all changes
4. ✅ Set required environment variables in Railway

### Required Environment Variables:
- `NODE_ENV=production`
- `DATABASE_URL=<your-database-url>`
- `NEXTAUTH_SECRET=<your-secret>`
- `NEXTAUTH_URL=<your-app-url>`

### Optional (to avoid warnings):
- `DRAGONFLY_HOST`, `DRAGONFLY_PORT`, `DRAGONFLY_USER`, `DRAGONFLY_PASSWORD`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### After Deploying:
1. ✅ Monitor deployment logs
2. ✅ Check health endpoint: `/api/health`
3. ✅ Verify core functionality
4. ✅ Test PWA features (if enabled)

## Monitoring Deployment Logs

### Good Signs:
- ✅ "All critical deployment checks passed!"
- ✅ PM2 processes starting successfully
- ✅ Database connections established
- ✅ Health check endpoint responding

### Warning Signs (but not critical):
- ⚠️ "Redis URL not found" (fallback working)
- ⚠️ "VAPID keys not set" (push notifications disabled)
- ⚠️ "Using in-memory monitoring" (acceptable for small apps)

### Error Signs (need fixing):
- ❌ "Failed to copy traced files" (rebuild needed)
- ❌ "Cannot find module" (dependency issues)
- ❌ "Database connection failed" (check DATABASE_URL)
- ❌ "Port already in use" (PM2 configuration issue)

## Quick Fixes

### Rebuild Application:
```bash
# Clear build cache
rm -rf .next

# Reinstall dependencies
npm ci

# Rebuild
npm run build

# Validate
node scripts/railway-deployment-validation.cjs
```

### Reset PM2 (if needed):
```bash
# Stop all processes
pm2 stop all

# Delete all processes
pm2 delete all

# Start fresh
pm2 start ecosystem.production.config.cjs
```

## Getting Help

If issues persist:
1. Check Railway deployment logs
2. Run validation script for specific guidance
3. Verify all environment variables are set correctly
4. Test build process locally first
5. Check this troubleshooting guide for common solutions