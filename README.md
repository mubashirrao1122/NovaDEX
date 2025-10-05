# NovaDex

An advanced decentralized exchange built on the Solana blockchain featuring token swapping, liquidity pools, and sophisticated perpetual trading with up to 20x leverage.

## Project Overview

NovaDex is a next-generation DEX that combines traditional AMM functionality with advanced perpetual trading features, delivering a comprehensive DeFi trading experience on Solana's high-performance blockchain.

## Project Structure

- `/programs`: Smart contracts written in Rust for the Solana blockchain
  - `/swap`: The swap program for token swapping functionality
- `/app`: Frontend application built with Next.js and React
  - `/src`: Source code for the frontend
    - `/components`: React components for the UI
    - `/pages`: Next.js pages
    - `/styles`: CSS styles
    - `/contexts`: React context providers for state management

## Features

### Core DEX Features
- Token Swapping
- Liquidity Pools
- Modern UI with Wallet Integration

### Advanced Perpetual Trading
- **High Leverage Trading**: Trade with up to 20x leverage for increased capital efficiency
- **Low Slippage**: Advanced order matching and deep liquidity for minimal price impact
- **Real-time Funding Rates**: Dynamic funding rate mechanism updated every 8 hours
- **Advanced Order Types**: Market, Limit, Stop Loss, and Take Profit orders
- **Position Management**: Easily track and manage open positions with detailed analytics
- **Order Book Visualization**: Real-time order book data with depth visualization
- **Trade History**: Live trade feed with transaction details

## Development Setup

### Prerequisites

- Solana CLI tools
- Anchor Framework
- Node.js and npm/yarn
- Rust and Cargo

### Backend (Smart Contracts)

1. Build the smart contracts:
   ```
   anchor build
   ```

2. Deploy to localnet:
   ```
   anchor deploy
   ```

3. Run tests:
   ```
   anchor test
   ```

### Frontend

1. Navigate to the app directory:
   ```
   cd app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run development server:
   ```
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## License

MIT
