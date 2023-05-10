import { ethers } from "hardhat";

async function main() {
  const vaultContract = await ethers.getContractFactory("Vault");
  const vault = await vaultContract.deploy();
  await vault.deployed();
  console.log("Vault deployed to:", vault.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
