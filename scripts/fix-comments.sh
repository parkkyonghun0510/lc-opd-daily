#!/bin/bash
# Script to fix comments with UTF-8 encoding issues

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Run the fix script
echo "Running comment fix script..."
node -r esm scripts/fix-comments.js

echo "Done!"
