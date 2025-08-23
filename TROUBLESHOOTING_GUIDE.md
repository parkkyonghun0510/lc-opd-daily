# LC OPD Daily - Comprehensive Troubleshooting Guide

This consolidated guide covers all common issues and troubleshooting steps for the LC OPD Daily application.

## Table of Contents

1. [Environment Configuration](#environment-configuration)
2. [Railway Deployment](#railway-deployment)
3. [SSE Connection Issues](#sse-connection-issues)
4. [Service Worker Issues](#service-worker-issues)
5. [General Troubleshooting](#general-troubleshooting)

---

## Environment Configuration

### Overview
The application uses a comprehensive environment validation system that operates differently in browser and server contexts due to security constraints.

### Browser vs Server Validation

**Why Browser Warnings Occur**: The warnings you see in the browser are **expected behavior**, not errors.

1. **Security by Design**: Next.js only exposes environment variables prefixed with `NEXT_PUBLIC_` to the browser
2. **Server-Side Variables**: Variables like `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL`, and `DRAGONFLY_URL` are server-only for security
3. **Client-Side Limitations**: The browser cannot validate server-side configuration

### Required Environment Variables

#### Database Configuration
```bash
# PostgreSQL connection string
DATABASE_URL="postgresql://username:password@host:port/database"

# Redis-compatible cache (Dragonfly)
DRAGONFLY_URL="redis://username:password@host:port"
```

#### Authentication
```bash
# NextAuth.js configuration
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"  # or your production URL

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-client-id.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

#### VAPID Push Notification Configuration
```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-public-vapid-key"
VAPID_PRIVATE_KEY="your-private-vapid-key"
VAPID_CONTACT_EMAIL="your-contact-email"
```

### Quick Diagnosis
1. Visit `/api/health/environment` for real-time status
2. Check browser console for startup warnings
3. Run `npm run validate:env` for build-time validation

---

## Railway Deployment

### Quick Deploy (5 Minutes)

1. **Setup Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   railway link
   ```

2. **Generate Keys:**
   ```bash
   # Generate required keys
   npm run generate:server-key
   npx web-push generate-vapid-keys
   ```

3. **Set Environment Variables:**
   ```bash
   railway variables set NEXTAUTH_SECRET=$(openssl rand -base64 32)
   railway variables set JWT_SECRET=$(openssl rand -base64 32)
   railway variables set SETUP_SECRET_KEY=$(openssl rand -base64 32)
   railway variables set NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('base64'))")
   railway variables set NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
   railway variables set VAPID_PRIVATE_KEY="your-vapid-private-key"
   railway variables set VAPID_CONTACT_EMAIL="your-email@example.com"
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

### Common Deployment Issues

#### Container Startup Failures
**Error**: `exec container process (missing dynamic library?) '/app/./scripts/start-pm2.sh': No such file or directory`

**Solutions**:
1. **Install bash in Alpine containers**:
   ```dockerfile
   FROM node:18-alpine AS base
   RUN apk add --no-cache bash
   ```

2. **Use non-Alpine base image**:
   ```dockerfile
   FROM node:18 AS base
   ```

3. **Change script to use sh**:
   ```bash
   #!/bin/sh  # instead of #!/bin/bash
   ```

---

## SSE Connection Issues

### Error Types and Solutions

#### 1. Connection Refused / 404 Not Found
**Symptoms**: Browser console shows `GET /api/reports/updates 404 (Not Found)`

**Solutions**:
- Verify endpoint: `curl -I http://localhost:3000/api/reports/updates`
- Check if server is running
- Ensure `/api/reports/updates` endpoint exists

#### 2. Authentication Errors (401 Unauthorized)
**Symptoms**: `401 Unauthorized` responses

**Solutions**:
- Ensure user is logged in with valid session
- Check browser cookies for authentication tokens
- Verify CORS settings
- Test: `curl -H "Cookie: your-auth-cookie" http://localhost:3000/api/reports/updates`

#### 3. Rate Limiting (429 Too Many Requests)
**Symptoms**: `429 Too Many Requests` responses

**Solutions**:
- Wait 60 seconds before retrying (automatic retry)
- Check for multiple browser tabs
- Reduce connection frequency in development

#### 4. Browser Compatibility Issues
**Symptoms**: `EventSource is not defined` error

**Solutions**:
- Use modern browsers (Chrome 6+, Firefox 6+, Safari 5+, Edge 12+)
- Check for browser extensions blocking connections
- Verify HTTPS requirements for secure contexts

---

## Service Worker Issues

### Cache Failure Issues
**Error**: `sw.js:56 encountered an error while attempting to cache the app shell`

**Root Causes**:
1. Invalid routes being cached
2. Missing static assets
3. Network issues during cache.addAll()

**Solutions Applied**:
1. **Updated Invalid Routes**: Removed non-existent routes like `/dashboard/reports`
2. **Fixed Missing Assets**: Removed references to non-existent files
3. **Enhanced Error Handling**: Added individual resource validation

### Verification Steps
1. **Check Browser Console**: DevTools → Application → Service Workers
2. **Test Cache Contents**:
   ```javascript
   caches.keys().then(keys => console.log('Cache names:', keys));
   ```
3. **Force Update**: Click "Update" in DevTools → Application → Service Workers

---

## General Troubleshooting

### Health Check Endpoints
- `/api/health` - General application health
- `/api/health/environment` - Environment variable status
- `/api/health/database` - Database connectivity
- `/api/health/cache` - Cache system status

### Common Commands
```bash
# Validate environment
npm run validate:env

# Check logs
npm run logs

# Restart services
npm run restart

# Clear cache
npm run cache:clear
```

### Getting Help
1. Check application logs in `/logs` directory
2. Review browser console for client-side errors
3. Use health check endpoints for system status
4. Check Railway deployment logs if using Railway

---

*This guide consolidates information from multiple troubleshooting documents. For specific deployment scenarios, refer to the deployment summary documents.*