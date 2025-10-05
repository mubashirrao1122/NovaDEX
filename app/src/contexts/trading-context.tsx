import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { getMarkets, getOpenPositions, openPosition as contractOpenPosition, closePosition as contractClosePosition } from '@/utils/contract-interactions';
import { useOracle } from '@/contexts/oracle-context';

// Define types for our context
interface Position {
  id: string;
  pair: string;
  side: 'long' | 'short';
  size: number;
  leverage: number;
  entryPrice: number;
  liquidationPrice: number;
  margin: number;
  pnl: number;
  fundingPaid: number;
  timestamp: number;
}

interface MarketData {
  pair: string;
  baseToken: string;
  quoteToken: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  longOI: number;  // Open Interest for long positions
  shortOI: number; // Open Interest for short positions
  fundingRate: number;
  nextFundingTime: number;
  markPrice: number;
  indexPrice: number;
}

interface TradingContextType {
  positions: Position[];
  markets: MarketData[];
  selectedMarket: MarketData | null;
  leverage: number;
  orderType: 'market' | 'limit' | 'stop' | 'take-profit';
  slippage: number;
  marginType: 'isolated' | 'cross';
  isLoading: boolean;
  
  // Methods
  setLeverage: (value: number) => void;
  setOrderType: (type: 'market' | 'limit' | 'stop' | 'take-profit') => void;
  setSlippage: (value: number) => void;
  setMarginType: (type: 'isolated' | 'cross') => void;
  selectMarket: (market: MarketData) => void;
  openPosition: (side: 'long' | 'short', size: number, price?: number) => Promise<boolean>;
  closePosition: (positionId: string) => Promise<boolean>;
  updatePositionLeverage: (positionId: string, newLeverage: number) => Promise<boolean>;
}

// Create the context with default values
const TradingContext = createContext<TradingContextType | undefined>(undefined);

// Sample market data
const sampleMarkets: MarketData[] = [
  {
    pair: 'ETH-USDC',
    baseToken: 'ETH',
    quoteToken: 'USDC',
    price: 1850.75,
    priceChange24h: 2.5,
    volume24h: 1250000,
    longOI: 850000,
    shortOI: 750000,
    fundingRate: 0.0001, // 0.01% per 8 hours
    nextFundingTime: Date.now() + 3600000, // 1 hour from now
    markPrice: 1852.25,
    indexPrice: 1851.5
  },
  {
    pair: 'BTC-USDC',
    baseToken: 'BTC',
    quoteToken: 'USDC',
    price: 35720.50,
    priceChange24h: -0.8,
    volume24h: 3500000,
    longOI: 2200000,
    shortOI: 2500000,
    fundingRate: -0.0002, // -0.02% per 8 hours
    nextFundingTime: Date.now() + 3600000, // 1 hour from now
    markPrice: 35715.25,
    indexPrice: 35718.75
  },
  {
    pair: 'SOL-USDC',
    baseToken: 'SOL',
    quoteToken: 'USDC',
    price: 98.25,
    priceChange24h: 5.2,
    volume24h: 750000,
    longOI: 520000,
    shortOI: 350000,
    fundingRate: 0.0003, // 0.03% per 8 hours
    nextFundingTime: Date.now() + 3600000, // 1 hour from now
    markPrice: 98.35,
    indexPrice: 98.30
  }
];

// Sample positions
const samplePositions: Position[] = [
  {
    id: '1',
    pair: 'ETH-USDC',
    side: 'long',
    size: 0.5,
    leverage: 10,
    entryPrice: 1820.50,
    liquidationPrice: 1638.45,
    margin: 91.025, // (size * entryPrice) / leverage
    pnl: 15.12,
    fundingPaid: 0.25,
    timestamp: Date.now() - 86400000 // 1 day ago
  },
  {
    id: '2',
    pair: 'BTC-USDC',
    side: 'short',
    size: 0.02,
    leverage: 5,
    entryPrice: 35720.80,
    liquidationPrice: 37506.84,
    margin: 142.88, // (size * entryPrice) / leverage
    pnl: -8.64,
    fundingPaid: -0.32,
    timestamp: Date.now() - 43200000 // 12 hours ago
  }
];

