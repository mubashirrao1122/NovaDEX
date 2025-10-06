import { DatabaseConnection } from './connection';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface MevProtectionConfig {
  commitRevealEnabled: boolean;
  batchingEnabled: boolean;
  timeLockEnabled: boolean;
  fairOrderingEnabled: boolean;
  minimumCommitTime: number; // milliseconds
  maximumCommitTime: number; // milliseconds
  batchSize: number;
  batchInterval: number; // milliseconds
  randomizationSeed?: string;
}

export interface ProtectedOrder {
  id: string;
  userId: string;
  marketPair: string;
  side: 'buy' | 'sell';
  orderType: string;
  quantity: number;
  price?: number;
  commitHash: string;
  revealDeadline: Date;
  isRevealed: boolean;
  protectionLevel: 'none' | 'standard' | 'maximum';
  originalOrderData?: string; // Encrypted
  timeLock?: Date;
  batchId?: string;
  priority: number;
  createdAt: Date;
}

export interface OrderBatch {
  id: string;
  marketPair: string;
  orders: ProtectedOrder[];
  executionTime: Date;
  randomSeed: string;
  fairOrderingApplied: boolean;
  status: 'pending' | 'processing' | 'executed' | 'failed';
  createdAt: Date;
}

export interface MevMetrics {
  totalProtectedOrders: number;
  averageCommitTime: number;
  batchExecutionCount: number;
  frontRunningAttempts: number;
  protectionSuccessRate: number;
  averageBatchSize: number;
}

export class MevProtectionService extends EventEmitter {
  private db: DatabaseConnection;
  private config: MevProtectionConfig;
  private pendingCommits: Map<string, ProtectedOrder> = new Map();
  private activeBatches: Map<string, OrderBatch> = new Map();
  private revealTimers: Map<string, NodeJS.Timeout> = new Map();
  private batchTimer?: NodeJS.Timeout;

  constructor(config: MevProtectionConfig) {
    super();
    this.db = DatabaseConnection.getInstance();
    this.config = config;
    this.startBatchProcessing();
    this.startMetricsCollection();
  }

  // Core commit-reveal functionality
  async createProtectedOrder(orderData: any, protectionLevel: 'standard' | 'maximum' = 'standard'): Promise<{ commitHash: string; orderId: string; revealDeadline: Date }> {
    // Generate unique nonce and timestamp
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    
    // Create commitment data
    const commitmentData = {
      ...orderData,
      nonce,
      timestamp,
      protectionLevel
    };

    // Generate commit hash
    const commitHash = this.generateCommitHash(commitmentData);
    
    // Set reveal deadline based on protection level
    const commitTime = protectionLevel === 'maximum' 
      ? this.config.maximumCommitTime 
      : this.config.minimumCommitTime;
    
    const revealDeadline = new Date(Date.now() + commitTime);

    // Encrypt original order data
    const encryptedOrderData = this.encryptOrderData(commitmentData);

    // Store in database with MEV protection fields
    const result = await this.db.query(`
      INSERT INTO order_book_entries (
        user_id, market_pair, side, price, quantity, order_type,
        commit_hash, reveal_deadline, is_revealed, protection_level,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', NOW())
      RETURNING id
    `, [
      orderData.userId,
      orderData.marketPair,
      orderData.side,
      orderData.price || 0, // Market orders have 0 price initially
      orderData.quantity,
      orderData.orderType,
      commitHash,
      revealDeadline,
      false,
      protectionLevel
    ]);

    const orderId = result.rows[0].id;

    // Store protected order in memory for fast access
    const protectedOrder: ProtectedOrder = {
      id: orderId,
      userId: orderData.userId,
      marketPair: orderData.marketPair,
      side: orderData.side,
      orderType: orderData.orderType,
      quantity: orderData.quantity,
      price: orderData.price,
      commitHash,
      revealDeadline,
      isRevealed: false,
      protectionLevel,
      originalOrderData: encryptedOrderData,
      priority: this.calculateOrderPriority(orderData, protectionLevel),
      createdAt: new Date()
    };

    this.pendingCommits.set(commitHash, protectedOrder);

    // Set automatic reveal timer
    const revealTimer = setTimeout(async () => {
      await this.handleExpiredCommit(commitHash);
    }, commitTime);

    this.revealTimers.set(commitHash, revealTimer);

    // Emit event for monitoring
    this.emit('orderCommitted', { orderId, commitHash, revealDeadline });

    return { commitHash, orderId, revealDeadline };
  }

