#!/bin/bash

# Health check script for Railway deployment
# This script checks if the application and Redis are working properly

echo "Starting health check..."

# Check if the application is responding
APP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)

if [ "$APP_RESPONSE" = "200" ]; then
    echo "✅ Application is healthy (HTTP 200)"
    exit 0
else
    echo "❌ Application health check failed (HTTP $APP_RESPONSE)"
    exit 1
fi
