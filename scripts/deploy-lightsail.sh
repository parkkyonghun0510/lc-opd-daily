#!/bin/bash

# Exit on error
set -e

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