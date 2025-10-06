-- Advanced Order Types Schema
-- Supports stop-loss, take-profit, trailing stops, and conditional orders

-- Conditional orders table
CREATE TABLE IF NOT EXISTS conditional_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_pair VARCHAR(20) NOT NULL,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('stop_loss', 'take_profit', 'trailing_stop', 'conditional', 'oco')),
    side order_side NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    
    -- Price parameters
    limit_price DECIMAL(20, 8), -- Execution price for limit orders
    stop_price DECIMAL(20, 8), -- Trigger price for stop orders
    take_profit_price DECIMAL(20, 8), -- Target price for take profit
    
    -- Trailing stop parameters
    trail_amount DECIMAL(20, 8), -- Fixed trail amount
    trail_percent DECIMAL(5, 4), -- Trail percentage (0.0001 = 0.01%)
    trail_high_water_mark DECIMAL(20, 8), -- Best price achieved for trailing
    
    -- Trigger conditions (flexible JSON structure)
    trigger_condition JSONB,
    
    -- Execution state
    is_triggered BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMP WITH TIME ZONE,
    triggered_price DECIMAL(20, 8),
    executed_order_id UUID, -- Reference to the actual executed order
    
    -- Order relationships (for OCO orders)
    parent_order_id UUID,
    child_order_ids UUID[],
    
    -- Status and lifecycle
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'filled', 'cancelled', 'expired', 'failed')),
    cancellation_reason VARCHAR(50),
    error_message TEXT,
    
    -- Execution parameters
    time_in_force VARCHAR(10) DEFAULT 'GTC' CHECK (time_in_force IN ('GTC', 'IOC', 'FOK', 'GTD')),
    expires_at TIMESTAMP WITH TIME ZONE,
    reduce_only BOOLEAN DEFAULT FALSE, -- Only reduce position size
    post_only BOOLEAN DEFAULT FALSE, -- Only add liquidity
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_checked_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT positive_quantity CHECK (quantity > 0),
    CONSTRAINT valid_prices CHECK (
        (limit_price IS NULL OR limit_price > 0) AND
        (stop_price IS NULL OR stop_price > 0) AND
        (take_profit_price IS NULL OR take_profit_price > 0)
    ),
    CONSTRAINT valid_trail_params CHECK (
        (trail_amount IS NULL OR trail_amount > 0) AND
        (trail_percent IS NULL OR (trail_percent > 0 AND trail_percent <= 100))
    )
);

-- Indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conditional_orders_user_status ON conditional_orders(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conditional_orders_market_status ON conditional_orders(market_pair, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conditional_orders_type_status ON conditional_orders(order_type, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conditional_orders_expires_at ON conditional_orders(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conditional_orders_parent ON conditional_orders(parent_order_id) WHERE parent_order_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conditional_orders_triggered ON conditional_orders(is_triggered, triggered_at);

-- GIN index for trigger conditions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conditional_orders_trigger_conditions ON conditional_orders USING GIN (trigger_condition);

-- Order execution history
CREATE TABLE IF NOT EXISTS conditional_order_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conditional_order_id UUID NOT NULL REFERENCES conditional_orders(id) ON DELETE CASCADE,
    executed_order_id UUID NOT NULL REFERENCES order_book_entries(id),
    execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('full', 'partial')),
    executed_quantity DECIMAL(20, 8) NOT NULL,
    executed_price DECIMAL(20, 8) NOT NULL,
    remaining_quantity DECIMAL(20, 8) NOT NULL,
    fees DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Market conditions at execution
    market_price DECIMAL(20, 8),
    slippage_bps DECIMAL(8, 4), -- Slippage in basis points
    liquidity_impact DECIMAL(8, 4), -- Market impact in basis points
    
    -- Execution metadata
    execution_delay_ms INTEGER, -- Time from trigger to execution
    execution_method VARCHAR(20) DEFAULT 'automatic', -- 'automatic', 'manual', 'forced'
    
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_conditional_executions_order (conditional_order_id, timestamp DESC),
    INDEX idx_conditional_executions_price (executed_price, timestamp DESC)
);

-- Position tracking for risk management
CREATE TABLE IF NOT EXISTS user_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_pair VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('long', 'short')),
    size DECIMAL(20, 8) NOT NULL DEFAULT 0,
    average_price DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- P&L tracking
    unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
    realized_pnl DECIMAL(20, 8) DEFAULT 0,
    total_pnl DECIMAL(20, 8) GENERATED ALWAYS AS (unrealized_pnl + realized_pnl) STORED,
    
    -- Risk metrics
    margin_used DECIMAL(20, 8) DEFAULT 0,
    maintenance_margin DECIMAL(20, 8) DEFAULT 0,
    liquidation_price DECIMAL(20, 8),
    leverage DECIMAL(8, 4) DEFAULT 1.0,
    
    -- Position metadata
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, market_pair),
    CONSTRAINT positive_size CHECK (size >= 0),
    CONSTRAINT valid_leverage CHECK (leverage > 0 AND leverage <= 100)
);

