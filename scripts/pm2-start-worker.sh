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
# Build worker if the compiled file is missing
if [ ! -f dist/workers/dragonfly-worker.js ]; then
  echo "Building worker..."
  npm run build:worker
fi

# If a process with the same name exists, delete it to avoid duplicate entries
if pm2 describe notification-worker > /dev/null 2>&1; then
  echo "Existing notification-worker found. Deleting before start..."
  pm2 delete notification-worker || true
fi

pm2 start dist/workers/dragonfly-worker.js --name notification-worker

# Check if worker started successfully
if [ $? -eq 0 ]; then
  echo "Notification worker started successfully!"
  echo "View logs with: pm2 logs notification-worker"
  echo "Monitor with: pm2 monit"
else
  echo "Failed to start notification worker"
  exit 1
fi
