// API utilities for real market data integration

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  logoURI: string;
  decimals: number;
  coingeckoId?: string;
}

export interface PriceData {
  address: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: number;
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: number;
  routePlan: any[];
}

// CoinGecko API for price data
export class CoinGeckoAPI {
  private baseURL = 'https://api.coingecko.com/api/v3';

  async getTokenPrices(tokenIds: string[]): Promise<Record<string, PriceData>> {
    try {
      const response = await fetch(
        `${this.baseURL}/simple/price?ids=${tokenIds.join(',')}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`
      );
      const data = await response.json();
      
      return Object.keys(data).reduce((acc, id) => {
        const tokenData = data[id];
        acc[id] = {
          address: '', // Will be mapped separately
          price: tokenData.usd || 0,
          change24h: tokenData.usd_24h_change || 0,
          volume24h: tokenData.usd_24h_vol || 0,
          marketCap: tokenData.usd_market_cap || 0,
          lastUpdated: Date.now()
        };
        return acc;
      }, {} as Record<string, PriceData>);
    } catch (error) {
      console.error('Error fetching prices from CoinGecko:', error);
      return {};
    }
  }

  async getTrendingTokens(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseURL}/search/trending`);
      const data = await response.json();
      return data.coins || [];
    } catch (error) {
      console.error('Error fetching trending tokens:', error);
      return [];
    }
  }
}

// Jupiter API for swap quotes and execution
export class JupiterAPI {
  private baseURL = 'https://quote-api.jup.ag/v6';

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<SwapQuote | null> {
    try {
      const response = await fetch(
        `${this.baseURL}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const quote = await response.json();
      return quote;
    } catch (error) {
      console.error('Error getting Jupiter quote:', error);
      return null;
    }
  }

  async getSwapTransaction(quoteResponse: any, userPublicKey: string): Promise<string | null> {
    try {
      const response = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol: true,
        })
      });

      const { swapTransaction } = await response.json();
      return swapTransaction;
    } catch (error) {
      console.error('Error getting swap transaction:', error);
      return null;
    }
  }

  async getTokenList(): Promise<TokenInfo[]> {
    try {
      const response = await fetch('https://token.jup.ag/strict');
      const tokens = await response.json();
      return tokens.map((token: any) => ({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        logoURI: token.logoURI || '',
        decimals: token.decimals,
        coingeckoId: token.extensions?.coingeckoId
      }));
    } catch (error) {
      console.error('Error fetching Jupiter token list:', error);
      return [];
    }
  }
}

// Solana RPC utilities
export class SolanaRPC {
  private rpcURL: string;

  constructor(rpcURL: string = 'https://api.mainnet-beta.solana.com') {
    this.rpcURL = rpcURL;
  }

  async getTokenBalance(walletAddress: string, tokenMint: string): Promise<number> {
    try {
      const response = await fetch(this.rpcURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            walletAddress,
            { mint: tokenMint },
            { encoding: 'jsonParsed' }
          ]
        })
      });

      const data = await response.json();
      if (data.result && data.result.value.length > 0) {
        const tokenAccount = data.result.value[0];
        const balance = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
        return balance || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return 0;
    }
  }

  async getSOLBalance(walletAddress: string): Promise<number> {
    try {
      const response = await fetch(this.rpcURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [walletAddress]
        })
      });

      const data = await response.json();
      return data.result ? data.result.value / 1e9 : 0; // Convert lamports to SOL
    } catch (error) {
      console.error('Error fetching SOL balance:', error);
      return 0;
    }
  }
}

// WebSocket for real-time data
export class RealTimeDataService {
  private ws: WebSocket | null = null;
  private callbacks: { [key: string]: Function[] } = {};

  connect() {
    // Example using Birdeye API for real-time price data
    this.ws = new WebSocket('wss://public-api.birdeye.so/socket');
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      // Subscribe to price updates
      this.subscribe('price', ['SOL', 'BTC', 'ETH', 'USDC']);
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit(data.type, data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Reconnect after 5 seconds
      setTimeout(() => this.connect(), 5000);
    };
  }

  subscribe(event: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        event,
        data
      }));
    }
  }

  on(event: string, callback: Function) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  emit(event: string, data: any) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Utility functions
export const formatPrice = (price: number): string => {
  if (price >= 1000) {
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  } else if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else {
    return `$${price.toFixed(6)}`;
  }
};

export const formatNumber = (num: number): string => {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
};

export const formatPercentage = (percent: number): string => {
  const formatted = percent.toFixed(2);
  return `${percent >= 0 ? '+' : ''}${formatted}%`;
};

// Token list with Solana addresses
export const POPULAR_TOKENS: TokenInfo[] = [
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    decimals: 9,
    coingeckoId: 'solana'
  },
  {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    decimals: 6,
    coingeckoId: 'usd-coin'
  },
  {
    address: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
    symbol: 'BTC',
    name: 'Bitcoin (Portal)',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E/logo.png',
    decimals: 8,
    coingeckoId: 'bitcoin'
  },
  {
    address: '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
    symbol: 'ETH',
    name: 'Ethereum (Portal)',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk/logo.png',
    decimals: 8,
    coingeckoId: 'ethereum'
  },
  {
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    symbol: 'RAY',
    name: 'Raydium',
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
    decimals: 6,
    coingeckoId: 'raydium'
  }
];

// API instances
export const coinGeckoAPI = new CoinGeckoAPI();
export const jupiterAPI = new JupiterAPI();
export const solanaRPC = new SolanaRPC();
export const realTimeData = new RealTimeDataService();
