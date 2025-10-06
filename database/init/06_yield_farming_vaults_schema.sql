-- Yield Farming Vaults Schema
-- Supports automated strategy execution and vault management

-- Vault strategies configuration
CREATE TABLE IF NOT EXISTS vault_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    strategy_type VARCHAR(50) NOT NULL CHECK (
        strategy_type IN ('lending', 'liquidity_mining', 'yield_farming', 'arbitrage', 'compound', 'delta_neutral')
    ),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    
    -- Strategy parameters
    expected_apy DECIMAL(6, 3) NOT NULL DEFAULT 0, -- Expected APY percentage (e.g., 15.500 for 15.5%)
    min_deposit DECIMAL(20, 8) NOT NULL DEFAULT 0.01,
    max_deposit DECIMAL(20, 8) NOT NULL DEFAULT 1000000,
    lock_period INTEGER NOT NULL DEFAULT 0, -- Lock period in seconds
    auto_compound BOOLEAN DEFAULT TRUE,
    
    -- Strategy assets and protocols
    reward_tokens JSONB NOT NULL DEFAULT '[]', -- Array of reward token symbols
    underlying_assets JSONB NOT NULL DEFAULT '[]', -- Array of underlying asset symbols
    protocol_integrations JSONB NOT NULL DEFAULT '[]', -- Array of protocol names
    
    -- Smart contract configuration
    strategy_contract VARCHAR(100), -- Strategy contract address
    parameters JSONB NOT NULL DEFAULT '{}', -- Strategy-specific parameters
    
    -- Strategy metrics
    total_value_locked DECIMAL(20, 8) NOT NULL DEFAULT 0,
    total_shares DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Strategy status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_vault_strategies_type (strategy_type, is_active),
    INDEX idx_vault_strategies_risk (risk_level, expected_apy DESC),
    INDEX idx_vault_strategies_active (is_active, total_value_locked DESC)
);

-- Yield farming vaults
CREATE TABLE IF NOT EXISTS yield_vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    strategy_id UUID NOT NULL REFERENCES vault_strategies(id) ON DELETE RESTRICT,
    
    -- Vault assets
    base_asset VARCHAR(20) NOT NULL, -- Primary asset symbol (e.g., 'USDC', 'ETH')
    reward_assets JSONB NOT NULL DEFAULT '[]', -- Array of reward asset symbols
    
    -- Vault metrics
    total_value_locked DECIMAL(20, 8) NOT NULL DEFAULT 0,
    total_shares DECIMAL(20, 8) NOT NULL DEFAULT 0,
    share_price DECIMAL(20, 8) NOT NULL DEFAULT 1.0,
    
    -- Performance metrics
    total_return DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Total return percentage
    annualized_return DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Annualized return percentage
    daily_return DECIMAL(10, 4) NOT NULL DEFAULT 0,
    weekly_return DECIMAL(10, 4) NOT NULL DEFAULT 0,
    monthly_return DECIMAL(10, 4) NOT NULL DEFAULT 0,
    max_drawdown DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Maximum drawdown percentage
    sharpe_ratio DECIMAL(8, 4) NOT NULL DEFAULT 0,
    volatility DECIMAL(8, 4) NOT NULL DEFAULT 0,
    
    -- Fee structure (in basis points)
    deposit_fee INTEGER NOT NULL DEFAULT 0, -- Deposit fee in basis points (100 = 1%)
    withdrawal_fee INTEGER NOT NULL DEFAULT 100, -- Withdrawal fee in basis points
    performance_fee INTEGER NOT NULL DEFAULT 2000, -- Performance fee in basis points (2000 = 20%)
    management_fee INTEGER NOT NULL DEFAULT 200, -- Annual management fee in basis points (200 = 2%)
    
    -- Vault parameters
    max_capacity DECIMAL(20, 8) NOT NULL DEFAULT 10000000, -- Maximum vault capacity
    utilization_rate DECIMAL(5, 2) NOT NULL DEFAULT 0, -- Current utilization percentage
    risk_score DECIMAL(5, 2) NOT NULL DEFAULT 50.0, -- Risk score (0-100)
    
    -- Vault status
    is_active BOOLEAN DEFAULT TRUE,
    is_paused BOOLEAN DEFAULT FALSE,
    
    -- Execution timing
    last_harvest TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_harvest TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 day',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_share_price CHECK (share_price > 0),
    CONSTRAINT valid_capacity CHECK (max_capacity > 0),
    CONSTRAINT valid_utilization CHECK (utilization_rate >= 0 AND utilization_rate <= 100),
    
    INDEX idx_yield_vaults_strategy (strategy_id, is_active),
    INDEX idx_yield_vaults_asset (base_asset, is_active),
    INDEX idx_yield_vaults_performance (annualized_return DESC) WHERE is_active = true,
    INDEX idx_yield_vaults_tvl (total_value_locked DESC) WHERE is_active = true,
    INDEX idx_yield_vaults_harvest (next_harvest) WHERE is_active = true AND is_paused = false
);

