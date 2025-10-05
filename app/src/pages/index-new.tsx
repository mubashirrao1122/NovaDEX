import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ArrowDownUp, BarChart2, DollarSign, TrendingUp, Wallet, Zap, Shield, Clock, Users } from 'lucide-react';
import Head from 'next/head';
import Link from 'next/link';

export default function Dashboard() {
  // Sample stats data with Jupiter-style metrics
  const stats = [
    {
      title: 'Total Value Locked',
      value: '$1,245,324.12',
      change: '+12.5%',
      icon: DollarSign,
      positive: true,
    },
    {
      title: '24h Volume',
      value: '$856,432.57',
      change: '+8.3%',
      icon: BarChart2,
      positive: true,
    },
    {
      title: 'Active Traders',
      value: '4,231',
      change: '+15.7%',
      icon: Users,
      positive: true,
    },
    {
      title: 'Avg. Response Time',
      value: '0.3s',
      change: '-15%',
      icon: Clock,
      positive: true,
    },
  ];

  // Sample token pairs with modern styling
  const tokenPairs = [
    { name: 'ETH-USDC', price: '$1,856.24', change: '+2.5%', volume: '$5.2M', positive: true },
    { name: 'BTC-USDC', price: '$35,423.18', change: '+1.2%', volume: '$8.7M', positive: true },
    { name: 'SOL-USDC', price: '$98.75', change: '-3.1%', volume: '$2.9M', positive: false },
    { name: 'AVAX-USDC', price: '$28.36', change: '+0.8%', volume: '$1.5M', positive: true },
    { name: 'LINK-USDC', price: '$12.85', change: '-0.5%', volume: '$1.1M', positive: false },
  ];

  // Feature highlights inspired by Jupiter
  const features = [
    {
      title: 'Lightning Fast Swaps',
      description: 'Execute trades in milliseconds with optimal routing across Solana',
      icon: Zap,
      color: 'from-primary to-primary-dark'
    },
    {
      title: 'Advanced Trading',
      description: 'Options, perpetuals, and sophisticated order types for pro traders',
      icon: TrendingUp,
      color: 'from-secondary to-secondary/80'
    },
    {
      title: 'Maximum Security',
      description: 'Audited smart contracts with insurance fund protection',
      icon: Shield,
      color: 'from-success to-success/80'
    }
  ];

  return (
    <>
      <Head>
        <title>NovaDex | Next-Gen DeFi Trading on Solana</title>
        <meta name="description" content="Experience lightning-fast swaps, advanced trading, and maximum security on Solana's premier DEX" />
      </Head>

      <div className="space-y-12">
        {/* Hero Section - Jupiter Inspired */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-transparent rounded-3xl"></div>
          <div className="relative p-12 text-center">
            <div className="mx-auto max-w-4xl">
              <h1 className="text-5xl font-bold tracking-tight mb-6">
                <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
                  Next-Gen DeFi Trading
                </span>
                <br />
                <span className="text-foreground">on Solana</span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Experience lightning-fast swaps, advanced perpetual trading, and sophisticated DeFi strategies 
                with the lowest fees and highest performance on Solana.
              </p>
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <Link href="/swap">
                  <Button variant="primary" size="lg" className="shadow-xl">
                    <Zap className="mr-2 h-5 w-5" />
                    Start Trading
                  </Button>
                </Link>
                <Link href="/trading">
                  <Button variant="outline" size="lg">
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Advanced Trading
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary"></div>
                  <span className="text-muted-foreground">20x Leverage</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-success"></div>
                  <span className="text-muted-foreground">0.3s Execution</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-secondary"></div>
                  <span className="text-muted-foreground">Lowest Fees</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section>
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose NovaDex?</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} className="group cursor-pointer hover:scale-105 transition-all duration-300">
                <CardContent className="p-8 text-center">
                  <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.color} mb-6 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Stats Overview */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Platform Statistics</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <Card key={index} className="group hover:scale-105 transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className={`text-sm font-medium ${stat.positive ? 'text-success' : 'text-destructive'}`}>
                        {stat.change}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/50 group-hover:bg-primary/20 transition-colors">
                      <stat.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Top Trading Pairs */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Top Trading Pairs</h2>
            <Link href="/swap">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {tokenPairs.map((pair, index) => (
                  <div key={index} className="flex items-center justify-between p-6 hover:bg-accent/30 transition-colors">
                    <div>
                      <p className="font-semibold">{pair.name}</p>
                      <p className="text-sm text-muted-foreground">Vol: {pair.volume}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{pair.price}</p>
                      <p className={`text-sm font-medium ${pair.positive ? 'text-success' : 'text-destructive'}`}>
                        {pair.change}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Quick Actions */}
        <section className="grid gap-6 md:grid-cols-2">
          <Card className="group hover:scale-105 transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownUp className="h-5 w-5 text-primary" />
                Quick Swap
              </CardTitle>
              <CardDescription>
                Swap tokens instantly with the best rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/swap">
                <Button variant="primary" className="w-full">
                  Go to Swap
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:scale-105 transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-secondary" />
                Start Trading
              </CardTitle>
              <CardDescription>
                Access advanced perpetual trading with up to 20x leverage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/trading">
                <Button variant="secondary" className="w-full">
                  Open Trading
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
