#!/bin/bash

# PostgreSQL Database Backup Script
# Creates timestamped backups in both .sql and .gz formats
# Reads DATABASE_URL from .env file

# Error handling
set -e
trap 'echo "Error occurred at line $LINENO. Exit code: $?" >&2' ERR

# Load environment variables from .env
if [ ! -f .env ]; then
    echo "Error: .env file not found" >&2
    exit 1
fi

# Clean Windows line endings from .env file if present
# This prevents "$'\r': command not found" errors
if grep -q $'\r' .env 2>/dev/null; then
    echo "Detected Windows line endings in .env file. Converting to Unix format..."
    sed -i 's/\r$//' .env
fi

# Source .env file
source .env

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL is not set in .env file" >&2
    exit 1
fi

# Parse DATABASE_URL
# Format: postgresql://user:password@host:port/dbname
if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+) ]]; then
    POSTGRES_USER="${BASH_REMATCH[1]}"
    POSTGRES_PASSWORD="${BASH_REMATCH[2]}"
    POSTGRES_HOST="${BASH_REMATCH[3]}"
    POSTGRES_PORT="${BASH_REMATCH[4]}"
    POSTGRES_DB="${BASH_REMATCH[5]}"
else
    echo "Error: Invalid DATABASE_URL format. Expected: postgresql://user:password@host:port/dbname" >&2
    exit 1
fi

# Create backups directory if it doesn't exist
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

# Generate timestamp for filename
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_NAME="db${POSTGRES_DB}_${TIMESTAMP}"

# Create SQL backup
echo "Creating SQL backup..."
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -F p > "$BACKUP_DIR/${BACKUP_NAME}.sql"

# Create compressed backup
echo "Creating compressed backup..."
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -F c > "$BACKUP_DIR/${BACKUP_NAME}.dump"

# Create gzipped SQL backup
echo "Creating gzipped SQL backup..."
gzip -c "$BACKUP_DIR/${BACKUP_NAME}.sql" > "$BACKUP_DIR/${BACKUP_NAME}.gz"

echo "Backup completed successfully:"
echo "- SQL backup: ${BACKUP_DIR}/${BACKUP_NAME}.sql"
echo "- Compressed backup: ${BACKUP_DIR}/${BACKUP_NAME}.dump"
echo "- Gzipped backup: ${BACKUP_DIR}/${BACKUP_NAME}.gz"