-- User positions in yield vaults
CREATE TABLE IF NOT EXISTS user_vault_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vault_id UUID NOT NULL REFERENCES yield_vaults(id) ON DELETE CASCADE,
    
    -- Position details
    shares DECIMAL(20, 8) NOT NULL DEFAULT 0,
    principal_amount DECIMAL(20, 8) NOT NULL, -- Original deposit amount
    current_value DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Returns tracking
    total_returns DECIMAL(20, 8) NOT NULL DEFAULT 0,
    realized_returns DECIMAL(20, 8) NOT NULL DEFAULT 0,
    unrealized_returns DECIMAL(20, 8) NOT NULL DEFAULT 0,
    total_rewards_earned DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Performance metrics
    entry_price DECIMAL(20, 8) NOT NULL, -- Share price at first entry
    average_entry_price DECIMAL(20, 8) NOT NULL, -- Average entry price across deposits
    roi DECIMAL(10, 4) GENERATED ALWAYS AS (
        CASE WHEN principal_amount > 0 
        THEN ((current_value - principal_amount) / principal_amount * 100) 
        ELSE 0 END
    ) STORED,
    
    -- Timing information
    first_deposit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_deposit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_withdrawal_at TIMESTAMP WITH TIME ZONE,
    lock_expires_at TIMESTAMP WITH TIME ZONE, -- When position lock expires
    
    -- Position status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_shares CHECK (shares >= 0),
    CONSTRAINT positive_principal CHECK (principal_amount >= 0),
    
    UNIQUE(user_id, vault_id, is_active) DEFERRABLE INITIALLY DEFERRED,
    INDEX idx_user_vault_positions_user (user_id, is_active),
    INDEX idx_user_vault_positions_vault (vault_id, shares DESC),
    INDEX idx_user_vault_positions_returns (roi DESC) WHERE is_active = true,
    INDEX idx_user_vault_positions_locked (lock_expires_at) WHERE lock_expires_at IS NOT NULL
);

-- Vault transaction history
CREATE TABLE IF NOT EXISTS vault_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vault_id UUID NOT NULL REFERENCES yield_vaults(id) ON DELETE CASCADE,
    
    -- Transaction details
    type VARCHAR(20) NOT NULL CHECK (
        type IN ('deposit', 'withdraw', 'harvest', 'compound', 'rebalance', 'fee_collection')
    ),
    amount DECIMAL(20, 8) NOT NULL,
    shares DECIMAL(20, 8) NOT NULL DEFAULT 0,
    share_price DECIMAL(20, 8) NOT NULL,
    fees DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Blockchain details
    gas_used BIGINT,
    transaction_hash VARCHAR(100),
    block_number BIGINT,
    
    -- Transaction status
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (
        status IN ('pending', 'confirmed', 'failed')
    ),
    
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_amount CHECK (amount >= 0),
    CONSTRAINT positive_share_price CHECK (share_price > 0),
    
    INDEX idx_vault_transactions_user (user_id, timestamp DESC),
    INDEX idx_vault_transactions_vault (vault_id, timestamp DESC),
    INDEX idx_vault_transactions_type (type, timestamp DESC),
    INDEX idx_vault_transactions_hash (transaction_hash) WHERE transaction_hash IS NOT NULL
);

