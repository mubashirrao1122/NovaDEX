import anchor from '@project-serum/anchor';
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
import { assert } from 'chai';
import * as idl from '../target/idl/liquidity_pool.json';

describe('liquidity-pool', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.LiquidityPool;
  
  let tokenAMint;
  let tokenBMint;
  let lpMint;
  let tokenAAccount;
  let tokenBAccount;
  let userTokenAAccount;
  let userTokenBAccount;
  let userLpTokenAccount;
  let poolAccount;
  let poolAuthority;
  let poolBump;
  
  const user = anchor.web3.Keypair.generate();
  const feeNumerator = new anchor.BN(3);
  const feeDenominator = new anchor.BN(1000);
  
  before(async () => {
    // Airdrop SOL to user
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user.publicKey, 10000000000),
      "confirmed"
    );
    
    // Create token mints
    tokenAMint = await Token.createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      9,
      TOKEN_PROGRAM_ID
    );
    
    tokenBMint = await Token.createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      9,
      TOKEN_PROGRAM_ID
    );
    
    // Create pool authority (PDA)
    [poolAuthority, poolBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("pool_authority")],
      program.programId
    );
    
    // Create LP mint
    lpMint = await Token.createMint(
      provider.connection,
      provider.wallet.payer,
      poolAuthority,
      null,
      9,
      TOKEN_PROGRAM_ID
    );
    
    // Create token accounts
    tokenAAccount = await tokenAMint.createAccount(poolAuthority);
    tokenBAccount = await tokenBMint.createAccount(poolAuthority);
    userTokenAAccount = await tokenAMint.createAccount(user.publicKey);
    userTokenBAccount = await tokenBMint.createAccount(user.publicKey);
    userLpTokenAccount = await lpMint.createAccount(user.publicKey);
    
    // Mint some tokens to user accounts for testing
    await tokenAMint.mintTo(
      userTokenAAccount,
      provider.wallet.publicKey,
      [],
      1000000000000 // 1000 tokens with 9 decimals
    );
    
    await tokenBMint.mintTo(
      userTokenBAccount,
      provider.wallet.publicKey,
      [],
      1000000000000 // 1000 tokens with 9 decimals
    );
    
    // Create pool account
    poolAccount = anchor.web3.Keypair.generate();
  });
  
  it('Initializes the pool', async () => {
    await program.rpc.initializePool(
      feeNumerator,
      feeDenominator,
      {
        accounts: {
          pool: poolAccount.publicKey,
          tokenAMint: tokenAMint.publicKey,
          tokenBMint: tokenBMint.publicKey,
          tokenAAccount: tokenAAccount,
          tokenBAccount: tokenBAccount,
          lpMint: lpMint.publicKey,
          poolAuthority,
          authority: provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [poolAccount],
      }
    );
    
    // Fetch the created account
    const account = await program.account.poolState.fetch(poolAccount.publicKey);
    
    // Verify it has the right data
    assert.ok(account.tokenAMint.equals(tokenAMint.publicKey));
    assert.ok(account.tokenBMint.equals(tokenBMint.publicKey));
    assert.ok(account.tokenAAccount.equals(tokenAAccount));
    assert.ok(account.tokenBAccount.equals(tokenBAccount));
    assert.ok(account.lpMint.equals(lpMint.publicKey));
    assert.ok(account.authority.equals(provider.wallet.publicKey));
    assert.ok(account.feeNumerator.eq(feeNumerator));
    assert.ok(account.feeDenominator.eq(feeDenominator));
    assert.equal(account.bump, poolBump);
    assert.equal(account.totalShares.toNumber(), 0);
  });
  
  it('Adds liquidity to the pool', async () => {
    const amountADesired = new anchor.BN(100000000000); // 100 tokens
    const amountBDesired = new anchor.BN(200000000000); // 200 tokens
    const amountAMin = new anchor.BN(99000000000);     // 99 tokens
    const amountBMin = new anchor.BN(198000000000);    // 198 tokens
    
    // Get initial balances
    const userTokenABefore = await tokenAMint.getAccountInfo(userTokenAAccount);
    const userTokenBBefore = await tokenBMint.getAccountInfo(userTokenBAccount);
    const userLpBefore = await lpMint.getAccountInfo(userLpTokenAccount);
    
    await program.rpc.addLiquidity(
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      {
        accounts: {
          pool: poolAccount.publicKey,
          tokenAAccount: tokenAAccount,
          tokenBAccount: tokenBAccount,
          lpMint: lpMint.publicKey,
          userTokenA: userTokenAAccount,
          userTokenB: userTokenBAccount,
          userLpToken: userLpTokenAccount,
          poolAuthority,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [user],
      }
    );
    
    // Get post-liquidity balances
    const userTokenAAfter = await tokenAMint.getAccountInfo(userTokenAAccount);
    const userTokenBAfter = await tokenBMint.getAccountInfo(userTokenBAccount);
    const userLpAfter = await lpMint.getAccountInfo(userLpTokenAccount);
    const poolTokenA = await tokenAMint.getAccountInfo(tokenAAccount);
    const poolTokenB = await tokenBMint.getAccountInfo(tokenBAccount);
    
    // Verify user token balances decreased
    assert.isTrue(userTokenABefore.amount.toNumber() > userTokenAAfter.amount.toNumber());
    assert.isTrue(userTokenBBefore.amount.toNumber() > userTokenBAfter.amount.toNumber());
    
    // Verify pool received tokens
    assert.equal(poolTokenA.amount.toNumber(), amountADesired.toNumber());
    assert.equal(poolTokenB.amount.toNumber(), amountBDesired.toNumber());
    
    // Verify user received LP tokens
    assert.isTrue(userLpAfter.amount.toNumber() > userLpBefore.amount.toNumber());
    
    // Verify pool state updated
    const poolState = await program.account.poolState.fetch(poolAccount.publicKey);
    assert.equal(poolState.totalShares.toNumber(), userLpAfter.amount.toNumber());
    
    console.log('Add liquidity successful!');
    console.log(`User sent: ${amountADesired.toNumber() / 1e9} Token A and ${amountBDesired.toNumber() / 1e9} Token B`);
    console.log(`User received: ${userLpAfter.amount.toNumber() / 1e9} LP tokens`);
  });
  
  it('Swaps tokens through the pool', async () => {
    const amountIn = new anchor.BN(10000000000); // 10 tokens
    const minimumAmountOut = new anchor.BN(18000000000); // 18 tokens
    
    // Get initial balances
    const userTokenABefore = await tokenAMint.getAccountInfo(userTokenAAccount);
    const userTokenBBefore = await tokenBMint.getAccountInfo(userTokenBAccount);
    
    await program.rpc.swap(
      amountIn,
      minimumAmountOut,
      {
        accounts: {
          pool: poolAccount.publicKey,
          tokenInAccount: tokenAAccount,
          tokenOutAccount: tokenBAccount,
          userTokenIn: userTokenAAccount,
          userTokenOut: userTokenBAccount,
          poolAuthority,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [user],
      }
    );
    
    // Get post-swap balances
    const userTokenAAfter = await tokenAMint.getAccountInfo(userTokenAAccount);
    const userTokenBAfter = await tokenBMint.getAccountInfo(userTokenBAccount);
    
    // Verify token A decreased and token B increased
    assert.equal(userTokenABefore.amount.toNumber() - userTokenAAfter.amount.toNumber(), amountIn.toNumber());
    assert.isTrue(userTokenBAfter.amount.toNumber() > userTokenBBefore.amount.toNumber());
    assert.isTrue(userTokenBAfter.amount.toNumber() - userTokenBBefore.amount.toNumber() >= minimumAmountOut.toNumber());
    
    console.log('Swap through pool successful!');
    console.log(`User sent: ${amountIn.toNumber() / 1e9} Token A`);
    console.log(`User received: ${(userTokenBAfter.amount.toNumber() - userTokenBBefore.amount.toNumber()) / 1e9} Token B`);
  });
  
  it('Removes liquidity from the pool', async () => {
    // Get the current LP balance
    const userLpInfo = await lpMint.getAccountInfo(userLpTokenAccount);
    const shares = userLpInfo.amount;
    
    // We'll remove half of the LP tokens
    const sharesToRemove = new anchor.BN(shares.toNumber() / 2);
    const amountAMin = new anchor.BN(40000000000); // 40 tokens
    const amountBMin = new anchor.BN(80000000000); // 80 tokens
    
    // Get initial balances
    const userTokenABefore = await tokenAMint.getAccountInfo(userTokenAAccount);
    const userTokenBBefore = await tokenBMint.getAccountInfo(userTokenBAccount);
    const userLpBefore = await lpMint.getAccountInfo(userLpTokenAccount);
    
    await program.rpc.removeLiquidity(
      sharesToRemove,
      amountAMin,
      amountBMin,
      {
        accounts: {
          pool: poolAccount.publicKey,
          tokenAAccount: tokenAAccount,
          tokenBAccount: tokenBAccount,
          lpMint: lpMint.publicKey,
          userTokenA: userTokenAAccount,
          userTokenB: userTokenBAccount,
          userLpToken: userLpTokenAccount,
          poolAuthority,
          user: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [user],
      }
    );
    
    // Get post-removal balances
    const userTokenAAfter = await tokenAMint.getAccountInfo(userTokenAAccount);
    const userTokenBAfter = await tokenBMint.getAccountInfo(userTokenBAccount);
    const userLpAfter = await lpMint.getAccountInfo(userLpTokenAccount);
    
    // Verify user token balances increased
    assert.isTrue(userTokenAAfter.amount.toNumber() > userTokenABefore.amount.toNumber());
    assert.isTrue(userTokenBAfter.amount.toNumber() > userTokenBBefore.amount.toNumber());
    
    // Verify LP tokens were burned
    assert.equal(userLpBefore.amount.toNumber() - userLpAfter.amount.toNumber(), sharesToRemove.toNumber());
    
    // Verify pool state updated
    const poolState = await program.account.poolState.fetch(poolAccount.publicKey);
    assert.equal(poolState.totalShares.toNumber(), userLpAfter.amount.toNumber());
    
    console.log('Remove liquidity successful!');
    console.log(`User burned: ${sharesToRemove.toNumber() / 1e9} LP tokens`);
    console.log(`User received: ${(userTokenAAfter.amount.toNumber() - userTokenABefore.amount.toNumber()) / 1e9} Token A and ${(userTokenBAfter.amount.toNumber() - userTokenBBefore.amount.toNumber()) / 1e9} Token B`);
  });
});
