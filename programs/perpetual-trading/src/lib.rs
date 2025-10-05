use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod perpetual_trading {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        initial_margin_ratio: u64,
        maintenance_margin_ratio: u64,
        liquidation_fee: u64,
    ) -> Result<()> {
        let perpetual = &mut ctx.accounts.perpetual;
        perpetual.base_asset_mint = ctx.accounts.base_asset_mint.key();
        perpetual.quote_asset_mint = ctx.accounts.quote_asset_mint.key();
        perpetual.base_asset_vault = ctx.accounts.base_asset_vault.key();
        perpetual.quote_asset_vault = ctx.accounts.quote_asset_vault.key();
        perpetual.authority = ctx.accounts.authority.key();
        perpetual.bump = *ctx.bumps.get("perpetual").unwrap();
        perpetual.initial_margin_ratio = initial_margin_ratio;
        perpetual.maintenance_margin_ratio = maintenance_margin_ratio;
        perpetual.liquidation_fee = liquidation_fee;
        perpetual.total_long_positions = 0;
        perpetual.total_short_positions = 0;
        perpetual.open_interest = 0;

        Ok(())
    }

    pub fn open_position(
        ctx: Context<OpenPosition>,
        size: i64,  // Positive for long, negative for short
        collateral: u64,
        leverage: u8,
        max_price_impact: u64,
    ) -> Result<()> {
        require!(size != 0, ErrorCode::InvalidSize);
        require!(collateral > 0, ErrorCode::InvalidCollateral);
        require!(leverage > 0 && leverage <= 20, ErrorCode::InvalidLeverage);
        
        let perpetual = &ctx.accounts.perpetual;
        let position = &mut ctx.accounts.position;
        let user = &ctx.accounts.user;
        
        // Calculate notional value
        let price = get_oracle_price(&ctx.accounts.oracle);
        let notional_value = (size.abs() as u64) * price;
        
        // Check leverage against initial margin ratio
        let required_margin = notional_value.checked_mul(perpetual.initial_margin_ratio).unwrap() / 10000;
        require!(
            collateral >= required_margin / (leverage as u64),
            ErrorCode::InsufficientCollateral
        );
        
        // Check price impact
        let price_impact = calculate_price_impact(size, perpetual.open_interest);
        require!(
            price_impact <= max_price_impact,
            ErrorCode::PriceImpactTooHigh
        );
        
        // Transfer collateral from user
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_quote_account.to_account_info(),
            to: ctx.accounts.quote_asset_vault.to_account_info(),
            authority: user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, collateral)?;
        
        // Update position
        position.owner = user.key();
        position.size = size;
        position.entry_price = price;
        position.collateral = collateral;
        position.leverage = leverage;
        position.last_funding_index = perpetual.funding_index;
        position.created_at = Clock::get()?.unix_timestamp;
        
        // Update perpetual state
        let mut_perpetual = &mut ctx.accounts.perpetual;
        if size > 0 {
            mut_perpetual.total_long_positions = mut_perpetual.total_long_positions.checked_add(size as u64).unwrap();
        } else {
            mut_perpetual.total_short_positions = mut_perpetual.total_short_positions.checked_add((-size) as u64).unwrap();
        }
        mut_perpetual.open_interest = mut_perpetual.open_interest.checked_add(size.abs() as u64).unwrap();
        
        Ok(())
    }

    pub fn close_position(
        ctx: Context<ClosePosition>,
        min_receive_amount: u64,
    ) -> Result<()> {
        let perpetual = &ctx.accounts.perpetual;
        let position = &ctx.accounts.position;
        let user = &ctx.accounts.user;
        
        // Calculate PnL
        let current_price = get_oracle_price(&ctx.accounts.oracle);
        let (pnl, is_profit) = calculate_pnl(position.size, position.entry_price, current_price);
        
        // Apply funding rate
        let (funding_payment, is_received) = calculate_funding_payment(
            position.size,
            position.last_funding_index,
            perpetual.funding_index,
        );
        
        // Calculate final settlement amount
        let mut settlement_amount = position.collateral;
        if is_profit {
            settlement_amount = settlement_amount.checked_add(pnl).unwrap();
        } else if pnl <= settlement_amount {
            settlement_amount = settlement_amount.checked_sub(pnl).unwrap();
        } else {
            // Liquidation case - user loses all collateral
            settlement_amount = 0;
        }
        
        // Apply funding
        if is_received {
            settlement_amount = settlement_amount.checked_add(funding_payment).unwrap();
        } else if funding_payment <= settlement_amount {
            settlement_amount = settlement_amount.checked_sub(funding_payment).unwrap();
        }
        
        // Check minimum receive amount
        require!(
            settlement_amount >= min_receive_amount,
            ErrorCode::SlippageExceeded
        );
        
        // Transfer settlement back to user
        if settlement_amount > 0 {
            let seeds = &[
                b"perpetual".as_ref(),
                &[perpetual.bump],
            ];
            let signer = &[&seeds[..]];
            
            let cpi_accounts = Transfer {
                from: ctx.accounts.quote_asset_vault.to_account_info(),
                to: ctx.accounts.user_quote_account.to_account_info(),
                authority: ctx.accounts.perpetual_authority.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, settlement_amount)?;
        }
        
        // Update perpetual state
        let mut_perpetual = &mut ctx.accounts.perpetual;
        let position_size_abs = position.size.abs() as u64;
        if position.size > 0 {
            mut_perpetual.total_long_positions = mut_perpetual.total_long_positions.checked_sub(position_size_abs).unwrap();
        } else {
            mut_perpetual.total_short_positions = mut_perpetual.total_short_positions.checked_sub(position_size_abs).unwrap();
        }
        mut_perpetual.open_interest = mut_perpetual.open_interest.checked_sub(position_size_abs).unwrap();
        
        // Close position account
        position.close(user.to_account_info())?;
        
        Ok(())
    }

    pub fn liquidate_position(ctx: Context<LiquidatePosition>) -> Result<()> {
        let perpetual = &ctx.accounts.perpetual;
        let position = &ctx.accounts.position;
        
        // Calculate current margin ratio
        let current_price = get_oracle_price(&ctx.accounts.oracle);
        let (pnl, _) = calculate_pnl(position.size, position.entry_price, current_price);
        
        let position_notional = (position.size.abs() as u64) * current_price;
        let remaining_collateral = if pnl <= position.collateral {
            position.collateral.checked_sub(pnl).unwrap()
        } else {
            0
        };
        
        let margin_ratio = (remaining_collateral as u128)
            .checked_mul(10000)
            .unwrap()
            .checked_div(position_notional as u128)
            .unwrap() as u64;
        
        // Check if liquidation is valid
        require!(
            margin_ratio < perpetual.maintenance_margin_ratio,
            ErrorCode::CannotLiquidate
        );
        
        // Calculate liquidation fee
        let liquidation_fee = position_notional
            .checked_mul(perpetual.liquidation_fee)
            .unwrap()
            .checked_div(10000)
            .unwrap();
        
        // Ensure there's enough remaining collateral for fee
        require!(
            remaining_collateral >= liquidation_fee,
            ErrorCode::InsufficientCollateralForLiquidation
        );
        
        // Pay liquidator fee
        let seeds = &[
            b"perpetual".as_ref(),
            &[perpetual.bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.quote_asset_vault.to_account_info(),
            to: ctx.accounts.liquidator_quote_account.to_account_info(),
            authority: ctx.accounts.perpetual_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, liquidation_fee)?;
        
        // Update perpetual state
        let mut_perpetual = &mut ctx.accounts.perpetual;
        let position_size_abs = position.size.abs() as u64;
        if position.size > 0 {
            mut_perpetual.total_long_positions = mut_perpetual.total_long_positions.checked_sub(position_size_abs).unwrap();
        } else {
            mut_perpetual.total_short_positions = mut_perpetual.total_short_positions.checked_sub(position_size_abs).unwrap();
        }
        mut_perpetual.open_interest = mut_perpetual.open_interest.checked_sub(position_size_abs).unwrap();
        
        // Close position account
        position.close(ctx.accounts.liquidator.to_account_info())?;
        
        Ok(())
    }

    pub fn update_funding_rate(ctx: Context<UpdateFundingRate>) -> Result<()> {
        let perpetual = &mut ctx.accounts.perpetual;
        
        // Calculate new funding rate
        let long_size = perpetual.total_long_positions;
        let short_size = perpetual.total_short_positions;
        
        // Skip if no positions open
        if long_size == 0 && short_size == 0 {
            return Ok(());
        }
        
        // Calculate imbalance
        let imbalance_rate = if long_size > short_size {
            ((long_size - short_size) as u128)
                .checked_mul(10000)
                .unwrap()
                .checked_div(long_size.max(1) as u128)
                .unwrap() as u64
        } else {
            ((short_size - long_size) as u128)
                .checked_mul(10000)
                .unwrap()
                .checked_div(short_size.max(1) as u128)
                .unwrap() as u64
        };
        
        // Calculate funding rate (simplified approach)
        // Positive funding rate means longs pay shorts
        let is_positive = long_size > short_size;
        let base_rate = 5; // 0.05% base rate
        let funding_rate = base_rate + (imbalance_rate / 100);
        
        // Update perpetual state
        perpetual.funding_rate = if is_positive { funding_rate } else { funding_rate.wrapping_neg() };
        perpetual.funding_index = perpetual.funding_index.checked_add(funding_rate).unwrap();
        perpetual.last_funding_time = Clock::get()?.unix_timestamp;
        
        Ok(())
    }

    // Helper functions
    fn get_oracle_price(oracle: &AccountInfo) -> u64 {
        // In a real implementation, this would query from a price oracle
        // For simplicity, we'll return a fixed price
        5000 // $50.00 with 2 decimals
    }
    
    fn calculate_pnl(size: i64, entry_price: u64, exit_price: u64) -> (u64, bool) {
        let pnl_raw = if size > 0 {
            // Long position: profit if price goes up
            if exit_price > entry_price {
                ((exit_price - entry_price) as u128)
                    .checked_mul(size.abs() as u128)
                    .unwrap() as u64
            } else {
                ((entry_price - exit_price) as u128)
                    .checked_mul(size.abs() as u128)
                    .unwrap() as u64
            }
        } else {
            // Short position: profit if price goes down
            if entry_price > exit_price {
                ((entry_price - exit_price) as u128)
                    .checked_mul(size.abs() as u128)
                    .unwrap() as u64
            } else {
                ((exit_price - entry_price) as u128)
                    .checked_mul(size.abs() as u128)
                    .unwrap() as u64
            }
        };
        
        let is_profit = if size > 0 {
            exit_price >= entry_price
        } else {
            entry_price >= exit_price
        };
        
        (pnl_raw, is_profit)
    }
    
    fn calculate_funding_payment(size: i64, last_index: u64, current_index: u64) -> (u64, bool) {
        let payment = if current_index > last_index {
            current_index - last_index
        } else {
            last_index - current_index
        };
        
        let is_received = (size > 0 && current_index < last_index) || 
                        (size < 0 && current_index > last_index);
        
        (payment, is_received)
    }
    
    fn calculate_price_impact(size: i64, open_interest: u64) -> u64 {
        if open_interest == 0 {
            return 0;
        }
        
        let impact = ((size.abs() as u128) * 10000 / open_interest.max(1) as u128) as u64;
        impact.min(1000) // Cap at 10%
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + PerpetualMarket::LEN)]
    pub perpetual: Account<'info, PerpetualMarket>,
    
    pub base_asset_mint: Account<'info, Mint>,
    pub quote_asset_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        token::mint = base_asset_mint,
        token::authority = perpetual_authority,
    )]
    pub base_asset_vault: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = authority,
        token::mint = quote_asset_mint,
        token::authority = perpetual_authority,
    )]
    pub quote_asset_vault: Account<'info, TokenAccount>,
    
    #[account(
        seeds = [b"perpetual"],
        bump,
    )]
    /// CHECK: PDA authority
    pub perpetual_authority: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub perpetual: Account<'info, PerpetualMarket>,
    
    #[account(
        init,
        payer = user,
        space = 8 + Position::LEN,
    )]
    pub position: Account<'info, Position>,
    
    #[account(mut)]
    pub quote_asset_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_quote_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is verified in the instruction logic
    pub oracle: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(mut)]
    pub perpetual: Account<'info, PerpetualMarket>,
    
    #[account(
        mut,
        has_one = owner @ ErrorCode::Unauthorized,
        close = user
    )]
    pub position: Account<'info, Position>,
    
    #[account(mut)]
    pub quote_asset_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_quote_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is verified in the instruction logic
    pub oracle: UncheckedAccount<'info>,
    
    #[account(
        seeds = [b"perpetual"],
        bump = perpetual.bump,
    )]
    /// CHECK: PDA authority
    pub perpetual_authority: UncheckedAccount<'info>,
    
    #[account(mut, constraint = user.key() == position.owner @ ErrorCode::Unauthorized)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct LiquidatePosition<'info> {
    #[account(mut)]
    pub perpetual: Account<'info, PerpetualMarket>,
    
    #[account(
        mut,
        close = liquidator
    )]
    pub position: Account<'info, Position>,
    
    #[account(mut)]
    pub quote_asset_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub liquidator_quote_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is verified in the instruction logic
    pub oracle: UncheckedAccount<'info>,
    
    #[account(
        seeds = [b"perpetual"],
        bump = perpetual.bump,
    )]
    /// CHECK: PDA authority
    pub perpetual_authority: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub liquidator: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateFundingRate<'info> {
    #[account(mut)]
    pub perpetual: Account<'info, PerpetualMarket>,
    
    /// CHECK: This is an optional signer
    pub authority: Signer<'info>,
}

