# Railway Deployment Fix for Dragonfly Worker

## Issue Summary
PM2 error: `Script not found: /app/dist/workers/dragonfly-worker.js` on Railway deployment.

## Root Cause Analysis
The issue was caused by:
1. **Missing COPY instruction** in Dockerfile - the workers directory wasn't being copied to the production image
2. **Build process gap** - the production build wasn't ensuring workers were compiled
3. **File path verification** - no verification step to confirm all required files exist

## Solution Implemented

### 1. Updated Dockerfile
- Added explicit COPY instructions for workers and lib directories
- Added verification step to ensure dragonfly-worker.js exists in the container

### 2. Updated Build Process
- Modified `build:production` script to include worker compilation
- Ensures `dragonfly-worker.js` is built before Docker image creation

### 3. Created Deployment Verification
- Added `scripts/fix-deployment.js` for pre-deployment verification
- Validates all required files exist and are readable

## Deployment Steps

### Immediate Fix
1. **Rebuild the application**:
   ```bash
   npm run build:production
   ```

2. **Verify the fix**:
   ```bash
   node scripts/fix-deployment.js
   ```

3. **Commit and push** the changes to trigger Railway deployment

### Verification Commands
After deployment, verify the fix:

```bash
# Check if the worker file exists in the container
railway run ls -la /app/dist/workers/

# Check PM2 status
railway run pm2 status

# Check worker logs
railway run pm2 logs notification-worker
```

## Files Modified

1. **Dockerfile**: Added COPY instructions for workers and lib directories
2. **package.json**: Updated `build:production` to include worker compilation
3. **scripts/fix-deployment.js**: New verification script

## Environment Variables Required
Ensure these are set in Railway:
- `DRAGONFLY_URL`: Your Dragonfly Redis connection URL
- `DRAGONFLY_QUEUE_NAME`: Queue name (e.g., "notifications")
- `DRAGONFLY_QUEUE_URL`: Full queue URL
- `DATABASE_URL`: PostgreSQL connection string
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: Web push public key
- `VAPID_PRIVATE_KEY`: Web push private key
- `VAPID_CONTACT_EMAIL`: Contact email for web push

## Monitoring
After deployment, monitor:
1. Railway deployment logs
2. PM2 process status
3. Worker logs for successful Dragonfly connection
4. Queue processing activity

## Rollback Plan
If issues persist:
1. Revert to previous worker script in `ecosystem.production.config.cjs`
2. Use `scripts/redis-standalone-worker-docker.js` as fallback
3. Check Railway environment variables

## Success Indicators
- ✅ Railway deployment completes successfully
- ✅ PM2 shows "notification-worker" as "online"
- ✅ Worker logs show "Connected to Dragonfly Redis"
- ✅ Queue messages are processed successfully