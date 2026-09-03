/**
 * GreenLedger - GreenBadge Contract Deployment Script
 * Deploys GreenBadge ERC-1155 smart contract to Ethereum Sepolia Testnet.
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("----------------------------------------------------");
  console.log("Deploying GreenBadge ERC-1155 to Ethereum Sepolia...");
  console.log("----------------------------------------------------");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Wallet:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account Balance:", ethers.formatEther(balance), "SepoliaETH");

  const GreenBadge = await ethers.getContractFactory("GreenBadge");
  const greenBadge = await GreenBadge.deploy();
  await greenBadge.waitForDeployment();

  const contractAddress = await greenBadge.getAddress();
  console.log("\n>>> GreenBadge deployed successfully!");
  console.log("Contract Address:", contractAddress);
  console.log("Block Explorer: https://sepolia.etherscan.io/address/" + contractAddress);
  console.log("\nAdd this to your .env file:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS="${contractAddress}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
