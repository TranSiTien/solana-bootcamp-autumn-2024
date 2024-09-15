import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Amm } from "../target/types/amm";
import { assert } from "chai";
import {
  ASSOCIATED_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@coral-xyz/anchor/dist/cjs/utils/token";
import { mintToken } from './utils';
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BN } from "bn.js";
import { Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } from "@solana/web3.js";
import * as fs from 'fs';
// @ts-ignore
BN.prototype.sqrt = function sqrt() {
    var z = new BN(0);
    if (this.gt(new BN(3))) {
      z = this;
      var x = this.div(new BN(2)).add(new BN(1));
      while (x.lt(z)) {
        z = x;
        x = this.div(x).add(x).div(new BN(2));
      }
    } else if (!this.eq(new BN(0))) {
      z = new BN(1);
    }
    return z;
  };
  function loadKeypairFromFile(filePath: string): Keypair {
    // Read the file content
    const keypairJson = fs.readFileSync(filePath, 'utf-8');
    
    // Parse the JSON content
    const secretKeyArray = JSON.parse(keypairJson);
    
    // Create and return the Keypair instance
    return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
  }
  describe("withdraw-liquidity", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
  
    const program = anchor.workspace.Amm as Program<Amm>;
  
    const depositor = anchor.web3.Keypair.generate();
    let id: anchor.web3.PublicKey;
    let fee = 100;
  
    let ammPda: anchor.web3.PublicKey;
  
    let mintAKp: anchor.web3.Keypair;
    const mintADecimals = 0;
    let mintBKp: anchor.web3.Keypair;
    const mintBDecimals = 0;
  
    let poolPda: anchor.web3.PublicKey;
    let poolAuthorityPda: anchor.web3.PublicKey;
  
    let mintLiquidityPda: anchor.web3.PublicKey;
  
    let poolAccountA: anchor.web3.PublicKey;
    let poolAccountB: anchor.web3.PublicKey;
  
    let depisitorMintAAccount: anchor.web3.PublicKey;
    let depisitorMintBAccount: anchor.web3.PublicKey;
    let depisitorLPAccount: anchor.web3.PublicKey;
  
    before(async () => {
        const keypair = loadKeypairFromFile("/home/ai/.config/solana/id.json");
        const amount = 0.1 * LAMPORTS_PER_SOL; // Amount to transfer
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: provider.wallet.publicKey,
            toPubkey: depositor.publicKey,
            lamports: amount,
          })
        );
        const signature = await provider.sendAndConfirm(transaction, [keypair]);
      
        // Sign and send the transaction
    //     const signature = await provider.sendAndConfirm(transaction, [keypair]);
    //     console.log("Transfer signature:", signature);
    //   await provider.connection.confirmTransaction(
    //     await provider.connection.requestAirdrop(
    //       depositor.publicKey,
    //       anchor.web3.LAMPORTS_PER_SOL * 2
        // )
    //   );
  
      id = anchor.web3.Keypair.generate().publicKey;
  
      ammPda = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("amm"), id.toBuffer()],
        program.programId
      )[0];
  
      const createAmmTx = await program.methods
        .createAmm(id, fee)
        .accounts({
          amm: ammPda,
          admin: provider.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
  
      console.log("Create AMM success signature", createAmmTx);
  
      mintAKp = anchor.web3.Keypair.generate();
      mintBKp = anchor.web3.Keypair.generate();
  
      await mintToken({
        connection: provider.connection,
        payer: depositor,
        receiver: depositor.publicKey,
        mint: mintAKp,
        decimals: mintADecimals,
        amount: 10000,
      });
      console.log("Mint A success");
  
      await mintToken({
        connection: provider.connection,
        payer: depositor,
        receiver: depositor.publicKey,
        mint: mintBKp,
        decimals: mintBDecimals,
        amount: 20000,
      });
      console.log("Mint B success");
  
      poolPda = anchor.web3.PublicKey.findProgramAddressSync(
        [
          ammPda.toBuffer(),
          mintAKp.publicKey.toBuffer(),
          mintBKp.publicKey.toBuffer(),
        ],
        program.programId
      )[0];
      console.log("Pool PDA success");
  
      poolAuthorityPda = anchor.web3.PublicKey.findProgramAddressSync(
        [
          ammPda.toBuffer(),
          mintAKp.publicKey.toBuffer(),
          mintBKp.publicKey.toBuffer(),
          Buffer.from("authority"),
        ],
        program.programId
      )[0];
      console.log("Pool Authority PDA success");
  
      mintLiquidityPda = anchor.web3.PublicKey.findProgramAddressSync(
        [
          ammPda.toBuffer(),
          mintAKp.publicKey.toBuffer(),
          mintBKp.publicKey.toBuffer(),
          Buffer.from("mint_liquidity"),
        ],
        program.programId
      )[0];
  
      poolAccountA = getAssociatedTokenAddressSync(
        mintAKp.publicKey,
        poolAuthorityPda,
        true
      );
      console.log("Pool Account A success");
  
      poolAccountB = getAssociatedTokenAddressSync(
        mintBKp.publicKey,
        poolAuthorityPda,
        true
      );
        console.log("Pool Account B success");  
  
      const createPoolTx = await program.methods
        .createPool()
        .accounts({
          pool: poolPda,
          poolAuthority: poolAuthorityPda,
          mintLiquidity: mintLiquidityPda,
          amm: ammPda,
          mintA: mintAKp.publicKey,
          mintB: mintBKp.publicKey,
          poolAccountA: poolAccountA,
          poolAccountB: poolAccountB,
          payer: provider.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc().catch(e => console.error(e));
  
    //   console.log("Create pool success signature", createPoolTx);
  
    //   depisitorLPAccount = getAssociatedTokenAddressSync(
    //     mintLiquidityPda,
    //     depositor.publicKey,
    //     true
    //   );
  
    //   depisitorMintAAccount = getAssociatedTokenAddressSync(
    //     mintAKp.publicKey,
    //     depositor.publicKey,
    //     false
    //   );
  
    //   depisitorMintBAccount = getAssociatedTokenAddressSync(
    //     mintBKp.publicKey,
    //     depositor.publicKey,
    //     false
    //   );
    });
    // it("deposit-liquidity - 1", async () => {
    //     const amountA = new BN(100 * 10 ** mintADecimals);
    //     const amountB = new BN(200 * 10 ** mintBDecimals);
    
    //     const tx = await program.methods
    //       .depositLiquidity(amountA, amountB)
    //       .accounts({
    //         pool: poolPda,
    //         poolAuthority: poolAuthorityPda,
    //         mintLiquidity: mintLiquidityPda,
    //         mintA: mintAKp.publicKey,
    //         mintB: mintBKp.publicKey,
    //         poolAccountA: poolAccountA,
    //         poolAccountB: poolAccountB,
    //         depositorAccountLiquidity: depisitorLPAccount,
    //         depositorAccountA: depisitorMintAAccount,
    //         depositorAccountB: depisitorMintBAccount,
    //         depositor: depositor.publicKey,
    
    //         tokenProgram: TOKEN_PROGRAM_ID,
    //         associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
    //         systemProgram: anchor.web3.SystemProgram.programId,
    //       })
    //       .signers([depositor])
    //       .rpc();
    
    //     console.log("Your transaction signature", tx);
    
    //     assert(1 == 1, "ngon");
    
    //     const poolATokenAccount = await getAccount(
    //       provider.connection,
    //       poolAccountA
    //     );
    
    //     const poolBTokenAccount = await getAccount(
    //       provider.connection,
    //       poolAccountB
    //     );
    
    //     const depisitorLP = await getAccount(
    //       provider.connection,
    //       depisitorLPAccount
    //     );
    
    //     assert(
    //       poolATokenAccount.amount.toString() == amountA.toString(),
    //       "Correct token A"
    //     );
    
    //     assert(
    //       poolBTokenAccount.amount.toString() == amountB.toString(),
    //       "Correct token B"
    //     );
    
    //     assert(depisitorLP.amount > 0, "Correct LP");
    //   });
    
    //   it("deposit-liquidity - 2", async () => {
    //     try {
    //         await getAccount(provider.connection, depisitorLPAccount);
    //         console.log("Depositor LP account exists");
    //       } catch (error) {
    //         if (error.message.includes("Failed to find account")) {
    //           console.error("Depositor LP account does not exist");
    //         } else {
    //           throw error;
    //         }
    //       }
    //     const amountA = new BN(10 * 10 ** mintADecimals);
    //     const amountB = new BN(30 * 10 ** mintBDecimals);
    
    //     const tx = await program.methods
    //       .depositLiquidity(amountA, amountB)
    //       .accounts({
    //         // pool: poolAuthorityPda,
    //         pool: poolPda,
    //         poolAuthority: poolAuthorityPda,
    //         mintLiquidity: mintLiquidityPda,
    //         mintA: mintAKp.publicKey,
    //         mintB: mintBKp.publicKey,
    //         poolAccountA: poolAccountA,
    //         poolAccountB: poolAccountB,
    //         depositorAccountLiquidity: depisitorLPAccount,
    //         depositorAccountA: depisitorMintAAccount,
    //         depositorAccountB: depisitorMintBAccount,
    //         depositor: depositor.publicKey,
    
    //         tokenProgram: TOKEN_PROGRAM_ID,
    //         associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
    //         systemProgram: anchor.web3.SystemProgram.programId,
    //       })
    //       .signers([depositor])
    //       .rpc();
    
    //     console.log("Your transaction signature", tx);
    //   });
    
  it("withdraw-liquidity - 1", async () => {
    // const amountA = new BN(10 * 10 ** mintADecimals);
    // const amountB = new BN(30 * 10 ** mintBDecimals);
    // const tx = await program.methods
    // .depositLiquidity(amountA, amountB)
    // .accounts({
    //   // pool: poolAuthorityPda,
    //   pool: poolPda,
    //   poolAuthority: poolAuthorityPda,
    //   mintLiquidity: mintLiquidityPda,
    //   mintA: mintAKp.publicKey,
    //   mintB: mintBKp.publicKey,
    //   poolAccountA: poolAccountA,
    //   poolAccountB: poolAccountB,
    //   depositorAccountLiquidity: depisitorLPAccount,
    //   depositorAccountA: depisitorMintAAccount,
    //   depositorAccountB: depisitorMintBAccount,
    //   depositor: depositor.publicKey,

    //   tokenProgram: TOKEN_PROGRAM_ID,
    //   associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
    //   systemProgram: anchor.web3.SystemProgram.programId,
    // })
    // .signers([depositor])
    // .rpc();
    // const lpAmount = new BN(10); // Assuming 6 decimals for LP token

    // const tx2 = await program.methods
    //   .withdrawLiquidity(lpAmount)
    //   .accounts({
    //     pool: poolPda,
    //     poolAuthority: poolAuthorityPda,
    //     mintLiquidity: mintLiquidityPda,
    //     mintA: mintAKp.publicKey,
    //     mintB: mintBKp.publicKey,
    //     poolAccountA: poolAccountA,
    //     poolAccountB: poolAccountB,
    //     depositorAccountA: depisitorMintAAccount,
    //     depositorAccountLiquidity: depisitorLPAccount,
    //     depositorAccountB: depisitorMintBAccount,
    //     depositor: depositor.publicKey,

    //     tokenProgram: TOKEN_PROGRAM_ID,
    //     associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
    //     systemProgram: anchor.web3.SystemProgram.programId,
    //   })
    //   .signers([depositor])
    //   .rpc();

    // console.log("Your transaction signature", tx2);

    // // Add assertions to verify the state after withdrawal
    // const depositorAccountAInfo = await getAccount(provider.connection, depisitorMintAAccount);
    // const depositorAccountBInfo = await getAccount(provider.connection, depisitorMintBAccount);

    // console.log("Depositor account A", depositorAccountAInfo.amount);
    // console.log("Depositor account B", depositorAccountBInfo.amount);
    // assert(depositorAccountAInfo.amount > 0, "Depositor should have received token A");
    // assert(depositorAccountBInfo.amount > 0, "Depositor should have received token B");
  });
});