import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingDown,
  TrendingUp,
  Target,
  Clock,
  BarChart3,
  Settings,
  Activity,
  Zap,
  Timer,
  Layers,
  ArrowUpDown,
  Play,
  Pause,
  StopCircle,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Percent
} from 'lucide-react';

interface OrderConfig {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: 'trailing-stop' | 'iceberg' | 'twap' | 'stop-limit' | 'time-weighted';
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
}

interface TrailingStopOrder extends OrderConfig {
  orderType: 'trailing-stop';
  trailAmount: number;
  trailType: 'percentage' | 'absolute';
  triggerPrice: number;
  currentPrice: number;
  highestPrice: number;
  lowestPrice: number;
  stopPrice: number;
}

interface IcebergOrder extends OrderConfig {
  orderType: 'iceberg';
  totalQuantity: number;
  visibleQuantity: number;
  executedQuantity: number;
  averagePrice: number;
  priceLimit: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK';
  slices: OrderSlice[];
}

interface TWAPOrder extends OrderConfig {
  orderType: 'twap';
  duration: number; // in minutes
  intervals: number;
  intervalSize: number;
  executedQuantity: number;
  averagePrice: number;
  startTime: number;
  endTime: number;
  priceLimit?: number;
  slippage: number;
  executions: TWAPExecution[];
}

interface OrderSlice {
  id: string;
  quantity: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled';
  timestamp: number;
}

interface TWAPExecution {
  id: string;
  quantity: number;
  price: number;
  timestamp: number;
  slippage: number;
}

interface AdvancedOrderTypesProps {
  onOrderSubmit?: (order: OrderConfig) => void;
  currentPrice?: number;
  symbol?: string;
}

