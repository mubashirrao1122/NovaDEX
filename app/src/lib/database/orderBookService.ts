import { DatabaseConnection } from './connection';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface OrderBookEntry {
  id: string;
  marketPair: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  userId: string;
  orderType: 'limit' | 'market' | 'stop_loss' | 'take_profit' | 'trailing_stop';
  status: 'active' | 'partial' | 'filled' | 'cancelled' | 'expired';
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  expiresAt?: Date;
  commitHash?: string;
  revealDeadline?: Date;
  isRevealed: boolean;
  protectionLevel: 'none' | 'standard' | 'maximum';
  stopPrice?: number;
  trailAmount?: number;
  trailPercent?: number;
  triggerCondition?: any;
  clientOrderId?: string;
  signature?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TradeExecution {
  id: string;
  marketPair: string;
  takerOrderId: string;
  makerOrderId: string;
  takerUserId: string;
  makerUserId: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  takerFee: number;
  makerFee: number;
  protectionApplied: boolean;
  batchId?: string;
  executionDelayMs: number;
  midPrice?: number;
  spread?: number;
  executionId: string;
  executedAt: Date;
}

export interface MarketSnapshot {
  marketPair: string;
  bestBid?: number;
  bestAsk?: number;
  bidSize?: number;
  askSize?: number;
  midPrice?: number;
  spread?: number;
  spreadBps?: number;
  volume24h: number;
  trades24h: number;
  lastPrice?: number;
  priceChange24h?: number;
  priceChangePercent24h?: number;
  totalBidLiquidity: number;
  totalAskLiquidity: number;
  liquidityDepth1pct?: number;
  liquidityDepth5pct?: number;
  timestamp: Date;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
  cumulativeQuantity: number;
}

export interface OrderBookDepth {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  marketPair: string;
  timestamp: Date;
}

export interface MarketImpact {
  averagePrice: number;
  totalCost: number;
  priceImpactBps: number;
  liquidityAvailable: boolean;
}

export class OrderBookService extends EventEmitter {
  private db: DatabaseConnection;
  private wsServer?: WebSocket.Server;
  private marketSubscriptions: Map<string, Set<WebSocket>> = new Map();
  private orderBookCache: Map<string, OrderBookDepth> = new Map();
  private marketSnapshotCache: Map<string, MarketSnapshot> = new Map();

  constructor() {
    super();
    this.db = DatabaseConnection.getInstance();
    this.setupWebSocketServer();
    this.startMarketDataUpdates();
  }

  // WebSocket server for real-time updates
  private setupWebSocketServer(port: number = 8080): void {
    this.wsServer = new WebSocket.Server({ port });

    this.wsServer.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket connection established');

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        this.unsubscribeFromAllMarkets(ws);
        console.log('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    console.log(`Order Book WebSocket server started on port ${port}`);
  }

  private async handleWebSocketMessage(ws: WebSocket, data: any): Promise<void> {
    switch (data.type) {
      case 'subscribe':
        await this.subscribeToMarket(ws, data.marketPair);
        break;
      case 'unsubscribe':
        this.unsubscribeFromMarket(ws, data.marketPair);
        break;
      case 'getOrderBook':
        await this.sendOrderBookSnapshot(ws, data.marketPair, data.depth);
        break;
      case 'getMarketData':
        await this.sendMarketSnapshot(ws, data.marketPair);
        break;
      default:
        ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  }

  // Market subscription management
  private async subscribeToMarket(ws: WebSocket, marketPair: string): Promise<void> {
    if (!this.marketSubscriptions.has(marketPair)) {
      this.marketSubscriptions.set(marketPair, new Set());
    }
    
    this.marketSubscriptions.get(marketPair)!.add(ws);
    
    // Send initial order book snapshot
    await this.sendOrderBookSnapshot(ws, marketPair);
    await this.sendMarketSnapshot(ws, marketPair);
    
    ws.send(JSON.stringify({
      type: 'subscribed',
      marketPair,
      timestamp: new Date().toISOString()
    }));
  }

  private unsubscribeFromMarket(ws: WebSocket, marketPair: string): void {
    const subscribers = this.marketSubscriptions.get(marketPair);
    if (subscribers) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.marketSubscriptions.delete(marketPair);
      }
    }
  }

  private unsubscribeFromAllMarkets(ws: WebSocket): void {
    this.marketSubscriptions.forEach((subscribers, marketPair) => {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.marketSubscriptions.delete(marketPair);
      }
    });
  }

  // Order management
  async createOrder(orderData: Partial<OrderBookEntry>): Promise<OrderBookEntry> {
    const {
      marketPair, side, price, quantity, userId, orderType = 'limit',
      timeInForce = 'GTC', protectionLevel = 'standard', stopPrice,
      trailAmount, trailPercent, triggerCondition, clientOrderId, signature
    } = orderData;

    if (!marketPair || !side || !userId || !quantity) {
      throw new Error('Missing required order parameters');
    }

    // Generate commit hash for MEV protection
    let commitHash: string | undefined;
    let revealDeadline: Date | undefined;
    
    if (protectionLevel !== 'none') {
      commitHash = this.generateCommitHash(orderData);
      revealDeadline = new Date(Date.now() + (protectionLevel === 'maximum' ? 30000 : 15000)); // 30s or 15s delay
    }

    const result = await this.db.query(`
      INSERT INTO order_book_entries (
        market_pair, side, price, quantity, user_id, order_type, time_in_force,
        protection_level, commit_hash, reveal_deadline, stop_price, trail_amount,
        trail_percent, trigger_condition, client_order_id, signature
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      marketPair, side, price, quantity, userId, orderType, timeInForce,
      protectionLevel, commitHash, revealDeadline, stopPrice, trailAmount,
      trailPercent, triggerCondition ? JSON.stringify(triggerCondition) : null,
      clientOrderId, signature
    ]);

    const order = this.mapRowToOrderBookEntry(result.rows[0]);
    
    // Emit order created event
    this.emit('orderCreated', order);
    
    // Try to match the order immediately
    if (orderType === 'market' || (orderType === 'limit' && protectionLevel === 'none')) {
      await this.attemptOrderMatching(order);
    }

    // Update market data and notify subscribers
    await this.updateAndBroadcastMarketData(marketPair);
    
    return order;
  }

  async cancelOrder(orderId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(`
      UPDATE order_book_entries 
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status = 'active'
      RETURNING market_pair
    `, [orderId, userId]);

    if (result.rows.length === 0) {
      return false;
    }

    const marketPair = result.rows[0].market_pair;
    
    // Emit order cancelled event
    this.emit('orderCancelled', { orderId, userId, marketPair });
    
    // Update market data
    await this.updateAndBroadcastMarketData(marketPair);
    
    return true;
  }

  // Order matching engine
  private async attemptOrderMatching(takerOrder: OrderBookEntry): Promise<void> {
    if (takerOrder.protectionLevel !== 'none' && !takerOrder.isRevealed) {
      // Order is protected and not yet revealed
      return;
    }

    const oppositeSide = takerOrder.side === 'buy' ? 'sell' : 'buy';
    
    // Get matching orders
    const matchingOrders = await this.db.query(`
      SELECT * FROM order_book_entries
      WHERE market_pair = $1 
      AND side = $2 
      AND status = 'active'
      AND remaining_quantity > 0
      AND (protection_level = 'none' OR is_revealed = true)
      AND (
        ($3 = 'buy' AND price <= $4) OR
        ($3 = 'sell' AND price >= $4)
      )
      ORDER BY 
        CASE WHEN $3 = 'buy' THEN price END ASC,
        CASE WHEN $3 = 'sell' THEN price END DESC,
        created_at ASC
    `, [takerOrder.marketPair, oppositeSide, takerOrder.side, takerOrder.price]);

    let remainingQuantity = takerOrder.remainingQuantity;
    const executions: TradeExecution[] = [];

    for (const makerRow of matchingOrders.rows) {
      if (remainingQuantity <= 0) break;

      const makerOrder = this.mapRowToOrderBookEntry(makerRow);
      const matchQuantity = Math.min(remainingQuantity, makerOrder.remainingQuantity);
      const executionPrice = makerOrder.price; // Price improvement for taker

      // Create trade execution
      const execution = await this.executeMatch(takerOrder, makerOrder, matchQuantity, executionPrice);
      executions.push(execution);

      remainingQuantity -= matchQuantity;

      // Update order quantities
      await this.updateOrderQuantities(takerOrder.id, matchQuantity);
      await this.updateOrderQuantities(makerOrder.id, matchQuantity);
    }

    // Update taker order status
    if (remainingQuantity === 0) {
      await this.updateOrderStatus(takerOrder.id, 'filled');
    } else if (remainingQuantity < takerOrder.quantity) {
      await this.updateOrderStatus(takerOrder.id, 'partial');
    }

    // Emit trade executions
    for (const execution of executions) {
      this.emit('tradeExecuted', execution);
    }
  }

  private async executeMatch(
    takerOrder: OrderBookEntry,
    makerOrder: OrderBookEntry,
    quantity: number,
    price: number
  ): Promise<TradeExecution> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const takerFee = quantity * price * 0.001; // 0.1% taker fee
    const makerFee = quantity * price * 0.0005; // 0.05% maker fee

    const result = await this.db.query(`
      INSERT INTO trade_executions (
        market_pair, taker_order_id, maker_order_id, taker_user_id, maker_user_id,
        side, price, quantity, taker_fee, maker_fee, execution_id, protection_applied
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      takerOrder.marketPair, takerOrder.id, makerOrder.id, takerOrder.userId, makerOrder.userId,
      takerOrder.side, price, quantity, takerFee, makerFee, executionId,
      takerOrder.protectionLevel !== 'none' || makerOrder.protectionLevel !== 'none'
    ]);

    return this.mapRowToTradeExecution(result.rows[0]);
  }

  private async updateOrderQuantities(orderId: string, filledQuantity: number): Promise<void> {
    await this.db.query(`
      UPDATE order_book_entries 
      SET filled_quantity = filled_quantity + $1, updated_at = NOW()
      WHERE id = $2
    `, [filledQuantity, orderId]);
  }

  private async updateOrderStatus(orderId: string, status: string): Promise<void> {
    await this.db.query(`
      UPDATE order_book_entries 
      SET status = $1, updated_at = NOW(), filled_at = CASE WHEN $1 = 'filled' THEN NOW() ELSE filled_at END
      WHERE id = $2
    `, [status, orderId]);
  }

  // Order book data retrieval
  async getOrderBookDepth(marketPair: string, depth: number = 20): Promise<OrderBookDepth> {
    // Check cache first
    const cached = this.orderBookCache.get(marketPair);
    if (cached && (Date.now() - cached.timestamp.getTime()) < 1000) { // 1 second cache
      return cached;
    }

    const result = await this.db.query(`
      SELECT * FROM get_order_book_depth($1, $2)
    `, [marketPair, depth]);

    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];

    for (const row of result.rows) {
      const level: OrderBookLevel = {
        price: parseFloat(row.price),
        quantity: parseFloat(row.quantity),
        orderCount: parseInt(row.order_count),
        cumulativeQuantity: parseFloat(row.cumulative_quantity)
      };

      if (row.side === 'buy') {
        bids.push(level);
      } else {
        asks.push(level);
      }
    }

    const orderBook: OrderBookDepth = {
      bids,
      asks,
      marketPair,
      timestamp: new Date()
    };

    // Cache the result
    this.orderBookCache.set(marketPair, orderBook);
    
    return orderBook;
  }

  async calculateMarketImpact(marketPair: string, side: 'buy' | 'sell', quantity: number): Promise<MarketImpact> {
    const result = await this.db.query(`
      SELECT * FROM calculate_market_impact($1, $2, $3)
    `, [marketPair, side, quantity]);

    const row = result.rows[0];
    return {
      averagePrice: parseFloat(row.average_price) || 0,
      totalCost: parseFloat(row.total_cost) || 0,
      priceImpactBps: parseFloat(row.price_impact_bps) || 0,
      liquidityAvailable: row.liquidity_available || false
    };
  }

  async getMarketSnapshot(marketPair: string): Promise<MarketSnapshot | null> {
    // Check cache first
    const cached = this.marketSnapshotCache.get(marketPair);
    if (cached && (Date.now() - cached.timestamp.getTime()) < 5000) { // 5 second cache
      return cached;
    }

    const result = await this.db.query(`
      SELECT * FROM market_snapshots 
      WHERE market_pair = $1 
      ORDER BY timestamp DESC LIMIT 1
    `, [marketPair]);

    if (result.rows.length === 0) {
      return null;
    }

    const snapshot = this.mapRowToMarketSnapshot(result.rows[0]);
    this.marketSnapshotCache.set(marketPair, snapshot);
    
    return snapshot;
  }

  // MEV Protection
  private generateCommitHash(orderData: any): string {
    const crypto = require('crypto');
    const orderString = JSON.stringify({
      ...orderData,
      nonce: Math.random(),
      timestamp: Date.now()
    });
    return crypto.createHash('sha256').update(orderString).digest('hex');
  }

  async revealOrder(orderId: string, originalOrderData: any): Promise<boolean> {
    const result = await this.db.query(`
      SELECT * FROM order_book_entries 
      WHERE id = $1 AND reveal_deadline > NOW() AND is_revealed = false
    `, [orderId]);

    if (result.rows.length === 0) {
      return false;
    }

    const order = result.rows[0];
    const expectedHash = this.generateCommitHash(originalOrderData);

    if (order.commit_hash !== expectedHash) {
      return false;
    }

    // Reveal the order
    await this.db.query(`
      UPDATE order_book_entries 
      SET is_revealed = true, updated_at = NOW()
      WHERE id = $1
    `, [orderId]);

    // Now attempt matching
    const revealedOrder = this.mapRowToOrderBookEntry({
      ...order,
      is_revealed: true
    });
    
    await this.attemptOrderMatching(revealedOrder);
    
    return true;
  }

  // Real-time updates
  private startMarketDataUpdates(): void {
    // Update market snapshots every 5 seconds
    setInterval(async () => {
      const marketPairs = Array.from(this.marketSubscriptions.keys());
      for (const marketPair of marketPairs) {
        await this.updateMarketSnapshot(marketPair);
      }
    }, 5000);

    // Clean up expired orders every minute
    setInterval(async () => {
      await this.cleanupExpiredOrders();
    }, 60000);
  }

  private async updateMarketSnapshot(marketPair: string): Promise<void> {
    await this.db.query('SELECT update_market_snapshot($1)', [marketPair]);
    
    // Clear cache to force refresh
    this.marketSnapshotCache.delete(marketPair);
    
    // Get updated snapshot and broadcast
    const snapshot = await this.getMarketSnapshot(marketPair);
    if (snapshot) {
      this.broadcastToMarketSubscribers(marketPair, {
        type: 'marketSnapshot',
        data: snapshot
      });
    }
  }

  private async updateAndBroadcastMarketData(marketPair: string): Promise<void> {
    // Update market snapshot
    await this.updateMarketSnapshot(marketPair);
    
    // Get updated order book
    const orderBook = await this.getOrderBookDepth(marketPair);
    
    // Broadcast to subscribers
    this.broadcastToMarketSubscribers(marketPair, {
      type: 'orderBookUpdate',
      data: orderBook
    });
  }

  private async cleanupExpiredOrders(): Promise<void> {
    await this.db.query(`
      UPDATE order_book_entries 
      SET status = 'expired', updated_at = NOW()
      WHERE expires_at <= NOW() AND status = 'active'
    `);
  }

  // WebSocket broadcasting
  private broadcastToMarketSubscribers(marketPair: string, message: any): void {
    const subscribers = this.marketSubscriptions.get(marketPair);
    if (!subscribers) return;

    const messageString = JSON.stringify(message);
    
    subscribers.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageString);
      }
    });
  }

  private async sendOrderBookSnapshot(ws: WebSocket, marketPair: string, depth: number = 20): Promise<void> {
    const orderBook = await this.getOrderBookDepth(marketPair, depth);
    ws.send(JSON.stringify({
      type: 'orderBookSnapshot',
      data: orderBook
    }));
  }

  private async sendMarketSnapshot(ws: WebSocket, marketPair: string): Promise<void> {
    const snapshot = await this.getMarketSnapshot(marketPair);
    ws.send(JSON.stringify({
      type: 'marketSnapshot',
      data: snapshot
    }));
  }

  // Utility mapping functions
  private mapRowToOrderBookEntry(row: any): OrderBookEntry {
    return {
      id: row.id,
      marketPair: row.market_pair,
      side: row.side,
      price: parseFloat(row.price),
      quantity: parseFloat(row.quantity),
      filledQuantity: parseFloat(row.filled_quantity),
      remainingQuantity: parseFloat(row.remaining_quantity),
      userId: row.user_id,
      orderType: row.order_type,
      status: row.status,
      timeInForce: row.time_in_force,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      commitHash: row.commit_hash,
      revealDeadline: row.reveal_deadline ? new Date(row.reveal_deadline) : undefined,
      isRevealed: row.is_revealed,
      protectionLevel: row.protection_level,
      stopPrice: row.stop_price ? parseFloat(row.stop_price) : undefined,
      trailAmount: row.trail_amount ? parseFloat(row.trail_amount) : undefined,
      trailPercent: row.trail_percent ? parseFloat(row.trail_percent) : undefined,
      triggerCondition: row.trigger_condition ? JSON.parse(row.trigger_condition) : undefined,
      clientOrderId: row.client_order_id,
      signature: row.signature,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToTradeExecution(row: any): TradeExecution {
    return {
      id: row.id,
      marketPair: row.market_pair,
      takerOrderId: row.taker_order_id,
      makerOrderId: row.maker_order_id,
      takerUserId: row.taker_user_id,
      makerUserId: row.maker_user_id,
      side: row.side,
      price: parseFloat(row.price),
      quantity: parseFloat(row.quantity),
      takerFee: parseFloat(row.taker_fee),
      makerFee: parseFloat(row.maker_fee),
      protectionApplied: row.protection_applied,
      batchId: row.batch_id,
      executionDelayMs: row.execution_delay_ms,
      midPrice: row.mid_price ? parseFloat(row.mid_price) : undefined,
      spread: row.spread ? parseFloat(row.spread) : undefined,
      executionId: row.execution_id,
      executedAt: new Date(row.executed_at)
    };
  }

  private mapRowToMarketSnapshot(row: any): MarketSnapshot {
    return {
      marketPair: row.market_pair,
      bestBid: row.best_bid ? parseFloat(row.best_bid) : undefined,
      bestAsk: row.best_ask ? parseFloat(row.best_ask) : undefined,
      bidSize: row.bid_size ? parseFloat(row.bid_size) : undefined,
      askSize: row.ask_size ? parseFloat(row.ask_size) : undefined,
      midPrice: row.mid_price ? parseFloat(row.mid_price) : undefined,
      spread: row.spread ? parseFloat(row.spread) : undefined,
      spreadBps: row.spread_bps ? parseFloat(row.spread_bps) : undefined,
      volume24h: parseFloat(row.volume_24h),
      trades24h: parseInt(row.trades_24h),
      lastPrice: row.last_price ? parseFloat(row.last_price) : undefined,
      priceChange24h: row.price_change_24h ? parseFloat(row.price_change_24h) : undefined,
      priceChangePercent24h: row.price_change_percent_24h ? parseFloat(row.price_change_percent_24h) : undefined,
      totalBidLiquidity: parseFloat(row.total_bid_liquidity),
      totalAskLiquidity: parseFloat(row.total_ask_liquidity),
      liquidityDepth1pct: row.liquidity_depth_1pct ? parseFloat(row.liquidity_depth_1pct) : undefined,
      liquidityDepth5pct: row.liquidity_depth_5pct ? parseFloat(row.liquidity_depth_5pct) : undefined,
      timestamp: new Date(row.timestamp)
    };
  }

  // Cleanup
  async close(): Promise<void> {
    if (this.wsServer) {
      this.wsServer.close();
    }
  }
}

export default OrderBookService;
