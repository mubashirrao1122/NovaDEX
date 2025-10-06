import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';

// Database configuration
const dbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'novadex_db',
  user: process.env.DATABASE_USER || 'novadex_user',
  password: process.env.DATABASE_PASSWORD || 'your_password',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const analyticsDbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5433'),
  database: 'novadex_analytics',
  user: 'analytics_user',
  password: process.env.ANALYTICS_DB_PASSWORD || 'analytics_password',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
};

// Database pools
export const mainDbPool = new Pool(dbConfig);
export const analyticsDbPool = new Pool(analyticsDbConfig);

// Redis clients
export const redisClient = new Redis(redisConfig);
export const sessionRedis = new Redis({
  ...redisConfig,
  port: 6380, // Different port for sessions
  db: 1,
});

// Database connection class
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private mainPool: Pool;
  private analyticsPool: Pool;
  private redis: Redis;
  private sessionRedis: Redis;

  private constructor() {
    this.mainPool = mainDbPool;
    this.analyticsPool = analyticsDbPool;
    this.redis = redisClient;
    this.sessionRedis = sessionRedis;
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  // Main database operations
  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.mainPool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  // Analytics database operations
  async analyticsQuery(text: string, params?: any[]): Promise<any> {
    const client = await this.analyticsPool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  // Transaction support
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.mainPool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Redis operations
  async setCache(key: string, value: any, expirationSeconds?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (expirationSeconds) {
      await this.redis.setex(key, expirationSeconds, serializedValue);
    } else {
      await this.redis.set(key, serializedValue);
    }
  }

  async getCache(key: string): Promise<any> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async deleteCache(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async setCachePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // Session operations
  async setSession(sessionId: string, data: any, expirationSeconds: number = 86400): Promise<void> {
    const serializedData = JSON.stringify(data);
    await this.sessionRedis.setex(sessionId, expirationSeconds, serializedData);
  }

  async getSession(sessionId: string): Promise<any> {
    const data = await this.sessionRedis.get(sessionId);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionRedis.del(sessionId);
  }

  // Health check
  async healthCheck(): Promise<{ postgres: boolean; analytics: boolean; redis: boolean; sessions: boolean }> {
    const checks = {
      postgres: false,
      analytics: false,
      redis: false,
      sessions: false,
    };

    try {
      await this.query('SELECT 1');
      checks.postgres = true;
    } catch (error) {
      console.error('PostgreSQL health check failed:', error);
    }

    try {
      await this.analyticsQuery('SELECT 1');
      checks.analytics = true;
    } catch (error) {
      console.error('Analytics DB health check failed:', error);
    }

    try {
      await this.redis.ping();
      checks.redis = true;
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    try {
      await this.sessionRedis.ping();
      checks.sessions = true;
    } catch (error) {
      console.error('Session Redis health check failed:', error);
    }

    return checks;
  }

  // Graceful shutdown
  async close(): Promise<void> {
    await Promise.all([
      this.mainPool.end(),
      this.analyticsPool.end(),
      this.redis.disconnect(),
      this.sessionRedis.disconnect(),
    ]);
  }
}

// Export singleton instance
export const db = DatabaseConnection.getInstance();

// Cache keys constants
export const CACHE_KEYS = {
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  USER_BALANCE: (userId: string) => `user:balance:${userId}`,
  TRADING_PAIRS: 'trading:pairs',
  TOKEN_PRICES: 'tokens:prices',
  MARKET_DATA: (symbol: string) => `market:${symbol}`,
  LIQUIDITY_POOLS: 'liquidity:pools',
  USER_TRADES: (userId: string) => `user:trades:${userId}`,
  USER_ORDERS: (userId: string) => `user:orders:${userId}`,
  PORTFOLIO: (userId: string) => `portfolio:${userId}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
};

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  USER_PROFILE: 300, // 5 minutes
  USER_BALANCE: 60, // 1 minute
  TRADING_PAIRS: 3600, // 1 hour
  TOKEN_PRICES: 30, // 30 seconds
  MARKET_DATA: 60, // 1 minute
  LIQUIDITY_POOLS: 300, // 5 minutes
  USER_TRADES: 300, // 5 minutes
  USER_ORDERS: 60, // 1 minute
  PORTFOLIO: 120, // 2 minutes
  SESSION: 86400, // 24 hours
};
