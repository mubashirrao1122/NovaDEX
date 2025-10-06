-- Cross-Chain Bridge Schema
-- Supports multi-chain asset bridging and liquidity management

-- Supported blockchain networks
CREATE TABLE IF NOT EXISTS supported_chains (
    chain_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    rpc_url VARCHAR(255) NOT NULL,
    explorer_url VARCHAR(255) NOT NULL,
    
    -- Native currency info
    native_currency_name VARCHAR(50) NOT NULL,
    native_currency_symbol VARCHAR(10) NOT NULL,
    native_currency_decimals INTEGER NOT NULL,
    
    -- Network parameters
    block_time INTEGER NOT NULL, -- Average block time in milliseconds
    required_confirmations INTEGER NOT NULL DEFAULT 12,
    
    -- Network status
    is_testnet BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Gas and fee configuration
    base_gas_price BIGINT DEFAULT 0, -- In native currency smallest unit
    gas_price_multiplier DECIMAL(3, 2) DEFAULT 1.0,
    max_gas_limit BIGINT DEFAULT 21000,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_supported_chains_active (is_active, is_testnet)
);

-- Bridge-supported assets
CREATE TABLE IF NOT EXISTS bridge_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    decimals INTEGER NOT NULL,
    total_supply DECIMAL(30, 0), -- Can be very large for some tokens
    
    -- Bridge configuration
    bridge_enabled BOOLEAN DEFAULT TRUE,
    min_bridge_amount DECIMAL(20, 8) NOT NULL DEFAULT 0.01,
    max_bridge_amount DECIMAL(20, 8) NOT NULL DEFAULT 1000000,
    bridge_fee_bps INTEGER NOT NULL DEFAULT 10, -- Fee in basis points (10 = 0.1%)
    
    -- Multi-chain deployments (JSON structure)
    deployments JSONB NOT NULL DEFAULT '{}', -- {chainId: {address, isNative, isWrapped, ...}}
    
    -- Liquidity tracking
    total_liquidity DECIMAL(20, 8) DEFAULT 0,
    liquidity_by_chain JSONB DEFAULT '{}', -- {chainId: liquidityAmount}
    
    -- Asset metadata
    logo_url VARCHAR(255),
    website_url VARCHAR(255),
    description TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(symbol),
    INDEX idx_bridge_assets_active (is_active, bridge_enabled),
    INDEX idx_bridge_assets_symbol (symbol)
);

-- Liquidity pools for each asset on each chain
CREATE TABLE IF NOT EXISTS liquidity_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES bridge_assets(id) ON DELETE CASCADE,
    chain_id VARCHAR(50) NOT NULL REFERENCES supported_chains(chain_id),
    
    -- Pool balances
    total_liquidity DECIMAL(20, 8) NOT NULL DEFAULT 0,
    available_liquidity DECIMAL(20, 8) NOT NULL DEFAULT 0,
    reserved_liquidity DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Pool parameters
    max_utilization DECIMAL(5, 2) NOT NULL DEFAULT 90.00, -- Maximum 90% utilization
    target_utilization DECIMAL(5, 2) NOT NULL DEFAULT 70.00, -- Target 70% utilization
    base_fee INTEGER NOT NULL DEFAULT 5, -- Base fee in basis points
    utilization_fee_multiplier DECIMAL(5, 2) NOT NULL DEFAULT 2.0, -- Fee increase factor
    
    -- Yield farming configuration
    reward_rate DECIMAL(8, 4) NOT NULL DEFAULT 0, -- Annual reward rate (e.g., 5.25 for 5.25%)
    total_staked DECIMAL(20, 8) NOT NULL DEFAULT 0,
    reward_token VARCHAR(50), -- Symbol of reward token
    
    -- Pool status
    is_active BOOLEAN DEFAULT TRUE,
    last_rebalanced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Pool metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(asset_id, chain_id),
    INDEX idx_liquidity_pools_asset (asset_id, is_active),
    INDEX idx_liquidity_pools_chain (chain_id, is_active),
    INDEX idx_liquidity_pools_utilization (
        (reserved_liquidity / NULLIF(total_liquidity, 0)) DESC
    ) WHERE total_liquidity > 0
);

