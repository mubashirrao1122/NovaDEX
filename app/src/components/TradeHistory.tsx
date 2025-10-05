import { useTradingContext } from '@/contexts/trading-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';

interface Trade {
  id: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export default function TradeHistory() {
  const { selectedMarket } = useTradingContext();
  const [trades, setTrades] = useState<Trade[]>([]);

  // Generate synthetic trade history data based on the selected market
  useEffect(() => {
    if (!selectedMarket) return;
    
    // Initial set of trades
    const initialTrades: Trade[] = [];
    const baseTime = Date.now();
    
    // Generate some initial trades
    for (let i = 0; i < 30; i++) {
      const isBuy = Math.random() > 0.5;
      const sizeMultiplier = selectedMarket.baseToken === 'BTC' ? 0.05 : 0.5;
      const randomSize = (0.1 + Math.random() * 0.9) * sizeMultiplier;
      
      // Price deviation +/- 0.2%
      const priceDeviation = (Math.random() * 0.4 - 0.2) / 100;
      const price = selectedMarket.price * (1 + priceDeviation);
      
      initialTrades.push({
        id: `trade-${baseTime - i * 5000}-${Math.random()}`,
        price,
        size: randomSize,
        side: isBuy ? 'buy' : 'sell',
        timestamp: baseTime - i * 5000
      });
    }
    
    setTrades(initialTrades);
    
    // Simulate real-time trade updates
    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        const isBuy = Math.random() > 0.5;
        const sizeMultiplier = selectedMarket.baseToken === 'BTC' ? 0.05 : 0.5;
        const randomSize = (0.1 + Math.random() * 0.9) * sizeMultiplier;
        
        // Price deviation +/- 0.1%
        const priceDeviation = (Math.random() * 0.2 - 0.1) / 100;
        let price = selectedMarket.price * (1 + priceDeviation);
        
        // Make price slightly higher for sells and lower for buys to create a realistic pattern
        if (isBuy) {
          price *= 1.0001;
        } else {
          price *= 0.9999;
        }
        
        const newTrade = {
          id: `trade-${Date.now()}-${Math.random()}`,
          price,
          size: randomSize,
          side: isBuy ? 'buy' : 'sell',
          timestamp: Date.now()
        };
        
        setTrades(prevTrades => [newTrade, ...prevTrades.slice(0, 49)]);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [selectedMarket]);

  if (!selectedMarket) {
    return null;
  }
  
  // Format timestamp to time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="text-base">Recent Trades</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 py-2">
          <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
            <div>Price</div>
            <div className="text-right">Size</div>
            <div className="text-right">Value</div>
            <div className="text-right">Time</div>
          </div>
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          {trades.map((trade) => (
            <div 
              key={trade.id}
              className={`grid grid-cols-4 gap-2 border-t border-border px-4 py-[3px] text-xs ${
                trade.side === 'buy' ? 'text-success' : 'text-danger'
              }`}
            >
              <div>{trade.price.toFixed(2)}</div>
              <div className="text-right">{trade.size.toFixed(4)}</div>
              <div className="text-right">${(trade.price * trade.size).toFixed(2)}</div>
              <div className="text-right text-muted-foreground">{formatTime(trade.timestamp)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
