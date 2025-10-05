import React, { useEffect, useRef, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              📈 {symbol.replace('USDT', '/USDT')}
            </span>
            <div className="flex gap-2">
              <Badge variant="secondary">Live</Badge>
              <Button size="sm" variant="outline" className="text-xs">
                ⚙️
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Chart Controls */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-400">Timeframe:</span>
              {timeframes.map((tf) => (
                <Button
                  key={tf}
                  size="sm"
                  variant={selectedTimeframe === tf ? "default" : "outline"}
                  onClick={() => setSelectedTimeframe(tf)}
                  className="text-xs"
                >
                  {tf}
                </Button>
              ))}
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-400">Type:</span>
              {chartTypes.map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={selectedChartType === type ? "default" : "outline"}
                  onClick={() => setSelectedChartType(type)}
                  className="text-xs capitalize"
                >
                  {type}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs">
                📥 Export
              </Button>
              <Button size="sm" variant="outline" className="text-xs">
                🔄 Refresh
              </Button>
              <Button size="sm" variant="outline" className="text-xs">
                ⛶ Fullscreen
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* TradingView Chart */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
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
        </CardContent>
      </Card>
    </div>
  );
});

TradingViewChart.displayName = 'TradingViewChart';

export default TradingViewChart;
