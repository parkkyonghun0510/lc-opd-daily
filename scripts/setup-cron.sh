#!/bin/bash

# Setup Cron Jobs for Maintenance Tasks
# This script sets up automated maintenance tasks

echo "🔧 Setting up automated maintenance tasks..."

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Project directory: $PROJECT_DIR"

# Create a temporary cron file
TEMP_CRON=$(mktemp)

# Get existing cron jobs (if any)
crontab -l 2>/dev/null > "$TEMP_CRON" || true

# Remove any existing LC-OPD-Daily maintenance jobs
sed -i '/# LC-OPD-Daily Maintenance/d' "$TEMP_CRON"
sed -i '/health-check.js/d' "$TEMP_CRON"
sed -i '/performance-monitor.js/d' "$TEMP_CRON"
sed -i '/db-cleanup.js/d' "$TEMP_CRON"

echo "" >> "$TEMP_CRON"
echo "# LC-OPD-Daily Maintenance Tasks" >> "$TEMP_CRON"

# Health check every 15 minutes
echo "*/15 * * * * cd $PROJECT_DIR && node scripts/health-check.js --save >> logs/health-check.log 2>&1" >> "$TEMP_CRON"

# Performance monitoring every hour
echo "0 * * * * cd $PROJECT_DIR && node scripts/performance-monitor.js --save >> logs/performance-monitor.log 2>&1" >> "$TEMP_CRON"

# Database cleanup every Sunday at 2 AM
echo "0 2 * * 0 cd $PROJECT_DIR && node scripts/db-cleanup.js >> logs/db-cleanup.log 2>&1" >> "$TEMP_CRON"

# PM2 save every 6 hours (backup process list)
echo "0 */6 * * * pm2 save >> logs/pm2-save.log 2>&1" >> "$TEMP_CRON"

# Install the new cron jobs
crontab "$TEMP_CRON"

# Clean up
rm "$TEMP_CRON"

echo "✅ Cron jobs installed successfully!"
echo ""
echo "📋 Scheduled maintenance tasks:"
echo "   • Health checks: Every 15 minutes"
echo "   • Performance monitoring: Every hour"
echo "   • Database cleanup: Every Sunday at 2 AM"
echo "   • PM2 backup: Every 6 hours"
echo ""
echo "📄 Logs will be saved to the logs/ directory"
echo ""
echo "To view current cron jobs: crontab -l"
echo "To remove all maintenance cron jobs: crontab -l | grep -v 'LC-OPD-Daily' | crontab -"