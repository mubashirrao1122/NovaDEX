-- MEV Protection and Detection Schema
-- Extends the database with MEV protection tracking and detection

-- MEV detection log for tracking front-running attempts
CREATE TABLE IF NOT EXISTS mev_detection_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_pair VARCHAR(20) NOT NULL,
    suspected_order_id UUID REFERENCES order_book_entries(id),
    detection_type VARCHAR(50) NOT NULL, -- 'front_running', 'sandwich', 'arbitrage'
    detected BOOLEAN NOT NULL,
    confidence_score DECIMAL(5, 2) NOT NULL, -- 0-100
    detection_details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevention actions taken
    protection_applied BOOLEAN DEFAULT FALSE,
    protection_type VARCHAR(50), -- 'batch_delay', 'commit_reveal', 'fair_ordering'
    
    -- Impact assessment
    estimated_damage DECIMAL(20, 8), -- Estimated financial impact
    actual_damage DECIMAL(20, 8), -- Actual measured impact
    
    INDEX idx_mev_detection_market_time (market_pair, timestamp DESC),
    INDEX idx_mev_detection_type (detection_type, detected),
    INDEX idx_mev_detection_confidence (confidence_score DESC)
);

-- Batch execution tracking
CREATE TABLE IF NOT EXISTS batch_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id VARCHAR(64) UNIQUE NOT NULL,
    market_pair VARCHAR(20) NOT NULL,
    order_count INTEGER NOT NULL,
    total_volume DECIMAL(20, 8) NOT NULL,
    execution_time TIMESTAMP WITH TIME ZONE NOT NULL,
    planned_execution_time TIMESTAMP WITH TIME ZONE NOT NULL,
    delay_ms INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (execution_time - planned_execution_time)) * 1000
    ) STORED,
    
    -- Fair ordering metrics
    fair_ordering_applied BOOLEAN DEFAULT FALSE,
    randomization_seed VARCHAR(64),
    order_reshuffled_count INTEGER DEFAULT 0,
    
    -- Performance metrics
    gas_used BIGINT,
    average_slippage DECIMAL(8, 4), -- Basis points
    total_fees DECIMAL(20, 8),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'executed', 'failed')),
    failure_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE,
    
    INDEX idx_batch_executions_market_time (market_pair, executed_at DESC),
    INDEX idx_batch_executions_status (status, created_at),
    INDEX idx_batch_executions_performance (average_slippage, total_fees)
);

-- Time-locked orders tracking
CREATE TABLE IF NOT EXISTS time_locked_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES order_book_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lock_duration_ms INTEGER NOT NULL,
    unlock_time TIMESTAMP WITH TIME ZONE NOT NULL,
    unlock_condition JSONB, -- Custom unlock conditions
    
    -- Status
    status VARCHAR(20) DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'expired', 'cancelled')),
    unlocked_at TIMESTAMP WITH TIME ZONE,
    
    -- Lock metadata
    lock_reason VARCHAR(50), -- 'mev_protection', 'user_request', 'regulatory'
    lock_level VARCHAR(20) DEFAULT 'standard', -- 'standard', 'high', 'maximum'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_time_locked_unlock_time (unlock_time),
    INDEX idx_time_locked_user_status (user_id, status),
    INDEX idx_time_locked_order (order_id)
);

-- MEV protection statistics
CREATE TABLE IF NOT EXISTS mev_protection_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    market_pair VARCHAR(20) NOT NULL,
    
    -- Protection metrics
    total_orders INTEGER DEFAULT 0,
    protected_orders INTEGER DEFAULT 0,
    protection_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE WHEN total_orders > 0 THEN (protected_orders::DECIMAL / total_orders * 100) ELSE 0 END
    ) STORED,
    
    -- Detection metrics
    front_running_attempts INTEGER DEFAULT 0,
    sandwich_attacks_detected INTEGER DEFAULT 0,
    arbitrage_attempts INTEGER DEFAULT 0,
    
    -- Prevention success
    attacks_prevented INTEGER DEFAULT 0,
    estimated_savings DECIMAL(20, 8) DEFAULT 0,
    
    -- Performance impact
    average_commit_time_ms INTEGER DEFAULT 0,
    average_batch_delay_ms INTEGER DEFAULT 0,
    user_satisfaction_score DECIMAL(3, 2), -- 1-5 rating
    
    -- Volume metrics
    protected_volume DECIMAL(20, 8) DEFAULT 0,
    total_volume DECIMAL(20, 8) DEFAULT 0,
    volume_protection_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE WHEN total_volume > 0 THEN (protected_volume / total_volume * 100) ELSE 0 END
    ) STORED,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date, market_pair),
    INDEX idx_mev_stats_date_market (date DESC, market_pair),
    INDEX idx_mev_stats_protection_rate (protection_rate DESC)
);

-- Functions for MEV protection analytics