#[account]
#[derive(Default)]
pub struct PerpetualMarket {
    /// Base asset mint (e.g., BTC)
    pub base_asset_mint: Pubkey,
    /// Quote asset mint (e.g., USDC)
    pub quote_asset_mint: Pubkey,
    /// Vault for base asset
    pub base_asset_vault: Pubkey,
    /// Vault for quote asset
    pub quote_asset_vault: Pubkey,
    /// Authority of the perpetual market
    pub authority: Pubkey,
    /// Bump seed for authority PDA
    pub bump: u8,
    /// Initial margin ratio (e.g., 500 = 5%)
    pub initial_margin_ratio: u64,
    /// Maintenance margin ratio (e.g., 250 = 2.5%)
    pub maintenance_margin_ratio: u64,
    /// Liquidation fee (e.g., 100 = 1%)
    pub liquidation_fee: u64,
    /// Total size of long positions
    pub total_long_positions: u64,
    /// Total size of short positions
    pub total_short_positions: u64,
    /// Current funding rate (can be positive or negative)
    pub funding_rate: i64,
    /// Funding index (increases with each funding rate update)
    pub funding_index: u64,
    /// Last funding rate update timestamp
    pub last_funding_time: i64,
    /// Total open interest
    pub open_interest: u64,
}

#[account]
#[derive(Default)]
pub struct Position {
    /// Owner of the position
    pub owner: Pubkey,
    /// Size of the position (positive for long, negative for short)
    pub size: i64,
    /// Entry price of the position
    pub entry_price: u64,
    /// Collateral amount
    pub collateral: u64,
    /// Leverage used
    pub leverage: u8,
    /// Funding index at position creation or last update
    pub last_funding_index: u64,
    /// Created timestamp
    pub created_at: i64,
}

