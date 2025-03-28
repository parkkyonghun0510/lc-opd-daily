# Production Deployment Checklist

This document provides a checklist for deploying the application to production.

## Prerequisites

- [ ] AWS account with access to Lightsail
- [ ] Docker installed on your machine
- [ ] AWS CLI configured with appropriate credentials
- [ ] Database server running PostgreSQL
- [ ] SQS queue created in AWS

## Environment Setup

1. Create production environment file:
   - [ ] Copy `.env.production.template` to `.env.production`
   - [ ] Fill in all required values
   - [ ] Ensure database connection details are correct
   - [ ] Set correct AWS credentials and SQS URL
   - [ ] Configure VAPID keys for push notifications

2. Database preparation:
   - [ ] Run database migrations: `npx prisma migrate deploy`
   - [ ] If needed, seed initial data: `npx prisma db seed`

## Build & Deployment

### Option 1: Docker Deployment (AWS Lightsail)

1. Build and deploy:
   ```
   npm run build:deploy
   ```

   This will:
   - Build the Next.js application with production settings
   - Build a Docker image
   - Push to AWS Lightsail
   - Deploy the container

2. Verify deployment:
   - [ ] Check AWS Lightsail console for deployment status
   - [ ] Verify application is accessible at the production URL
   - [ ] Test health check endpoint: `/api/health`

### Option 2: Manual Deployment (PM2)

1. Build the application:
   ```
   npm run build:production
   ```

2. Start the application and worker:
   ```
   ./scripts/start-production.sh
   ```

3. Verify deployment:
   - [ ] Check PM2 status: `pm2 status`
   - [ ] Verify application is running: `curl http://localhost:3000/api/health`
   - [ ] Check notification worker logs: `pm2 logs notification-worker`

## Post-Deployment Checks

- [ ] Verify user authentication flows
- [ ] Test notification delivery
- [ ] Check database queries performance
- [ ] Verify scheduled tasks (if any)
- [ ] Test application under load

## Monitoring

- [ ] Set up monitoring for the application
- [ ] Configure alerts for errors and performance issues
- [ ] Set up log aggregation

## Rollback Plan

In case of deployment issues:

1. If using Lightsail:
   - [ ] Revert to previous deployment in AWS Lightsail console

2. If using PM2:
   - [ ] Stop services: `pm2 stop all`
   - [ ] Revert to previous build
   - [ ] Restart: `./scripts/start-production.sh`

## Security Checklist

- [ ] Ensure all secrets are properly secured
- [ ] Verify authentication is working correctly
- [ ] Check API endpoints for proper authorization
- [ ] Ensure database is not publicly accessible
- [ ] Verify HTTPS is configured correctly 