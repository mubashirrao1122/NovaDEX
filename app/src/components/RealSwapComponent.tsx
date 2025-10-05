import React, { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { jupiterAPI, TokenInfo, POPULAR_TOKENS, formatPrice, formatNumber } from '@/utils/api-services';

interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: number;
  routePlan: any[];
}

const RealSwapComponent: React.FC = () => {
  const { connection } = useConnection();
  const { wallet, publicKey, signTransaction, connected } = useWallet();

  const [tokenList, setTokenList] = useState<TokenInfo[]>(POPULAR_TOKENS);
  const [selectedTokenFrom, setSelectedTokenFrom] = useState<TokenInfo>(POPULAR_TOKENS[0]); // SOL
  const [selectedTokenTo, setSelectedTokenTo] = useState<TokenInfo>(POPULAR_TOKENS[1]); // USDC
  
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [currentQuote, setCurrentQuote] = useState<SwapQuote | null>(null);
  
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<{ [key: string]: number }>({});
  
  const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null);
  const [tokenSearch, setTokenSearch] = useState('');

  // Fetch Jupiter token list on component mount
  useEffect(() => {
    const fetchTokenList = async () => {
      try {
        const tokens = await jupiterAPI.getTokenList();
        setTokenList([...POPULAR_TOKENS, ...tokens.slice(0, 50)]); // Popular tokens first, then others
      } catch (error) {
        console.error('Error fetching token list:', error);
      }
    };

    fetchTokenList();
  }, []);

  // Fetch token balances when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      fetchTokenBalances();
    }
  }, [connected, publicKey]);

  const fetchTokenBalances = async () => {
    if (!publicKey) return;

    const balances: { [key: string]: number } = {};
    
    try {
      // Fetch SOL balance
      const solBalance = await connection.getBalance(publicKey);
      balances[POPULAR_TOKENS[0].address] = solBalance / 1e9;

      // Fetch other token balances (simplified - would need actual token account parsing)
      for (const token of POPULAR_TOKENS.slice(1)) {
        // This is a simplified version - real implementation would check token accounts
        balances[token.address] = Math.random() * 1000; // Mock balance
      }

      setTokenBalances(balances);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  // Get quote from Jupiter API
  const getSwapQuote = useCallback(async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      setOutputAmount('');
      setCurrentQuote(null);
      return;
    }

    setIsLoadingQuote(true);
    try {
      const inputAmountLamports = Math.floor(parseFloat(amount) * Math.pow(10, selectedTokenFrom.decimals));
      
      const quote = await jupiterAPI.getQuote(
        selectedTokenFrom.address,
        selectedTokenTo.address,
        inputAmountLamports,
        slippage * 100 // Convert to basis points
      );

      if (quote) {
        setCurrentQuote(quote);
        const outputAmountFormatted = (parseInt(quote.outAmount) / Math.pow(10, selectedTokenTo.decimals)).toFixed(6);
        setOutputAmount(outputAmountFormatted);
      }
    } catch (error) {
      console.error('Error getting quote:', error);
      setOutputAmount('');
      setCurrentQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [selectedTokenFrom, selectedTokenTo, slippage]);

  // Debounced quote fetching
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (inputAmount) {
        getSwapQuote(inputAmount);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [inputAmount, getSwapQuote]);

  // Execute swap
  const executeSwap = async () => {
    if (!currentQuote || !publicKey || !signTransaction) {
      console.error('Missing requirements for swap');
      return;
    }

    setIsSwapping(true);
    try {
      // Get swap transaction from Jupiter
      const swapTransaction = await jupiterAPI.getSwapTransaction(currentQuote, publicKey.toString());
      
      if (!swapTransaction) {
        throw new Error('Failed to get swap transaction');
      }

      // Deserialize transaction
      const transaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
      
      // Sign transaction
      const signedTransaction = await signTransaction(transaction);
      
      // Send transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed');
      
      console.log('Swap successful! Signature:', signature);
      
      // Refresh balances
      await fetchTokenBalances();
      
      // Reset form
      setInputAmount('');
      setOutputAmount('');
      setCurrentQuote(null);
      
    } catch (error) {
      console.error('Swap failed:', error);
    } finally {
      setIsSwapping(false);
    }
  };

  const swapTokens = () => {
    const temp = selectedTokenFrom;
    setSelectedTokenFrom(selectedTokenTo);
    setSelectedTokenTo(temp);
    setInputAmount(outputAmount);
    setOutputAmount('');
    setCurrentQuote(null);
  };

  const filteredTokens = tokenList.filter(token =>
    token.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) ||
    token.name.toLowerCase().includes(tokenSearch.toLowerCase())
  );

  const TokenSelector = ({ type }: { type: 'from' | 'to' }) => {
    const selectedToken = type === 'from' ? selectedTokenFrom : selectedTokenTo;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md m-4 max-h-[80vh] overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Select Token</h3>
              <button
                onClick={() => setShowTokenSelector(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              placeholder="Search tokens..."
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400"
            />
          </div>
          
          <div className="overflow-y-auto max-h-96">
            {filteredTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => {
                  if (type === 'from') {
                    setSelectedTokenFrom(token);
                  } else {
                    setSelectedTokenTo(token);
                  }
                  setShowTokenSelector(null);
                  setTokenSearch('');
                }}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-800 border-b border-gray-800/50 last:border-b-0"
              >
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-black font-bold">
                  {token.symbol[0]}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-white">{token.symbol}</div>
                  <div className="text-sm text-gray-400">{token.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-white">
                    {tokenBalances[token.address]?.toFixed(4) || '0.0000'}
                  </div>
                  <div className="text-xs text-gray-400">Balance</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Swap</h2>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm rounded-lg border border-gray-600 hover:bg-gray-700 text-gray-300">
              ⚙️ {slippage}%
            </button>
            <WalletMultiButton className="!bg-primary !rounded-lg !text-black !font-medium !text-sm" />
          </div>
        </div>

        {/* From Token */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">From</span>
            <span className="text-sm text-gray-400">
              Balance: {connected ? (tokenBalances[selectedTokenFrom.address]?.toFixed(4) || '0.0000') : '0'} {selectedTokenFrom.symbol}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowTokenSelector('from')}
              className="flex items-center gap-3 bg-gray-700 rounded-lg px-3 py-2 min-w-[140px] hover:bg-gray-600 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-black text-xs font-bold">
                {selectedTokenFrom.symbol[0]}
              </div>
              <span className="font-medium text-white">{selectedTokenFrom.symbol}</span>
              <span className="text-gray-400">▼</span>
            </button>
            <input
              type="number"
              placeholder="0"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="flex-1 bg-transparent text-2xl font-medium text-white placeholder-gray-500 border-none outline-none"
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-400">
            <span>~$1.00</span>
            <button
              onClick={() => {
                const balance = tokenBalances[selectedTokenFrom.address];
                if (balance) {
                  setInputAmount(balance.toString());
                }
              }}
              className="text-primary hover:text-primary/80"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center my-4">
          <button
            onClick={swapTokens}
            className="bg-gray-700 hover:bg-gray-600 rounded-full p-3 border border-gray-600 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* To Token */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">To</span>
            <span className="text-sm text-gray-400">
              Balance: {connected ? (tokenBalances[selectedTokenTo.address]?.toFixed(4) || '0.0000') : '0'} {selectedTokenTo.symbol}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowTokenSelector('to')}
              className="flex items-center gap-3 bg-gray-700 rounded-lg px-3 py-2 min-w-[140px] hover:bg-gray-600 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-black text-xs font-bold">
                {selectedTokenTo.symbol[0]}
              </div>
              <span className="font-medium text-white">{selectedTokenTo.symbol}</span>
              <span className="text-gray-400">▼</span>
            </button>
            <div className="flex-1 text-2xl font-medium text-white">
              {isLoadingQuote ? (
                <div className="animate-pulse">...</div>
              ) : (
                outputAmount || '0'
              )}
            </div>
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-400">
            <span>~$1.00</span>
          </div>
        </div>

        {/* Swap Details */}
        {currentQuote && (
          <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Rate</span>
              <span className="text-white">
                1 {selectedTokenFrom.symbol} = {(parseFloat(outputAmount) / parseFloat(inputAmount)).toFixed(6)} {selectedTokenTo.symbol}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Price Impact</span>
              <span className={`${currentQuote.priceImpactPct < 1 ? 'text-green-400' : 'text-yellow-400'}`}>
                {currentQuote.priceImpactPct.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Slippage</span>
              <span className="text-white">{slippage}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Route</span>
              <span className="text-white">{currentQuote.routePlan.length} hop(s)</span>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={executeSwap}
          disabled={!currentQuote || !connected || isSwapping || isLoadingQuote}
          className="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-700 disabled:text-gray-400 text-black font-semibold py-4 rounded-xl transition-colors"
        >
          {!connected ? 'Connect Wallet' : 
           isSwapping ? 'Swapping...' :
           isLoadingQuote ? 'Getting Quote...' :
           !currentQuote ? 'Enter an amount' : 
           'Swap'}
        </button>
      </div>

      {/* Token Selector Modal */}
      {showTokenSelector && <TokenSelector type={showTokenSelector} />}
    </div>
  );
};

export default RealSwapComponent;
