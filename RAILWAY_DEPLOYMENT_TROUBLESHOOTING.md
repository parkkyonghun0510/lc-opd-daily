# Railway Deployment Troubleshooting Guide

This guide helps you troubleshoot common issues when deploying to Railway.

## Container Startup Failures

### Error: `exec container process (missing dynamic library?) '/app/./scripts/start-pm2.sh': No such file or directory`

**Cause**: This error typically occurs when:
1. The startup script uses `#!/bin/bash` but the container doesn't have bash installed
2. Alpine Linux base images (like `node:18-alpine`) don't include bash by default
3. Missing dependencies or incorrect file paths

**Solutions**:

1. **Install bash in Alpine containers** (Recommended):
   ```dockerfile
   # Add this after the base image declaration
   FROM node:18-alpine AS base
   RUN apk add --no-cache bash
   ```

2. **Use a non-Alpine base image**:
   ```dockerfile
   # Change from:
   FROM node:18-alpine AS base
   # To:
   FROM node:18 AS base
   ```

3. **Change script to use sh instead of bash**:
   ```bash
   # Change the shebang line from:
   #!/bin/bash
   # To:
   #!/bin/sh
   ```

4. **Verify script permissions and format**:
   ```bash
   # Check if script is executable
   ls -la scripts/start-pm2.sh
   
   # Make executable if needed
   chmod +x scripts/start-pm2.sh
   
   # Check for Windows line endings
   file scripts/start-pm2.sh
   ```

### Error: `Failed to load env from .env.production.local [Error: ENOTDIR: not a directory, stat '/app/ecosystem.production.config.cjs/.env.production.local']`

**Cause**: PM2 is using the wrong working directory, causing Next.js to look for environment files in the config file's path instead of the app root.

**Solutions**:

1. **Fix PM2 startup script** (Recommended):
   ```bash
   # In start-pm2.sh, ensure explicit working directory
   cd /app
   exec pm2-runtime start ecosystem.production.config.cjs
   ```

2. **Fix PM2 configuration**:
   ```javascript
   // In ecosystem.production.config.cjs
   module.exports = {
     apps: [{
       name: "lc-opd-daily",
       script: "node_modules/next/dist/bin/next",
       cwd: "/app", // Use absolute path
       // ... other config
     }]
   };
   ```

3. **Verify working directory**:
   ```bash
   # Add debug output to startup script
   echo "Current working directory: $(pwd)"
   ls -la
   ```

## Redis Connection Issues

### Warning: `Redis URL not found, using in-memory fallback`

**Cause**: Missing Redis environment variables.

**Solution**: Set these environment variables in Railway:
```
DRAGONFLY_HOST=your-redis-host
DRAGONFLY_PORT=6379
DRAGONFLY_USER=your-username
DRAGONFLY_PASSWORD=your-password
```

## PWA Configuration Issues

### Warning: `VAPID keys not set`

**Cause**: Missing VAPID keys for push notifications.

**Solutions**:
1. **Generate and set VAPID keys**:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Then set in Railway:
   ```
   VAPID_PUBLIC_KEY=your-public-key
   VAPID_PRIVATE_KEY=your-private-key
   ```

2. **Disable push notifications** (if not needed):
   Remove push notification code from your service worker.

## Build Issues

### Error: `Failed to copy traced files`

**Cause**: Next.js build tracing issues or missing dependencies.

**Solutions**:
1. **Clean rebuild**:
   ```bash
   rm -rf .next
   npm run build
   ```

2. **Check Next.js configuration**:
   Ensure `next.config.cjs` has:
   ```javascript
   module.exports = {
     output: 'standalone',
     // other config...
   }
   ```

## Environment Variables

### Required Variables
```
NODE_ENV=production
DATABASE_URL=your-database-url
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=your-app-url
```

### Optional Variables (to avoid warnings)
```
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
TELEGRAM_BOT_TOKEN=your-telegram-token
TELEGRAM_CHAT_ID=your-telegram-chat-id
DRAGONFLY_HOST=your-redis-host
DRAGONFLY_PORT=6379
DRAGONFLY_USER=your-redis-user
DRAGONFLY_PASSWORD=your-redis-password
```

## Pre-Deployment Checklist

- [ ] Run `node scripts/railway-deployment-validation.cjs`
- [ ] All validation checks pass
- [ ] Environment variables set in Railway
- [ ] `npm run build` completes successfully
- [ ] Dockerfile includes bash installation (for Alpine images)
- [ ] Scripts have executable permissions
- [ ] No Windows line endings in shell scripts

## Debugging Tips

1. **Check Railway logs** for specific error messages
2. **Use the validation script** before each deployment
3. **Test locally** with Docker to catch container issues early
4. **Monitor startup logs** for PM2 and application initialization
5. **Verify file permissions** in the container

## Docker Build Timeout Issues

### Problem: "importing to docker" or "exporting to docker image format" errors with SIGTERM

```
✕ importing to docker 
got 1 SIGTERM/SIGINTs, forcing shutdown 
✕ exporting to docker image format 
rpc error: code = Canceled desc = context canceled
```

### Root Cause
- Railway's build timeout (typically 10-15 minutes)
- Large Docker build context
- Inefficient Dockerfile layers
- Missing .dockerignore file

### Solutions

1. **Optimize Dockerfile layers** (already implemented):
   - Consolidate RUN commands
   - Add `--no-audit --no-fund` flags to npm commands
   - Combine system dependencies installation

2. **Add .dockerignore file** (already implemented):
   - Excludes unnecessary files from build context
   - Reduces upload time to Railway

3. **Monitor build progress**:
   ```bash
   # Check build logs in Railway dashboard
   # Look for specific timeout points
   ```

4. **Alternative deployment strategies**:
   - Use Railway's native Node.js buildpack instead of Docker
   - Split into smaller services if the application is too large
   - Consider using Railway's build cache optimization

### Prevention
- Keep Docker images lean
- Regularly clean up unused dependencies
- Use multi-stage builds effectively
- Monitor build times and optimize bottlenecks

## Next Steps

1. **Commit your changes**: `git add . && git commit -m "Fix Railway deployment issues"`
2. **Set environment variables** in Railway dashboard
3. **Run build locally**: `npm run build` to verify
4. **Redeploy** on Railway
5. **Monitor logs** for any remaining issues

## Getting Help

If issues persist:
1. Check Railway's status page
2. Review the full deployment logs
3. Test the Docker build locally
4. Verify all environment variables are set correctly