-- Portfolio Analytics Schema
-- Supports detailed P&L tracking, performance metrics, and risk analysis

-- Portfolio positions aggregated from all sources
CREATE TABLE IF NOT EXISTS portfolio_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Position identification
    asset VARCHAR(20) NOT NULL, -- Asset symbol (BTC, ETH, USDC, etc.)
    position_type VARCHAR(20) NOT NULL CHECK (
        position_type IN ('spot', 'margin', 'futures', 'vault', 'pool', 'bridge')
    ),
    
    -- Position details
    quantity DECIMAL(30, 18) NOT NULL DEFAULT 0, -- Position size
    average_entry_price DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Average entry price
    current_price DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Current market price
    market_value DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Current market value
    
    -- P&L tracking
    unrealized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Unrealized profit/loss
    unrealized_pnl_percentage DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Unrealized P&L %
    realized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Realized profit/loss
    total_pnl DECIMAL(20, 8) GENERATED ALWAYS AS (unrealized_pnl + realized_pnl) STORED,
    
    -- Performance metrics
    roi DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Return on investment %
    holding_period DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Holding period in days
    
    -- Position metadata
    source_reference UUID, -- Reference to source position (vault_id, pool_id, etc.)
    source_type VARCHAR(50), -- Source system identifier
    
    -- Position status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_quantity CHECK (quantity >= 0),
    CONSTRAINT positive_market_value CHECK (market_value >= 0),
    
    UNIQUE(user_id, asset, position_type) DEFERRABLE INITIALLY DEFERRED,
    INDEX idx_portfolio_positions_user (user_id, is_active),
    INDEX idx_portfolio_positions_asset (asset, is_active),
    INDEX idx_portfolio_positions_type (position_type, is_active),
    INDEX idx_portfolio_positions_value (market_value DESC) WHERE is_active = true,
    INDEX idx_portfolio_positions_pnl (total_pnl DESC) WHERE is_active = true
);

-- Daily portfolio P&L records
CREATE TABLE IF NOT EXISTS portfolio_daily_pnl (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Daily P&L breakdown
    realized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
    unrealized_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0,
    total_pnl DECIMAL(20, 8) GENERATED ALWAYS AS (realized_pnl + unrealized_pnl) STORED,
    
    -- Asset-wise P&L (JSON structure)
    asset_pnl JSONB NOT NULL DEFAULT '{}', -- {asset: pnl_amount}
    
    -- Activity-wise P&L breakdown
    trading_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0, -- P&L from spot/margin trading
    vault_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0, -- P&L from yield farming vaults
    liquidity_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0, -- P&L from liquidity provision
    bridge_pnl DECIMAL(20, 8) NOT NULL DEFAULT 0, -- P&L from bridge operations
    
    -- Portfolio metrics
    portfolio_value DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Total portfolio value
    day_change DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Daily change in value
    day_change_percentage DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Daily change %
    
    -- Performance calculation fields
    week_change DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Weekly change
    week_change_percentage DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Weekly change %
    month_change DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Monthly change
    month_change_percentage DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Monthly change %
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, date),
    INDEX idx_portfolio_daily_pnl_user (user_id, date DESC),
    INDEX idx_portfolio_daily_pnl_date (date DESC),
    INDEX idx_portfolio_daily_pnl_performance (day_change_percentage DESC)
);

-- Portfolio risk metrics
CREATE TABLE IF NOT EXISTS portfolio_risk_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Risk measures
    value_at_risk DECIMAL(20, 8) NOT NULL DEFAULT 0, -- 1-day VaR at 95% confidence
    expected_shortfall DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Expected shortfall (CVaR)
    max_drawdown DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Maximum drawdown %
    volatility DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Portfolio volatility (30-day)
    sharpe_ratio DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Risk-adjusted return
    beta DECIMAL(6, 4) NOT NULL DEFAULT 1.0, -- Market beta
    
    -- Concentration risk metrics
    concentration_risk DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Herfindahl index (0-100)
    largest_position DECIMAL(5, 2) NOT NULL DEFAULT 0, -- Largest position as % of portfolio
    
    -- Risk contributions by asset (JSON structure)
    asset_risk_contributions JSONB NOT NULL DEFAULT '{}', -- {asset: risk_contribution}
    
    -- Additional risk metrics
    tracking_error DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Tracking error vs benchmark
    information_ratio DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Information ratio
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, date),
    INDEX idx_portfolio_risk_metrics_user (user_id, date DESC),
    INDEX idx_portfolio_risk_metrics_date (date DESC),
    INDEX idx_portfolio_risk_metrics_risk (value_at_risk DESC, concentration_risk DESC)
);

