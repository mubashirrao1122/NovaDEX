import React, { useEffect, useState } from 'react';

interface SimpleChartProps {
  symbol?: string;
  height?: number;
}

const SimpleChart: React.FC<SimpleChartProps> = ({ 
  symbol = 'SOLUSDT',
  height = 400 
}) => {
  const [priceData, setPriceData] = useState<number[]>([]);
  const [currentPrice, setCurrentPrice] = useState(150.25);
  const [change24h, setChange24h] = useState(2.34);

  // Generate mock price data for demo
  useEffect(() => {
    const generateMockData = () => {
      const data = [];
      let price = 150;
      for (let i = 0; i < 50; i++) {
        price += (Math.random() - 0.5) * 5;
        data.push(Math.max(price, 100)); // Keep price above $100
      }
      return data;
    };

    const mockData = generateMockData();
    setPriceData(mockData);
    setCurrentPrice(mockData[mockData.length - 1]);

    // Simulate live price updates
    const interval = setInterval(() => {
      setPriceData(prev => {
        const newPrice = prev[prev.length - 1] + (Math.random() - 0.5) * 2;
        const newData = [...prev.slice(1), Math.max(newPrice, 100)];
        setCurrentPrice(newData[newData.length - 1]);
        return newData;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Create SVG path for price line
  const createPath = (data: number[]) => {
    if (data.length < 2) return '';
    
    const maxPrice = Math.max(...data);
    const minPrice = Math.min(...data);
    const priceRange = maxPrice - minPrice || 1;
    
    const width = 800;
    const chartHeight = height - 80;
    const stepX = width / (data.length - 1);
    
    return data
      .map((price, index) => {
        const x = index * stepX;
        const y = chartHeight - ((price - minPrice) / priceRange) * chartHeight + 40;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  const pathData = createPath(priceData);
  const isPositive = change24h >= 0;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white">
            {symbol.replace('USDT', '/USDT')}
          </h3>
          <p className="text-sm text-gray-400">Simple Chart View</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            ${currentPrice.toFixed(2)}
          </div>
          <div className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{change24h.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg 
          width="100%" 
          height={height}
          viewBox={`0 0 800 ${height}`}
          className="overflow-visible"
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="80" height="40" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 40" fill="none" stroke="#374151" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Price line */}
          {pathData && (
            <>
              {/* Gradient fill */}
              <defs>
                <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.3"/>
                  <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.0"/>
                </linearGradient>
              </defs>
              
              {/* Fill area under the line */}
              <path
                d={`${pathData} L 800 ${height - 40} L 0 ${height - 40} Z`}
                fill="url(#priceGradient)"
              />
              
              {/* Price line */}
              <path
                d={pathData}
                fill="none"
                stroke={isPositive ? "#10b981" : "#ef4444"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Current price dot */}
              {priceData.length > 0 && (
                <circle
                  cx="800"
                  cy={height - 80 - ((currentPrice - Math.min(...priceData)) / (Math.max(...priceData) - Math.min(...priceData) || 1)) * (height - 80) + 40}
                  r="4"
                  fill={isPositive ? "#10b981" : "#ef4444"}
                  className="animate-pulse"
                />
              )}
            </>
          )}
        </svg>

        {/* Live indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-gray-800/80 px-3 py-1 rounded-full">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-300">Live</span>
        </div>
      </div>

      {/* Chart controls */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
        <div className="flex gap-2">
          {['1H', '4H', '1D', '1W'].map((interval) => (
            <button
              key={interval}
              className="px-3 py-1 text-xs font-medium rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              {interval}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2 text-xs text-gray-400">
          <span>📊 Simple Chart</span>
          <span>•</span>
          <span>Real-time updates</span>
        </div>
      </div>
    </div>
  );
};

export default SimpleChart;
