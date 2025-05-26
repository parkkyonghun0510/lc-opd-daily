#!/bin/bash
# PostgreSQL Database Restore Script with parameter issue workaround
# This script handles the "transaction_timeout" parameter issue during restore

# Exit on error, but allow pg_restore to continue despite errors
set -e

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
elif [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

# Default values
BACKUP_DIR="./backups"
BACKUP_FILE="dbdblc_opd_daily_20250428_185326.gz"
DROP_DB=false
CREATE_DB=false
FORCE=false

# Function to display usage information
usage() {
  echo "PostgreSQL Database Restore Script (Modified)"
  echo ""
  echo "Usage: $0 [options] --file BACKUP_FILE"
  echo ""
  echo "Options:"
  echo "  --file FILE          Backup file to restore (required)"
  echo "  --dir DIR            Backup directory (default: ./backups)"
  echo "  --drop-db            Drop the database before restoring (use with caution)"
  echo "  --create-db          Create the database if it doesn't exist"
  echo "  --force              Continue restore even if backup file appears corrupted"
  echo "  --help               Show this help message"
  echo ""
  echo "Example:"
  echo "  $0 --file lc_opd_daily_20240601_120000.gz"
  echo "  $0 --file lc_opd_daily_20240601_120000.sql --drop-db --create-db"
  exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --file)
      BACKUP_FILE="$2"
      shift
      shift
      ;;
    --dir)
      BACKUP_DIR="$2"
      shift
      shift
      ;;
    --drop-db)
      DROP_DB=true
      shift
      ;;
    --create-db)
      CREATE_DB=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --help)
      usage
      ;;
    *)
      shift
      ;;
  esac
done

