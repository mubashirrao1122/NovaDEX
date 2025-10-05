import React, { useState } from 'react';
import styles from './PerpetualTradingForm.module.css';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const PerpetualTradingForm = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  // State variables for the trading form
  const [positionType, setPositionType] = useState('long'); // 'long' or 'short'
  const [collateralAmount, setCollateralAmount] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [positionSize, setPositionSize] = useState('');
  const [slippageTolerance, setSlippageTolerance] = useState('1.0');
  const [selectedAsset, setSelectedAsset] = useState('');

  // Example trading pairs
  const tradingPairs = [
    { symbol: 'SOL-USD', name: 'Solana / USD', assetPrice: 50.25 },
    { symbol: 'BTC-USD', name: 'Bitcoin / USD', assetPrice: 58230.50 },
    { symbol: 'ETH-USD', name: 'Ethereum / USD', assetPrice: 3217.75 },
  ];

  // Handle leverage change
  const handleLeverageChange = (e) => {
    const newLeverage = parseInt(e.target.value);
    setLeverage(newLeverage);
    updatePositionSize(collateralAmount, newLeverage);
  };

  // Handle collateral amount change
  const handleCollateralChange = (e) => {
    const amount = e.target.value;
    setCollateralAmount(amount);
    updatePositionSize(amount, leverage);
  };

  // Calculate position size based on collateral and leverage
  const updatePositionSize = (collateral, lev) => {
    if (!collateral || !selectedAsset) return;
    
    const pair = tradingPairs.find(p => p.symbol === selectedAsset);
    if (!pair) return;
    
    const size = parseFloat(collateral) * lev / pair.assetPrice;
    setPositionSize(size.toFixed(6));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      // This would be replaced with actual on-chain interaction using Anchor
      console.log({
        action: `Open ${positionType} position`,
        asset: selectedAsset,
        collateralAmount,
        leverage,
        positionSize,
        slippageTolerance
      });
      
      // Placeholder for actual transaction
      alert(`${positionType.charAt(0).toUpperCase() + positionType.slice(1)} position opened successfully!`);
    } catch (error) {
      console.error('Error:', error);
      alert(`Error opening position: ${error.message}`);
    }
  };

  // Get estimated liquidation price
  const getLiquidationPrice = () => {
    if (!selectedAsset || !collateralAmount || leverage <= 0) return 'N/A';
    
    const pair = tradingPairs.find(p => p.symbol === selectedAsset);
    if (!pair) return 'N/A';
    
    // Simple liquidation price calculation (would be more complex in production)
    const maintenanceMargin = 0.05; // 5% maintenance margin
    const direction = positionType === 'long' ? 1 : -1;
    
    const entryPrice = pair.assetPrice;
    const liquidationPrice = positionType === 'long'
      ? entryPrice * (1 - (1 / leverage) + maintenanceMargin)
      : entryPrice * (1 + (1 / leverage) - maintenanceMargin);
    
    return liquidationPrice.toFixed(2);
  };

  return (
    <div className={styles.container}>
      <h2>Perpetual Trading</h2>
      
      <div className={styles.toggleContainer}>
        <button 
          className={`${styles.toggleButton} ${positionType === 'long' ? styles.long : ''}`}
          onClick={() => setPositionType('long')}
        >
          Long
        </button>
        <button 
          className={`${styles.toggleButton} ${positionType === 'short' ? styles.short : ''}`}
          onClick={() => setPositionType('short')}
        >
          Short
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label>Trading Pair</label>
          <select 
            value={selectedAsset} 
            onChange={(e) => {
              setSelectedAsset(e.target.value);
              updatePositionSize(collateralAmount, leverage);
            }}
            required
          >
            <option value="">Select Asset</option>
            {tradingPairs.map((pair) => (
              <option key={pair.symbol} value={pair.symbol}>
                {pair.name} - ${pair.assetPrice.toFixed(2)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Collateral (USDC)</label>
          <input 
            type="number" 
            value={collateralAmount} 
            onChange={handleCollateralChange}
            placeholder="0.00"
            required
            min="1"
            step="0.01"
          />
        </div>

        <div className={styles.formGroup}>
          <label>Leverage: {leverage}x</label>
          <input 
            type="range" 
            min="1" 
            max="20" 
            value={leverage} 
            onChange={handleLeverageChange}
            className={styles.leverageSlider}
          />
          <div className={styles.leverageMarkers}>
            <span>1x</span>
            <span>5x</span>
            <span>10x</span>
            <span>15x</span>
            <span>20x</span>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Position Size</label>
          <input 
            type="text" 
            value={positionSize} 
            readOnly
            className={styles.readOnlyInput}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Slippage Tolerance (%)</label>
          <input 
            type="number" 
            value={slippageTolerance} 
            onChange={(e) => setSlippageTolerance(e.target.value)}
            min="0.1"
            max="5"
            step="0.1"
          />
        </div>

        {!publicKey ? (
          <WalletMultiButton className={styles.walletButton} />
        ) : (
          <button 
            type="submit" 
            className={`${styles.submitButton} ${positionType === 'long' ? styles.longButton : styles.shortButton}`}
          >
            {positionType === 'long' ? 'Open Long Position' : 'Open Short Position'}
          </button>
        )}
        
        <div className={styles.infoBox}>
          <div className={styles.infoRow}>
            <span>Entry Price:</span>
            <span>${selectedAsset ? tradingPairs.find(p => p.symbol === selectedAsset)?.assetPrice.toFixed(2) : 'N/A'}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Est. Liquidation Price:</span>
            <span>${getLiquidationPrice()}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Fees:</span>
            <span>{collateralAmount ? `$${(parseFloat(collateralAmount) * 0.001).toFixed(4)}` : '$0.00'}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Funding Rate:</span>
            <span className={positionType === 'long' ? styles.negativeRate : styles.positiveRate}>
              {positionType === 'long' ? '-0.01%' : '+0.01%'} / 1h
            </span>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PerpetualTradingForm;
