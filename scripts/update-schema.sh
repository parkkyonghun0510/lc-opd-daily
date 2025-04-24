#!/bin/bash
# Script to apply Prisma migration and update types

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Run migrations
echo "Applying database migrations..."
npx prisma migrate dev --name add-plan-report-relation

# Generate Prisma client with new types
echo "Generating updated Prisma client..."
npx prisma generate

echo "Done!"
echo "Please restart your development server to apply changes." 