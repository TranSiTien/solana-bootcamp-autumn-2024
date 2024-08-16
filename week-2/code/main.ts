import {
  Connection,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import fs from "fs";
import dotenv from "dotenv";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { MINT_SIZE, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createInitializeMint2Instruction, createMintToInstruction, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

import {
  PROGRAM_ID as METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";

export function explorerURL({
  address,
  txSignature,
  cluster,
}: {
  address?: string;
  txSignature?: string;
  cluster?: "devnet" | "testnet" | "mainnet" | "mainnet-beta";
}) {
  let baseUrl: string;
  //
  if (address) baseUrl = `https://explorer.solana.com/address/${address}`;
  else if (txSignature) baseUrl = `https://explorer.solana.com/tx/${txSignature}`;
  else return "[unknown]";

  // auto append the desired search params
  const url = new URL(baseUrl);
  url.searchParams.append("cluster", cluster || "devnet");
  return url.toString() + "\n";
}

// Utility function to log errors and return a boolean indicating success
function logError(message: string, error?: Error): boolean {
  console.error(message, error?.message || "");
  return false;
}

// Function to load a keypair from a file
function loadKeypairFromFile(absPath: string): Keypair | null {
  if (!absPath) {
    logError("No path provided");
    return null;
  }
  if (!fs.existsSync(absPath)) {
    logError("File does not exist.");
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

async function createMintAccountTransaction(
  connection: Connection,
  payer: Keypair,
): Promise<string | null> {
  try {
    const tokenConfig = {
      // define how many decimals we want our tokens to have
      decimals: 6,
      //
      name: "Mublab Token",
      //
      symbol: "MLT",
      //
      description: "A token for MubLAB",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Matlab_Logo.png/670px-Matlab_Logo.png",
      uri: "https://github.com/TranSiTien/solana-bootcamp-autumn-2024/blob/main/week-2/code/assets/MLT-token.json",
    };
    const space = MINT_SIZE;
    const balanceForRentExemption = await connection.getMinimumBalanceForRentExemption(space);
    const mintKeypair = Keypair.generate(); 

    // Instruction to create a new account
    const createMintAccountInstruction = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      lamports: balanceForRentExemption,
      space,
      programId: TOKEN_PROGRAM_ID,
    });
    const initializeMintInstruction = createInitializeMint2Instruction(
      mintKeypair.publicKey,
      tokenConfig.decimals,
      payer.publicKey,
      payer.publicKey,
    );

    const metadataAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
      METADATA_PROGRAM_ID,
    )[0];
      // Create the Metadata account for the Mint 
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
        // `collectionDetails` - for non-nft type tokens, normally set to `null` to not have a value set
        collectionDetails: null,
        // should the metadata be updatable?
        isMutable: true,
      },
    },
  );
  
  const ataAddress = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    payer.publicKey
  );
  const ataInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ataAddress,
    payer.publicKey,
    mintKeypair.publicKey
  );

    // Mint instruction
    const mintToInstruction = createMintToInstruction(
      mintKeypair.publicKey,
      ataAddress,
      payer.publicKey,
      100 * Math.pow(10, tokenConfig.decimals)
    );
    // Get the latest blockhash for the transaction
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Compile all instructions into one transaction message
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash,
      instructions: [createMintAccountInstruction, initializeMintInstruction, createMetadataInstruction,
        ataInstruction, mintToInstruction
      ],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([payer, mintKeypair]);

    const signature = await connection.sendTransaction(tx);
    return signature;
  } catch (error) {
    logError("Failed to create min account:", error as Error);
    return null;
  }
}

async function checkBalanceAndRequestAirdrop(connection: Connection, payer: Keypair) {
  // Convert 10 SOL to lamports
  const minBalance = 1 * LAMPORTS_PER_SOL;

  // Get the current balance
  const balance = await connection.getBalance(payer.publicKey);

  // If balance is below 1 SOL, request an airdrop
  if (balance < minBalance) {
    console.log('Balance is below 1 SOL, requesting airdrop...');
    const airdropSignature = await connection.requestAirdrop(payer.publicKey, minBalance - balance);
    
    const latestBlockHash = await connection.getLatestBlockhash();
    // Confirm that the airdrop has been processed
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
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

  checkBalanceAndRequestAirdrop(connection, keypairPayer);
  console.log("Payer address:", keypairPayer.publicKey.toBase58());

  try {
    const balance = await connection.getBalance(keypairPayer.publicKey);
    console.log("Current balance of 'payer' (in lamports):", balance);

    const signature = await createMintAccountTransaction(connection, keypairPayer);
    if (signature) {
      console.log("Transaction successfully sent.");
      console.log("Explorer URL:", explorerURL({ txSignature: signature }));
    }
  } catch (error) {
    logError("Error during transaction process:", error as Error);
  }
}

main();
