# Environment Configuration Troubleshooting Guide

This guide helps you diagnose and resolve common environment configuration issues in the LC OPD Pro application.

## Quick Diagnosis

### 1. Check Environment Status
- Visit `/api/health/environment` to get a real-time status of all environment variables
- Use the Environment Status Dashboard component for a visual overview
- Review browser console for startup warnings

### 2. Common Warning Messages

#### "Browser Security Notice" Warnings
**Status**: ✅ Expected Behavior  
**Message**: Variables like `VAPID_PRIVATE_KEY`, `DRAGONFLY_URL`, `VAPID_CONTACT_EMAIL` cannot be validated in browser

**Why this happens**:
- These are server-side only variables for security reasons
- Browser validation warnings confirm proper security practices
- The application is working correctly

**Action**: Click "Continue (Safe)" - no further action needed

---

## Environment Variables Reference

### Required Variables

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

#### Push Notifications
```bash
# VAPID keys for web push
VAPID_PUBLIC_KEY="your-88-character-public-key"
VAPID_PRIVATE_KEY="your-private-key"
VAPID_CONTACT_EMAIL="your-contact@email.com"
```

### Optional Variables
```bash
# Environment mode
NODE_ENV="development"  # or "production"
```

---

## Common Issues & Solutions

### Issue 1: "Required variable is missing" Error

**Symptoms**:
- Red error badges in dashboard
- Application fails to start
- Database connection errors

**Diagnosis**:
```bash
# Check if .env file exists
ls -la .env*

# Verify variable is set
echo $DATABASE_URL
```

**Solutions**:
1. **Create .env file** if missing:
   ```bash
   cp .env.example .env
   ```

2. **Add missing variables** to `.env`:
   ```bash
   echo "DATABASE_URL=your-database-url" >> .env
   ```

3. **Restart development server**:
   ```bash
   npm run dev
   ```

### Issue 2: "Invalid URL format" for NEXTAUTH_URL

**Symptoms**:
- Authentication redirects fail
- Login/logout not working
- Invalid URL format warning

**Solutions**:
1. **Development environment**:
   ```bash
   NEXTAUTH_URL="http://localhost:3000"
   ```

2. **Production environment**:
   ```bash
   NEXTAUTH_URL="https://yourdomain.com"
   ```

3. **Ensure no trailing slash**:
   ```bash
   # ❌ Wrong
   NEXTAUTH_URL="http://localhost:3000/"
   
   # ✅ Correct
   NEXTAUTH_URL="http://localhost:3000"
   ```

### Issue 3: VAPID Key Format Issues

**Symptoms**:
- Push notifications not working
- "Invalid VAPID key format" warning
- 88-character length error

**Solutions**:
1. **Generate new VAPID keys**:
   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Verify key format**:
   ```bash
   # Public key should be exactly 88 characters
   echo ${#VAPID_PUBLIC_KEY}
   ```

3. **Update .env file**:
   ```bash
   VAPID_PUBLIC_KEY="BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"
   VAPID_PRIVATE_KEY="your-private-key-here"
   VAPID_CONTACT_EMAIL="admin@yourdomain.com"
   ```

### Issue 4: Database Connection Problems

**Symptoms**:
- "Database connection failed" errors
- Prisma client errors
- Application crashes on startup

**Diagnosis**:
```bash
# Test database connection
npx prisma db pull

# Check database status
npx prisma migrate status
```

**Solutions**:
1. **Verify DATABASE_URL format**:
   ```bash
   # PostgreSQL format
   DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
   ```

2. **Test connection**:
   ```bash
   # Run database migrations
   npx prisma migrate dev
   
   # Generate Prisma client
   npx prisma generate
   ```

3. **Check database server**:
   - Ensure PostgreSQL is running
   - Verify credentials and permissions
   - Check network connectivity

### Issue 5: Redis/Dragonfly Connection Issues

**Symptoms**:
- Cache operations fail
- Session storage problems
- "Cannot connect to Redis" errors

**Solutions**:
1. **Verify DRAGONFLY_URL format**:
   ```bash
   # Basic format
   DRAGONFLY_URL="redis://localhost:6379"
   
   # With authentication
   DRAGONFLY_URL="redis://username:password@host:6379"
   ```

2. **Test connection**:
   ```bash
   # Using redis-cli (if available)
   redis-cli -u $DRAGONFLY_URL ping
   ```

3. **Start Dragonfly server**:
   ```bash
   # Using Docker
   docker run -p 6379:6379 docker.dragonflydb.io/dragonflydb/dragonfly
   ```

---

## Environment Setup Checklist

### Development Setup
- [ ] `.env` file created from `.env.example`
- [ ] `DATABASE_URL` configured and tested
- [ ] `DRAGONFLY_URL` configured and tested
- [ ] `NEXTAUTH_SECRET` generated (32+ characters)
- [ ] `NEXTAUTH_URL` set to `http://localhost:3000`
- [ ] VAPID keys generated for push notifications
- [ ] Database migrations applied
- [ ] Development server starts without errors

### Production Setup
- [ ] All environment variables configured in hosting platform
- [ ] `NEXTAUTH_URL` set to production domain
- [ ] `NODE_ENV` set to `production`
- [ ] Database connection tested
- [ ] SSL certificates configured
- [ ] VAPID contact email set to valid address
- [ ] Health check endpoint accessible

---

## Debugging Commands

### Environment Validation
```bash
# Validate all environment variables
npm run validate:env

# Check production environment
npm run validate:production

# Validate before build
npm run validate:build
```

### Database Operations
```bash
# Reset database (development only)
npx prisma migrate reset

# Apply pending migrations
npx prisma migrate deploy

# View database in browser
npx prisma studio
```

### Application Health
```bash
# Check application health
curl http://localhost:3000/api/health/environment

# Test specific endpoints
curl -I http://localhost:3000/api/auth/session
```

---

## Getting Help

### Log Analysis
1. **Check browser console** for client-side errors
2. **Review server logs** for backend issues
3. **Use Network tab** to inspect API calls
4. **Check Environment Status Dashboard** for real-time status

### Support Resources
- Environment Status Dashboard: `/dashboard/environment`
- Health Check API: `/api/health/environment`
- Environment Validation Guide: `/ENVIRONMENT_VALIDATION_GUIDE.md`
- Application logs in development console

### Emergency Recovery
If the application won't start:

1. **Backup current .env**:
   ```bash
   cp .env .env.backup
   ```

2. **Reset to defaults**:
   ```bash
   cp .env.example .env
   ```

3. **Configure minimal required variables**:
   ```bash
   # Add only essential variables
   DATABASE_URL="your-database-url"
   NEXTAUTH_SECRET="your-secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. **Test and gradually add variables**:
   ```bash
   npm run dev
   ```

---

## Prevention Tips

1. **Use version control** for `.env.example` (never commit `.env`)
2. **Document changes** when adding new environment variables
3. **Test locally** before deploying to production
4. **Monitor health endpoints** in production
5. **Keep backups** of working configurations
6. **Use environment validation** in CI/CD pipelines

For additional support, check the application logs and use the built-in diagnostic tools.