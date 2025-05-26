# Database Backup and Restore Guide

## Quick Start

### Create a Backup
```bash
# Make script executable
chmod +x ./scripts/backup-database.sh

# Create backup (reads DATABASE_URL from .env)
./scripts/backup-database.sh
```

### Restore a Backup
```bash
# Make script executable
chmod +x ./scripts/restore-modified.sh

# Basic restore
./scripts/restore-modified.sh --file your_backup.gz

# Full restore (drop and recreate database)
./scripts/restore-modified.sh --file your_backup.gz --drop-db --create-db
```

## Prerequisites

Before using these scripts, ensure you have:
1. `.env` file with `DATABASE_URL` in format: `postgresql://user:password@host:port/dbname`
2. PostgreSQL client tools installed (`pg_dump`, `pg_restore`, `psql`)
3. Sufficient database permissions for backup/restore operations
4. **Important**: `.env` file must have Unix line endings (not Windows `\r\n`)

## Overview
This guide covers database backup and restore procedures, particularly useful during Prisma schema changes.

## Environment Setup
The backup system requires:
- `DATABASE_URL` in `.env` file with format: `postgresql://user:password@host:port/dbname`
- PostgreSQL client tools (`pg_dump`, `pg_restore`)

## Backup Procedures

### Running the Backup Script
```bash
./scripts/backup-database.sh
```

This creates three backup formats in the `backups/` directory:
1. `.sql` - Plain SQL dump
2. `.dump` - PostgreSQL custom format
3. `.gz` - Compressed SQL dump

### Backup Naming Convention
Backups follow the format: `db{database_name}_{YYYYMMDD}_{HHMMSS}.{extension}`

Example: `dbdblc_opd_daily_20250428_185326.sql`

## Restore Procedures

### Restoring from SQL Format (.sql)
Best for: Schema changes and data inspection
```bash
psql -U your_user -d your_database < backups/your_backup.sql
```

### Restoring from Custom Format (.dump)
Best for: Full database restores
```bash
pg_restore -U your_user -d your_database backups/your_backup.dump
```

### Restoring from Compressed Format (.gz)
Best for: Storage-efficient restores
```bash
gunzip -c backups/your_backup.gz | psql -U your_user -d your_database
```

## When to Use Each Format

- `.sql` (Plain SQL)
  - Best for schema migrations
  - Easy to inspect and modify
  - Can be partially executed
  
- `.dump` (Custom Format)
  - Most reliable for full restores
  - Handles large objects efficiently
  - Supports parallel restore
  
- `.gz` (Compressed SQL)
  - Smallest file size
  - Good for transfer/storage
  - Requires decompression before use

## Best Practices for Prisma Schema Changes

1. Always create a backup before running migrations
2. Use `.sql` format to inspect schema changes
3. Keep the backup until the migration is verified
4. Test restore procedure on a development database first
5. Document the schema version with the backup

## Example Restore Commands with Environment Variables

```bash
# Using environment variables
export DB_USER="your_user"
export DB_NAME="your_database"

# SQL restore
psql -U $DB_USER -d $DB_NAME < backups/dbdblc_opd_daily_20250428_185326.sql

# Custom format restore
pg_restore -U $DB_USER -d $DB_NAME backups/dbdblc_opd_daily_20250428_185326.dump

# Compressed restore
gunzip -c backups/dbdblc_opd_daily_20250428_185326.gz | psql -U $DB_USER -d $DB_NAME
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   chmod +x ./scripts/backup-database.sh
   chmod +x ./scripts/restore-modified.sh
   ```

2. **Windows Line Ending Error: `$'\r': command not found`**
   This occurs when the `.env` file has Windows line endings. Fix with:
   
   ```bash
   # Option 1: Convert line endings with dos2unix
   dos2unix .env
   
   # Option 2: Convert with sed
   sed -i 's/\r$//' .env
   
   # Option 3: Convert with tr
   tr -d '\r' < .env > .env.tmp && mv .env.tmp .env
   
   # Option 4: Recreate .env file on Unix system
   # Copy content and paste into a new file created on Linux/macOS
   ```
   
   **Prevention**: Always create/edit `.env` files on the target system, or configure your editor to use Unix line endings (LF only).

3. **Database Connection Failed**
   - Check your `DATABASE_URL` in `.env` file
   - Verify database server is running
   - Confirm network connectivity

4. **Backup File Not Found**
   ```bash
   # List available backups
   ls -la backups/
   
   # Use full filename with extension
   ./scripts/restore-modified.sh --file dbdblc_opd_daily_20250428_185326.gz
   ```

5. **Transaction Timeout Errors**
   - The `restore-modified.sh` script handles this automatically
   - Uses multiple restore strategies for problematic backups

## Script Options

### restore-modified.sh Options
- `--file FILE`: Backup file to restore (required)
- `--dir DIR`: Backup directory (default: ./backups)
- `--drop-db`: Drop database before restoring
- `--create-db`: Create database if it doesn't exist
- `--force`: Continue even if backup appears corrupted
- `--help`: Show help message