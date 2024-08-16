"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.explorerURL = void 0;
const web3_js_1 = require("@solana/web3.js");
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
const spl_token_1 = require("@solana/spl-token");
const state_1 = require("@solana/spl-token/lib/types/state");
const mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
const instructions_1 = require("@solana/spl-token/lib/types/instructions");
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
exports.explorerURL = explorerURL;
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
async function createMintAccountTransaction(connection, payer, targetPublicKey) {
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
            uri: "https://github.com/TranSiTien/solana-bootcamp-autumn-2024/blob/main/week-2/assignment/assets/MLT-token.json",
        };
        const space = state_1.MINT_SIZE;
        const balanceForRentExemption = await connection.getMinimumBalanceForRentExemption(space);
        const mintKeypair = web3_js_1.Keypair.generate();
        // Instruction to create a new account
        const createMintAccountInstruction = web3_js_1.SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mintKeypair.publicKey,
            lamports: balanceForRentExemption,
            space,
            programId: spl_token_1.TOKEN_PROGRAM_ID,
        });
        const initializeMintInstruction = (0, instructions_1.createInitializeMint2Instruction)(mintKeypair.publicKey, tokenConfig.decimals, payer.publicKey, payer.publicKey);
        const metadataAccount = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("metadata"), mpl_token_metadata_1.PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()], mpl_token_metadata_1.PROGRAM_ID)[0];
        // Create the Metadata account for the Mint 
        const createMetadataInstruction = (0, mpl_token_metadata_1.createCreateMetadataAccountV3Instruction)({
            metadata: metadataAccount,
            mint: mintKeypair.publicKey,
            mintAuthority: payer.publicKey,
            payer: payer.publicKey,
            updateAuthority: payer.publicKey,
        }, {
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
        });
        // Get the latest blockhash for the transaction
        const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        // Compile all instructions into one transaction message
        const message = new web3_js_1.TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash,
            instructions: [createMintAccountInstruction, initializeMintInstruction, createMetadataInstruction],
        }).compileToV0Message();
        const tx = new web3_js_1.VersionedTransaction(message);
        tx.sign([payer, mintKeypair]);
        const signature = await connection.sendTransaction(tx);
        return signature;
    }
    catch (error) {
        logError("Failed to create min account:", error);
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
        const signature = await createMintAccountTransaction(connection, keypairPayer, targetWalletPublicKey);
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
