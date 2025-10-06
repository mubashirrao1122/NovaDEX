import { TradingProvider } from '@/contexts/trading-context';
import AdvancedTradingPanel from '@/components/AdvancedTradingPanel';
import MarketMetrics from '@/components/MarketMetrics';
import OrderBook from '@/components/OrderBook';
import TradeHistory from '@/components/TradeHistory';
import PositionManagement from '@/components/PositionManagement';
import AdvancedChart from '@/components/AdvancedChart';
import LiquidityIntegration from '@/components/LiquidityIntegration';
import CrossMarginCollateral from '@/components/CrossMarginCollateral';
import OptionsTrading from '@/components/OptionsTrading';
import SocialTrading from '@/components/SocialTrading';
import YieldStrategies from '@/components/YieldStrategies';
import AdvancedOrderTypes from '@/components/AdvancedOrderTypes';
import TradingViewChart from '@/components/TradingViewChart';
import TradingViewWidget from '@/components/TradingViewWidget';
import TradingViewEmbed from '@/components/TradingViewEmbed';
import SimpleChart from '@/components/SimpleChart';
import JupiterLimitOrder from '@/components/JupiterLimitOrder';
import JupiterDCA from '@/components/JupiterDCA';
import { useState } from 'react';
import Head from 'next/head';

const TabButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
      active
        ? 'bg-primary text-black shadow-sm'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`}
  >
    {children}
  </button>
);

export default function Trading() {
  const [selectedPair, setSelectedPair] = useState('BTC-USDC');
  const [activeTab, setActiveTab] = useState('tradingview');
  const [chartInterval, setChartInterval] = useState('1H');

  return (
    <>
      <Head>
        <title>Perpetual Trading | NovaDex</title>
        <meta name="description" content="Advanced perpetual trading with up to 20x leverage on NovaDex" />
      </Head>

      <TradingProvider>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Perpetual Trading</h1>
          <p className="mt-1 text-muted-foreground">
            Experience advanced perpetual trading on NovaDex with up to 20x leverage, minimal slippage, and dynamic funding rates
          </p>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Main trading area */}
          <div className="col-span-12 lg:col-span-8">
            {/* Main Trading Tabs */}
            <div className="w-full">
              <div className="flex flex-wrap gap-2 p-2 bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-lg mb-4">
                <TabButton active={activeTab === 'tradingview'} onClick={() => setActiveTab('tradingview')}>
                  📈 TradingView Pro
                </TabButton>
                <TabButton active={activeTab === 'tradingview-widget'} onClick={() => setActiveTab('tradingview-widget')}>
                  📊 TradingView Alt
                </TabButton>
                <TabButton active={activeTab === 'tradingview-embed'} onClick={() => setActiveTab('tradingview-embed')}>
                  🔗 TradingView Embed
                </TabButton>
                <TabButton active={activeTab === 'simple-chart'} onClick={() => setActiveTab('simple-chart')}>
                  📉 Simple Chart
                </TabButton>
                <TabButton active={activeTab === 'jupiter-limit'} onClick={() => setActiveTab('jupiter-limit')}>
                  🎯 Jupiter Limit
                </TabButton>
                <TabButton active={activeTab === 'jupiter-dca'} onClick={() => setActiveTab('jupiter-dca')}>
                  ⚡ Jupiter DCA
                </TabButton>
                <TabButton active={activeTab === 'chart'} onClick={() => setActiveTab('chart')}>
                  📋 Basic Chart
                </TabButton>
                <TabButton active={activeTab === 'positions'} onClick={() => setActiveTab('positions')}>
                  💼 Positions
                </TabButton>
                <TabButton active={activeTab === 'options'} onClick={() => setActiveTab('options')}>
                  🔮 Options
                </TabButton>
                <TabButton active={activeTab === 'social'} onClick={() => setActiveTab('social')}>
                  👥 Social
                </TabButton>
                <TabButton active={activeTab === 'yield'} onClick={() => setActiveTab('yield')}>
                  Yield
                </TabButton>
              </div>
              
              {/* Tab Content */}
              <div className="mt-4">
                {activeTab === 'tradingview' && (
                  <TradingViewChart symbol={selectedPair} />
                )}
                
                {activeTab === 'tradingview-widget' && (
                  <TradingViewWidget symbol={selectedPair} />
                )}
                
                {activeTab === 'tradingview-embed' && (
                  <TradingViewEmbed symbol={selectedPair} />
                )}
                
                {activeTab === 'simple-chart' && (
                  <SimpleChart symbol={selectedPair} />
                )}
                
                {activeTab === 'jupiter-limit' && (
                  <JupiterLimitOrder />
                )}
                
                {activeTab === 'jupiter-dca' && (
                  <JupiterDCA />
                )}
                
                {activeTab === 'chart' && (
                  <AdvancedChart 
                    symbol={selectedPair}
                    interval={chartInterval}
                    onIntervalChange={setChartInterval}
                  />
                )}
                
                {activeTab === 'positions' && (
                  <PositionManagement />
                )}
                
                {activeTab === 'options' && (
                  <OptionsTrading />
                )}
                
                {activeTab === 'social' && (
                  <SocialTrading />
                )}
                
                {activeTab === 'yield' && (
                  <YieldStrategies />
                )}
              </div>
            </div>
            
            {/* Additional Trading Features */}
            <div className="mt-6">
              <div className="w-full">
                <div className="flex flex-wrap gap-2 p-2 bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-lg mb-4">
                  <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')}>
                    Advanced Orders
                  </TabButton>
                  <TabButton active={activeTab === 'liquidity'} onClick={() => setActiveTab('liquidity')}>
                    Liquidity
                  </TabButton>
                  <TabButton active={activeTab === 'margin'} onClick={() => setActiveTab('margin')}>
                    Cross Margin
                  </TabButton>
                </div>
                
                <div className="mt-4">
                  {activeTab === 'orders' && (
                    <AdvancedOrderTypes />
                  )}
                  
                  {activeTab === 'liquidity' && (
                    <LiquidityIntegration 
                      selectedPair={selectedPair}
                      onPoolSelect={(poolId) => console.log('Pool selected:', poolId)}
                    />
                  )}
                  
                  {activeTab === 'margin' && (
                    <CrossMarginCollateral 
                      onCollateralChange={(assets) => console.log('Collateral changed:', assets)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="col-span-12 space-y-4 lg:col-span-4">
            {/* Trading Panel */}
            <AdvancedTradingPanel />

            {/* Market Metrics - desktop only */}
            <div className="hidden lg:block">
              <MarketMetrics />
            </div>

            {/* Order Book - desktop only */}
            <div className="hidden lg:block">
              <OrderBook />
            </div>
          </div>
        </div>

        {/* Mobile sections */}
        <div className="mt-4 block lg:hidden">
          <div className="space-y-4">
            <MarketMetrics />
            <OrderBook />
            <TradeHistory />
          </div>
        </div>
      </TradingProvider>
    </>
  );
}
