use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo};

mod error;
mod state;

use error::ErrorCode;
use state::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod swap {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        fee_numerator: u64,
        fee_denominator: u64,
    ) -> Result<()> {
        let swap = &mut ctx.accounts.swap;
        swap.token_a_mint = ctx.accounts.token_a_mint.key();
        swap.token_b_mint = ctx.accounts.token_b_mint.key();
        swap.token_a_account = ctx.accounts.token_a_account.key();
        swap.token_b_account = ctx.accounts.token_b_account.key();
        swap.fee_numerator = fee_numerator;
        swap.fee_denominator = fee_denominator;
        swap.authority = ctx.accounts.authority.key();
        swap.bump = *ctx.bumps.get("swap_authority").unwrap();
        
        // Validate fee
        require!(
            fee_denominator > 0 && fee_numerator < fee_denominator,
            ErrorCode::InvalidFee
        );

        Ok(())
    }

    pub fn swap_tokens(ctx: Context<Swap>, amount_in: u64, minimum_amount_out: u64) -> Result<()> {
        let swap = &ctx.accounts.swap;
        let token_in_account = &ctx.accounts.token_in_account;
        let token_out_account = &ctx.accounts.token_out_account;
        let user_token_in_account = &ctx.accounts.user_token_in_account;
        let user_token_out_account = &ctx.accounts.user_token_out_account;

        // Calculate the amount out using constant product formula
        let amount_out = calculate_swap_amount(
            token_in_account.amount,
            token_out_account.amount,
            amount_in,
            swap.fee_numerator,
            swap.fee_denominator,
        );
        
        // Check slippage tolerance
        require!(
            amount_out >= minimum_amount_out,
            ErrorCode::SlippageExceeded
        );

        // Transfer tokens in
        let cpi_accounts = Transfer {
            from: user_token_in_account.to_account_info(),
            to: token_in_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount_in)?;

        // Transfer tokens out
        let cpi_accounts = Transfer {
            from: token_out_account.to_account_info(),
            to: user_token_out_account.to_account_info(),
            authority: ctx.accounts.pool_authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount_out)?;

        Ok(())
    }

    fn calculate_swap_amount(
        reserve_in: u64, 
        reserve_out: u64, 
        amount_in: u64,
        fee_numerator: u64,
        fee_denominator: u64
    ) -> u64 {
        // Calculate fee based on provided fee parameters
        let fee_multiplier = fee_denominator - fee_numerator;
        let amount_in_with_fee = amount_in * fee_multiplier;
        let numerator = amount_in_with_fee * reserve_out;
        let denominator = reserve_in * fee_denominator + amount_in_with_fee;
        numerator / denominator
    }
}

#[derive(Accounts)]
pub struct Swap<'info> {
    pub swap: Account<'info, SwapInfo>,
    #[account(mut)]
    pub token_in_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub token_out_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_in_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_out_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub pool_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}
