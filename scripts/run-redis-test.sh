#!/bin/bash

# Run Redis Notification Test Script
echo "=== Running Redis Notification Test ==="

# Make the script executable
chmod +x scripts/test-redis-notification.js

# Run the test script with Node.js
node scripts/test-redis-notification.js

# Open the test page in the browser
echo ""
echo "Opening test page in browser..."
echo "If the browser doesn't open automatically, visit: http://localhost:3000/test/redis-notifications"
echo ""

# Try to open the browser (works on most systems)
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000/test/redis-notifications
elif command -v open &> /dev/null; then
    open http://localhost:3000/test/redis-notifications
elif command -v start &> /dev/null; then
    start http://localhost:3000/test/redis-notifications
else
    echo "Could not open browser automatically. Please visit http://localhost:3000/test/redis-notifications manually."
fi
