import { DatabaseConnection } from './connection';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Types for Portfolio Analytics
export interface PortfolioSummary {
  userId: string;
  totalValue: number;
  totalPnl: number;
  totalPnlPercentage: number;
  dayChange: number;
  dayChangePercentage: number;
  weekChange: number;
  weekChangePercentage: number;
  monthChange: number;
  monthChangePercentage: number;
  
  // Asset allocation
  assetAllocation: AssetAllocation[];
  
  // Portfolio metrics
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  profitFactor: number;
  
  // Risk metrics
  valueAtRisk: number; // 1-day VaR at 95% confidence
  expectedShortfall: number; // Conditional VaR
  beta: number; // Market beta
  
  lastUpdated: Date;
}

export interface AssetAllocation {
  asset: string;
  value: number;
  percentage: number;
  pnl: number;
  pnlPercentage: number;
  positions: number;
}

export interface PortfolioPosition {
  id: string;
  userId: string;
  asset: string;
  type: 'spot' | 'margin' | 'futures' | 'vault' | 'pool';
  
  // Position details
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  
  // P&L tracking
  unrealizedPnl: number;
  unrealizedPnlPercentage: number;
  realizedPnl: number;
  totalPnl: number;
  
  // Position metrics
  roi: number;
  holdingPeriod: number; // in days
  
  // Timestamps
  openedAt: Date;
  lastUpdatedAt: Date;
}

export interface PnlRecord {
  id: string;
  userId: string;
  date: Date;
  
  // Daily P&L breakdown
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  
  // Asset-wise P&L
  assetPnl: Record<string, number>;
  
  // Activity breakdown
  tradingPnl: number;
  vaultPnl: number;
  liquidityPnl: number;
  bridgePnl: number;
  
  // Portfolio metrics
  portfolioValue: number;
  dayChange: number;
  dayChangePercentage: number;
}

export interface RiskMetrics {
  userId: string;
  date: Date;
  
  // Risk measures
  valueAtRisk: number; // 1-day VaR at 95%
  expectedShortfall: number; // Expected shortfall (CVaR)
  maxDrawdown: number;
  volatility: number; // 30-day volatility
  sharpeRatio: number;
  beta: number; // Market beta
  
  // Concentration risk
  concentrationRisk: number; // Herfindahl index
  largestPosition: number; // Largest position as % of portfolio
  
  // Risk contributions
  assetRiskContributions: Record<string, number>;
}

export interface PerformanceMetrics {
  userId: string;
  period: string; // '1d', '7d', '30d', '90d', '1y', 'all'
  
  // Return metrics
  totalReturn: number;
  annualizedReturn: number;
  cagr: number; // Compound Annual Growth Rate
  
  // Risk-adjusted returns
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  
  // Risk metrics
  volatility: number;
  maxDrawdown: number;
  averageDrawdown: number;
  drawdownDuration: number; // Average days to recover
  
  // Trading metrics
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  
  // Activity metrics
  totalTrades: number;
  tradingDays: number;
  averageHoldingPeriod: number;
}

export interface PortfolioAllocation {
  userId: string;
  
  // Asset allocation
  assetAllocation: Record<string, number>; // asset -> percentage
  typeAllocation: Record<string, number>; // position type -> percentage
  riskAllocation: Record<string, number>; // risk level -> percentage
  
  // Sector/category allocation
  sectorAllocation: Record<string, number>;
  
  // Geographic allocation (for cross-chain)
  chainAllocation: Record<string, number>;
  
  // Allocation scores
  diversificationScore: number; // 0-100
  concentrationRisk: number; // 0-100
  
  lastUpdated: Date;
}

