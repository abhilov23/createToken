use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, 
        mpl_token_metadata::{types::DataV2, ID as MetadataID}, 
        CreateMetadataAccountsV3,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

declare_id!("44v2qXt8mpWDvUvAeYD2e9GLWbqDbVZmy6xL8VA8LVgp");

#[program]
pub mod create_token {
    use super::*;

    pub fn create_token_mint(
        ctx: Context<CreateTokenMint>,
        _token_decimals: u8,
        token_name: String,
        token_symbol: String,
        token_uri: String,
        initial_supply: u64,
    ) -> Result<()> {
        msg!("Creating token mint...");

        // FIXED: Signer seeds for the PDA mint account (includes bump for signing)
        let seeds = &[
            b"mint".as_ref(),
            ctx.accounts.payer.key.as_ref(),
            token_name.as_bytes(), // Use token_name from parameter, not ctx
            &[ctx.bumps.mint_account],
        ];
        let signer = &[&seeds[..]];

        // Create metadata - FIXED: Use payer as update_authority, not mint PDA
        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.mint_account.to_account_info(),
                mint_authority: ctx.accounts.mint_account.to_account_info(), // PDA can be mint authority
                update_authority: ctx.accounts.payer.to_account_info(),      // FIXED: Use payer as update authority
                payer: ctx.accounts.payer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer, // Only use signer for mint_authority, not update_authority
        );

        let data_v2 = DataV2 {
            name: token_name.clone(), // Clone to avoid move issues
            symbol: token_symbol,
            uri: token_uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(metadata_ctx, data_v2, false, true, None)?;

        // Mint tokens to the creator
        if initial_supply > 0 {
            msg!("Minting {} tokens to creator's ATA", initial_supply);
            let mint_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint_account.to_account_info(),
                    to: ctx.accounts.associated_token_account.to_account_info(),
                    authority: ctx.accounts.mint_account.to_account_info(),
                },
                signer,
            );
            mint_to(mint_ctx, initial_supply)?;
        }

        msg!("Token created successfully!");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(_token_decimals: u8, token_name: String)]
pub struct CreateTokenMint<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: derived using Metaplex convention
    #[account(
        mut,
        seeds = [b"metadata", token_metadata_program.key().as_ref(), mint_account.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key()
    )]
    pub metadata_account: UncheckedAccount<'info>,

    #[account(
        init,
        seeds = [b"mint", payer.key().as_ref(), token_name.as_bytes()],
        bump,
        payer = payer,
        mint::decimals = _token_decimals,
        mint::authority = mint_account,         // PDA is mint authority
        mint::freeze_authority = mint_account   // optional: set PDA as freeze authority
    )]
    pub mint_account: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint_account,
        associated_token::authority = payer,
    )]
    pub associated_token_account: Account<'info, TokenAccount>,

    /// CHECK: address must be Metaplex Metadata Program
    #[account(address = MetadataID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}