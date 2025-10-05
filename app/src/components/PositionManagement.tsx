import { useTradingContext } from '@/contexts/trading-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { Clock, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

export default function PositionManagement() {
  const { positions, closePosition, updatePositionLeverage } = useTradingContext();
  const [expandedPosition, setExpandedPosition] = useState<string | null>(null);

  // Toggle position details
  const togglePosition = (positionId: string) => {
    if (expandedPosition === positionId) {
      setExpandedPosition(null);
    } else {
      setExpandedPosition(positionId);
    }
  };

  // Close a position
  const handleClosePosition = async (positionId: string) => {
    await closePosition(positionId);
  };

  // Calculate PnL percentage
  const calculatePnlPercentage = (position: any) => {
    const investment = position.margin;
    return ((position.pnl / investment) * 100).toFixed(2);
  };

  // Format timestamp to date and time
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Open Positions</span>
          <span className="text-sm font-normal text-muted-foreground">
            {positions.length} Active
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <p>No open positions</p>
            <p className="text-sm">Open a position to start trading</p>
          </div>
        ) : (
          <div className="space-y-4">
            {positions.map((position) => (
              <div key={position.id} className="rounded-lg border border-border">
                {/* Position Header */}
                <div 
                  className="flex cursor-pointer items-center justify-between p-3"
                  onClick={() => togglePosition(position.id)}
                >
                  <div className="flex items-center">
                    <div 
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        position.side === 'long' ? 'bg-success/10' : 'bg-danger/10'
                      }`}
                    >
                      {position.side === 'long' ? (
                        <TrendingUp className={`h-4 w-4 text-success`} />
                      ) : (
                        <TrendingDown className={`h-4 w-4 text-danger`} />
                      )}
                    </div>
                    <div className="ml-3">
                      <div className="font-medium">{position.pair}</div>
                      <div className="text-xs text-muted-foreground">
                        {position.side === 'long' ? 'Long' : 'Short'} · {position.leverage}x
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${position.pnl >= 0 ? 'text-success' : 'text-danger'}`}>
                      ${position.pnl.toFixed(2)} ({position.pnl >= 0 ? '+' : ''}
                      {calculatePnlPercentage(position)}%)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {position.size.toFixed(4)} {position.pair.split('-')[0]} · ${(position.size * position.entryPrice).toFixed(2)}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Position Details */}
                {expandedPosition === position.id && (
                  <>
                    <Separator />
                    <div className="p-3">
                      <div className="mb-3 grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground">Entry Price</div>
                          <div className="font-medium">${position.entryPrice.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Liquidation Price</div>
                          <div className="font-medium">
                            ${position.liquidationPrice.toFixed(2)}
                            {(position.side === 'long' && position.entryPrice / position.liquidationPrice < 1.05) ||
                            (position.side === 'short' && position.liquidationPrice / position.entryPrice < 1.05) ? (
                              <AlertTriangle className="ml-1 inline h-3 w-3 text-warning" />
                            ) : null}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Margin</div>
                          <div className="font-medium">${position.margin.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Funding Paid</div>
                          <div className={`font-medium ${position.fundingPaid <= 0 ? 'text-success' : 'text-danger'}`}>
                            {position.fundingPaid <= 0 ? '+' : '-'}${Math.abs(position.fundingPaid).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="mr-1 h-3 w-3" />
                        Opened {formatTimestamp(position.timestamp)}
                      </div>
                      
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleClosePosition(position.id)}>
                          Close Position
                        </Button>
                        <Button 
                          variant={position.side === 'long' ? 'primary' : 'danger'} 
                          size="sm"
                        >
                          Edit Position
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
