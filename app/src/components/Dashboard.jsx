import React, { useState, useEffect } from 'react';
import styles from './Dashboard.module.css';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const Dashboard = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  
  // State for user positions and analytics
  const [userPositions, setUserPositions] = useState([]);
  const [poolStats, setPoolStats] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  
  // Mock data - In a real implementation, this would come from on-chain
  const mockPoolStats = {
    totalValueLocked: 24563789.45,
    volume24h: 1578432.23,
    swapFees24h: 4735.29,
    tradingFees24h: 9842.51,
  };
  
  const mockUserPositions = [
    {
      id: '1',
      type: 'liquidity',
      pair: 'SOL-USDC',
      amount: '10.5 SOL + 525 USDC',
      value: '$1,050.75',
      apy: '24.3%',
      timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: '2',
      type: 'perpetual',
      pair: 'BTC-USD',
      position: 'LONG',
      size: '0.025 BTC',
      leverage: '10x',
      entryPrice: '$58,245.75',
      currentPrice: '$58,930.25',
      pnl: '+$171.13 (2.94%)',
      liquidationPrice: '$52,421.18',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '3',
      type: 'perpetual',
      pair: 'SOL-USD',
      position: 'SHORT',
      size: '5.2 SOL',
      leverage: '5x',
      entryPrice: '$51.25',
      currentPrice: '$50.45',
      pnl: '+$41.60 (1.56%)',
      liquidationPrice: '$56.38',
      timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
  ];
  
  // Sample trade history data
  const mockTradeHistory = [
    {
      id: '101',
      type: 'SWAP',
      from: '10 SOL',
      to: '495 USDC',
      price: '$49.50 per SOL',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: '102',
      type: 'ADD_LIQUIDITY',
      tokens: '5 SOL + 250 USDC',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '103',
      type: 'CLOSE_POSITION',
      pair: 'ETH-USD',
      position: 'LONG',
      size: '0.5 ETH',
      pnl: '+$120.45 (7.5%)',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];
  
  // Price chart data (mock)
  const mockChartData = {
    SOL: [48.25, 49.12, 50.45, 51.30, 50.75, 50.25, 50.45],
    BTC: [57250, 58125, 58930, 59100, 58750, 58800, 58930],
    ETH: [3120, 3175, 3210, 3225, 3200, 3190, 3217],
  };
  
  useEffect(() => {
    if (publicKey) {
      // In a real implementation, we would fetch user positions and data here
      setPoolStats(mockPoolStats);
      setUserPositions(mockUserPositions);
    }
  }, [publicKey]);
  
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };
  
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  // Render the user's positions
  const renderPositions = () => {
    if (!publicKey) {
      return (
        <div className={styles.connectPrompt}>
          <p>Connect your wallet to view your positions</p>
          <WalletMultiButton className={styles.walletButton} />
        </div>
      );
    }
    
    if (userPositions.length === 0) {
      return <p className={styles.emptyState}>You don't have any open positions</p>;
    }
    
    return (
      <div className={styles.positionsContainer}>
        {userPositions.map((position) => (
          <div key={position.id} className={styles.positionCard}>
            <div className={styles.positionHeader}>
              <span className={styles.positionPair}>{position.pair}</span>
              <span className={`${styles.positionType} ${position.type === 'liquidity' ? styles.liquidity : position.position === 'LONG' ? styles.long : styles.short}`}>
                {position.type === 'liquidity' ? 'Liquidity Pool' : position.position}
              </span>
            </div>
            
            <div className={styles.positionDetails}>
              {position.type === 'liquidity' ? (
                <>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Amount:</span>
                    <span className={styles.detailValue}>{position.amount}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Value:</span>
                    <span className={styles.detailValue}>{position.value}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>APY:</span>
                    <span className={styles.detailValue}>{position.apy}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Size:</span>
                    <span className={styles.detailValue}>{position.size} ({position.leverage})</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Entry Price:</span>
                    <span className={styles.detailValue}>{position.entryPrice}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Current Price:</span>
                    <span className={styles.detailValue}>{position.currentPrice}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>PnL:</span>
                    <span className={`${styles.detailValue} ${position.pnl.startsWith('+') ? styles.profit : styles.loss}`}>{position.pnl}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Liquidation:</span>
                    <span className={styles.detailValue}>{position.liquidationPrice}</span>
                  </div>
                </>
              )}
              
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Opened:</span>
                <span className={styles.detailValue}>{formatDate(position.timestamp)}</span>
              </div>
            </div>
            
            <div className={styles.positionActions}>
              {position.type === 'liquidity' ? (
                <button className={styles.actionButton}>Remove Liquidity</button>
              ) : (
                <button className={`${styles.actionButton} ${position.position === 'LONG' ? styles.closeLong : styles.closeShort}`}>
                  Close Position
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // Render analytics section
  const renderAnalytics = () => {
    return (
      <div className={styles.analyticsContainer}>
        <div className={styles.statsCards}>
          <div className={styles.statCard}>
            <h3>Total Value Locked</h3>
            <p className={styles.statValue}>{formatCurrency(poolStats.totalValueLocked)}</p>
          </div>
          <div className={styles.statCard}>
            <h3>24h Volume</h3>
            <p className={styles.statValue}>{formatCurrency(poolStats.volume24h)}</p>
          </div>
          <div className={styles.statCard}>
            <h3>24h Swap Fees</h3>
            <p className={styles.statValue}>{formatCurrency(poolStats.swapFees24h)}</p>
          </div>
          <div className={styles.statCard}>
            <h3>24h Trading Fees</h3>
            <p className={styles.statValue}>{formatCurrency(poolStats.tradingFees24h)}</p>
          </div>
        </div>
        
        <div className={styles.chartContainer}>
          <h3>Price Charts</h3>
          {/* In a real implementation, you'd use a chart library like Chart.js or Recharts */}
          <div className={styles.mockChart}>
            <div className={styles.chartLabel}>SOL-USD</div>
            <div className={styles.chartBars}>
              {mockChartData.SOL.map((price, index) => (
                <div 
                  key={index} 
                  className={styles.chartBar} 
                  style={{ height: `${(price - 48) * 20}px` }}
                  title={`$${price}`}
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render trade history
  const renderHistory = () => {
    if (!publicKey) {
      return (
        <div className={styles.connectPrompt}>
          <p>Connect your wallet to view your history</p>
          <WalletMultiButton className={styles.walletButton} />
        </div>
      );
    }
    
    return (
      <div className={styles.historyContainer}>
        <table className={styles.historyTable}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Details</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mockTradeHistory.map(trade => (
              <tr key={trade.id}>
                <td>
                  <span className={`${styles.tradeType} ${
                    trade.type === 'SWAP' ? styles.swap : 
                    trade.type === 'ADD_LIQUIDITY' ? styles.addLiquidity :
                    trade.position === 'LONG' ? styles.long : styles.short
                  }`}>
                    {trade.type}
                  </span>
                </td>
                <td>
                  {trade.type === 'SWAP' && (
                    <span>{trade.from} → {trade.to}</span>
                  )}
                  {trade.type === 'ADD_LIQUIDITY' && (
                    <span>Added {trade.tokens}</span>
                  )}
                  {trade.type === 'CLOSE_POSITION' && (
                    <span>{trade.pair} {trade.position} {trade.size} ({trade.pnl})</span>
                  )}
                </td>
                <td>{formatDate(trade.timestamp)}</td>
                <td>
                  <span className={styles.complete}>Completed</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  return (
    <div className={styles.container}>
      <h1>Dashboard</h1>
      
      <div className={styles.tabs}>
        <button 
          className={`${styles.tabButton} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'positions' ? styles.active : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          Positions
        </button>
        <button 
          className={`${styles.tabButton} ${activeTab === 'history' ? styles.active : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </div>
      
      <div className={styles.tabContent}>
        {activeTab === 'overview' && (
          <div>
            <h2>Your Positions</h2>
            {renderPositions()}
            <h2>Market Analytics</h2>
            {renderAnalytics()}
          </div>
        )}
        
        {activeTab === 'positions' && (
          <div>
            <h2>Your Positions</h2>
            {renderPositions()}
          </div>
        )}
        
        {activeTab === 'history' && (
          <div>
            <h2>Trade History</h2>
            {renderHistory()}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
