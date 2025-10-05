import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

interface DCAOrder {
  id: string;
  fromToken: string;
  toToken: string;
  totalAmount: number;
  amountPerOrder: number;
  frequency: string;
  duration: string;
  executedAmount: number;
  totalOrders: number;
  executedOrders: number;
  avgPrice: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  startDate: number;
  nextExecution: number;
  pnl: number;
  pnlPercentage: number;
}

interface JupiterDCAProps {
  onDCACreate?: (order: any) => void;
}

const JupiterDCA: React.FC<JupiterDCAProps> = ({
  onDCACreate
}) => {
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('daily');
  const [duration, setDuration] = useState<string>('30d');
  const [amountPerOrder, setAmountPerOrder] = useState<string>('');
  const [activeOrders, setActiveOrders] = useState<DCAOrder[]>([]);

  const frequencies = [
    { label: 'Every Hour', value: 'hourly' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' }
  ];

  const durations = [
    { label: '1 Week', value: '7d' },
    { label: '2 Weeks', value: '14d' },
    { label: '1 Month', value: '30d' },
    { label: '3 Months', value: '90d' },
    { label: '6 Months', value: '180d' },
    { label: '1 Year', value: '365d' }
  ];

  // Initialize with mock DCA orders
  useEffect(() => {
    const mockOrders: DCAOrder[] = [
      {
        id: 'dca-1',
        fromToken: 'USDC',
        toToken: 'SOL',
        totalAmount: 1000,
        amountPerOrder: 33.33,
        frequency: 'daily',
        duration: '30d',
        executedAmount: 333.30,
        totalOrders: 30,
        executedOrders: 10,
        avgPrice: 95.42,
        status: 'active',
        startDate: Date.now() - (10 * 24 * 60 * 60 * 1000),
        nextExecution: Date.now() + (14 * 60 * 60 * 1000),
        pnl: 45.67,
        pnlPercentage: 4.57
      },
      {
        id: 'dca-2',
        fromToken: 'USDC',
        toToken: 'BTC',
        totalAmount: 2000,
        amountPerOrder: 66.67,
        frequency: 'daily',
        duration: '30d',
        executedAmount: 800.04,
        totalOrders: 30,
        executedOrders: 12,
        avgPrice: 58234.56,
        status: 'active',
        startDate: Date.now() - (12 * 24 * 60 * 60 * 1000),
        nextExecution: Date.now() + (10 * 60 * 60 * 1000),
        pnl: -23.45,
        pnlPercentage: -2.93
      }
    ];

    setActiveOrders(mockOrders);
  }, []);

  useEffect(() => {
    if (totalAmount && frequency && duration) {
      const total = parseFloat(totalAmount);
      const days = parseInt(duration.replace('d', ''));
      let orderCount = 0;

      switch (frequency) {
        case 'hourly':
          orderCount = days * 24;
          break;
        case 'daily':
          orderCount = days;
          break;
        case 'weekly':
          orderCount = Math.ceil(days / 7);
          break;
        case 'monthly':
          orderCount = Math.ceil(days / 30);
          break;
      }

      if (orderCount > 0) {
        setAmountPerOrder((total / orderCount).toFixed(2));
      }
    }
  }, [totalAmount, frequency, duration]);

  const handleCreateDCA = () => {
    const newOrder: DCAOrder = {
      id: `dca-${Date.now()}`,
      fromToken: 'USDC',
      toToken: 'SOL',
      totalAmount: parseFloat(totalAmount),
      amountPerOrder: parseFloat(amountPerOrder),
      frequency,
      duration,
      executedAmount: 0,
      totalOrders: Math.ceil(parseFloat(totalAmount) / parseFloat(amountPerOrder)),
      executedOrders: 0,
      avgPrice: 0,
      status: 'active',
      startDate: Date.now(),
      nextExecution: Date.now() + (24 * 60 * 60 * 1000), // Next day
      pnl: 0,
      pnlPercentage: 0
    };

    setActiveOrders(prev => [...prev, newOrder]);
    onDCACreate?.(newOrder);

    // Reset form
    setTotalAmount('');
    setAmountPerOrder('');
  };

  const handlePauseDCA = (orderId: string) => {
    setActiveOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, status: order.status === 'active' ? 'paused' : 'active' }
        : order
    ));
  };

  const handleCancelDCA = (orderId: string) => {
    setActiveOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, status: 'cancelled' }
        : order
    ));
  };

  const formatTimeRemaining = (timestamp: number): string => {
    const diff = timestamp - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Create DCA Order */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle>Dollar Cost Averaging (DCA)</CardTitle>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <Zap className="h-3 w-3 mr-1" />
              Jupiter
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatically buy tokens over time to reduce the impact of volatility
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Total Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Total Amount (USDC)</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="1000"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="pl-10"
                />
                <DollarSign className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            {/* Amount Per Order */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount Per Order</label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="33.33"
                  value={amountPerOrder}
                  onChange={(e) => setAmountPerOrder(e.target.value)}
                  className="pl-10"
                  readOnly
                />
                <Target className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Frequency */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Frequency</label>
              <div className="grid grid-cols-2 gap-1">
                {frequencies.map((freq) => (
                  <Button
                    key={freq.value}
                    variant={frequency === freq.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFrequency(freq.value)}
                    className="h-8 text-xs"
                  >
                    {freq.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration</label>
              <div className="grid grid-cols-3 gap-1">
                {durations.map((dur) => (
                  <Button
                    key={dur.value}
                    variant={duration === dur.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDuration(dur.value)}
                    className="h-8 text-xs"
                  >
                    {dur.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          {totalAmount && amountPerOrder && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="font-semibold text-sm mb-2">DCA Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Total Orders</p>
                  <p className="font-semibold">{Math.ceil(parseFloat(totalAmount) / parseFloat(amountPerOrder))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-semibold">{duration.replace('d', ' days')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Frequency</p>
                  <p className="font-semibold capitalize">{frequency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Per Order</p>
                  <p className="font-semibold">{formatCurrency(parseFloat(amountPerOrder))}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleCreateDCA}
            disabled={!totalAmount || !amountPerOrder}
            className="w-full"
            variant="primary"
          >
            <Clock className="h-4 w-4 mr-2" />
            Create DCA Order
          </Button>
        </CardContent>
      </Card>

      {/* Active DCA Orders */}
      {activeOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active DCA Orders</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage your automated dollar cost averaging orders
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeOrders.map((order) => (
              <div key={order.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold">{order.fromToken} → {order.toToken}</h4>
                      <Badge 
                        variant={
                          order.status === 'active' ? 'default' : 
                          order.status === 'paused' ? 'secondary' : 'destructive'
                        }
                      >
                        {order.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(order.amountPerOrder)} every {order.frequency}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-lg font-bold ${order.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {order.pnl >= 0 ? '+' : ''}{formatCurrency(order.pnl)}
                    </p>
                    <p className={`text-sm ${order.pnlPercentage >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {order.pnlPercentage >= 0 ? '+' : ''}{order.pnlPercentage.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Progress</span>
                    <span className="text-sm font-medium">
                      {order.executedOrders} / {order.totalOrders} orders
                    </span>
                  </div>
                  <Progress 
                    value={(order.executedOrders / order.totalOrders) * 100} 
                    className="h-2"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Executed</p>
                    <p className="font-semibold">{formatCurrency(order.executedAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Remaining</p>
                    <p className="font-semibold">
                      {formatCurrency(order.totalAmount - order.executedAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Price</p>
                    <p className="font-semibold">
                      {order.avgPrice > 0 ? formatCurrency(order.avgPrice) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Next Order</p>
                    <p className="font-semibold">
                      {order.status === 'active' ? formatTimeRemaining(order.nextExecution) : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePauseDCA(order.id)}
                    disabled={order.status === 'cancelled' || order.status === 'completed'}
                  >
                    {order.status === 'active' ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancelDCA(order.id)}
                    disabled={order.status === 'cancelled' || order.status === 'completed'}
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* DCA Information */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-semibold mb-2">About Dollar Cost Averaging</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                DCA helps reduce the impact of volatility by spreading your purchases over time. 
                Instead of buying all at once, you buy fixed amounts at regular intervals, 
                potentially lowering your average cost per token over time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default JupiterDCA;