-- Vault reward distributions
CREATE TABLE IF NOT EXISTS vault_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES yield_vaults(id) ON DELETE CASCADE,
    
    -- Reward details
    reward_token VARCHAR(20) NOT NULL,
    reward_amount DECIMAL(20, 8) NOT NULL,
    distribution_rate DECIMAL(20, 8) NOT NULL DEFAULT 0, -- Rewards distributed per second
    
    -- Distribution period
    reward_duration INTEGER NOT NULL DEFAULT 86400, -- Duration in seconds (default 1 day)
    period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_end TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (period_start + (reward_duration * INTERVAL '1 second')) STORED,
    
    -- Distribution tracking
    total_distributed DECIMAL(20, 8) NOT NULL DEFAULT 0,
    remaining_rewards DECIMAL(20, 8) GENERATED ALWAYS AS (reward_amount - total_distributed) STORED,
    
    -- Reward status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_reward_amount CHECK (reward_amount > 0),
    CONSTRAINT positive_duration CHECK (reward_duration > 0),
    CONSTRAINT valid_distribution CHECK (total_distributed <= reward_amount),
    
    INDEX idx_vault_rewards_vault (vault_id, is_active),
    INDEX idx_vault_rewards_token (reward_token, is_active),
    INDEX idx_vault_rewards_period (period_start, period_end) WHERE is_active = true
);

-- Strategy execution logs
CREATE TABLE IF NOT EXISTS strategy_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES vault_strategies(id) ON DELETE CASCADE,
    vault_id UUID NOT NULL REFERENCES yield_vaults(id) ON DELETE CASCADE,
    
    -- Execution details
    execution_type VARCHAR(20) NOT NULL CHECK (
        execution_type IN ('harvest', 'rebalance', 'compound', 'emergency_exit')
    ),
    triggered_by VARCHAR(20) NOT NULL CHECK (
        triggered_by IN ('schedule', 'threshold', 'manual', 'emergency')
    ),
    parameters JSONB NOT NULL DEFAULT '{}',
    
    -- Execution results
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'executing', 'completed', 'failed')
    ),
    gas_cost DECIMAL(20, 8) NOT NULL DEFAULT 0,
    rewards_harvested JSONB NOT NULL DEFAULT '{}', -- {token: amount} mapping
    performance_impact DECIMAL(10, 4) NOT NULL DEFAULT 0, -- Performance impact percentage
    
    -- Timing information
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- Execution duration in milliseconds
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    INDEX idx_strategy_executions_strategy (strategy_id, started_at DESC),
    INDEX idx_strategy_executions_vault (vault_id, execution_type, started_at DESC),
    INDEX idx_strategy_executions_status (status, started_at DESC),
    INDEX idx_strategy_executions_type (execution_type, started_at DESC)
);

