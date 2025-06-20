# Database Backup and Restore Guide

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
