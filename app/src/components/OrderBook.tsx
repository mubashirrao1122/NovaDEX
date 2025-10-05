import { useTradingContext } from '@/contexts/trading-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';

// Types for order book
interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
  depth: number; // Percentage of total for visualization
}

export default function OrderBook() {
  const { selectedMarket } = useTradingContext();
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [spread, setSpread] = useState<string>('0.00');
  const [spreadPercent, setSpreadPercent] = useState<string>('0.00');
  const [displayDepth, setDisplayDepth] = useState<number>(10); // Number of levels to show
  
  // Generate synthetic order book data based on the selected market
  useEffect(() => {
    if (!selectedMarket) return;
    
    // Generate asks (sell orders)
    const generatedAsks: OrderBookEntry[] = [];
    let askTotal = 0;
    const askStartPrice = selectedMarket.price * 1.001; // Start slightly above mark price
    
    for (let i = 0; i < 20; i++) {
      // Random size between 0.1 and 5 BTC/ETH equivalent
      const baseSize = selectedMarket.baseToken === 'BTC' ? 0.2 : 3;
      const randomSize = baseSize * (0.5 + Math.random());
      const price = askStartPrice * (1 + (i * 0.0005));
      askTotal += randomSize;
      
      generatedAsks.push({
        price,
        size: randomSize,
        total: askTotal,
        depth: 0 // Will be calculated after
      });
    }
    
    // Generate bids (buy orders)
    const generatedBids: OrderBookEntry[] = [];
    let bidTotal = 0;
    const bidStartPrice = selectedMarket.price * 0.999; // Start slightly below mark price
    
    for (let i = 0; i < 20; i++) {
      // Random size between 0.1 and 5 BTC/ETH equivalent
      const baseSize = selectedMarket.baseToken === 'BTC' ? 0.2 : 3;
      const randomSize = baseSize * (0.5 + Math.random());
      const price = bidStartPrice * (1 - (i * 0.0005));
      bidTotal += randomSize;
      
      generatedBids.push({
        price,
        size: randomSize,
        total: bidTotal,
        depth: 0 // Will be calculated after
      });
    }
    
    // Calculate max total for depth visualization
    const maxTotal = Math.max(
      askTotal,
      bidTotal
    );
    
    // Update depth percentages
    const asksWithDepth = generatedAsks.map(ask => ({
      ...ask,
      depth: (ask.total / maxTotal) * 100
    }));
    
    const bidsWithDepth = generatedBids.map(bid => ({
      ...bid,
      depth: (bid.total / maxTotal) * 100
    }));
    
    // Calculate spread
    if (generatedAsks.length > 0 && generatedBids.length > 0) {
      const lowestAsk = generatedAsks[0].price;
      const highestBid = generatedBids[0].price;
      const calculatedSpread = lowestAsk - highestBid;
      const calculatedSpreadPercent = (calculatedSpread / lowestAsk) * 100;
      
      setSpread(calculatedSpread.toFixed(2));
      setSpreadPercent(calculatedSpreadPercent.toFixed(3));
    }
    
    setAsks(asksWithDepth);
    setBids(bidsWithDepth);
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      // Randomly update some orders
      if (Math.random() > 0.7 && bids.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(bids.length, 5));
        const newBids = [...bids];
        const randomDelta = (Math.random() - 0.5) * 0.2;
        
        // Ensure the randomIndex is valid and the element exists
        if (randomIndex < newBids.length && newBids[randomIndex]) {
          newBids[randomIndex] = {
            ...newBids[randomIndex],
            size: Math.max(0.01, newBids[randomIndex].size + randomDelta)
          };
          
          // Recalculate totals and depths
          let runningTotal = 0;
          for (let i = 0; i < newBids.length; i++) {
            runningTotal += newBids[i].size;
            newBids[i].total = runningTotal;
          }
          
          setBids(newBids);
        }
      }
      
      if (Math.random() > 0.7 && asks.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(asks.length, 5));
        const newAsks = [...asks];
        const randomDelta = (Math.random() - 0.5) * 0.2;
        
        // Ensure the randomIndex is valid and the element exists
        if (randomIndex < newAsks.length && newAsks[randomIndex]) {
          newAsks[randomIndex] = {
            ...newAsks[randomIndex],
            size: Math.max(0.01, newAsks[randomIndex].size + randomDelta)
          };
          
          // Recalculate totals and depths
          let runningTotal = 0;
          for (let i = 0; i < newAsks.length; i++) {
            runningTotal += newAsks[i].size;
            newAsks[i].total = runningTotal;
          }
          
          setAsks(newAsks);
        }
      }
    }, 1500);
    
    return () => clearInterval(interval);
  }, [selectedMarket]);

  if (!selectedMarket) {
    return null;
  }
  
  // Helper for formatting numbers
  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toFixed(decimals);
  };

  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Order Book</span>
          <div className="text-xs font-normal">
            <span className="mr-1 text-muted-foreground">Spread:</span> 
            <span>${spread}</span>
            <span className="ml-1 text-muted-foreground">({spreadPercent}%)</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="px-4 py-2">
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>Price</div>
            <div className="text-right">Size ({selectedMarket.baseToken})</div>
            <div className="text-right">Total</div>
          </div>
        </div>
        
        {/* Asks (Sells) */}
        <div className="max-h-[220px] overflow-y-auto px-4">
          {asks.slice(0, displayDepth).map((ask, index) => (
            <div key={`ask-${index}`} className="relative grid grid-cols-3 gap-2 py-[2px] text-xs">
              <div 
                className="absolute right-0 top-0 h-full bg-danger/10"
                style={{ width: `${ask.depth}%` }}
              />
              <div className="relative text-danger">
                {formatNumber(ask.price)}
              </div>
              <div className="relative text-right">
                {formatNumber(ask.size)}
              </div>
              <div className="relative text-right">
                {formatNumber(ask.total)}
              </div>
            </div>
          ))}
        </div>
        
        {/* Current Price */}
        <div className="bg-accent/30 px-4 py-2 text-center font-semibold">
          <span className="mr-1 text-muted-foreground text-xs">Current Price:</span>
          ${selectedMarket.price.toFixed(2)}
        </div>
        
        {/* Bids (Buys) */}
        <div className="max-h-[220px] overflow-y-auto px-4">
          {bids.slice(0, displayDepth).map((bid, index) => (
            <div key={`bid-${index}`} className="relative grid grid-cols-3 gap-2 py-[2px] text-xs">
              <div 
                className="absolute right-0 top-0 h-full bg-success/10"
                style={{ width: `${bid.depth}%` }}
              />
              <div className="relative text-success">
                {formatNumber(bid.price)}
              </div>
              <div className="relative text-right">
                {formatNumber(bid.size)}
              </div>
              <div className="relative text-right">
                {formatNumber(bid.total)}
              </div>
            </div>
          ))}
        </div>
        
        {/* Depth Controls */}
        <div className="flex items-center justify-between border-t border-border bg-card p-2">
          <button 
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setDisplayDepth(10)}
          >
            10
          </button>
          <button 
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setDisplayDepth(15)}
          >
            15
          </button>
          <button 
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setDisplayDepth(20)}
          >
            20
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
