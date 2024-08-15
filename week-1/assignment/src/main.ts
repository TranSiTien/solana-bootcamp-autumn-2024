import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  SystemProgram,
  TransactionMessage,
  PublicKey,
} from "@solana/web3.js";
import fs from "fs";
import dotenv from "dotenv";

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

// Function to create and send a transaction with all instructions
async function createAndSendTransaction(
  connection: Connection,
  payer: Keypair,
  targetPublicKey: PublicKey
): Promise<string | null> {
  try {
    const space = 0;
    const balanceForRentExemption = await connection.getMinimumBalanceForRentExemption(space);
    const newAccount = new Keypair();

    let estimateRemainBalanceInNewAccount = balanceForRentExemption + 0.1 * LAMPORTS_PER_SOL;
    // Instruction to create a new account
    const createNewAccountIx = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: newAccount.publicKey,
      lamports: balanceForRentExemption + 0.1 * LAMPORTS_PER_SOL,
      space,
      programId: SystemProgram.programId,
    });

    estimateRemainBalanceInNewAccount -= 0.1 * LAMPORTS_PER_SOL;
    // Instruction to transfer SOL to the target wallet
    const transferToTargetWalletIx = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: targetPublicKey,
      lamports: 0.1 * LAMPORTS_PER_SOL,
    });

    const remainingLamports = await connection.getBalance(newAccount.publicKey);
    // Instruction to close the new account
    const closeNewAccountIx = SystemProgram.transfer({
      fromPubkey: newAccount.publicKey,
      toPubkey: payer.publicKey,
      lamports: estimateRemainBalanceInNewAccount,
    });

    // Get the latest blockhash for the transaction
    const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Compile all instructions into one transaction message
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash,
      instructions: [createNewAccountIx, transferToTargetWalletIx, closeNewAccountIx],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([payer, newAccount]);

    const signature = await connection.sendTransaction(tx);
    return signature;
  } catch (error) {
    logError("Failed to create, send, close transaction:", error as Error);
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

  const targetWalletAddress = process.env.TARGET_WALLET_ADDRESS || "";
  const targetWalletPublicKey = new PublicKey(targetWalletAddress);

  const connection = new Connection(process.env.RPC_URL || "", "single");

  checkBalanceAndRequestAirdrop(connection, keypairPayer);
  console.log("Payer address:", keypairPayer.publicKey.toBase58());
  console.log("Target wallet address:", targetWalletAddress);

  try {
    const balance = await connection.getBalance(keypairPayer.publicKey);
    console.log("Current balance of 'payer' (in lamports):", balance);

    const signature = await createAndSendTransaction(connection, keypairPayer, targetWalletPublicKey);
    if (signature) {
      console.log("Transaction successfully sent.");
      console.log("Explorer URL:", explorerURL({ txSignature: signature }));
    }
  } catch (error) {
    logError("Error during transaction process:", error as Error);
  }
}

main();