# Check if backup file is provided
if [ -z "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file is required"
  usage
fi

# Construct full path to backup file
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Check if backup file exists
if [ ! -f "$BACKUP_PATH" ]; then
  echo "ERROR: Backup file not found: $BACKUP_PATH"
  exit 1
fi

# Extract database connection details from DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

# Parse the DATABASE_URL to extract connection details
# Format: postgresql://username:password@hostname:port/database?schema=public
DB_USER=$(echo $DATABASE_URL | sed -E 's/^postgresql:\/\/([^:]+):.*/\1/')
DB_PASS=$(echo $DATABASE_URL | sed -E 's/^postgresql:\/\/[^:]+:([^@]+).*/\1/')
DB_HOST=$(echo $DATABASE_URL | sed -E 's/^postgresql:\/\/[^@]+@([^:]+).*/\1/')
DB_PORT=$(echo $DATABASE_URL | sed -E 's/^postgresql:\/\/[^:]+:[^@]+@[^:]+:([0-9]+).*/\1/')
DB_NAME=$(echo $DATABASE_URL | sed -E 's/^postgresql:\/\/[^:]+:[^@]+@[^:]+:[0-9]+\/([^?]+).*/\1/')

# Set PGPASSWORD environment variable to avoid password prompt
export PGPASSWORD="$DB_PASS"

echo "Starting database restore of $DB_NAME on $(date)"
echo "Using backup file: $BACKUP_PATH"

# Debug information
echo "Database connection details:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"

# Check backup file size
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
echo "Backup file size: $BACKUP_SIZE"

# Check if script is running in a non-interactive environment
INTERACTIVE=true
if [ ! -t 0 ]; then
  INTERACTIVE=false
fi

# Verify backup file integrity for gzip files
if [[ "$BACKUP_FILE" == *.gz ]]; then
  if ! gzip -t "$BACKUP_PATH" 2>/dev/null; then
    echo "WARNING: The backup file appears to be corrupted or incomplete"
    
    if [ "$FORCE" = true ]; then
      echo "Continuing with restore due to --force option"
    elif [ "$INTERACTIVE" = true ]; then
      echo "Do you want to continue with the restore? (y/n)"
      read -r response
      if [[ "$response" != "y" ]]; then
        echo "Restore aborted by user"
        exit 1
      fi
    else
      echo "Restore aborted due to corrupted backup file. Use --force to override."
      exit 1
    fi
  fi
fi

# Drop database if requested
if [ "$DROP_DB" = true ]; then
  echo "Dropping database $DB_NAME..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" postgres
fi

# Create database if requested
if [ "$CREATE_DB" = true ]; then
  echo "Creating database $DB_NAME if it doesn't exist..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE \"$DB_NAME\";" postgres || true
fi

# Create a temporary directory for processing
TEMP_DIR=$(mktemp -d)
echo "Created temporary directory: $TEMP_DIR"

# Function to clean up temporary files
cleanup() {
  echo "Cleaning up temporary files..."
  rm -rf "$TEMP_DIR"
  unset PGPASSWORD
}

# Register cleanup function to run on exit
trap cleanup EXIT

# Determine file type and restore accordingly
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "Restoring from compressed backup..."
  
  # First attempt: Try direct restore with errors ignored
  echo "Attempt 1: Direct restore with errors ignored"
  gunzip -c "$BACKUP_PATH" | pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --clean --no-owner --no-comments || true
  
  # Check if restore was successful by querying a table
  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM \"Report\";" > /dev/null 2>&1; then
    echo "Restore appears to be successful!"
  else
    echo "First attempt failed or incomplete. Trying alternative approach..."
    
    # Second attempt: Extract to SQL and filter problematic commands
    echo "Attempt 2: Extract to plain SQL and filter problematic commands"
    PLAIN_SQL="${TEMP_DIR}/backup.sql"
    
    echo "Extracting backup to plain SQL format..."
    gunzip -c "$BACKUP_PATH" > "${TEMP_DIR}/backup.dump"
    
    # Try to convert to plain SQL format
    pg_restore -f "$PLAIN_SQL" "${TEMP_DIR}/backup.dump" || true
    
    if [ -s "$PLAIN_SQL" ]; then
      echo "Filtering problematic commands from SQL..."
      sed -i '/SET transaction_timeout/d' "$PLAIN_SQL"
      
      echo "Restoring filtered SQL file..."
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$PLAIN_SQL" || true
    else
      echo "Failed to convert backup to SQL format. Trying final approach..."
      
      # Third attempt: Use psql with ON_ERROR_STOP=off
      echo "Attempt 3: Using psql with error handling disabled"
      gunzip -c "$BACKUP_PATH" | pg_restore -f "${TEMP_DIR}/dump.sql" || true
      
      if [ -s "${TEMP_DIR}/dump.sql" ]; then
        PSQL_VARS="ON_ERROR_STOP=off"
        echo "Restoring with psql variables: $PSQL_VARS"
        PGOPTIONS="-c $PSQL_VARS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "${TEMP_DIR}/dump.sql" || true
      else
        echo "All restore attempts completed with potential errors."
      fi
    fi
  fi
  
elif [[ "$BACKUP_FILE" == *.sql ]]; then
  echo "Restoring from SQL backup..."
  
  # For SQL files, we can directly filter out problematic lines
  FILTERED_SQL="${TEMP_DIR}/filtered_backup.sql"
  
  echo "Filtering problematic commands from SQL file..."
  grep -v "SET transaction_timeout" "$BACKUP_PATH" > "$FILTERED_SQL"
  
  echo "Restoring filtered SQL file..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$FILTERED_SQL" || true
  
else
  echo "ERROR: Unsupported backup file format. Use .gz or .sql files."
  exit 1
fi

# Verify restore by checking if key tables exist
echo "Verifying database restore..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM \"Report\";" > /dev/null 2>&1; then
  REPORT_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM \"Report\";")
  echo "Restore verification: Found $REPORT_COUNT reports in the database."
  echo "Restore completed successfully at $(date)"
else
  echo "WARNING: Could not verify restore. The 'Report' table may not exist or the restore may have failed."
  echo "Restore process completed with potential issues at $(date)"
fi

echo "You may need to restart your application to reconnect to the database."
