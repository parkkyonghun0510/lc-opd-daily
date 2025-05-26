#!/bin/bash

# Extract the backup file
gunzip -c backups/dbdblc_opd_daily_20250428_185326.gz > backups/dblc_opd_daily_20250428_185326.sql

# Drop the existing database
sudo -u dbmasteruser psql -c "DROP DATABASE IF EXISTS dblc_opd_daily;"

# Create a new database
sudo -u dbmasteruser psql -c "CREATE DATABASE dblc_opd_daily WITH OWNER dbmasteruser ENCODING 'UTF8';"

# Restore the database
sudo -u dbmasteruser psql -d dblc_opd_daily -f backups/dblc_opd_daily_20250428_185326.sql

# Run Prisma migrations
npx prisma migrate deploy

echo "Database restoration completed!"
