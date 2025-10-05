use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct SwapInfo {
    /// Token A mint address
    pub token_a_mint: Pubkey,
    /// Token B mint address
    pub token_b_mint: Pubkey,
    /// Token A account address
    pub token_a_account: Pubkey,
    /// Token B account address
    pub token_b_account: Pubkey,
    /// Fee numerator (fee = numerator / denominator)
    pub fee_numerator: u64,
    /// Fee denominator
    pub fee_denominator: u64,
    /// Authority of the swap
    pub authority: Pubkey,
    /// Bump seed for authority PDA
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct UserPosition {
    /// Owner of the position
    pub owner: Pubkey,
    /// LP token amount
    pub lp_amount: u64,
    /// Token A amount contributed
    pub token_a_amount: u64,
    /// Token B amount contributed
    pub token_b_amount: u64,
}