-- Portfolio performance metrics by period
CREATE TABLE IF NOT EXISTS portfolio_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period VARCHAR(10) NOT NULL CHECK (period IN ('1d', '7d', '30d', '90d', '1y', 'all')),
    calculation_date DATE NOT NULL,
    
    -- Return metrics
    total_return DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Total return %
    annualized_return DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Annualized return %
    cagr DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Compound Annual Growth Rate
    
    -- Risk-adjusted returns
    sharpe_ratio DECIMAL(8, 4) NOT NULL DEFAULT 0,
    sortino_ratio DECIMAL(8, 4) NOT NULL DEFAULT 0,
    calmar_ratio DECIMAL(8, 4) NOT NULL DEFAULT 0,
    
    -- Risk metrics
    volatility DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Annualized volatility
    max_drawdown DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Maximum drawdown %
    average_drawdown DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Average drawdown %
    drawdown_duration DECIMAL(8, 2) NOT NULL DEFAULT 0, -- Average recovery time (days)
    
    -- Trading performance
    win_rate DECIMAL(5, 2) NOT NULL DEFAULT 0, -- Winning trades %
    profit_factor DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Gross profit / Gross loss
    average_win DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Average winning trade
    average_loss DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Average losing trade
    largest_win DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Largest winning trade
    largest_loss DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Largest losing trade
    
    -- Activity metrics
    total_trades INTEGER NOT NULL DEFAULT 0, -- Total number of trades
    trading_days INTEGER NOT NULL DEFAULT 0, -- Days with trading activity
    average_holding_period DECIMAL(8, 2) NOT NULL DEFAULT 0, -- Average holding period (days)
    
    -- Benchmark comparison
    benchmark_return DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Benchmark return for period
    alpha DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Alpha vs benchmark
    beta DECIMAL(6, 4) NOT NULL DEFAULT 1.0, -- Beta vs benchmark
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, period, calculation_date),
    INDEX idx_portfolio_performance_user (user_id, period, calculation_date DESC),
    INDEX idx_portfolio_performance_period (period, calculation_date DESC),
    INDEX idx_portfolio_performance_returns (total_return DESC, sharpe_ratio DESC)
);

-- Portfolio allocation analysis
CREATE TABLE IF NOT EXISTS portfolio_allocation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calculation_date DATE NOT NULL,
    
    -- Asset allocation (JSON structure)
    asset_allocation JSONB NOT NULL DEFAULT '{}', -- {asset: percentage}
    type_allocation JSONB NOT NULL DEFAULT '{}', -- {position_type: percentage}
    risk_allocation JSONB NOT NULL DEFAULT '{}', -- {risk_level: percentage}
    
    -- Sector/category allocation
    sector_allocation JSONB NOT NULL DEFAULT '{}', -- {sector: percentage}
    chain_allocation JSONB NOT NULL DEFAULT '{}', -- {blockchain: percentage}
    
    -- Allocation analysis
    diversification_score DECIMAL(5, 2) NOT NULL DEFAULT 0, -- Diversification score (0-100)
    concentration_risk DECIMAL(5, 2) NOT NULL DEFAULT 0, -- Concentration risk score (0-100)
    correlation_risk DECIMAL(5, 2) NOT NULL DEFAULT 0, -- Correlation risk score (0-100)
    
    -- Allocation quality metrics
    efficient_frontier_distance DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Distance from efficient frontier
    optimization_score DECIMAL(5, 2) NOT NULL DEFAULT 0, -- Portfolio optimization score (0-100)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, calculation_date),
    INDEX idx_portfolio_allocation_user (user_id, calculation_date DESC),
    INDEX idx_portfolio_allocation_date (calculation_date DESC),
    INDEX idx_portfolio_allocation_scores (diversification_score DESC, optimization_score DESC)
);

