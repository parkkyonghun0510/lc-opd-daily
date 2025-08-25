# Railway Deployment Guide

This guide provides comprehensive instructions for deploying the LC OPD Daily application to Railway.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Redis/Dragonfly Setup](#redisdragonfly-setup)
6. [Deployment Process](#deployment-process)
7. [Post-Deployment](#post-deployment)
8. [Troubleshooting](#troubleshooting)
9. [Automated Deployment](#automated-deployment)

## Prerequisites

### Required Tools

- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
- **Railway CLI** (latest version)
- **Git** (for version control)

### Install Railway CLI

```bash
# Install Railway CLI globally
npm install -g @railway/cli

# Verify installation
railway --version
```

## Initial Setup

### 1. Create Railway Account

1. Visit [railway.app](https://railway.app)
2. Sign up or log in with GitHub
3. Create a new project

### 2. Login to Railway CLI

```bash
# Login to Railway
railway login

# Verify authentication
railway whoami
```

### 3. Initialize Railway Project

```bash
# Navigate to your project directory
cd /path/to/lc-opd-daily

# Link to Railway project
railway link

# Or create a new project
railway init
```

## Environment Configuration

### 1. Copy Environment Template

```bash
# Copy the Railway environment template
cp .env.railway.template .env.production
```

### 2. Configure Required Variables

Edit `.env.production` and set the following required variables:

```bash
# NextAuth Configuration
NEXTAUTH_URL=https://your-app-name.up.railway.app
NEXTAUTH_SECRET=your-secure-nextauth-secret
JWT_SECRET=your-secure-jwt-secret

# System Configuration
SETUP_SECRET_KEY=your-secure-setup-key

# VAPID Keys (Generate new ones for production)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_CONTACT_EMAIL=your-contact-email@example.com
```

### 3. Generate VAPID Keys

```bash
# Generate new VAPID keys for production
npx web-push generate-vapid-keys
```

### 4. Set Environment Variables in Railway

```bash
# Set variables using Railway CLI
railway variables set NEXTAUTH_SECRET="your-secure-secret"
railway variables set JWT_SECRET="your-secure-jwt-secret"
railway variables set SETUP_SECRET_KEY="your-setup-key"
railway variables set NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
railway variables set VAPID_PRIVATE_KEY="your-vapid-private-key"
railway variables set VAPID_CONTACT_EMAIL="your-email@example.com"

# Or use the Railway dashboard to set variables
```

## Database Setup

### 1. Add PostgreSQL Service

```bash
# Add PostgreSQL to your Railway project
railway add postgresql

# The DATABASE_URL will be automatically provided
```

### 2. Run Database Migrations

```bash
# Run the migration script
./scripts/railway-migrate.sh

# Or manually run migrations
railway run npx prisma migrate deploy
```

### 3. Seed Database (Optional)

```bash
# If you have a seed script
railway run npm run db:seed
```

## Redis/Dragonfly Setup

### 1. Add Redis Service

```bash
# Add Redis to your Railway project
railway add redis

# The REDIS_URL will be automatically provided
```

### 2. Configure Dragonfly Variables

```bash
# Set Dragonfly-specific variables
railway variables set DRAGONFLY_QUEUE_NAME="notifications"
```

## Deployment Process

### Method 1: Automated Deployment Script

```bash
# Deploy to production
./scripts/railway-deploy.sh

# Deploy to staging
./scripts/railway-deploy.sh --environment staging

# Skip local testing
./scripts/railway-deploy.sh --skip-local-test
```

### Method 2: Manual Deployment

```bash
# Build and deploy
npm run build:railway
railway up

# Deploy with specific environment
railway up --environment production
```

### Method 3: GitHub Integration

1. Connect your GitHub repository to Railway
2. Enable automatic deployments
3. Push to main branch to trigger deployment

## Post-Deployment

### 1. Verify Deployment

```bash
# Check deployment status
railway status

# View logs
railway logs

# Check health endpoint
curl https://your-app-name.up.railway.app/api/health
```

### 2. Configure Domain (Optional)

```bash
# Add custom domain
railway domain add yourdomain.com
```

### 3. Set up Monitoring

- Railway provides built-in monitoring
- Health checks are configured at `/api/health`
- Monitor logs through Railway dashboard

## Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Check build logs
railway logs --deployment

# Common solutions:
# - Ensure all dependencies are in package.json
# - Check Node.js version compatibility
# - Verify environment variables are set
```

#### 2. Database Connection Issues

```bash
# Test database connection
railway run npx prisma db pull

# Check DATABASE_URL
railway variables
```

#### 3. Redis Connection Issues

```bash
# Check Redis connection
railway run node -e "console.log(process.env.REDIS_URL)"

# Verify Redis service is running
railway status
```

#### 4. Environment Variable Issues

```bash
# List all variables
railway variables

# Set missing variables
railway variables set VARIABLE_NAME="value"
```

### Debug Commands

```bash
# View application logs
railway logs --tail

# Connect to deployment shell
railway shell

# Run commands in Railway environment
railway run "your-command"
```

## Automated Deployment

### GitHub Actions (Recommended)

Create `.github/workflows/railway-deploy.yml`:

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 18
      uses: actions/setup-node@v3
      with:
        node-version: 18
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci --legacy-peer-deps
    
    - name: Run tests
      run: npm test
    
    - name: Deploy to Railway
      uses: railway/cli@v2
      with:
        command: up --detach
      env:
        RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### Manual Deployment Script

Use the provided deployment script:

```bash
# Make script executable
chmod +x scripts/railway-deploy.sh

# Run deployment
./scripts/railway-deploy.sh
```

## Environment-Specific Configurations

### Production Environment

- Use production database
- Enable all security features
- Set appropriate resource limits
- Configure custom domain

### Staging Environment

```bash
# Create staging environment
railway environment create staging

# Deploy to staging
railway up --environment staging
```

## Security Considerations

1. **Environment Variables**: Never commit secrets to version control
2. **HTTPS**: Always use HTTPS in production
3. **Database**: Use strong passwords and restrict access
4. **VAPID Keys**: Generate new keys for production
5. **JWT Secrets**: Use cryptographically secure random strings

## Performance Optimization

1. **Resource Allocation**: Monitor and adjust Railway service resources
2. **Database**: Optimize queries and use connection pooling
3. **Redis**: Configure appropriate memory limits
4. **CDN**: Consider using Railway's CDN for static assets

## Backup and Recovery

1. **Database Backups**: Railway provides automatic PostgreSQL backups
2. **Code Backups**: Use Git for version control
3. **Environment Variables**: Document all required variables

## Support and Resources

- [Railway Documentation](https://docs.railway.app/)
- [Railway Discord Community](https://discord.gg/railway)
- [Railway Status Page](https://status.railway.app/)
- [Project Repository Issues](https://github.com/your-repo/issues)

---

**Note**: This deployment guide is specific to the LC OPD Daily application. Adjust configurations based on your specific requirements and Railway project setup.