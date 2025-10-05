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
  logoURI: string;
}

interface DCAOrder {
  id: string;
  tokenIn: string;
  tokenOut: string;
  amountPerOrder: number;
  frequency: string;
  totalOrders: number;
  completedOrders: number;
  isActive: boolean;
  totalSpent: number;
  averagePrice: number;
  nextExecution: Date;
}

const JupiterDCA: React.FC = () => {
  const [selectedTokenFrom, setSelectedTokenFrom] = useState<Token>({
    symbol: 'USDC',
    name: 'USD Coin',
    balance: 1000,
    logoURI: '/tokens/usdc.png'
  });

  const [selectedTokenTo, setSelectedTokenTo] = useState<Token>({
    symbol: 'SOL',
    name: 'Solana',
    balance: 10.5,
    logoURI: '/tokens/sol.png'
  });

  const [dcaSettings, setDcaSettings] = useState({
    amountPerOrder: '',
    frequency: 'daily',
    totalOrders: '',
    slippage: '1'
  });

  const [activeDCAOrders, setActiveDCAOrders] = useState<DCAOrder[]>([
    {
      id: '1',
      tokenIn: 'USDC',
      tokenOut: 'SOL',
      amountPerOrder: 100,
      frequency: 'daily',
      totalOrders: 30,
      completedOrders: 15,
      isActive: true,
      totalSpent: 1500,
      averagePrice: 142.86,
      nextExecution: new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
    {
      id: '2',
      tokenIn: 'USDC',
      tokenOut: 'BTC',
      amountPerOrder: 50,
      frequency: 'weekly',
      totalOrders: 12,
      completedOrders: 8,
      isActive: false,
      totalSpent: 400,
      averagePrice: 45000,
      nextExecution: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  ]);

  const tokens: Token[] = [
    { symbol: 'USDC', name: 'USD Coin', balance: 1000, logoURI: '/tokens/usdc.png' },
    { symbol: 'SOL', name: 'Solana', balance: 10.5, logoURI: '/tokens/sol.png' },
    { symbol: 'BTC', name: 'Bitcoin', balance: 0.025, logoURI: '/tokens/btc.png' },
    { symbol: 'ETH', name: 'Ethereum', balance: 1.2, logoURI: '/tokens/eth.png' },
    { symbol: 'RAY', name: 'Raydium', balance: 150, logoURI: '/tokens/ray.png' },
  ];

  const frequencies = [
    { value: 'minutes', label: 'Every 15 minutes', multiplier: 96 },
    { value: 'hourly', label: 'Every hour', multiplier: 24 },
    { value: 'daily', label: 'Daily', multiplier: 1 },
    { value: 'weekly', label: 'Weekly', multiplier: 1/7 },
    { value: 'monthly', label: 'Monthly', multiplier: 1/30 }
  ];

  const calculateTotalInvestment = () => {
    const amount = parseFloat(dcaSettings.amountPerOrder) || 0;
    const orders = parseInt(dcaSettings.totalOrders) || 0;
    return amount * orders;
  };

  const estimateAveragePriceDifference = () => {
    // Mock calculation - in real app would use historical data
    const currentPrice = 150; // Mock SOL price
    const estimatedAverage = currentPrice * (1 + (Math.random() - 0.5) * 0.1);
    return ((estimatedAverage - currentPrice) / currentPrice * 100).toFixed(2);
  };

  const handleCreateDCAOrder = () => {
    const newOrder: DCAOrder = {
      id: Date.now().toString(),
      tokenIn: selectedTokenFrom.symbol,
      tokenOut: selectedTokenTo.symbol,
      amountPerOrder: parseFloat(dcaSettings.amountPerOrder),
      frequency: dcaSettings.frequency,
      totalOrders: parseInt(dcaSettings.totalOrders),
      completedOrders: 0,
      isActive: true,
      totalSpent: 0,
      averagePrice: 0,
      nextExecution: new Date(Date.now() + getFrequencyMs(dcaSettings.frequency))
    };

    setActiveDCAOrders([...activeDCAOrders, newOrder]);
    
    // Reset form
    setDcaSettings({
      amountPerOrder: '',
      frequency: 'daily',
      totalOrders: '',
      slippage: '1'
    });
  };

  const getFrequencyMs = (frequency: string) => {
    switch (frequency) {
      case 'minutes': return 15 * 60 * 1000;
      case 'hourly': return 60 * 60 * 1000;
      case 'daily': return 24 * 60 * 60 * 1000;
      case 'weekly': return 7 * 24 * 60 * 60 * 1000;
      case 'monthly': return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  };

  const toggleDCAOrder = (orderId: string) => {
    setActiveDCAOrders(orders =>
      orders.map(order =>
        order.id === orderId ? { ...order, isActive: !order.isActive } : order
      )
    );
  };

  const cancelDCAOrder = (orderId: string) => {
    setActiveDCAOrders(orders => orders.filter(order => order.id !== orderId));
  };

  return (
    <div className="space-y-6">
      {/* DCA Setup Form */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            🕒 Dollar Cost Averaging
            <Badge variant="secondary" className="ml-auto">
              ⚡ Auto-Pilot
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {token.symbol} - {token.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                Balance: {selectedTokenFrom.balance.toLocaleString()} {selectedTokenFrom.symbol}
              </p>
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
                      {token.symbol} - {token.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                Balance: {selectedTokenTo.balance.toLocaleString()} {selectedTokenTo.symbol}
              </p>
            </div>
          </div>

          {/* DCA Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Amount per order</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="100"
                  value={dcaSettings.amountPerOrder}
                  onChange={(e) => setDcaSettings({...dcaSettings, amountPerOrder: e.target.value})}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
                <span className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">💰</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Frequency</label>
              <select 
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
                value={dcaSettings.frequency}
                onChange={(e) => setDcaSettings({...dcaSettings, frequency: e.target.value})}
              >
                {frequencies.map(freq => (
                  <option key={freq.value} value={freq.value}>
                    {freq.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Total orders</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="30"
                  value={dcaSettings.totalOrders}
                  onChange={(e) => setDcaSettings({...dcaSettings, totalOrders: e.target.value})}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
                <span className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">🎯</span>
              </div>
            </div>
          </div>

          {/* DCA Summary */}
          {dcaSettings.amountPerOrder && dcaSettings.totalOrders && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Order Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Total Investment</p>
                  <p className="text-white font-medium">${calculateTotalInvestment().toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400">Duration</p>
                  <p className="text-white font-medium">
                    {parseInt(dcaSettings.totalOrders) * (dcaSettings.frequency === 'daily' ? 1 : 
                     dcaSettings.frequency === 'weekly' ? 7 : 
                     dcaSettings.frequency === 'hourly' ? 1/24 : 1)} days
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Est. Avg Price Impact</p>
                  <p className="text-green-400 font-medium">{estimateAveragePriceDifference()}%</p>
                </div>
                <div>
                  <p className="text-gray-400">Next Execution</p>
                  <p className="text-white font-medium flex items-center gap-1">
                    🕒 {dcaSettings.frequency === 'daily' ? '24h' : dcaSettings.frequency === 'hourly' ? '1h' : '7d'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleCreateDCAOrder}
              disabled={!dcaSettings.amountPerOrder || !dcaSettings.totalOrders}
              className="flex-1 bg-primary hover:bg-primary/90 text-black font-medium"
            >
              🚀 Start DCA Order
            </Button>
            <Button variant="outline" className="px-6">
              📋 Preview
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active DCA Orders */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              📊 Active DCA Orders
            </span>
            <Badge variant="secondary">
              {activeDCAOrders.filter(order => order.isActive).length} Active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeDCAOrders.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📈</div>
              <h3 className="text-xl font-semibold text-white mb-2">No DCA Orders Yet</h3>
              <p className="text-gray-400 mb-4">
                Start your first Dollar Cost Averaging order to reduce market volatility impact.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeDCAOrders.map(order => (
                <div key={order.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {order.tokenIn === 'USDC' ? '💰' : order.tokenIn === 'SOL' ? '☀️' : '₿'}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">
                          {order.tokenIn} → {order.tokenOut}
                        </h4>
                        <p className="text-sm text-gray-400">
                          {order.amountPerOrder} {order.tokenIn} • {order.frequency}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={order.isActive ? "default" : "secondary"}>
                        {order.isActive ? "🟢 Active" : "⏸️ Paused"}
                      </Badge>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-white">
                        {order.completedOrders} / {order.totalOrders} orders
                      </span>
                    </div>
                    <Progress 
                      value={(order.completedOrders / order.totalOrders) * 100} 
                      className="h-2"
                    />
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-gray-400">Total Spent</p>
                      <p className="text-white font-medium">${order.totalSpent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Avg Price</p>
                      <p className="text-white font-medium">${order.averagePrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Next Order</p>
                      <p className="text-white font-medium">
                        {order.nextExecution.toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Remaining</p>
                      <p className="text-white font-medium">
                        {((order.totalOrders - order.completedOrders) * order.amountPerOrder).toLocaleString()} {order.tokenIn}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {order.isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleDCAOrder(order.id)}
                        className="text-xs"
                      >
                        ⏸️ Pause
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleDCAOrder(order.id)}
                        className="text-xs"
                      >
                        ▶️ Resume
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelDCAOrder(order.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      ⏹️ Cancel
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs">
                      ⚙️ Settings
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DCA Education */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            💡 Why Use DCA?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">📊</div>
              <h4 className="text-white font-medium mb-2">Reduce Volatility</h4>
              <p className="text-gray-400 text-sm">
                Smooth out price fluctuations by spreading purchases over time.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">🕒</div>
              <h4 className="text-white font-medium mb-2">Remove Emotions</h4>
              <p className="text-gray-400 text-sm">
                Automate your investment strategy and avoid emotional trading decisions.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">📈</div>
              <h4 className="text-white font-medium mb-2">Long-term Growth</h4>
              <p className="text-gray-400 text-sm">
                Build positions gradually with consistent, disciplined investing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default JupiterDCA;
