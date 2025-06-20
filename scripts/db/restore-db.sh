#!/bin/bash

# Extract the backup file
gunzip -c backups/dblc_opd_daily_20250424_211352.gz > backups/dblc_opd_daily_20250424_211352.sql

# Drop the existing database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS lc_opd_daily;"

# Create a new database
sudo -u postgres psql -c "CREATE DATABASE lc_opd_daily WITH OWNER postgres ENCODING 'UTF8';"

# Restore the database
sudo -u postgres psql -d lc_opd_daily -f backups/dblc_opd_daily_20250424_211352.sql

# Run Prisma migrations
npx prisma migrate deploy

echo "Database restoration completed!"
