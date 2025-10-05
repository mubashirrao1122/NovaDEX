use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod liquidity_pool {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        fee_numerator: u64,
        fee_denominator: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        
        // Initialize pool state
        pool.token_a_mint = ctx.accounts.token_a_mint.key();
        pool.token_b_mint = ctx.accounts.token_b_mint.key();
        pool.token_a_account = ctx.accounts.token_a_account.key();
        pool.token_b_account = ctx.accounts.token_b_account.key();
        pool.lp_mint = ctx.accounts.lp_mint.key();
        pool.fee_numerator = fee_numerator;
        pool.fee_denominator = fee_denominator;
        pool.authority = ctx.accounts.authority.key();
        
        // Validate fee
        require!(
            fee_denominator > 0 && fee_numerator < fee_denominator,
            ErrorCode::InvalidFee
        );

        Ok(())
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>, 
        amount_a: u64, 
        amount_b: u64, 
        min_lp_tokens: u64
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let token_a_account = &ctx.accounts.token_a_account;
        let token_b_account = &ctx.accounts.token_b_account;
        
        // Current balances
        let reserve_a = token_a_account.amount;
        let reserve_b = token_b_account.amount;
        let total_supply = ctx.accounts.lp_mint.supply;
        
        let lp_tokens_to_mint: u64;
        
        // If first deposit, mint LP tokens proportional to sqrt(amount_a * amount_b)
        if total_supply == 0 {
            // Simple calculation for first deposit
            lp_tokens_to_mint = (amount_a as u128).checked_mul(amount_b as u128)
                .unwrap()
                .checked_sqrt()
                .unwrap() as u64;
        } else {
            // Calculate proportional LP tokens
            let deposit_percentage = std::cmp::min(
                (amount_a as u128).checked_mul(total_supply as u128).unwrap()
                    .checked_div(reserve_a as u128).unwrap(),
                (amount_b as u128).checked_mul(total_supply as u128).unwrap()
                    .checked_div(reserve_b as u128).unwrap()
            ) as u64;
            
            lp_tokens_to_mint = deposit_percentage;
        }
        
        require!(
            lp_tokens_to_mint >= min_lp_tokens,
            ErrorCode::SlippageExceeded
        );
        
        // Transfer tokens from user to pool
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_a.to_account_info(),
                    to: token_a_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_a,
        )?;
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_b.to_account_info(),
                    to: token_b_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_b,
        )?;
        
        // Mint LP tokens to user
        let pool_authority_seeds = &[
            pool.to_account_info().key.as_ref(),
            &[pool.bump],
        ];
        
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.lp_mint.to_account_info(),
                    to: ctx.accounts.user_lp_token.to_account_info(),
                    authority: ctx.accounts.pool_authority.to_account_info(),
                },
                &[pool_authority_seeds],
            ),
            lp_tokens_to_mint,
        )?;
        
        Ok(())
    }

    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_amount: u64,
        min_amount_a: u64,
        min_amount_b: u64,
    ) -> Result<()> {
        let pool = &ctx.accounts.pool;
        let total_supply = ctx.accounts.lp_mint.supply;
        
        // Calculate token amounts to withdraw based on LP token proportion
        let token_a_amount = (lp_amount as u128)
            .checked_mul(ctx.accounts.token_a_account.amount as u128)
            .unwrap()
            .checked_div(total_supply as u128)
            .unwrap() as u64;
            
        let token_b_amount = (lp_amount as u128)
            .checked_mul(ctx.accounts.token_b_account.amount as u128)
            .unwrap()
            .checked_div(total_supply as u128)
            .unwrap() as u64;
        
        // Check slippage tolerance
        require!(
            token_a_amount >= min_amount_a && token_b_amount >= min_amount_b,
            ErrorCode::SlippageExceeded
        );
        
        // Burn LP tokens
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.lp_mint.to_account_info(),
                    from: ctx.accounts.user_lp_token.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            lp_amount,
        )?;
        
        // Transfer tokens to user
        let pool_authority_seeds = &[
            pool.to_account_info().key.as_ref(),
            &[pool.bump],
        ];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_a_account.to_account_info(),
                    to: ctx.accounts.user_token_a.to_account_info(),
                    authority: ctx.accounts.pool_authority.to_account_info(),
                },
                &[pool_authority_seeds],
            ),
            token_a_amount,
        )?;
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.token_b_account.to_account_info(),
                    to: ctx.accounts.user_token_b.to_account_info(),
                    authority: ctx.accounts.pool_authority.to_account_info(),
                },
                &[pool_authority_seeds],
            ),
            token_b_amount,
        )?;
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(fee_numerator: u64, fee_denominator: u64)]
pub struct InitializePool<'info> {
    #[account(init, payer = authority, space = 8 + LiquidityPool::LEN)]
    pub pool: Account<'info, LiquidityPool>,
    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,
    #[account(
        constraint = token_a_account.mint == token_a_mint.key(),
        constraint = token_a_account.owner == pool_authority.key()
    )]
    pub token_a_account: Account<'info, TokenAccount>,
    #[account(
        constraint = token_b_account.mint == token_b_mint.key(),
        constraint = token_b_account.owner == pool_authority.key()
    )]
    pub token_b_account: Account<'info, TokenAccount>,
    pub lp_mint: Account<'info, Mint>,
    /// CHECK: This is the PDA that will manage token accounts
    #[account(seeds = [pool.key().as_ref()], bump)]
    pub pool_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(
        mut,
        constraint = token_a_account.mint == pool.token_a_mint,
        constraint = token_a_account.owner == pool_authority.key()
    )]
    pub token_a_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = token_b_account.mint == pool.token_b_mint,
        constraint = token_b_account.owner == pool_authority.key()
    )]
    pub token_b_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = lp_mint.key() == pool.lp_mint
    )]
    pub lp_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_lp_token: Account<'info, TokenAccount>,
    /// CHECK: This is the PDA that will manage token accounts
    #[account(seeds = [pool.key().as_ref()], bump = pool.bump)]
    pub pool_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, LiquidityPool>,
    #[account(
        mut,
        constraint = token_a_account.mint == pool.token_a_mint,
        constraint = token_a_account.owner == pool_authority.key()
    )]
    pub token_a_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = token_b_account.mint == pool.token_b_mint,
        constraint = token_b_account.owner == pool_authority.key()
    )]
    pub token_b_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = lp_mint.key() == pool.lp_mint
    )]
    pub lp_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_lp_token: Account<'info, TokenAccount>,
    /// CHECK: This is the PDA that will manage token accounts
    #[account(seeds = [pool.key().as_ref()], bump = pool.bump)]
    pub pool_authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct LiquidityPool {
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub token_a_account: Pubkey,
    pub token_b_account: Pubkey,
    pub lp_mint: Pubkey,
    pub fee_numerator: u64,
    pub fee_denominator: u64,
    pub authority: Pubkey,
    pub bump: u8,
}

impl LiquidityPool {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 32 + 8 + 8 + 32 + 1;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid fee configuration")]
    InvalidFee,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
}
