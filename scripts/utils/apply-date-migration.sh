#!/bin/bash
# Script to apply the date field migration

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Apply the migration
echo "Applying date field migration..."
npx prisma migrate dev --name fix-report-date-type

# Generate Prisma client with updated types
echo "Generating updated Prisma client..."
npx prisma generate

echo "Done!"
echo "Please restart your development server to apply changes."
