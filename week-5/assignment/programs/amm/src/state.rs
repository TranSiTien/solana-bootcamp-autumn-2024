use anchor_lang::prelude::*;

// use bytemuck::{ Pod, Zeroable };
// use solana_program::pubkey::Pubkey;
use bytemuck::{ Pod, Zeroable };

#[account(zero_copy)]
#[repr(C, packed)]
pub struct Mint2 {
    pub mint_authority: Pubkey, // 32 bytes
    pub supply: u64, // 8 bytes
    pub decimals: u8, // 1 byte
    pub is_initialized: u8, // 1 byte, use u8 instead of bool
    pub freeze_authority: [u8; 32], // 32 bytes
}

impl Mint2 {
    pub const LEN: usize = 32 + 8 + 1 + 1 + 32; // Total: 74 bytes
}

#[account]
#[derive(InitSpace, Default)]
pub struct Amm {
    pub id: Pubkey,

    pub admin: Pubkey,

    pub fee: u16,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub amm: Pubkey,

    pub mint_a: Pubkey,

    pub mint_b: Pubkey,
}

// #[account(zero_copy)]
// #[repr(packed)]
// pub struct Mint {
//     pub mint_authority: Pubkey,
//     pub supply: u64,
//     pub decimals: u8,
//     pub is_initialized: bool,
//     pub freeze_authority: Option<Pubkey>,
// }

// impl Mint {
//     pub const LEN: usize = 82; // Adjust this size based on the actual struct size
// }
