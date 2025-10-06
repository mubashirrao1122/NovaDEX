-- Enhanced Order Book Schema for Real-Time Trading
-- Extends the existing database schema with advanced order book functionality

-- Order book entries for real-time bid/ask management
CREATE TABLE IF NOT EXISTS order_book_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_pair VARCHAR(20) NOT NULL, -- e.g., 'SOL/USDC'
    side order_side NOT NULL, -- 'buy' or 'sell'
    price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    filled_quantity DECIMAL(20, 8) DEFAULT 0,
    remaining_quantity DECIMAL(20, 8) GENERATED ALWAYS AS (quantity - filled_quantity) STORED,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_type VARCHAR(20) DEFAULT 'limit' CHECK (order_type IN ('limit', 'market', 'stop_loss', 'take_profit', 'trailing_stop')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'partial', 'filled', 'cancelled', 'expired')),
    time_in_force VARCHAR(10) DEFAULT 'GTC' CHECK (time_in_force IN ('GTC', 'IOC', 'FOK', 'GTD')), -- Good Till Cancelled, Immediate or Cancel, Fill or Kill, Good Till Date
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- MEV Protection fields
    commit_hash VARCHAR(64), -- For commit-reveal scheme
    reveal_deadline TIMESTAMP WITH TIME ZONE,
    is_revealed BOOLEAN DEFAULT FALSE,
    protection_level VARCHAR(20) DEFAULT 'standard' CHECK (protection_level IN ('none', 'standard', 'maximum')),
    
    -- Advanced order parameters
    stop_price DECIMAL(20, 8), -- For stop orders
    trail_amount DECIMAL(20, 8), -- For trailing stops
    trail_percent DECIMAL(5, 4), -- Trail percentage (0.0001 = 0.01%)
    trigger_condition JSONB, -- Flexible conditions for advanced orders
    
    -- Order metadata
    client_order_id VARCHAR(64),
    signature VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    filled_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance indexes
    CONSTRAINT positive_price CHECK (price > 0),
    CONSTRAINT positive_quantity CHECK (quantity > 0),
    CONSTRAINT valid_filled_quantity CHECK (filled_quantity >= 0 AND filled_quantity <= quantity)
);

