import React, { useState } from 'react';
import styles from './LiquidityPoolForm.module.css';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const LiquidityPoolForm = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  
  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [slippageTolerance, setSlippageTolerance] = useState('0.5');
  const [isAdding, setIsAdding] = useState(true);

  // List of available tokens
  const availableTokens = [
    { symbol: 'SOL', name: 'Solana', mintAddress: 'So11111111111111111111111111111111111111112' },
    { symbol: 'USDC', name: 'USD Coin', mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    { symbol: 'USDT', name: 'Tether', mintAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
    // Add more tokens as needed
  ];

  const handleTokenAChange = (e) => {
    setTokenA(e.target.value);
  };

  const handleTokenBChange = (e) => {
    setTokenB(e.target.value);
  };

  const handleAmountAChange = (e) => {
    setAmountA(e.target.value);
    // In a real implementation, you would calculate the estimated amountB based on pool ratio
    // This is just a placeholder calculation
    if (e.target.value) {
      const calculatedAmountB = parseFloat(e.target.value) * 2; // Placeholder calculation
      setAmountB(calculatedAmountB.toString());
    } else {
      setAmountB('');
    }
  };

  const handleAmountBChange = (e) => {
    setAmountB(e.target.value);
    // Similar placeholder calculation for amountA
    if (e.target.value) {
      const calculatedAmountA = parseFloat(e.target.value) / 2; // Placeholder calculation
      setAmountA(calculatedAmountA.toString());
    } else {
      setAmountA('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      // This would be replaced with actual on-chain interaction using Anchor
      console.log({
        action: isAdding ? 'Add Liquidity' : 'Remove Liquidity',
        tokenA,
        tokenB,
        amountA,
        amountB,
        slippageTolerance
      });
      
      // Placeholder for actual transaction
      alert(`${isAdding ? 'Added' : 'Removed'} liquidity successfully!`);
    } catch (error) {
      console.error('Error:', error);
      alert(`Error ${isAdding ? 'adding' : 'removing'} liquidity: ${error.message}`);
    }
  };

  return (
    <div className={styles.container}>
      <h2>Liquidity Pool</h2>
      
      <div className={styles.toggleContainer}>
        <button 
          className={`${styles.toggleButton} ${isAdding ? styles.active : ''}`}
          onClick={() => setIsAdding(true)}
        >
          Add Liquidity
        </button>
        <button 
          className={`${styles.toggleButton} ${!isAdding ? styles.active : ''}`}
          onClick={() => setIsAdding(false)}
        >
          Remove Liquidity
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label>Token A</label>
          <select 
            value={tokenA} 
            onChange={handleTokenAChange}
            required
          >
            <option value="">Select Token</option>
            {availableTokens.map((token) => (
              <option key={token.mintAddress} value={token.mintAddress}>
                {token.symbol} - {token.name}
              </option>
            ))}
          </select>
          
          <label>Amount A</label>
          <input 
            type="number" 
            value={amountA} 
            onChange={handleAmountAChange}
            placeholder="0.00"
            required
            min="0"
            step="0.000001"
          />
        </div>

        <div className={styles.plusIcon}>+</div>

        <div className={styles.formGroup}>
          <label>Token B</label>
          <select 
            value={tokenB} 
            onChange={handleTokenBChange}
            required
          >
            <option value="">Select Token</option>
            {availableTokens.map((token) => (
              <option key={token.mintAddress} value={token.mintAddress}>
                {token.symbol} - {token.name}
              </option>
            ))}
          </select>
          
          <label>Amount B</label>
          <input 
            type="number" 
            value={amountB} 
            onChange={handleAmountBChange}
            placeholder="0.00"
            required
            min="0"
            step="0.000001"
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
          <button type="submit" className={styles.submitButton}>
            {isAdding ? 'Add Liquidity' : 'Remove Liquidity'}
          </button>
        )}
        
        {isAdding && (
          <div className={styles.infoBox}>
            <p>You will receive LP tokens representing your share of the pool</p>
            {tokenA && tokenB && amountA && amountB && (
              <p>Estimated LP tokens: {(parseFloat(amountA) * parseFloat(amountB)).toFixed(6)}</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default LiquidityPoolForm;
