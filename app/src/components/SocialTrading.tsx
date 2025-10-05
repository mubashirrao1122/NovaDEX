import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Copy,
  Heart,
  MessageCircle,
  Star,
  Eye,
  BarChart3,
  Shield,
  Zap,
  Award,
  Activity
} from 'lucide-react';

interface Trader {
  id: string;
  username: string;
  avatar: string;
  verified: boolean;
  rank: string;
  followers: number;
  following: number;
  totalPnL: number;
  totalPnLPercentage: number;
  winRate: number;
  avgHoldTime: string;
  riskScore: number;
  totalTrades: number;
  copiers: number;
  monthlyReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  isFollowing: boolean;
  isCopying: boolean;
  copyAllocation: number;
}

interface Trade {
  id: string;
  traderId: string;
  traderUsername: string;
  type: 'perpetual' | 'spot' | 'options';
  side: 'long' | 'short';
  pair: string;
  size: number;
  leverage?: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercentage: number;
  timestamp: number;
  likes: number;
  comments: number;
  isLiked: boolean;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  analysis?: string;
}

interface SentimentData {
  symbol: string;
  bullish: number;
  bearish: number;
  neutral: number;
  totalVotes: number;
  priceTarget24h: number;
  confidence: number;
}

interface SocialTradingProps {
  onCopyTrade?: (tradeId: string, allocation: number) => void;
  onFollowTrader?: (traderId: string) => void;
}