-- Bridge transactions
CREATE TABLE IF NOT EXISTS bridge_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES bridge_assets(id),
    
    -- Source transaction details
    source_chain VARCHAR(50) NOT NULL REFERENCES supported_chains(chain_id),
    source_address VARCHAR(100),
    source_tx_hash VARCHAR(100),
    source_amount DECIMAL(20, 8) NOT NULL,
    
    -- Destination transaction details
    destination_chain VARCHAR(50) NOT NULL REFERENCES supported_chains(chain_id),
    destination_address VARCHAR(100) NOT NULL,
    destination_tx_hash VARCHAR(100),
    destination_amount DECIMAL(20, 8) NOT NULL,
    
    -- Fee breakdown
    bridge_fee DECIMAL(20, 8) NOT NULL DEFAULT 0,
    relayer_fee DECIMAL(20, 8) NOT NULL DEFAULT 0,
    gas_fee DECIMAL(20, 8) NOT NULL DEFAULT 0,
    total_fees DECIMAL(20, 8) GENERATED ALWAYS AS (bridge_fee + relayer_fee + gas_fee) STORED,
    
    -- Transaction status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'confirmed', 'bridging', 'completed', 'failed', 'refunded')
    ),
    confirmations INTEGER NOT NULL DEFAULT 0,
    required_confirmations INTEGER NOT NULL,
    
    -- Timing information
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_completion_time TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    
    -- Bridge metadata
    nonce BIGINT NOT NULL,
    relayer_id VARCHAR(50),
    batch_id UUID,
    
    -- Performance metrics
    actual_completion_time_ms INTEGER, -- Actual time taken from initiation to completion
    confirmation_time_ms INTEGER, -- Time taken to confirm source transaction
    bridge_time_ms INTEGER, -- Time taken for bridging process
    
    CONSTRAINT valid_bridge_amounts CHECK (
        source_amount > 0 AND destination_amount > 0 AND 
        destination_amount <= source_amount
    ),
    CONSTRAINT valid_confirmations CHECK (confirmations >= 0),
    CONSTRAINT different_chains CHECK (source_chain != destination_chain),
    
    INDEX idx_bridge_transactions_user (user_id, initiated_at DESC),
    INDEX idx_bridge_transactions_status (status, initiated_at),
    INDEX idx_bridge_transactions_source (source_chain, source_tx_hash),
    INDEX idx_bridge_transactions_dest (destination_chain, destination_tx_hash),
    INDEX idx_bridge_transactions_asset (asset_id, status),
    INDEX idx_bridge_transactions_pending (status, estimated_completion_time) 
        WHERE status IN ('pending', 'confirmed', 'bridging')
);

-- Liquidity provider positions
CREATE TABLE IF NOT EXISTS liquidity_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pool_id UUID NOT NULL REFERENCES liquidity_pools(id) ON DELETE CASCADE,
    
    -- Position details
    lp_tokens DECIMAL(20, 8) NOT NULL DEFAULT 0,
    original_amount DECIMAL(20, 8) NOT NULL,
    current_value DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Rewards tracking
    rewards_earned DECIMAL(20, 8) NOT NULL DEFAULT 0,
    last_reward_claim TIMESTAMP WITH TIME ZONE,
    pending_rewards DECIMAL(20, 8) NOT NULL DEFAULT 0,
    
    -- Position timing
    deposited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Position status
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(provider_id, pool_id),
    INDEX idx_liquidity_positions_provider (provider_id, is_active),
    INDEX idx_liquidity_positions_pool (pool_id, is_active),
    INDEX idx_liquidity_positions_rewards (pending_rewards DESC) WHERE pending_rewards > 0
);

-- Cross-chain message relay system
CREATE TABLE IF NOT EXISTS cross_chain_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_chain VARCHAR(50) NOT NULL REFERENCES supported_chains(chain_id),
    destination_chain VARCHAR(50) NOT NULL REFERENCES supported_chains(chain_id),
    
    -- Message details
    message_type VARCHAR(50) NOT NULL CHECK (
        message_type IN ('bridge_request', 'bridge_confirmation', 'liquidity_update', 'governance', 'emergency')
    ),
    payload JSONB NOT NULL,
    nonce BIGINT NOT NULL,
    
    -- Message security
    signature VARCHAR(255) NOT NULL,
    signer_address VARCHAR(100) NOT NULL,
    
    -- Message status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'relayed', 'executed', 'failed', 'expired')
    ),
    
    -- Timing
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    relayed_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Execution details
    execution_tx_hash VARCHAR(100),
    execution_gas_used BIGINT,
    error_message TEXT,
    
    INDEX idx_cross_chain_messages_source (source_chain, timestamp DESC),
    INDEX idx_cross_chain_messages_dest (destination_chain, status),
    INDEX idx_cross_chain_messages_type (message_type, status),
    INDEX idx_cross_chain_messages_nonce (nonce),
    INDEX idx_cross_chain_messages_expires (expires_at) WHERE expires_at IS NOT NULL
);

