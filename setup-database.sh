#!/bin/bash

# NovaDex Database Infrastructure - Quick Deployment Script
# Run this script to set up the complete database infrastructure

set -e

echo "🚀 Setting up NovaDex Database Infrastructure..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env file with your actual credentials before proceeding."
    echo "   Required variables: DATABASE_PASSWORD, AWS credentials, etc."
    read -p "Press Enter to continue after updating .env file..."
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p database/backups
mkdir -p database/logs
mkdir -p monitoring/data

# Set permissions
chmod +x scripts/backup.sh
chmod +x scripts/restore.sh

# Start services with Docker Compose
echo "🐳 Starting services with Docker Compose..."
docker-compose up -d

# Wait for databases to be ready
echo "⏳ Waiting for databases to start..."
sleep 30

# Check if PostgreSQL is ready
echo "🔍 Checking database connections..."
until docker-compose exec -T postgres pg_isready; do
    echo "Waiting for PostgreSQL to be ready..."
    sleep 5
done

until docker-compose exec -T postgres-analytics pg_isready; do
    echo "Waiting for Analytics PostgreSQL to be ready..."
    sleep 5
done

# Initialize database schemas
echo "🗄️  Initializing database schemas..."

# Main database schema
docker-compose exec -T postgres psql -U novadex_user -d novadex_db < database/init/01_schema.sql

# Analytics database schema
docker-compose exec -T postgres-analytics psql -U novadex_user -d novadex_analytics < database/analytics/01_analytics_schema.sql

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
cd app && npm install && cd ..

# Compile TypeScript for testing
echo "🔨 Compiling TypeScript..."
npx tsc scripts/test-database-infrastructure.ts --outDir dist --moduleResolution node --esModuleInterop true --allowSyntheticDefaultImports true --target es2020 --module commonjs

# Run basic connectivity tests
echo "🧪 Running database connectivity tests..."
if node dist/scripts/test-database-infrastructure.js; then
    echo "✅ Database infrastructure setup completed successfully!"
else
    echo "❌ Some tests failed. Check the output above for details."
fi

echo ""
echo "🎉 NovaDex Database Infrastructure is ready!"
echo ""
echo "📊 Access your services:"
echo "   • Health Check: http://localhost:3000/api/health"
echo "   • Metrics: http://localhost:3000/api/metrics"
echo "   • Grafana Dashboard: http://localhost:3001 (admin/admin)"
echo "   • Prometheus: http://localhost:9090"
echo ""
echo "🔧 Useful commands:"
echo "   • View logs: docker-compose logs -f"
echo "   • Stop services: docker-compose down"
echo "   • Backup database: ./scripts/backup.sh"
echo "   • Run tests: node dist/scripts/test-database-infrastructure.js"
echo ""
echo "📚 Documentation: See DATABASE_README.md for detailed usage instructions"
