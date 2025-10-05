use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Initial liquidity must be non-zero")]
    InitialLiquidityMustBeNonZero,
    
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    
    #[msg("Invalid fee parameters")]
    InvalidFee,
    
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    
    #[msg("Invalid mint")]
    InvalidMint,
}