-- Bridge relayer network
CREATE TABLE IF NOT EXISTS bridge_relayers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relayer_address VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100),
    
    -- Supported chains
    supported_chains VARCHAR(50)[] NOT NULL,
    
    -- Performance metrics
    total_transactions BIGINT NOT NULL DEFAULT 0,
    successful_transactions BIGINT NOT NULL DEFAULT 0,
    failed_transactions BIGINT NOT NULL DEFAULT 0,
    success_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE WHEN total_transactions > 0 
        THEN (successful_transactions::DECIMAL / total_transactions * 100) 
        ELSE 0 END
    ) STORED,
    
    -- Timing metrics
    average_confirmation_time_ms INTEGER DEFAULT 0,
    average_execution_time_ms INTEGER DEFAULT 0,
    
    -- Economic metrics
    total_fees_earned DECIMAL(20, 8) DEFAULT 0,
    total_gas_spent DECIMAL(20, 8) DEFAULT 0,
    
    -- Relayer status
    is_active BOOLEAN DEFAULT TRUE,
    reputation_score DECIMAL(5, 2) DEFAULT 100.0, -- 0-100 score
    
    -- Staking information
    stake_amount DECIMAL(20, 8) DEFAULT 0,
    stake_token VARCHAR(20),
    
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_bridge_relayers_active (is_active, reputation_score DESC),
    INDEX idx_bridge_relayers_performance (success_rate DESC, average_execution_time_ms ASC)
);

-- Asset price feeds for accurate valuations
CREATE TABLE IF NOT EXISTS asset_price_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES bridge_assets(id) ON DELETE CASCADE,
    chain_id VARCHAR(50) NOT NULL REFERENCES supported_chains(chain_id),
    
    -- Price information
    price_usd DECIMAL(20, 8) NOT NULL,
    price_source VARCHAR(50) NOT NULL, -- 'chainlink', 'pyth', 'custom'
    oracle_address VARCHAR(100),
    
    -- Price metadata
    confidence DECIMAL(5, 2) DEFAULT 100.0, -- Confidence in price accuracy (0-100)
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    update_frequency INTEGER DEFAULT 60, -- Update frequency in seconds
    
    -- Price validation
    deviation_threshold DECIMAL(8, 4) DEFAULT 5.0, -- Max allowed deviation percentage
    is_valid BOOLEAN DEFAULT TRUE,
    
    UNIQUE(asset_id, chain_id),
    INDEX idx_asset_price_feeds_updated (last_updated DESC),
    INDEX idx_asset_price_feeds_asset (asset_id, is_valid)
);

-- Bridge statistics and analytics
CREATE TABLE IF NOT EXISTS bridge_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    asset_id UUID REFERENCES bridge_assets(id),
    source_chain VARCHAR(50) REFERENCES supported_chains(chain_id),
    destination_chain VARCHAR(50) REFERENCES supported_chains(chain_id),
    
    -- Volume metrics
    transaction_count INTEGER DEFAULT 0,
    total_volume DECIMAL(20, 8) DEFAULT 0,
    total_fees DECIMAL(20, 8) DEFAULT 0,
    average_transaction_size DECIMAL(20, 8) DEFAULT 0,
    
    -- Performance metrics
    successful_transactions INTEGER DEFAULT 0,
    failed_transactions INTEGER DEFAULT 0,
    success_rate DECIMAL(5, 2) GENERATED ALWAYS AS (
        CASE WHEN transaction_count > 0 
        THEN (successful_transactions::DECIMAL / transaction_count * 100) 
        ELSE 0 END
    ) STORED,
    
    -- Timing metrics
    average_completion_time_ms INTEGER DEFAULT 0,
    median_completion_time_ms INTEGER DEFAULT 0,
    fastest_completion_time_ms INTEGER DEFAULT 0,
    slowest_completion_time_ms INTEGER DEFAULT 0,
    
    -- Liquidity metrics
    total_liquidity_start DECIMAL(20, 8) DEFAULT 0,
    total_liquidity_end DECIMAL(20, 8) DEFAULT 0,
    max_liquidity_utilization DECIMAL(5, 2) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_bridge_statistics_date (date DESC),
    INDEX idx_bridge_statistics_asset_date (asset_id, date DESC),
    INDEX idx_bridge_statistics_route_date (source_chain, destination_chain, date DESC)
);

