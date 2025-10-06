import { DatabaseConnection } from './connection';
import { EventEmitter } from 'events';

export interface AdvancedOrderConfig {
  stopPrice?: number;
  takeProfitPrice?: number;
  trailAmount?: number;
  trailPercent?: number;
  triggerCondition?: TriggerCondition;
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  expiresAt?: Date;
  reduceOnly?: boolean; // Only reduce position size
  postOnly?: boolean; // Only add liquidity (maker only)
}

export interface TriggerCondition {
  type: 'price' | 'time' | 'volume' | 'custom';
  operator: 'gte' | 'lte' | 'eq' | 'between';
  value: number | number[];
  reference?: string; // Market pair or indicator reference
  timeframe?: string; // For time-based conditions
  customLogic?: string; // Custom JS logic for complex conditions
}

export interface ConditionalOrder {
  id: string;
  userId: string;
  marketPair: string;
  orderType: 'stop_loss' | 'take_profit' | 'trailing_stop' | 'conditional' | 'oco'; // One-Cancels-Other
  side: 'buy' | 'sell';
  quantity: number;
  
  // Price parameters
  limitPrice?: number;
  stopPrice?: number;
  takeProfitPrice?: number;
  
  // Trailing parameters
  trailAmount?: number;
  trailPercent?: number;
  trailHighWaterMark?: number; // For trailing stops
  
  // Trigger conditions
  triggerCondition?: TriggerCondition;
  isTriggered: boolean;
  triggeredAt?: Date;
  triggeredPrice?: number;
  
  // Order state
  status: 'active' | 'triggered' | 'filled' | 'cancelled' | 'expired';
  parentOrderId?: string; // For OCO orders
  childOrderIds?: string[]; // For complex order structures
  
  // Execution parameters
  timeInForce: string;
  expiresAt?: Date;
  reduceOnly: boolean;
  postOnly: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt?: Date;
}

export interface OrderExecution {
  orderId: string;
  executionType: 'full' | 'partial';
  executedQuantity: number;
  executedPrice: number;
  remainingQuantity: number;
  fees: number;
  timestamp: Date;
}

export interface PositionInfo {
  userId: string;
  marketPair: string;
  side: 'long' | 'short';
  size: number;
  averagePrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  marginUsed: number;
  liquidationPrice?: number;
}

export class AdvancedOrderService extends EventEmitter {
  private db: DatabaseConnection;
  private activeOrders: Map<string, ConditionalOrder> = new Map();
  private priceMonitors: Map<string, NodeJS.Timeout> = new Map();
  private positions: Map<string, PositionInfo> = new Map();

  constructor() {
    super();
    this.db = DatabaseConnection.getInstance();
    this.startOrderMonitoring();
    this.loadActiveOrders();
  }