-- Index for position queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_user_market ON user_positions(user_id, market_pair);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_positions_liquidation ON user_positions(liquidation_price) WHERE liquidation_price IS NOT NULL;

-- Order type analytics
CREATE TABLE IF NOT EXISTS order_type_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    market_pair VARCHAR(20) NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    
    -- Volume metrics
    total_orders INTEGER DEFAULT 0,
    total_volume DECIMAL(20, 8) DEFAULT 0,
    average_order_size DECIMAL(20, 8) DEFAULT 0,
    
    -- Success metrics
    triggered_orders INTEGER DEFAULT 0,
    filled_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    expired_orders INTEGER DEFAULT 0,
    
    -- Performance metrics
    trigger_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE WHEN total_orders > 0 THEN (triggered_orders::DECIMAL / total_orders * 100) ELSE 0 END
    ) STORED,
    fill_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE WHEN triggered_orders > 0 THEN (filled_orders::DECIMAL / triggered_orders * 100) ELSE 0 END
    ) STORED,
    
    -- Timing metrics
    average_trigger_delay_ms INTEGER DEFAULT 0,
    average_execution_delay_ms INTEGER DEFAULT 0,
    
    -- Slippage metrics
    average_slippage_bps DECIMAL(8, 4) DEFAULT 0,
    max_slippage_bps DECIMAL(8, 4) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date, market_pair, order_type),
    INDEX idx_order_analytics_date_market (date DESC, market_pair),
    INDEX idx_order_analytics_performance (trigger_rate DESC, fill_rate DESC)
);

-- Functions for advanced order management

-- Function to check if order should be triggered
CREATE OR REPLACE FUNCTION should_trigger_order(
    p_order_id UUID,
    p_current_price DECIMAL(20, 8)
) RETURNS BOOLEAN AS $$
DECLARE
    order_rec RECORD;
    trigger_cond JSONB;
    should_trigger BOOLEAN := FALSE;
BEGIN
    -- Get order details
    SELECT * INTO order_rec
    FROM conditional_orders
    WHERE id = p_order_id AND status = 'active';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check basic price triggers
    CASE order_rec.order_type
        WHEN 'stop_loss' THEN
            IF order_rec.side = 'sell' AND p_current_price <= order_rec.stop_price THEN
                should_trigger := TRUE;
            ELSIF order_rec.side = 'buy' AND p_current_price >= order_rec.stop_price THEN
                should_trigger := TRUE;
            END IF;
            
        WHEN 'take_profit' THEN
            IF order_rec.side = 'sell' AND p_current_price >= order_rec.take_profit_price THEN
                should_trigger := TRUE;
            ELSIF order_rec.side = 'buy' AND p_current_price <= order_rec.take_profit_price THEN
                should_trigger := TRUE;
            END IF;
            
        WHEN 'trailing_stop' THEN
            -- Trailing stop logic would be handled by the application
            should_trigger := FALSE;
            
        WHEN 'conditional' THEN
            -- Custom trigger conditions
            trigger_cond := order_rec.trigger_condition;
            IF trigger_cond IS NOT NULL THEN
                -- Basic price condition check
                IF trigger_cond->>'type' = 'price' THEN
                    CASE trigger_cond->>'operator'
                        WHEN 'gte' THEN
                            should_trigger := p_current_price >= (trigger_cond->>'value')::DECIMAL;
                        WHEN 'lte' THEN
                            should_trigger := p_current_price <= (trigger_cond->>'value')::DECIMAL;
                        WHEN 'eq' THEN
                            should_trigger := ABS(p_current_price - (trigger_cond->>'value')::DECIMAL) < 0.01;
                        ELSE
                            should_trigger := FALSE;
                    END CASE;
                END IF;
            END IF;
    END CASE;
    
    RETURN should_trigger;
