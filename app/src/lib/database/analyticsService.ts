import { db } from './connection';
import { v4 as uuidv4 } from 'uuid';

export interface AnalyticsEvent {
  id?: string;
  user_id?: string;
  session_id?: string;
  event_type: string;
  event_name: string;
  properties?: any;
  page_url?: string;
  referrer?: string;
  ip_address?: string;
  user_agent?: string;
  timestamp?: Date;
}

export interface TradingAnalytics {
  id?: string;
  user_id?: string;
  pair_symbol: string;
  trade_type: string;
  volume_usd: number;
  fee_usd: number;
  slippage: number;
  execution_time_ms: number;
  success: boolean;
  error_message?: string;
  timestamp?: Date;
}

export interface PerformanceMetric {
  id?: string;
  metric_name: string;
  metric_value: number;
  labels?: any;
  timestamp?: Date;
}

export class AnalyticsService {
  // Track user behavior events
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    const query = `
      INSERT INTO user_events (
        id, user_id, session_id, event_type, event_name, properties,
        page_url, referrer, ip_address, user_agent, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    const values = [
      uuidv4(),
      event.user_id,
      event.session_id,
      event.event_type,
      event.event_name,
      JSON.stringify(event.properties || {}),
      event.page_url,
      event.referrer,
      event.ip_address,
      event.user_agent,
      new Date(),
    ];

    await db.analyticsQuery(query, values);

    // Also track in performance metrics for real-time monitoring
    if (event.event_type === 'page_view') {
      await this.trackPerformanceMetric({
        metric_name: 'page_views_total',
        metric_value: 1,
        labels: {
          page: event.page_url,
          user_id: event.user_id,
        },
      });
    }
  }

  // Track trading analytics
  async trackTrade(tradeData: TradingAnalytics): Promise<void> {
    const query = `
      INSERT INTO trading_analytics (
        id, user_id, pair_symbol, trade_type, volume_usd, fee_usd,
        slippage, execution_time_ms, success, error_message, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    const values = [
      uuidv4(),
      tradeData.user_id,
      tradeData.pair_symbol,
      tradeData.trade_type,
      tradeData.volume_usd,
      tradeData.fee_usd,
      tradeData.slippage,
      tradeData.execution_time_ms,
      tradeData.success,
      tradeData.error_message,
      new Date(),
    ];

    await db.analyticsQuery(query, values);

    // Track performance metrics
    await Promise.all([
      this.trackPerformanceMetric({
        metric_name: 'trades_total',
        metric_value: 1,
        labels: {
          pair: tradeData.pair_symbol,
          type: tradeData.trade_type,
          success: tradeData.success,
        },
      }),
      this.trackPerformanceMetric({
        metric_name: 'trading_volume_usd',
        metric_value: tradeData.volume_usd,
        labels: {
          pair: tradeData.pair_symbol,
        },
      }),
      this.trackPerformanceMetric({
        metric_name: 'trading_fees_usd',
        metric_value: tradeData.fee_usd,
        labels: {
          pair: tradeData.pair_symbol,
        },
      }),
    ]);
  }

  // Track performance metrics
  async trackPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    const query = `
      INSERT INTO performance_metrics (id, metric_name, metric_value, labels, timestamp)
      VALUES ($1, $2, $3, $4, $5)
    `;

    const values = [
      uuidv4(),
      metric.metric_name,
      metric.metric_value,
      JSON.stringify(metric.labels || {}),
      new Date(),
    ];