  async revealOrder(commitHash: string, originalOrderData: any): Promise<{ success: boolean; orderId?: string; batchId?: string }> {
    const protectedOrder = this.pendingCommits.get(commitHash);
    
    if (!protectedOrder) {
      return { success: false };
    }

    // Verify commit hash
    const expectedHash = this.generateCommitHash(originalOrderData);
    if (expectedHash !== commitHash) {
      return { success: false };
    }

    // Check if reveal is within deadline
    if (Date.now() > protectedOrder.revealDeadline.getTime()) {
      return { success: false };
    }

    // Clear reveal timer
    const timer = this.revealTimers.get(commitHash);
    if (timer) {
      clearTimeout(timer);
      this.revealTimers.delete(commitHash);
    }

    // Update database
    await this.db.query(`
      UPDATE order_book_entries 
      SET is_revealed = true, 
          price = $1,
          status = 'active',
          updated_at = NOW()
      WHERE commit_hash = $2
    `, [originalOrderData.price || 0, commitHash]);

    // Remove from pending commits
    this.pendingCommits.delete(commitHash);

    // Add to batch if batching is enabled
    let batchId: string | undefined;
    if (this.config.batchingEnabled) {
      batchId = await this.addToBatch(protectedOrder, originalOrderData);
    } else {
      // Execute immediately with fair ordering
      await this.executeOrderWithFairOrdering(protectedOrder, originalOrderData);
    }

    this.emit('orderRevealed', { 
      orderId: protectedOrder.id, 
      commitHash, 
      batchId 
    });

    return { success: true, orderId: protectedOrder.id, batchId };
  }

  // Batch processing for MEV protection
  private async addToBatch(protectedOrder: ProtectedOrder, orderData: any): Promise<string> {
    const marketPair = protectedOrder.marketPair;
    
    // Find or create active batch for this market
    let batch = Array.from(this.activeBatches.values())
      .find(b => b.marketPair === marketPair && b.status === 'pending' && b.orders.length < this.config.batchSize);

    if (!batch) {
      const batchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      batch = {
        id: batchId,
        marketPair,
        orders: [],
        executionTime: new Date(Date.now() + this.config.batchInterval),
        randomSeed: crypto.randomBytes(16).toString('hex'),
        fairOrderingApplied: false,
        status: 'pending',
        createdAt: new Date()
      };
      this.activeBatches.set(batchId, batch);
    }

    // Add order to batch
    protectedOrder.batchId = batch.id;
    batch.orders.push(protectedOrder);

    // Store batch info in database
    await this.db.query(`
      UPDATE order_book_entries 
      SET batch_id = $1 
      WHERE id = $2
    `, [batch.id, protectedOrder.id]);

    // If batch is full, schedule immediate execution
    if (batch.orders.length >= this.config.batchSize) {
      await this.executeBatch(batch.id);
    }

    return batch.id;
  }

  private startBatchProcessing(): void {
    if (!this.config.batchingEnabled) return;

    this.batchTimer = setInterval(async () => {
      const readyBatches = Array.from(this.activeBatches.values())
        .filter(batch => 
          batch.status === 'pending' && 
          batch.executionTime.getTime() <= Date.now()
        );

      for (const batch of readyBatches) {
        await this.executeBatch(batch.id);
      }
    }, 1000); // Check every second
  }

  private async executeBatch(batchId: string): Promise<void> {
    const batch = this.activeBatches.get(batchId);
    if (!batch || batch.status !== 'pending') return;

    batch.status = 'processing';

    try {
      // Apply fair ordering to the batch
      const orderedBatch = this.applyFairOrdering(batch);
      
      // Execute orders in fair order
      for (const order of orderedBatch.orders) {
        try {
          await this.executeProtectedOrder(order);
        } catch (error) {
          console.error(`Failed to execute order ${order.id} in batch ${batchId}:`, error);
        }
      }

      batch.status = 'executed';
      this.emit('batchExecuted', { batchId, orderCount: batch.orders.length });

    } catch (error) {
      batch.status = 'failed';
      console.error(`Batch ${batchId} execution failed:`, error);
      this.emit('batchFailed', { batchId, error });
    }

    // Clean up
    setTimeout(() => {
      this.activeBatches.delete(batchId);
    }, 300000); // Keep for 5 minutes for logging
  }