-- Functions for bridge operations

-- Function to calculate bridge fees dynamically
CREATE OR REPLACE FUNCTION calculate_bridge_fee(
    p_asset_id UUID,
    p_source_chain VARCHAR(50),
    p_destination_chain VARCHAR(50),
    p_amount DECIMAL(20, 8)
) RETURNS TABLE (
    bridge_fee DECIMAL(20, 8),
    relayer_fee DECIMAL(20, 8),
    total_fee DECIMAL(20, 8)
) AS $$
DECLARE
    v_asset_fee_bps INTEGER;
    v_base_bridge_fee DECIMAL(20, 8);
    v_utilization_multiplier DECIMAL(5, 2) := 1.0;
    v_relayer_fee DECIMAL(20, 8) := 0.01; -- Default relayer fee
    v_pool_utilization DECIMAL(5, 2);
BEGIN
    -- Get asset bridge fee
    SELECT bridge_fee_bps INTO v_asset_fee_bps
    FROM bridge_assets 
    WHERE id = p_asset_id AND bridge_enabled = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset not found or bridge not enabled';
    END IF;
    
    -- Calculate base bridge fee
    v_base_bridge_fee := (p_amount * v_asset_fee_bps) / 10000.0;
    
    -- Get destination pool utilization for dynamic pricing
    SELECT 
        CASE WHEN total_liquidity > 0 
        THEN (reserved_liquidity / total_liquidity * 100)
        ELSE 0 END INTO v_pool_utilization
    FROM liquidity_pools 
    WHERE asset_id = p_asset_id AND chain_id = p_destination_chain AND is_active = true;
    
    -- Apply utilization-based fee multiplier
    IF v_pool_utilization IS NOT NULL AND v_pool_utilization > 70 THEN
        v_utilization_multiplier := 1.0 + ((v_pool_utilization - 70) / 100.0);
    END IF;
    
    -- Calculate final fees
    bridge_fee := v_base_bridge_fee * v_utilization_multiplier;
    relayer_fee := v_relayer_fee;
    total_fee := bridge_fee + relayer_fee;
    
    RETURN QUERY SELECT bridge_fee, relayer_fee, total_fee;
END;
$$ LANGUAGE plpgsql;

-- Function to check bridge transaction eligibility
CREATE OR REPLACE FUNCTION check_bridge_eligibility(
    p_asset_id UUID,
    p_source_chain VARCHAR(50),
    p_destination_chain VARCHAR(50),
    p_amount DECIMAL(20, 8)
) RETURNS TABLE (
    eligible BOOLEAN,
    reason VARCHAR(255),
    max_amount DECIMAL(20, 8),
    available_liquidity DECIMAL(20, 8)
) AS $$
DECLARE
    v_asset RECORD;
    v_pool RECORD;
    v_source_deployment JSONB;
    v_dest_deployment JSONB;
