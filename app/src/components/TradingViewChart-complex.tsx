import React, { useEffect, useRef, memo } from 'react';

interface TradingViewChartProps {
  symbol?: string;
  interval?: string;
  theme?: 'light' | 'dark';
  onSymbolChange?: (symbol: string) => void;
  onIntervalChange?: (interval: string) => void;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

const TradingViewChart: React.FC<TradingViewChartProps> = memo(({ 
  symbol = 'BTCUSDT',
  interval = '1h',
  theme = 'dark'
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  // Market data state
  const [marketData, setMarketData] = React.useState({
    price: '$45,234.56',
    change24h: '+2.34%',
    high24h: '$46,123.45',
    low24h: '$44,567.89',
    volume24h: '$2.1B',
    marketCap: '$890.2B'
  });

  const [selectedTimeframe, setSelectedTimeframe] = React.useState('1H');
  const [selectedChartType, setSelectedChartType] = React.useState('candlestick');

  const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D', '1W'];
  const chartTypes = ['candlestick', 'line', 'area', 'bar'];

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clear previous widget
    if (widgetRef.current) {
      chartContainerRef.current.innerHTML = '';
    }

    // Load TradingView script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: "Etc/UTC",
      theme: theme,
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com"
    });

    if (chartContainerRef.current) {
      chartContainerRef.current.appendChild(script);
    }

    return () => {
      if (chartContainerRef.current) {
        chartContainerRef.current.innerHTML = '';
      }
    };
  }, [symbol, interval, theme]);

  return (
    <div className="space-y-4">
      {/* Market Stats */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="text-white flex items-center justify-between mb-4">
          <span className="flex items-center gap-2 text-xl font-bold">
            📈 {symbol.replace('USDT', '/USDT')}
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
            <p className="text-lg font-bold text-white">{marketData.price}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">24h Change</p>
            <p className="text-lg font-bold text-green-400">{marketData.change24h}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">24h High</p>
            <p className="text-lg font-bold text-white">{marketData.high24h}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">24h Low</p>
            <p className="text-lg font-bold text-white">{marketData.low24h}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">24h Volume</p>
            <p className="text-lg font-bold text-white">{marketData.volume24h}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-400">Market Cap</p>
            <p className="text-lg font-bold text-white">{marketData.marketCap}</p>
          </div>
        </div>
      </div>

      {/* Chart Controls */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-400">Timeframe:</span>
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                  selectedTimeframe === tf 
                    ? 'bg-primary text-black' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-400">Type:</span>
            {chartTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedChartType(type)}
                className={`px-3 py-1 text-xs font-medium rounded capitalize transition-all ${
                  selectedChartType === type 
                    ? 'bg-primary text-black' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {type}
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
            <button className="px-3 py-1 text-xs rounded border border-gray-600 hover:bg-gray-700">
              ⛶ Fullscreen
            </button>
          </div>
        </div>
      </div>

      {/* TradingView Chart */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div 
          ref={chartContainerRef}
          className="tradingview-widget-container"
          style={{ height: '600px', width: '100%' }}
        >
          <div className="tradingview-widget-container__widget"></div>
          <div className="tradingview-widget-copyright">
            <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
              <span className="blue-text">Track all markets on TradingView</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
});

TradingViewChart.displayName = 'TradingViewChart';

export default TradingViewChart;
