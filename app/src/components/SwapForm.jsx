import React, { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import styles from './SwapForm.module.css';

const SwapForm = () => {
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [inputToken, setInputToken] = useState('SOL');
  const [outputToken, setOutputToken] = useState('USDC');
  
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const handleSwap = async () => {
    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }
    
    // Implementation will be added when backend is ready
    console.log(`Swapping ${inputAmount} ${inputToken} for ${outputAmount} ${outputToken}`);
  };

  const handleTokenSwitch = () => {
    const tempToken = inputToken;
    const tempAmount = inputAmount;
    
    setInputToken(outputToken);
    setInputAmount(outputAmount);
    
    setOutputToken(tempToken);
    setOutputAmount(tempAmount);
  };

  const calculateOutputAmount = (input) => {
    // This is a simplified calculation and would be replaced with actual pricing logic
    if (input === '') {
      setOutputAmount('');
      return;
    }
    
    const inputValue = parseFloat(input);
    let calculatedOutput = 0;
    
    if (inputToken === 'SOL' && outputToken === 'USDC') {
      calculatedOutput = inputValue * 100; // Example rate: 1 SOL = 100 USDC
    } else if (inputToken === 'USDC' && outputToken === 'SOL') {
      calculatedOutput = inputValue / 100; // Example rate: 100 USDC = 1 SOL
    }
    
    setOutputAmount(calculatedOutput.toString());
  };

  const handleInputChange = (e) => {
    const input = e.target.value;
    if (input === '' || /^\d*\.?\d*$/.test(input)) {
      setInputAmount(input);
      calculateOutputAmount(input);
    }
  };

  return (
    <div className={styles.swapContainer}>
      <div className={styles.swapHeader}>
        <h2>Swap Tokens</h2>
        <div className={styles.settings}>⚙️</div>
      </div>
      
      <div className={styles.inputBox}>
        <div className={styles.inputHeader}>
          <span>From</span>
          <span>Balance: {publicKey ? '0.00' : '---'}</span>
        </div>
        <div className={styles.inputContent}>
          <input 
            type="text" 
            value={inputAmount} 
            onChange={handleInputChange}
            placeholder="0.0"
            className={styles.amountInput} 
          />
          <select 
            value={inputToken} 
            onChange={(e) => setInputToken(e.target.value)}
            className={styles.tokenSelect}
          >
            <option value="SOL">SOL</option>
            <option value="USDC">USDC</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
          </select>
        </div>
      </div>
      
      <div className={styles.switchButton} onClick={handleTokenSwitch}>
        ↓↑
      </div>
      
      <div className={styles.inputBox}>
        <div className={styles.inputHeader}>
          <span>To (estimated)</span>
          <span>Balance: {publicKey ? '0.00' : '---'}</span>
        </div>
        <div className={styles.inputContent}>
          <input 
            type="text" 
            value={outputAmount} 
            readOnly 
            placeholder="0.0"
            className={styles.amountInput} 
          />
          <select 
            value={outputToken} 
            onChange={(e) => setOutputToken(e.target.value)}
            className={styles.tokenSelect}
          >
            <option value="SOL">SOL</option>
            <option value="USDC">USDC</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
          </select>
        </div>
      </div>
      
      <div className={styles.swapRate}>
        1 {inputToken} ≈ {inputToken === 'SOL' ? '100' : '0.01'} {outputToken}
      </div>
      
      {publicKey ? (
        <button className={styles.swapButton} onClick={handleSwap}>
          Swap
        </button>
      ) : (
        <WalletMultiButton className={styles.connectButton} />
      )}
    </div>
  );
};

export default SwapForm;
