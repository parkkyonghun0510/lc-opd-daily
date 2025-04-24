#!/bin/bash

# Load environment variables
if [ -f .env.local ]; then
  set -o allexport
  source .env.local
  set +o allexport
  echo "Loaded environment variables from .env.local"
elif [ -f .env ]; then
  set -o allexport
  source .env
  set +o allexport
  echo "Loaded environment variables from .env"
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start both the app and notification worker using the production config
echo "Starting production services with PM2..."
pm2 start ecosystem.production.config.cjs

# Check if startup was successful
if [ $? -eq 0 ]; then
  echo "==============================================="
  echo "Production services started successfully!"
  echo "App is running at: http://localhost:3000"
  echo "PM2 process status:"
  pm2 status
  echo "==============================================="
  echo "For logs, use:"
  echo "- App logs: pm2 logs lc-opd-daily"
  echo "- Worker logs: pm2 logs notification-worker"
  echo "To monitor: pm2 monit"
else
  echo "Failed to start production services"
  exit 1
fi 