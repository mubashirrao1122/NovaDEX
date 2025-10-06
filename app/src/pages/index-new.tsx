import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';

interface Token {
  address: string;
  symbol: string;
  name: string;
  logoURI: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

interface MarketStats {
  totalVolume24h: string;
  totalLiquidity: string;
  activePairs: number;
  totalTransactions: number;
}

const HomePage: React.FC = () => {
  const { connection } = useConnection();
  const { wallet, connected } = useWallet();
  
  const [selectedTokenFrom, setSelectedTokenFrom] = useState<Token>({
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    logoURI: '/tokens/sol.png',
    price: 150.25,
    change24h: 2.34,
    volume24h: 450000000,
    marketCap: 89000000000
  });

  const [selectedTokenTo, setSelectedTokenTo] = useState<Token>({
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    logoURI: '/tokens/usdc.png',
    price: 1.00,
    change24h: 0.01,
    volume24h: 2100000000,
    marketCap: 35000000000
  });

  const [swapAmount, setSwapAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  
  const [marketStats, setMarketStats] = useState<MarketStats>({
    totalVolume24h: '$2.1B',
    totalLiquidity: '$890M',
    activePairs: 1250,
    totalTransactions: 45000
  });

  const [topTokens, setTopTokens] = useState<Token[]>([
    {
      address: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      logoURI: '/tokens/sol.png',
      price: 150.25,
      change24h: 2.34,
      volume24h: 450000000,
      marketCap: 89000000000
    },
    {
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      logoURI: '/tokens/usdc.png',
      price: 1.00,
      change24h: 0.01,
      volume24h: 2100000000,
      marketCap: 35000000000
    },
    {
      address: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
      symbol: 'BTC',
      name: 'Bitcoin (Portal)',
      logoURI: '/tokens/btc.png',
      price: 45234.56,
      change24h: 1.89,
      volume24h: 890000000,
      marketCap: 890000000000
    },
    {
      address: '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
      symbol: 'ETH',
      name: 'Ethereum (Portal)',
      logoURI: '/tokens/eth.png',
      price: 3245.67,
      change24h: -0.89,
      volume24h: 567000000,
      marketCap: 390000000000
    },
    {
      address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      symbol: 'RAY',
      name: 'Raydium',
      logoURI: '/tokens/ray.png',
      price: 2.45,
      change24h: 5.67,
      volume24h: 78000000,
      marketCap: 890000000
    }
  ]);

  const calculateOutputAmount = () => {
    if (!swapAmount) return '0';
    const amount = parseFloat(swapAmount);
    const rate = selectedTokenFrom.price / selectedTokenTo.price;
    return (amount * rate * 0.997).toFixed(6); // 0.3% fee
  };

  const swapTokens = () => {
    const temp = selectedTokenFrom;
    setSelectedTokenFrom(selectedTokenTo);
    setSelectedTokenTo(temp);
  };

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-50"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary via-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
              The Future of Solana Trading
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Experience lightning-fast swaps, advanced trading tools, and the best prices across Solana with NovaDex
            </p>
            
            {/* Market Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-primary">{marketStats.totalVolume24h}</div>
                <div className="text-sm text-gray-400">24h Volume</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-primary">{marketStats.totalLiquidity}</div>
                <div className="text-sm text-gray-400">Total Liquidity</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-primary">{marketStats.activePairs.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Active Pairs</div>
              </div>
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-primary">{marketStats.totalTransactions.toLocaleString()}</div>
                <div className="text-sm text-gray-400">24h Transactions</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Swap Interface */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Swap</h2>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 text-sm rounded-lg border border-gray-600 hover:bg-gray-700 text-gray-300">
                    ⚙️ Settings
                  </button>
                  <WalletMultiButton className="!bg-primary !rounded-lg !text-black !font-medium" />
                </div>
              </div>

              {/* Swap Form */}
              <div className="space-y-4">
                {/* From Token */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">From</span>
                    <span className="text-sm text-gray-400">
                      Balance: {connected ? '10.5' : '0'} {selectedTokenFrom.symbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-gray-700 rounded-lg px-3 py-2 min-w-[120px] cursor-pointer hover:bg-gray-600">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-black text-xs font-bold">
                        {selectedTokenFrom.symbol[0]}
                      </div>
                      <span className="font-medium text-white">{selectedTokenFrom.symbol}</span>
                      <span className="text-gray-400">▼</span>
                    </div>
                    <input
                      type="number"
                      placeholder="0"
                      value={swapAmount}
                      onChange={(e) => setSwapAmount(e.target.value)}
                      className="flex-1 bg-transparent text-2xl font-medium text-white placeholder-gray-500 border-none outline-none"
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm text-gray-400">
                    <span>${selectedTokenFrom.price.toLocaleString()}</span>
                    <span>~${(parseFloat(swapAmount || '0') * selectedTokenFrom.price).toFixed(2)}</span>
                  </div>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center">
                  <button
                    onClick={swapTokens}
                    className="bg-gray-700 hover:bg-gray-600 rounded-full p-2 border border-gray-600 transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                </div>

                {/* To Token */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">To</span>
                    <span className="text-sm text-gray-400">
                      Balance: {connected ? '1,000' : '0'} {selectedTokenTo.symbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-gray-700 rounded-lg px-3 py-2 min-w-[120px] cursor-pointer hover:bg-gray-600">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-black text-xs font-bold">
                        {selectedTokenTo.symbol[0]}
                      </div>
                      <span className="font-medium text-white">{selectedTokenTo.symbol}</span>
                      <span className="text-gray-400">▼</span>
                    </div>
                    <div className="flex-1 text-2xl font-medium text-white">
                      {calculateOutputAmount()}
                    </div>
                  </div>
                  <div className="flex justify-between mt-2 text-sm text-gray-400">
                    <span>${selectedTokenTo.price.toLocaleString()}</span>
                    <span>~${(parseFloat(calculateOutputAmount()) * selectedTokenTo.price).toFixed(2)}</span>
                  </div>
                </div>

                {/* Swap Details */}
                {swapAmount && (
                  <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Rate</span>
                      <span className="text-white">1 {selectedTokenFrom.symbol} = {(selectedTokenFrom.price / selectedTokenTo.price).toFixed(6)} {selectedTokenTo.symbol}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Price Impact</span>
                      <span className="text-green-400">{'<0.01%'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Fee</span>
                      <span className="text-white">0.3%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Slippage</span>
                      <span className="text-white">{slippage}%</span>
                    </div>
                  </div>
                )}

                {/* Swap Button */}
                <button
                  disabled={!swapAmount || !connected}
                  className="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-700 disabled:text-gray-400 text-black font-semibold py-4 rounded-xl transition-colors"
                >
                  {!connected ? 'Connect Wallet' : !swapAmount ? 'Enter an amount' : 'Swap'}
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Link href="/trading" className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-primary/50 transition-colors group">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">📈</div>
                <h3 className="text-xl font-semibold text-white mb-2">Advanced Trading</h3>
                <p className="text-gray-400 text-sm">Professional trading tools with TradingView charts</p>
              </Link>

              <Link href="/pool" className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-primary/50 transition-colors group">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">💧</div>
                <h3 className="text-xl font-semibold text-white mb-2">Liquidity Pools</h3>
                <p className="text-gray-400 text-sm">Provide liquidity and earn trading fees</p>
              </Link>

              <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-primary/50 transition-colors group cursor-pointer">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">🎯</div>
                <h3 className="text-xl font-semibold text-white mb-2">Limit Orders</h3>
                <p className="text-gray-400 text-sm">Set your target price and trade automatically</p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Top Tokens */}
            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Top Tokens</h3>
              <div className="space-y-3">
                {topTokens.map((token, index) => (
                  <div key={token.address} className="flex items-center justify-between py-2 hover:bg-gray-800/50 rounded-lg px-2 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 w-4">{index + 1}</span>
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black text-sm font-bold">
                        {token.symbol[0]}
                      </div>
                      <div>
                        <div className="font-medium text-white">{token.symbol}</div>
                        <div className="text-xs text-gray-400">{formatNumber(token.marketCap)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-white">${token.price.toLocaleString()}</div>
                      <div className={`text-xs ${token.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {[
                  { type: 'swap', from: 'SOL', to: 'USDC', amount: '2.5', time: '2m ago' },
                  { type: 'swap', from: 'BTC', to: 'SOL', amount: '0.001', time: '5m ago' },
                  { type: 'add', from: 'SOL', to: 'USDC', amount: '10', time: '8m ago' },
                  { type: 'swap', from: 'RAY', to: 'SOL', amount: '100', time: '12m ago' }
                ].map((tx, index) => (
                  <div key={index} className="flex items-center justify-between py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        tx.type === 'swap' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                      }`}>
                        {tx.type === 'swap' ? '↔' : '+'}
                      </div>
                      <span className="text-white">
                        {tx.amount} {tx.from} → {tx.to}
                      </span>
                    </div>
                    <span className="text-gray-400">{tx.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Network Status */}
            <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Network Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">TPS</span>
                  <span className="text-green-400">2,847</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Block Time</span>
                  <span className="text-white">550ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Epoch Progress</span>
                  <span className="text-white">73%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '73%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