    await db.analyticsQuery(query, values);
  }

  // Track page views
  async trackPageView(data: {
    user_id?: string;
    session_id?: string;
    page_path: string;
    page_title?: string;
    load_time_ms?: number;
    referrer?: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<void> {
    const query = `
      INSERT INTO page_views (
        id, user_id, session_id, page_path, page_title, load_time_ms, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      uuidv4(),
      data.user_id,
      data.session_id,
      data.page_path,
      data.page_title,
      data.load_time_ms,
      new Date(),
    ];

    await db.analyticsQuery(query, values);

    // Track as event as well
    await this.trackEvent({
      user_id: data.user_id,
      session_id: data.session_id,
      event_type: 'page_view',
      event_name: 'page_viewed',
      properties: {
        page_path: data.page_path,
        page_title: data.page_title,
        load_time_ms: data.load_time_ms,
      },
      page_url: data.page_path,
      referrer: data.referrer,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
    });
  }

  // Track errors
  async trackError(data: {
    user_id?: string;
    session_id?: string;
    error_type: string;
    error_message: string;
    stack_trace?: string;
    page_url?: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<void> {
    const query = `
      INSERT INTO error_logs (
        id, user_id, session_id, error_type, error_message, stack_trace, page_url, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const values = [
      uuidv4(),
      data.user_id,
      data.session_id,
      data.error_type,
      data.error_message,
      data.stack_trace,
      data.page_url,
      new Date(),
    ];

    await db.analyticsQuery(query, values);

    // Track as performance metric
    await this.trackPerformanceMetric({
      metric_name: 'errors_total',
      metric_value: 1,
      labels: {
        error_type: data.error_type,
        page: data.page_url,
      },
    });
  }

  // Track feature usage
  async trackFeatureUsage(data: {
    user_id?: string;
    feature_name: string;
  }): Promise<void> {
    const query = `
      INSERT INTO feature_usage (user_id, feature_name, usage_count, last_used, date)
      VALUES ($1, $2, 1, NOW(), CURRENT_DATE)
      ON CONFLICT (user_id, feature_name, date)
      DO UPDATE SET
        usage_count = feature_usage.usage_count + 1,
        last_used = NOW()
    `;

    await db.analyticsQuery(query, [data.user_id, data.feature_name]);

    // Track as event
    await this.trackEvent({
      user_id: data.user_id,
      event_type: 'feature_usage',
      event_name: 'feature_used',
      properties: {
        feature_name: data.feature_name,
      },
    });
  }

  // Get user analytics dashboard data
  async getUserAnalytics(userId: string, days: number = 30): Promise<{
    total_events: number;
    page_views: number;
    features_used: number;
    trades_made: number;
    total_volume: number;
    activity_by_day: any[];
    top_features: any[];
    recent_errors: any[];
  }> {
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get basic stats
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM user_events WHERE user_id = $1 AND timestamp >= $2) as total_events,
        (SELECT COUNT(*) FROM page_views WHERE user_id = $1 AND timestamp >= $2) as page_views,
        (SELECT COUNT(DISTINCT feature_name) FROM feature_usage WHERE user_id = $1 AND last_used >= $2) as features_used,
        (SELECT COUNT(*) FROM trading_analytics WHERE user_id = $1 AND timestamp >= $2) as trades_made,
        (SELECT COALESCE(SUM(volume_usd), 0) FROM trading_analytics WHERE user_id = $1 AND timestamp >= $2) as total_volume
    `;

    const statsResult = await db.analyticsQuery(statsQuery, [userId, fromDate]);
    const stats = statsResult.rows[0];

    // Get activity by day
    const activityQuery = `
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as events,
        COUNT(DISTINCT event_type) as event_types
      FROM user_events
      WHERE user_id = $1 AND timestamp >= $2
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `;

    const activityResult = await db.analyticsQuery(activityQuery, [userId, fromDate]);

    // Get top features
    const featuresQuery = `
      SELECT 
        feature_name,
        SUM(usage_count) as total_usage,
        MAX(last_used) as last_used
      FROM feature_usage
      WHERE user_id = $1 AND last_used >= $2
      GROUP BY feature_name
      ORDER BY total_usage DESC
      LIMIT 10
    `;

    const featuresResult = await db.analyticsQuery(featuresQuery, [userId, fromDate]);

    // Get recent errors
    const errorsQuery = `
      SELECT 
        error_type,
        error_message,
        page_url,
        timestamp
      FROM error_logs
      WHERE user_id = $1 AND timestamp >= $2
      ORDER BY timestamp DESC
      LIMIT 10
    `;

    const errorsResult = await db.analyticsQuery(errorsQuery, [userId, fromDate]);

    return {
      total_events: parseInt(stats.total_events) || 0,
      page_views: parseInt(stats.page_views) || 0,
      features_used: parseInt(stats.features_used) || 0,
      trades_made: parseInt(stats.trades_made) || 0,
      total_volume: parseFloat(stats.total_volume) || 0,
      activity_by_day: activityResult.rows,
      top_features: featuresResult.rows,
      recent_errors: errorsResult.rows,
    };
  }

  // Get platform analytics
  async getPlatformAnalytics(days: number = 7): Promise<{
    total_users: number;
    active_users: number;
    total_trades: number;
    total_volume: number;
    top_pairs: any[];
    user_growth: any[];
    trading_volume_by_day: any[];
    error_rate: number;
  }> {
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Basic platform stats
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
        (SELECT COUNT(DISTINCT user_id) FROM user_events WHERE timestamp >= $1) as active_users,
        (SELECT COUNT(*) FROM trading_analytics WHERE timestamp >= $1) as total_trades,
        (SELECT COALESCE(SUM(volume_usd), 0) FROM trading_analytics WHERE timestamp >= $1) as total_volume,
        (SELECT COUNT(*) FROM error_logs WHERE timestamp >= $1) as total_errors,
        (SELECT COUNT(*) FROM performance_metrics WHERE metric_name = 'page_views_total' AND timestamp >= $1) as total_page_views
    `;

    const statsResult = await db.analyticsQuery(statsQuery, [fromDate]);
    const stats = statsResult.rows[0];

    // Top trading pairs
    const pairsQuery = `
      SELECT 
        pair_symbol,
        COUNT(*) as trade_count,
        SUM(volume_usd) as total_volume
      FROM trading_analytics
      WHERE timestamp >= $1
      GROUP BY pair_symbol
      ORDER BY total_volume DESC
      LIMIT 10
    `;

    const pairsResult = await db.analyticsQuery(pairsQuery, [fromDate]);

    // User growth by day
    const growthQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users
      FROM users
      WHERE created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const growthResult = await db.analyticsQuery(growthQuery, [fromDate]);

    // Trading volume by day
    const volumeQuery = `
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as trade_count,
        SUM(volume_usd) as total_volume
      FROM trading_analytics
      WHERE timestamp >= $1
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;

    const volumeResult = await db.analyticsQuery(volumeQuery, [fromDate]);

    const errorRate = stats.total_page_views > 0 
      ? (parseFloat(stats.total_errors) / parseFloat(stats.total_page_views)) * 100 
      : 0;

    return {
      total_users: parseInt(stats.total_users) || 0,
      active_users: parseInt(stats.active_users) || 0,
      total_trades: parseInt(stats.total_trades) || 0,
      total_volume: parseFloat(stats.total_volume) || 0,
      top_pairs: pairsResult.rows,
      user_growth: growthResult.rows,
      trading_volume_by_day: volumeResult.rows,
      error_rate: parseFloat(errorRate.toFixed(2)),
    };
  }

  // Track user journey
  async startUserJourney(data: {
    user_id?: string;
    session_id: string;
  }): Promise<string> {
    const journeyId = uuidv4();
    
    const query = `
      INSERT INTO user_journeys (id, user_id, session_id, journey_start)
      VALUES ($1, $2, $3, NOW())
    `;

    await db.analyticsQuery(query, [journeyId, data.user_id, data.session_id]);
    
    return journeyId;
  }

  // End user journey
  async endUserJourney(sessionId: string, data: {
    pages_visited: number;
    actions_taken: number;
    conversion_events?: any;
    exit_page?: string;
  }): Promise<void> {
    const query = `
      UPDATE user_journeys
      SET 
        journey_end = NOW(),
        total_duration_seconds = EXTRACT(EPOCH FROM (NOW() - journey_start)),
        pages_visited = $2,
        actions_taken = $3,
        conversion_events = $4,
        exit_page = $5
      WHERE session_id = $1 AND journey_end IS NULL
    `;

    await db.analyticsQuery(query, [
      sessionId,
      data.pages_visited,
      data.actions_taken,
      JSON.stringify(data.conversion_events || {}),
      data.exit_page,
    ]);
  }
}
