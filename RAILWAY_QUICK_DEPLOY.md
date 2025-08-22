# Railway Quick Deployment Guide

## 🚀 Quick Start - Deploy to Railway in 5 Minutes

### Prerequisites
- Railway CLI installed: `npm install -g @railway/cli`
- Railway account: [railway.app](https://railway.app)
- GitHub repository connected to Railway

### Step 1: Environment Setup

1. **Login to Railway CLI:**
   ```bash
   railway login
   ```

2. **Link your project:**
   ```bash
   cd /home/ubuntu/lc-opd-daily
   railway link
   ```

### Step 2: Configure Environment Variables

1. **Copy template:**
   ```bash
   cp .env.railway.template .env.production
   ```

2. **Generate required keys:**
   ```bash
   # Generate Server Actions encryption key
   npm run generate:server-key
   
   # Generate VAPID keys for push notifications
   npx web-push generate-vapid-keys
   ```

3. **Set Railway variables:**
   ```bash
   # Set all required variables
   railway variables set NEXTAUTH_SECRET=$(openssl rand -base64 32)
   railway variables set JWT_SECRET=$(openssl rand -base64 32)
   railway variables set SETUP_SECRET_KEY=$(openssl rand -base64 32)
   railway variables set NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('base64'))")
   railway variables set NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
   railway variables set VAPID_PRIVATE_KEY="your-vapid-private-key"
   railway variables set VAPID_CONTACT_EMAIL="your-email@example.com"
   ```

### Step 3: Add Services

1. **Add PostgreSQL:**
   ```bash
   railway add postgresql
   ```

2. **Add Redis:**
   ```bash
   railway add redis
   ```

### Step 4: Deploy

**Option A: Automated Script (Recommended)**
```bash
./scripts/railway-deploy.sh
```

**Option B: Manual Commands**
```bash
# Validate environment
npm run validate:railway

# Deploy
railway up
```

**Option C: GitHub Integration**
1. Connect GitHub repo in Railway dashboard
2. Push to main branch to auto-deploy

### Step 5: Verify Deployment

1. **Check status:**
   ```bash
   railway status
   ```

2. **Check health:**
   ```bash
   curl $(railway domain)/api/health
   ```

3. **View logs:**
   ```bash
   railway logs
   ```

## 🔧 Troubleshooting

### Common Issues

1. **Server Actions Error:**
   ```bash
   # Generate new encryption key
   npm run generate:server-key
   railway variables set NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="new-key-here"
   ```

2. **Database Connection:**
   ```bash
   # Run migrations
   railway run npx prisma migrate deploy
   ```

3. **Build Failures:**
   ```bash
   # Check build logs
   railway logs --follow
   ```

### Quick Commands

```bash
# Check all Railway variables
railway variables

# Run database commands
railway run npx prisma migrate deploy
railway run npm run db:seed

# Restart deployment
railway restart

# View real-time logs
railway logs --follow
```

## 📋 Deployment Checklist

- [ ] Railway CLI installed and logged in
- [ ] Project linked to Railway
- [ ] PostgreSQL service added
- [ ] Redis service added
- [ ] Environment variables set:
  - [ ] NEXTAUTH_SECRET
  - [ ] JWT_SECRET
  - [ ] SETUP_SECRET_KEY
  - [ ] NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
  - [ ] NEXT_PUBLIC_VAPID_PUBLIC_KEY
  - [ ] VAPID_PRIVATE_KEY
  - [ ] VAPID_CONTACT_EMAIL
- [ ] Database migrations run
- [ ] Application deployed successfully
- [ ] Health endpoint responding
- [ ] Push notifications working (if configured)

## 🌐 Post-Deployment

1. **Update NEXTAUTH_URL:**
   ```bash
   railway variables set NEXTAUTH_URL=$(railway domain)
   ```

2. **Set up custom domain** (optional):
   - Go to Railway dashboard
   - Settings > Domains
   - Add custom domain

3. **Enable SSL:**
   - Railway provides SSL automatically for *.up.railway.app
   - Custom domains get SSL via Let's Encrypt

## 🚨 Emergency Commands

```bash
# Quick rollback
railway rollback

# Scale resources
railway scale --cpu 2 --memory 4GB

# Environment reset
railway variables delete NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
railway variables set NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('base64'))")
```