import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { getPythPrices, subscribeToPriceFeeds, calculateFundingRate } from '@/utils/pyth-oracle';

interface PriceFeedData {
  price: number | null;
  change24h: number | null;
  updatedAt: number;
}

interface OracleContextType {
  prices: Record<string, PriceFeedData>;
  isLoading: boolean;
  lastUpdated: number;
  fundingRates: Record<string, number>;
}

const OracleContext = createContext<OracleContextType | undefined>(undefined);

// Symbols we want to track
const TRACKED_SYMBOLS = [
  'BTC/USD',
  'ETH/USD',
  'SOL/USD',
];

export const OracleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { connection } = useConnection();
  const [prices, setPrices] = useState<Record<string, PriceFeedData>>({});
  const [previousPrices, setPreviousPrices] = useState<Record<string, number | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [fundingRates, setFundingRates] = useState<Record<string, number>>({});

  // Calculate price changes compared to 24 hours ago
  const calculatePriceChange = (symbol: string, currentPrice: number | null): number | null => {
    if (!currentPrice || !previousPrices[symbol]) return null;
    
    const prevPrice = previousPrices[symbol];
    if (!prevPrice) return null;
    
    return ((currentPrice - prevPrice) / prevPrice) * 100;
  };

  // Initialize and subscribe to price updates
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    const initializePrices = async () => {
      try {
        setIsLoading(true);
        
        // Get initial prices
        const initialPrices = await getPythPrices(connection, TRACKED_SYMBOLS);
        
        // Initialize price data structure
        const initialPriceData: Record<string, PriceFeedData> = {};
        const initialPreviousPrices: Record<string, number | null> = {};
        const initialFundingRates: Record<string, number> = {};
        
        // For each symbol, create a price data object
        Object.keys(initialPrices).forEach(symbol => {
          const price = initialPrices[symbol];
          initialPriceData[symbol] = {
            price,
            change24h: null, // Will be populated once we have previous data
            updatedAt: Date.now()
          };
          
          // Store previous price for change calculation
          initialPreviousPrices[symbol] = price;
          
          // Calculate mock funding rates
          // In a real application, you'd get this from the protocol
          if (price) {
            initialFundingRates[symbol] = (Math.random() * 0.002 - 0.001); // -0.1% to +0.1%
          }
        });
        
        setPrices(initialPriceData);
        setPreviousPrices(initialPreviousPrices);
        setFundingRates(initialFundingRates);
        
        // Start subscription for real-time updates
        unsubscribe = subscribeToPriceFeeds(
          connection,
          TRACKED_SYMBOLS,
          (updatedPrices) => {
            const now = Date.now();
            setLastUpdated(now);
            
            // Update prices and calculate changes
            setPrices(prev => {
              const newPrices = { ...prev };
              
              Object.keys(updatedPrices).forEach(symbol => {
                const currentPrice = updatedPrices[symbol];
                const change24h = calculatePriceChange(symbol, currentPrice);
                
                newPrices[symbol] = {
                  price: currentPrice,
                  change24h,
                  updatedAt: now
                };
              });
              
              return newPrices;
            });
            
            // Update funding rates periodically
            const hoursSince = new Date().getUTCHours();
            if (hoursSince % 8 === 0) { // Update funding rates every 8 hours
              setFundingRates(prev => {
                const newRates = { ...prev };
                
                Object.keys(updatedPrices).forEach(symbol => {
                  const price = updatedPrices[symbol];
                  if (price) {
                    // In a real implementation, you would fetch the index price and calculate the funding rate
                    const indexPrice = price * (1 + (Math.random() * 0.004 - 0.002)); // Simulated index price
                    newRates[symbol] = calculateFundingRate(price, indexPrice);
                  }
                });
                
                return newRates;
              });
            }
          },
          10000 // Update every 10 seconds
        );
      } catch (error) {
        console.error('Error initializing price feeds:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializePrices();
    
    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [connection]);
  
  // Store previous day's prices for 24h change calculation
  useEffect(() => {
    // Store previous prices once per day
    const storeInterval = setInterval(() => {
      setPreviousPrices(
        Object.keys(prices).reduce((acc, symbol) => {
          acc[symbol] = prices[symbol]?.price || null;
          return acc;
        }, {} as Record<string, number | null>)
      );
    }, 24 * 60 * 60 * 1000); // Every 24 hours
    
    return () => clearInterval(storeInterval);
  }, [prices]);
  
  const value = {
    prices,
    isLoading,
    lastUpdated,
    fundingRates
  };
  
  return <OracleContext.Provider value={value}>{children}</OracleContext.Provider>;
};

export const useOracle = () => {
  const context = useContext(OracleContext);
  if (context === undefined) {
    throw new Error('useOracle must be used within an OracleProvider');
  }
  return context;
};