-- Function to calculate MEV protection effectiveness
CREATE OR REPLACE FUNCTION calculate_mev_protection_effectiveness(
    p_market_pair VARCHAR(20) DEFAULT NULL,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    market_pair VARCHAR(20),
    total_orders BIGINT,
    protected_orders BIGINT,
    protection_rate DECIMAL(5, 2),
    attacks_detected BIGINT,
    attacks_prevented BIGINT,
    prevention_rate DECIMAL(5, 2),
    estimated_savings DECIMAL(20, 8),
    average_delay_ms DECIMAL(8, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mps.market_pair,
        SUM(mps.total_orders) as total_orders,
        SUM(mps.protected_orders) as protected_orders,
        CASE 
            WHEN SUM(mps.total_orders) > 0 
            THEN (SUM(mps.protected_orders)::DECIMAL / SUM(mps.total_orders) * 100)::DECIMAL(5,2)
            ELSE 0::DECIMAL(5,2)
        END as protection_rate,
        SUM(mps.front_running_attempts + mps.sandwich_attacks_detected + mps.arbitrage_attempts) as attacks_detected,
        SUM(mps.attacks_prevented) as attacks_prevented,
        CASE 
            WHEN SUM(mps.front_running_attempts + mps.sandwich_attacks_detected + mps.arbitrage_attempts) > 0 
            THEN (SUM(mps.attacks_prevented)::DECIMAL / SUM(mps.front_running_attempts + mps.sandwich_attacks_detected + mps.arbitrage_attempts) * 100)::DECIMAL(5,2)
            ELSE 0::DECIMAL(5,2)
        END as prevention_rate,
        SUM(mps.estimated_savings) as estimated_savings,
        AVG(mps.average_batch_delay_ms)::DECIMAL(8,2) as average_delay_ms
    FROM mev_protection_stats mps
    WHERE mps.date BETWEEN p_start_date AND p_end_date
    AND (p_market_pair IS NULL OR mps.market_pair = p_market_pair)
    GROUP BY mps.market_pair
    ORDER BY protection_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to detect potential MEV opportunities
CREATE OR REPLACE FUNCTION detect_mev_opportunity(
    p_market_pair VARCHAR(20),
    p_order_data JSONB
)
RETURNS TABLE (
    mev_type VARCHAR(50),
    risk_level VARCHAR(20),
    confidence DECIMAL(5, 2),
    recommendation VARCHAR(100),
    protection_suggested VARCHAR(50)
) AS $$
DECLARE
    v_price DECIMAL(20, 8);
    v_quantity DECIMAL(20, 8);
    v_side order_side;
    v_recent_volume DECIMAL(20, 8);
    v_price_volatility DECIMAL(8, 4);
    v_liquidity_depth DECIMAL(20, 8);
BEGIN
    -- Extract order parameters
    v_price := (p_order_data->>'price')::DECIMAL(20, 8);
    v_quantity := (p_order_data->>'quantity')::DECIMAL(20, 8);
    v_side := (p_order_data->>'side')::order_side;
    
    -- Calculate recent trading activity
    SELECT 
        COALESCE(SUM(quantity), 0),
        COALESCE(STDDEV(price), 0),
        COALESCE(SUM(CASE WHEN side != v_side THEN quantity ELSE 0 END), 0)
    INTO v_recent_volume, v_price_volatility, v_liquidity_depth
    FROM order_book_entries
    WHERE market_pair = p_market_pair
    AND created_at >= NOW() - INTERVAL '5 minutes'
    AND status = 'active';
    
    -- Check for front-running risk
    IF v_quantity * v_price > 10000 AND v_liquidity_depth < v_quantity * 2 THEN
        RETURN QUERY SELECT 
            'front_running'::VARCHAR(50),
            'high'::VARCHAR(20),
            85.0::DECIMAL(5, 2),
            'Large order with low liquidity depth'::VARCHAR(100),
            'commit_reveal'::VARCHAR(50);
    END IF;
    
    -- Check for sandwich attack risk
    IF v_price_volatility > v_price * 0.01 AND v_recent_volume > v_quantity * 10 THEN
        RETURN QUERY SELECT 
            'sandwich_attack'::VARCHAR(50),
            'medium'::VARCHAR(20),
            65.0::DECIMAL(5, 2),
            'High volatility with significant volume'::VARCHAR(100),
            'batch_execution'::VARCHAR(50);
    END IF;
    
    -- Check for arbitrage opportunity
    IF EXISTS (
        SELECT 1 FROM market_snapshots 
        WHERE market_pair = p_market_pair 
        AND timestamp >= NOW() - INTERVAL '30 seconds'
        AND ABS(last_price - v_price) / v_price > 0.005 -- 0.5% price difference
    ) THEN
        RETURN QUERY SELECT 
            'arbitrage'::VARCHAR(50),
            'low'::VARCHAR(20),
            45.0::DECIMAL(5, 2),
            'Price difference detected across markets'::VARCHAR(100),
            'time_lock'::VARCHAR(50);
    END IF;
    
    -- If no specific risks detected, return low risk
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            'none'::VARCHAR(50),
            'low'::VARCHAR(20),
            10.0::DECIMAL(5, 2),
            'No significant MEV risks detected'::VARCHAR(100),
            'standard'::VARCHAR(50);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily MEV protection statistics
CREATE OR REPLACE FUNCTION update_daily_mev_stats()
RETURNS VOID AS $$
DECLARE
    market_rec RECORD;
BEGIN
    -- Update stats for each market pair
    FOR market_rec IN 
        SELECT DISTINCT market_pair 
        FROM order_book_entries 
        WHERE DATE(created_at) = CURRENT_DATE
    LOOP
        INSERT INTO mev_protection_stats (
            date, market_pair, total_orders, protected_orders,
            front_running_attempts, sandwich_attacks_detected, arbitrage_attempts,
            attacks_prevented, estimated_savings, average_commit_time_ms,
            average_batch_delay_ms, protected_volume, total_volume
        )
        SELECT 
            CURRENT_DATE,
            market_rec.market_pair,
            COUNT(*) as total_orders,
            COUNT(*) FILTER (WHERE protection_level != 'none') as protected_orders,
            (SELECT COUNT(*) FROM mev_detection_log 
             WHERE market_pair = market_rec.market_pair 
             AND DATE(timestamp) = CURRENT_DATE 
             AND detection_type = 'front_running' AND detected = true) as front_running_attempts,
            (SELECT COUNT(*) FROM mev_detection_log 
             WHERE market_pair = market_rec.market_pair 
             AND DATE(timestamp) = CURRENT_DATE 
             AND detection_type = 'sandwich' AND detected = true) as sandwich_attacks_detected,
            (SELECT COUNT(*) FROM mev_detection_log 
             WHERE market_pair = market_rec.market_pair 
             AND DATE(timestamp) = CURRENT_DATE 
             AND detection_type = 'arbitrage' AND detected = true) as arbitrage_attempts,
            (SELECT COUNT(*) FROM mev_detection_log 
             WHERE market_pair = market_rec.market_pair 
             AND DATE(timestamp) = CURRENT_DATE 
             AND protection_applied = true) as attacks_prevented,
            (SELECT COALESCE(SUM(estimated_damage), 0) FROM mev_detection_log 
             WHERE market_pair = market_rec.market_pair 
             AND DATE(timestamp) = CURRENT_DATE 
             AND protection_applied = true) as estimated_savings,
            (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (reveal_deadline - created_at)) * 1000), 0)
             FROM order_book_entries 
             WHERE market_pair = market_rec.market_pair 
             AND DATE(created_at) = CURRENT_DATE 
             AND protection_level != 'none') as average_commit_time_ms,
            (SELECT COALESCE(AVG(delay_ms), 0) FROM batch_executions 
             WHERE market_pair = market_rec.market_pair 
             AND DATE(executed_at) = CURRENT_DATE) as average_batch_delay_ms,
            (SELECT COALESCE(SUM(quantity * COALESCE(price, 0)), 0) FROM order_book_entries 
             WHERE market_pair = market_rec.market_pair 
             AND DATE(created_at) = CURRENT_DATE 
             AND protection_level != 'none') as protected_volume,
            (SELECT COALESCE(SUM(quantity * COALESCE(price, 0)), 0) FROM order_book_entries 
             WHERE market_pair = market_rec.market_pair 
             AND DATE(created_at) = CURRENT_DATE) as total_volume
        FROM order_book_entries 
        WHERE market_pair = market_rec.market_pair 
        AND DATE(created_at) = CURRENT_DATE
        ON CONFLICT (date, market_pair) 
        DO UPDATE SET
            total_orders = EXCLUDED.total_orders,
            protected_orders = EXCLUDED.protected_orders,
            front_running_attempts = EXCLUDED.front_running_attempts,
            sandwich_attacks_detected = EXCLUDED.sandwich_attacks_detected,
            arbitrage_attempts = EXCLUDED.arbitrage_attempts,
            attacks_prevented = EXCLUDED.attacks_prevented,
            estimated_savings = EXCLUDED.estimated_savings,
            average_commit_time_ms = EXCLUDED.average_commit_time_ms,
            average_batch_delay_ms = EXCLUDED.average_batch_delay_ms,
            protected_volume = EXCLUDED.protected_volume,
            total_volume = EXCLUDED.total_volume;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily stats update (would typically be done via cron or scheduler)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('update-mev-stats', '0 1 * * *', 'SELECT update_daily_mev_stats();');

-- Indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_book_protection_level ON order_book_entries(protection_level, market_pair, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_book_batch_id ON order_book_entries(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_book_commit_hash ON order_book_entries(commit_hash) WHERE commit_hash IS NOT NULL;