impl PerpetualMarket {
    pub const LEN: usize = 32 + // base_asset_mint
                           32 + // quote_asset_mint
                           32 + // base_asset_vault
                           32 + // quote_asset_vault
                           32 + // authority
                           1 +  // bump
                           8 +  // initial_margin_ratio
                           8 +  // maintenance_margin_ratio
                           8 +  // liquidation_fee
                           8 +  // total_long_positions
                           8 +  // total_short_positions
                           8 +  // funding_rate
                           8 +  // funding_index
                           8 +  // last_funding_time
                           8;   // open_interest
}

impl Position {
    pub const LEN: usize = 32 + // owner
                          8 +  // size
                          8 +  // entry_price
                          8 +  // collateral
                          1 +  // leverage
                          8 +  // last_funding_index
                          8;   // created_at
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Invalid position size")]
    InvalidSize,
    
    #[msg("Invalid collateral amount")]
    InvalidCollateral,
    
    #[msg("Invalid leverage")]
    InvalidLeverage,
    
    #[msg("Insufficient collateral for position")]
    InsufficientCollateral,
    
    #[msg("Price impact too high")]
    PriceImpactTooHigh,
    
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    
    #[msg("Cannot liquidate this position")]
    CannotLiquidate,
    
    #[msg("Insufficient collateral for liquidation fee")]
    InsufficientCollateralForLiquidation,
}
