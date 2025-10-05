import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  TrendingUp, 
  AlertTriangle, 
  Wallet,
  PieChart,
  Settings,
  Plus,
  Minus,
  Info
} from 'lucide-react';

interface CollateralAsset {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  weight: number;
  liquidationThreshold: number;
  borrowCapacity: number;
  apy: number;
  isActive: boolean;
}

interface MarginAccount {
  totalCollateral: number;
  totalBorrowed: number;
  healthFactor: number;
  availableToBorrow: number;
  marginRatio: number;
  maintenanceMargin: number;
  liquidationPrice: number;
}

interface CrossMarginProps {
  onCollateralChange?: (assets: CollateralAsset[]) => void;
}

const CrossMarginCollateral: React.FC<CrossMarginProps> = ({ onCollateralChange }) => {
  const [collateralAssets, setCollateralAssets] = useState<CollateralAsset[]>([]);
  const [marginAccount, setMarginAccount] = useState<MarginAccount | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'borrow'>('deposit');

  // Mock collateral assets data
  useEffect(() => {
    const mockAssets: CollateralAsset[] = [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        balance: 0.5,
        usdValue: 29400,
        weight: 0.85,
        liquidationThreshold: 0.8,
        borrowCapacity: 23520,
        apy: 2.5,
        isActive: true
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        balance: 8.2,
        usdValue: 16400,
        weight: 0.82,
        liquidationThreshold: 0.78,
        borrowCapacity: 12792,
        apy: 3.2,
        isActive: true
      },
      {
        symbol: 'SOL',
        name: 'Solana',
        balance: 120,
        usdValue: 6000,
        weight: 0.75,
        liquidationThreshold: 0.7,
        borrowCapacity: 4200,
        apy: 5.8,
        isActive: true
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        balance: 15000,
        usdValue: 15000,
        weight: 0.95,
        liquidationThreshold: 0.92,
        borrowCapacity: 13800,
        apy: 1.2,
        isActive: true
      }
    ];

    setCollateralAssets(mockAssets);

    // Calculate margin account metrics
    const totalCollateral = mockAssets.reduce((sum, asset) => sum + asset.usdValue, 0);
    const totalBorrowed = 25000; // Mock borrowed amount
    const healthFactor = totalCollateral / totalBorrowed * 0.8; // Simplified calculation
    const availableToBorrow = mockAssets.reduce((sum, asset) => sum + asset.borrowCapacity, 0) - totalBorrowed;

    setMarginAccount({
      totalCollateral,
      totalBorrowed,
      healthFactor,
      availableToBorrow: Math.max(0, availableToBorrow),
      marginRatio: (totalCollateral / totalBorrowed) * 100,
      maintenanceMargin: totalBorrowed * 0.05, // 5% maintenance margin
      liquidationPrice: totalBorrowed / (totalCollateral * 0.8) // Simplified liquidation calculation
    });

    onCollateralChange?.(mockAssets);
  }, [onCollateralChange]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (amount: number, decimals = 2): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount);
  };

  const getHealthFactorColor = (healthFactor: number): string => {
    if (healthFactor >= 2) return 'text-success';
    if (healthFactor >= 1.5) return 'text-warning';
    return 'text-destructive';
  };

  const getHealthFactorVariant = (healthFactor: number): 'default' | 'secondary' | 'destructive' => {
    if (healthFactor >= 2) return 'default';
    if (healthFactor >= 1.5) return 'secondary';
    return 'destructive';
  };

  const handleAssetOperation = (operation: 'deposit' | 'withdraw' | 'borrow') => {
    // Implementation for asset operations
    console.log(`${operation} operation for ${selectedAsset}`);
    // Reset form
    setDepositAmount('');
    setWithdrawAmount('');
  };

  if (!marginAccount) return null;

  return (
    <div className="space-y-6">
      {/* Account Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Cross-Margin Account</CardTitle>
          </div>
          <CardDescription>
            Manage your collateral across multiple positions with shared margin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Collateral</p>
              <p className="text-2xl font-bold">{formatCurrency(marginAccount.totalCollateral)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Borrowed</p>
              <p className="text-2xl font-bold">{formatCurrency(marginAccount.totalBorrowed)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Available to Borrow</p>
              <p className="text-2xl font-bold text-success">
                {formatCurrency(marginAccount.availableToBorrow)}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Margin Ratio</p>
              <p className="text-2xl font-bold">{formatNumber(marginAccount.marginRatio)}%</p>
            </div>
          </div>

          {/* Health Factor */}
          <div className="bg-accent/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="font-medium">Health Factor</span>
              </div>
              <Badge variant={getHealthFactorVariant(marginAccount.healthFactor)}>
                {formatNumber(marginAccount.healthFactor, 2)}
              </Badge>
            </div>
            <Progress 
              value={Math.min(100, (marginAccount.healthFactor / 3) * 100)} 
              className="mb-2"
            />
            <p className="text-xs text-muted-foreground">
              Health factor below 1.0 may trigger liquidation. Keep above 1.5 for safety.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Collateral Assets */}
      <Card>
        <CardHeader>
          <CardTitle>Collateral Assets</CardTitle>
          <CardDescription>
            Your assets available as collateral for cross-margin trading
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {collateralAssets.map((asset) => (
              <div key={asset.symbol} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="font-bold text-sm">{asset.symbol}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">{asset.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatNumber(asset.balance, 4)} {asset.symbol}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(asset.usdValue)}</p>
                    <p className="text-sm text-success">+{asset.apy}% APY</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Weight</p>
                    <p className="font-medium">{(asset.weight * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">LTV</p>
                    <p className="font-medium">{(asset.liquidationThreshold * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Borrow Capacity</p>
                    <p className="font-medium">{formatCurrency(asset.borrowCapacity)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={asset.isActive ? 'default' : 'secondary'}>
                      {asset.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Asset Management */}
      <Card>
        <CardHeader>
          <CardTitle>Manage Collateral</CardTitle>
          <CardDescription>
            Deposit, withdraw, or borrow against your collateral
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {(['deposit', 'withdraw', 'borrow'] as const).map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab(tab)}
                className="capitalize"
              >
                {tab}
              </Button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Asset</label>
              <select 
                className="w-full mt-1 p-2 border border-border rounded-md bg-background"
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
              >
                <option value="">Select an asset</option>
                {collateralAssets.map((asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.name} ({asset.symbol})
                  </option>
                ))}
              </select>
            </div>

            {activeTab === 'deposit' && (
              <div>
                <label className="text-sm font-medium">Deposit Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            {activeTab === 'withdraw' && (
              <div>
                <label className="text-sm font-medium">Withdraw Amount</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <Button 
              className="w-full"
              onClick={() => handleAssetOperation(activeTab)}
              disabled={!selectedAsset}
            >
              {activeTab === 'deposit' && <Plus className="h-4 w-4 mr-2" />}
              {activeTab === 'withdraw' && <Minus className="h-4 w-4 mr-2" />}
              {activeTab === 'borrow' && <Wallet className="h-4 w-4 mr-2" />}
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} {selectedAsset}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Risk Warning */}
      <Card className="border-warning/50 bg-warning/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div>
              <h4 className="font-semibold text-warning">Cross-Margin Risk Notice</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Cross-margin trading uses all your collateral to maintain positions. A significant price 
                movement against your positions could result in liquidation of all collateral assets. 
                Monitor your health factor and maintain adequate margin levels.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CrossMarginCollateral;
