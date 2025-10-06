#!/bin/bash

# NovaDex Database Restore Script
# This script restores PostgreSQL databases from backups

set -e

# Configuration
BACKUP_DIR="/backups"
RESTORE_DATE=""
SOURCE="local" # local or s3

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --date)
            RESTORE_DATE="$2"
            shift 2
            ;;
        --source)
            SOURCE="$2"
            shift 2
            ;;
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --date YYYYMMDD_HHMMSS    Specific backup date to restore"
            echo "  --source local|s3         Restore from local files or S3"
            echo "  --backup-dir PATH         Backup directory path"
            echo "  --help                    Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Database configurations
DB_MAIN_HOST="${DATABASE_HOST:-localhost}"
DB_MAIN_PORT="${DATABASE_PORT:-5432}"
DB_MAIN_NAME="${DATABASE_NAME:-novadex_db}"
DB_MAIN_USER="${DATABASE_USER:-novadex_user}"

DB_ANALYTICS_HOST="${DATABASE_HOST:-localhost}"
DB_ANALYTICS_PORT="5433"
DB_ANALYTICS_NAME="novadex_analytics"
DB_ANALYTICS_USER="analytics_user"

# S3 Configuration
S3_BUCKET="${BACKUP_S3_BUCKET:-novadex-backups}"

echo "Starting NovaDex database restore process..."

# Function to find latest backup if no date specified
find_latest_backup() {
    if [ -z "$RESTORE_DATE" ]; then
        echo "No date specified, finding latest backup..."
        if [ "$SOURCE" = "s3" ]; then
            RESTORE_DATE=$(aws s3 ls "s3://$S3_BUCKET/database-backups/" | grep "manifest_" | sort | tail -1 | awk '{print $4}' | grep -o '[0-9]\{8\}_[0-9]\{6\}')
        else
            RESTORE_DATE=$(ls $BACKUP_DIR/manifest_*.json 2>/dev/null | sort | tail -1 | grep -o '[0-9]\{8\}_[0-9]\{6\}')
        fi
        
        if [ -z "$RESTORE_DATE" ]; then
            echo "❌ No backup files found!"
            exit 1
        fi
        
        echo "📅 Using latest backup: $RESTORE_DATE"
    fi
}

# Function to download from S3 if needed
download_from_s3() {
    if [ "$SOURCE" = "s3" ]; then
        echo "📥 Downloading backups from S3..."
        mkdir -p $BACKUP_DIR
        
        aws s3 cp "s3://$S3_BUCKET/database-backups/manifest_${RESTORE_DATE}.json" "$BACKUP_DIR/"
        aws s3 cp "s3://$S3_BUCKET/database-backups/novadex_main_${RESTORE_DATE}.dump.gz" "$BACKUP_DIR/"
        aws s3 cp "s3://$S3_BUCKET/database-backups/novadex_analytics_${RESTORE_DATE}.dump.gz" "$BACKUP_DIR/"
        aws s3 cp "s3://$S3_BUCKET/database-backups/redis_backup_${RESTORE_DATE}.rdb.gz" "$BACKUP_DIR/"
        
        echo "✓ Files downloaded from S3"
    fi
}

# Function to validate backup files
validate_backups() {
    echo "🔍 Validating backup files..."
    
    local manifest_file="$BACKUP_DIR/manifest_${RESTORE_DATE}.json"
    local main_backup="$BACKUP_DIR/novadex_main_${RESTORE_DATE}.dump.gz"
    local analytics_backup="$BACKUP_DIR/novadex_analytics_${RESTORE_DATE}.dump.gz"
    local redis_backup="$BACKUP_DIR/redis_backup_${RESTORE_DATE}.rdb.gz"
    
    if [ ! -f "$manifest_file" ]; then
        echo "❌ Manifest file not found: $manifest_file"
        exit 1
    fi
    
    if [ ! -f "$main_backup" ]; then
        echo "❌ Main database backup not found: $main_backup"
        exit 1
    fi
    
    if [ ! -f "$analytics_backup" ]; then
        echo "❌ Analytics database backup not found: $analytics_backup"
        exit 1
    fi
    
    if [ ! -f "$redis_backup" ]; then
        echo "❌ Redis backup not found: $redis_backup"
        exit 1
    fi
    
    echo "✓ All backup files validated"
}

