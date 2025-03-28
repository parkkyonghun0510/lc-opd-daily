#!/bin/bash

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
  set -o allexport
  source .env.local
  set +o allexport
  echo "Loaded environment variables from .env.local"
fi

# Start the notification worker with PM2
echo "Starting notification worker with PM2..."
pm2 start ecosystem.worker.config.cjs --only notification-worker

# Check if worker started successfully
if [ $? -eq 0 ]; then
  echo "Notification worker started successfully!"
  echo "View logs with: pm2 logs notification-worker"
  echo "Monitor with: pm2 monit"
else
  echo "Failed to start notification worker"
  exit 1
fi 