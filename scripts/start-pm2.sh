#!/bin/bash

# Railway PM2 startup script
echo "Starting PM2 with ecosystem config..."

# Always operate from /app
cd /app || { echo "ERROR: Failed to cd to /app"; exit 1; }

echo "Current working directory: $(pwd)"
echo "Listing files:"
ls -la

# Load environment variables from mounted env files if present
# Priority order: .env.production > .env.production.local > .env.local > .env
for ENV_FILE in .env.production .env.production.local .env.local .env; do
  if [ -f "$ENV_FILE" ]; then
    echo "Loading environment from /app/$ENV_FILE"
    # Export all variables defined in the file
    set -a
    # shellcheck disable=SC1090
    source "/app/$ENV_FILE"
    set +a
    # Only load the first one found to respect precedence
    break
  fi
done

# Basic sanity checks for critical envs (masked output)
[ -z "${DATABASE_URL:-}" ] && echo "WARNING: DATABASE_URL is not set" || echo "DATABASE_URL is set"
[ -z "${REDIS_URL:-}" ] && echo "WARNING: REDIS_URL is not set" || echo "REDIS_URL is set"

# Check if ecosystem config exists
if [ ! -f "ecosystem.production.config.cjs" ]; then
    echo "ERROR: ecosystem.production.config.cjs not found in /app!"
    exit 1
fi

echo "Found ecosystem.production.config.cjs"
echo "Starting PM2..."

# Start PM2 with explicit working directory
exec pm2-runtime start ecosystem.production.config.cjs