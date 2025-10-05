import anchor from '@project-serum/anchor';
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
import { assert } from 'chai';
import * as idl from '../target/idl/perpetual_trading.json';

describe('perpetual-trading', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PerpetualTrading;
  
  // Accounts and keys
  let perpetualAccount;
  let perpetualAuthority;
  let perpetualBump;
  let baseAssetMint;
  let quoteAssetMint;
  let baseAssetVault;
  let quoteAssetVault;
  let userQuoteAccount;
  let oracleAccount;
  let positionAccount;
  
  const user = anchor.web3.Keypair.generate();
  const liquidator = anchor.web3.Keypair.generate();
  const initialMarginRatio = new anchor.BN(500); // 5%
  const maintenanceMarginRatio = new anchor.BN(250); // 2.5%
  const liquidationFee = new anchor.BN(100); // 1%
  
  before(async () => {
    // Airdrop SOL to user and liquidator
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user.publicKey, 10000000000),
      "confirmed"
    );
    
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(liquidator.publicKey, 10000000000),
      "confirmed"
    );
    
    // Create token mints
    baseAssetMint = await Token.createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      9,
      TOKEN_PROGRAM_ID
    );
    
    quoteAssetMint = await Token.createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      6, // USDC has 6 decimals
      TOKEN_PROGRAM_ID
    );
    
    // Create perpetual authority (PDA)
    [perpetualAuthority, perpetualBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("perpetual")],
      program.programId
    );
    
    // Create token accounts
    baseAssetVault = await baseAssetMint.createAccount(perpetualAuthority);
    quoteAssetVault = await quoteAssetMint.createAccount(perpetualAuthority);
    userQuoteAccount = await quoteAssetMint.createAccount(user.publicKey);
    const liquidatorQuoteAccount = await quoteAssetMint.createAccount(liquidator.publicKey);
    
    // Mint some tokens to user accounts for testing
    await quoteAssetMint.mintTo(
      userQuoteAccount,
      provider.wallet.publicKey,
      [],
      10000000000 // 10,000 USDC with 6 decimals
    );
    
    // Create a mock oracle account (in a real scenario, this would be a price feed)
    oracleAccount = anchor.web3.Keypair.generate();
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(oracleAccount.publicKey, 1000000000),
      "confirmed"
    );
    
    // Create perpetual account
    perpetualAccount = anchor.web3.Keypair.generate();
    positionAccount = anchor.web3.Keypair.generate();
  });
  
  it('Initializes the perpetual market', async () => {
    await program.rpc.initialize(
      initialMarginRatio,
      maintenanceMarginRatio,
      liquidationFee,
      {
        accounts: {
          perpetual: perpetualAccount.publicKey,
          baseAssetMint: baseAssetMint.publicKey,
          quoteAssetMint: quoteAssetMint.publicKey,
          baseAssetVault,
          quoteAssetVault,
          perpetualAuthority,
          authority: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [perpetualAccount],
      }
    );
    
    // Fetch the created account
    const account = await program.account.perpetualMarket.fetch(perpetualAccount.publicKey);
    
    // Verify it has the right data
    assert.ok(account.baseAssetMint.equals(baseAssetMint.publicKey));
    assert.ok(account.quoteAssetMint.equals(quoteAssetMint.publicKey));
    assert.ok(account.baseAssetVault.equals(baseAssetVault));
    assert.ok(account.quoteAssetVault.equals(quoteAssetVault));
    assert.ok(account.authority.equals(provider.wallet.publicKey));
    assert.ok(account.initialMarginRatio.eq(initialMarginRatio));
    assert.ok(account.maintenanceMarginRatio.eq(maintenanceMarginRatio));
    assert.ok(account.liquidationFee.eq(liquidationFee));
    assert.equal(account.totalLongPositions.toNumber(), 0);
    assert.equal(account.totalShortPositions.toNumber(), 0);
    assert.equal(account.openInterest.toNumber(), 0);
    assert.equal(account.bump, perpetualBump);
  });
  
  it('Opens a long position', async () => {
    const size = new anchor.BN(100000000); // 1 BTC (8 decimals)
    const collateral = new anchor.BN(1000000000); // 1,000 USDC (6 decimals)
    const leverage = 5;
    const maxPriceImpact = new anchor.BN(100); // 1%
    
    // Get initial balances
    const userQuoteBefore = await quoteAssetMint.getAccountInfo(userQuoteAccount);
    const vaultQuoteBefore = await quoteAssetMint.getAccountInfo(quoteAssetVault);
    
    await program.rpc.openPosition(
      size,
      collateral,
      leverage,
      maxPriceImpact,
      {
        accounts: {
          perpetual: perpetualAccount.publicKey,
          position: positionAccount.publicKey,
          quoteAssetVault,
          userQuoteAccount,
          oracle: oracleAccount.publicKey,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [user, positionAccount],
      }
    );
    
    // Get post-position balances
    const userQuoteAfter = await quoteAssetMint.getAccountInfo(userQuoteAccount);
    const vaultQuoteAfter = await quoteAssetMint.getAccountInfo(quoteAssetVault);
    
    // Verify collateral was transferred
    assert.equal(
      userQuoteBefore.amount.toNumber() - userQuoteAfter.amount.toNumber(),
      collateral.toNumber()
    );
    assert.equal(
      vaultQuoteAfter.amount.toNumber() - vaultQuoteBefore.amount.toNumber(),
      collateral.toNumber()
    );
    
    // Verify position was created correctly
    const position = await program.account.position.fetch(positionAccount.publicKey);
    assert.ok(position.owner.equals(user.publicKey));
    assert.equal(position.size.toNumber(), size.toNumber());
    assert.equal(position.collateral.toNumber(), collateral.toNumber());
    assert.equal(position.leverage, leverage);
    
    // Verify perpetual state was updated
    const perpetual = await program.account.perpetualMarket.fetch(perpetualAccount.publicKey);
    assert.equal(perpetual.totalLongPositions.toNumber(), size.toNumber());
    assert.equal(perpetual.totalShortPositions.toNumber(), 0);
    assert.equal(perpetual.openInterest.toNumber(), size.toNumber());
    
    console.log('Open long position successful!');
    console.log(`Size: ${size.toNumber() / 1e8} BTC`);
    console.log(`Collateral: ${collateral.toNumber() / 1e6} USDC`);
    console.log(`Leverage: ${leverage}x`);
  });
  
  it('Updates the funding rate', async () => {
    // Get initial funding index
    const perpetualBefore = await program.account.perpetualMarket.fetch(perpetualAccount.publicKey);
    const initialFundingIndex = perpetualBefore.fundingIndex;
    
    await program.rpc.updateFundingRate(
      {
        accounts: {
          perpetual: perpetualAccount.publicKey,
          authority: provider.wallet.publicKey,
        },
        signers: [],
      }
    );
    
    // Get updated funding rate
    const perpetualAfter = await program.account.perpetualMarket.fetch(perpetualAccount.publicKey);
    
    // Since we only have long positions, funding rate should be positive
    // (longs pay shorts)
    assert.isTrue(perpetualAfter.fundingRate > 0);
    
    // Funding index should have increased
    assert.isTrue(perpetualAfter.fundingIndex > initialFundingIndex);
    
    // Verify last funding time was updated
    assert.isTrue(perpetualAfter.lastFundingTime > 0);
    
    console.log('Funding rate updated successfully!');
    console.log(`New funding rate: ${perpetualAfter.fundingRate.toNumber()}`);
    console.log(`New funding index: ${perpetualAfter.fundingIndex.toNumber()}`);
  });
  
  it('Closes a position', async () => {
    const minReceiveAmount = new anchor.BN(800000000); // 800 USDC
    
    // Get initial balances
    const userQuoteBefore = await quoteAssetMint.getAccountInfo(userQuoteAccount);
    const vaultQuoteBefore = await quoteAssetMint.getAccountInfo(quoteAssetVault);
    
    await program.rpc.closePosition(
      minReceiveAmount,
      {
        accounts: {
          perpetual: perpetualAccount.publicKey,
          position: positionAccount.publicKey,
          quoteAssetVault,
          userQuoteAccount,
          oracle: oracleAccount.publicKey,
          perpetualAuthority,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [user],
      }
    );
    
    // Get post-close balances
    const userQuoteAfter = await quoteAssetMint.getAccountInfo(userQuoteAccount);
    const vaultQuoteAfter = await quoteAssetMint.getAccountInfo(quoteAssetVault);
    
    // Verify collateral was returned (at least the minimum amount)
    assert.isTrue(
      userQuoteAfter.amount.toNumber() - userQuoteBefore.amount.toNumber() >= minReceiveAmount.toNumber()
    );
    
    // Verify vault decreased accordingly
    assert.isTrue(
      vaultQuoteBefore.amount.toNumber() - vaultQuoteAfter.amount.toNumber() >= minReceiveAmount.toNumber()
    );
    
    // Verify perpetual state was updated
    const perpetual = await program.account.perpetualMarket.fetch(perpetualAccount.publicKey);
    assert.equal(perpetual.totalLongPositions.toNumber(), 0);
    assert.equal(perpetual.totalShortPositions.toNumber(), 0);
    assert.equal(perpetual.openInterest.toNumber(), 0);
    
    console.log('Close position successful!');
    console.log(`User received: ${(userQuoteAfter.amount.toNumber() - userQuoteBefore.amount.toNumber()) / 1e6} USDC`);
    
    // Position account should be closed (we can't fetch it anymore)
    try {
      await program.account.position.fetch(positionAccount.publicKey);
      assert.fail('Position account should be closed');
    } catch (e) {
      // Expected error
      assert.include(e.message, 'Account does not exist');
    }
  });
});