-- Portfolio transaction impact analysis
CREATE TABLE IF NOT EXISTS portfolio_transaction_impact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL, -- Reference to the original transaction
    transaction_type VARCHAR(50) NOT NULL, -- Type of transaction
    
    -- Transaction details
    asset VARCHAR(20) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    fees DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Portfolio impact
    portfolio_value_before DECIMAL(20, 8) NOT NULL,
    portfolio_value_after DECIMAL(20, 8) NOT NULL,
    portfolio_impact DECIMAL(20, 8) GENERATED ALWAYS AS (portfolio_value_after - portfolio_value_before) STORED,
    portfolio_impact_percentage DECIMAL(10, 4) NOT NULL DEFAULT 0,
    
    -- Risk impact
    risk_before DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Portfolio risk before transaction
    risk_after DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Portfolio risk after transaction
    risk_impact DECIMAL(8, 4) GENERATED ALWAYS AS (risk_after - risk_before) STORED,
    
    -- Allocation impact
    allocation_change JSONB NOT NULL DEFAULT '{}', -- Change in allocation percentages
    diversification_impact DECIMAL(6, 4) NOT NULL DEFAULT 0, -- Impact on diversification
    
    -- Performance attribution
    expected_return_contribution DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Expected return contribution
    risk_contribution DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Risk contribution
    
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_portfolio_transaction_impact_user (user_id, timestamp DESC),
    INDEX idx_portfolio_transaction_impact_asset (asset, timestamp DESC),
    INDEX idx_portfolio_transaction_impact_type (transaction_type, timestamp DESC)
);

-- Portfolio analytics configuration
CREATE TABLE IF NOT EXISTS portfolio_analytics_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Risk preferences
    risk_tolerance VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (
        risk_tolerance IN ('conservative', 'moderate', 'aggressive', 'very_aggressive')
    ),
    max_position_size DECIMAL(5, 2) NOT NULL DEFAULT 20.0, -- Max position size as % of portfolio
    max_sector_allocation DECIMAL(5, 2) NOT NULL DEFAULT 30.0, -- Max sector allocation %
    
    -- Performance benchmarks
    benchmark_portfolio JSONB NOT NULL DEFAULT '{}', -- Benchmark allocation
    performance_target DECIMAL(8, 4) NOT NULL DEFAULT 10.0, -- Target annual return %
    max_drawdown_tolerance DECIMAL(8, 4) NOT NULL DEFAULT 15.0, -- Max acceptable drawdown %
    
    -- Analytics preferences
    update_frequency INTEGER NOT NULL DEFAULT 300, -- Update frequency in seconds
    alert_thresholds JSONB NOT NULL DEFAULT '{}', -- Alert threshold configuration
    reporting_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    
    -- Notification preferences
    enable_alerts BOOLEAN DEFAULT TRUE,
    alert_email VARCHAR(255),
    alert_methods JSONB NOT NULL DEFAULT '[]', -- Array of alert methods
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id),
    INDEX idx_portfolio_analytics_config_user (user_id)
);

-- Functions for portfolio analytics

-- Function to calculate portfolio Sharpe ratio
CREATE OR REPLACE FUNCTION calculate_portfolio_sharpe_ratio(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS DECIMAL(8, 4) AS $$
DECLARE
    v_avg_return DECIMAL(10, 4);
    v_volatility DECIMAL(8, 4);
    v_risk_free_rate DECIMAL(8, 4) := 2.0; -- 2% annual risk-free rate
BEGIN
    -- Calculate average daily return
    SELECT COALESCE(AVG(day_change_percentage), 0) INTO v_avg_return
    FROM portfolio_daily_pnl
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - p_days;
    
    -- Calculate volatility (standard deviation of returns)
    SELECT COALESCE(STDDEV(day_change_percentage), 0) INTO v_volatility
    FROM portfolio_daily_pnl
    WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - p_days;
    
    -- Annualize metrics
    v_avg_return := v_avg_return * 252; -- 252 trading days per year
    v_volatility := v_volatility * SQRT(252);
    
    -- Calculate Sharpe ratio
    IF v_volatility > 0 THEN
        RETURN (v_avg_return - v_risk_free_rate) / v_volatility;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate maximum drawdown
CREATE OR REPLACE FUNCTION calculate_max_drawdown(p_user_id UUID, p_days INTEGER DEFAULT 365)
RETURNS DECIMAL(10, 4) AS $$
DECLARE
    v_max_drawdown DECIMAL(10, 4) := 0;
BEGIN
    WITH portfolio_values AS (
        SELECT 
            date,
            portfolio_value,
            MAX(portfolio_value) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING) as peak_value
        FROM portfolio_daily_pnl
        WHERE user_id = p_user_id
        AND date >= CURRENT_DATE - p_days
        ORDER BY date
    ),
    drawdowns AS (
        SELECT 
            CASE WHEN peak_value > 0 
            THEN ((peak_value - portfolio_value) / peak_value * 100)
            ELSE 0 END as drawdown_pct
        FROM portfolio_values
    )
    SELECT COALESCE(MAX(drawdown_pct), 0) INTO v_max_drawdown
    FROM drawdowns;
    
    RETURN v_max_drawdown;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate portfolio diversification score
