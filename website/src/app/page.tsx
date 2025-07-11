"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */
import idl from "../../idl/create_token.json";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import {MPL_TOKEN_METADATA_PROGRAM_ID} from '@metaplex-foundation/mpl-token-metadata';
import { WalletMultiButton, WalletDisconnectButton } from "@solana/wallet-adapter-react-ui";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from '@coral-xyz/anchor';


const METADATA_PROGRAM_ID = new PublicKey(MPL_TOKEN_METADATA_PROGRAM_ID);

//passing the address of the program
const PROGRAM_ID = new PublicKey(idl.address);

export default function Home() {
  //getting wallet connection
  const {connection} = useConnection();
  const {publicKey, signTransaction} = useWallet();
  const anchorWallet = useAnchorWallet();

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    decimals: 9,
    uri: '',
    initialSupply: 0,
  }); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'decimals' || name === 'initialSupply' ? parseInt(value) || 0 : value
    }));
  };

  const createToken = async() => {
    if (!publicKey || !signTransaction || !anchorWallet) {
      setError('Please connect your wallet first');
      return;
    }

    if (!formData.name || !formData.symbol) {
      setError('Please fill in token name and symbol');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const provider = new AnchorProvider(connection, anchorWallet, {});
      const program = new Program(idl, provider);

      // UPDATED: Generate the mint PDA with token name included in seeds
      const [mintAccount, mintBump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("mint"), 
          publicKey.toBuffer(),
          Buffer.from(formData.name) // Add token name to match Rust program
        ],
        program.programId
      );

      console.log("Generated mint PDA:", mintAccount.toString());

      // Check if this token name already exists for this wallet
      const accountInfo = await connection.getAccountInfo(mintAccount);
      if (accountInfo) {
        setError(`You already have a token named "${formData.name}". Please choose a different name.`);
        setIsLoading(false);
        return;
      }

      // Find metadata PDA
      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          mintAccount.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );

      // Find associated token account
      const associatedTokenAccount = getAssociatedTokenAddressSync(
        mintAccount,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
       
      console.log("Sending transactions.....");
      console.log("Mint account:", mintAccount.toString());
      console.log("Metadata account:", metadataAccount.toString());
      console.log("Associated token account:", associatedTokenAccount.toString());

      // Create token with all required parameters
      const tx = await program.methods
        .createTokenMint(
          formData.decimals,       
          formData.name,          
          formData.symbol,       
          formData.uri || "",      
          new BN(formData.initialSupply)   
        )
        .accounts({
          payer: publicKey,
          metadataAccount: metadataAccount,
          mintAccount: mintAccount,
          associatedTokenAccount: associatedTokenAccount,
          tokenMetadataProgram: METADATA_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: new PublicKey("11111111111111111111111111111111"),
          rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
        })
        .rpc();
         
      console.log("Token created successfully:", tx);
      console.log("Mint address:", mintAccount.toString());
      
      // Clear form on success
      setFormData({
        name: '',
        symbol: '',
        decimals: 9,
        uri: '',
        initialSupply: 0,
      });

    } catch(error) {
      console.error("Error:", error);
      setError(`Token creation failed: ${error || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ padding: '20px', maxWidth: '400px', flex: '1', justifyContent: 'center' }}>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <WalletMultiButton />
        <WalletDisconnectButton />
      </div>
      
      <h2>Create Token</h2>
      
      <div style={{ marginBottom: '10px' }}>
        <input 
        name="name"
        value={formData.name}
        onChange={handleInputChange}
        placeholder="Token Name (e.g., My Token)"
        style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
        />
        
        <input 
        name="symbol" 
        value={formData.symbol}
        onChange={handleInputChange}
        placeholder="Token Symbol (e.g., MTK)"
        style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
        />
        
        <input 
        name="decimals"
        type="number"
        value={formData.decimals}
        onChange={handleInputChange}
        placeholder="Decimals (e.g., 9)"
        min="0"
        max="9"
        style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
        />
        
        <input 
        name="uri"
        value={formData.uri} 
        onChange={handleInputChange}
        placeholder="Metadata URI (optional)"
        style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
        />

        <input 
        name="initialSupply"
        type="number"
        value={formData.initialSupply}
        onChange={handleInputChange}
        placeholder="Initial Supply (0 for no initial mint)"
        min="0"
        style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
        />
      </div>
      
      <button 
        onClick={createToken} 
        disabled={isLoading || !publicKey}
        style={{ 
        width: '100%', 
        padding: '12px', 
        backgroundColor: (isLoading || !publicKey) ? '#ccc' : '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: (isLoading || !publicKey) ? 'not-allowed' : 'pointer'
        }}
      >
        {isLoading ? 'Creating Token...' : 'Create Token'}
      </button>
      
      {error && <p style={{color: 'red', marginTop: '10px'}}>{error}</p>}
      
      {publicKey && (
        <p style={{ fontSize: '12px', marginTop: '10px', color: '#666' }}>
        Connected: {publicKey.toString().slice(0, 8)}...
        </p>
      )}
      </div>
    </div>
  );
}