-- Vault performance snapshots for analytics
CREATE TABLE IF NOT EXISTS vault_performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES yield_vaults(id) ON DELETE CASCADE,
    
    -- Snapshot timestamp
    snapshot_date DATE NOT NULL,
    snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Vault metrics at snapshot time
    total_value_locked DECIMAL(20, 8) NOT NULL,
    total_shares DECIMAL(20, 8) NOT NULL,
    share_price DECIMAL(20, 8) NOT NULL,
    
    -- Performance metrics
    daily_return DECIMAL(10, 4) NOT NULL DEFAULT 0,
    seven_day_return DECIMAL(10, 4) NOT NULL DEFAULT 0,
    thirty_day_return DECIMAL(10, 4) NOT NULL DEFAULT 0,
    inception_return DECIMAL(10, 4) NOT NULL DEFAULT 0,
    
    -- Risk metrics
    volatility DECIMAL(8, 4) NOT NULL DEFAULT 0,
    sharpe_ratio DECIMAL(8, 4) NOT NULL DEFAULT 0,
    max_drawdown DECIMAL(10, 4) NOT NULL DEFAULT 0,
    
    -- Activity metrics
    daily_deposits DECIMAL(20, 8) NOT NULL DEFAULT 0,
    daily_withdrawals DECIMAL(20, 8) NOT NULL DEFAULT 0,
    daily_volume DECIMAL(20, 8) NOT NULL DEFAULT 0,
    unique_depositors INTEGER NOT NULL DEFAULT 0,
    
    UNIQUE(vault_id, snapshot_date),
    INDEX idx_vault_performance_snapshots_vault (vault_id, snapshot_date DESC),
    INDEX idx_vault_performance_snapshots_date (snapshot_date DESC),
    INDEX idx_vault_performance_snapshots_performance (share_price, daily_return DESC)
);

-- Yield farming vault analytics views and functions

-- Function to calculate vault APY based on recent performance
CREATE OR REPLACE FUNCTION calculate_vault_apy(p_vault_id UUID, p_days INTEGER DEFAULT 30)
RETURNS DECIMAL(10, 4) AS $$
DECLARE
    v_start_price DECIMAL(20, 8);
    v_end_price DECIMAL(20, 8);
    v_total_return DECIMAL(10, 4);
    v_annualized_return DECIMAL(10, 4);
BEGIN
    -- Get start and end share prices for the period
    SELECT share_price INTO v_start_price
    FROM vault_performance_snapshots
    WHERE vault_id = p_vault_id 
    AND snapshot_date = CURRENT_DATE - p_days
    ORDER BY snapshot_date ASC
    LIMIT 1;
    
    SELECT share_price INTO v_end_price
    FROM yield_vaults
    WHERE id = p_vault_id;
    
    IF v_start_price IS NULL OR v_start_price = 0 THEN
        RETURN 0;
    END IF;
    
    -- Calculate total return for the period
    v_total_return := ((v_end_price - v_start_price) / v_start_price) * 100;
    
    -- Annualize the return
    v_annualized_return := v_total_return * (365.0 / p_days);
    
    RETURN v_annualized_return;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate user position value
CREATE OR REPLACE FUNCTION calculate_position_value(p_user_id UUID, p_vault_id UUID)
RETURNS TABLE (
    current_value DECIMAL(20, 8),
    unrealized_pnl DECIMAL(20, 8),
    roi_percentage DECIMAL(10, 4),
    total_rewards DECIMAL(20, 8)
) AS $$
DECLARE
    v_position RECORD;
    v_vault RECORD;
BEGIN
    -- Get user position
    SELECT * INTO v_position
    FROM user_vault_positions
    WHERE user_id = p_user_id AND vault_id = p_vault_id AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 0::DECIMAL(20,8), 0::DECIMAL(20,8), 0::DECIMAL(10,4), 0::DECIMAL(20,8);
        RETURN;
    END IF;
    
    -- Get current vault share price
    SELECT * INTO v_vault
    FROM yield_vaults
    WHERE id = p_vault_id;
    
    -- Calculate current value and metrics
    current_value := v_position.shares * v_vault.share_price;
    unrealized_pnl := current_value - v_position.principal_amount;
    roi_percentage := CASE WHEN v_position.principal_amount > 0 
                     THEN (unrealized_pnl / v_position.principal_amount * 100) 
                     ELSE 0 END;
    total_rewards := v_position.total_rewards_earned;
    
    RETURN QUERY SELECT current_value, unrealized_pnl, roi_percentage, total_rewards;
