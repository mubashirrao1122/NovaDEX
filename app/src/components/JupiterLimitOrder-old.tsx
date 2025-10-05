import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

interface JupiterLimitOrderProps {
  onOrderSubmit?: (order: any) => void;
}

interface Token {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  logo: string;
  balance: number;
}

const JupiterLimitOrder: React.FC<JupiterLimitOrderProps> = ({
  onOrderSubmit
}) => {
  const [fromToken, setFromToken] = useState<Token>({
    symbol: 'SOL',
    name: 'Solana',
    price: 98.75,
    change24h: -3.1,
    logo: '🟣',
    balance: 12.5
  });

  const [toToken, setToToken] = useState<Token>({
    symbol: 'USDC',
    name: 'USD Coin',
    price: 1.00,
    change24h: 0.0,
    logo: '💵',
    balance: 1250.75
  });

  const [fromAmount, setFromAmount] = useState<string>('');
  const [toAmount, setToAmount] = useState<string>('');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(0.5);
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'dca'>('limit');
  const [expiry, setExpiry] = useState<string>('1h');
  const [isAdvanced, setIsAdvanced] = useState(false);

  // Jupiter-style features
  const [routeInfo, setRouteInfo] = useState({
    bestRoute: 'Jupiter > Orca > Raydium',
    priceImpact: '0.12%',
    minimumReceived: '0',
    networkFee: '0.00025 SOL',
    platformFee: '0.1%'
  });

  const [orderStatus, setOrderStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (fromAmount && limitPrice) {
      const calculatedToAmount = (parseFloat(fromAmount) * parseFloat(limitPrice)).toFixed(6);
      setToAmount(calculatedToAmount);
      setRouteInfo(prev => ({
        ...prev,
        minimumReceived: (parseFloat(calculatedToAmount) * (1 - slippage / 100)).toFixed(6)
      }));
    }
  }, [fromAmount, limitPrice, slippage]);

  const expiryOptions = [
    { label: '1 Hour', value: '1h' },
    { label: '24 Hours', value: '24h' },
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: 'Never', value: 'never' }
  ];

  const slippageOptions = [0.1, 0.5, 1.0, 3.0];

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleSubmitOrder = async () => {
    setOrderStatus('loading');
    
    const order = {
      type: orderType,
      fromToken: fromToken.symbol,
      toToken: toToken.symbol,
      fromAmount: parseFloat(fromAmount),
      toAmount: parseFloat(toAmount),
      limitPrice: parseFloat(limitPrice),
      slippage,
      expiry,
      timestamp: Date.now()
    };

    // Simulate API call
    setTimeout(() => {
      setOrderStatus('success');
      onOrderSubmit?.(order);
      
      // Reset form after success
      setTimeout(() => {
        setOrderStatus('idle');
        setFromAmount('');
        setToAmount('');
        setLimitPrice('');
      }, 2000);
    }, 1500);
  };

  const isValidOrder = fromAmount && toAmount && limitPrice && parseFloat(fromAmount) > 0;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">Jupiter Limit Orders</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAdvanced(!isAdvanced)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <Zap className="h-3 w-3 mr-1" />
              Jupiter
            </Badge>
          </div>
        </div>

        {/* Order Type Selection */}
        <div className="flex gap-1 p-1 bg-accent/50 rounded-lg">
          {[
            { type: 'market', label: 'Market', icon: TrendingUp },
            { type: 'limit', label: 'Limit', icon: Target },
            { type: 'dca', label: 'DCA', icon: Clock }
          ].map((option) => (
            <Button
              key={option.type}
              variant={orderType === option.type ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setOrderType(option.type as any)}
              className="flex-1 h-8"
            >
              <option.icon className="h-3 w-3 mr-1" />
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">You Pay</label>
            <span className="text-xs text-muted-foreground">
              Balance: {fromToken.balance} {fromToken.symbol}
            </span>
          </div>
          
          <div className="relative">
            <div className="flex items-center gap-2 p-3 bg-accent/30 rounded-xl border border-border/50">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-2xl">{fromToken.logo}</span>
                <div>
                  <p className="font-semibold">{fromToken.symbol}</p>
                  <p className="text-xs text-muted-foreground">{fromToken.name}</p>
                </div>
              </div>
              <div className="text-right flex-1">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="text-right border-none bg-transparent text-lg font-semibold p-0 h-auto"
                />
                <p className="text-xs text-muted-foreground">
                  ${(parseFloat(fromAmount || '0') * fromToken.price).toFixed(2)}
                </p>
              </div>
            </div>
            
            {/* Quick Amount Buttons */}
            <div className="flex gap-1 mt-2">
              {[25, 50, 75, 100].map((percentage) => (
                <Button
                  key={percentage}
                  variant="outline"
                  size="sm"
                  onClick={() => setFromAmount(((fromToken.balance * percentage) / 100).toFixed(6))}
                  className="h-6 px-2 text-xs"
                >
                  {percentage}%
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwapTokens}
            className="rounded-full p-2 h-8 w-8"
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">You Receive</label>
            <span className="text-xs text-muted-foreground">
              Balance: {toToken.balance} {toToken.symbol}
            </span>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-accent/30 rounded-xl border border-border/50">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-2xl">{toToken.logo}</span>
              <div>
                <p className="font-semibold">{toToken.symbol}</p>
                <p className="text-xs text-muted-foreground">{toToken.name}</p>
              </div>
            </div>
            <div className="text-right flex-1">
              <Input
                type="number"
                placeholder="0.00"
                value={toAmount}
                onChange={(e) => setToAmount(e.target.value)}
                className="text-right border-none bg-transparent text-lg font-semibold p-0 h-auto"
                readOnly={orderType === 'limit'}
              />
              <p className="text-xs text-muted-foreground">
                ${(parseFloat(toAmount || '0') * toToken.price).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Limit Price (for limit orders) */}
        {orderType === 'limit' && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Limit Price
            </label>
            <div className="relative">
              <Input
                type="number"
                placeholder="0.00"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="pl-10"
              />
              <DollarSign className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Current price: ${fromToken.price.toFixed(2)}
            </p>
          </div>
        )}

        {/* Advanced Settings */}
        {isAdvanced && (
          <div className="space-y-4 p-4 bg-accent/20 rounded-lg border border-border/30">
            <h4 className="font-semibold text-sm">Advanced Settings</h4>
            
            {/* Slippage */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Slippage Tolerance</label>
              <div className="flex gap-1">
                {slippageOptions.map((option) => (
                  <Button
                    key={option}
                    variant={slippage === option ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSlippage(option)}
                    className="h-8 px-3"
                  >
                    {option}%
                  </Button>
                ))}
              </div>
            </div>

            {/* Expiry */}
            {orderType === 'limit' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Order Expiry</label>
                <div className="grid grid-cols-3 gap-1">
                  {expiryOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={expiry === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setExpiry(option.value)}
                      className="h-8 text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Route Information */}
        <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Route Information</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Best Route:</span>
              <span>{routeInfo.bestRoute}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price Impact:</span>
              <span className="text-success">{routeInfo.priceImpact}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Minimum Received:</span>
              <span>{routeInfo.minimumReceived} {toToken.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network Fee:</span>
              <span>{routeInfo.networkFee}</span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmitOrder}
          disabled={!isValidOrder || orderStatus === 'loading'}
          className="w-full h-12 text-base font-semibold"
          variant={orderStatus === 'success' ? 'default' : 'primary'}
        >
          {orderStatus === 'loading' && (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          )}
          {orderStatus === 'success' && (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          {orderStatus === 'loading' ? 'Placing Order...' :
           orderStatus === 'success' ? 'Order Placed!' :
           orderType === 'market' ? 'Swap Instantly' :
           orderType === 'limit' ? 'Place Limit Order' : 'Set DCA Order'}
        </Button>

        {/* Order Status */}
        {orderStatus === 'success' && (
          <div className="p-3 bg-success/10 border border-success/20 rounded-lg flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-sm text-success font-medium">
              {orderType === 'limit' ? 'Limit order placed successfully!' : 'Swap completed successfully!'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JupiterLimitOrder;