  // Create advanced orders
  async createStopLossOrder(
    userId: string,
    marketPair: string,
    side: 'buy' | 'sell',
    quantity: number,
    stopPrice: number,
    limitPrice?: number,
    config: Partial<AdvancedOrderConfig> = {}
  ): Promise<ConditionalOrder> {
    const order: Partial<ConditionalOrder> = {
      userId,
      marketPair,
      orderType: 'stop_loss',
      side,
      quantity,
      stopPrice,
      limitPrice,
      triggerCondition: {
        type: 'price',
        operator: side === 'buy' ? 'gte' : 'lte',
        value: stopPrice,
        reference: marketPair
      },
      isTriggered: false,
      status: 'active',
      timeInForce: config.timeInForce || 'GTC',
      expiresAt: config.expiresAt,
      reduceOnly: config.reduceOnly || false,
      postOnly: config.postOnly || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.saveConditionalOrder(order);
  }

  async createTakeProfitOrder(
    userId: string,
    marketPair: string,
    side: 'buy' | 'sell',
    quantity: number,
    takeProfitPrice: number,
    config: Partial<AdvancedOrderConfig> = {}
  ): Promise<ConditionalOrder> {
    const order: Partial<ConditionalOrder> = {
      userId,
      marketPair,
      orderType: 'take_profit',
      side,
      quantity,
      takeProfitPrice,
      triggerCondition: {
        type: 'price',
        operator: side === 'buy' ? 'lte' : 'gte',
        value: takeProfitPrice,
        reference: marketPair
      },
      isTriggered: false,
      status: 'active',
      timeInForce: config.timeInForce || 'GTC',
      expiresAt: config.expiresAt,
      reduceOnly: config.reduceOnly || true, // Take profit usually reduces position
      postOnly: config.postOnly || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.saveConditionalOrder(order);
  }

  async createTrailingStopOrder(
    userId: string,
    marketPair: string,
    side: 'buy' | 'sell',
    quantity: number,
    trailAmount?: number,
    trailPercent?: number,
    config: Partial<AdvancedOrderConfig> = {}
  ): Promise<ConditionalOrder> {
    if (!trailAmount && !trailPercent) {
      throw new Error('Either trailAmount or trailPercent must be specified');
    }

    // Get current market price to set initial high water mark
    const currentPrice = await this.getCurrentMarketPrice(marketPair);
    
    const order: Partial<ConditionalOrder> = {
      userId,
      marketPair,
      orderType: 'trailing_stop',
      side,
      quantity,
      trailAmount,
      trailPercent,
      trailHighWaterMark: currentPrice,
      isTriggered: false,
      status: 'active',
      timeInForce: config.timeInForce || 'GTC',
      expiresAt: config.expiresAt,
      reduceOnly: config.reduceOnly || false,
      postOnly: config.postOnly || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.saveConditionalOrder(order);
  }

  async createConditionalOrder(
    userId: string,
    marketPair: string,
    side: 'buy' | 'sell',
    quantity: number,
    limitPrice: number,
    triggerCondition: TriggerCondition,
    config: Partial<AdvancedOrderConfig> = {}
  ): Promise<ConditionalOrder> {
    const order: Partial<ConditionalOrder> = {
      userId,
      marketPair,
      orderType: 'conditional',
      side,
      quantity,
      limitPrice,
      triggerCondition,
      isTriggered: false,
      status: 'active',
      timeInForce: config.timeInForce || 'GTC',
      expiresAt: config.expiresAt,
      reduceOnly: config.reduceOnly || false,
      postOnly: config.postOnly || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.saveConditionalOrder(order);
  }

  // One-Cancels-Other (OCO) Orders
  async createOcoOrder(
    userId: string,
    marketPair: string,
    side: 'buy' | 'sell',
    quantity: number,
    stopPrice: number,
    takeProfitPrice: number,
    config: Partial<AdvancedOrderConfig> = {}
  ): Promise<{ stopLossOrder: ConditionalOrder; takeProfitOrder: ConditionalOrder }> {
    // Create stop loss order
    const stopLossOrder = await this.createStopLossOrder(
      userId, marketPair, side, quantity, stopPrice, undefined, config
    );

    // Create take profit order
    const takeProfitOrder = await this.createTakeProfitOrder(
      userId, marketPair, side, quantity, takeProfitPrice, config
    );

    // Link orders as OCO pair
    await this.db.query(`
      UPDATE conditional_orders 
      SET parent_order_id = $1, child_order_ids = ARRAY[$2]
      WHERE id = $2
    `, [stopLossOrder.id, takeProfitOrder.id]);

    await this.db.query(`
      UPDATE conditional_orders 
      SET parent_order_id = $1, child_order_ids = ARRAY[$2]
      WHERE id = $2
    `, [takeProfitOrder.id, stopLossOrder.id]);

    // Update objects
    stopLossOrder.parentOrderId = takeProfitOrder.id;
    stopLossOrder.childOrderIds = [takeProfitOrder.id];
    takeProfitOrder.parentOrderId = stopLossOrder.id;
    takeProfitOrder.childOrderIds = [stopLossOrder.id];

    this.activeOrders.set(stopLossOrder.id, stopLossOrder);
    this.activeOrders.set(takeProfitOrder.id, takeProfitOrder);

    return { stopLossOrder, takeProfitOrder };
  }

  // Order monitoring and execution
  private startOrderMonitoring(): void {
    // Check orders every 500ms for precise execution
    setInterval(async () => {
      await this.checkAllOrders();
    }, 500);

    // Clean up expired orders every minute
    setInterval(async () => {
      await this.cleanupExpiredOrders();
    }, 60000);

    // Update trailing stops every second
    setInterval(async () => {
      await this.updateTrailingStops();
    }, 1000);
  }

  private async loadActiveOrders(): Promise<void> {
    const result = await this.db.query(`
      SELECT * FROM conditional_orders 
      WHERE status = 'active'
      ORDER BY created_at DESC
    `);

    for (const row of result.rows) {
      const order = this.mapRowToConditionalOrder(row);
      this.activeOrders.set(order.id, order);
    }

    console.log(`Loaded ${this.activeOrders.size} active conditional orders`);
  }

  private async checkAllOrders(): Promise<void> {
    const now = new Date();
    const orders = Array.from(this.activeOrders.values());
    
    for (const order of orders) {
      try {
        if (order.status !== 'active') continue;

        // Check if order has expired
        if (order.expiresAt && now > order.expiresAt) {
          await this.expireOrder(order.id);
          continue;
        }

        // Check trigger conditions
        const shouldTrigger = await this.evaluateTriggerCondition(order);
        
        if (shouldTrigger) {
          await this.triggerOrder(order);
        } else if (order.orderType === 'trailing_stop') {
          await this.updateTrailingStop(order);
        }

        // Update last checked timestamp
        order.lastCheckedAt = now;
        
      } catch (error) {
        console.error(`Error checking order ${order.id}:`, error);
      }
    }
  }

  private async evaluateTriggerCondition(order: ConditionalOrder): Promise<boolean> {
    if (!order.triggerCondition) return false;

    const condition = order.triggerCondition;
    
    switch (condition.type) {
      case 'price':
        return await this.evaluatePriceCondition(order, condition);
      case 'time':
        return this.evaluateTimeCondition(condition);
      case 'volume':
        return await this.evaluateVolumeCondition(order, condition);
      case 'custom':
        return await this.evaluateCustomCondition(order, condition);
      default:
        return false;
    }
  }

  private async evaluatePriceCondition(order: ConditionalOrder, condition: TriggerCondition): Promise<boolean> {
    const currentPrice = await this.getCurrentMarketPrice(order.marketPair);
    const targetPrice = Array.isArray(condition.value) ? condition.value[0] : condition.value;

    switch (condition.operator) {
      case 'gte':
        return currentPrice >= targetPrice;
      case 'lte':
        return currentPrice <= targetPrice;
      case 'eq':
        return Math.abs(currentPrice - targetPrice) < (targetPrice * 0.001); // 0.1% tolerance
      case 'between':
        if (Array.isArray(condition.value) && condition.value.length === 2) {
          return currentPrice >= condition.value[0] && currentPrice <= condition.value[1];
        }
        return false;
      default:
        return false;
    }
  }

  private evaluateTimeCondition(condition: TriggerCondition): boolean {
    const now = Date.now();
    const targetTime = Array.isArray(condition.value) ? condition.value[0] : condition.value;

    switch (condition.operator) {
      case 'gte':
        return now >= targetTime;
      case 'lte':
        return now <= targetTime;
      case 'eq':
        return Math.abs(now - targetTime) < 60000; // 1 minute tolerance
      default:
        return false;
    }
  }

  private async evaluateVolumeCondition(order: ConditionalOrder, condition: TriggerCondition): Promise<boolean> {
    // Get recent volume data
    const result = await this.db.query(`
      SELECT SUM(quantity) as total_volume
      FROM trade_executions 
      WHERE market_pair = $1 
      AND executed_at >= NOW() - INTERVAL '1 hour'
    `, [order.marketPair]);

    const currentVolume = parseFloat(result.rows[0]?.total_volume || '0');
    const targetVolume = Array.isArray(condition.value) ? condition.value[0] : condition.value;

    switch (condition.operator) {
      case 'gte':
        return currentVolume >= targetVolume;
      case 'lte':
        return currentVolume <= targetVolume;
      default:
        return false;
    }
  }

  private async evaluateCustomCondition(order: ConditionalOrder, condition: TriggerCondition): Promise<boolean> {
    if (!condition.customLogic) return false;

    try {
      // Get market data for evaluation
      const marketData = await this.getMarketDataForEvaluation(order.marketPair);
      const position = await this.getUserPosition(order.userId, order.marketPair);
      
      // Create evaluation context
      const context = {
        currentPrice: marketData.currentPrice,
        volume24h: marketData.volume24h,
        priceChange24h: marketData.priceChange24h,
        position: position,
        order: order,
        Math: Math, // Allow mathematical functions
        Date: Date
      };

      // Safely evaluate custom logic (in production, use a proper sandbox)
      const result = new Function('context', `
        with (context) {
          return ${condition.customLogic};
        }
      `)(context);

      return Boolean(result);
      
    } catch (error) {
      console.error(`Error evaluating custom condition for order ${order.id}:`, error);
      return false;
    }
  }

  private async triggerOrder(order: ConditionalOrder): Promise<void> {
    const currentPrice = await this.getCurrentMarketPrice(order.marketPair);
    
    // Update order status
    order.isTriggered = true;
    order.triggeredAt = new Date();
    order.triggeredPrice = currentPrice;
    order.status = 'triggered';

    // Save to database
    await this.db.query(`
      UPDATE conditional_orders 
      SET is_triggered = true, triggered_at = NOW(), triggered_price = $1, status = 'triggered'
      WHERE id = $2
    `, [currentPrice, order.id]);

    // Execute the order
    await this.executeTriggeredOrder(order);

    // Handle OCO logic - cancel sibling orders
    if (order.childOrderIds && order.childOrderIds.length > 0) {
      for (const childOrderId of order.childOrderIds) {
        await this.cancelOrder(childOrderId, 'oco_triggered');
      }
    }

    this.emit('orderTriggered', { order, triggeredPrice: currentPrice });
  }

  private async executeTriggeredOrder(order: ConditionalOrder): Promise<void> {
    try {
      let executionPrice = order.limitPrice || order.triggeredPrice;

      // For market orders, use current market price
      if (!order.limitPrice) {
        executionPrice = await this.getCurrentMarketPrice(order.marketPair);
      }

      // Create market order in the main order book
      const result = await this.db.query(`
        INSERT INTO order_book_entries (
          user_id, market_pair, side, price, quantity, order_type,
          status, time_in_force, reduce_only, post_only,
          parent_conditional_order_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING id
      `, [
        order.userId, order.marketPair, order.side, executionPrice, order.quantity,
        order.limitPrice ? 'limit' : 'market', 'active', order.timeInForce,
        order.reduceOnly, order.postOnly, order.id
      ]);

      const executedOrderId = result.rows[0].id;

      // Update conditional order with execution details
      await this.db.query(`
        UPDATE conditional_orders 
        SET status = 'filled', executed_order_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [executedOrderId, order.id]);

      // Remove from active orders
      this.activeOrders.delete(order.id);

      this.emit('orderExecuted', { 
        conditionalOrder: order, 
        executedOrderId, 
        executionPrice 
      });

    } catch (error) {
      console.error(`Failed to execute triggered order ${order.id}:`, error);
      
      // Mark order as failed
      await this.db.query(`
        UPDATE conditional_orders 
        SET status = 'failed', error_message = $1, updated_at = NOW()
        WHERE id = $2
      `, [error instanceof Error ? error.message : 'Unknown error', order.id]);

      this.emit('orderExecutionFailed', { order, error });
    }
  }

  // Trailing stop management
  private async updateTrailingStops(): Promise<void> {
    const trailingStops = Array.from(this.activeOrders.values())
      .filter(order => order.orderType === 'trailing_stop' && order.status === 'active');

    for (const order of trailingStops) {
      await this.updateTrailingStop(order);
    }
  }

  private async updateTrailingStop(order: ConditionalOrder): Promise<void> {
    const currentPrice = await this.getCurrentMarketPrice(order.marketPair);
    let updated = false;

    if (order.side === 'sell') {
      // For sell orders, trail the high water mark upward
      if (currentPrice > (order.trailHighWaterMark || 0)) {
        order.trailHighWaterMark = currentPrice;
        updated = true;
      }

      // Calculate new stop price
      let newStopPrice: number;
      if (order.trailPercent) {
        newStopPrice = order.trailHighWaterMark! * (1 - order.trailPercent / 100);
      } else if (order.trailAmount) {
        newStopPrice = order.trailHighWaterMark! - order.trailAmount;
      } else {
        return;
      }

      // Update trigger condition if stop price changed
      if (order.triggerCondition && Math.abs(order.triggerCondition.value as number - newStopPrice) > 0.01) {
        order.triggerCondition.value = newStopPrice;
        order.stopPrice = newStopPrice;
        updated = true;
      }

    } else {
      // For buy orders, trail the low water mark downward
      if (currentPrice < (order.trailHighWaterMark || Infinity)) {
        order.trailHighWaterMark = currentPrice;
        updated = true;
      }

      // Calculate new stop price
      let newStopPrice: number;
      if (order.trailPercent) {
        newStopPrice = order.trailHighWaterMark! * (1 + order.trailPercent / 100);
      } else if (order.trailAmount) {
        newStopPrice = order.trailHighWaterMark! + order.trailAmount;
      } else {
        return;
      }

      // Update trigger condition if stop price changed
      if (order.triggerCondition && Math.abs(order.triggerCondition.value as number - newStopPrice) > 0.01) {
        order.triggerCondition.value = newStopPrice;
        order.stopPrice = newStopPrice;
        updated = true;
      }
    }

    // Save updates to database
    if (updated) {
      await this.db.query(`
        UPDATE conditional_orders 
        SET trail_high_water_mark = $1, stop_price = $2, 
            trigger_condition = $3, updated_at = NOW()
        WHERE id = $4
      `, [
        order.trailHighWaterMark,
        order.stopPrice,
        JSON.stringify(order.triggerCondition),
        order.id
      ]);

      this.emit('trailingStopUpdated', { 
        order, 
        newStopPrice: order.stopPrice,
        currentPrice 
      });
    }
  }

  // Order management
  async cancelOrder(orderId: string, reason: string = 'user_request'): Promise<boolean> {
    const order = this.activeOrders.get(orderId);
    if (!order || order.status !== 'active') {
      return false;
    }

    // Update database
    await this.db.query(`
      UPDATE conditional_orders 
      SET status = 'cancelled', cancellation_reason = $1, updated_at = NOW()
      WHERE id = $2
    `, [reason, orderId]);

    // Remove from active orders
    this.activeOrders.delete(orderId);

    this.emit('orderCancelled', { order, reason });
    return true;
  }

  async modifyOrder(
    orderId: string, 
    updates: Partial<ConditionalOrder>
  ): Promise<ConditionalOrder | null> {
    const order = this.activeOrders.get(orderId);
    if (!order || order.status !== 'active') {
      return null;
    }

    // Apply updates
    Object.assign(order, updates, { updatedAt: new Date() });

    // Save to database
    await this.db.query(`
      UPDATE conditional_orders 
      SET quantity = $1, stop_price = $2, take_profit_price = $3,
          trail_amount = $4, trail_percent = $5, trigger_condition = $6,
          expires_at = $7, updated_at = NOW()
      WHERE id = $8
    `, [
      order.quantity,
      order.stopPrice,
      order.takeProfitPrice,
      order.trailAmount,
      order.trailPercent,
      order.triggerCondition ? JSON.stringify(order.triggerCondition) : null,
      order.expiresAt,
      orderId
    ]);

    this.emit('orderModified', { order, updates });
    return order;
  }

  private async expireOrder(orderId: string): Promise<void> {
    await this.cancelOrder(orderId, 'expired');
  }

  private async cleanupExpiredOrders(): Promise<void> {
    const now = new Date();
    const expiredOrders = Array.from(this.activeOrders.values())
      .filter(order => order.expiresAt && now > order.expiresAt);

    for (const order of expiredOrders) {
      await this.expireOrder(order.id);
    }
  }

  // Helper methods
  private async getCurrentMarketPrice(marketPair: string): Promise<number> {
    const result = await this.db.query(`
      SELECT last_price, mid_price 
      FROM market_snapshots 
      WHERE market_pair = $1 
      ORDER BY timestamp DESC LIMIT 1
    `, [marketPair]);

    if (result.rows.length === 0) {
      throw new Error(`No market data found for ${marketPair}`);
    }

    return parseFloat(result.rows[0].last_price || result.rows[0].mid_price || '0');
  }

  private async getMarketDataForEvaluation(marketPair: string) {
    const result = await this.db.query(`
      SELECT 
        last_price as current_price,
        volume_24h,
        price_change_24h,
        best_bid,
        best_ask,
        spread
      FROM market_snapshots 
      WHERE market_pair = $1 
      ORDER BY timestamp DESC LIMIT 1
    `, [marketPair]);

    if (result.rows.length === 0) {
      throw new Error(`No market data found for ${marketPair}`);
    }

    const row = result.rows[0];
    return {
      currentPrice: parseFloat(row.current_price || '0'),
      volume24h: parseFloat(row.volume_24h || '0'),
      priceChange24h: parseFloat(row.price_change_24h || '0'),
      bestBid: parseFloat(row.best_bid || '0'),
      bestAsk: parseFloat(row.best_ask || '0'),
      spread: parseFloat(row.spread || '0')
    };
  }

  private async getUserPosition(userId: string, marketPair: string): Promise<PositionInfo | null> {
    // This would integrate with position tracking system
    const cached = this.positions.get(`${userId}_${marketPair}`);
    return cached || null;
  }

  private async saveConditionalOrder(orderData: Partial<ConditionalOrder>): Promise<ConditionalOrder> {
    const result = await this.db.query(`
      INSERT INTO conditional_orders (
        user_id, market_pair, order_type, side, quantity, limit_price,
        stop_price, take_profit_price, trail_amount, trail_percent,
        trail_high_water_mark, trigger_condition, is_triggered, status,
        time_in_force, expires_at, reduce_only, post_only, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
      RETURNING *
    `, [
      orderData.userId, orderData.marketPair, orderData.orderType, orderData.side,
      orderData.quantity, orderData.limitPrice, orderData.stopPrice, orderData.takeProfitPrice,
      orderData.trailAmount, orderData.trailPercent, orderData.trailHighWaterMark,
      orderData.triggerCondition ? JSON.stringify(orderData.triggerCondition) : null,
      orderData.isTriggered, orderData.status, orderData.timeInForce, orderData.expiresAt,
      orderData.reduceOnly, orderData.postOnly
    ]);

    const order = this.mapRowToConditionalOrder(result.rows[0]);
    this.activeOrders.set(order.id, order);
    
    return order;
  }

  private mapRowToConditionalOrder(row: any): ConditionalOrder {
    return {
      id: row.id,
      userId: row.user_id,
      marketPair: row.market_pair,
      orderType: row.order_type,
      side: row.side,
      quantity: parseFloat(row.quantity),
      limitPrice: row.limit_price ? parseFloat(row.limit_price) : undefined,
      stopPrice: row.stop_price ? parseFloat(row.stop_price) : undefined,
      takeProfitPrice: row.take_profit_price ? parseFloat(row.take_profit_price) : undefined,
      trailAmount: row.trail_amount ? parseFloat(row.trail_amount) : undefined,
      trailPercent: row.trail_percent ? parseFloat(row.trail_percent) : undefined,
      trailHighWaterMark: row.trail_high_water_mark ? parseFloat(row.trail_high_water_mark) : undefined,
      triggerCondition: row.trigger_condition ? JSON.parse(row.trigger_condition) : undefined,
      isTriggered: row.is_triggered,
      triggeredAt: row.triggered_at ? new Date(row.triggered_at) : undefined,
      triggeredPrice: row.triggered_price ? parseFloat(row.triggered_price) : undefined,
      status: row.status,
      parentOrderId: row.parent_order_id,
      childOrderIds: row.child_order_ids,
      timeInForce: row.time_in_force,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      reduceOnly: row.reduce_only,
      postOnly: row.post_only,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at) : undefined
    };
  }

  // Query methods
  async getUserOrders(userId: string, status?: string): Promise<ConditionalOrder[]> {
    let query = 'SELECT * FROM conditional_orders WHERE user_id = $1';
    const params = [userId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapRowToConditionalOrder(row));
  }

  async getOrderById(orderId: string): Promise<ConditionalOrder | null> {
    const result = await this.db.query(
      'SELECT * FROM conditional_orders WHERE id = $1',
      [orderId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToConditionalOrder(result.rows[0]);
  }

  // Statistics
  async getOrderStatistics(userId?: string): Promise<any> {
    let whereClause = '';
    const params: any[] = [];

    if (userId) {
      whereClause = 'WHERE user_id = $1';
      params.push(userId);
    }

    const result = await this.db.query(`
      SELECT 
        order_type,
        status,
        COUNT(*) as count,
        AVG(quantity) as avg_quantity,
        SUM(CASE WHEN is_triggered THEN 1 ELSE 0 END) as triggered_count
      FROM conditional_orders 
      ${whereClause}
      GROUP BY order_type, status
      ORDER BY order_type, status
    `, params);

    return result.rows;
  }

  // Cleanup
  async close(): Promise<void> {
    // Cancel all monitoring timers
    this.priceMonitors.forEach(timer => clearTimeout(timer));
    this.priceMonitors.clear();
  }
}

export default AdvancedOrderService;
