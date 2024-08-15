"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.explorerURL = explorerURL;
const web3_js_1 = require("@solana/web3.js");
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
function explorerURL({ address, txSignature, cluster, }) {
    let baseUrl;
    //
    if (address)
        baseUrl = `https://explorer.solana.com/address/${address}`;
    else if (txSignature)
        baseUrl = `https://explorer.solana.com/tx/${txSignature}`;
    else
        return "[unknown]";
    // auto append the desired search params
    const url = new URL(baseUrl);
    url.searchParams.append("cluster", cluster || "devnet");
    return url.toString() + "\n";
}
// Utility function to log errors and return a boolean indicating success
function logError(message, error) {
    console.error(message, error?.message || "");
    return false;
}
// Function to load a keypair from a file
function loadKeypairFromFile(absPath) {
    if (!absPath) {
        logError("No path provided");
        return null;
    }
    if (!fs_1.default.existsSync(absPath)) {
        logError("File does not exist.");
        return null;
    }
    try {
        const keyfileBytes = JSON.parse(fs_1.default.readFileSync(absPath, "utf-8"));
        return web3_js_1.Keypair.fromSecretKey(new Uint8Array(keyfileBytes));
    }
    catch (error) {
        logError("Failed to load keypair from file:", error);
        return null;
    }
}
// Function to create and send a transaction with all instructions
async function createAndSendTransaction(connection, payer, targetPublicKey) {
    try {
        const space = 0;
        const balanceForRentExemption = await connection.getMinimumBalanceForRentExemption(space);
        const newAccount = new web3_js_1.Keypair();
        let estimateRemainBalanceInNewAccount = balanceForRentExemption + 0.1 * web3_js_1.LAMPORTS_PER_SOL;
        // Instruction to create a new account
        const createNewAccountIx = web3_js_1.SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: newAccount.publicKey,
            lamports: balanceForRentExemption + 0.1 * web3_js_1.LAMPORTS_PER_SOL,
            space,
            programId: web3_js_1.SystemProgram.programId,
        });
        estimateRemainBalanceInNewAccount -= 0.1 * web3_js_1.LAMPORTS_PER_SOL;
        // Instruction to transfer SOL to the target wallet
        const transferToTargetWalletIx = web3_js_1.SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: targetPublicKey,
            lamports: 0.1 * web3_js_1.LAMPORTS_PER_SOL,
        });
        const remainingLamports = await connection.getBalance(newAccount.publicKey);
        // Instruction to close the new account
        const closeNewAccountIx = web3_js_1.SystemProgram.transfer({
            fromPubkey: newAccount.publicKey,
            toPubkey: payer.publicKey,
            lamports: estimateRemainBalanceInNewAccount,
        });
        // Get the latest blockhash for the transaction
        const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        // Compile all instructions into one transaction message
        const message = new web3_js_1.TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash,
            instructions: [createNewAccountIx, transferToTargetWalletIx, closeNewAccountIx],
        }).compileToV0Message();
        const tx = new web3_js_1.VersionedTransaction(message);
        tx.sign([payer, newAccount]);
        const signature = await connection.sendTransaction(tx);
        return signature;
    }
    catch (error) {
        logError("Failed to create, send, close transaction:", error);
        return null;
    }
}
async function checkBalanceAndRequestAirdrop(connection, payer) {
    // Convert 10 SOL to lamports
    const minBalance = 1 * web3_js_1.LAMPORTS_PER_SOL;
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
    dotenv_1.default.config();
    const envPath = process.env.LOCAL_PAYER_JSON_ABSPATH || "";
    if (!fs_1.default.existsSync(envPath))
        return logError("Environment file not found at path:", new Error(envPath));
    const keypairPayer = loadKeypairFromFile(envPath);
    if (!keypairPayer)
        return;
    const targetWalletAddress = process.env.TARGET_WALLET_ADDRESS || "";
    const targetWalletPublicKey = new web3_js_1.PublicKey(targetWalletAddress);
    const connection = new web3_js_1.Connection(process.env.RPC_URL || "", "single");
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
    }
    catch (error) {
        logError("Error during transaction process:", error);
    }
}
main();
