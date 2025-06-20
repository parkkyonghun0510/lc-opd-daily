# Scripts Directory

This directory contains various scripts for the LC-OPD-Daily application.

## Directory Structure

- `/build` - Scripts for building the application for different environments
- `/db` - Database management scripts (backup, restore, migrations)
- `/deploy` - Deployment and process management scripts (PM2, production deployment)
- `/test` - Test runner scripts for different test categories
- `/utils` - Utility scripts for various maintenance and setup tasks

## Common Scripts

### Build Scripts

- `build/production-build.sh` - Builds the application for production
- `build/railway-build.sh` - Builds the application for Railway deployment

### Database Scripts

- `db/backup-database.sh` - Creates a backup of the database
- `db/restore-db.sh` - Restores the database from a backup

### Deployment Scripts

- `deploy/pm2-start.sh` - Starts the application using PM2
- `deploy/pm2-stop.sh` - Stops the PM2 processes

### Test Scripts

- `test/run-redis-test.sh` - Runs Redis-related tests
- `test/sse-load-test.js` - Runs load tests for SSE functionality

## Adding New Scripts

When adding new scripts, please follow these guidelines:

1. Place scripts in the appropriate subdirectory based on functionality
2. Follow the naming convention: `[action]-[feature].[extension]`
3. Add a brief description at the top of each script file
4. Make sure to make shell scripts executable (`chmod +x script.sh`)
5. Update this README if you add a new script category
