import { db, CACHE_KEYS, CACHE_TTL } from './connection';
import { v4 as uuidv4 } from 'uuid';

export interface Trade {
  id?: string;
  user_id: string;
  pair_id: string;
  transaction_signature?: string;
  trade_type: 'buy' | 'sell' | 'swap';
  base_amount: number;
  quote_amount: number;
  price: number;
  fee_amount: number;
  fee_token?: string;
  status: 'pending' | 'confirmed' | 'failed';
  slippage?: number;
  route_info?: any;
  created_at?: Date;
  confirmed_at?: Date;
  block_number?: number;
}

export interface LiquidityPosition {
  id?: string;
  user_id: string;
  pair_id: string;
  pool_address: string;
  token_a_amount: number;
  token_b_amount: number;
  lp_token_amount: number;
  position_value_usd?: number;
  status: 'active' | 'withdrawn';
  entry_price_a?: number;
  entry_price_b?: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface Order {
  id?: string;
  user_id: string;
  pair_id: string;
  order_type: 'limit' | 'market' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stop_price?: number;
  filled_amount: number;
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  time_in_force: 'GTC' | 'IOC' | 'FOK';
  created_at?: Date;
  updated_at?: Date;
  expires_at?: Date;
}

export class TradingService {
  // Create a new trade
  async createTrade(tradeData: Trade): Promise<Trade> {
    const tradeId = uuidv4();
    
    const query = `
      INSERT INTO trades (
        id, user_id, pair_id, transaction_signature, trade_type,
        base_amount, quote_amount, price, fee_amount, fee_token,
        status, slippage, route_info
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      tradeId,
      tradeData.user_id,
      tradeData.pair_id,
      tradeData.transaction_signature,
      tradeData.trade_type,
      tradeData.base_amount,
      tradeData.quote_amount,
      tradeData.price,
      tradeData.fee_amount,
      tradeData.fee_token,
      tradeData.status || 'pending',
      tradeData.slippage,
      JSON.stringify(tradeData.route_info || {}),
    ];

    const result = await db.query(query, values);
    const trade = result.rows[0];

    // Invalidate user trades cache
    await db.deleteCache(CACHE_KEYS.USER_TRADES(tradeData.user_id));

    return trade;
  }

  // Update trade status
  async updateTradeStatus(tradeId: string, status: string, transactionSignature?: string, blockNumber?: number): Promise<Trade> {
    const query = `
      UPDATE trades 
      SET status = $2, transaction_signature = COALESCE($3, transaction_signature),
          block_number = $4, confirmed_at = CASE WHEN $2 = 'confirmed' THEN NOW() ELSE confirmed_at END
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [tradeId, status, transactionSignature, blockNumber]);
    
    if (result.rows.length === 0) {
      throw new Error('Trade not found');
    }

    const trade = result.rows[0];

    // Invalidate user trades cache
    await db.deleteCache(CACHE_KEYS.USER_TRADES(trade.user_id));

    return trade;
  }

