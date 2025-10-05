import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, RefreshCw, Settings } from 'lucide-react';
import Head from 'next/head';
import { useState } from 'react';

export default function Swap() {
  // Sample token list
  const tokens = [
    { id: 'eth', name: 'Ethereum', symbol: 'ETH' },
    { id: 'usdc', name: 'USD Coin', symbol: 'USDC' },
    { id: 'btc', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'sol', name: 'Solana', symbol: 'SOL' },
  ];

  const [fromToken, setFromToken] = useState(tokens[0]);
  const [toToken, setToToken] = useState(tokens[1]);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  
  // Mock conversion rate
  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFromAmount(value);
    
    // Mock conversion (in a real app, this would come from an API or contract)
    if (value && !isNaN(parseFloat(value))) {
      if (fromToken.symbol === 'ETH' && toToken.symbol === 'USDC') {
        setToAmount((parseFloat(value) * 1850).toFixed(2));
      } else if (fromToken.symbol === 'USDC' && toToken.symbol === 'ETH') {
        setToAmount((parseFloat(value) / 1850).toFixed(6));
      } else {
        setToAmount(value); // 1:1 for simplicity
      }
    } else {
      setToAmount('');
    }
  };

  // Swap the tokens
  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    
    // Recalculate amounts
    if (fromAmount) {
      handleFromAmountChange({ target: { value: fromAmount } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <>
      <Head>
        <title>Swap | NovaDex</title>
        <meta name="description" content="Swap tokens instantly on NovaDex with minimal fees" />
      </Head>

      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-3xl font-bold">Swap Tokens</h1>
        <p className="mb-8 text-muted-foreground">
          Swap tokens instantly on NovaDex with optimal pricing and minimal slippage
        </p>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Swap</CardTitle>
              <button className="rounded-md p-2 hover:bg-accent">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <CardDescription>Exchange tokens with minimal slippage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* From Token */}
            <div className="rounded-lg border border-border bg-accent/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">From</label>
                <span className="text-xs text-muted-foreground">Balance: 0.00</span>
              </div>
              <div className="flex gap-2">
                <Input 
                  type="text" 
                  placeholder="0.0"
                  className="text-lg"
                  value={fromAmount}
                  onChange={handleFromAmountChange}
                />
                <div className="relative min-w-[120px]">
                  <Select>
                    <option value={fromToken.id} className="flex items-center">
                      {fromToken.symbol}
                    </option>
                    {tokens.filter(t => t.id !== fromToken.id).map((token) => (
                      <option key={token.id} value={token.id}>
                        {token.symbol}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Swap button */}
            <div className="flex justify-center">
              <button 
                onClick={handleSwapTokens}
                className="rounded-full border border-border bg-background p-2 shadow-sm hover:bg-accent"
              >
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* To Token */}
            <div className="rounded-lg border border-border bg-accent/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">To</label>
                <span className="text-xs text-muted-foreground">Balance: 0.00</span>
              </div>
              <div className="flex gap-2">
                <Input 
                  type="text" 
                  placeholder="0.0"
                  className="text-lg"
                  value={toAmount}
                  readOnly
                />
                <div className="relative min-w-[120px]">
                  <Select>
                    <option value={toToken.id} className="flex items-center">
                      {toToken.symbol}
                    </option>
                    {tokens.filter(t => t.id !== toToken.id).map((token) => (
                      <option key={token.id} value={token.id}>
                        {token.symbol}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Price information */}
            <div className="rounded-lg bg-accent/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Price</span>
                <span className="text-sm">
                  1 {fromToken.symbol} = {fromToken.symbol === 'ETH' ? '1850' : '0.00054'} {toToken.symbol}
                </span>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Slippage Tolerance</span>
                <span className="text-sm">0.5%</span>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Network Fee</span>
                <span className="text-sm">~$2.50</span>
              </div>
            </div>

            {/* Swap button */}
            <Button variant="primary" className="w-full" size="lg">
              Swap Tokens
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