BEGIN
    -- Check if asset exists and bridge is enabled
    SELECT * INTO v_asset FROM bridge_assets WHERE id = p_asset_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Asset not found', 0::DECIMAL(20,8), 0::DECIMAL(20,8);
        RETURN;
    END IF;
    
    IF NOT v_asset.bridge_enabled THEN
        RETURN QUERY SELECT false, 'Bridge not enabled for this asset', 0::DECIMAL(20,8), 0::DECIMAL(20,8);
        RETURN;
    END IF;
    
    -- Check amount limits
    IF p_amount < v_asset.min_bridge_amount THEN
        RETURN QUERY SELECT false, 'Amount below minimum', v_asset.max_bridge_amount, 0::DECIMAL(20,8);
        RETURN;
    END IF;
    
    IF p_amount > v_asset.max_bridge_amount THEN
        RETURN QUERY SELECT false, 'Amount above maximum', v_asset.max_bridge_amount, 0::DECIMAL(20,8);
        RETURN;
    END IF;
    
    -- Check if asset is deployed on both chains
    v_source_deployment := v_asset.deployments->p_source_chain;
    v_dest_deployment := v_asset.deployments->p_destination_chain;
    
    IF v_source_deployment IS NULL THEN
        RETURN QUERY SELECT false, 'Asset not deployed on source chain', v_asset.max_bridge_amount, 0::DECIMAL(20,8);
        RETURN;
    END IF;
    
    IF v_dest_deployment IS NULL THEN
        RETURN QUERY SELECT false, 'Asset not deployed on destination chain', v_asset.max_bridge_amount, 0::DECIMAL(20,8);
        RETURN;
    END IF;
    
    -- Check destination liquidity
    SELECT * INTO v_pool 
    FROM liquidity_pools 
    WHERE asset_id = p_asset_id AND chain_id = p_destination_chain AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'No liquidity pool on destination chain', v_asset.max_bridge_amount, 0::DECIMAL(20,8);
        RETURN;
    END IF;
    
    IF v_pool.available_liquidity < p_amount THEN
        RETURN QUERY SELECT false, 'Insufficient liquidity', v_asset.max_bridge_amount, v_pool.available_liquidity;
        RETURN;
    END IF;
    
    -- All checks passed
    RETURN QUERY SELECT true, 'Eligible for bridging', v_asset.max_bridge_amount, v_pool.available_liquidity;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily bridge statistics
CREATE OR REPLACE FUNCTION update_bridge_statistics(p_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO bridge_statistics (
        date, asset_id, source_chain, destination_chain,
        transaction_count, total_volume, total_fees, average_transaction_size,
        successful_transactions, failed_transactions,
        average_completion_time_ms, median_completion_time_ms,
        fastest_completion_time_ms, slowest_completion_time_ms
    )
    SELECT 
        p_date,
        asset_id,
        source_chain,
        destination_chain,
        COUNT(*) as transaction_count,
        SUM(source_amount) as total_volume,
        SUM(total_fees) as total_fees,
        AVG(source_amount) as average_transaction_size,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_transactions,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_transactions,
        AVG(actual_completion_time_ms) as average_completion_time_ms,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY actual_completion_time_ms) as median_completion_time_ms,
        MIN(actual_completion_time_ms) as fastest_completion_time_ms,
        MAX(actual_completion_time_ms) as slowest_completion_time_ms
    FROM bridge_transactions
    WHERE DATE(initiated_at) = p_date
    GROUP BY asset_id, source_chain, destination_chain
    ON CONFLICT (date, asset_id, source_chain, destination_chain) 
    DO UPDATE SET
        transaction_count = EXCLUDED.transaction_count,
        total_volume = EXCLUDED.total_volume,
        total_fees = EXCLUDED.total_fees,
        average_transaction_size = EXCLUDED.average_transaction_size,
        successful_transactions = EXCLUDED.successful_transactions,
        failed_transactions = EXCLUDED.failed_transactions,
        average_completion_time_ms = EXCLUDED.average_completion_time_ms,
        median_completion_time_ms = EXCLUDED.median_completion_time_ms,
        fastest_completion_time_ms = EXCLUDED.fastest_completion_time_ms,
        slowest_completion_time_ms = EXCLUDED.slowest_completion_time_ms;
END;
$$ LANGUAGE plpgsql;

-- Create views for easy querying

-- View for active bridge routes
CREATE OR REPLACE VIEW active_bridge_routes AS
SELECT DISTINCT
    ba.symbol as asset_symbol,
    ba.name as asset_name,
    sc1.name as source_chain_name,
    sc1.chain_id as source_chain_id,
    sc2.name as destination_chain_name,
    sc2.chain_id as destination_chain_id,
    lp.available_liquidity,
    lp.total_liquidity,
    (lp.reserved_liquidity / NULLIF(lp.total_liquidity, 0) * 100) as utilization_percentage,
    ba.min_bridge_amount,
    ba.max_bridge_amount
FROM bridge_assets ba
CROSS JOIN supported_chains sc1
CROSS JOIN supported_chains sc2
LEFT JOIN liquidity_pools lp ON (lp.asset_id = ba.id AND lp.chain_id = sc2.chain_id)
WHERE ba.bridge_enabled = true
AND ba.deployments ? sc1.chain_id
AND ba.deployments ? sc2.chain_id
AND sc1.chain_id != sc2.chain_id
AND sc1.is_active = true
AND sc2.is_active = true
AND (lp.is_active = true OR lp.is_active IS NULL);
