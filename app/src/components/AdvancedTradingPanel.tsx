import { useTradingContext } from '@/contexts/trading-context';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowUp, ArrowDown, Info, AlertTriangle } from 'lucide-react';

export default function AdvancedTradingPanel() {
  const {
    selectedMarket,
    leverage,
    setLeverage,
    marginType,
    setMarginType,
    slippage,
    setSlippage,
    orderType,
    setOrderType,
    openPosition,
  } = useTradingContext();

  const [side, setSide] = useState<'long' | 'short'>('long');
  const [amount, setAmount] = useState<string>('');
  const [limitPrice, setLimitPrice] = useState<string>('');

  // Calculate USD value based on amount and current price
  const usdValue = selectedMarket && amount 
    ? (parseFloat(amount) * selectedMarket.price).toFixed(2)
    : '0.00';

  // Calculate margin required based on leverage
  const marginRequired = selectedMarket && amount
    ? (parseFloat(amount) * selectedMarket.price / leverage).toFixed(2)
    : '0.00';

  // Calculate liquidation price
  const liquidationPrice = selectedMarket && amount
    ? calculateLiquidationPrice(
        side, 
        selectedMarket.price,
        leverage,
        0.05 // 5% maintenance margin
      ).toFixed(2)
    : '0.00';

  function calculateLiquidationPrice(
    side: 'long' | 'short',
    entryPrice: number,
    leverage: number,
    maintenanceMargin: number
  ): number {
    if (side === 'long') {
      return entryPrice * (1 - ((1 - maintenanceMargin) / leverage));
    } else {
      return entryPrice * (1 + ((1 - maintenanceMargin) / leverage));
    }
  }

  const handlePositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMarket || !amount) return;
    
    const size = parseFloat(amount);
    const price = orderType === 'market' ? undefined : parseFloat(limitPrice);
    
    await openPosition(side, size, price);
    
    // Reset form
    setAmount('');
    setLimitPrice('');
  };

  const handleLeverageChange = (newLeverage: number) => {
    if (newLeverage >= 1 && newLeverage <= 20) {
      setLeverage(newLeverage);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {selectedMarket?.pair} Perpetual
        </CardTitle>
        <CardDescription>
          Mark: ${selectedMarket?.markPrice.toFixed(2)} | 
          Index: ${selectedMarket?.indexPrice.toFixed(2)} | 
          Funding: {(selectedMarket?.fundingRate || 0) * 100}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePositionSubmit}>
          {/* Position Direction */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={side === 'long' ? 'primary' : 'outline'}
              onClick={() => setSide('long')}
              className={side === 'long' ? '' : 'text-muted-foreground'}
            >
              <ArrowUp className="mr-2 h-4 w-4" />
              Long
            </Button>
            <Button
              type="button"
              variant={side === 'short' ? 'danger' : 'outline'}
              onClick={() => setSide('short')}
              className={side === 'short' ? '' : 'text-muted-foreground'}
            >
              <ArrowDown className="mr-2 h-4 w-4" />
              Short
            </Button>
          </div>

          {/* Order Types */}
          <div className="mb-6">
            <Label htmlFor="orderType">Order Type</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={orderType === 'market' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setOrderType('market')}
              >
                Market
              </Button>
              <Button
                type="button"
                variant={orderType === 'limit' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setOrderType('limit')}
              >
                Limit
              </Button>
              <Button
                type="button"
                variant={orderType === 'stop' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setOrderType('stop')}
              >
                Stop
              </Button>
              <Button
                type="button"
                variant={orderType === 'take-profit' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setOrderType('take-profit')}
              >
                Take Profit
              </Button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-6">
            <Label htmlFor="amount">
              Amount ({selectedMarket?.baseToken})
            </Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              min="0.001"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-2"
            />
            <div className="mt-1 text-right text-sm text-muted-foreground">
              ≈ ${usdValue} USDC
            </div>
          </div>

          {/* Limit Price (conditional) */}
          {orderType !== 'market' && (
            <div className="mb-6">
              <Label htmlFor="limitPrice">
                {orderType === 'limit' ? 'Limit' : orderType === 'stop' ? 'Stop' : 'Take Profit'} Price
              </Label>
              <Input
                id="limitPrice"
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="mt-2"
              />
            </div>
          )}

          {/* Leverage Slider */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="leverage">Leverage (up to 20x)</Label>
              <span className="text-sm font-medium">{leverage}x</span>
            </div>
            <div className="flex items-center">
              <Button 
                type="button"
                variant="outline" 
                size="sm" 
                onClick={() => handleLeverageChange(leverage - 1)}
                disabled={leverage <= 1}
              >
                -
              </Button>
              <input
                type="range"
                min="1"
                max="20"
                value={leverage}
                onChange={(e) => handleLeverageChange(parseInt(e.target.value))}
                className="mx-2 h-2 flex-1 rounded-lg bg-accent"
              />
              <Button 
                type="button"
                variant="outline" 
                size="sm" 
                onClick={() => handleLeverageChange(leverage + 1)}
                disabled={leverage >= 20}
              >
                +
              </Button>
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>1x</span>
              <span>5x</span>
              <span>10x</span>
              <span>15x</span>
              <span>20x</span>
            </div>
          </div>

          {/* Margin Type */}
          <div className="mb-6">
            <Label>Margin Type</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={marginType === 'isolated' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setMarginType('isolated')}
              >
                Isolated
              </Button>
              <Button
                type="button"
                variant={marginType === 'cross' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setMarginType('cross')}
              >
                Cross
              </Button>
            </div>
            <div className="mt-1 flex items-center text-xs text-muted-foreground">
              <Info className="mr-1 h-3 w-3" />
              {marginType === 'isolated' 
                ? 'Isolated margin is limited to the position amount' 
                : 'Cross margin uses your entire account balance'}
            </div>
          </div>

          {/* Position Info */}
          <div className="mb-6 rounded-lg bg-accent/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Margin Required</span>
              <span className="text-sm">
                ${marginRequired} USDC
              </span>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Liquidation Price</span>
              <span className="text-sm">
                ${liquidationPrice}
              </span>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Funding Rate (8h)</span>
              <span className={`text-sm ${selectedMarket?.fundingRate && selectedMarket.fundingRate < 0 ? 'text-success' : selectedMarket?.fundingRate && selectedMarket.fundingRate > 0 ? 'text-danger' : ''}`}>
                {selectedMarket?.fundingRate ? (selectedMarket.fundingRate * 100).toFixed(4) : '0.0000'}%
              </span>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Max Slippage</span>
              <span className="text-sm">
                {slippage}%
              </span>
            </div>
          </div>

          {/* High Leverage Warning */}
          {leverage >= 10 && (
            <div className="mb-6 flex items-start rounded-lg bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mr-2 h-5 w-5 flex-shrink-0 text-warning" />
              <div>
                <p className="font-medium text-warning">High Leverage Warning</p>
                <p className="mt-1 text-muted-foreground">
                  Using high leverage increases liquidation risk. Ensure you understand the risks before proceeding.
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant={side === 'long' ? 'primary' : 'danger'}
            size="lg"
            className="w-full"
            disabled={!amount || (orderType !== 'market' && !limitPrice)}
          >
            {side === 'long' ? 'Open Long Position' : 'Open Short Position'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
