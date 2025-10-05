import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Activity,
  Settings,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff
} from 'lucide-react';

interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TechnicalIndicator {
  id: string;
  name: string;
  shortName: string;
  isEnabled: boolean;
  color: string;
  values: number[];
  settings?: any;
}

interface AdvancedChartProps {
  symbol: string;
  interval: string;
  onIntervalChange?: (interval: string) => void;
}

const AdvancedChart: React.FC<AdvancedChartProps> = ({
  symbol = 'BTC-USDC',
  interval = '1h',
  onIntervalChange
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [indicators, setIndicators] = useState<TechnicalIndicator[]>([]);
  const [selectedInterval, setSelectedInterval] = useState(interval);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');

  const intervals = [
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '15m', label: '15m' },
    { value: '1h', label: '1h' },
    { value: '4h', label: '4h' },
    { value: '1d', label: '1D' },
    { value: '1w', label: '1W' }
  ];

  // Initialize mock data and indicators
  useEffect(() => {
    // Generate mock candlestick data
    const now = Date.now();
    const mockData: CandleData[] = [];
    let price = 58000; // Starting BTC price

    for (let i = 100; i >= 0; i--) {
      const timestamp = now - (i * 3600000); // 1 hour intervals
      const open = price;
      const volatility = 0.02; // 2% volatility
      const change = (Math.random() - 0.5) * volatility * price;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 0.01 * price;
      const low = Math.min(open, close) - Math.random() * 0.01 * price;
      const volume = Math.random() * 1000 + 500;

      mockData.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume
      });

      price = close;
    }

    setCandleData(mockData);

    // Initialize technical indicators
    const initialIndicators: TechnicalIndicator[] = [
      {
        id: 'sma20',
        name: 'Simple Moving Average (20)',
        shortName: 'SMA(20)',
        isEnabled: true,
        color: '#3b82f6',
        values: calculateSMA(mockData.map(d => d.close), 20)
      },
      {
        id: 'sma50',
        name: 'Simple Moving Average (50)',
        shortName: 'SMA(50)',
        isEnabled: true,
        color: '#f59e0b',
        values: calculateSMA(mockData.map(d => d.close), 50)
      },
      {
        id: 'ema12',
        name: 'Exponential Moving Average (12)',
        shortName: 'EMA(12)',
        isEnabled: false,
        color: '#10b981',
        values: calculateEMA(mockData.map(d => d.close), 12)
      },
      {
        id: 'bb',
        name: 'Bollinger Bands',
        shortName: 'BB(20,2)',
        isEnabled: false,
        color: '#8b5cf6',
        values: calculateBollingerBands(mockData.map(d => d.close), 20, 2).middle
      },
      {
        id: 'rsi',
        name: 'Relative Strength Index',
        shortName: 'RSI(14)',
        isEnabled: true,
        color: '#ef4444',
        values: calculateRSI(mockData.map(d => d.close), 14)
      }
    ];

    setIndicators(initialIndicators);
  }, [symbol, selectedInterval]);

  // Technical indicator calculations
  const calculateSMA = (prices: number[], period: number): number[] => {
    const sma: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(NaN);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  };

  const calculateEMA = (prices: number[], period: number): number[] => {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    for (let i = 0; i < prices.length; i++) {
      if (i === 0) {
        ema.push(prices[i]);
      } else {
        ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
      }
    }
    return ema;
  };

  const calculateRSI = (prices: number[], period: number): number[] => {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    for (let i = 0; i < gains.length; i++) {
      if (i < period - 1) {
        rsi.push(NaN);
      } else {
        const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }

    return [NaN, ...rsi]; // Add NaN for first price point
  };

  const calculateBollingerBands = (prices: number[], period: number, stdDev: number) => {
    const sma = calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upper.push(NaN);
        lower.push(NaN);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma[i], 2), 0) / period;
        const standardDeviation = Math.sqrt(variance);
        
        upper.push(sma[i] + (standardDeviation * stdDev));
        lower.push(sma[i] - (standardDeviation * stdDev));
      }
    }

    return { upper, middle: sma, lower };
  };

  const toggleIndicator = (indicatorId: string) => {
    setIndicators(prev => 
      prev.map(indicator => 
        indicator.id === indicatorId 
          ? { ...indicator, isEnabled: !indicator.isEnabled }
          : indicator
      )
    );
  };

  const handleIntervalChange = (newInterval: string) => {
    setSelectedInterval(newInterval);
    onIntervalChange?.(newInterval);
  };

  const formatPrice = (price: number): string => {
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const currentPrice = candleData.length > 0 ? candleData[candleData.length - 1].close : 0;
  const priceChange = candleData.length > 1 
    ? candleData[candleData.length - 1].close - candleData[candleData.length - 2].close
    : 0;
  const priceChangePercent = candleData.length > 1 
    ? (priceChange / candleData[candleData.length - 2].close) * 100
    : 0;

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-background p-4' : ''}`}>
      {/* Chart Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  {symbol}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">{formatPrice(currentPrice)}</span>
                  <Badge variant={priceChange >= 0 ? 'default' : 'destructive'}>
                    {priceChange >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {formatPrice(Math.abs(priceChange))} ({priceChangePercent.toFixed(2)}%)
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Interval Selector */}
              <div className="flex rounded-md border border-border">
                {intervals.map((intervalOption) => (
                  <Button
                    key={intervalOption.value}
                    variant={selectedInterval === intervalOption.value ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none first:rounded-l-md last:rounded-r-md"
                    onClick={() => handleIntervalChange(intervalOption.value)}
                  >
                    {intervalOption.label}
                  </Button>
                ))}
              </div>

              {/* Chart Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChartType(chartType === 'candlestick' ? 'line' : 'candlestick')}
              >
                <Activity className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVolume(!showVolume)}
              >
                {showVolume ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Chart */}
      <Card className="flex-1">
        <CardContent className="p-0">
          <div className={`bg-card rounded-lg ${isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-[500px]'} flex items-center justify-center border border-border`}>
            <div className="text-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Advanced TradingView Chart</h3>
              <p className="text-muted-foreground text-sm max-w-md">
                This would integrate with TradingView Charting Library or a custom charting solution 
                to display {chartType} charts with {showVolume ? 'volume' : 'no volume'} for {symbol} 
                at {selectedInterval} intervals.
              </p>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground">Active Indicators:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {indicators.filter(i => i.isEnabled).map(indicator => (
                    <Badge key={indicator.id} variant="outline" style={{ borderColor: indicator.color }}>
                      {indicator.shortName}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Indicators Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Technical Indicators
          </CardTitle>
          <CardDescription>
            Add and configure technical analysis indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {indicators.map((indicator) => (
              <div
                key={indicator.id}
                className={`rounded-lg border p-4 cursor-pointer transition-all ${
                  indicator.isEnabled
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => toggleIndicator(indicator.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{indicator.shortName}</h4>
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: indicator.isEnabled ? indicator.color : '#64748b' }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{indicator.name}</p>
                <div className="mt-2">
                  <Badge variant={indicator.isEnabled ? 'default' : 'secondary'}>
                    {indicator.isEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <h4 className="font-semibold mb-2">Chart Features</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-success rounded-full" />
                <span>Real-time Data</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-primary rounded-full" />
                <span>Multiple Timeframes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-warning rounded-full" />
                <span>Drawing Tools</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-secondary rounded-full" />
                <span>Price Alerts</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedChart;
