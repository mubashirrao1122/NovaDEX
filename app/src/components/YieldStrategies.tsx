import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, 
  TrendingUp, 
  Coins,
  Target,
  ShieldCheck,
  BarChart3,
  Settings,
  Play,
  Pause,
  RotateCcw,
  DollarSign,
  Percent,
  Clock,
  AlertTriangle,
  Plus
} from 'lucide-react';

interface YieldStrategy {
  id: string;
  name: string;
  description: string;
  protocol: string;
  type: 'farming' | 'lending' | 'vault' | 'perpetual-hedged';
  baseAsset: string;
  targetAsset: string;
  currentAPY: number;
  maxAPY: number;
  minAPY: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
  autoCompound: boolean;
  lockPeriod: string;
  fees: {
    management: number;
    performance: number;
    withdrawal: number;
  };
  allocation: {
    current: number;
    target: number;
  };
  isActive: boolean;
  hasPerpetualHedge: boolean;
  hedgeRatio?: number;
}

interface PositionStrategy {
  id: string;
  strategyId: string;
  strategyName: string;
  amountInvested: number;
  currentValue: number;
  totalRewards: number;
  apy: number;
  pnl: number;
  pnlPercentage: number;
  isActive: boolean;
  startDate: number;
  lastRebalance: number;
  nextRebalance: number;
  hedgePosition?: {
    side: 'long' | 'short';
    size: number;
    pnl: number;
  };
}

interface YieldStrategiesProps {
  onStrategyChange?: (strategies: PositionStrategy[]) => void;
}

