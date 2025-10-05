import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Swap } from "../target/types/swap";
import * as assert from "assert";
import * as token from "@solana/spl-token";

describe("swap", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Swap as Program<Swap>;
  
  it("Initializes a liquidity pool", async () => {
    // Test logic here
    console.log("Test running...");
  });

  it("Swaps tokens", async () => {
    // Test logic here
    console.log("Test running...");
  });
});
