-- NovaDex Database Schema
-- PostgreSQL initialization script

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(44) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(50) UNIQUE,
    profile_image_url TEXT,
    kyc_status VARCHAR(20) DEFAULT 'not_verified',
    kyc_data JSONB,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    referral_code VARCHAR(20) UNIQUE,
    referred_by UUID REFERENCES users(id)
);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Trading pairs table
CREATE TABLE trading_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_token VARCHAR(44) NOT NULL,
    quote_token VARCHAR(44) NOT NULL,
    base_symbol VARCHAR(10) NOT NULL,
    quote_symbol VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(base_token, quote_token)
);

-- Trades table
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    pair_id UUID REFERENCES trading_pairs(id),
    transaction_signature VARCHAR(88) UNIQUE,
    trade_type VARCHAR(20) NOT NULL, -- 'buy', 'sell', 'swap'
    base_amount DECIMAL(36, 18) NOT NULL,
    quote_amount DECIMAL(36, 18) NOT NULL,
    price DECIMAL(36, 18) NOT NULL,
    fee_amount DECIMAL(36, 18) DEFAULT 0,
    fee_token VARCHAR(44),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
    slippage DECIMAL(5, 4),
    route_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    block_number BIGINT
);

-- Liquidity positions table
CREATE TABLE liquidity_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    pair_id UUID REFERENCES trading_pairs(id),
    pool_address VARCHAR(44),
    token_a_amount DECIMAL(36, 18) NOT NULL,
    token_b_amount DECIMAL(36, 18) NOT NULL,
    lp_token_amount DECIMAL(36, 18) NOT NULL,
    position_value_usd DECIMAL(18, 8),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'withdrawn'
    entry_price_a DECIMAL(36, 18),
    entry_price_b DECIMAL(36, 18),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Portfolio snapshots table
CREATE TABLE portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    total_value_usd DECIMAL(18, 8) NOT NULL,
    tokens JSONB NOT NULL,
    positions JSONB,
    pnl_24h DECIMAL(18, 8),
    pnl_7d DECIMAL(18, 8),
    pnl_30d DECIMAL(18, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Token balances table
CREATE TABLE token_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    token_address VARCHAR(44) NOT NULL,
    token_symbol VARCHAR(10) NOT NULL,
    balance DECIMAL(36, 18) NOT NULL DEFAULT 0,
    balance_usd DECIMAL(18, 8),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token_address)
);

-- Orders table (for limit orders, stop orders, etc.)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    pair_id UUID REFERENCES trading_pairs(id),
    order_type VARCHAR(20) NOT NULL, -- 'limit', 'market', 'stop', 'stop_limit'
    side VARCHAR(10) NOT NULL, -- 'buy', 'sell'
    amount DECIMAL(36, 18) NOT NULL,
    price DECIMAL(36, 18),
    stop_price DECIMAL(36, 18),
    filled_amount DECIMAL(36, 18) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'filled', 'cancelled', 'expired'
    time_in_force VARCHAR(10) DEFAULT 'GTC', -- 'GTC', 'IOC', 'FOK'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Yield farming positions table
CREATE TABLE yield_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    pool_address VARCHAR(44) NOT NULL,
    strategy_name VARCHAR(100),
    staked_amount DECIMAL(36, 18) NOT NULL,
    staked_token VARCHAR(44) NOT NULL,
    rewards_earned DECIMAL(36, 18) DEFAULT 0,
    rewards_token VARCHAR(44),
    apy DECIMAL(8, 4),
    auto_compound BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API keys table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    key_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    api_secret_hash VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '{"read": true, "trade": false}',
    ip_whitelist TEXT[],
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_pair_id ON trades(pair_id);
CREATE INDEX idx_trades_created_at ON trades(created_at);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_portfolio_snapshots_user_id ON portfolio_snapshots(user_id);
CREATE INDEX idx_portfolio_snapshots_created_at ON portfolio_snapshots(created_at);
CREATE INDEX idx_token_balances_user_id ON token_balances(user_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_liquidity_positions_user_id ON liquidity_positions(user_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_liquidity_positions_updated_at BEFORE UPDATE ON liquidity_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_yield_positions_updated_at BEFORE UPDATE ON yield_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
