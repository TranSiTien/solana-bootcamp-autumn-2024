use anchor_lang::prelude::*;

mod errors;
mod instructions;
mod state;

declare_id!("ARDGpFFuRDPkR2m7HWQo8QvnoSqcZX8iS7rz4urW68Ta");

#[program]
pub mod amm {
    pub use super::instructions::*;

    use super::*;

    pub fn create_amm(ctx: Context<CreateAmm>, id: Pubkey, fee: u16) -> Result<()> {
        instructions::create_amm(ctx, id, fee)
    }

    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        // Ok(())
        // instructions::create_pool(ctx)
        Ok(())
    }

    pub fn deposit_liquidity(
        ctx: Context<DepositLiquidity>,
        amount_a: u64,
        amount_b: u64
    ) -> Result<()> {
        instructions::deposit_liquidity(ctx, amount_a, amount_b)
    }

    pub fn withdraw_liquidity(ctx: Context<WithdrawLiquidity>, lp_amount: u64) -> Result<()> {
        instructions::withdraw_liquidity(ctx, lp_amount)
    }

    pub fn swap(
        ctx: Context<Swap>,
        swap_a: bool,
        input_amount: u64,
        min_output_amount: u64
    ) -> Result<()> {
        instructions::swap(ctx, swap_a, input_amount, min_output_amount)
    }
}