const YieldStrategies: React.FC<YieldStrategiesProps> = ({
  onStrategyChange
}) => {
  const [strategies, setStrategies] = useState<YieldStrategy[]>([]);
  const [positions, setPositions] = useState<PositionStrategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<YieldStrategy | null>(null);
  const [investAmount, setInvestAmount] = useState<string>('1000');
  const [activeTab, setActiveTab] = useState<'strategies' | 'positions' | 'settings'>('strategies');
  const [autoRebalance, setAutoRebalance] = useState(true);
  const [riskTolerance, setRiskTolerance] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');

  // Initialize mock yield strategies
  useEffect(() => {
    const mockStrategies: YieldStrategy[] = [
      {
        id: 'btc-eth-farm',
        name: 'BTC-ETH LP Farming',
        description: 'Earn yield by providing liquidity to BTC-ETH pool with automated compounding',
        protocol: 'NovaDex Pools',
        type: 'farming',
        baseAsset: 'BTC',
        targetAsset: 'ETH',
        currentAPY: 34.7,
        maxAPY: 89.2,
        minAPY: 12.3,
        tvl: 12450000,
        risk: 'medium',
        autoCompound: true,
        lockPeriod: 'Flexible',
        fees: {
          management: 2.0,
          performance: 10.0,
          withdrawal: 0.5
        },
        allocation: {
          current: 45,
          target: 50
        },
        isActive: true,
        hasPerpetualHedge: true,
        hedgeRatio: 0.3
      },
      {
        id: 'sol-usdc-vault',
        name: 'SOL-USDC Vault Strategy',
        description: 'Delta-neutral vault that earns fees while hedging SOL exposure',
        protocol: 'NovaDex Vaults',
        type: 'vault',
        baseAsset: 'SOL',
        targetAsset: 'USDC',
        currentAPY: 28.4,
        maxAPY: 45.1,
        minAPY: 15.8,
        tvl: 8920000,
        risk: 'low',
        autoCompound: true,
        lockPeriod: '7 days',
        fees: {
          management: 1.5,
          performance: 15.0,
          withdrawal: 0.0
        },
        allocation: {
          current: 35,
          target: 30
        },
        isActive: true,
        hasPerpetualHedge: true,
        hedgeRatio: 0.8
      },
      {
        id: 'eth-perp-hedge',
        name: 'ETH Perpetual Hedge Farm',
        description: 'Long ETH spot while shorting ETH perpetuals for market-neutral yield',
        protocol: 'NovaDex Perpetuals',
        type: 'perpetual-hedged',
        baseAsset: 'ETH',
        targetAsset: 'USDC',
        currentAPY: 19.8,
        maxAPY: 32.4,
        minAPY: 8.7,
        tvl: 5670000,
        risk: 'low',
        autoCompound: false,
        lockPeriod: 'Flexible',
        fees: {
          management: 1.0,
          performance: 20.0,
          withdrawal: 0.0
        },
        allocation: {
          current: 20,
          target: 20
        },
        isActive: true,
        hasPerpetualHedge: true,
        hedgeRatio: 1.0
      },
      {
        id: 'usdc-lending',
        name: 'USDC Lending Strategy',
        description: 'Lend USDC across multiple protocols for optimized yield',
        protocol: 'Multi-Protocol',
        type: 'lending',
        baseAsset: 'USDC',
        targetAsset: 'USDC',
        currentAPY: 12.3,
        maxAPY: 18.9,
        minAPY: 6.2,
        tvl: 23400000,
        risk: 'low',
        autoCompound: true,
        lockPeriod: 'Flexible',
        fees: {
          management: 0.5,
          performance: 5.0,
          withdrawal: 0.0
        },
        allocation: {
          current: 0,
          target: 0
        },
        isActive: false,
        hasPerpetualHedge: false
      }
    ];

    const mockPositions: PositionStrategy[] = [
      {
        id: 'pos1',
        strategyId: 'btc-eth-farm',
        strategyName: 'BTC-ETH LP Farming',
        amountInvested: 5000,
        currentValue: 5847.32,
        totalRewards: 1247.32,
        apy: 34.7,
        pnl: 847.32,
        pnlPercentage: 16.95,
        isActive: true,
        startDate: Date.now() - (30 * 24 * 60 * 60 * 1000),
        lastRebalance: Date.now() - (7 * 24 * 60 * 60 * 1000),
        nextRebalance: Date.now() + (24 * 60 * 60 * 1000),
        hedgePosition: {
          side: 'short',
          size: 1.5,
          pnl: 234.50
        }
      },
      {
        id: 'pos2',
        strategyId: 'sol-usdc-vault',
        strategyName: 'SOL-USDC Vault Strategy',
        amountInvested: 3000,
        currentValue: 3412.89,
        totalRewards: 512.89,
        apy: 28.4,
        pnl: 412.89,
        pnlPercentage: 13.76,
        isActive: true,
        startDate: Date.now() - (45 * 24 * 60 * 60 * 1000),
        lastRebalance: Date.now() - (3 * 24 * 60 * 60 * 1000),
        nextRebalance: Date.now() + (4 * 24 * 60 * 60 * 1000),
        hedgePosition: {
          side: 'short',
          size: 24,
          pnl: 89.32
        }
      }
    ];

    setStrategies(mockStrategies);
    setPositions(mockPositions);
    onStrategyChange?.(mockPositions);
  }, [onStrategyChange]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskBadgeVariant = (risk: string): 'default' | 'secondary' | 'destructive' => {
    switch (risk) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      default: return 'secondary';
    }
  };

  const handleInvestInStrategy = (strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId);
    if (!strategy) return;

    const amount = parseFloat(investAmount);
    if (amount <= 0) return;

    const newPosition: PositionStrategy = {
      id: `pos-${Date.now()}`,
      strategyId,
      strategyName: strategy.name,
      amountInvested: amount,
      currentValue: amount,
      totalRewards: 0,
      apy: strategy.currentAPY,
      pnl: 0,
      pnlPercentage: 0,
      isActive: true,
      startDate: Date.now(),
      lastRebalance: Date.now(),
      nextRebalance: Date.now() + (24 * 60 * 60 * 1000),
      hedgePosition: strategy.hasPerpetualHedge ? {
        side: 'short',
        size: amount * (strategy.hedgeRatio || 0.5) / 58930, // Assuming BTC price
        pnl: 0
      } : undefined
    };

    setPositions(prev => [...prev, newPosition]);
    setSelectedStrategy(null);
    setInvestAmount('1000');
  };

  const handleWithdrawFromStrategy = (positionId: string) => {
    setPositions(prev => prev.filter(p => p.id !== positionId));
  };

  const totalInvested = positions.reduce((sum, p) => sum + p.amountInvested, 0);
  const totalCurrentValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalPnL = totalCurrentValue - totalInvested;
  const avgAPY = positions.length > 0 ? positions.reduce((sum, p) => sum + p.apy, 0) / positions.length : 0;

  return (
    <div className="space-y-6">
      {/* Yield Strategies Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle>DeFi Yield Strategies</CardTitle>
          </div>
          <CardDescription>
            Automated yield farming strategies with perpetual position hedging
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Invested</p>
              <p className="text-2xl font-bold">{formatCurrency(totalInvested)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current Value</p>
              <p className="text-2xl font-bold">{formatCurrency(totalCurrentValue)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total PnL</p>
              <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(totalPnL)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Avg APY</p>
              <p className="text-2xl font-bold text-success">{avgAPY.toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'strategies' ? 'default' : 'outline'}
          onClick={() => setActiveTab('strategies')}
        >
          <Target className="h-4 w-4 mr-2" />
          Available Strategies
        </Button>
        <Button
          variant={activeTab === 'positions' ? 'default' : 'outline'}
          onClick={() => setActiveTab('positions')}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          My Positions
        </Button>
        <Button
          variant={activeTab === 'settings' ? 'default' : 'outline'}
          onClick={() => setActiveTab('settings')}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {activeTab === 'strategies' && (
        <div className="space-y-4">
          {strategies.map((strategy) => (
            <Card key={strategy.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{strategy.name}</h3>
                      <Badge variant={getRiskBadgeVariant(strategy.risk)}>
                        {strategy.risk.toUpperCase()} RISK
                      </Badge>
                      {strategy.hasPerpetualHedge && (
                        <Badge variant="outline">
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          HEDGED
                        </Badge>
                      )}
                      {strategy.autoCompound && (
                        <Badge variant="outline">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          AUTO-COMPOUND
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mb-2">{strategy.description}</p>
                    <p className="text-sm text-muted-foreground">
                      Protocol: {strategy.protocol} • Lock: {strategy.lockPeriod}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-2xl font-bold text-success">{strategy.currentAPY}%</p>
                    <p className="text-sm text-muted-foreground">Current APY</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">TVL</p>
                    <p className="font-semibold">{formatNumber(strategy.tvl)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">APY Range</p>
                    <p className="font-semibold">{strategy.minAPY}% - {strategy.maxAPY}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Management Fee</p>
                    <p className="font-semibold">{strategy.fees.management}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Performance Fee</p>
                    <p className="font-semibold">{strategy.fees.performance}%</p>
                  </div>
                  {strategy.hasPerpetualHedge && (
                    <div>
                      <p className="text-sm text-muted-foreground">Hedge Ratio</p>
                      <p className="font-semibold">{((strategy.hedgeRatio || 0) * 100).toFixed(0)}%</p>
                    </div>
                  )}
                </div>

                {strategy.allocation.current > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Portfolio Allocation</span>
                      <span className="text-sm font-medium">{strategy.allocation.current}%</span>
                    </div>
                    <Progress value={strategy.allocation.current} className="h-2" />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => setSelectedStrategy(strategy)}
                    disabled={!strategy.isActive}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Invest
                  </Button>
                  {strategy.isActive && (
                    <Button variant="outline">
                      <Play className="h-4 w-4 mr-2" />
                      Start Auto-Invest
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Investment Modal */}
          {selectedStrategy && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle>Invest in {selectedStrategy.name}</CardTitle>
                <CardDescription>
                  {selectedStrategy.hasPerpetualHedge && 
                    `This strategy includes a ${((selectedStrategy.hedgeRatio || 0) * 100).toFixed(0)}% perpetual hedge to reduce market risk`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Investment Amount (USDC)</label>
                  <Input
                    type="number"
                    placeholder="1000"
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="bg-accent/30 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Strategy Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Initial Investment:</span>
                      <span>{formatCurrency(parseFloat(investAmount) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Annual Yield:</span>
                      <span className="text-success">{selectedStrategy.currentAPY}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Management Fee:</span>
                      <span>{selectedStrategy.fees.management}% annually</span>
                    </div>
                    {selectedStrategy.hasPerpetualHedge && (
                      <div className="flex justify-between">
                        <span>Hedge Position:</span>
                        <span>Short {((selectedStrategy.hedgeRatio || 0) * 100).toFixed(0)}% via perpetuals</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleInvestInStrategy(selectedStrategy.id)}
                    className="flex-1"
                    disabled={!investAmount || parseFloat(investAmount) <= 0}
                  >
                    Confirm Investment
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedStrategy(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'positions' && (
        <div className="space-y-4">
          {positions.length > 0 ? (
            positions.map((position) => (
              <Card key={position.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{position.strategyName}</h3>
                      <p className="text-sm text-muted-foreground">
                        Started {new Date(position.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${position.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(position.pnl)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {position.pnlPercentage > 0 ? '+' : ''}{position.pnlPercentage.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Invested</p>
                      <p className="font-semibold">{formatCurrency(position.amountInvested)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Value</p>
                      <p className="font-semibold">{formatCurrency(position.currentValue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Rewards</p>
                      <p className="font-semibold text-success">{formatCurrency(position.totalRewards)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">APY</p>
                      <p className="font-semibold">{position.apy.toFixed(1)}%</p>
                    </div>
                  </div>

                  {position.hedgePosition && (
                    <div className="bg-accent/30 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <span className="font-medium">Hedge Position</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Side</p>
                          <p className="font-medium">{position.hedgePosition.side.toUpperCase()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Size</p>
                          <p className="font-medium">{position.hedgePosition.size.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Hedge PnL</p>
                          <p className={`font-medium ${position.hedgePosition.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {formatCurrency(position.hedgePosition.pnl)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Last rebalance: {new Date(position.lastRebalance).toLocaleDateString()}</span>
                      <span>Next rebalance: {new Date(position.nextRebalance).toLocaleDateString()}</span>
                    </div>
                    {position.isActive && (
                      <Badge variant="default">
                        <Play className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Funds
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleWithdrawFromStrategy(position.id)}
                    >
                      Withdraw
                    </Button>
                    <Button size="sm" variant="outline">
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-8">
                <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No active yield farming positions</p>
                <Button className="mt-4" onClick={() => setActiveTab('strategies')}>
                  Browse Strategies
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>Yield Strategy Settings</CardTitle>
            <CardDescription>
              Configure automatic rebalancing and risk management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Auto-Rebalancing</label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={autoRebalance}
                    onChange={(e) => setAutoRebalance(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Enable automatic portfolio rebalancing</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Risk Tolerance</label>
                <div className="flex gap-2 mt-2">
                  {(['conservative', 'balanced', 'aggressive'] as const).map((risk) => (
                    <Button
                      key={risk}
                      size="sm"
                      variant={riskTolerance === risk ? 'default' : 'outline'}
                      onClick={() => setRiskTolerance(risk)}
                      className="capitalize"
                    >
                      {risk}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="bg-accent/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-warning">Risk Disclosure</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      DeFi yield farming involves smart contract risks, impermanent loss, and market volatility. 
                      Perpetual hedging reduces but does not eliminate market risk. Past performance does not 
                      guarantee future results.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default YieldStrategies;