// Create provider component
export const TradingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get connection and wallet from Solana wallet adapter
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [positions, setPositions] = useState<Position[]>([]);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<MarketData | null>(null);
  const [leverage, setLeverageValue] = useState<number>(5);
  const [orderType, setOrderTypeValue] = useState<'market' | 'limit' | 'stop' | 'take-profit'>('market');
  const [slippage, setSlippageValue] = useState<number>(0.5); // 0.5%
  const [marginType, setMarginTypeValue] = useState<'isolated' | 'cross'>('isolated');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Get oracle data for real-time price feeds
  const oracle = useOracle();
  
  // Load data from blockchain when wallet is connected
  useEffect(() => {
    const loadBlockchainData = async () => {
      try {
        setIsLoading(true);
        
        // If wallet is connected, fetch real data
        if (wallet.connected) {
          // Fetch markets
          const marketsData = await getMarkets(connection);
          
          // Update market prices with oracle data if available
          const updatedMarkets = marketsData.map(market => {
            const symbol = `${market.baseToken}/USD`;
            const priceData = oracle.prices[symbol];
            const fundingRate = oracle.fundingRates[symbol] || market.fundingRate;
            
            if (priceData && priceData.price !== null) {
              return {
                ...market,
                price: priceData.price,
                markPrice: priceData.price * (1 + (Math.random() * 0.001 - 0.0005)), // Small deviation for mark price
                indexPrice: priceData.price,
                priceChange24h: priceData.change24h !== null ? priceData.change24h : market.priceChange24h,
                fundingRate
              };
            }
            
            return market;
          });
          
          setMarkets(updatedMarkets);
          
          if (updatedMarkets.length > 0) {
            setSelectedMarket(updatedMarkets[0]);
          }
          
          // Fetch positions
          if (wallet.publicKey) {
            const positionsData = await getOpenPositions(connection, wallet.publicKey);
            // Ensure the positions have the right type
            const typedPositions = positionsData.map(pos => ({
              ...pos,
              side: pos.side === 'long' ? 'long' : 'short'
            })) as Position[];
            setPositions(typedPositions);
          }
        } else {
          // If wallet is not connected, use sample data but update with oracle prices
          const updatedMarkets = [...sampleMarkets];
          
          // Update prices from oracle
          updatedMarkets.forEach((market, index) => {
            const symbol = `${market.baseToken}/USD`;
            const priceData = oracle.prices[symbol];
            const fundingRate = oracle.fundingRates[symbol] || market.fundingRate;
            
            if (priceData && priceData.price !== null) {
              updatedMarkets[index] = {
                ...market,
                price: priceData.price,
                markPrice: priceData.price * (1 + (Math.random() * 0.001 - 0.0005)),
                indexPrice: priceData.price,
                priceChange24h: priceData.change24h !== null ? priceData.change24h : market.priceChange24h,
                fundingRate
              };
            }
          });
          
          setMarkets(updatedMarkets);
          setSelectedMarket(updatedMarkets[0]);
          setPositions(samplePositions);
        }
      } catch (error) {
        console.error('Error loading blockchain data:', error);
        // Fallback to sample data on error but still use oracle prices
        const updatedMarkets = [...sampleMarkets];
        
        // Update prices from oracle
        updatedMarkets.forEach((market, index) => {
          const symbol = `${market.baseToken}/USD`;
          const priceData = oracle.prices[symbol];
          
          if (priceData && priceData.price !== null) {
            updatedMarkets[index] = {
              ...market,
              price: priceData.price,
              markPrice: priceData.price * (1 + (Math.random() * 0.001 - 0.0005)),
              indexPrice: priceData.price,
              priceChange24h: priceData.change24h !== null ? priceData.change24h : market.priceChange24h
            };
          }
        });
        
        setMarkets(updatedMarkets);
        setSelectedMarket(updatedMarkets[0]);
        setPositions(samplePositions);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadBlockchainData();
    
    // Set up interval to refresh data every 30 seconds
    const refreshInterval = setInterval(loadBlockchainData, 30000);
    
    return () => clearInterval(refreshInterval);
  }, [connection, wallet.connected, wallet.publicKey, oracle.prices, oracle.fundingRates]);

  // Set leverage (1-20x)
  const setLeverage = (value: number) => {
    if (value >= 1 && value <= 20) {
      setLeverageValue(value);
    }
  };

  // Set order type
  const setOrderType = (type: 'market' | 'limit' | 'stop' | 'take-profit') => {
    setOrderTypeValue(type);
  };

  // Set slippage tolerance
  const setSlippage = (value: number) => {
    if (value >= 0.1 && value <= 5) {
      setSlippageValue(value);
    }
  };

  // Set margin type
  const setMarginType = (type: 'isolated' | 'cross') => {
    setMarginTypeValue(type);
  };

  // Select a market
  const selectMarket = (market: MarketData) => {
    setSelectedMarket(market);
  };

  // Open a new position
  const openPosition = async (side: 'long' | 'short', size: number, price?: number): Promise<boolean> => {
    if (!selectedMarket || !wallet.connected || !wallet.publicKey) return false;
    
    try {
      // Call the smart contract to open a position
      if (wallet.signTransaction) {
        // Only proceed if we have a market and wallet is connected
        await contractOpenPosition(
          connection,
          wallet,
          selectedMarket.pair,
          side,
          size,
          leverage,
          price
        );
        
        // After successful contract call, reload positions
        if (wallet.publicKey) {
          const updatedPositions = await getOpenPositions(connection, wallet.publicKey);
          setPositions(updatedPositions as Position[]);
        }
        
        return true;
      } else {
        // Fallback to mock implementation for testing
        const entryPrice = price || selectedMarket.price;
        const liquidationPrice = calculateLiquidationPrice(side, entryPrice, leverage);
        const margin = (size * entryPrice) / leverage;
        
        const newPosition: Position = {
          id: Date.now().toString(),
          pair: selectedMarket.pair,
          side,
          size,
          leverage,
          entryPrice,
          liquidationPrice,
          margin,
          pnl: 0,
          fundingPaid: 0,
          timestamp: Date.now()
        };
        
        setPositions(prev => [...prev, newPosition]);
        return true;
      }
    } catch (error) {
      console.error("Failed to open position:", error);
      return false;
    }
  };

  // Close an existing position
  const closePosition = async (positionId: string): Promise<boolean> => {
    if (!wallet.connected) return false;
    
    try {
      // Call the smart contract to close the position
      if (wallet.signTransaction) {
        await contractClosePosition(connection, wallet, positionId);
        
        // After successful contract call, reload positions
        if (wallet.publicKey) {
          const updatedPositions = await getOpenPositions(connection, wallet.publicKey);
          setPositions(updatedPositions as Position[]);
        }
        
        return true;
      } else {
        // Fallback to mock implementation for testing
        setPositions(prev => prev.filter(pos => pos.id !== positionId));
        return true;
      }
    } catch (error) {
      console.error("Failed to close position:", error);
      return false;
    }
  };

  // Update position leverage
  const updatePositionLeverage = async (positionId: string, newLeverage: number): Promise<boolean> => {
    try {
      // In a real implementation, this would call your smart contract
      setPositions(prev => prev.map(pos => {
        if (pos.id === positionId) {
          const newLiquidationPrice = calculateLiquidationPrice(pos.side, pos.entryPrice, newLeverage);
          return {
            ...pos,
            leverage: newLeverage,
            liquidationPrice: newLiquidationPrice,
            margin: (pos.size * pos.entryPrice) / newLeverage
          };
        }
        return pos;
      }));
      return true;
    } catch (error) {
      console.error("Failed to update position leverage:", error);
      return false;
    }
  };

  // Helper function to calculate liquidation price based on side, entry price, and leverage
  const calculateLiquidationPrice = (side: 'long' | 'short', entryPrice: number, leverage: number): number => {
    // Simplified liquidation price calculation
    // In real trading, this would include maintenance margin, fees, etc.
    const maintenanceMargin = 0.05; // 5% maintenance margin
    
    if (side === 'long') {
      return entryPrice * (1 - ((1 - maintenanceMargin) / leverage));
    } else {
      return entryPrice * (1 + ((1 - maintenanceMargin) / leverage));
    }
  };

  const value = {
    positions,
    markets,
    selectedMarket,
    leverage,
    orderType,
    slippage,
    marginType,
    isLoading,
    setLeverage,
    setOrderType,
    setSlippage,
    setMarginType,
    selectMarket,
    openPosition,
    closePosition,
    updatePositionLeverage
  };

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
};

// Create a hook for using the trading context
export const useTradingContext = () => {
  const context = useContext(TradingContext);
  if (context === undefined) {
    throw new Error('useTradingContext must be used within a TradingProvider');
  }
  return context;
};
