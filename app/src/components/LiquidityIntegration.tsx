import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Droplets, 
  TrendingUp, 
  Shield, 
  Zap,
  ArrowUpDown,
  Info
} from 'lucide-react';

interface LiquidityPool {
  id: string;
  name: string;
  pair: string;
  tvl: number;
  apy: number;
  volume24h: number;
  utilizationRate: number;
  available: number;
  borrowRate: number;
  supplyRate: number;
  isActive: boolean;
}

interface LiquidityIntegrationProps {
  selectedPair?: string;
  onPoolSelect?: (poolId: string) => void;
}

const LiquidityIntegration: React.FC<LiquidityIntegrationProps> = ({
  selectedPair = 'BTC-USDC',
  onPoolSelect
}) => {
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [totalLiquidity, setTotalLiquidity] = useState(0);

  // Mock liquidity pools data
  useEffect(() => {
    const mockPools: LiquidityPool[] = [
      {
        id: 'btc-usdc-main',
        name: 'BTC-USDC Main Pool',
        pair: 'BTC-USDC',
        tvl: 12450000,
        apy: 18.5,
        volume24h: 2340000,
        utilizationRate: 72,
        available: 3486000,
        borrowRate: 12.3,
        supplyRate: 8.9,
        isActive: true
      },
      {
        id: 'eth-usdc-main',
        name: 'ETH-USDC Main Pool',
        pair: 'ETH-USDC',
        tvl: 8920000,
        apy: 22.1,
        volume24h: 1870000,
        utilizationRate: 68,
        available: 2854400,
        borrowRate: 15.6,
        supplyRate: 10.6,
        isActive: true
      },
      {
        id: 'sol-usdc-main',
        name: 'SOL-USDC Main Pool',
        pair: 'SOL-USDC',
        tvl: 5670000,
        apy: 25.8,
        volume24h: 980000,
        utilizationRate: 45,
        available: 3118500,
        borrowRate: 8.9,
        supplyRate: 4.0,
        isActive: true
      }
    ];

    setPools(mockPools);
    setTotalLiquidity(mockPools.reduce((sum, pool) => sum + pool.tvl, 0));
    
    // Auto-select the pool matching the selected pair
    const matchingPool = mockPools.find(pool => 
      pool.pair === selectedPair || pool.pair.includes(selectedPair.split('-')[0])
    );
    if (matchingPool) {
      setSelectedPool(matchingPool.id);
    }
  }, [selectedPair]);

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const handlePoolSelection = (poolId: string) => {
    setSelectedPool(poolId);
    onPoolSelect?.(poolId);
  };

  return (
    <div className="space-y-6">
      {/* Liquidity Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            <CardTitle>Liquidity Pool Integration</CardTitle>
          </div>
          <CardDescription>
            Access deep liquidity from integrated on-chain pools for optimal trading execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Liquidity</p>
              <p className="text-2xl font-bold">{formatCurrency(totalLiquidity)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Pools</p>
              <p className="text-2xl font-bold">{pools.filter(p => p.isActive).length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Avg APY</p>
              <p className="text-2xl font-bold text-success">
                {(pools.reduce((sum, p) => sum + p.apy, 0) / pools.length).toFixed(1)}%
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">24h Volume</p>
              <p className="text-2xl font-bold">
                {formatCurrency(pools.reduce((sum, p) => sum + p.volume24h, 0))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pool Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Available Liquidity Pools</CardTitle>
          <CardDescription>
            Select a liquidity pool to integrate with your perpetual trading position
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pools.map((pool) => (
            <div
              key={pool.id}
              className={`rounded-lg border p-4 cursor-pointer transition-all ${
                selectedPool === pool.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handlePoolSelection(pool.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <ArrowUpDown className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{pool.name}</h4>
                    <p className="text-sm text-muted-foreground">{pool.pair}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={pool.isActive ? 'default' : 'secondary'}>
                    {pool.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {selectedPool === pool.id && (
                    <Badge variant="outline">Selected</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">TVL</p>
                  <p className="font-semibold">{formatCurrency(pool.tvl)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">APY</p>
                  <p className="font-semibold text-success">{pool.apy}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Available</p>
                  <p className="font-semibold">{formatCurrency(pool.available)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Utilization</p>
                  <p className="font-semibold">{pool.utilizationRate}%</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Pool Utilization</span>
                  <span className="text-xs font-medium">{pool.utilizationRate}%</span>
                </div>
                <Progress value={pool.utilizationRate} className="h-1" />
              </div>

              {selectedPool === pool.id && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Borrow Rate:</span>
                      <span className="font-medium">{pool.borrowRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Supply Rate:</span>
                      <span className="font-medium text-success">{pool.supplyRate}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Integration Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/20 p-2">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Better Execution</h4>
                <p className="text-sm text-muted-foreground">
                  Access deeper liquidity for reduced slippage
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-success/20 p-2">
                <Shield className="h-4 w-4 text-success" />
              </div>
              <div>
                <h4 className="font-semibold">Risk Reduction</h4>
                <p className="text-sm text-muted-foreground">
                  Diversified liquidity sources minimize risk
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-warning/20 p-2">
                <Zap className="h-4 w-4 text-warning" />
              </div>
              <div>
                <h4 className="font-semibold">Fast Settlement</h4>
                <p className="text-sm text-muted-foreground">
                  Instant execution with on-chain finality                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiquidityIntegration;