export class PortfolioAnalyticsService extends EventEmitter {
  private db: DatabaseConnection;
  private updateTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor(db: DatabaseConnection) {
    super();
    this.db = db;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.setupPeriodicUpdates();
      this.isRunning = true;
      
      this.emit('initialized');
    } catch (error) {
      this.emit('error', { context: 'initialization', error });
      throw error;
    }
  }

  // Portfolio Summary and Analytics
  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    try {
      const query = `
        WITH portfolio_positions AS (
          SELECT 
            asset,
            SUM(market_value) as total_value,
            SUM(unrealized_pnl + realized_pnl) as total_pnl,
            COUNT(*) as position_count
          FROM portfolio_positions 
          WHERE user_id = $1 AND is_active = true
          GROUP BY asset
        ),
        portfolio_totals AS (
          SELECT 
            SUM(total_value) as portfolio_value,
            SUM(total_pnl) as total_pnl
          FROM portfolio_positions
        ),
        recent_changes AS (
          SELECT 
            day_change,
            day_change_percentage,
            week_change,
            week_change_percentage,
            month_change,
            month_change_percentage
          FROM portfolio_daily_pnl 
          WHERE user_id = $1 
          ORDER BY date DESC 
          LIMIT 1
        ),
        risk_metrics AS (
          SELECT 
            sharpe_ratio,
            max_drawdown,
            volatility,
            value_at_risk,
            expected_shortfall,
            beta
          FROM portfolio_risk_metrics 
          WHERE user_id = $1 
          ORDER BY date DESC 
          LIMIT 1
        ),
        trading_stats AS (
          SELECT 
            CASE WHEN COUNT(*) > 0 
            THEN COUNT(CASE WHEN total_pnl > 0 THEN 1 END)::DECIMAL / COUNT(*) * 100 
            ELSE 0 END as win_rate,
            CASE WHEN SUM(CASE WHEN total_pnl < 0 THEN ABS(total_pnl) ELSE 0 END) > 0
            THEN SUM(CASE WHEN total_pnl > 0 THEN total_pnl ELSE 0 END) / 
                 SUM(CASE WHEN total_pnl < 0 THEN ABS(total_pnl) ELSE 0 END)
            ELSE 0 END as profit_factor
          FROM portfolio_positions
          WHERE user_id = $1
        )
        SELECT 
          pt.portfolio_value,
          pt.total_pnl,
          CASE WHEN pt.portfolio_value - pt.total_pnl > 0 
          THEN (pt.total_pnl / (pt.portfolio_value - pt.total_pnl) * 100) 
          ELSE 0 END as total_pnl_percentage,
          COALESCE(rc.day_change, 0) as day_change,
          COALESCE(rc.day_change_percentage, 0) as day_change_percentage,
          COALESCE(rc.week_change, 0) as week_change,
          COALESCE(rc.week_change_percentage, 0) as week_change_percentage,
          COALESCE(rc.month_change, 0) as month_change,
          COALESCE(rc.month_change_percentage, 0) as month_change_percentage,
          COALESCE(rm.sharpe_ratio, 0) as sharpe_ratio,
          COALESCE(rm.max_drawdown, 0) as max_drawdown,
          COALESCE(rm.volatility, 0) as volatility,
          COALESCE(rm.value_at_risk, 0) as value_at_risk,
          COALESCE(rm.expected_shortfall, 0) as expected_shortfall,
          COALESCE(rm.beta, 1.0) as beta,
          COALESCE(ts.win_rate, 0) as win_rate,
          COALESCE(ts.profit_factor, 0) as profit_factor
        FROM portfolio_totals pt
        LEFT JOIN recent_changes rc ON true
        LEFT JOIN risk_metrics rm ON true
        LEFT JOIN trading_stats ts ON true
      `;

      const result = await this.db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        // Return empty portfolio
        return {
          userId,
          totalValue: 0,
          totalPnl: 0,
          totalPnlPercentage: 0,
          dayChange: 0,
          dayChangePercentage: 0,
          weekChange: 0,
          weekChangePercentage: 0,
          monthChange: 0,
          monthChangePercentage: 0,
          assetAllocation: [],
          sharpeRatio: 0,
          maxDrawdown: 0,
          volatility: 0,
          winRate: 0,
          profitFactor: 0,
          valueAtRisk: 0,
          expectedShortfall: 0,
          beta: 1.0,
          lastUpdated: new Date()
        };
      }

      const row = result.rows[0];
      
      // Get asset allocation
      const assetAllocation = await this.getAssetAllocation(userId);

      return {
        userId,
        totalValue: parseFloat(row.portfolio_value) || 0,
        totalPnl: parseFloat(row.total_pnl) || 0,
        totalPnlPercentage: parseFloat(row.total_pnl_percentage) || 0,
        dayChange: parseFloat(row.day_change) || 0,
        dayChangePercentage: parseFloat(row.day_change_percentage) || 0,
        weekChange: parseFloat(row.week_change) || 0,
        weekChangePercentage: parseFloat(row.week_change_percentage) || 0,
        monthChange: parseFloat(row.month_change) || 0,
        monthChangePercentage: parseFloat(row.month_change_percentage) || 0,
        assetAllocation,
        sharpeRatio: parseFloat(row.sharpe_ratio) || 0,
        maxDrawdown: parseFloat(row.max_drawdown) || 0,
        volatility: parseFloat(row.volatility) || 0,
        winRate: parseFloat(row.win_rate) || 0,
        profitFactor: parseFloat(row.profit_factor) || 0,
        valueAtRisk: parseFloat(row.value_at_risk) || 0,
        expectedShortfall: parseFloat(row.expected_shortfall) || 0,
        beta: parseFloat(row.beta) || 1.0,
        lastUpdated: new Date()
      };
    } catch (error) {
      this.emit('error', { context: 'getPortfolioSummary', error, userId });
      throw error;
    }
  }

  async getPerformanceMetrics(userId: string, period: string): Promise<PerformanceMetrics> {
    try {
      const periodDays = this.getPeriodDays(period);
      
      const query = `
        WITH period_data AS (
          SELECT 
            date,
            portfolio_value,
            day_change,
            day_change_percentage,
            total_pnl
          FROM portfolio_daily_pnl 
          WHERE user_id = $1 
          AND date >= CURRENT_DATE - INTERVAL '${periodDays} days'
          ORDER BY date ASC
        ),
        returns AS (
          SELECT 
            date,
            day_change_percentage as daily_return,
            portfolio_value,
            LAG(portfolio_value) OVER (ORDER BY date) as prev_value
          FROM period_data
        ),
        drawdowns AS (
          SELECT 
            date,
            portfolio_value,
            MAX(portfolio_value) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING) as peak_value,
            (portfolio_value - MAX(portfolio_value) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING)) / 
            NULLIF(MAX(portfolio_value) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING), 0) * 100 as drawdown_pct
          FROM period_data
        ),
        trading_stats AS (
          SELECT 
            COUNT(*) as total_trades,
            COUNT(CASE WHEN total_pnl > 0 THEN 1 END) as winning_trades,
            AVG(CASE WHEN total_pnl > 0 THEN total_pnl END) as avg_win,
            AVG(CASE WHEN total_pnl < 0 THEN total_pnl END) as avg_loss,
            MAX(total_pnl) as largest_win,
            MIN(total_pnl) as largest_loss,
            AVG(holding_period) as avg_holding_period
          FROM portfolio_positions 
          WHERE user_id = $1 
          AND last_updated_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
        )
        SELECT 
          COALESCE((MAX(pd.portfolio_value) - MIN(pd.portfolio_value)) / NULLIF(MIN(pd.portfolio_value), 0) * 100, 0) as total_return,
          COALESCE(STDDEV(r.daily_return), 0) as volatility,
          COALESCE(AVG(r.daily_return), 0) as avg_daily_return,
          COALESCE(MIN(d.drawdown_pct), 0) as max_drawdown,
          COALESCE(AVG(ABS(d.drawdown_pct)), 0) as avg_drawdown,
          COALESCE(ts.total_trades, 0) as total_trades,
          COALESCE(ts.winning_trades::DECIMAL / NULLIF(ts.total_trades, 0) * 100, 0) as win_rate,
          COALESCE(ts.avg_win / NULLIF(ABS(ts.avg_loss), 0), 0) as profit_factor,
          COALESCE(ts.avg_win, 0) as avg_win,
          COALESCE(ts.avg_loss, 0) as avg_loss,
          COALESCE(ts.largest_win, 0) as largest_win,
          COALESCE(ts.largest_loss, 0) as largest_loss,
          COALESCE(ts.avg_holding_period, 0) as avg_holding_period,
          COUNT(DISTINCT pd.date) as trading_days
        FROM period_data pd
        LEFT JOIN returns r ON pd.date = r.date
        LEFT JOIN drawdowns d ON pd.date = d.date
        LEFT JOIN trading_stats ts ON true
        GROUP BY ts.total_trades, ts.winning_trades, ts.avg_win, ts.avg_loss, 
                 ts.largest_win, ts.largest_loss, ts.avg_holding_period
      `;

      const result = await this.db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return this.getEmptyPerformanceMetrics(userId, period);
      }

      const row = result.rows[0];
      const totalReturn = parseFloat(row.total_return) || 0;
      const volatility = parseFloat(row.volatility) || 0;
      const avgDailyReturn = parseFloat(row.avg_daily_return) || 0;
      const tradingDays = parseInt(row.trading_days) || 0;

      // Calculate annualized metrics
      const annualizedReturn = avgDailyReturn * 252; // 252 trading days per year
      const cagr = tradingDays > 0 ? Math.pow(1 + totalReturn / 100, 365 / tradingDays) - 1 : 0;
      const annualizedVolatility = volatility * Math.sqrt(252);
      
      // Calculate risk-adjusted returns
      const sharpeRatio = annualizedVolatility > 0 ? (annualizedReturn - 2) / annualizedVolatility : 0; // Assuming 2% risk-free rate
      const maxDrawdown = Math.abs(parseFloat(row.max_drawdown) || 0);
      const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
      
      // Calculate Sortino ratio (using downside deviation)
      const downsideQuery = `
        SELECT COALESCE(SQRT(AVG(CASE WHEN day_change_percentage < 0 THEN POWER(day_change_percentage, 2) ELSE 0 END)), 0) as downside_deviation
        FROM portfolio_daily_pnl 
        WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '${periodDays} days'
      `;
      
      const downsideResult = await this.db.query(downsideQuery, [userId]);
      const downsideDeviation = parseFloat(downsideResult.rows[0]?.downside_deviation) || 0;
      const sortinoRatio = downsideDeviation > 0 ? (annualizedReturn - 2) / (downsideDeviation * Math.sqrt(252)) : 0;

      return {
        userId,
        period,
        totalReturn,
        annualizedReturn,
        cagr: cagr * 100,
        sharpeRatio,
        sortinoRatio,
        calmarRatio,
        volatility: annualizedVolatility,
        maxDrawdown,
        averageDrawdown: parseFloat(row.avg_drawdown) || 0,
        drawdownDuration: 0, // Would need additional calculation
        winRate: parseFloat(row.win_rate) || 0,
        profitFactor: parseFloat(row.profit_factor) || 0,
        averageWin: parseFloat(row.avg_win) || 0,
        averageLoss: parseFloat(row.avg_loss) || 0,
        largestWin: parseFloat(row.largest_win) || 0,
        largestLoss: parseFloat(row.largest_loss) || 0,
        totalTrades: parseInt(row.total_trades) || 0,
        tradingDays,
        averageHoldingPeriod: parseFloat(row.avg_holding_period) || 0
      };
    } catch (error) {
      this.emit('error', { context: 'getPerformanceMetrics', error, userId, period });
      throw error;
    }
  }

  async getPnlHistory(userId: string, period: string): Promise<PnlRecord[]> {
    try {
      const periodDays = this.getPeriodDays(period);
      
      const query = `
        SELECT 
          id,
          user_id,
          date,
          realized_pnl,
          unrealized_pnl,
          total_pnl,
          asset_pnl,
          trading_pnl,
          vault_pnl,
          liquidity_pnl,
          bridge_pnl,
          portfolio_value,
          day_change,
          day_change_percentage
        FROM portfolio_daily_pnl
        WHERE user_id = $1 
        AND date >= CURRENT_DATE - INTERVAL '${periodDays} days'
        ORDER BY date DESC
      `;

      const result = await this.db.query(query, [userId]);
      
      return result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        date: new Date(row.date),
        realizedPnl: parseFloat(row.realized_pnl) || 0,
        unrealizedPnl: parseFloat(row.unrealized_pnl) || 0,
        totalPnl: parseFloat(row.total_pnl) || 0,
        assetPnl: row.asset_pnl || {},
        tradingPnl: parseFloat(row.trading_pnl) || 0,
        vaultPnl: parseFloat(row.vault_pnl) || 0,
        liquidityPnl: parseFloat(row.liquidity_pnl) || 0,
        bridgePnl: parseFloat(row.bridge_pnl) || 0,
        portfolioValue: parseFloat(row.portfolio_value) || 0,
        dayChange: parseFloat(row.day_change) || 0,
        dayChangePercentage: parseFloat(row.day_change_percentage) || 0
      }));
    } catch (error) {
      this.emit('error', { context: 'getPnlHistory', error, userId, period });
      throw error;
    }
  }

  async getPortfolioPositions(userId: string): Promise<PortfolioPosition[]> {
    try {
      const query = `
        SELECT 
          id,
          user_id,
          asset,
          position_type,
          quantity,
          average_entry_price,
          current_price,
          market_value,
          unrealized_pnl,
          unrealized_pnl_percentage,
          realized_pnl,
          total_pnl,
          roi,
          holding_period,
          opened_at,
          last_updated_at
        FROM portfolio_positions
        WHERE user_id = $1 AND is_active = true
        ORDER BY market_value DESC
      `;

      const result = await this.db.query(query, [userId]);
      
      return result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        asset: row.asset,
        type: row.position_type,
        quantity: parseFloat(row.quantity) || 0,
        averageEntryPrice: parseFloat(row.average_entry_price) || 0,
        currentPrice: parseFloat(row.current_price) || 0,
        marketValue: parseFloat(row.market_value) || 0,
        unrealizedPnl: parseFloat(row.unrealized_pnl) || 0,
        unrealizedPnlPercentage: parseFloat(row.unrealized_pnl_percentage) || 0,
        realizedPnl: parseFloat(row.realized_pnl) || 0,
        totalPnl: parseFloat(row.total_pnl) || 0,
        roi: parseFloat(row.roi) || 0,
        holdingPeriod: parseFloat(row.holding_period) || 0,
        openedAt: new Date(row.opened_at),
        lastUpdatedAt: new Date(row.last_updated_at)
      }));
    } catch (error) {
      this.emit('error', { context: 'getPortfolioPositions', error, userId });
      throw error;
    }
  }

  async getRiskMetrics(userId: string): Promise<RiskMetrics> {
    try {
      const query = `
        SELECT 
          user_id,
          date,
          value_at_risk,
          expected_shortfall,
          max_drawdown,
          volatility,
          sharpe_ratio,
          beta,
          concentration_risk,
          largest_position,
          asset_risk_contributions
        FROM portfolio_risk_metrics
        WHERE user_id = $1
        ORDER BY date DESC
        LIMIT 1
      `;

      const result = await this.db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return {
          userId,
          date: new Date(),
          valueAtRisk: 0,
          expectedShortfall: 0,
          maxDrawdown: 0,
          volatility: 0,
          sharpeRatio: 0,
          beta: 1.0,
          concentrationRisk: 0,
          largestPosition: 0,
          assetRiskContributions: {}
        };
      }

      const row = result.rows[0];
      
      return {
        userId: row.user_id,
        date: new Date(row.date),
        valueAtRisk: parseFloat(row.value_at_risk) || 0,
        expectedShortfall: parseFloat(row.expected_shortfall) || 0,
        maxDrawdown: parseFloat(row.max_drawdown) || 0,
        volatility: parseFloat(row.volatility) || 0,
        sharpeRatio: parseFloat(row.sharpe_ratio) || 0,
        beta: parseFloat(row.beta) || 1.0,
        concentrationRisk: parseFloat(row.concentration_risk) || 0,
        largestPosition: parseFloat(row.largest_position) || 0,
        assetRiskContributions: row.asset_risk_contributions || {}
      };
    } catch (error) {
      this.emit('error', { context: 'getRiskMetrics', error, userId });
      throw error;
    }
  }

  // Portfolio Analysis and Updates
  async updatePortfolioPositions(userId: string): Promise<void> {
    try {
      await this.db.query('BEGIN');

      // Update positions from various sources
      await this.updateSpotPositions(userId);
      await this.updateVaultPositions(userId);
      await this.updateLiquidityPositions(userId);
      await this.updateBridgePositions(userId);

      // Calculate portfolio-level metrics
      await this.calculatePortfolioMetrics(userId);
      
      // Update daily P&L record
      await this.updateDailyPnl(userId);

      await this.db.query('COMMIT');

      this.emit('portfolioUpdated', { userId });
    } catch (error) {
      await this.db.query('ROLLBACK');
      this.emit('error', { context: 'updatePortfolioPositions', error, userId });
      throw error;
    }
  }

  async calculateRiskMetrics(userId: string): Promise<void> {
    try {
      // Get portfolio positions
      const positions = await this.getPortfolioPositions(userId);
      
      if (positions.length === 0) {
        return;
      }

      const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
      
      // Calculate concentration risk (Herfindahl index)
      const concentrationRisk = positions.reduce((sum, pos) => {
        const weight = pos.marketValue / totalValue;
        return sum + (weight * weight);
      }, 0) * 100;

      // Find largest position percentage
      const largestPosition = Math.max(...positions.map(pos => (pos.marketValue / totalValue) * 100));

      // Calculate Value at Risk (simplified using historical simulation)
      const returns = await this.getHistoricalReturns(userId, 252); // 1 year of daily returns
      const sortedReturns = returns.sort((a, b) => a - b);
      const var95Index = Math.floor(sortedReturns.length * 0.05);
      const valueAtRisk = totalValue * Math.abs(sortedReturns[var95Index] || 0) / 100;

      // Calculate Expected Shortfall (CVaR)
      const tailReturns = sortedReturns.slice(0, var95Index);
      const avgTailReturn = tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length;
      const expectedShortfall = totalValue * Math.abs(avgTailReturn || 0) / 100;

      // Calculate portfolio volatility
      const volatility = this.calculateVolatility(returns);

      // Calculate Sharpe ratio
      const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const sharpeRatio = volatility > 0 ? (avgReturn - 0.02) / volatility : 0; // Assuming 2% risk-free rate

      // Calculate beta (simplified, using market proxy)
      const beta = await this.calculateBeta(userId);

      // Calculate max drawdown
      const maxDrawdown = await this.calculateMaxDrawdown(userId);

      // Calculate asset risk contributions
      const assetRiskContributions = this.calculateAssetRiskContributions(positions, totalValue);

      // Store risk metrics
      const query = `
        INSERT INTO portfolio_risk_metrics (
          user_id, date, value_at_risk, expected_shortfall, max_drawdown,
          volatility, sharpe_ratio, beta, concentration_risk, largest_position,
          asset_risk_contributions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (user_id, date) 
        DO UPDATE SET
          value_at_risk = EXCLUDED.value_at_risk,
          expected_shortfall = EXCLUDED.expected_shortfall,
          max_drawdown = EXCLUDED.max_drawdown,
          volatility = EXCLUDED.volatility,
          sharpe_ratio = EXCLUDED.sharpe_ratio,
          beta = EXCLUDED.beta,
          concentration_risk = EXCLUDED.concentration_risk,
          largest_position = EXCLUDED.largest_position,
          asset_risk_contributions = EXCLUDED.asset_risk_contributions
      `;

      await this.db.query(query, [
        userId, new Date().toISOString().split('T')[0], valueAtRisk, expectedShortfall,
        maxDrawdown, volatility, sharpeRatio, beta, concentrationRisk, largestPosition,
        JSON.stringify(assetRiskContributions)
      ]);

      this.emit('riskMetricsCalculated', { userId });
    } catch (error) {
      this.emit('error', { context: 'calculateRiskMetrics', error, userId });
      throw error;
    }
  }

  // Helper Methods
  private async getAssetAllocation(userId: string): Promise<AssetAllocation[]> {
    const query = `
      SELECT 
        asset,
        SUM(market_value) as total_value,
        SUM(unrealized_pnl + realized_pnl) as total_pnl,
        COUNT(*) as position_count
      FROM portfolio_positions 
      WHERE user_id = $1 AND is_active = true
      GROUP BY asset
      ORDER BY total_value DESC
    `;

    const result = await this.db.query(query, [userId]);
    const totalPortfolioValue = result.rows.reduce((sum: number, row: any) => sum + parseFloat(row.total_value), 0);

    return result.rows.map((row: any) => {
      const value = parseFloat(row.total_value);
      const pnl = parseFloat(row.total_pnl);
      
      return {
        asset: row.asset,
        value,
        percentage: totalPortfolioValue > 0 ? (value / totalPortfolioValue) * 100 : 0,
        pnl,
        pnlPercentage: (value - pnl) > 0 ? (pnl / (value - pnl)) * 100 : 0,
        positions: parseInt(row.position_count)
      };
    });
  }

  private async updateSpotPositions(userId: string): Promise<void> {
    // Update spot trading positions
    const query = `
      INSERT INTO portfolio_positions (
        user_id, asset, position_type, quantity, average_entry_price,
        current_price, market_value, unrealized_pnl, unrealized_pnl_percentage,
        realized_pnl, total_pnl, roi, holding_period, opened_at, last_updated_at
      )
      SELECT 
        $1 as user_id,
        base_asset as asset,
        'spot' as position_type,
        COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity ELSE -quantity END), 0) as quantity,
        COALESCE(AVG(CASE WHEN side = 'buy' THEN price END), 0) as average_entry_price,
        ap.price_usd as current_price,
        COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity ELSE -quantity END), 0) * ap.price_usd as market_value,
        (COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity ELSE -quantity END), 0) * ap.price_usd) - 
        COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity * price ELSE -quantity * price END), 0) as unrealized_pnl,
        CASE WHEN COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity * price ELSE -quantity * price END), 0) > 0
        THEN (((COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity ELSE -quantity END), 0) * ap.price_usd) - 
               COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity * price ELSE -quantity * price END), 0)) /
               COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity * price ELSE -quantity * price END), 0) * 100)
        ELSE 0 END as unrealized_pnl_percentage,
        0 as realized_pnl, -- Would be calculated from closed positions
        (COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity ELSE -quantity END), 0) * ap.price_usd) - 
        COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity * price ELSE -quantity * price END), 0) as total_pnl,
        CASE WHEN COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity * price ELSE -quantity * price END), 0) > 0
        THEN (((COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity ELSE -quantity END), 0) * ap.price_usd) - 
               COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity * price ELSE -quantity * price END), 0)) /
               COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity * price ELSE -quantity * price END), 0) * 100)
        ELSE 0 END as roi,
        EXTRACT(EPOCH FROM (NOW() - MIN(timestamp))) / 86400 as holding_period,
        MIN(timestamp) as opened_at,
        NOW() as last_updated_at
      FROM trade_executions te
      LEFT JOIN asset_price_feeds ap ON te.base_asset = ap.asset_symbol AND ap.is_valid = true
      WHERE te.user_id = $1
      GROUP BY base_asset, ap.price_usd
      HAVING COALESCE(SUM(CASE WHEN side = 'buy' THEN quantity ELSE -quantity END), 0) > 0
      ON CONFLICT (user_id, asset, position_type) 
      DO UPDATE SET
        quantity = EXCLUDED.quantity,
        average_entry_price = EXCLUDED.average_entry_price,
        current_price = EXCLUDED.current_price,
        market_value = EXCLUDED.market_value,
        unrealized_pnl = EXCLUDED.unrealized_pnl,
        unrealized_pnl_percentage = EXCLUDED.unrealized_pnl_percentage,
        total_pnl = EXCLUDED.total_pnl,
        roi = EXCLUDED.roi,
        holding_period = EXCLUDED.holding_period,
        last_updated_at = EXCLUDED.last_updated_at
    `;

    await this.db.query(query, [userId]);
  }

  private async updateVaultPositions(userId: string): Promise<void> {
    // Update vault positions
    const query = `
      INSERT INTO portfolio_positions (
        user_id, asset, position_type, quantity, average_entry_price,
        current_price, market_value, unrealized_pnl, unrealized_pnl_percentage,
        realized_pnl, total_pnl, roi, holding_period, opened_at, last_updated_at
      )
      SELECT 
        uvp.user_id,
        yv.base_asset as asset,
        'vault' as position_type,
        uvp.shares as quantity,
        uvp.average_entry_price,
        yv.share_price as current_price,
        uvp.shares * yv.share_price as market_value,
        uvp.unrealized_returns as unrealized_pnl,
        uvp.roi as unrealized_pnl_percentage,
        uvp.realized_returns as realized_pnl,
        uvp.total_returns as total_pnl,
        uvp.roi,
        EXTRACT(EPOCH FROM (NOW() - uvp.first_deposit_at)) / 86400 as holding_period,
        uvp.first_deposit_at as opened_at,
        NOW() as last_updated_at
      FROM user_vault_positions uvp
      JOIN yield_vaults yv ON uvp.vault_id = yv.id
      WHERE uvp.user_id = $1 AND uvp.is_active = true
      ON CONFLICT (user_id, asset, position_type) 
      DO UPDATE SET
        quantity = EXCLUDED.quantity,
        average_entry_price = EXCLUDED.average_entry_price,
        current_price = EXCLUDED.current_price,
        market_value = EXCLUDED.market_value,
        unrealized_pnl = EXCLUDED.unrealized_pnl,
        unrealized_pnl_percentage = EXCLUDED.unrealized_pnl_percentage,
        realized_pnl = EXCLUDED.realized_pnl,
        total_pnl = EXCLUDED.total_pnl,
        roi = EXCLUDED.roi,
        holding_period = EXCLUDED.holding_period,
        last_updated_at = EXCLUDED.last_updated_at
    `;

    await this.db.query(query, [userId]);
  }

  private async updateLiquidityPositions(userId: string): Promise<void> {
    // Update liquidity pool positions
    const query = `
      INSERT INTO portfolio_positions (
        user_id, asset, position_type, quantity, average_entry_price,
        current_price, market_value, unrealized_pnl, unrealized_pnl_percentage,
        realized_pnl, total_pnl, roi, holding_period, opened_at, last_updated_at
      )
      SELECT 
        lp.provider_id as user_id,
        CONCAT(pl.token_a_symbol, '-', pl.token_b_symbol) as asset,
        'pool' as position_type,
        lp.lp_tokens as quantity,
        lp.original_amount / lp.lp_tokens as average_entry_price,
        lp.current_value / lp.lp_tokens as current_price,
        lp.current_value as market_value,
        lp.current_value - lp.original_amount as unrealized_pnl,
        CASE WHEN lp.original_amount > 0 
        THEN ((lp.current_value - lp.original_amount) / lp.original_amount * 100) 
        ELSE 0 END as unrealized_pnl_percentage,
        0 as realized_pnl,
        lp.current_value - lp.original_amount as total_pnl,
        CASE WHEN lp.original_amount > 0 
        THEN ((lp.current_value - lp.original_amount) / lp.original_amount * 100) 
        ELSE 0 END as roi,
        EXTRACT(EPOCH FROM (NOW() - lp.deposited_at)) / 86400 as holding_period,
        lp.deposited_at as opened_at,
        NOW() as last_updated_at
      FROM liquidity_positions lp
      JOIN liquidity_pools pl ON lp.pool_id = pl.id
      WHERE lp.provider_id = $1 AND lp.is_active = true
      ON CONFLICT (user_id, asset, position_type) 
      DO UPDATE SET
        quantity = EXCLUDED.quantity,
        average_entry_price = EXCLUDED.average_entry_price,
        current_price = EXCLUDED.current_price,
        market_value = EXCLUDED.market_value,
        unrealized_pnl = EXCLUDED.unrealized_pnl,
        unrealized_pnl_percentage = EXCLUDED.unrealized_pnl_percentage,
        total_pnl = EXCLUDED.total_pnl,
        roi = EXCLUDED.roi,
        holding_period = EXCLUDED.holding_period,
        last_updated_at = EXCLUDED.last_updated_at
    `;

    await this.db.query(query, [userId]);
  }

  private async updateBridgePositions(userId: string): Promise<void> {
    // Bridge positions would typically be temporary, but we can track pending bridges
    // This is a placeholder implementation
  }

  private async calculatePortfolioMetrics(userId: string): Promise<void> {
    // Calculate and update portfolio-level metrics
    const metricsQuery = `
      UPDATE portfolio_positions 
      SET last_updated_at = NOW()
      WHERE user_id = $1
    `;

    await this.db.query(metricsQuery, [userId]);
  }

  private async updateDailyPnl(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    const query = `
      WITH portfolio_summary AS (
        SELECT 
          SUM(market_value) as portfolio_value,
          SUM(realized_pnl) as realized_pnl,
          SUM(unrealized_pnl) as unrealized_pnl,
          SUM(total_pnl) as total_pnl
        FROM portfolio_positions 
        WHERE user_id = $1 AND is_active = true
      ),
      asset_pnl AS (
        SELECT 
          jsonb_object_agg(asset, total_pnl) as asset_pnl_breakdown
        FROM (
          SELECT asset, SUM(total_pnl) as total_pnl
          FROM portfolio_positions 
          WHERE user_id = $1 AND is_active = true
          GROUP BY asset
        ) asset_totals
      ),
      previous_day AS (
        SELECT portfolio_value as prev_value
        FROM portfolio_daily_pnl 
        WHERE user_id = $1 
        ORDER BY date DESC 
        LIMIT 1
      )
      INSERT INTO portfolio_daily_pnl (
        user_id, date, realized_pnl, unrealized_pnl, total_pnl,
        asset_pnl, portfolio_value, day_change, day_change_percentage
      )
      SELECT 
        $1,
        $2::date,
        ps.realized_pnl,
        ps.unrealized_pnl,
        ps.total_pnl,
        ap.asset_pnl_breakdown,
        ps.portfolio_value,
        ps.portfolio_value - COALESCE(pd.prev_value, ps.portfolio_value),
        CASE WHEN COALESCE(pd.prev_value, ps.portfolio_value) > 0 
        THEN ((ps.portfolio_value - COALESCE(pd.prev_value, ps.portfolio_value)) / pd.prev_value * 100)
        ELSE 0 END
      FROM portfolio_summary ps
      CROSS JOIN asset_pnl ap
      LEFT JOIN previous_day pd ON true
      ON CONFLICT (user_id, date) 
      DO UPDATE SET
        realized_pnl = EXCLUDED.realized_pnl,
        unrealized_pnl = EXCLUDED.unrealized_pnl,
        total_pnl = EXCLUDED.total_pnl,
        asset_pnl = EXCLUDED.asset_pnl,
        portfolio_value = EXCLUDED.portfolio_value,
        day_change = EXCLUDED.day_change,
        day_change_percentage = EXCLUDED.day_change_percentage
    `;

    await this.db.query(query, [userId, today]);
  }

  private async getHistoricalReturns(userId: string, days: number): Promise<number[]> {
    const query = `
      SELECT day_change_percentage
      FROM portfolio_daily_pnl
      WHERE user_id = $1
      AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map((row: any) => parseFloat(row.day_change_percentage) || 0);
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance);
  }

  private async calculateBeta(userId: string): Promise<number> {
    // Simplified beta calculation - would need market index data
    return 1.0; // Placeholder
  }

  private async calculateMaxDrawdown(userId: string): Promise<number> {
    const query = `
      WITH portfolio_values AS (
        SELECT 
          date,
          portfolio_value,
          MAX(portfolio_value) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING) as peak_value
        FROM portfolio_daily_pnl
        WHERE user_id = $1
        ORDER BY date
      ),
      drawdowns AS (
        SELECT 
          ((peak_value - portfolio_value) / peak_value * 100) as drawdown_pct
        FROM portfolio_values
        WHERE peak_value > 0
      )
      SELECT COALESCE(MAX(drawdown_pct), 0) as max_drawdown
      FROM drawdowns
    `;

    const result = await this.db.query(query, [userId]);
    return parseFloat(result.rows[0]?.max_drawdown) || 0;
  }

  private calculateAssetRiskContributions(positions: PortfolioPosition[], totalValue: number): Record<string, number> {
    const contributions: Record<string, number> = {};
    
    for (const position of positions) {
      const weight = position.marketValue / totalValue;
      const volatility = Math.abs(position.unrealizedPnlPercentage) / 100; // Simplified
      contributions[position.asset] = weight * volatility * 100;
    }
    
    return contributions;
  }

  private getPeriodDays(period: string): number {
    const periodMap: Record<string, number> = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
      'all': 999999
    };
    
    return periodMap[period] || 30;
  }

  private getEmptyPerformanceMetrics(userId: string, period: string): PerformanceMetrics {
    return {
      userId,
      period,
      totalReturn: 0,
      annualizedReturn: 0,
      cagr: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      volatility: 0,
      maxDrawdown: 0,
      averageDrawdown: 0,
      drawdownDuration: 0,
      winRate: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      totalTrades: 0,
      tradingDays: 0,
      averageHoldingPeriod: 0
    };
  }

  private async setupPeriodicUpdates(): Promise<void> {
    // Update portfolios every 5 minutes
    const updateInterval = setInterval(async () => {
      try {
        // Get all active users with positions
        const activeUsersQuery = `
          SELECT DISTINCT user_id 
          FROM portfolio_positions 
          WHERE is_active = true 
          AND last_updated_at < NOW() - INTERVAL '5 minutes'
        `;
        
        const result = await this.db.query(activeUsersQuery);
        
        for (const row of result.rows) {
          try {
            await this.updatePortfolioPositions(row.user_id);
            await this.calculateRiskMetrics(row.user_id);
          } catch (error) {
            this.emit('error', { 
              context: 'periodicUpdate', 
              error, 
              userId: row.user_id 
            });
          }
        }
      } catch (error) {
        this.emit('error', { context: 'setupPeriodicUpdates', error });
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.updateTimers.set('portfolio-updates', updateInterval);

    // Daily risk metrics calculation
    const riskUpdateInterval = setInterval(async () => {
      try {
        const activeUsersQuery = 'SELECT DISTINCT user_id FROM portfolio_positions WHERE is_active = true';
        const result = await this.db.query(activeUsersQuery);
        
        for (const row of result.rows) {
          try {
            await this.calculateRiskMetrics(row.user_id);
          } catch (error) {
            this.emit('error', { 
              context: 'dailyRiskUpdate', 
              error, 
              userId: row.user_id 
            });
          }
        }
      } catch (error) {
        this.emit('error', { context: 'dailyRiskUpdate', error });
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    this.updateTimers.set('risk-updates', riskUpdateInterval);
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;
    
    // Clear all update timers
    Array.from(this.updateTimers.values()).forEach(timer => {
      clearTimeout(timer);
    });
    this.updateTimers.clear();
    
    this.emit('shutdown');
  }
}

export default PortfolioAnalyticsService;
