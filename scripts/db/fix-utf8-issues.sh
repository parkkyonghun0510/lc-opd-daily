#!/bin/bash
# Script to fix UTF-8 encoding issues in the database

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Step 1: Apply the migration to fix the parentId field
echo "Applying migration to fix parentId field..."
npx prisma migrate dev --name fix-parent-id-in-report-comment

# Step 2: Generate Prisma client with updated types
echo "Generating updated Prisma client..."
npx prisma generate

# Step 3: Run the fix script for ReportComment model
echo "Running ReportComment fix script..."
node --loader ts-node/esm scripts/fix-report-comments.js

# Step 4: Restart the development server
echo "Done! Please restart your development server to apply changes."