-- Indexes for high-performance order book operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_book_market_side_price ON order_book_entries(market_pair, side, price);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_book_status_created ON order_book_entries(status, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_book_user_status ON order_book_entries(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_book_expires_at ON order_book_entries(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_book_mev_protection ON order_book_entries(protection_level, reveal_deadline);

-- Order book depth aggregation for fast market data
CREATE MATERIALIZED VIEW order_book_depth AS
SELECT 
    market_pair,
    side,
    price,
    SUM(remaining_quantity) as total_quantity,
    COUNT(*) as order_count,
    MAX(created_at) as latest_order_time
FROM order_book_entries 
WHERE status = 'active' AND remaining_quantity > 0
GROUP BY market_pair, side, price
ORDER BY market_pair, side, 
    CASE WHEN side = 'buy' THEN price END DESC,
    CASE WHEN side = 'sell' THEN price END ASC;

-- Index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_book_depth_unique ON order_book_depth(market_pair, side, price);

-- Trade executions with detailed matching information
CREATE TABLE IF NOT EXISTS trade_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_pair VARCHAR(20) NOT NULL,
    taker_order_id UUID NOT NULL REFERENCES order_book_entries(id),
    maker_order_id UUID NOT NULL REFERENCES order_book_entries(id),
    taker_user_id UUID NOT NULL REFERENCES users(id),
    maker_user_id UUID NOT NULL REFERENCES users(id),
    side order_side NOT NULL, -- Side from taker's perspective
    price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    taker_fee DECIMAL(20, 8) NOT NULL DEFAULT 0,
    maker_fee DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- MEV protection info
    protection_applied BOOLEAN DEFAULT FALSE,
    batch_id UUID, -- For batched executions
    execution_delay_ms INTEGER DEFAULT 0,
    
    -- Market data
    mid_price DECIMAL(20, 8), -- Mid price at execution time
    spread DECIMAL(20, 8), -- Bid-ask spread
    
    -- Execution metadata
    execution_id VARCHAR(64) UNIQUE NOT NULL,
    block_number BIGINT,
    transaction_hash VARCHAR(66),
    gas_used INTEGER,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_execution_price CHECK (price > 0),
    CONSTRAINT positive_execution_quantity CHECK (quantity > 0)
);

-- Indexes for trade execution queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_executions_market_time ON trade_executions(market_pair, executed_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_executions_taker_user ON trade_executions(taker_user_id, executed_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_executions_maker_user ON trade_executions(maker_user_id, executed_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trade_executions_batch ON trade_executions(batch_id) WHERE batch_id IS NOT NULL;

-- Market data snapshots for real-time updates
CREATE TABLE IF NOT EXISTS market_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_pair VARCHAR(20) NOT NULL,
    best_bid DECIMAL(20, 8),
    best_ask DECIMAL(20, 8),
    bid_size DECIMAL(20, 8),
    ask_size DECIMAL(20, 8),
    mid_price DECIMAL(20, 8) GENERATED ALWAYS AS ((best_bid + best_ask) / 2) STORED,
    spread DECIMAL(20, 8) GENERATED ALWAYS AS (best_ask - best_bid) STORED,
    spread_bps DECIMAL(8, 4) GENERATED ALWAYS AS (((best_ask - best_bid) / ((best_bid + best_ask) / 2)) * 10000) STORED,
    
    -- Volume data
    volume_24h DECIMAL(20, 8) DEFAULT 0,
    trades_24h INTEGER DEFAULT 0,
    last_price DECIMAL(20, 8),
    price_change_24h DECIMAL(20, 8),
    price_change_percent_24h DECIMAL(8, 4),
    
    -- Liquidity metrics
    total_bid_liquidity DECIMAL(20, 8) DEFAULT 0,
    total_ask_liquidity DECIMAL(20, 8) DEFAULT 0,
    liquidity_depth_1pct DECIMAL(20, 8), -- Liquidity within 1% of mid price
    liquidity_depth_5pct DECIMAL(20, 8), -- Liquidity within 5% of mid price
    
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_market_prices CHECK (
        (best_bid IS NULL OR best_bid > 0) AND 
        (best_ask IS NULL OR best_ask > 0) AND
        (best_bid IS NULL OR best_ask IS NULL OR best_bid <= best_ask)
    )
);

-- Index for latest market data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_snapshots_pair_time ON market_snapshots(market_pair, timestamp DESC);

-- Order book level 2 data (aggregated by price levels)
CREATE TABLE IF NOT EXISTS order_book_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_pair VARCHAR(20) NOT NULL,
    side order_side NOT NULL,
    price_level DECIMAL(20, 8) NOT NULL,
    total_quantity DECIMAL(20, 8) NOT NULL,
    order_count INTEGER NOT NULL,
    avg_order_size DECIMAL(20, 8) GENERATED ALWAYS AS (total_quantity / NULLIF(order_count, 0)) STORED,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(market_pair, side, price_level, timestamp)
);

-- Index for order book level 2 data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_book_levels_market_side ON order_book_levels(market_pair, side, price_level);

-- Functions for order book operations

-- Function to get current order book depth
CREATE OR REPLACE FUNCTION get_order_book_depth(
    p_market_pair VARCHAR(20),
    p_depth_levels INTEGER DEFAULT 20
)
RETURNS TABLE (
    side order_side,
    price DECIMAL(20, 8),
    quantity DECIMAL(20, 8),
    order_count BIGINT,
    cumulative_quantity DECIMAL(20, 8)
) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_orders AS (
        SELECT 
            obd.side,
            obd.price,
            obd.total_quantity as quantity,
            obd.order_count,
            ROW_NUMBER() OVER (
                PARTITION BY obd.side 
                ORDER BY 
                    CASE WHEN obd.side = 'buy' THEN obd.price END DESC,
                    CASE WHEN obd.side = 'sell' THEN obd.price END ASC
            ) as rank
        FROM order_book_depth obd
        WHERE obd.market_pair = p_market_pair
    )
    SELECT 
        ro.side,
        ro.price,
        ro.quantity,
        ro.order_count,
        SUM(ro.quantity) OVER (
            PARTITION BY ro.side 
            ORDER BY 
                CASE WHEN ro.side = 'buy' THEN ro.price END DESC,
                CASE WHEN ro.side = 'sell' THEN ro.price END ASC
            ROWS UNBOUNDED PRECEDING
        ) as cumulative_quantity
    FROM ranked_orders ro
    WHERE ro.rank <= p_depth_levels
    ORDER BY ro.side DESC, 
        CASE WHEN ro.side = 'buy' THEN ro.price END DESC,
        CASE WHEN ro.side = 'sell' THEN ro.price END ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate market impact
CREATE OR REPLACE FUNCTION calculate_market_impact(
    p_market_pair VARCHAR(20),
    p_side order_side,
    p_quantity DECIMAL(20, 8)
)
RETURNS TABLE (
    average_price DECIMAL(20, 8),
    total_cost DECIMAL(20, 8),
    price_impact_bps DECIMAL(8, 4),
    liquidity_available BOOLEAN
) AS $$
DECLARE
    v_market_price DECIMAL(20, 8);
    v_total_cost DECIMAL(20, 8) := 0;
    v_remaining_qty DECIMAL(20, 8) := p_quantity;
    v_weighted_price DECIMAL(20, 8) := 0;
    v_total_filled DECIMAL(20, 8) := 0;
    order_rec RECORD;
BEGIN
    -- Get current market price (mid price)
    SELECT (best_bid + best_ask) / 2 INTO v_market_price
    FROM market_snapshots 
    WHERE market_pair = p_market_pair 
    ORDER BY timestamp DESC LIMIT 1;
    
    -- Walk through order book to calculate impact
    FOR order_rec IN 
        SELECT price, total_quantity
        FROM order_book_depth
        WHERE market_pair = p_market_pair 
        AND side = CASE WHEN p_side = 'buy' THEN 'sell' ELSE 'buy' END
        ORDER BY 
            CASE WHEN p_side = 'buy' THEN price END ASC,
            CASE WHEN p_side = 'sell' THEN price END DESC
    LOOP
        DECLARE
            v_fill_qty DECIMAL(20, 8);
        BEGIN
            v_fill_qty := LEAST(v_remaining_qty, order_rec.total_quantity);
            v_total_cost := v_total_cost + (v_fill_qty * order_rec.price);
            v_total_filled := v_total_filled + v_fill_qty;
            v_remaining_qty := v_remaining_qty - v_fill_qty;
            
            EXIT WHEN v_remaining_qty <= 0;
        END;
    END LOOP;
    
    IF v_total_filled > 0 THEN
        v_weighted_price := v_total_cost / v_total_filled;
    END IF;
    
    RETURN QUERY SELECT 
        v_weighted_price,
        v_total_cost,
        CASE 
            WHEN v_market_price > 0 THEN 
                ABS((v_weighted_price - v_market_price) / v_market_price * 10000)
            ELSE 0 
        END as impact_bps,
        v_remaining_qty = 0 as liquidity_sufficient;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update order book depth materialized view
CREATE OR REPLACE FUNCTION refresh_order_book_depth()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY order_book_depth;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for real-time order book updates
CREATE OR REPLACE TRIGGER trigger_refresh_order_book
    AFTER INSERT OR UPDATE OR DELETE ON order_book_entries
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_order_book_depth();

-- Function to update market snapshot
CREATE OR REPLACE FUNCTION update_market_snapshot(p_market_pair VARCHAR(20))
RETURNS VOID AS $$
DECLARE
    v_best_bid DECIMAL(20, 8);
    v_best_ask DECIMAL(20, 8);
    v_bid_size DECIMAL(20, 8);
    v_ask_size DECIMAL(20, 8);
    v_volume_24h DECIMAL(20, 8);
    v_trades_24h INTEGER;
    v_last_price DECIMAL(20, 8);
BEGIN
    -- Get best bid
    SELECT price, total_quantity INTO v_best_bid, v_bid_size
    FROM order_book_depth
    WHERE market_pair = p_market_pair AND side = 'buy'
    ORDER BY price DESC LIMIT 1;
    
    -- Get best ask
    SELECT price, total_quantity INTO v_best_ask, v_ask_size
    FROM order_book_depth
    WHERE market_pair = p_market_pair AND side = 'sell'
    ORDER BY price ASC LIMIT 1;
    
    -- Get 24h volume and trades
    SELECT 
        COALESCE(SUM(quantity), 0),
        COUNT(*)
    INTO v_volume_24h, v_trades_24h
    FROM trade_executions
    WHERE market_pair = p_market_pair 
    AND executed_at >= NOW() - INTERVAL '24 hours';
    
    -- Get last trade price
    SELECT price INTO v_last_price
    FROM trade_executions
    WHERE market_pair = p_market_pair
    ORDER BY executed_at DESC LIMIT 1;
    
    -- Insert new snapshot
    INSERT INTO market_snapshots (
        market_pair, best_bid, best_ask, bid_size, ask_size,
        volume_24h, trades_24h, last_price
    ) VALUES (
        p_market_pair, v_best_bid, v_best_ask, v_bid_size, v_ask_size,
        v_volume_24h, v_trades_24h, v_last_price
    );
END;
$$ LANGUAGE plpgsql;
