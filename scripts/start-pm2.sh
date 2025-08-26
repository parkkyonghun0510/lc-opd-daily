#!/bin/bash

# Railway PM2 startup script with enhanced production validation
echo "Starting PM2 with ecosystem config..."

# Always operate from /app
cd /app || { echo "ERROR: Failed to cd to /app"; exit 1; }

echo "Current working directory: $(pwd)"
echo "Listing critical files:"
ls -la ecosystem.production.config.cjs package.json server.js 2>/dev/null || echo "Some critical files missing"

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

# Enhanced environment validation for production
echo "Validating critical environment variables..."
CRITICAL_MISSING=0
for VAR in DATABASE_URL NEXTAUTH_SECRET DRAGONFLY_URL; do
  if [ -z "${!VAR}" ]; then
    echo "ERROR: Critical environment variable $VAR is not set"
    CRITICAL_MISSING=$((CRITICAL_MISSING + 1))
  else
    echo "✅ $VAR is configured"
  fi
done

if [ $CRITICAL_MISSING -gt 0 ]; then
  echo "ERROR: $CRITICAL_MISSING critical environment variables missing. Cannot start."
  exit 1
fi

# Additional environment checks (warnings only)
[ -z "${DRAGONFLY_QUEUE_NAME:-}" ] && echo "WARNING: DRAGONFLY_QUEUE_NAME is not set" || echo "✅ DRAGONFLY_QUEUE_NAME is set"
[ -z "${NEXT_PUBLIC_VAPID_PUBLIC_KEY:-}" ] && echo "WARNING: NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set" || echo "✅ NEXT_PUBLIC_VAPID_PUBLIC_KEY is set"
[ -z "${VAPID_PRIVATE_KEY:-}" ] && echo "WARNING: VAPID_PRIVATE_KEY is not set" || echo "✅ VAPID_PRIVATE_KEY is set"

# Check if ecosystem config exists
if [ ! -f "ecosystem.production.config.cjs" ]; then
    echo "ERROR: ecosystem.production.config.cjs not found in /app!"
    exit 1
fi

echo "Found ecosystem.production.config.cjs"
echo "Starting PM2 with production configuration..."

# Start PM2 with explicit working directory and better error handling
exec pm2-runtime start ecosystem.production.config.cjs --env production