#!/bin/bash

# This script restores the temporarily disabled routes after deployment

echo "Restoring temporarily disabled routes..."

# Restore the comments route
if [ -f "src/app/api/reports/[id]/comments/[commentId]/route.ts.bak" ]; then
  mv src/app/api/reports/[id]/comments/[commentId]/route.ts.bak src/app/api/reports/[id]/comments/[commentId]/route.ts
  echo "Restored src/app/api/reports/[id]/comments/[commentId]/route.ts"
fi

# Restore the report-comments route
if [ -f "src/app/api/reports/[id]/report-comments/[commentId]/route.ts.bak" ]; then
  mv src/app/api/reports/[id]/report-comments/[commentId]/route.ts.bak src/app/api/reports/[id]/report-comments/[commentId]/route.ts
  echo "Restored src/app/api/reports/[id]/report-comments/[commentId]/route.ts"
fi

# Restore the report-comments route
if [ -f "src/app/api/reports/[id]/report-comments/route.ts.bak" ]; then
  mv src/app/api/reports/[id]/report-comments/route.ts.bak src/app/api/reports/[id]/report-comments/route.ts
  echo "Restored src/app/api/reports/[id]/report-comments/route.ts"
fi

echo "Route restoration completed!"
