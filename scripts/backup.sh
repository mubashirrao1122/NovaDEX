#!/bin/bash

# NovaDex Database Backup Script
# This script creates automated backups of PostgreSQL databases

set -e

# Configuration
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

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
S3_REGION="${BACKUP_S3_REGION:-us-east-1}"

# Create backup directory
mkdir -p $BACKUP_DIR

echo "Starting NovaDex database backup at $(date)"

# Function to backup a database
backup_database() {
    local host=$1
    local port=$2
    local database=$3
    local user=$4
    local backup_name=$5
    
    echo "Backing up $database..."
    
    # Create SQL dump
    PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
        -h $host \
        -p $port \
        -U $user \
        -d $database \
        --verbose \
        --no-owner \
        --no-privileges \
        --format=custom \
        --file="$BACKUP_DIR/${backup_name}_${DATE}.dump"
    
    # Compress backup
    gzip "$BACKUP_DIR/${backup_name}_${DATE}.dump"
    
    echo "✓ $database backup completed: ${backup_name}_${DATE}.dump.gz"
}

# Function to backup Redis data
backup_redis() {
    echo "Backing up Redis data..."
    
    # Create Redis backup
    redis-cli --rdb "$BACKUP_DIR/redis_backup_${DATE}.rdb"
    gzip "$BACKUP_DIR/redis_backup_${DATE}.rdb"
    
    echo "✓ Redis backup completed: redis_backup_${DATE}.rdb.gz"
}

# Backup main database
backup_database $DB_MAIN_HOST $DB_MAIN_PORT $DB_MAIN_NAME $DB_MAIN_USER "novadex_main"

# Backup analytics database
backup_database $DB_ANALYTICS_HOST $DB_ANALYTICS_PORT $DB_ANALYTICS_NAME $DB_ANALYTICS_USER "novadex_analytics"

# Backup Redis data
backup_redis

# Create backup manifest
cat > "$BACKUP_DIR/manifest_${DATE}.json" << EOF
{
    "backup_date": "$(date -Iseconds)",
    "backup_type": "full",
    "databases": {
        "main": {
            "file": "novadex_main_${DATE}.dump.gz",
            "database": "$DB_MAIN_NAME",
            "host": "$DB_MAIN_HOST",
            "port": "$DB_MAIN_PORT"
        },
        "analytics": {
            "file": "novadex_analytics_${DATE}.dump.gz",
            "database": "$DB_ANALYTICS_NAME",
            "host": "$DB_ANALYTICS_HOST",
            "port": "$DB_ANALYTICS_PORT"
        },
        "redis": {
            "file": "redis_backup_${DATE}.rdb.gz",
            "type": "redis_rdb"
        }
    },
    "retention_days": $RETENTION_DAYS,
    "s3_bucket": "$S3_BUCKET"
}
EOF

echo "✓ Backup manifest created: manifest_${DATE}.json"

# Upload to S3 if configured
if [ ! -z "$AWS_ACCESS_KEY_ID" ] && [ ! -z "$S3_BUCKET" ]; then
    echo "Uploading backups to S3..."
    
    aws s3 cp "$BACKUP_DIR/novadex_main_${DATE}.dump.gz" "s3://$S3_BUCKET/database-backups/"
    aws s3 cp "$BACKUP_DIR/novadex_analytics_${DATE}.dump.gz" "s3://$S3_BUCKET/database-backups/"
    aws s3 cp "$BACKUP_DIR/redis_backup_${DATE}.rdb.gz" "s3://$S3_BUCKET/database-backups/"
    aws s3 cp "$BACKUP_DIR/manifest_${DATE}.json" "s3://$S3_BUCKET/database-backups/"
    
    echo "✓ Backups uploaded to S3"
fi

# Clean up old backups
echo "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find $BACKUP_DIR -name "*.dump.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.rdb.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "manifest_*.json" -mtime +$RETENTION_DAYS -delete

# Clean up old S3 backups if configured
if [ ! -z "$AWS_ACCESS_KEY_ID" ] && [ ! -z "$S3_BUCKET" ]; then
    CUTOFF_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
    aws s3 ls "s3://$S3_BUCKET/database-backups/" | while read -r line; do
        file_date=$(echo $line | awk '{print $4}' | grep -o '[0-9]\{8\}' | head -1)
        if [ ! -z "$file_date" ] && [ "$file_date" -lt "$CUTOFF_DATE" ]; then
            file_name=$(echo $line | awk '{print $4}')
            aws s3 rm "s3://$S3_BUCKET/database-backups/$file_name"
            echo "Deleted old S3 backup: $file_name"
        fi
    done
fi

echo "✓ Cleanup completed"

# Generate backup report
MAIN_SIZE=$(du -h "$BACKUP_DIR/novadex_main_${DATE}.dump.gz" | cut -f1)
ANALYTICS_SIZE=$(du -h "$BACKUP_DIR/novadex_analytics_${DATE}.dump.gz" | cut -f1)
REDIS_SIZE=$(du -h "$BACKUP_DIR/redis_backup_${DATE}.rdb.gz" | cut -f1)

echo "
📊 Backup Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Date: $(date)
🗄️  Main Database: $MAIN_SIZE
📈 Analytics Database: $ANALYTICS_SIZE
🔴 Redis Data: $REDIS_SIZE
💾 Total Backup Size: $(du -sh $BACKUP_DIR/*_${DATE}* | awk '{total+=$1} END {print total}')
🌐 S3 Upload: $([ ! -z "$AWS_ACCESS_KEY_ID" ] && echo "✓ Enabled" || echo "✗ Disabled")
🗑️  Retention: $RETENTION_DAYS days
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"

echo "✅ NovaDex database backup completed successfully at $(date)"

# If this is running in Docker, keep the container alive for monitoring
if [ "$1" = "daemon" ]; then
    echo "Running in daemon mode. Starting cron scheduler..."
    
    # Create crontab for scheduled backups
    echo "${BACKUP_SCHEDULE:-0 2 * * *} /backup.sh" | crontab -
    
    # Start cron daemon
    cron -f
else
    exit 0
fi
