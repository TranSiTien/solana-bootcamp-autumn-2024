import { Cluster, PublicKey } from "@solana/web3.js";

export const TODO_PROGRAM_ID = new PublicKey(
  "HM2R1eMHED4LQJAPttv2kHaJQTTXM5JHTwLWBGFUYMkE"
);

export function getProgramId(cluster: Cluster) {
  switch (cluster) {
    case "devnet":
    case "testnet":
    case "mainnet-beta":
    default:
      return TODO_PROGRAM_ID;
  }
}