END;
$$ LANGUAGE plpgsql;

-- Function to update position after order execution
CREATE OR REPLACE FUNCTION update_position_after_execution(
    p_user_id UUID,
    p_market_pair VARCHAR(20),
    p_side order_side,
    p_quantity DECIMAL(20, 8),
    p_price DECIMAL(20, 8)
) RETURNS VOID AS $$
DECLARE
    current_position RECORD;
    new_size DECIMAL(20, 8);
    new_avg_price DECIMAL(20, 8);
    position_side VARCHAR(10);
BEGIN
    -- Determine position side from order side
    position_side := CASE WHEN p_side = 'buy' THEN 'long' ELSE 'short' END;
    
    -- Get current position
    SELECT * INTO current_position
    FROM user_positions
    WHERE user_id = p_user_id AND market_pair = p_market_pair;
    
    IF FOUND THEN
        -- Update existing position
        IF current_position.side = position_side THEN
            -- Increasing position
            new_size := current_position.size + p_quantity;
            new_avg_price := ((current_position.size * current_position.average_price) + 
                             (p_quantity * p_price)) / new_size;
        ELSE
            -- Reducing opposite position
            IF current_position.size > p_quantity THEN
                -- Partial reduction
                new_size := current_position.size - p_quantity;
                new_avg_price := current_position.average_price; -- Keep same avg price
            ELSE
                -- Position flip
                new_size := p_quantity - current_position.size;
                new_avg_price := p_price;
                position_side := CASE WHEN current_position.side = 'long' THEN 'short' ELSE 'long' END;
            END IF;
        END IF;
        
        -- Update position
        UPDATE user_positions
        SET size = new_size,
            average_price = new_avg_price,
            side = position_side,
            last_updated = NOW()
        WHERE user_id = p_user_id AND market_pair = p_market_pair;
    ELSE
        -- Create new position
        INSERT INTO user_positions (
            user_id, market_pair, side, size, average_price
        ) VALUES (
            p_user_id, p_market_pair, position_side, p_quantity, p_price
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate order analytics
CREATE OR REPLACE FUNCTION calculate_order_type_analytics(
    p_date DATE DEFAULT CURRENT_DATE,
    p_market_pair VARCHAR(20) DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    market_rec RECORD;
    order_type_rec RECORD;
BEGIN
    -- Loop through market pairs
    FOR market_rec IN 
        SELECT DISTINCT market_pair 
        FROM conditional_orders 
        WHERE DATE(created_at) = p_date
        AND (p_market_pair IS NULL OR market_pair = p_market_pair)
    LOOP
        -- Loop through order types
        FOR order_type_rec IN 
            SELECT DISTINCT order_type 
            FROM conditional_orders 
            WHERE market_pair = market_rec.market_pair 
            AND DATE(created_at) = p_date
        LOOP
            INSERT INTO order_type_analytics (
                date, market_pair, order_type, total_orders, total_volume,
                average_order_size, triggered_orders, filled_orders,
                cancelled_orders, expired_orders, average_trigger_delay_ms,
                average_execution_delay_ms, average_slippage_bps, max_slippage_bps
            )
            SELECT 
                p_date,
                market_rec.market_pair,
                order_type_rec.order_type,
                COUNT(*) as total_orders,
                SUM(quantity * COALESCE(limit_price, stop_price, take_profit_price, 0)) as total_volume,
                AVG(quantity) as average_order_size,
                COUNT(*) FILTER (WHERE is_triggered = true) as triggered_orders,
                COUNT(*) FILTER (WHERE status = 'filled') as filled_orders,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
                COUNT(*) FILTER (WHERE status = 'expired') as expired_orders,
                AVG(EXTRACT(EPOCH FROM (triggered_at - created_at)) * 1000) 
                    FILTER (WHERE triggered_at IS NOT NULL) as average_trigger_delay_ms,
                (SELECT AVG(execution_delay_ms) 
                 FROM conditional_order_executions coe 
                 WHERE coe.conditional_order_id IN (
                     SELECT id FROM conditional_orders co2 
                     WHERE co2.market_pair = market_rec.market_pair 
                     AND co2.order_type = order_type_rec.order_type 
                     AND DATE(co2.created_at) = p_date
                 )) as average_execution_delay_ms,
                (SELECT AVG(slippage_bps) 
                 FROM conditional_order_executions coe 
                 WHERE coe.conditional_order_id IN (
                     SELECT id FROM conditional_orders co2 
                     WHERE co2.market_pair = market_rec.market_pair 
                     AND co2.order_type = order_type_rec.order_type 
                     AND DATE(co2.created_at) = p_date
                 )) as average_slippage_bps,
                (SELECT MAX(slippage_bps) 
                 FROM conditional_order_executions coe 
                 WHERE coe.conditional_order_id IN (
                     SELECT id FROM conditional_orders co2 
                     WHERE co2.market_pair = market_rec.market_pair 
                     AND co2.order_type = order_type_rec.order_type 
                     AND DATE(co2.created_at) = p_date
                 )) as max_slippage_bps
            FROM conditional_orders
            WHERE market_pair = market_rec.market_pair 
            AND order_type = order_type_rec.order_type
            AND DATE(created_at) = p_date
            ON CONFLICT (date, market_pair, order_type) 
            DO UPDATE SET
                total_orders = EXCLUDED.total_orders,
                total_volume = EXCLUDED.total_volume,
                average_order_size = EXCLUDED.average_order_size,
                triggered_orders = EXCLUDED.triggered_orders,
                filled_orders = EXCLUDED.filled_orders,
                cancelled_orders = EXCLUDED.cancelled_orders,
                expired_orders = EXCLUDED.expired_orders,
                average_trigger_delay_ms = EXCLUDED.average_trigger_delay_ms,
                average_execution_delay_ms = EXCLUDED.average_execution_delay_ms,
                average_slippage_bps = EXCLUDED.average_slippage_bps,
                max_slippage_bps = EXCLUDED.max_slippage_bps;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update positions automatically
CREATE OR REPLACE FUNCTION trigger_update_position()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'filled' AND OLD.status != 'filled' THEN
        PERFORM update_position_after_execution(
            NEW.user_id,
            NEW.market_pair,
            NEW.side,
            NEW.quantity,
            COALESCE(NEW.limit_price, NEW.triggered_price, NEW.stop_price, NEW.take_profit_price)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_conditional_order_position_update
    AFTER UPDATE ON conditional_orders
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_position();

-- Create a view for active conditional orders summary
CREATE OR REPLACE VIEW active_conditional_orders_summary AS
SELECT 
    market_pair,
    order_type,
    side,
    COUNT(*) as count,
    SUM(quantity) as total_quantity,
    AVG(quantity) as avg_quantity,
    MIN(COALESCE(stop_price, take_profit_price, limit_price)) as min_price,
    MAX(COALESCE(stop_price, take_profit_price, limit_price)) as max_price,
    COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= NOW() + INTERVAL '1 hour') as expiring_soon
FROM conditional_orders
WHERE status = 'active'
GROUP BY market_pair, order_type, side
ORDER BY market_pair, order_type, side;
