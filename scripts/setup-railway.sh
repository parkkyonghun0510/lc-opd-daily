#!/bin/bash

# Railway Setup Script - Automates initial Railway configuration
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚂 Railway Setup Script${NC}"
echo -e "${BLUE}Setting up your LC OPD Daily application on Railway...${NC}"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI not found. Installing...${NC}"
    npm install -g @railway/cli
fi

if ! railway whoami &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Railway. Please run:${NC}"
    echo "railway login"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites verified${NC}"

# Link project
echo -e "${YELLOW}🔗 Linking project to Railway...${NC}"
if [[ ! -f .railway/config.json ]]; then
    railway link
fi

# Add services
echo -e "${YELLOW}🗄️ Adding required services...${NC}"

# Check if PostgreSQL exists
if ! railway services list | grep -q "postgresql"; then
    echo -e "${BLUE}Adding PostgreSQL...${NC}"
    railway add postgresql
fi

# Check if Redis exists
if ! railway services list | grep -q "redis"; then
    echo -e "${BLUE}Adding Redis...${NC}"
    railway add redis
fi

echo -e "${GREEN}✅ Services added${NC}"

# Generate and set environment variables
echo -e "${YELLOW}🔐 Setting up environment variables...${NC}"

# Generate encryption keys
echo -e "${BLUE}Generating secure keys...${NC}"

NEXTAUTH_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
SETUP_SECRET_KEY=$(openssl rand -base64 32)
SERVER_ACTIONS_KEY=$(node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('base64'))")

# Set variables
railway variables set NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set SETUP_SECRET_KEY="$SETUP_SECRET_KEY"
railway variables set NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$SERVER_ACTIONS_KEY"

# Set default values for optional variables
railway variables set NODE_ENV=production
railway variables set NEXTAUTH_URL=$(railway domain)
railway variables set MAX_LOGIN_ATTEMPTS=5
railway variables set LOGIN_LOCKOUT_MINUTES=30
railway variables set DEFAULT_LOCALE=en
railway variables set DEFAULT_TIMEZONE=Asia/Phnom_Penh
railway variables set SESSION_EXPIRY_DAYS=30
railway variables set UPLOAD_DIR=/app/uploads
railway variables set NEXT_PUBLIC_APP_VERSION=1.0.0

echo -e "${GREEN}✅ Environment variables configured${NC}"

# Generate VAPID keys for push notifications
echo -e "${YELLOW}📱 Setting up push notifications...${NC}"
echo -e "${BLUE}Generating VAPID keys...${NC}"
VAPID_KEYS=$(npx web-push generate-vapid-keys)

if [[ $? -eq 0 ]]; then
    PUBLIC_KEY=$(echo "$VAPID_KEYS" | grep "Public Key:" | cut -d' ' -f3)
    PRIVATE_KEY=$(echo "$VAPID_KEYS" | grep "Private Key:" | cut -d' ' -f3)
    
    railway variables set NEXT_PUBLIC_VAPID_PUBLIC_KEY="$PUBLIC_KEY"
    railway variables set VAPID_PRIVATE_KEY="$PRIVATE_KEY"
    railway variables set VAPID_CONTACT_EMAIL="admin@example.com"
    
    echo -e "${GREEN}✅ VAPID keys configured${NC}"
else
    echo -e "${YELLOW}⚠️  VAPID key generation skipped (web-push not available)${NC}"
fi

# Deploy application
echo -e "${YELLOW}🚀 Deploying application...${NC}"
railway up --detach

# Wait for deployment
echo -e "${BLUE}⏳ Waiting for deployment to complete...${NC}"
sleep 15

# Run database migrations
echo -e "${YELLOW}🗃️ Running database migrations...${NC}"
railway run npx prisma migrate deploy

# Check deployment status
echo -e "${YELLOW}🔍 Checking deployment status...${NC}"
railway status

# Show final information
DEPLOYMENT_URL=$(railway domain)
echo ""
echo -e "${GREEN}🎉 Railway setup completed successfully!${NC}"
echo -e "${GREEN}🌐 Application URL: ${YELLOW}$DEPLOYMENT_URL${NC}"
echo ""
echo -e "${BLUE}📖 Next steps:${NC}"
echo "1. Visit $DEPLOYMENT_URL to verify deployment"
echo "2. Check logs: railway logs"
echo "3. Test health endpoint: curl $DEPLOYMENT_URL/api/health"
echo "4. Update VAPID_CONTACT_EMAIL with your actual email"
echo "5. Configure custom domain if needed"
echo ""
echo -e "${YELLOW}💡 Useful commands:${NC}"
echo "railway logs --follow    # View real-time logs"
echo "railway variables       # View all environment variables"
echo "railway status          # Check deployment status"
echo "railway restart         # Restart application"