const SocialTrading: React.FC<SocialTradingProps> = ({
  onCopyTrade,
  onFollowTrader
}) => {
  const [topTraders, setTopTraders] = useState<Trader[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
  const [activeTab, setActiveTab] = useState<'traders' | 'trades' | 'sentiment'>('traders');
  const [filterTimeframe, setFilterTimeframe] = useState<'1d' | '7d' | '30d'>('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [copyAmount, setCopyAmount] = useState<string>('100');

  // Initialize mock data
  useEffect(() => {
    const mockTraders: Trader[] = [
      {
        id: 'trader1',
        username: 'CryptoAlpha',
        avatar: '/api/placeholder/40/40',
        verified: true,
        rank: 'Diamond',
        followers: 12543,
        following: 234,
        totalPnL: 89240.50,
        totalPnLPercentage: 342.1,
        winRate: 78.5,
        avgHoldTime: '2.3 days',
        riskScore: 6.2,
        totalTrades: 1247,
        copiers: 89,
        monthlyReturn: 23.4,
        maxDrawdown: -8.2,
        sharpeRatio: 2.14,
        isFollowing: false,
        isCopying: false,
        copyAllocation: 0
      },
      {
        id: 'trader2',
        username: 'DeFiMaster',
        avatar: '/api/placeholder/40/40',
        verified: true,
        rank: 'Platinum',
        followers: 8932,
        following: 156,
        totalPnL: 65432.10,
        totalPnLPercentage: 289.7,
        winRate: 82.1,
        avgHoldTime: '1.8 days',
        riskScore: 5.8,
        totalTrades: 892,
        copiers: 67,
        monthlyReturn: 19.8,
        maxDrawdown: -6.5,
        sharpeRatio: 2.31,
        isFollowing: true,
        isCopying: true,
        copyAllocation: 15
      },
      {
        id: 'trader3',
        username: 'YieldHunter',
        avatar: '/api/placeholder/40/40',
        verified: false,
        rank: 'Gold',
        followers: 5421,
        following: 89,
        totalPnL: 34567.89,
        totalPnLPercentage: 156.3,
        winRate: 71.2,
        avgHoldTime: '4.1 days',
        riskScore: 7.1,
        totalTrades: 634,
        copiers: 34,
        monthlyReturn: 15.2,
        maxDrawdown: -12.3,
        sharpeRatio: 1.87,
        isFollowing: false,
        isCopying: false,
        copyAllocation: 0
      }
    ];

    const mockTrades: Trade[] = [
      {
        id: 'trade1',
        traderId: 'trader1',
        traderUsername: 'CryptoAlpha',
        type: 'perpetual',
        side: 'long',
        pair: 'BTC-USDC',
        size: 2.5,
        leverage: 10,
        entryPrice: 58234.50,
        currentPrice: 58945.20,
        pnl: 1776.75,
        pnlPercentage: 12.2,
        timestamp: Date.now() - 3600000,
        likes: 24,
        comments: 8,
        isLiked: false,
        sentiment: 'bullish',
        analysis: 'Strong breakout above resistance at $58k. Expecting continuation to $62k target.'
      },
      {
        id: 'trade2',
        traderId: 'trader2',
        traderUsername: 'DeFiMaster',
        type: 'options',
        side: 'long',
        pair: 'ETH-USDC',
        size: 10,
        entryPrice: 125.50,
        currentPrice: 142.80,
        pnl: 173.00,
        pnlPercentage: 13.8,
        timestamp: Date.now() - 7200000,
        likes: 31,
        comments: 12,
        isLiked: true,
        sentiment: 'bullish',
        analysis: 'ETH call options looking good before the upgrade. Low IV entry.'
      }
    ];

    const mockSentiment: SentimentData[] = [
      {
        symbol: 'BTC',
        bullish: 68,
        bearish: 22,
        neutral: 10,
        totalVotes: 1247,
        priceTarget24h: 59500,
        confidence: 7.2
      },
      {
        symbol: 'ETH',
        bullish: 72,
        bearish: 18,
        neutral: 10,
        totalVotes: 892,
        priceTarget24h: 3350,
        confidence: 6.8
      },
      {
        symbol: 'SOL',
        bullish: 45,
        bearish: 41,
        neutral: 14,
        totalVotes: 534,
        priceTarget24h: 48.50,
        confidence: 5.1
      }
    ];

    setTopTraders(mockTraders);
    setRecentTrades(mockTrades);
    setSentimentData(mockSentiment);
  }, []);

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

  const handleCopyTrader = (traderId: string, allocation: number) => {
    setTopTraders(prev => 
      prev.map(trader => 
        trader.id === traderId 
          ? { ...trader, isCopying: true, copyAllocation: allocation }
          : trader
      )
    );
    console.log(`Copying trader ${traderId} with ${allocation}% allocation`);
  };

  const handleFollowTrader = (traderId: string) => {
    setTopTraders(prev => 
      prev.map(trader => 
        trader.id === traderId 
          ? { ...trader, isFollowing: !trader.isFollowing }
          : trader
      )
    );
    onFollowTrader?.(traderId);
  };

  const handleLikeTrade = (tradeId: string) => {
    setRecentTrades(prev => 
      prev.map(trade => 
        trade.id === tradeId 
          ? { ...trade, isLiked: !trade.isLiked, likes: trade.isLiked ? trade.likes - 1 : trade.likes + 1 }
          : trade
      )
    );
  };

  const getRankColor = (rank: string): string => {
    switch (rank) {
      case 'Diamond': return 'text-blue-400';
      case 'Platinum': return 'text-gray-400';
      case 'Gold': return 'text-yellow-400';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskColor = (score: number): string => {
    if (score <= 4) return 'text-success';
    if (score <= 7) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6">
      {/* Social Trading Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Social Trading</CardTitle>
          </div>
          <CardDescription>
            Follow top traders, copy their strategies, and gauge market sentiment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Active Traders</p>
              <p className="text-2xl font-bold">{formatNumber(24567)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Following</p>
              <p className="text-2xl font-bold">{topTraders.filter(t => t.isFollowing).length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Copy Trading</p>
              <p className="text-2xl font-bold">{topTraders.filter(t => t.isCopying).length}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Community PnL</p>
              <p className="text-2xl font-bold text-success">+${formatNumber(1234567)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'traders' ? 'default' : 'outline'}
          onClick={() => setActiveTab('traders')}
        >
          <Users className="h-4 w-4 mr-2" />
          Top Traders
        </Button>
        <Button
          variant={activeTab === 'trades' ? 'default' : 'outline'}
          onClick={() => setActiveTab('trades')}
        >
          <Activity className="h-4 w-4 mr-2" />
          Live Trades
        </Button>
        <Button
          variant={activeTab === 'sentiment' ? 'default' : 'outline'}
          onClick={() => setActiveTab('sentiment')}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Market Sentiment
        </Button>
      </div>

      {activeTab === 'traders' && (
        <>
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <Input
                  placeholder="Search traders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
                <select
                  className="px-3 py-2 border border-border rounded-md bg-background"
                  value={filterTimeframe}
                  onChange={(e) => setFilterTimeframe(e.target.value as '1d' | '7d' | '30d')}
                >
                  <option value="1d">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Top Traders */}
          <div className="grid gap-4">
            {topTraders.map((trader) => (
              <Card key={trader.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={trader.avatar} />
                          <AvatarFallback>{trader.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {trader.verified && (
                          <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                            <Shield className="h-2.5 w-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{trader.username}</h3>
                          <Badge variant="outline" className={getRankColor(trader.rank)}>
                            {trader.rank}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(trader.followers)} followers • {formatNumber(trader.copiers)} copiers
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={trader.isFollowing ? 'default' : 'outline'}
                        onClick={() => handleFollowTrader(trader.id)}
                      >
                        {trader.isFollowing ? 'Following' : 'Follow'}
                      </Button>
                      {!trader.isCopying ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyTrader(trader.id, 10)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                      ) : (
                        <Badge variant="default">{trader.copyAllocation}% Copying</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Total PnL</p>
                      <p className={`font-semibold ${trader.totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(trader.totalPnL)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {trader.totalPnLPercentage > 0 ? '+' : ''}{trader.totalPnLPercentage.toFixed(1)}%
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                      <p className="font-semibold">{trader.winRate}%</p>
                      <p className="text-xs text-muted-foreground">{trader.totalTrades} trades</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Return</p>
                      <p className="font-semibold text-success">+{trader.monthlyReturn}%</p>
                      <p className="text-xs text-muted-foreground">Avg: {trader.avgHoldTime}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Max Drawdown</p>
                      <p className="font-semibold text-destructive">{trader.maxDrawdown}%</p>
                      <p className="text-xs text-muted-foreground">Sharpe: {trader.sharpeRatio}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Risk Score</p>
                      <p className={`font-semibold ${getRiskColor(trader.riskScore)}`}>
                        {trader.riskScore}/10
                      </p>
                      <Progress value={trader.riskScore * 10} className="h-1 mt-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {activeTab === 'trades' && (
        <div className="space-y-4">
          {recentTrades.map((trade) => (
            <Card key={trade.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{trade.traderUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{trade.traderUsername}</span>
                        <Badge variant={trade.side === 'long' ? 'default' : 'destructive'}>
                          {trade.side.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{trade.type}</Badge>
                        {trade.leverage && (
                          <Badge variant="secondary">{trade.leverage}x</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {trade.pair} • {trade.size} units @ {formatCurrency(trade.entryPrice)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`font-semibold ${trade.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(trade.pnl)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {trade.pnlPercentage > 0 ? '+' : ''}{trade.pnlPercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                {trade.analysis && (
                  <div className="mt-4 p-3 bg-accent/30 rounded-lg">
                    <p className="text-sm">{trade.analysis}</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-4">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleLikeTrade(trade.id)}
                      className={trade.isLiked ? 'text-red-500' : ''}
                    >
                      <Heart className={`h-4 w-4 mr-1 ${trade.isLiked ? 'fill-current' : ''}`} />
                      {trade.likes}
                    </Button>
                    <Button size="sm" variant="ghost">
                      <MessageCircle className="h-4 w-4 mr-1" />
                      {trade.comments}
                    </Button>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Trade
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'sentiment' && (
        <div className="grid gap-6">
          {sentimentData.map((data) => (
            <Card key={data.symbol}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {data.symbol} Market Sentiment
                </CardTitle>
                <CardDescription>
                  Based on {formatNumber(data.totalVotes)} community votes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Bullish</span>
                        <span className="text-sm font-medium text-success">{data.bullish}%</span>
                      </div>
                      <Progress value={data.bullish} className="h-2" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Bearish</span>
                        <span className="text-sm font-medium text-destructive">{data.bearish}%</span>
                      </div>
                      <Progress value={data.bearish} className="h-2" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Neutral</span>
                        <span className="text-sm font-medium text-muted-foreground">{data.neutral}%</span>
                      </div>
                      <Progress value={data.neutral} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">24h Price Target</p>
                      <p className="text-2xl font-bold">{formatCurrency(data.priceTarget24h)}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Confidence Level</p>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-semibold">{data.confidence}/10</p>
                        <Progress value={data.confidence * 10} className="flex-1 h-2" />
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <Badge 
                        variant={data.bullish > data.bearish ? 'default' : 'destructive'}
                        className="text-lg px-4 py-2"
                      >
                        {data.bullish > data.bearish ? 'BULLISH' : 'BEARISH'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SocialTrading;
