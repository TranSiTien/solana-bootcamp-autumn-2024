import {
  Connection,
  LAMPORTS_PER_SOL,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import fs from "fs";
import dotenv from "dotenv";
import { bundlrStorage, keypairIdentity, Metaplex } from "@metaplex-foundation/js";
import { MINT_SIZE } from "@solana/spl-token";
import { PROGRAM_ID as METADATA_PROGRAM_ID, createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";

// Configuration for the NFT
const nftMetadata = {
  name: "MubKang",
  symbol: "MBK",
  description: "MubKang NFT",
  image: "https://github.com/TranSiTien/solana-bootcamp-autumn-2024/blob/main/week-2/code/assets/NFTImg.png",
  attributes: [
    { trait_type: "Category", value: "Art" },
    { trait_type: "Edition", value: "First" },
  ],
  sellerFeeBasisPoints: 500, // 5% royalty
};

// Utility function to construct explorer URL
function explorerURL({ address, txSignature, cluster }: {
  address?: string;
  txSignature?: string;
  cluster?: "devnet" | "testnet" | "mainnet" | "mainnet-beta";
}) {
  let baseUrl: string;
  if (address) baseUrl = `https://explorer.solana.com/address/${address}`;
  else if (txSignature) baseUrl = `https://explorer.solana.com/tx/${txSignature}`;
  else return "[unknown]";

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

// Function to create NFT transaction
async function createNFTTransaction(connection: Connection, payer: Keypair): Promise<string | null> {
  try {
    const mintKeypair = Keypair.generate();

    const metaplex = Metaplex.make(connection)
      .use(keypairIdentity(payer))
      .use(
        bundlrStorage({
          address: "https://devnet.bundlr.network",
          providerUrl: "https://api.devnet.solana.com",
          timeout: 60000,
        })
      );

    const { uri } = await metaplex.nfts().uploadMetadata(nftMetadata);

    const { nft, response } = await metaplex.nfts().create({
      uri,
      name: nftMetadata.name,
      symbol: nftMetadata.symbol,
      useNewMint: mintKeypair,
      sellerFeeBasisPoints: nftMetadata.sellerFeeBasisPoints,
      isMutable: true,
    });

    return response.signature;
  } catch (error) {
    logError("Failed to create NFT", error as Error);
    return null;
  }
}

// Function to check balance and request airdrop if necessary
async function checkBalanceAndRequestAirdrop(connection: Connection, payer: Keypair) {
  const minBalance = 1 * LAMPORTS_PER_SOL;
  const balance = await connection.getBalance(payer.publicKey);

  if (balance < minBalance) {
    console.log('Balance is below 1 SOL, requesting airdrop...');
    const airdropSignature = await connection.requestAirdrop(payer.publicKey, minBalance - balance);
    
    const latestBlockHash = await connection.getLatestBlockhash();
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

  await checkBalanceAndRequestAirdrop(connection, keypairPayer);
  console.log("Payer address:", keypairPayer.publicKey.toBase58());

  try {
    const balance = await connection.getBalance(keypairPayer.publicKey);
    console.log("Current balance of 'payer' (in lamports):", balance);

    const signature = await createNFTTransaction(connection, keypairPayer);
    if (signature) {
      console.log("Transaction successfully sent.");
      console.log("Explorer URL:", explorerURL({ txSignature: signature }));
    }
  } catch (error) {
    logError("Error during transaction process:", error as Error);
  }
}

main();