  // Fair ordering implementation
  private applyFairOrdering(batch: OrderBatch): OrderBatch {
    if (!this.config.fairOrderingEnabled) {
      return batch;
    }

    // Create deterministic but unpredictable ordering using batch random seed
    const ordersWithSeeds = batch.orders.map(order => ({
      order,
      fairnessSeed: this.generateFairnessSeed(order, batch.randomSeed)
    }));

    // Sort by fairness seed for deterministic but random ordering
    ordersWithSeeds.sort((a, b) => a.fairnessSeed.localeCompare(b.fairnessSeed));

    // Apply priority adjustments for different protection levels
    const priorityAdjusted = ordersWithSeeds.sort((a, b) => {
      const priorityDiff = b.order.priority - a.order.priority;
      if (Math.abs(priorityDiff) > 100) { // Significant priority difference
        return priorityDiff;
      }
      // Otherwise maintain fairness ordering
      return a.fairnessSeed.localeCompare(b.fairnessSeed);
    });

    return {
      ...batch,
      orders: priorityAdjusted.map(item => item.order),
      fairOrderingApplied: true
    };
  }

  private generateFairnessSeed(order: ProtectedOrder, batchSeed: string): string {
    const combined = `${order.commitHash}:${batchSeed}:${order.createdAt.getTime()}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  private calculateOrderPriority(orderData: any, protectionLevel: string): number {
    let priority = 1000; // Base priority

    // Higher priority for maximum protection
    if (protectionLevel === 'maximum') priority += 200;
    if (protectionLevel === 'standard') priority += 100;

    // Priority based on order size (larger orders get slightly higher priority)
    const sizeBonus = Math.min(orderData.quantity * (orderData.price || 100) / 10000, 50);
    priority += sizeBonus;

    // Time-based priority (earlier commits get slight boost)
    const timeBonus = Math.max(0, 100 - (Date.now() % 100));
    priority += timeBonus;

    return priority;
  }

  // Order execution with protection
  private async executeOrderWithFairOrdering(protectedOrder: ProtectedOrder, orderData: any): Promise<void> {
    // Add artificial delay for maximum protection
    if (protectedOrder.protectionLevel === 'maximum') {
      const delay = Math.random() * 2000 + 1000; // 1-3 second random delay
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    await this.executeProtectedOrder(protectedOrder);
  }

  private async executeProtectedOrder(protectedOrder: ProtectedOrder): Promise<void> {
    // This would integrate with the order matching engine
    // For now, we'll update the order status and emit an event
    
    await this.db.query(`
      UPDATE order_book_entries 
      SET status = 'active', 
          execution_delay_ms = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [
      protectedOrder.protectionLevel === 'maximum' ? 2000 : 1000,
      protectedOrder.id
    ]);

