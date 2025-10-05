import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

interface Token {
  symbol: string;
  name: string;
  balance: number;
  price: number;
  logoURI: string;
}

interface LimitOrder {
  id: string;
  type: 'buy' | 'sell';
  tokenFrom: string;
  tokenTo: string;
  amount: number;
  limitPrice: number;
  currentPrice: number;
  filled: number;
  status: 'pending' | 'filled' | 'partial' | 'cancelled';
  createdAt: Date;
  expiresAt?: Date;
}

const JupiterLimitOrder: React.FC = () => {
  const [selectedTokenFrom, setSelectedTokenFrom] = useState<Token>({
    symbol: 'SOL',
    name: 'Solana',
    balance: 10.5,
    price: 150.25,
    logoURI: '/tokens/sol.png'
  });

  const [selectedTokenTo, setSelectedTokenTo] = useState<Token>({
    symbol: 'USDC',
    name: 'USD Coin',
    balance: 1000,
    price: 1.00,
    logoURI: '/tokens/usdc.png'
  });

  const [orderType, setOrderType] = useState<'market' | 'limit' | 'dca'>('limit');
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);

  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([
    {
      id: '1',
      type: 'buy',
      tokenFrom: 'USDC',
      tokenTo: 'SOL',
      amount: 1000,
      limitPrice: 140,
      currentPrice: 150.25,
      filled: 0,
      status: 'pending',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
    {
      id: '2',
      type: 'sell',
      tokenFrom: 'SOL',
      tokenTo: 'USDC',
      amount: 5,
      limitPrice: 160,
      currentPrice: 150.25,
      filled: 2.5,
      status: 'partial',
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000)
    }
  ]);

  const tokens: Token[] = [
    { symbol: 'SOL', name: 'Solana', balance: 10.5, price: 150.25, logoURI: '/tokens/sol.png' },
    { symbol: 'USDC', name: 'USD Coin', balance: 1000, price: 1.00, logoURI: '/tokens/usdc.png' },
    { symbol: 'BTC', name: 'Bitcoin', balance: 0.025, price: 45000, logoURI: '/tokens/btc.png' },
    { symbol: 'ETH', name: 'Ethereum', balance: 1.2, price: 3200, logoURI: '/tokens/eth.png' },
    { symbol: 'RAY', name: 'Raydium', balance: 150, price: 2.45, logoURI: '/tokens/ray.png' },
  ];

  // Calculate output estimate
  const calculateOutput = () => {
    if (!amount || !limitPrice) return '0';
    const inputAmount = parseFloat(amount);
    const price = parseFloat(limitPrice);
    
    if (orderType === 'market') {
      return (inputAmount / selectedTokenFrom.price).toFixed(6);
    } else {
      return (inputAmount / price).toFixed(6);
    }
  };

  const getCurrentPriceDifference = (): string => {
    if (!limitPrice) return '0';
    const price = parseFloat(limitPrice);
    const current = selectedTokenFrom.price;
    return ((price - current) / current * 100).toFixed(2);
  };

  const swapTokens = () => {
    const temp = selectedTokenFrom;
    setSelectedTokenFrom(selectedTokenTo);
    setSelectedTokenTo(temp);
  };

  const handleCreateOrder = () => {
    const newOrder: LimitOrder = {
      id: Date.now().toString(),
      type: selectedTokenFrom.symbol === 'SOL' ? 'sell' : 'buy',
      tokenFrom: selectedTokenFrom.symbol,
      tokenTo: selectedTokenTo.symbol,
      amount: parseFloat(amount),
      limitPrice: parseFloat(limitPrice),
      currentPrice: selectedTokenFrom.price,
      filled: 0,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };

    setLimitOrders([newOrder, ...limitOrders]);
    setAmount('');
    setLimitPrice('');
  };

  const cancelOrder = (orderId: string) => {
    setLimitOrders(orders => 
      orders.map(order => 
        order.id === orderId ? { ...order, status: 'cancelled' as const } : order
      )
    );
  };

  const orderTypes = [
    { type: 'market', label: 'Market', icon: '📈' },
    { type: 'limit', label: 'Limit', icon: '🎯' },
    { type: 'dca', label: 'DCA', icon: '🕒' }
  ];

  return (
    <div className="space-y-6">
      {/* Trading Interface */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              🎯 Limit Orders
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs">
                ⚙️
              </Button>
              <Badge variant="secondary" className="flex items-center gap-1">
                ⚡ Jupiter
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Order Type Selection */}
          <div className="flex gap-2">
            {orderTypes.map((type) => (
              <Button
                key={type.type}
                variant={orderType === type.type ? "default" : "outline"}
                onClick={() => setOrderType(type.type as any)}
                className="flex items-center gap-2 text-sm"
              >
                <span>{type.icon}</span>
                {type.label}
              </Button>
            ))}
          </div>

          {/* Token Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">From</label>
              <div className="relative">
                <select 
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
                  value={selectedTokenFrom.symbol}
                  onChange={(e) => {
                    const token = tokens.find(t => t.symbol === e.target.value);
                    if (token) setSelectedTokenFrom(token);
                  }}
                >
                  {tokens.map(token => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol} - ${token.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                Balance: {selectedTokenFrom.balance.toLocaleString()} {selectedTokenFrom.symbol}
              </p>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center">
              <Button
                onClick={swapTokens}
                size="sm"
                variant="outline"
                className="rounded-full p-2"
              >
                ↕️
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">To</label>
              <div className="relative">
                <select 
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
                  value={selectedTokenTo.symbol}
                  onChange={(e) => {
                    const token = tokens.find(t => t.symbol === e.target.value);
                    if (token) setSelectedTokenTo(token);
                  }}
                >
                  {tokens.map(token => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol} - ${token.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                Balance: {selectedTokenTo.balance.toLocaleString()} {selectedTokenTo.symbol}
              </p>
            </div>
          </div>

          {/* Order Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">
                Amount ({selectedTokenFrom.symbol})
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <div className="flex gap-2">
                {['25%', '50%', '75%', '100%'].map((percent) => (
                  <Button
                    key={percent}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const percentage = parseInt(percent) / 100;
                      const maxAmount = selectedTokenFrom.balance * percentage;
                      setAmount(maxAmount.toString());
                    }}
                    className="text-xs"
                  >
                    {percent}
                  </Button>
                ))}
              </div>
            </div>

            {orderType === 'limit' && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400 flex items-center gap-2">
                  🎯 Limit Price ({selectedTokenTo.symbol})
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-700 text-white"
                  />
                  <span className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">💰</span>
                </div>
                {limitPrice && (
                  <p className="text-xs text-gray-400">
                    {parseFloat(getCurrentPriceDifference()) > 0 ? '📈' : '📉'} 
                    {getCurrentPriceDifference()}% from current price
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Output Estimate */}
          {amount && (orderType === 'market' || limitPrice) && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">You will receive:</span>
                <span className="text-white font-medium">
                  {calculateOutput()} {selectedTokenTo.symbol}
                </span>
              </div>
            </div>
          )}

          {/* Route Information */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-primary">ℹ️</span>
              <span className="text-white font-medium">Route Information</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Best Route:</span>
                <span className="text-white">Direct Swap</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Price Impact:</span>
                <span className="text-green-400">~0.1%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network Fee:</span>
                <span className="text-white">~0.00025 SOL</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={handleCreateOrder}
            disabled={!amount || (orderType === 'limit' && !limitPrice) || isLoadingRoutes}
            className="w-full bg-primary hover:bg-primary/90 text-black font-medium"
          >
            {isLoadingRoutes ? (
              <span className="flex items-center gap-2">
                🔄 Finding Best Route...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                ✅ {orderType === 'market' ? 'Swap' : 'Create Limit Order'}
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Active Limit Orders */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>📋 Your Limit Orders</span>
            <Badge variant="secondary">
              {limitOrders.filter(order => order.status === 'pending' || order.status === 'partial').length} Active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {limitOrders.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-white mb-2">No Limit Orders</h3>
              <p className="text-gray-400">
                Create your first limit order to buy or sell at your target price.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {limitOrders.map(order => (
                <div key={order.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {order.type === 'buy' ? '📈' : '📉'}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">
                          {order.type.toUpperCase()} {order.tokenFrom} → {order.tokenTo}
                        </h4>
                        <p className="text-sm text-gray-400">
                          {order.amount} {order.tokenFrom} at ${order.limitPrice}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={
                          order.status === 'filled' ? 'default' : 
                          order.status === 'partial' ? 'secondary' : 
                          order.status === 'cancelled' ? 'destructive' : 'outline'
                        }
                      >
                        ✅ {order.status}
                      </Badge>
                    </div>
                  </div>

                  {order.status === 'partial' && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-400">Filled</span>
                        <span className="text-white">
                          {order.filled} / {order.amount} {order.tokenFrom}
                        </span>
                      </div>
                      <Progress 
                        value={(order.filled / order.amount) * 100} 
                        className="h-2"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-400">Limit Price</p>
                      <p className="text-white font-medium">${order.limitPrice}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Current Price</p>
                      <p className="text-white font-medium">${order.currentPrice}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Created</p>
                      <p className="text-white font-medium">
                        {order.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Expires</p>
                      <p className="text-white font-medium">
                        {order.expiresAt ? order.expiresAt.toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>

                  {(order.status === 'pending' || order.status === 'partial') && (
                    <Button
                      onClick={() => cancelOrder(order.id)}
                      size="sm"
                      variant="outline"
                      className="text-red-400 hover:text-red-300"
                    >
                      ❌ Cancel Order
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default JupiterLimitOrder;
