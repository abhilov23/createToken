"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */
import idl from "../../idl/create_token.json";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import {MPL_TOKEN_METADATA_PROGRAM_ID} from '@metaplex-foundation/mpl-token-metadata';
import { WalletMultiButton, WalletDisconnectButton } from "@solana/wallet-adapter-react-ui";

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
  }); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'decimals' ? parseInt(value) || 0 : value
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
      //for generating random address
      const mintKeypair = Keypair.generate(); 

      //finding metadata PDA
      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );
       
      console.log("Sending transactions.....");

      const provider = new AnchorProvider(connection, anchorWallet, {});
      const program = new Program(idl, provider);

      // Fixed: Match the exact parameter order and account names from IDL
      const tx = await program.methods
        .createTokenMint(  // Method name should be camelCase
          formData.decimals,  // _token_decimals (u8) - first parameter
          formData.name,      // token_name (string) - second parameter  
          formData.symbol,    // token_symbol (string) - third parameter
          formData.uri        // token_uri (string) - fourth parameter
        )
        .accounts({
          payer: publicKey,                    // matches "payer" in IDL
          metadataAccount: metadataAccount,    // matches "metadata_account" in IDL
          mintAccount: mintKeypair.publicKey,  // matches "mint_account" in IDL
          tokenMetadataProgram: METADATA_PROGRAM_ID, // matches "token_metadata_program" in IDL
          // Note: tokenProgram, systemProgram, and rent are auto-resolved by Anchor
        })
        .signers([mintKeypair])
        .rpc();
         
      console.log("Token created successfully:", tx);
      console.log("Mint address:", mintKeypair.publicKey.toString());
      
      // Clear form on success
      setFormData({
        name: '',
        symbol: '',
        decimals: 9,
        uri: '',
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