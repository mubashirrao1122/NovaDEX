import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/database/connection';

interface MetricsData {
  httpRequestsTotal: number;
  databaseConnections: number;
  cacheHitRate: number;
  tradesTotal: number;
  tradingVolumeUsd: number;
  activeUsers: number;
  errorsTotal: number;
  responseTime01: number;
  responseTime05: number;
  responseTime1: number;
  responseTimeInf: number;
  responseTimeSum: number;
  responseTimeCount: number;
}

// In-memory metrics storage (in production, use Redis or proper metrics store)
let metrics: MetricsData = {
  httpRequestsTotal: 0,
  databaseConnections: 0,
  cacheHitRate: 0,
  tradesTotal: 0,
  tradingVolumeUsd: 0,
  activeUsers: 0,
  errorsTotal: 0,
  responseTime01: 0,
  responseTime05: 0,
  responseTime1: 0,
  responseTimeInf: 0,
  responseTimeSum: 0,
  responseTimeCount: 0,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Update metrics from database
    await updateMetrics();

    // Generate Prometheus format
    const prometheusMetrics = `
# HELP novadex_http_requests_total Total number of HTTP requests
# TYPE novadex_http_requests_total counter
novadex_http_requests_total{method="GET",status="200"} ${metrics.httpRequestsTotal}

# HELP novadex_database_connections_active Active database connections
# TYPE novadex_database_connections_active gauge
novadex_database_connections_active ${metrics.databaseConnections}

# HELP novadex_cache_hit_rate Cache hit rate percentage
# TYPE novadex_cache_hit_rate gauge
novadex_cache_hit_rate ${metrics.cacheHitRate}

# HELP novadex_trades_total Total number of trades
# TYPE novadex_trades_total counter
novadex_trades_total ${metrics.tradesTotal}

# HELP novadex_trading_volume_usd Total trading volume in USD
# TYPE novadex_trading_volume_usd counter
novadex_trading_volume_usd ${metrics.tradingVolumeUsd}

# HELP novadex_active_users_total Number of active users in last 24h
# TYPE novadex_active_users_total gauge
novadex_active_users_total ${metrics.activeUsers}

# HELP novadex_errors_total Total number of errors
# TYPE novadex_errors_total counter
novadex_errors_total ${metrics.errorsTotal}

# HELP novadex_response_time_seconds Response time in seconds
# TYPE novadex_response_time_seconds histogram
novadex_response_time_seconds_bucket{le="0.1"} ${metrics.responseTime01}
novadex_response_time_seconds_bucket{le="0.5"} ${metrics.responseTime05}
novadex_response_time_seconds_bucket{le="1.0"} ${metrics.responseTime1}
novadex_response_time_seconds_bucket{le="+Inf"} ${metrics.responseTimeInf}
novadex_response_time_seconds_sum ${metrics.responseTimeSum}
novadex_response_time_seconds_count ${metrics.responseTimeCount}
    `.trim();

    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(prometheusMetrics);
  } catch (error) {
    console.error('Metrics collection failed:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
}

async function updateMetrics() {
  try {
    // Get database metrics
    const dbMetrics = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM trades) as total_trades,
        (SELECT COALESCE(SUM(quote_amount), 0) FROM trades WHERE status = 'confirmed') as total_volume,
        (SELECT COUNT(DISTINCT user_id) FROM user_events WHERE timestamp >= NOW() - INTERVAL '24 hours') as active_users_24h
    `);

    if (dbMetrics.rows.length > 0) {
      const row = dbMetrics.rows[0];
      metrics.tradesTotal = parseInt(row.total_trades) || 0;
      metrics.tradingVolumeUsd = parseFloat(row.total_volume) || 0;
      metrics.activeUsers = parseInt(row.active_users_24h) || 0;
    }

    // Get error count from analytics
    const errorMetrics = await db.analyticsQuery(`
      SELECT COUNT(*) as error_count
      FROM error_logs
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
    `);

    if (errorMetrics.rows.length > 0) {
      metrics.errorsTotal = parseInt(errorMetrics.rows[0].error_count) || 0;
    }

    // Simulate cache hit rate (in production, get from Redis)
    metrics.cacheHitRate = Math.random() * 100;
    
    // Simulate database connections (in production, get actual count)
    metrics.databaseConnections = Math.floor(Math.random() * 20) + 5;

    // Increment request counter
    metrics.httpRequestsTotal += 1;

  } catch (error) {
    console.error('Failed to update metrics:', error);
  }
}

// Export metrics object for use in other parts of the application
export { metrics };