END;
$$ LANGUAGE plpgsql;

-- Function to update vault performance metrics
CREATE OR REPLACE FUNCTION update_vault_performance_metrics(p_vault_id UUID)
RETURNS VOID AS $$
DECLARE
    v_vault RECORD;
    v_daily_return DECIMAL(10, 4);
    v_weekly_return DECIMAL(10, 4);
    v_monthly_return DECIMAL(10, 4);
    v_volatility DECIMAL(8, 4);
    v_sharpe_ratio DECIMAL(8, 4);
    v_max_drawdown DECIMAL(10, 4);
BEGIN
    -- Get vault details
    SELECT * INTO v_vault FROM yield_vaults WHERE id = p_vault_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vault not found: %', p_vault_id;
    END IF;
    
    -- Calculate daily return (1 day)
    v_daily_return := calculate_vault_apy(p_vault_id, 1);
    
    -- Calculate weekly return (7 days)
    v_weekly_return := calculate_vault_apy(p_vault_id, 7);
    
    -- Calculate monthly return (30 days)
    v_monthly_return := calculate_vault_apy(p_vault_id, 30);
    
    -- Calculate volatility (standard deviation of daily returns over 30 days)
    SELECT COALESCE(STDDEV(daily_return), 0) INTO v_volatility
    FROM vault_performance_snapshots
    WHERE vault_id = p_vault_id 
    AND snapshot_date >= CURRENT_DATE - 30;
    
    -- Calculate Sharpe ratio (return / volatility)
    v_sharpe_ratio := CASE WHEN v_volatility > 0 THEN v_monthly_return / v_volatility ELSE 0 END;
    
    -- Calculate maximum drawdown over last 90 days
    WITH price_series AS (
        SELECT snapshot_date, share_price,
               MAX(share_price) OVER (ORDER BY snapshot_date ROWS UNBOUNDED PRECEDING) as peak_price
        FROM vault_performance_snapshots
        WHERE vault_id = p_vault_id AND snapshot_date >= CURRENT_DATE - 90
        ORDER BY snapshot_date
    ),
    drawdowns AS (
        SELECT ((peak_price - share_price) / peak_price * 100) as drawdown
        FROM price_series
        WHERE peak_price > 0
    )
    SELECT COALESCE(MAX(drawdown), 0) INTO v_max_drawdown FROM drawdowns;
    
    -- Update vault metrics
    UPDATE yield_vaults 
    SET daily_return = v_daily_return,
        weekly_return = v_weekly_return,
        monthly_return = v_monthly_return,
        volatility = v_volatility,
        sharpe_ratio = v_sharpe_ratio,
        max_drawdown = v_max_drawdown,
        updated_at = NOW()
    WHERE id = p_vault_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create daily performance snapshots
CREATE OR REPLACE FUNCTION create_daily_vault_snapshots(p_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    v_vault RECORD;
BEGIN
    FOR v_vault IN SELECT * FROM yield_vaults WHERE is_active = true LOOP
        INSERT INTO vault_performance_snapshots (
            vault_id, snapshot_date, total_value_locked, total_shares, share_price,
            daily_return, seven_day_return, thirty_day_return,
            daily_deposits, daily_withdrawals, daily_volume, unique_depositors
        )
        SELECT 
            v_vault.id,
            p_date,
            v_vault.total_value_locked,
            v_vault.total_shares,
            v_vault.share_price,
            calculate_vault_apy(v_vault.id, 1) / 365.0, -- Daily return
            calculate_vault_apy(v_vault.id, 7),
            calculate_vault_apy(v_vault.id, 30),
            COALESCE(daily_stats.deposits, 0),
            COALESCE(daily_stats.withdrawals, 0),
            COALESCE(daily_stats.volume, 0),
            COALESCE(daily_stats.unique_users, 0)
        FROM (
            SELECT 
                SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END) as deposits,
                SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END) as withdrawals,
                SUM(amount) as volume,
                COUNT(DISTINCT user_id) as unique_users
            FROM vault_transactions
            WHERE vault_id = v_vault.id 
            AND DATE(timestamp) = p_date
        ) daily_stats
        ON CONFLICT (vault_id, snapshot_date) 
        DO UPDATE SET
            total_value_locked = EXCLUDED.total_value_locked,
            total_shares = EXCLUDED.total_shares,
            share_price = EXCLUDED.share_price,
            daily_return = EXCLUDED.daily_return,
            seven_day_return = EXCLUDED.seven_day_return,
            thirty_day_return = EXCLUDED.thirty_day_return,
            daily_deposits = EXCLUDED.daily_deposits,
            daily_withdrawals = EXCLUDED.daily_withdrawals,
            daily_volume = EXCLUDED.daily_volume,
            unique_depositors = EXCLUDED.unique_depositors;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update vault metrics on position changes
