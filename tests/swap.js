import anchor from '@project-serum/anchor';
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
import { assert } from 'chai';
import * as idl from '../target/idl/swap.json';

describe('swap', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Swap;
  
  let tokenAMint;
  let tokenBMint;
  let tokenAAccount;
  let tokenBAccount;
  let userTokenAAccount;
  let userTokenBAccount;
  let swapAccount;
  let swapAuthority;
  let swapBump;
  
  const user = anchor.web3.Keypair.generate();
  const feeNumerator = new anchor.BN(3);
  const feeDenominator = new anchor.BN(1000);
  
  before(async () => {
    // Airdrop SOL to user
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user.publicKey, 10000000000),
      "confirmed"
    );
    
    // Create token mints and token accounts
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
    
    // Create swap authority (PDA)
    [swapAuthority, swapBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("swap_authority")],
      program.programId
    );
    
    // Create token accounts
    tokenAAccount = await tokenAMint.createAccount(swapAuthority);
    tokenBAccount = await tokenBMint.createAccount(swapAuthority);
    userTokenAAccount = await tokenAMint.createAccount(user.publicKey);
    userTokenBAccount = await tokenBMint.createAccount(user.publicKey);
    
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
    
    // Create swap account
    swapAccount = anchor.web3.Keypair.generate();
  });
  
  it('Initializes the swap', async () => {
    await program.rpc.initialize(
      feeNumerator,
      feeDenominator,
      {
        accounts: {
          tokenAMint: tokenAMint.publicKey,
          tokenBMint: tokenBMint.publicKey,
          tokenAAccount: tokenAAccount,
          tokenBAccount: tokenBAccount,
          authority: provider.wallet.publicKey,
          swap: swapAccount.publicKey,
          swapAuthority,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [swapAccount],
      }
    );
    
    // Fetch the created account
    const account = await program.account.swapInfo.fetch(swapAccount.publicKey);
    
    // Verify it has the right data
    assert.ok(account.tokenAMint.equals(tokenAMint.publicKey));
    assert.ok(account.tokenBMint.equals(tokenBMint.publicKey));
    assert.ok(account.tokenAAccount.equals(tokenAAccount));
    assert.ok(account.tokenBAccount.equals(tokenBAccount));
    assert.ok(account.authority.equals(provider.wallet.publicKey));
    assert.ok(account.feeNumerator.eq(feeNumerator));
    assert.ok(account.feeDenominator.eq(feeDenominator));
    assert.equal(account.bump, swapBump);
  });
  
  it('Adds initial liquidity', async () => {
    // First, transfer some tokens to the swap accounts to simulate adding liquidity
    await tokenAMint.transfer(
      userTokenAAccount,
      tokenAAccount,
      user.publicKey,
      [],
      100000000000 // 100 tokens
    );
    
    await tokenBMint.transfer(
      userTokenBAccount,
      tokenBAccount,
      user.publicKey,
      [],
      200000000000 // 200 tokens
    );
    
    // Verify the balances
    const tokenAAccountInfo = await tokenAMint.getAccountInfo(tokenAAccount);
    const tokenBAccountInfo = await tokenBMint.getAccountInfo(tokenBAccount);
    
    assert.equal(tokenAAccountInfo.amount.toNumber(), 100000000000);
    assert.equal(tokenBAccountInfo.amount.toNumber(), 200000000000);
  });
  
  it('Executes a swap', async () => {
    const amountIn = new anchor.BN(10000000000); // 10 tokens
    const minimumAmountOut = new anchor.BN(18000000000); // 18 tokens
    
    // Note: In a real scenario, we would need to properly sign as the user
    // This example assumes the provider has signing authority
    
    // Get initial balances
    const userTokenABefore = await tokenAMint.getAccountInfo(userTokenAAccount);
    const userTokenBBefore = await tokenBMint.getAccountInfo(userTokenBAccount);
    const swapTokenABefore = await tokenAMint.getAccountInfo(tokenAAccount);
    const swapTokenBBefore = await tokenBMint.getAccountInfo(tokenBAccount);
    
    await program.rpc.swapTokens(
      amountIn,
      minimumAmountOut,
      {
        accounts: {
          swap: swapAccount.publicKey,
          tokenInAccount: tokenAAccount,
          tokenOutAccount: tokenBAccount,
          userTokenInAccount: userTokenAAccount,
          userTokenOutAccount: userTokenBAccount,
          user: provider.wallet.publicKey,
          poolAuthority: swapAuthority,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [],
      }
    );
    
    // Get post-swap balances
    const userTokenAAfter = await tokenAMint.getAccountInfo(userTokenAAccount);
    const userTokenBAfter = await tokenBMint.getAccountInfo(userTokenBAccount);
    const swapTokenAAfter = await tokenAMint.getAccountInfo(tokenAAccount);
    const swapTokenBAfter = await tokenBMint.getAccountInfo(tokenBAccount);
    
    // Verify the balances changed as expected
    assert.equal(
      userTokenABefore.amount.toNumber() - userTokenAAfter.amount.toNumber(),
      amountIn.toNumber()
    );
    assert.isTrue(
      userTokenBAfter.amount.toNumber() > userTokenBBefore.amount.toNumber()
    );
    assert.isTrue(
      userTokenBAfter.amount.toNumber() - userTokenBBefore.amount.toNumber() >= minimumAmountOut.toNumber()
    );
    
    // Verify swap pool balances
    assert.equal(
      swapTokenAAfter.amount.toNumber() - swapTokenABefore.amount.toNumber(),
      amountIn.toNumber()
    );
    assert.isTrue(
      swapTokenBBefore.amount.toNumber() - swapTokenBAfter.amount.toNumber() > 0
    );
    
    console.log('Swap successful!');
    console.log(`User sent: ${amountIn.toNumber() / 1e9} Token A`);
    console.log(`User received: ${(userTokenBAfter.amount.toNumber() - userTokenBBefore.amount.toNumber()) / 1e9} Token B`);
  });
});
