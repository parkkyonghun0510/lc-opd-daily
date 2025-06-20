#!/bin/bash

# Exit on error
set -e

echo "Starting Railway build process..."

# Set environment variables
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
export NEXT_DISABLE_LINT=1

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run the build command directly
echo "Running Next.js build..."
next build --no-lint

# Create standalone directory if it doesn't exist
if [ ! -d ".next/standalone" ]; then
  echo "Standalone directory not found. Creating minimal standalone directory..."
  
  # Create a minimal standalone directory
  mkdir -p .next/standalone
  cp -r .next/server .next/standalone/
  cp -r public .next/standalone/
  cp -r node_modules .next/standalone/
  cp package.json .next/standalone/
  
  echo "Created minimal standalone directory."
fi

echo "Railway build process completed!"