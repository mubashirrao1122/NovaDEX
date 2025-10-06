-- Analytics Database Schema
-- Optimized for time-series data and analytics queries

-- User behavior events
CREATE TABLE user_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    session_id VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    properties JSONB,
    page_url TEXT,
    referrer TEXT,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trading analytics
CREATE TABLE trading_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    pair_symbol VARCHAR(20),
    trade_type VARCHAR(20),
    volume_usd DECIMAL(18, 8),
    fee_usd DECIMAL(18, 8),
    slippage DECIMAL(8, 4),
    execution_time_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance metrics
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(18, 8) NOT NULL,
    labels JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Page views and navigation
CREATE TABLE page_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    session_id VARCHAR(255),
    page_path TEXT NOT NULL,
    page_title VARCHAR(255),
    load_time_ms INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error tracking
CREATE TABLE error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    session_id VARCHAR(255),
    error_type VARCHAR(100),
    error_message TEXT,
    stack_trace TEXT,
    page_url TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market data snapshots
CREATE TABLE market_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_symbol VARCHAR(20) NOT NULL,
    price DECIMAL(36, 18) NOT NULL,
    volume_24h DECIMAL(36, 18),
    price_change_24h DECIMAL(8, 4),
    market_cap DECIMAL(18, 8),
    tvl DECIMAL(18, 8),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Liquidity analytics
CREATE TABLE liquidity_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pool_address VARCHAR(44),
    pair_symbol VARCHAR(20),
    tvl_usd DECIMAL(18, 8),
    volume_24h_usd DECIMAL(18, 8),
    fees_24h_usd DECIMAL(18, 8),
    apy DECIMAL(8, 4),
    utilization_rate DECIMAL(8, 4),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User journey tracking
CREATE TABLE user_journeys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    session_id VARCHAR(255) NOT NULL,
    journey_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    journey_end TIMESTAMP WITH TIME ZONE,
    total_duration_seconds INTEGER,
    pages_visited INTEGER DEFAULT 0,
    actions_taken INTEGER DEFAULT 0,
    conversion_events JSONB,
    exit_page TEXT
);

-- Feature usage analytics
CREATE TABLE feature_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    feature_name VARCHAR(100) NOT NULL,
    usage_count INTEGER DEFAULT 1,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date DATE DEFAULT CURRENT_DATE,
    UNIQUE(user_id, feature_name, date)
);

-- Revenue analytics
CREATE TABLE revenue_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    revenue_type VARCHAR(50), -- 'trading_fee', 'premium_subscription', etc.
    amount_usd DECIMAL(18, 8) NOT NULL,
    fee_rate DECIMAL(8, 6),
    transaction_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for analytics queries
CREATE INDEX idx_user_events_user_id ON user_events(user_id);
CREATE INDEX idx_user_events_timestamp ON user_events(timestamp);
CREATE INDEX idx_user_events_event_type ON user_events(event_type);
CREATE INDEX idx_trading_analytics_user_id ON trading_analytics(user_id);
CREATE INDEX idx_trading_analytics_timestamp ON trading_analytics(timestamp);
CREATE INDEX idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX idx_page_views_user_id ON page_views(user_id);
CREATE INDEX idx_page_views_timestamp ON page_views(timestamp);
CREATE INDEX idx_market_snapshots_pair ON market_snapshots(pair_symbol);
CREATE INDEX idx_market_snapshots_timestamp ON market_snapshots(timestamp);

-- Create partitions for large tables (by month)
CREATE TABLE user_events_y2024m01 PARTITION OF user_events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE user_events_y2024m02 PARTITION OF user_events
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- Add more partitions as needed

-- Create materialized views for common analytics queries
CREATE MATERIALIZED VIEW daily_trading_volume AS
SELECT 
    DATE(timestamp) as date,
    pair_symbol,
    SUM(volume_usd) as total_volume,
    COUNT(*) as trade_count,
    AVG(slippage) as avg_slippage
FROM trading_analytics
WHERE timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(timestamp), pair_symbol;

CREATE MATERIALIZED VIEW user_activity_summary AS
SELECT 
    user_id,
    DATE(timestamp) as date,
    COUNT(*) as total_events,
    COUNT(DISTINCT event_type) as unique_event_types,
    MIN(timestamp) as first_activity,
    MAX(timestamp) as last_activity
FROM user_events
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id, DATE(timestamp);

-- Refresh materialized views automatically
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW daily_trading_volume;
    REFRESH MATERIALIZED VIEW user_activity_summary;
END;
$$ LANGUAGE plpgsql;