    this.emit('protectedOrderExecuted', {
      orderId: protectedOrder.id,
      protectionLevel: protectedOrder.protectionLevel,
      batchId: protectedOrder.batchId
    });
  }

  // Time-locked orders
  async createTimeLockedOrder(orderData: any, lockDuration: number): Promise<string> {
    const unlockTime = new Date(Date.now() + lockDuration);
    
    const result = await this.db.query(`
      INSERT INTO order_book_entries (
        user_id, market_pair, side, price, quantity, order_type,
        status, time_lock, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'time_locked', $7, NOW())
      RETURNING id
    `, [
      orderData.userId,
      orderData.marketPair,
      orderData.side,
      orderData.price,
      orderData.quantity,
      orderData.orderType,
      unlockTime
    ]);

    const orderId = result.rows[0].id;

    // Set timer to unlock order
    setTimeout(async () => {
      await this.unlockOrder(orderId);
    }, lockDuration);

    return orderId;
  }

  private async unlockOrder(orderId: string): Promise<void> {
    await this.db.query(`
      UPDATE order_book_entries 
      SET status = 'active', updated_at = NOW()
      WHERE id = $1 AND status = 'time_locked'
    `, [orderId]);

    this.emit('orderUnlocked', { orderId });
  }

  // Front-running detection
  async detectFrontRunning(orderData: any): Promise<{ detected: boolean; confidence: number; details?: any }> {
    const { marketPair, side, price, quantity } = orderData;
    
    // Check for similar orders in recent timeframe
    const recentOrders = await this.db.query(`
      SELECT * FROM order_book_entries 
      WHERE market_pair = $1 
      AND side = $2 
      AND ABS(price - $3) / $3 < 0.001  -- Within 0.1% price
      AND ABS(quantity - $4) / $4 < 0.1  -- Within 10% quantity
      AND created_at >= NOW() - INTERVAL '10 seconds'
      AND status = 'active'
    `, [marketPair, side, price, quantity]);

    if (recentOrders.rows.length > 2) {
      // Multiple similar orders detected - possible front-running
      return {
        detected: true,
        confidence: Math.min(recentOrders.rows.length * 30, 90),
        details: {
          similarOrders: recentOrders.rows.length,
          timeWindow: '10 seconds'
        }
      };
    }

    // Check for rapid price movements
    const priceMovement = await this.db.query(`
      SELECT 
        MAX(price) - MIN(price) as price_range,
        COUNT(*) as trade_count
      FROM trade_executions 
      WHERE market_pair = $1 
      AND executed_at >= NOW() - INTERVAL '30 seconds'
    `, [marketPair]);

    if (priceMovement.rows.length > 0) {
      const range = parseFloat(priceMovement.rows[0].price_range);
      const tradeCount = parseInt(priceMovement.rows[0].trade_count);
      
      if (range > price * 0.005 && tradeCount > 5) { // 0.5% movement with high activity
        return {
          detected: true,
          confidence: 70,
          details: {
            priceMovement: range,
            tradeCount,
            suspicion: 'rapid_price_movement'
          }
        };
      }
    }

    return { detected: false, confidence: 0 };
  }

  // Expired commit handling
  private async handleExpiredCommit(commitHash: string): Promise<void> {
    const protectedOrder = this.pendingCommits.get(commitHash);
    if (!protectedOrder) return;

    // Mark order as expired
    await this.db.query(`
      UPDATE order_book_entries 
      SET status = 'expired', updated_at = NOW()
      WHERE commit_hash = $1
    `, [commitHash]);

    // Clean up
    this.pendingCommits.delete(commitHash);
    this.revealTimers.delete(commitHash);

    this.emit('commitExpired', { commitHash, orderId: protectedOrder.id });
  }

  // Metrics and monitoring
  private startMetricsCollection(): void {
    setInterval(async () => {
      await this.collectMevMetrics();
    }, 60000); // Every minute
  }

  private async collectMevMetrics(): Promise<void> {
    const metrics = await this.getMevMetrics();
    this.emit('mevMetrics', metrics);
  }

  async getMevMetrics(): Promise<MevMetrics> {
    const protectedOrdersResult = await this.db.query(`
      SELECT 
        COUNT(*) as total_protected,
        AVG(EXTRACT(EPOCH FROM (reveal_deadline - created_at))) as avg_commit_time,
        COUNT(DISTINCT batch_id) as batch_count
      FROM order_book_entries 
      WHERE protection_level != 'none' 
      AND created_at >= NOW() - INTERVAL '24 hours'
    `);

    const frontRunningResult = await this.db.query(`
      SELECT COUNT(*) as front_running_attempts
      FROM mev_detection_log 
      WHERE detected = true 
      AND timestamp >= NOW() - INTERVAL '24 hours'
    `);

    const batchMetricsResult = await this.db.query(`
      SELECT AVG(order_count) as avg_batch_size
      FROM (
        SELECT batch_id, COUNT(*) as order_count
        FROM order_book_entries 
        WHERE batch_id IS NOT NULL 
        AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY batch_id
      ) batch_sizes
    `);

    const row = protectedOrdersResult.rows[0];
    const frontRunning = frontRunningResult.rows[0];
    const batchMetrics = batchMetricsResult.rows[0];

    return {
      totalProtectedOrders: parseInt(row.total_protected) || 0,
      averageCommitTime: parseFloat(row.avg_commit_time) || 0,
      batchExecutionCount: parseInt(row.batch_count) || 0,
      frontRunningAttempts: parseInt(frontRunning.front_running_attempts) || 0,
      protectionSuccessRate: row.total_protected > 0 ? 
        ((row.total_protected - frontRunning.front_running_attempts) / row.total_protected * 100) : 100,
      averageBatchSize: parseFloat(batchMetrics.avg_batch_size) || 0
    };
  }

  // Utility functions
  private generateCommitHash(commitmentData: any): string {
    const dataString = JSON.stringify(commitmentData, Object.keys(commitmentData).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  private encryptOrderData(data: any): string {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${key.toString('hex')}:${iv.toString('hex')}:${encrypted}`;
  }

  private decryptOrderData(encryptedData: string): any {
    const [keyHex, ivHex, encrypted] = encryptedData.split(':');
    const key = Buffer.from(keyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  // Configuration updates
  updateConfig(newConfig: Partial<MevProtectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  getConfig(): MevProtectionConfig {
    return { ...this.config };
  }

  // Cleanup
  async close(): Promise<void> {
    // Clear all timers
    this.revealTimers.forEach(timer => clearTimeout(timer));
    this.revealTimers.clear();
    
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    // Process any remaining batches
    const batches = Array.from(this.activeBatches.values());
    for (const batch of batches) {
      if (batch.status === 'pending') {
        await this.executeBatch(batch.id);
      }
    }
  }
}

export default MevProtectionService;
