import { useTradingContext } from '@/contexts/trading-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Clock, DollarSign, PieChart } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function MarketMetrics() {
  const { selectedMarket } = useTradingContext();
  const [timeToNextFunding, setTimeToNextFunding] = useState<string>('');
  
  // Update countdown timer to next funding
  useEffect(() => {
    if (!selectedMarket) return;
    
    const updateTimer = () => {
      const now = Date.now();
      const timeLeft = selectedMarket.nextFundingTime - now;
      
      if (timeLeft <= 0) {
        setTimeToNextFunding('Now');
        return;
      }
      
      const hours = Math.floor(timeLeft / 3600000);
      const minutes = Math.floor((timeLeft % 3600000) / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      
      setTimeToNextFunding(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [selectedMarket]);
  
  if (!selectedMarket) {
    return null;
  }
  
  // Calculate long/short ratio
  const totalOI = selectedMarket.longOI + selectedMarket.shortOI;
  const longRatio = totalOI > 0 ? (selectedMarket.longOI / totalOI) * 100 : 50;
  const shortRatio = totalOI > 0 ? (selectedMarket.shortOI / totalOI) * 100 : 50;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Market Metrics</span>
          <span className="text-sm font-normal">{selectedMarket.pair}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Price Change */}
          <div className="rounded-lg bg-accent/30 p-3">
            <div className="mb-2 flex items-center">
              {selectedMarket.priceChange24h >= 0 ? (
                <TrendingUp className="mr-2 h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="mr-2 h-4 w-4 text-danger" />
              )}
              <span className="text-xs text-muted-foreground">24h Change</span>
            </div>
            <div className={`text-lg font-semibold ${
              selectedMarket.priceChange24h >= 0 ? 'text-success' : 'text-danger'
            }`}>
              {selectedMarket.priceChange24h >= 0 ? '+' : ''}
              {selectedMarket.priceChange24h.toFixed(2)}%
            </div>
          </div>
          
          {/* 24h Volume */}
          <div className="rounded-lg bg-accent/30 p-3">
            <div className="mb-2 flex items-center">
              <DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">24h Volume</span>
            </div>
            <div className="text-lg font-semibold">
              ${(selectedMarket.volume24h / 1000000).toFixed(2)}M
            </div>
          </div>
        </div>
        
        {/* Price Information */}
        <div className="rounded-lg bg-accent/30 p-3">
          <div className="mb-1 flex items-center">
            <span className="text-xs text-muted-foreground">Price Information</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-xs text-muted-foreground">Mark</div>
              <div className="font-medium">${selectedMarket.markPrice.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Index</div>
              <div className="font-medium">${selectedMarket.indexPrice.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Premium</div>
              <div className={`font-medium ${
                selectedMarket.markPrice > selectedMarket.indexPrice ? 'text-success' : 'text-danger'
              }`}>
                {((selectedMarket.markPrice / selectedMarket.indexPrice - 1) * 100).toFixed(3)}%
              </div>
            </div>
          </div>
        </div>
        
        {/* Funding Rate */}
        <div className="rounded-lg bg-accent/30 p-3">
          <div className="mb-1 flex items-center">
            <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Funding Information</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-muted-foreground">Current Rate (8h)</div>
              <div className={`font-medium ${
                selectedMarket.fundingRate >= 0 ? 'text-success' : 'text-danger'
              }`}>
                {(selectedMarket.fundingRate * 100).toFixed(4)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Next Funding</div>
              <div className="font-medium">{timeToNextFunding}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {selectedMarket.fundingRate >= 0 
              ? 'Longs pay shorts' 
              : 'Shorts pay longs'}
          </div>
        </div>
        
        {/* Open Interest */}
        <div className="rounded-lg bg-accent/30 p-3">
          <div className="mb-1 flex items-center">
            <PieChart className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Open Interest</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-medium">
                ${(totalOI / 1000000).toFixed(2)}M
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Long/Short Ratio</div>
              <div className="font-medium">
                {(longRatio / shortRatio).toFixed(2)}
              </div>
            </div>
          </div>
          
          {/* Long/Short bar */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background">
            <div 
              className="h-full bg-success" 
              style={{ width: `${longRatio}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-success">Long {longRatio.toFixed(1)}%</span>
            <span className="text-danger">Short {shortRatio.toFixed(1)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
