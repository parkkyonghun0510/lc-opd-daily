#!/bin/bash

# Stop the notification worker
echo "Stopping notification worker..."
pm2 stop notification-worker

# Check if worker stopped successfully
if [ $? -eq 0 ]; then
  echo "Notification worker stopped successfully!"
else
  echo "Failed to stop notification worker"
  exit 1
fi