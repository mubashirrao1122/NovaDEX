# NovaDex Database Infrastructure

A production-grade database infrastructure for the NovaDex trading platform, featuring PostgreSQL for data persistence, Redis for high-speed caching, comprehensive analytics pipeline, and automated backup systems.

## 🏗️ Architecture Overview

### Core Components

1. **PostgreSQL Main Database** - Primary data storage for users, trades, orders
2. **PostgreSQL Analytics Database** - Optimized for time-series analytics and user behavior tracking
3. **Redis Cache Layer** - High-speed caching for frequently accessed data
4. **Redis Session Store** - Secure session management and user authentication
5. **Analytics Pipeline** - Real-time user behavior and trading analytics
6. **Backup & Recovery System** - Automated backups with S3 integration
7. **Monitoring & Health Checks** - Comprehensive service monitoring

## 📊 Database Schema

### Main Database Tables

- **users** - User profiles and wallet information
- **trades** - Trading transactions and history
- **orders** - Order book and order management
- **liquidity_positions** - Liquidity provider positions
- **portfolio_snapshots** - User portfolio valuations
- **notifications** - User notifications and alerts
- **user_sessions** - Authentication sessions

### Analytics Database Tables

- **user_events** - User interaction events
- **trading_analytics** - Trading performance metrics
- **page_views** - Website navigation analytics
- **performance_metrics** - Platform performance data

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)
- Redis (v6+)
- Docker & Docker Compose (optional)

### Environment Setup

1. Copy environment template:
```bash
cp .env.example .env
```

2. Configure database connections:
```env
# Main Database
DATABASE_URL=postgresql://username:password@localhost:5432/novadex_db

# Analytics Database
ANALYTICS_DATABASE_URL=postgresql://username:password@localhost:5433/novadex_analytics

# Redis
REDIS_URL=redis://localhost:6379
REDIS_SESSION_URL=redis://localhost:6380

# AWS S3 (for backups)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BACKUP_BUCKET=novadex-backups
```

### Database Initialization

1. Create databases:
```bash
# Main database
psql -c "CREATE DATABASE novadex_db;"

# Analytics database
psql -c "CREATE DATABASE novadex_analytics;"
```

2. Initialize schemas:
```bash
# Main database schema
psql -d novadex_db -f database/init/01_schema.sql

# Analytics database schema
psql -d novadex_analytics -f database/analytics/01_analytics_schema.sql
```

3. Install dependencies:
```bash
cd app && npm install
```

## 🐳 Docker Deployment

Start all services with Docker Compose:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL (main database)
- PostgreSQL (analytics database)  
- Redis (cache)
- Redis (sessions)
- Prometheus (monitoring)
- Grafana (dashboards)

## 📈 Services

### Database Connection Layer

```typescript
import { DatabaseConnection } from '@/lib/database/connection';

const db = DatabaseConnection.getInstance();

// Query main database
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Query analytics database
const analytics = await db.analyticsQuery('SELECT * FROM user_events');
```

### User Service

```typescript
import { UserService } from '@/lib/database/userService';

const userService = new UserService();

// Create user
const user = await userService.createUser({
  wallet_address: '0x1234...',
  email: 'user@example.com',
  username: 'trader123'
});

// Create session
const session = await userService.createSession(user.id);
```

### Trading Service

```typescript
import { TradingService } from '@/lib/database/tradingService';

const tradingService = new TradingService();

// Record trade
const trade = await tradingService.createTrade({
  userId: 'user-id',
  type: 'spot',
  side: 'buy',
  baseAsset: 'SOL',
  quoteAsset: 'USDC',
  baseAmount: 1.0,
  quoteAmount: 100.0,
  price: 100.0
});
```

### Analytics Service

```typescript
import { AnalyticsService } from '@/lib/database/analyticsService';

const analyticsService = new AnalyticsService();

// Track user event
await analyticsService.trackEvent({
  userId: 'user-id',
  sessionId: 'session-id',
  eventType: 'trade_executed',
  eventData: { trade_id: 'trade-123' }
});

// Get platform analytics
const analytics = await analyticsService.getPlatformAnalytics();
```

## 🔧 Maintenance

### Backup System

Automated backups run daily and store to AWS S3:

```bash
# Manual backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh backup-file.sql
```

### Testing

Run the comprehensive test suite:

```bash
# Compile TypeScript
npx tsc scripts/test-database-infrastructure.ts --outDir dist

# Run tests
node dist/scripts/test-database-infrastructure.js
```

Test coverage includes:
- Database connectivity
- Schema validation
- CRUD operations
- Analytics tracking
- Backup configuration
- Docker setup
- Environment validation

### Monitoring

Access monitoring dashboards:
- **Health Check**: `http://localhost:3000/api/health`
- **Metrics**: `http://localhost:3000/api/metrics`
- **Grafana**: `http://localhost:3001` (admin/admin)
- **Prometheus**: `http://localhost:9090`

## 📊 Performance Metrics

The system tracks:
- Database connection pool status
- Query performance and latency
- Redis cache hit rates
- Trading volume and user activity
- Error rates and system health
- Memory and CPU usage

## 🛡️ Security Features

- **Parameterized Queries** - SQL injection prevention
- **Connection Pooling** - Resource management
- **Session Security** - Secure session tokens
- **Data Encryption** - Sensitive data protection
- **Access Control** - Role-based permissions
- **Audit Logging** - Comprehensive activity logs

## 🔄 Scalability

The infrastructure is designed for:
- **Horizontal Scaling** - Multiple Redis instances
- **Database Sharding** - Analytics data partitioning
- **Connection Pooling** - Efficient resource usage
- **Caching Strategy** - Multi-layer caching
- **Background Jobs** - Async processing

## 📋 API Endpoints

### Health Check
```
GET /api/health
```
Returns status of all services (database, Redis, memory usage)

### Metrics
```
GET /api/metrics
```
Prometheus-formatted metrics for monitoring

## 🤝 Contributing

1. Run tests before submitting changes
2. Follow TypeScript best practices
3. Document any schema changes
4. Update environment templates as needed

## 📄 License

This database infrastructure is part of the NovaDex project.

---

**Production-Ready Features:**
✅ PostgreSQL with connection pooling  
✅ Redis caching and session management  
✅ Analytics pipeline with time-series optimization  
✅ Automated backup and recovery  
✅ Comprehensive monitoring and health checks  
✅ Docker containerization  
✅ TypeScript type safety  
✅ Integration testing suite  