CREATE OR REPLACE FUNCTION calculate_diversification_score(p_user_id UUID)
RETURNS DECIMAL(5, 2) AS $$
DECLARE
    v_herfindahl_index DECIMAL(8, 6);
    v_asset_count INTEGER;
    v_diversification_score DECIMAL(5, 2);
BEGIN
    -- Calculate Herfindahl-Hirschman Index
    WITH position_weights AS (
        SELECT 
            asset,
            market_value / SUM(market_value) OVER () as weight
        FROM portfolio_positions
        WHERE user_id = p_user_id AND is_active = true AND market_value > 0
    )
    SELECT 
        COALESCE(SUM(POWER(weight, 2)), 1) as hhi,
        COUNT(*) as asset_count
    INTO v_herfindahl_index, v_asset_count
    FROM position_weights;
    
    -- Convert HHI to diversification score (0-100)
    -- Lower HHI = better diversification = higher score
    IF v_asset_count = 0 THEN
        v_diversification_score := 0;
    ELSIF v_asset_count = 1 THEN
        v_diversification_score := 10; -- Single asset = low diversification
    ELSE
        -- Normalize score: perfect diversification (1/n) = 100, max concentration (1) = 0
        v_diversification_score := (1 - v_herfindahl_index) / (1 - 1.0/v_asset_count) * 100;
    END IF;
    
    RETURN LEAST(100, GREATEST(0, v_diversification_score));
END;
$$ LANGUAGE plpgsql;

