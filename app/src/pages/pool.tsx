import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, Plus, Settings } from 'lucide-react';
import Head from 'next/head';
import { useState } from 'react';

export default function Pool() {
  // Sample token list
  const tokens = [
    { id: 'eth', name: 'Ethereum', symbol: 'ETH' },
    { id: 'usdc', name: 'USD Coin', symbol: 'USDC' },
    { id: 'btc', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'sol', name: 'Solana', symbol: 'SOL' },
  ];

  // Sample pool list
  const pools = [
    { pair: 'ETH-USDC', apy: '4.5%', tvl: '$5.2M', yourLiquidity: '$0', tokens: ['ETH', 'USDC'] },
    { pair: 'BTC-USDC', apy: '3.8%', tvl: '$8.7M', yourLiquidity: '$0', tokens: ['BTC', 'USDC'] },
    { pair: 'SOL-USDC', apy: '6.2%', tvl: '$2.9M', yourLiquidity: '$0', tokens: ['SOL', 'USDC'] },
  ];

  const [showAddLiquidity, setShowAddLiquidity] = useState(false);
  const [token1, setToken1] = useState(tokens[0]);
  const [token2, setToken2] = useState(tokens[1]);
  const [amount1, setAmount1] = useState('');
  const [amount2, setAmount2] = useState('');
  
  // Mock conversion
  const handleAmount1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount1(value);
    
    // Mock calculation (in a real app, this would come from an API or contract)
    if (value && !isNaN(parseFloat(value))) {
      if (token1.symbol === 'ETH' && token2.symbol === 'USDC') {
        setAmount2((parseFloat(value) * 1850).toFixed(2));
      } else if (token1.symbol === 'USDC' && token2.symbol === 'ETH') {
        setAmount2((parseFloat(value) / 1850).toFixed(6));
      } else {
        setAmount2(value); // 1:1 for simplicity
      }
    } else {
      setAmount2('');
    }
  };

  return (
    <>
      <Head>
        <title>Liquidity Pool | NovaDex</title>
        <meta name="description" content="Provide liquidity and earn fees on NovaDex" />
      </Head>

      <div>
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Liquidity Pools</h1>
            <Button 
              variant="primary" 
              onClick={() => setShowAddLiquidity(!showAddLiquidity)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Liquidity
            </Button>
          </div>
          <p className="text-muted-foreground">
            Provide liquidity to earn fees and rewards on NovaDex. Earn up to 25% APY on your assets.
          </p>
        </div>
        
        {showAddLiquidity ? (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add Liquidity</CardTitle>
                <button 
                  onClick={() => setShowAddLiquidity(false)} 
                  className="rounded-md p-2 hover:bg-accent"
                >
                  <Settings className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <CardDescription>Add tokens to receive LP tokens</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Token 1 */}
              <div className="rounded-lg border border-border bg-accent/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Token 1</label>
                  <span className="text-xs text-muted-foreground">Balance: 0.00</span>
                </div>
                <div className="flex gap-2">
                  <Input 
                    type="text" 
                    placeholder="0.0"
                    className="text-lg"
                    value={amount1}
                    onChange={handleAmount1Change}
                  />
                  <div className="relative min-w-[120px]">
                    <Select>
                      <option value={token1.id} className="flex items-center">
                        {token1.symbol}
                      </option>
                      {tokens.filter(t => t.id !== token1.id).map((token) => (
                        <option key={token.id} value={token.id}>
                          {token.symbol}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Plus sign */}
              <div className="flex justify-center">
                <div className="rounded-full border border-border bg-background p-2">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>

              {/* Token 2 */}
              <div className="rounded-lg border border-border bg-accent/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Token 2</label>
                  <span className="text-xs text-muted-foreground">Balance: 0.00</span>
                </div>
                <div className="flex gap-2">
                  <Input 
                    type="text" 
                    placeholder="0.0"
                    className="text-lg"
                    value={amount2}
                    readOnly
                  />
                  <div className="relative min-w-[120px]">
                    <Select>
                      <option value={token2.id} className="flex items-center">
                        {token2.symbol}
                      </option>
                      {tokens.filter(t => t.id !== token2.id).map((token) => (
                        <option key={token.id} value={token.id}>
                          {token.symbol}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="rounded-lg bg-accent/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Exchange Rate</span>
                  <span className="text-sm">
                    1 {token1.symbol} = {token1.symbol === 'ETH' ? '1850' : '0.00054'} {token2.symbol}
                  </span>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Pool Size</span>
                  <span className="text-sm">$5.2M</span>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Your Pool Share</span>
                  <span className="text-sm">~0.01%</span>
                </div>
              </div>

              {/* Add liquidity button */}
              <Button variant="primary" className="w-full" size="lg">
                Add Liquidity
              </Button>
            </CardContent>
          </Card>
        ) : null}
        
        {/* Pool list */}
        <Card>
          <CardHeader>
            <CardTitle>Your Liquidity Positions</CardTitle>
            <CardDescription>Manage your liquidity provider positions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4 text-sm font-medium text-muted-foreground">
              <div>Pool</div>
              <div>APY</div>
              <div>TVL</div>
              <div>Your Liquidity</div>
              <div>Actions</div>
            </div>
            <Separator className="my-4" />
            {pools.map((pool) => (
              <div key={pool.pair}>
                <div className="grid grid-cols-5 items-center gap-4 py-3">
                  <div className="font-medium">{pool.pair}</div>
                  <div className="text-success">{pool.apy}</div>
                  <div>{pool.tvl}</div>
                  <div>{pool.yourLiquidity}</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Manage</Button>
                    <Button variant="outline" size="sm">Remove</Button>
                  </div>
                </div>
                <Separator />
              </div>
            ))}

            {pools.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-center text-muted-foreground">
                  You don't have any active liquidity positions.
                </p>
                <Button 
                  variant="primary" 
                  className="mt-4"
                  onClick={() => setShowAddLiquidity(true)}
                >
                  Add Liquidity
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
