import {
  Connection,
  LAMPORTS_PER_SOL,
  Keypair,
  PublicKey,
  SystemProgram,
  VersionedTransaction,
  TransactionMessage
} from "@solana/web3.js";
import fs from "fs";
import dotenv from "dotenv";
import { MINT_SIZE, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createInitializeMint2Instruction, createMintToInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { PROGRAM_ID as METADATA_PROGRAM_ID, createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";

// NFT Token Configuration
const tokenConfig = {
  decimals: 6,
  name: "Mublab Token",
  symbol: "MLT",
  description: "A token for MubLAB",
  image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Matlab_Logo.png/670px-Matlab_Logo.png",
  uri: "https://github.com/TranSiTien/solana-bootcamp-autumn-2024/blob/main/week-2/assignment/assets/MLT-token.json",
};

// Utility function to construct explorer URL
function explorerURL({ address, txSignature, cluster }: { address?: string; txSignature?: string; cluster?: "devnet" | "testnet" | "mainnet" | "mainnet-beta" }) {
  let baseUrl = address ? `https://explorer.solana.com/address/${address}` : txSignature ? `https://explorer.solana.com/tx/${txSignature}` : "[unknown]";
  const url = new URL(baseUrl);
  url.searchParams.append("cluster", cluster || "devnet");
  return url.toString() + "\n";
}

// Utility function to log errors
function logError(message: string, error?: Error): boolean {
  console.error(message, error?.message || "");
  return false;
}

// Function to load a keypair from a file
function loadKeypairFromFile(absPath: string): Keypair | null {
  if (!absPath || !fs.existsSync(absPath)) {
    logError("Invalid file path");
    return null;
  }
  try {
    const keyfileBytes = JSON.parse(fs.readFileSync(absPath, "utf-8"));
    return Keypair.fromSecretKey(new Uint8Array(keyfileBytes));
  } catch (error) {
    logError("Failed to load keypair from file:", error as Error);
    return null;
  }
}

// Function to create mint account and associated instructions
async function createMintAccountTransaction(connection: Connection, payer: Keypair, targetPublicKey: PublicKey): Promise<string | null> {
  try {
    const mintKeypair = Keypair.generate();
    const balanceForRentExemption = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    const createMintAccountInstruction = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      lamports: balanceForRentExemption,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    });

    const initializeMintInstruction = createInitializeMint2Instruction(
      mintKeypair.publicKey,
      tokenConfig.decimals,
      payer.publicKey,
      payer.publicKey
    );

    const metadataAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
      METADATA_PROGRAM_ID
    )[0];

    const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataAccount,
        mint: mintKeypair.publicKey,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            creators: null,
            name: tokenConfig.name,
            symbol: tokenConfig.symbol,
            uri: tokenConfig.uri,
            sellerFeeBasisPoints: 0,
            collection: null,
            uses: null,
          },
          collectionDetails: null,
          isMutable: true,
        },
      }
    );

    const ataAddress = await getAssociatedTokenAddress(mintKeypair.publicKey, payer.publicKey);
    const ataInstruction = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ataAddress,
      payer.publicKey,
      mintKeypair.publicKey
    );

    const mintToPayerInstruction = createMintToInstruction(
      mintKeypair.publicKey,
      ataAddress,
      payer.publicKey,
      100 * Math.pow(10, tokenConfig.decimals)
    );

    const ataTargetAddress = await getAssociatedTokenAddress(mintKeypair.publicKey, targetPublicKey);
    const ataTargetInstruction = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ataTargetAddress,
      targetPublicKey,
      mintKeypair.publicKey
    );

    const mintToTargetInstruction = createMintToInstruction(
      mintKeypair.publicKey,
      ataTargetAddress,
      payer.publicKey,
      10 * Math.pow(10, tokenConfig.decimals)
    );

    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash,
      instructions: [
        createMintAccountInstruction,
        initializeMintInstruction,
        createMetadataInstruction,
        ataInstruction,
        mintToPayerInstruction,
        ataTargetInstruction,
        mintToTargetInstruction
      ],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([payer, mintKeypair]);

    return await connection.sendTransaction(tx);
  } catch (error) {
    logError("Failed to create mint account transaction:", error as Error);
    return null;
  }
}

// Function to check balance and request airdrop if needed
async function checkBalanceAndRequestAirdrop(connection: Connection, payer: Keypair) {
  const minBalance = 1 * LAMPORTS_PER_SOL;
  const balance = await connection.getBalance(payer.publicKey);

  if (balance < minBalance) {
    console.log('Balance is below 1 SOL, requesting airdrop...');
    const airdropSignature = await connection.requestAirdrop(payer.publicKey, minBalance - balance);

    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: airdropSignature,
    });

    console.log('Airdrop processed.');
  }
}

// Main function to execute the transaction process
async function main() {
  dotenv.config();

  const envPath = process.env.LOCAL_PAYER_JSON_ABSPATH || "";
  if (!fs.existsSync(envPath)) return logError("Environment file not found at path:", new Error(envPath));

  const keypairPayer = loadKeypairFromFile(envPath);
  if (!keypairPayer) return;

  const connection = new Connection(process.env.RPC_URL || "", "single");

  await checkBalanceAndRequestAirdrop(connection, keypairPayer);
  console.log("Payer address:", keypairPayer.publicKey.toBase58());

  const targetWalletAddress = process.env.TARGET_WALLET_ADDRESS || "";
  const targetWalletPublicKey = new PublicKey(targetWalletAddress);

  try {
    const balance = await connection.getBalance(keypairPayer.publicKey);
    console.log("Current balance of 'payer' (in lamports):", balance);

    const signature = await createMintAccountTransaction(connection, keypairPayer, targetWalletPublicKey);
    if (signature) {
      console.log("Transaction successfully sent.");
      console.log("Explorer URL:", explorerURL({ txSignature: signature }));
    }
  } catch (error) {
    logError("Error during transaction process:", error as Error);
  }
}

main();
