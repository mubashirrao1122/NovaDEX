import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/database/connection';

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime: number;
      error?: string;
    };
    analytics: {
      status: 'healthy' | 'unhealthy';
      responseTime: number;
      error?: string;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      responseTime: number;
      error?: string;
    };
    sessions: {
      status: 'healthy' | 'unhealthy';
      responseTime: number;
      error?: string;
    };
  };
  metrics: {
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    activeConnections: number;
    cacheHitRate: number;
  };
}

let startTime = Date.now();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthCheck>
) {
  const healthCheck: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Date.now() - startTime,
    services: {
      database: { status: 'healthy', responseTime: 0 },
      analytics: { status: 'healthy', responseTime: 0 },
      redis: { status: 'healthy', responseTime: 0 },
      sessions: { status: 'healthy', responseTime: 0 },
    },
    metrics: {
      memoryUsage: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      activeConnections: 0,
      cacheHitRate: 0,
    },
  };

  try {
    // Check database health
    const dbStart = Date.now();
    const dbHealth = await db.healthCheck();
    const dbTime = Date.now() - dbStart;

    healthCheck.services.database = {
      status: dbHealth.postgres ? 'healthy' : 'unhealthy',
      responseTime: dbTime,
      error: dbHealth.postgres ? undefined : 'Database connection failed',
    };

    healthCheck.services.analytics = {
      status: dbHealth.analytics ? 'healthy' : 'unhealthy',
      responseTime: dbTime,
      error: dbHealth.analytics ? undefined : 'Analytics database connection failed',
    };

    healthCheck.services.redis = {
      status: dbHealth.redis ? 'healthy' : 'unhealthy',
      responseTime: dbTime,
      error: dbHealth.redis ? undefined : 'Redis connection failed',
    };

    healthCheck.services.sessions = {
      status: dbHealth.sessions ? 'healthy' : 'unhealthy',
      responseTime: dbTime,
      error: dbHealth.sessions ? undefined : 'Session Redis connection failed',
    };

    // Calculate overall health status
    const unhealthyServices = Object.values(healthCheck.services).filter(
      service => service.status === 'unhealthy'
    );

    if (unhealthyServices.length === 0) {
      healthCheck.status = 'healthy';
    } else if (unhealthyServices.length < Object.keys(healthCheck.services).length) {
      healthCheck.status = 'degraded';
    } else {
      healthCheck.status = 'unhealthy';
    }

    // Get memory usage
    const memUsage = process.memoryUsage();
    healthCheck.metrics.memoryUsage = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    };

    // Set appropriate status code
    const statusCode = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 207 : 503;

    res.status(statusCode).json(healthCheck);
  } catch (error) {
    console.error('Health check failed:', error);
    
    healthCheck.status = 'unhealthy';
    healthCheck.services.database.status = 'unhealthy';
    healthCheck.services.database.error = error instanceof Error ? error.message : 'Unknown error';

    res.status(503).json(healthCheck);
  }
}
