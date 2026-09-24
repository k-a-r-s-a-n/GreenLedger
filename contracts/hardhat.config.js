/**
 * GreenLedger - Hardhat configuration for GreenBadge (ERC-1155, Sepolia).
 * Reads SEPOLIA_RPC_URL / DEPLOYER_PRIVATE_KEY from the repo-root .env file.
 */
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || "";
const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {},
    sepolia: {
      url: sepoliaRpcUrl,
      accounts: deployerKey ? [deployerKey] : [],
    },
  },
};
