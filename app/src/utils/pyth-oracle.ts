import { Connection, PublicKey } from '@solana/web3.js';
import { parsePriceData, PriceData, PriceStatus } from '@pythnetwork/client';

// Pyth Network price feed accounts
const CRYPTO_PRICE_FEEDS = {
  'BTC/USD': '9FYQYgc8ow3ajGK4DL98hCbmpkLJ95DVKfxQXJYxyzY4', // BTC/USD price feed
  'ETH/USD': 'BHCzkRJZmqTH7DQGshbGbxJmTXfkGLPNZVm5oTNNQrZ1', // ETH/USD price feed
  'SOL/USD': '6WVWZH3vXMvSVLTXXeBXZUu3QsERNHyLpYYTRZkJzRVp', // SOL/USD price feed
};

/**
 * Fetches the latest price from Pyth Network for a given symbol
 */
export async function getPythPrice(connection: Connection, symbol: string): Promise<number | null> {
  try {
    // Get the price feed account for the requested symbol
    const priceFeedAccount = CRYPTO_PRICE_FEEDS[symbol as keyof typeof CRYPTO_PRICE_FEEDS];
    
    if (!priceFeedAccount) {
      console.error(`No price feed found for ${symbol}`);
      return null;
    }
    
    // Get the account info from the Solana network
    const accountInfo = await connection.getAccountInfo(new PublicKey(priceFeedAccount));
    
    if (!accountInfo || !accountInfo.data) {
      return null;
    }
    
    // Parse the price data
    const priceData = parsePriceData(accountInfo.data);
    
    // Only return the price if it's valid
    if (priceData.price && priceData.status === PriceStatus.Trading) {
      return priceData.price;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting Pyth price:', error);
    return null;
  }
}

/**
 * Fetches multiple prices from Pyth Network
 */
export async function getPythPrices(connection: Connection, symbols: string[]): Promise<Record<string, number | null>> {
  try {
    // Create a map of symbol to price
    const priceMap: Record<string, number | null> = {};
    
    // Get the price feed accounts for the requested symbols
    const validSymbols = symbols.filter(symbol => 
      CRYPTO_PRICE_FEEDS[symbol as keyof typeof CRYPTO_PRICE_FEEDS]
    );
    
    if (validSymbols.length === 0) {
      console.error('No valid price feeds found');
      return {};
    }
    
    // Process each symbol in parallel
    await Promise.all(validSymbols.map(async (symbol) => {
      const price = await getPythPrice(connection, symbol);
      priceMap[symbol] = price;
    }));
    
    return priceMap;
  } catch (error) {
    console.error('Error getting Pyth prices:', error);
    return {};
  }
}

/**
 * Set up a subscription for real-time price updates
 * Note: In a real implementation, you might use the Pyth Network WebSocket API
 * This is a simplified example using a polling approach
 */
export function subscribeToPriceFeeds(
  connection: Connection,
  symbols: string[],
  callback: (prices: Record<string, number | null>) => void,
  interval = 5000 // Default update every 5 seconds
): () => void {
  // Initial fetch
  getPythPrices(connection, symbols).then(callback);
  
  // Set up interval for polling
  const timerId = setInterval(() => {
    getPythPrices(connection, symbols).then(callback);
  }, interval);
  
  // Return a function to cancel the subscription
  return () => clearInterval(timerId);
}

/**
 * Get the current funding rate based on the mark and index prices
 * This is a simplified example - real protocols have more complex funding rate calculations
 */
export function calculateFundingRate(markPrice: number, indexPrice: number): number {
  // A simple funding rate calculation based on the difference between mark and index prices
  // In real protocols, this is much more complex and includes time-weighted components
  const premium = (markPrice / indexPrice) - 1;
  
  // Clamp the funding rate to reasonable values (e.g., -0.05% to +0.05% per 8 hours)
  const maxRate = 0.0005; // 0.05%
  const clampedPremium = Math.max(Math.min(premium * 0.1, maxRate), -maxRate);
  
  return clampedPremium;
}
