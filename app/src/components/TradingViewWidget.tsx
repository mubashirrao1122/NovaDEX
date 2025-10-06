import React, { useEffect, useRef, memo } from 'react';
import Head from 'next/head';

interface TradingViewWidgetProps {
  symbol?: string;
  interval?: string;
  theme?: 'light' | 'dark';
  height?: number;
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = memo(({ 
  symbol = 'SOLUSDT',
  interval = '1H',
  theme = 'dark',
  height = 500
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing content
    containerRef.current.innerHTML = '';

    // Create unique ID for this widget
    const containerId = `tradingview_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create widget container
    const widgetContainer = document.createElement('div');
    widgetContainer.id = containerId;
    widgetContainer.style.height = `${height}px`;
    widgetContainer.style.width = '100%';
    
    containerRef.current.appendChild(widgetContainer);

    // TradingView widget configuration
    const config = {
      autosize: true,
      symbol: `BINANCE:${symbol}`,
      interval: interval,
      timezone: "Etc/UTC",
      theme: theme,
      style: "1",
      locale: "en",
      toolbar_bg: "#f1f3f6",
      enable_publishing: false,
      allow_symbol_change: true,
      container_id: containerId,
      // Responsive design
      width: "100%",
      height: height,
      // Hide unnecessary elements for cleaner look
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      save_image: false,
      // Professional styling
      overrides: {
        "paneProperties.background": theme === 'dark' ? "#1a1a1a" : "#ffffff",
        "paneProperties.vertGridProperties.color": theme === 'dark' ? "#2a2a2a" : "#e6e6e6",
        "paneProperties.horzGridProperties.color": theme === 'dark' ? "#2a2a2a" : "#e6e6e6",
        "symbolWatermarkProperties.transparency": 90,
      }
    };

    // Create and load TradingView script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify(config);

    // Handle script loading
    script.onload = () => {
      console.log('TradingView widget loaded successfully');
    };

    script.onerror = () => {
      console.error('Failed to load TradingView widget');
      // Show fallback message
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="
            height: ${height}px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            background: #1a1a1a; 
            border-radius: 8px;
            color: white;
            text-align: center;
            padding: 2rem;
          ">
            <div>
              <div style="font-size: 48px; margin-bottom: 16px;">📈</div>
              <h3 style="margin-bottom: 8px;">Chart Unavailable</h3>
              <p style="color: #9ca3af; margin-bottom: 16px;">TradingView chart for ${symbol}</p>
              <button 
                onclick="window.location.reload()" 
                style="
                  background: #3b82f6; 
                  color: white; 
                  border: none; 
                  padding: 8px 16px; 
                  border-radius: 4px; 
                  cursor: pointer;
                "
              >
                Retry
              </button>
            </div>
          </div>
        `;
      }
    };

    // Append script to document head
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [symbol, interval, theme, height]);

  return (
    <>
      <Head>
        <script
          async
          src="https://s3.tradingview.com/tv.js"
        />
      </Head>
      <div 
        ref={containerRef}
        className="tradingview-widget-container bg-gray-900 rounded-lg border border-gray-700"
        style={{ height: `${height}px`, width: '100%' }}
      />
    </>
  );
});

TradingViewWidget.displayName = 'TradingViewWidget';

export default TradingViewWidget;
