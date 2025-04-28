#!/bin/bash
# Script to fix ReportComment model with UTF-8 encoding issues

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Run the fix script
echo "Running ReportComment fix script..."
node --loader ts-node/esm scripts/fix-report-comments.js

echo "Done!"