-- Function to update portfolio daily P&L with period changes
CREATE OR REPLACE FUNCTION update_portfolio_period_changes(p_user_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    v_current_value DECIMAL(20, 8);
    v_week_ago_value DECIMAL(20, 8);
    v_month_ago_value DECIMAL(20, 8);
    v_week_change DECIMAL(20, 8);
    v_month_change DECIMAL(20, 8);
    v_week_change_pct DECIMAL(10, 4);
    v_month_change_pct DECIMAL(10, 4);
BEGIN
    -- Get current portfolio value
    SELECT portfolio_value INTO v_current_value
    FROM portfolio_daily_pnl
    WHERE user_id = p_user_id AND date = p_date;
    
    IF v_current_value IS NULL THEN
        RETURN;
    END IF;
    
    -- Get week ago value
    SELECT portfolio_value INTO v_week_ago_value
    FROM portfolio_daily_pnl
    WHERE user_id = p_user_id AND date = p_date - 7
    ORDER BY date DESC
    LIMIT 1;
    
    -- Get month ago value
    SELECT portfolio_value INTO v_month_ago_value
    FROM portfolio_daily_pnl
    WHERE user_id = p_user_id AND date = p_date - 30
    ORDER BY date DESC
    LIMIT 1;
    
    -- Calculate changes
    v_week_change := v_current_value - COALESCE(v_week_ago_value, v_current_value);
    v_month_change := v_current_value - COALESCE(v_month_ago_value, v_current_value);
    
    v_week_change_pct := CASE WHEN v_week_ago_value > 0 
                        THEN (v_week_change / v_week_ago_value * 100) 
                        ELSE 0 END;
    v_month_change_pct := CASE WHEN v_month_ago_value > 0 
                         THEN (v_month_change / v_month_ago_value * 100) 
                         ELSE 0 END;
    
    -- Update the record
    UPDATE portfolio_daily_pnl
    SET week_change = v_week_change,
        week_change_percentage = v_week_change_pct,
        month_change = v_month_change,
        month_change_percentage = v_month_change_pct
    WHERE user_id = p_user_id AND date = p_date;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Value at Risk (VaR) using historical simulation
CREATE OR REPLACE FUNCTION calculate_var_95(p_user_id UUID, p_days INTEGER DEFAULT 252)
RETURNS DECIMAL(20, 8) AS $$
DECLARE
    v_current_value DECIMAL(20, 8);
    v_var_95 DECIMAL(20, 8);
BEGIN
    -- Get current portfolio value
    SELECT portfolio_value INTO v_current_value
    FROM portfolio_daily_pnl
    WHERE user_id = p_user_id
    ORDER BY date DESC
    LIMIT 1;
    
    IF v_current_value IS NULL OR v_current_value = 0 THEN
        RETURN 0;
    END IF;
    
    -- Calculate 95% VaR using historical returns
    WITH returns AS (
        SELECT day_change_percentage
        FROM portfolio_daily_pnl
        WHERE user_id = p_user_id
        AND date >= CURRENT_DATE - p_days
        AND day_change_percentage IS NOT NULL
        ORDER BY day_change_percentage ASC
    ),
    percentile_calc AS (
        SELECT day_change_percentage,
               ROW_NUMBER() OVER () as row_num,
               COUNT(*) OVER () as total_rows
        FROM returns
    )
    SELECT v_current_value * ABS(day_change_percentage / 100.0) INTO v_var_95
    FROM percentile_calc
    WHERE row_num = CEIL(total_rows * 0.05)
    LIMIT 1;
    
    RETURN COALESCE(v_var_95, 0);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update portfolio metrics
CREATE OR REPLACE FUNCTION trigger_update_portfolio_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update portfolio allocation when positions change
    PERFORM calculate_diversification_score(COALESCE(NEW.user_id, OLD.user_id));
    
    -- Schedule risk metrics update (simplified - would use job queue in practice)
    -- This is a placeholder for async processing
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_portfolio_metrics_trigger
    AFTER INSERT OR UPDATE OR DELETE ON portfolio_positions
    FOR EACH ROW EXECUTE FUNCTION trigger_update_portfolio_metrics();

-- Views for portfolio analytics

-- Current portfolio summary view
CREATE OR REPLACE VIEW current_portfolio_summary AS
SELECT 
    pp.user_id,
    COUNT(DISTINCT pp.asset) as unique_assets,
    COUNT(*) as total_positions,
    SUM(pp.market_value) as total_value,
    SUM(pp.total_pnl) as total_pnl,
    CASE WHEN SUM(pp.market_value) - SUM(pp.total_pnl) > 0 
    THEN (SUM(pp.total_pnl) / (SUM(pp.market_value) - SUM(pp.total_pnl)) * 100)
    ELSE 0 END as total_pnl_percentage,
    AVG(pp.roi) as average_roi,
    MAX(pp.market_value) as largest_position,
    MAX(pp.market_value) / SUM(pp.market_value) * 100 as concentration_pct,
    calculate_diversification_score(pp.user_id) as diversification_score
FROM portfolio_positions pp
WHERE pp.is_active = true
GROUP BY pp.user_id;

-- Top performers view
CREATE OR REPLACE VIEW top_performing_portfolios AS
SELECT 
    pdp.user_id,
    pdp.portfolio_value,
    pdp.day_change_percentage,
    pdp.week_change_percentage,
    pdp.month_change_percentage,
    prm.sharpe_ratio,
    prm.max_drawdown,
    prm.volatility,
    calculate_portfolio_sharpe_ratio(pdp.user_id, 30) as current_sharpe_ratio
FROM portfolio_daily_pnl pdp
LEFT JOIN portfolio_risk_metrics prm ON pdp.user_id = prm.user_id 
    AND prm.date = (SELECT MAX(date) FROM portfolio_risk_metrics WHERE user_id = pdp.user_id)
WHERE pdp.date = (SELECT MAX(date) FROM portfolio_daily_pnl WHERE user_id = pdp.user_id)
AND pdp.portfolio_value > 1000 -- Minimum portfolio size filter
ORDER BY pdp.month_change_percentage DESC;

-- Risk analysis view
CREATE OR REPLACE VIEW portfolio_risk_analysis AS
SELECT 
    prm.user_id,
    prm.date,
    prm.value_at_risk,
    prm.expected_shortfall,
    prm.max_drawdown,
    prm.volatility,
    prm.sharpe_ratio,
    prm.concentration_risk,
    prm.largest_position,
    pdp.portfolio_value,
    (prm.value_at_risk / pdp.portfolio_value * 100) as var_as_portfolio_pct,
    CASE 
        WHEN prm.concentration_risk > 50 THEN 'High'
        WHEN prm.concentration_risk > 25 THEN 'Medium'
        ELSE 'Low'
    END as concentration_risk_level,
    CASE 
        WHEN prm.max_drawdown > 20 THEN 'High'
        WHEN prm.max_drawdown > 10 THEN 'Medium'
        ELSE 'Low'
    END as drawdown_risk_level
FROM portfolio_risk_metrics prm
JOIN portfolio_daily_pnl pdp ON prm.user_id = pdp.user_id AND prm.date = pdp.date
WHERE prm.date >= CURRENT_DATE - 7; -- Last week's data
