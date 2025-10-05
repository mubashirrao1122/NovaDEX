import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign,
  Target,
  Calendar,
  BarChart3,
  Info,
  AlertCircle
} from 'lucide-react';

interface OptionContract {
  id: string;
  underlying: string;
  type: 'call' | 'put';
  strike: number;
  expiry: string;
  expiryTimestamp: number;
  premium: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  openInterest: number;
  volume24h: number;
  bid: number;
  ask: number;
  lastPrice: number;
  isInTheMoney: boolean;
}

interface OptionsPosition {
  id: string;
  contractId: string;
  type: 'long' | 'short';
  quantity: number;
  averagePrice: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
  timestamp: number;
}

interface OptionsTradingProps {
  selectedAsset?: string;
  onPositionChange?: (positions: OptionsPosition[]) => void;
}

const OptionsTrading: React.FC<OptionsTradingProps> = ({
  selectedAsset = 'BTC',
  onPositionChange
}) => {
  const [contracts, setContracts] = useState<OptionContract[]>([]);
  const [positions, setPositions] = useState<OptionsPosition[]>([]);
  const [selectedContract, setSelectedContract] = useState<OptionContract | null>(null);
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState<string>('1');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [orderMode, setOrderMode] = useState<'market' | 'limit'>('market');
  const [activeTab, setActiveTab] = useState<'contracts' | 'positions'>('contracts');
  const [filterType, setFilterType] = useState<'all' | 'call' | 'put'>('all');
  const [filterExpiry, setFilterExpiry] = useState<string>('all');

  // Mock current price for calculations
  const currentPrice = selectedAsset === 'BTC' ? 58930 : selectedAsset === 'ETH' ? 3217 : 50.45;

  // Initialize mock options data
  useEffect(() => {
    const now = Date.now();
    const expiryDates = [
      { label: '1D', days: 1 },
      { label: '1W', days: 7 },
      { label: '2W', days: 14 },
      { label: '1M', days: 30 },
      { label: '3M', days: 90 }
    ];

    const mockContracts: OptionContract[] = [];
    const strikeMultipliers = [0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2];

    expiryDates.forEach(expiry => {
      strikeMultipliers.forEach(multiplier => {
        const strike = Math.round(currentPrice * multiplier);
        const timeToExpiry = expiry.days / 365;
        const isCall = Math.random() > 0.5;
        
        // Simple Black-Scholes approximation for premium
        const moneyness = currentPrice / strike;
        const volatility = 0.6 + Math.random() * 0.4; // 60-100% IV
        const premium = Math.max(
          isCall 
            ? Math.max(currentPrice - strike, 0) + volatility * Math.sqrt(timeToExpiry) * currentPrice * 0.1
            : Math.max(strike - currentPrice, 0) + volatility * Math.sqrt(timeToExpiry) * currentPrice * 0.1,
          0.1
        );

        ['call', 'put'].forEach(type => {
          const isCallType = type === 'call';
          const finalPremium = isCallType ? premium : Math.max(strike - currentPrice, 0) + volatility * Math.sqrt(timeToExpiry) * currentPrice * 0.08;
          
          mockContracts.push({
            id: `${selectedAsset}-${strike}-${expiry.label}-${type}`,
            underlying: selectedAsset,
            type: type as 'call' | 'put',
            strike,
            expiry: expiry.label,
            expiryTimestamp: now + (expiry.days * 24 * 60 * 60 * 1000),
            premium: finalPremium,
            impliedVolatility: volatility,
            delta: isCallType ? Math.min(moneyness * 0.8, 1) : Math.max((moneyness - 1) * 0.8, -1),
            gamma: 0.001 + Math.random() * 0.005,
            theta: -(finalPremium * 0.1) / Math.max(expiry.days, 1),
            vega: finalPremium * 0.2,
            openInterest: Math.floor(Math.random() * 1000) + 100,
            volume24h: Math.floor(Math.random() * 500),
            bid: finalPremium * 0.98,
            ask: finalPremium * 1.02,
            lastPrice: finalPremium,
            isInTheMoney: isCallType ? currentPrice > strike : currentPrice < strike
          });
        });
      });
    });

    setContracts(mockContracts.sort((a, b) => a.expiryTimestamp - b.expiryTimestamp || a.strike - b.strike));

    // Mock positions
    const mockPositions: OptionsPosition[] = [
      {
        id: 'pos1',
        contractId: mockContracts[0]?.id || '',
        type: 'long',
        quantity: 2,
        averagePrice: 450.75,
        currentValue: 920.50,
        pnl: 19.00,
        pnlPercentage: 2.1,
        timestamp: now - 86400000
      },
      {
        id: 'pos2',
        contractId: mockContracts[5]?.id || '',
        type: 'short',
        quantity: 1,
        averagePrice: 125.30,
        currentValue: 98.75,
        pnl: 26.55,
        pnlPercentage: 21.2,
        timestamp: now - 172800000
      }
    ];

    setPositions(mockPositions);
    onPositionChange?.(mockPositions);
  }, [selectedAsset, currentPrice, onPositionChange]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const filteredContracts = contracts.filter(contract => {
    if (filterType !== 'all' && contract.type !== filterType) return false;
    if (filterExpiry !== 'all' && contract.expiry !== filterExpiry) return false;
    return true;
  });

  const executeOrder = () => {
    if (!selectedContract) return;
    
    console.log('Executing options order:', {
      contract: selectedContract.id,
      type: orderType,
      quantity: parseFloat(quantity),
      price: orderMode === 'limit' ? parseFloat(limitPrice) : selectedContract.lastPrice
    });

    // Reset form
    setQuantity('1');
    setLimitPrice('');
    setSelectedContract(null);
  };

  const uniqueExpiries = Array.from(new Set(contracts.map(c => c.expiry)));

  return (
    <div className="space-y-6">
      {/* Options Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Options Trading</CardTitle>
          </div>
          <CardDescription>
            Trade cryptocurrency options with flexible expiry dates and strike prices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current {selectedAsset} Price</p>
              <p className="text-2xl font-bold">{formatCurrency(currentPrice)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Available Contracts</p>
              <p className="text-2xl font-bold">{contracts.length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Open Positions</p>
              <p className="text-2xl font-bold">{positions.length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total PnL</p>
              <p className={`text-2xl font-bold ${positions.reduce((sum, p) => sum + p.pnl, 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(positions.reduce((sum, p) => sum + p.pnl, 0))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'contracts' ? 'default' : 'outline'}
          onClick={() => setActiveTab('contracts')}
        >
          Option Contracts
        </Button>
        <Button
          variant={activeTab === 'positions' ? 'default' : 'outline'}
          onClick={() => setActiveTab('positions')}
        >
          My Positions
        </Button>
      </div>

      {activeTab === 'contracts' && (
        <>
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={filterType === 'all' ? 'default' : 'outline'}
                    onClick={() => setFilterType('all')}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={filterType === 'call' ? 'default' : 'outline'}
                    onClick={() => setFilterType('call')}
                  >
                    Calls
                  </Button>
                  <Button
                    size="sm"
                    variant={filterType === 'put' ? 'default' : 'outline'}
                    onClick={() => setFilterType('put')}
                  >
                    Puts
                  </Button>
                </div>
                
                <select
                  className="px-3 py-1 border border-border rounded-md bg-background"
                  value={filterExpiry}
                  onChange={(e) => setFilterExpiry(e.target.value)}
                >
                  <option value="all">All Expiries</option>
                  {uniqueExpiries.map(expiry => (
                    <option key={expiry} value={expiry}>{expiry}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Options Chain */}
          <Card>
            <CardHeader>
              <CardTitle>Options Chain - {selectedAsset}</CardTitle>
              <CardDescription>
                Click on any option to view details and place orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-sm text-muted-foreground">
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Strike</th>
                      <th className="text-left p-2">Expiry</th>
                      <th className="text-left p-2">Premium</th>
                      <th className="text-left p-2">IV</th>
                      <th className="text-left p-2">Delta</th>
                      <th className="text-left p-2">Volume</th>
                      <th className="text-left p-2">OI</th>
                      <th className="text-left p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContracts.slice(0, 20).map((contract) => (
                      <tr
                        key={contract.id}
                        className={`border-b hover:bg-accent/50 cursor-pointer ${
                          selectedContract?.id === contract.id ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => setSelectedContract(contract)}
                      >
                        <td className="p-2">
                          <Badge variant={contract.type === 'call' ? 'default' : 'secondary'}>
                            {contract.type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-2 font-medium">
                          {formatCurrency(contract.strike)}
                          {contract.isInTheMoney && (
                            <Badge variant="outline" className="ml-2 text-xs">ITM</Badge>
                          )}
                        </td>
                        <td className="p-2">{contract.expiry}</td>
                        <td className="p-2 font-medium">{formatCurrency(contract.premium)}</td>
                        <td className="p-2">{formatPercentage(contract.impliedVolatility * 100)}</td>
                        <td className="p-2">{contract.delta.toFixed(3)}</td>
                        <td className="p-2">{contract.volume24h}</td>
                        <td className="p-2">{contract.openInterest}</td>
                        <td className="p-2">
                          <Button size="sm" variant="outline">Trade</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Order Panel */}
          {selectedContract && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Place Order - {selectedContract.underlying} {formatCurrency(selectedContract.strike)} {selectedContract.type.toUpperCase()}
                </CardTitle>
                <CardDescription>
                  Expires: {selectedContract.expiry} | IV: {formatPercentage(selectedContract.impliedVolatility * 100)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Order Type</label>
                    <div className="flex gap-2 mt-1">
                      <Button
                        size="sm"
                        variant={orderType === 'buy' ? 'default' : 'outline'}
                        onClick={() => setOrderType('buy')}
                        className="flex-1"
                      >
                        Buy
                      </Button>
                      <Button
                        size="sm"
                        variant={orderType === 'sell' ? 'default' : 'outline'}
                        onClick={() => setOrderType('sell')}
                        className="flex-1"
                      >
                        Sell
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Order Mode</label>
                    <div className="flex gap-2 mt-1">
                      <Button
                        size="sm"
                        variant={orderMode === 'market' ? 'default' : 'outline'}
                        onClick={() => setOrderMode('market')}
                        className="flex-1"
                      >
                        Market
                      </Button>
                      <Button
                        size="sm"
                        variant={orderMode === 'limit' ? 'default' : 'outline'}
                        onClick={() => setOrderMode('limit')}
                        className="flex-1"
                      >
                        Limit
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Quantity</label>
                    <Input
                      type="number"
                      placeholder="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  {orderMode === 'limit' && (
                    <div>
                      <label className="text-sm font-medium">Limit Price</label>
                      <Input
                        type="number"
                        placeholder={selectedContract.lastPrice.toFixed(2)}
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div className="bg-accent/30 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span>Greeks:</span>
                      <span>Δ {selectedContract.delta.toFixed(3)} | Γ {selectedContract.gamma.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time Decay:</span>
                      <span>Θ {selectedContract.theta.toFixed(2)} | V {selectedContract.vega.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <Button onClick={executeOrder} className="w-full">
                  {orderType === 'buy' ? 'Buy' : 'Sell'} {quantity} Contract{parseFloat(quantity) !== 1 ? 's' : ''}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === 'positions' && (
        <Card>
          <CardHeader>
            <CardTitle>Open Options Positions</CardTitle>
            <CardDescription>
              Monitor and manage your active options positions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {positions.length > 0 ? (
              <div className="space-y-4">
                {positions.map((position) => {
                  const contract = contracts.find(c => c.id === position.contractId);
                  if (!contract) return null;
                  
                  return (
                    <div key={position.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge variant={contract.type === 'call' ? 'default' : 'secondary'}>
                            {contract.type.toUpperCase()}
                          </Badge>
                          <span className="font-semibold">
                            {contract.underlying} {formatCurrency(contract.strike)}
                          </span>
                          <Badge variant="outline">{contract.expiry}</Badge>
                          <Badge variant={position.type === 'long' ? 'default' : 'destructive'}>
                            {position.type.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${position.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {formatCurrency(position.pnl)} ({position.pnlPercentage > 0 ? '+' : ''}{position.pnlPercentage.toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Quantity</p>
                          <p className="font-medium">{position.quantity}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Price</p>
                          <p className="font-medium">{formatCurrency(position.averagePrice)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Current Value</p>
                          <p className="font-medium">{formatCurrency(position.currentValue)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Time to Expiry</p>
                          <p className="font-medium">{contract.expiry}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" variant="outline">Close Position</Button>
                        <Button size="sm" variant="outline">Add to Position</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No open options positions</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OptionsTrading;
