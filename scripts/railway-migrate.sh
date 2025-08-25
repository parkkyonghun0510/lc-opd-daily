#!/bin/bash

# Railway Database Migration Script
# This script handles database migrations for Railway deployment

set -e  # Exit on any error

echo "🚀 Starting Railway database migration..."

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "Please ensure your Railway PostgreSQL service is connected"
    exit 1
fi

echo "✅ DATABASE_URL is configured"

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Check database connection
echo "🔍 Testing database connection..."
npx prisma db pull --force || {
    echo "⚠️  Database connection test failed, but continuing with migration..."
}

# Run database migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Seed database if needed (optional)
if [ -f "prisma/seed.ts" ] || [ -f "prisma/seed.js" ]; then
    echo "🌱 Seeding database..."
    npm run db:seed || {
        echo "⚠️  Database seeding failed, but migration completed successfully"
    }
else
    echo "ℹ️  No seed file found, skipping database seeding"
fi

echo "✅ Database migration completed successfully!"
echo "🎉 Ready for Railway deployment"