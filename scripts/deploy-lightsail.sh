#!/bin/bash

# Exit on any error
set -e

echo "Starting production deployment..."

# Check if we're on the main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Error: Must be on main branch to deploy to production"
    exit 1
fi

# Ensure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Working directory is not clean. Please commit or stash changes."
    exit 1
fi

# Pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Install dependencies
echo "Installing dependencies..."
npm install

# Run type checking
echo "Running type checks..."
npm run typecheck

# Apply database migrations and link reports
echo "Applying database migrations..."
npm run db:deploy:production

# Build the application with force option to bypass dependency errors
echo "Building the application..."
npm run build:production:force

# Restart the application
echo "Restarting the application..."
npm run restart:pm2

echo "Deployment completed successfully!"

# Configuration
CONTAINER_SERVICE_NAME="lc-opd-daily"
REGION="ap-southeast-1"  # Singapore region
CONTAINER_NAME="app"
IMAGE_TAG="latest"

# Build the Docker image
echo "Building Docker image..."
docker build -t $CONTAINER_SERVICE_NAME:$IMAGE_TAG .

# Push to AWS Lightsail container service
echo "Pushing to AWS Lightsail..."
aws lightsail push-container-image \
  --region $REGION \
  --service-name $CONTAINER_SERVICE_NAME \
  --label $CONTAINER_NAME \
  --image $CONTAINER_SERVICE_NAME:$IMAGE_TAG

# Deploy the container
echo "Deploying container..."
aws lightsail create-container-service-deployment \
  --service-name $CONTAINER_SERVICE_NAME \
  --containers "{
    \"$CONTAINER_NAME\": {
      \"image\": \"$CONTAINER_SERVICE_NAME:$IMAGE_TAG\",
      \"environment\": {
        \"NODE_ENV\": \"production\",
        \"PORT\": \"3000\"
      },
      \"ports\": {
        \"3000\": \"HTTP\"
      }
    }
  }" \
  --public-endpoint "{
    \"containerName\": \"$CONTAINER_NAME\",
    \"containerPort\": 3000,
    \"healthCheck\": {
      \"healthyThreshold\": 2,
      \"unhealthyThreshold\": 2,
      \"timeoutSeconds\": 5,
      \"intervalSeconds\": 10,
      \"path\": \"/api/health\",
      \"successCodes\": \"200-299\"
    }
  }"

echo "Deployment initiated. Check AWS Lightsail console for status."