# Function to restore a database
restore_database() {
    local host=$1
    local port=$2
    local database=$3
    local user=$4
    local backup_file=$5
    local restore_name=$6
    
    echo "🔄 Restoring $restore_name database..."
    
    # Extract backup file
    gunzip -c "$backup_file" > "/tmp/${restore_name}_restore.dump"
    
    # Drop existing database (with confirmation)
    echo "⚠️  This will DROP the existing database: $database"
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Restore cancelled."
        exit 1
    fi
    
    # Terminate active connections
    PGPASSWORD=$POSTGRES_PASSWORD psql \
        -h $host \
        -p $port \
        -U postgres \
        -d postgres \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$database' AND pid <> pg_backend_pid();"
    
    # Drop and recreate database
    PGPASSWORD=$POSTGRES_PASSWORD dropdb \
        -h $host \
        -p $port \
        -U postgres \
        --if-exists \
        $database
    
    PGPASSWORD=$POSTGRES_PASSWORD createdb \
        -h $host \
        -p $port \
        -U postgres \
        -O $user \
        $database
    
    # Restore from backup
    PGPASSWORD=$POSTGRES_PASSWORD pg_restore \
        -h $host \
        -p $port \
        -U $user \
        -d $database \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        "/tmp/${restore_name}_restore.dump"
    
    # Clean up temp file
    rm "/tmp/${restore_name}_restore.dump"
    
    echo "✓ $restore_name database restored successfully"
}

# Function to restore Redis data
restore_redis() {
    echo "🔄 Restoring Redis data..."
    
    # Extract Redis backup
    gunzip -c "$BACKUP_DIR/redis_backup_${RESTORE_DATE}.rdb.gz" > "/tmp/redis_restore.rdb"
    
    # Stop Redis temporarily and replace RDB file
    echo "⚠️  Redis will be temporarily stopped for restore"
    redis-cli SHUTDOWN NOSAVE || true
    sleep 2
    
    # Copy backup file to Redis data directory
    cp "/tmp/redis_restore.rdb" "/var/lib/redis/dump.rdb"
    chown redis:redis "/var/lib/redis/dump.rdb"
    
    # Start Redis
    redis-server --daemonize yes
    sleep 3
    
    # Verify Redis is running
    redis-cli ping
    
    # Clean up temp file
    rm "/tmp/redis_restore.rdb"
    
    echo "✓ Redis data restored successfully"
}

# Main restore process
find_latest_backup
download_from_s3
validate_backups

echo "
🚨 DATABASE RESTORE WARNING 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This will COMPLETELY REPLACE your existing databases with backup data from:
📅 Date: $RESTORE_DATE
🗄️  Source: $SOURCE

ALL CURRENT DATA WILL BE LOST!

Current databases to be restored:
- Main Database: $DB_MAIN_NAME
- Analytics Database: $DB_ANALYTICS_NAME
- Redis Data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"

read -p "Type 'RESTORE' in capitals to confirm: " -r
if [[ ! $REPLY = "RESTORE" ]]; then
    echo "Restore cancelled. You must type 'RESTORE' exactly."
    exit 1
fi

echo "🚀 Starting restore process..."

# Restore main database
restore_database $DB_MAIN_HOST $DB_MAIN_PORT $DB_MAIN_NAME $DB_MAIN_USER \
    "$BACKUP_DIR/novadex_main_${RESTORE_DATE}.dump.gz" "main"

# Restore analytics database
restore_database $DB_ANALYTICS_HOST $DB_ANALYTICS_PORT $DB_ANALYTICS_NAME $DB_ANALYTICS_USER \
    "$BACKUP_DIR/novadex_analytics_${RESTORE_DATE}.dump.gz" "analytics"

# Restore Redis data
restore_redis

echo "
✅ DATABASE RESTORE COMPLETED SUCCESSFULLY!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Restored from: $RESTORE_DATE
🕐 Completed at: $(date)
🗄️  Main Database: Restored
📈 Analytics Database: Restored
🔴 Redis Data: Restored
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 Next steps:
1. Restart your application services
2. Verify data integrity
3. Check application functionality
4. Monitor for any issues
"