CREATE OR REPLACE FUNCTION trigger_update_vault_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update vault TVL and share count
    UPDATE yield_vaults 
    SET total_value_locked = (
            SELECT COALESCE(SUM(shares * share_price), 0)
            FROM user_vault_positions uvp
            WHERE uvp.vault_id = COALESCE(NEW.vault_id, OLD.vault_id)
            AND uvp.is_active = true
        ),
        total_shares = (
            SELECT COALESCE(SUM(shares), 0)
            FROM user_vault_positions uvp
            WHERE uvp.vault_id = COALESCE(NEW.vault_id, OLD.vault_id)
            AND uvp.is_active = true
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.vault_id, OLD.vault_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vault_metrics_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_vault_positions
    FOR EACH ROW EXECUTE FUNCTION trigger_update_vault_metrics();

-- Views for easy data access

-- Active vaults with performance metrics
CREATE OR REPLACE VIEW active_vaults_summary AS
SELECT 
    yv.id,
    yv.name,
    yv.symbol,
    yv.base_asset,
    vs.strategy_type,
    vs.risk_level,
    yv.total_value_locked,
    yv.share_price,
    yv.annualized_return,
    yv.monthly_return,
    yv.max_drawdown,
    yv.sharpe_ratio,
    yv.deposit_fee,
    yv.withdrawal_fee,
    yv.performance_fee,
    (yv.total_value_locked / yv.max_capacity * 100) as capacity_utilized,
    COUNT(DISTINCT uvp.user_id) as unique_depositors,
    yv.is_paused,
    yv.created_at
FROM yield_vaults yv
JOIN vault_strategies vs ON yv.strategy_id = vs.id
LEFT JOIN user_vault_positions uvp ON yv.id = uvp.vault_id AND uvp.is_active = true
WHERE yv.is_active = true
GROUP BY yv.id, vs.strategy_type, vs.risk_level
ORDER BY yv.total_value_locked DESC;

-- User portfolio summary
CREATE OR REPLACE VIEW user_vault_portfolio AS
SELECT 
    uvp.user_id,
    uvp.vault_id,
    yv.name as vault_name,
    yv.symbol as vault_symbol,
    yv.base_asset,
    uvp.shares,
    uvp.principal_amount,
    (uvp.shares * yv.share_price) as current_value,
    uvp.total_rewards_earned,
    uvp.roi,
    vs.strategy_type,
    vs.risk_level,
    uvp.first_deposit_at,
    uvp.last_deposit_at,
    uvp.lock_expires_at,
    CASE WHEN uvp.lock_expires_at > NOW() THEN true ELSE false END as is_locked
FROM user_vault_positions uvp
JOIN yield_vaults yv ON uvp.vault_id = yv.id
JOIN vault_strategies vs ON yv.strategy_id = vs.id
WHERE uvp.is_active = true
ORDER BY current_value DESC;
