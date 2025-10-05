import * as anchor from "@project-serum/anchor";

const main = async () => {
  console.log("Initializing...");
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.Swap;
  console.log("Program ID:", program.programId.toString());
};

main().catch((err) => {
  console.error(err);
});
