import React from 'react';

interface TradingViewChartProps {
  symbol?: string;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({ symbol = 'SOL/USDT' }) => {
  return (
    <div className="space-y-4">
      {/* Market Stats */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="text-white flex items-center justify-between mb-4">
          <span className="flex items-center gap-2 text-xl font-bold">
            📈 {symbol}
          </span>
          <div className="flex gap-2">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-700 text-gray-100">Live</span>
            <button className="px-3 py-1 text-xs rounded border border-gray-600 hover:bg-gray-700">
              ⚙️
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-400">Price</p>
            <p className="text-lg font-bold text-white">$150.25</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">24h Change</p>
            <p className="text-lg font-bold text-green-400">+2.34%</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">24h High</p>
            <p className="text-lg font-bold text-white">$155.45</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">24h Low</p>
            <p className="text-lg font-bold text-white">$148.67</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">24h Volume</p>
            <p className="text-lg font-bold text-white">$2.1B</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">Market Cap</p>
            <p className="text-lg font-bold text-white">$890.2B</p>
          </div>
        </div>
      </div>

      {/* Chart Controls */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-400">Timeframe:</span>
            {['1m', '5m', '15m', '1H', '4H', '1D', '1W'].map((tf) => (
              <button
                key={tf}
                className="px-3 py-1 text-xs font-medium rounded transition-all bg-gray-700 text-gray-300 hover:bg-gray-600"
              >
                {tf}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2">
            <button className="px-3 py-1 text-xs rounded border border-gray-600 hover:bg-gray-700">
              📥 Export
            </button>
            <button className="px-3 py-1 text-xs rounded border border-gray-600 hover:bg-gray-700">
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6" style={{ height: '500px' }}>
        <div className="h-full flex items-center justify-center bg-gray-800 rounded-lg">
          <div className="text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-white mb-2">TradingView Chart</h3>
            <p className="text-gray-400 mb-4">Professional trading charts for {symbol}</p>
            <p className="text-sm text-gray-500">Chart will load here with real-time data</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingViewChart;
