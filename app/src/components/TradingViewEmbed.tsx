import React, { useEffect, useRef } from 'react';
import Head from 'next/head';

interface TradingViewEmbedProps {
  symbol?: string;
  height?: number;
}

const TradingViewEmbed: React.FC<TradingViewEmbedProps> = ({ 
  symbol = 'SOLUSDT',
  height = 500 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Direct HTML embedding approach for maximum compatibility
  const tradingViewHTML = `
    <!-- TradingView Widget BEGIN -->
    <div class="tradingview-widget-container" style="height:100%;width:100%">
      <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>
      <div class="tradingview-widget-copyright">
        <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
          <span class="blue-text">Track all markets on TradingView</span>
        </a>
      </div>
      <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
      {
        "autosize": true,
        "symbol": "BINANCE:${symbol}",
        "interval": "1H",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "allow_symbol_change": true,
        "calendar": false,
        "support_host": "https://www.tradingview.com"
      }
      </script>
    </div>
    <!-- TradingView Widget END -->
  `;

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = tradingViewHTML;
    }
  }, [symbol]);

  return (
    <>
      <Head>
        <link 
          rel="preload" 
          href="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" 
          as="script" 
        />
      </Head>
      
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        {/* Chart Header */}
        <div className="bg-gray-800/50 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-black font-bold text-sm">
                  {symbol.replace('USDT', '').slice(0, 2)}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {symbol.replace('USDT', '/USDT')}
                </h3>
                <p className="text-xs text-gray-400">TradingView Chart</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                🟢 Live
              </span>
              <button className="p-1 text-gray-400 hover:text-white transition-colors">
                ⚙️
              </button>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div 
          ref={containerRef}
          style={{ height: `${height}px` }}
          className="relative"
        />

        {/* Chart Footer */}
        <div className="bg-gray-800/50 border-t border-gray-700 p-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Professional Trading Chart</span>
            <span>Powered by TradingView</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default TradingViewEmbed;
