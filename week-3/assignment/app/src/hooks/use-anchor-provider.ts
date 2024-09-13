import { AnchorProvider } from "@coral-xyz/anchor";
import {
  AnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";

export default function useAnchorProvider() {
  const rpcUrl = "https://api.devnet.solana.com";
  // const rpcUrl = "http://localhost:8899";
  const connection = new Connection(rpcUrl, 'confirmed');
  const wallet = useWallet();

  return new AnchorProvider(connection, wallet as AnchorWallet, {
    commitment: "confirmed",
  });
}