  // Get user trades with pagination
  async getUserTrades(userId: string, options: {
    limit?: number;
    offset?: number;
    status?: string;
    pair_id?: string;
  } = {}): Promise<{ trades: Trade[]; total: number }> {
    const { limit = 50, offset = 0, status, pair_id } = options;
    
    // Try cache for recent trades
    const cacheKey = CACHE_KEYS.USER_TRADES(userId);
    let cachedTrades = await db.getCache(cacheKey);

    if (!cachedTrades || status || pair_id) {
      let whereClause = 'WHERE t.user_id = $1';
      const params = [userId];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND t.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (pair_id) {
        whereClause += ` AND t.pair_id = $${paramIndex}`;
        params.push(pair_id);
        paramIndex++;
      }

      const query = `
        SELECT 
          t.*,
          tp.base_symbol,
          tp.quote_symbol
        FROM trades t
        JOIN trading_pairs tp ON t.pair_id = tp.id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const countQuery = `
        SELECT COUNT(*) as total
        FROM trades t
        ${whereClause}
      `;

      const [tradesResult, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, params.slice(0, -2)), // Remove limit and offset for count
      ]);

      const trades = tradesResult.rows;
      const total = parseInt(countResult.rows[0].total);

      // Cache recent trades if no filters
      if (!status && !pair_id && offset === 0) {
        await db.setCache(cacheKey, trades, CACHE_TTL.USER_TRADES);
      }

      return { trades, total };
    }

    return { trades: cachedTrades, total: cachedTrades.length };
  }

  // Create liquidity position
  async createLiquidityPosition(positionData: LiquidityPosition): Promise<LiquidityPosition> {
    const positionId = uuidv4();
    
    const query = `
      INSERT INTO liquidity_positions (
        id, user_id, pair_id, pool_address, token_a_amount,
        token_b_amount, lp_token_amount, position_value_usd,
        entry_price_a, entry_price_b
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      positionId,
      positionData.user_id,
      positionData.pair_id,
      positionData.pool_address,
      positionData.token_a_amount,
      positionData.token_b_amount,
      positionData.lp_token_amount,
      positionData.position_value_usd,
      positionData.entry_price_a,
      positionData.entry_price_b,
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Create order
  async createOrder(orderData: Order): Promise<Order> {
    const orderId = uuidv4();
    
    const query = `
      INSERT INTO orders (
        id, user_id, pair_id, order_type, side, amount, price,
        stop_price, time_in_force, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      orderId,
      orderData.user_id,
      orderData.pair_id,
      orderData.order_type,
      orderData.side,
      orderData.amount,
      orderData.price,
      orderData.stop_price,
      orderData.time_in_force || 'GTC',
      orderData.expires_at,
    ];

    const result = await db.query(query, values);
    const order = result.rows[0];

    // Invalidate user orders cache
    await db.deleteCache(CACHE_KEYS.USER_ORDERS(orderData.user_id));

    return order;
  }

  // Get user orders
  async getUserOrders(userId: string, status?: string): Promise<Order[]> {
    const cacheKey = CACHE_KEYS.USER_ORDERS(userId);
    let orders = await db.getCache(cacheKey);

    if (!orders || status) {
      let whereClause = 'WHERE o.user_id = $1';
      const params = [userId];

      if (status) {
        whereClause += ' AND o.status = $2';
        params.push(status);
      }

      const query = `
        SELECT 
          o.*,
          tp.base_symbol,
          tp.quote_symbol
        FROM orders o
        JOIN trading_pairs tp ON o.pair_id = tp.id
        ${whereClause}
        ORDER BY o.created_at DESC
      `;

      const result = await db.query(query, params);
      orders = result.rows;

      // Cache if no status filter
      if (!status) {
        await db.setCache(cacheKey, orders, CACHE_TTL.USER_ORDERS);
      }
    }

    return orders;
  }

  // Cancel order
  async cancelOrder(orderId: string, userId: string): Promise<Order> {
    const query = `
      UPDATE orders 
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status = 'open'
      RETURNING *
    `;

    const result = await db.query(query, [orderId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Order not found or cannot be cancelled');
    }

    const order = result.rows[0];

    // Invalidate user orders cache
    await db.deleteCache(CACHE_KEYS.USER_ORDERS(userId));

    return order;
  }

  // Get trading statistics
  async getTradingStats(userId?: string, days: number = 30): Promise<{
    total_trades: number;
    total_volume: number;
    total_fees: number;
    successful_trades: number;
    avg_trade_size: number;
    most_traded_pair: string;
    daily_volume: any[];
  }> {
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    let whereClause = 'WHERE t.created_at >= $1';
    const params = [fromDate];

    if (userId) {
      whereClause += ' AND t.user_id = $2';
      params.push(userId);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_trades,
        COALESCE(SUM(t.quote_amount), 0) as total_volume,
        COALESCE(SUM(t.fee_amount), 0) as total_fees,
        COUNT(CASE WHEN t.status = 'confirmed' THEN 1 END) as successful_trades,
        COALESCE(AVG(t.quote_amount), 0) as avg_trade_size,
        (
          SELECT tp.base_symbol || '/' || tp.quote_symbol
          FROM trades t2
          JOIN trading_pairs tp ON t2.pair_id = tp.id
          ${whereClause.replace('t.', 't2.')}
          GROUP BY tp.id, tp.base_symbol, tp.quote_symbol
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) as most_traded_pair
      FROM trades t
      ${whereClause}
    `;

    const dailyVolumeQuery = `
      SELECT 
        DATE(t.created_at) as date,
        COALESCE(SUM(t.quote_amount), 0) as volume,
        COUNT(*) as trades
      FROM trades t
      ${whereClause}
      GROUP BY DATE(t.created_at)
      ORDER BY date ASC
    `;

    const [statsResult, dailyVolumeResult] = await Promise.all([
      db.query(statsQuery, params),
      db.query(dailyVolumeQuery, params),
    ]);

    const stats = statsResult.rows[0];
    const dailyVolume = dailyVolumeResult.rows;

    return {
      total_trades: parseInt(stats.total_trades) || 0,
      total_volume: parseFloat(stats.total_volume) || 0,
      total_fees: parseFloat(stats.total_fees) || 0,
      successful_trades: parseInt(stats.successful_trades) || 0,
      avg_trade_size: parseFloat(stats.avg_trade_size) || 0,
      most_traded_pair: stats.most_traded_pair || 'N/A',
      daily_volume: dailyVolume,
    };
  }
}
