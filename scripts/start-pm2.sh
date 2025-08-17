#!/bin/bash

# Railway PM2 startup script
echo "Starting PM2 with ecosystem config..."
echo "Current working directory: $(pwd)"
echo "Listing files:"
ls -la

# Check if ecosystem config exists
if [ ! -f "ecosystem.production.config.cjs" ]; then
    echo "ERROR: ecosystem.production.config.cjs not found!"
    exit 1
fi

echo "Found ecosystem.production.config.cjs"
echo "Starting PM2..."

# Start PM2 with explicit path
exec pm2-runtime start ./ecosystem.production.config.cjs