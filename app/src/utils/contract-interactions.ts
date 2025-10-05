import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Mock Program ID - Replace with your actual program ID
const PERPETUAL_PROGRAM_ID = new PublicKey('11111111111111111111111111111112');

/**
 * Get account info from the perpetual trading program
 */
export async function getPerpetualAccountInfo(connection: Connection, publicKey: PublicKey) {
  try {
    const accountInfo = await connection.getAccountInfo(publicKey);
    return accountInfo;
  } catch (error) {
    console.error('Error getting perpetual account info:', error);
    throw error;
  }
}

/**
 * Create a new trading account
 */
export async function createTradingAccount(
  connection: Connection,
  wallet: any,
) {
  try {
    // Create instructions to interact with your program
    // This is a simplified example - you'll need to implement the actual logic
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: PERPETUAL_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: PERPETUAL_PROGRAM_ID,
      data: Buffer.from([0]), // Create account instruction code
    });

    const transaction = new Transaction().add(instruction);
    
    // Request signature from wallet
    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  } catch (error) {
    console.error('Error creating trading account:', error);
    throw error;
  }
}

/**
 * Open a new trading position
 */
export async function openPosition(
  connection: Connection,
  wallet: any,
  market: string,
  side: 'long' | 'short',
  size: number,
  leverage: number,
  price?: number,
) {
  try {
    // Convert parameters to proper format for the instruction
    const marketPubkey = new PublicKey(market);
    const sideValue = side === 'long' ? 0 : 1;
    const sizeValue = Math.floor(size * 1_000_000); // Convert to integer with 6 decimals
    const leverageValue = Math.floor(leverage * 100); // Convert to integer with 2 decimals
    
    // Create a buffer for the instruction data
    const dataBuffer = Buffer.alloc(1 + 1 + 8 + 2 + (price ? 8 : 0));
    let offset = 0;
    
    // Instruction code for opening a position
    dataBuffer.writeUInt8(1, offset); // 1 = open position
    offset += 1;
    
    // Side (0 = long, 1 = short)
    dataBuffer.writeUInt8(sideValue, offset);
    offset += 1;
    
    // Size (as fixed-point integer)
    dataBuffer.writeBigUInt64LE(BigInt(sizeValue), offset);
    offset += 8;
    
    // Leverage (as fixed-point integer)
    dataBuffer.writeUInt16LE(leverageValue, offset);
    offset += 2;
    
    // Optional price for limit orders
    if (price) {
      dataBuffer.writeBigUInt64LE(BigInt(Math.floor(price * 1_000_000)), offset);
    }
    
    // Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: marketPubkey, isSigner: false, isWritable: true },
        { pubkey: PERPETUAL_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: PERPETUAL_PROGRAM_ID,
      data: dataBuffer,
    });
    
    const transaction = new Transaction().add(instruction);
    
    // Request signature from wallet
    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  } catch (error) {
    console.error('Error opening position:', error);
    throw error;
  }
}

/**
 * Close an existing position
 */
export async function closePosition(
  connection: Connection,
  wallet: any,
  positionId: string,
) {
  try {
    const positionPubkey = new PublicKey(positionId);
    
    // Create a buffer for the instruction data
    const dataBuffer = Buffer.alloc(1);
    dataBuffer.writeUInt8(2, 0); // 2 = close position
    
    // Create the instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: positionPubkey, isSigner: false, isWritable: true },
        { pubkey: PERPETUAL_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: PERPETUAL_PROGRAM_ID,
      data: dataBuffer,
    });
    
    const transaction = new Transaction().add(instruction);
    
    // Request signature from wallet
    const signature = await wallet.sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  } catch (error) {
    console.error('Error closing position:', error);
    throw error;
  }
}

/**
 * Get all open positions for a wallet
 */
export async function getOpenPositions(connection: Connection, walletPubkey: PublicKey) {
  try {
    // In a real implementation, you would:
    // 1. Create a program derived address (PDA) for the user's position account
    // 2. Fetch that account data
    // 3. Deserialize the account data to get positions
    
    // For now, we'll return mock data
    return [
      {
        id: 'position1',
        pair: 'ETH-USDC',
        side: 'long',
        size: 0.5,
        leverage: 10,
        entryPrice: 1820.50,
        liquidationPrice: 1638.45,
        margin: 91.025,
        pnl: 15.12,
        fundingPaid: 0.25,
        timestamp: Date.now() - 86400000
      },
      {
        id: 'position2',
        pair: 'BTC-USDC',
        side: 'short',
        size: 0.02,
        leverage: 5,
        entryPrice: 35720.80,
        liquidationPrice: 37506.84,
        margin: 142.88,
        pnl: -8.64,
        fundingPaid: -0.32,
        timestamp: Date.now() - 43200000
      }
    ];
  } catch (error) {
    console.error('Error getting open positions:', error);
    throw error;
  }
}

/**
 * Get market data for available markets
 */
export async function getMarkets(connection: Connection) {
  try {
    // In a real implementation, you would fetch this data from your program
    // For now, we'll return mock data
    return [
      {
        pair: 'ETH-USDC',
        baseToken: 'ETH',
        quoteToken: 'USDC',
        price: 1850.75,
        priceChange24h: 2.5,
        volume24h: 1250000,
        longOI: 850000,
        shortOI: 750000,
        fundingRate: 0.0001,
        nextFundingTime: Date.now() + 3600000,
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
        fundingRate: -0.0002,
        nextFundingTime: Date.now() + 3600000,
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
        fundingRate: 0.0003,
        nextFundingTime: Date.now() + 3600000,
        markPrice: 98.35,
        indexPrice: 98.30
      }
    ];
  } catch (error) {
    console.error('Error getting markets:', error);
    throw error;
  }
}