const AdvancedOrderTypes: React.FC<AdvancedOrderTypesProps> = ({
  onOrderSubmit,
  currentPrice = 58930,
  symbol = 'BTC/USDC'
}) => {
  const [activeOrders, setActiveOrders] = useState<OrderConfig[]>([]);
  const [selectedOrderType, setSelectedOrderType] = useState<'trailing-stop' | 'iceberg' | 'twap'>('trailing-stop');
  
  // Trailing Stop State
  const [trailAmount, setTrailAmount] = useState<string>('5');
  const [trailType, setTrailType] = useState<'percentage' | 'absolute'>('percentage');
  const [tsQuantity, setTsQuantity] = useState<string>('0.1');
  const [tsSide, setTsSide] = useState<'buy' | 'sell'>('sell');
  
  // Iceberg Order State
  const [icebergTotal, setIcebergTotal] = useState<string>('10');
  const [icebergVisible, setIcebergVisible] = useState<string>('1');
  const [icebergPrice, setIcebergPrice] = useState<string>(currentPrice.toString());
  const [icebergSide, setIcebergSide] = useState<'buy' | 'sell'>('buy');
  const [timeInForce, setTimeInForce] = useState<'GTC' | 'IOC' | 'FOK'>('GTC');
  
  // TWAP State
  const [twapQuantity, setTwapQuantity] = useState<string>('5');
  const [twapDuration, setTwapDuration] = useState<string>('60');
  const [twapIntervals, setTwapIntervals] = useState<string>('12');
  const [twapSide, setTwapSide] = useState<'buy' | 'sell'>('buy');
  const [twapSlippage, setTwapSlippage] = useState<string>('0.5');
  const [twapPriceLimit, setTwapPriceLimit] = useState<string>('');

  // Initialize mock orders
  useEffect(() => {
    const mockOrders: OrderConfig[] = [
      {
        symbol: 'BTC/USDC',
        side: 'sell',
        quantity: 0.25,
        orderType: 'trailing-stop',
        status: 'active',
        createdAt: Date.now() - (2 * 60 * 60 * 1000),
        updatedAt: Date.now() - (5 * 60 * 1000),
        trailAmount: 3,
        trailType: 'percentage',
        triggerPrice: 60800,
        currentPrice: currentPrice,
        highestPrice: 61250,
        lowestPrice: 58500,
        stopPrice: 59362
      } as TrailingStopOrder,
      {
        symbol: 'ETH/USDC',
        side: 'buy',
        quantity: 15,
        orderType: 'iceberg',
        status: 'active',
        createdAt: Date.now() - (4 * 60 * 60 * 1000),
        updatedAt: Date.now() - (10 * 60 * 1000),
        totalQuantity: 15,
        visibleQuantity: 2.5,
        executedQuantity: 7.5,
        averagePrice: 3420.45,
        priceLimit: 3450,
        timeInForce: 'GTC',
        slices: []
      } as IcebergOrder,
      {
        symbol: 'SOL/USDC',
        side: 'buy',
        quantity: 100,
        orderType: 'twap',
        status: 'active',
        createdAt: Date.now() - (30 * 60 * 1000),
        updatedAt: Date.now() - (2 * 60 * 1000),
        duration: 120,
        intervals: 24,
        intervalSize: 4.17,
        executedQuantity: 62.5,
        averagePrice: 89.32,
        startTime: Date.now() - (30 * 60 * 1000),
        endTime: Date.now() + (90 * 60 * 1000),
        priceLimit: 92,
        slippage: 0.3,
        executions: []
      } as TWAPOrder
    ];

    setActiveOrders(mockOrders);
  }, [currentPrice]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  const getOrderStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'text-success';
      case 'paused': return 'text-warning';
      case 'completed': return 'text-primary';
      case 'cancelled': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <StopCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleTrailingStopSubmit = () => {
    const order: TrailingStopOrder = {
      symbol,
      side: tsSide,
      quantity: parseFloat(tsQuantity),
      orderType: 'trailing-stop',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trailAmount: parseFloat(trailAmount),
      trailType,
      triggerPrice: currentPrice,
      currentPrice,
      highestPrice: currentPrice,
      lowestPrice: currentPrice,
      stopPrice: trailType === 'percentage' 
        ? currentPrice * (1 - parseFloat(trailAmount) / 100)
        : currentPrice - parseFloat(trailAmount)
    };

    setActiveOrders(prev => [...prev, order]);
    onOrderSubmit?.(order);
    
    // Reset form
    setTsQuantity('0.1');
    setTrailAmount('5');
  };

  const handleIcebergSubmit = () => {
    const order: IcebergOrder = {
      symbol,
      side: icebergSide,
      quantity: parseFloat(icebergTotal),
      orderType: 'iceberg',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      totalQuantity: parseFloat(icebergTotal),
      visibleQuantity: parseFloat(icebergVisible),
      executedQuantity: 0,
      averagePrice: 0,
      priceLimit: parseFloat(icebergPrice),
      timeInForce,
      slices: []
    };

    setActiveOrders(prev => [...prev, order]);
    onOrderSubmit?.(order);
    
    // Reset form
    setIcebergTotal('10');
    setIcebergVisible('1');
    setIcebergPrice(currentPrice.toString());
  };

  const handleTWAPSubmit = () => {
    const duration = parseFloat(twapDuration);
    const intervals = parseInt(twapIntervals);
    
    const order: TWAPOrder = {
      symbol,
      side: twapSide,
      quantity: parseFloat(twapQuantity),
      orderType: 'twap',
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      duration,
      intervals,
      intervalSize: parseFloat(twapQuantity) / intervals,
      executedQuantity: 0,
      averagePrice: 0,
      startTime: Date.now(),
      endTime: Date.now() + (duration * 60 * 1000),
      priceLimit: twapPriceLimit ? parseFloat(twapPriceLimit) : undefined,
      slippage: parseFloat(twapSlippage),
      executions: []
    };

    setActiveOrders(prev => [...prev, order]);
    onOrderSubmit?.(order);
    
    // Reset form
    setTwapQuantity('5');
    setTwapDuration('60');
    setTwapIntervals('12');
  };

  const handleCancelOrder = (orderId: string) => {
    setActiveOrders(prev => prev.filter((_, index) => index.toString() !== orderId));
  };

  const handlePauseOrder = (orderId: string) => {
    setActiveOrders(prev => prev.map((order, index) => 
      index.toString() === orderId 
        ? { ...order, status: order.status === 'active' ? 'paused' : 'active' as const }
        : order
    ));
  };

  return (
    <div className="space-y-6">
      {/* Advanced Order Types Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Advanced Order Types</CardTitle>
          </div>
          <CardDescription>
            Execute sophisticated trading strategies with trailing stops, iceberg orders, and TWAP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Orders</p>
              <p className="text-2xl font-bold">{activeOrders.filter(o => o.status === 'active').length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{activeOrders.length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current Price</p>
              <p className="text-2xl font-bold">{formatCurrency(currentPrice)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Symbol</p>
              <p className="text-2xl font-bold">{symbol}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedOrderType} onValueChange={(value) => setSelectedOrderType(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="trailing-stop">
            <TrendingDown className="h-4 w-4 mr-2" />
            Trailing Stop
          </TabsTrigger>
          <TabsTrigger value="iceberg">
            <Layers className="h-4 w-4 mr-2" />
            Iceberg
          </TabsTrigger>
          <TabsTrigger value="twap">
            <BarChart3 className="h-4 w-4 mr-2" />
            TWAP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trailing-stop" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trailing Stop Order</CardTitle>
              <CardDescription>
                Automatically adjust stop price as the market moves in your favor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Side</label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      size="sm"
                      variant={tsSide === 'buy' ? 'default' : 'outline'}
                      onClick={() => setTsSide('buy')}
                      className="flex-1"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Buy
                    </Button>
                    <Button
                      size="sm"
                      variant={tsSide === 'sell' ? 'default' : 'outline'}
                      onClick={() => setTsSide('sell')}
                      className="flex-1"
                    >
                      <TrendingDown className="h-4 w-4 mr-2" />
                      Sell
                    </Button>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Quantity</label>
                  <Input
                    type="number"
                    placeholder="0.1"
                    value={tsQuantity}
                    onChange={(e) => setTsQuantity(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Trail Type</label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      size="sm"
                      variant={trailType === 'percentage' ? 'default' : 'outline'}
                      onClick={() => setTrailType('percentage')}
                      className="flex-1"
                    >
                      <Percent className="h-4 w-4 mr-2" />
                      %
                    </Button>
                    <Button
                      size="sm"
                      variant={trailType === 'absolute' ? 'default' : 'outline'}
                      onClick={() => setTrailType('absolute')}
                      className="flex-1"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      $
                    </Button>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">
                    Trail Amount ({trailType === 'percentage' ? '%' : '$'})
                  </label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={trailAmount}
                    onChange={(e) => setTrailAmount(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="bg-accent/30 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Order Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Side:</span>
                    <span className="capitalize">{tsSide}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span>{tsQuantity} {symbol.split('/')[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Price:</span>
                    <span>{formatCurrency(currentPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trail Amount:</span>
                    <span>
                      {trailAmount}{trailType === 'percentage' ? '%' : ' USDC'}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleTrailingStopSubmit}
                className="w-full"
                disabled={!tsQuantity || !trailAmount}
              >
                Create Trailing Stop Order
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iceberg" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Iceberg Order</CardTitle>
              <CardDescription>
                Hide large orders by showing only small portions at a time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Side</label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      size="sm"
                      variant={icebergSide === 'buy' ? 'default' : 'outline'}
                      onClick={() => setIcebergSide('buy')}
                      className="flex-1"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Buy
                    </Button>
                    <Button
                      size="sm"
                      variant={icebergSide === 'sell' ? 'default' : 'outline'}
                      onClick={() => setIcebergSide('sell')}
                      className="flex-1"
                    >
                      <TrendingDown className="h-4 w-4 mr-2" />
                      Sell
                    </Button>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Price Limit</label>
                  <Input
                    type="number"
                    placeholder={currentPrice.toString()}
                    value={icebergPrice}
                    onChange={(e) => setIcebergPrice(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Total Quantity</label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={icebergTotal}
                    onChange={(e) => setIcebergTotal(e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Visible Quantity</label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={icebergVisible}
                    onChange={(e) => setIcebergVisible(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Time in Force</label>
                <div className="flex gap-2 mt-1">
                  {(['GTC', 'IOC', 'FOK'] as const).map((tif) => (
                    <Button
                      key={tif}
                      size="sm"
                      variant={timeInForce === tif ? 'default' : 'outline'}
                      onClick={() => setTimeInForce(tif)}
                      className="flex-1"
                    >
                      {tif}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  GTC: Good Till Cancelled • IOC: Immediate or Cancel • FOK: Fill or Kill
                </p>
              </div>

              <div className="bg-accent/30 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Iceberg Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Size:</span>
                    <span>{icebergTotal} {symbol.split('/')[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Visible Size:</span>
                    <span>{icebergVisible} {symbol.split('/')[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Number of Slices:</span>
                    <span>{Math.ceil(parseFloat(icebergTotal || '1') / parseFloat(icebergVisible || '1'))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price Limit:</span>
                    <span>{formatCurrency(parseFloat(icebergPrice || '0'))}</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleIcebergSubmit}
                className="w-full"
                disabled={!icebergTotal || !icebergVisible || !icebergPrice}
              >
                Create Iceberg Order
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="twap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>TWAP Order</CardTitle>
              <CardDescription>
                Time-Weighted Average Price execution to minimize market impact
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Side</label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      size="sm"
                      variant={twapSide === 'buy' ? 'default' : 'outline'}
                      onClick={() => setTwapSide('buy')}
                      className="flex-1"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Buy
                    </Button>
                    <Button
                      size="sm"
                      variant={twapSide === 'sell' ? 'default' : 'outline'}
                      onClick={() => setTwapSide('sell')}
                      className="flex-1"
                    >
                      <TrendingDown className="h-4 w-4 mr-2" />
                      Sell
                    </Button>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Total Quantity</label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={twapQuantity}
                    onChange={(e) => setTwapQuantity(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Duration (minutes)</label>
                  <Input
                    type="number"
                    placeholder="60"
                    value={twapDuration}
                    onChange={(e) => setTwapDuration(e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Number of Intervals</label>
                  <Input
                    type="number"
                    placeholder="12"
                    value={twapIntervals}
                    onChange={(e) => setTwapIntervals(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Max Slippage (%)</label>
                  <Input
                    type="number"
                    placeholder="0.5"
                    value={twapSlippage}
                    onChange={(e) => setTwapSlippage(e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Price Limit (optional)</label>
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={twapPriceLimit}
                    onChange={(e) => setTwapPriceLimit(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="bg-accent/30 rounded-lg p-4">
                <h4 className="font-semibold mb-2">TWAP Preview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Quantity:</span>
                    <span>{twapQuantity} {symbol.split('/')[0]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Per Interval:</span>
                    <span>
                      {(parseFloat(twapQuantity || '0') / parseInt(twapIntervals || '1')).toFixed(4)} {symbol.split('/')[0]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Interval Duration:</span>
                    <span>{(parseFloat(twapDuration || '0') / parseInt(twapIntervals || '1')).toFixed(1)} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Slippage:</span>
                    <span>{twapSlippage}%</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleTWAPSubmit}
                className="w-full"
                disabled={!twapQuantity || !twapDuration || !twapIntervals}
              >
                Create TWAP Order
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Orders</CardTitle>
            <CardDescription>Manage your advanced orders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeOrders.map((order, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold">{order.symbol}</h4>
                      <Badge variant="outline" className="capitalize">
                        {order.orderType.replace('-', ' ')}
                      </Badge>
                      <Badge 
                        variant={order.status === 'active' ? 'default' : 'secondary'}
                        className={getOrderStatusColor(order.status)}
                      >
                        {getOrderStatusIcon(order.status)}
                        {order.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.side.toUpperCase()} {order.quantity} • Created {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {order.orderType === 'trailing-stop' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Trail Amount</p>
                      <p className="font-medium">
                        {(order as TrailingStopOrder).trailAmount}
                        {(order as TrailingStopOrder).trailType === 'percentage' ? '%' : ' USDC'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Stop Price</p>
                      <p className="font-medium">{formatCurrency((order as TrailingStopOrder).stopPrice)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">High/Low</p>
                      <p className="font-medium text-xs">
                        {formatCurrency((order as TrailingStopOrder).highestPrice)} / {formatCurrency((order as TrailingStopOrder).lowestPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current</p>
                      <p className="font-medium">{formatCurrency((order as TrailingStopOrder).currentPrice)}</p>
                    </div>
                  </div>
                )}

                {order.orderType === 'iceberg' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Progress</p>
                      <Progress 
                        value={((order as IcebergOrder).executedQuantity / (order as IcebergOrder).totalQuantity) * 100} 
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {(order as IcebergOrder).executedQuantity} / {(order as IcebergOrder).totalQuantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Visible Size</p>
                      <p className="font-medium">{(order as IcebergOrder).visibleQuantity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Price</p>
                      <p className="font-medium">
                        {(order as IcebergOrder).averagePrice > 0 
                          ? formatCurrency((order as IcebergOrder).averagePrice)
                          : '-'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Limit</p>
                      <p className="font-medium">{formatCurrency((order as IcebergOrder).priceLimit)}</p>
                    </div>
                  </div>
                )}

                {order.orderType === 'twap' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Progress</p>
                      <Progress 
                        value={((order as TWAPOrder).executedQuantity / order.quantity) * 100} 
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {(order as TWAPOrder).executedQuantity} / {order.quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time Left</p>
                      <p className="font-medium">
                        {Math.max(0, Math.round(((order as TWAPOrder).endTime - Date.now()) / (1000 * 60)))} min
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Price</p>
                      <p className="font-medium">
                        {(order as TWAPOrder).averagePrice > 0 
                          ? formatCurrency((order as TWAPOrder).averagePrice)
                          : '-'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Intervals</p>
                      <p className="font-medium">{(order as TWAPOrder).intervals}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePauseOrder(index.toString())}
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
                    onClick={() => handleCancelOrder(index.toString())}
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdvancedOrderTypes;
