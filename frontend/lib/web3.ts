/**
 * GreenLedger - Web3 & MetaMask Sepolia Integration
 * Handles wallet connection, chain switching, and non-custodial badge minting.
 * Never stores private keys or asks for seed phrases.
 */

import { ethers } from "ethers";

export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // 11155111
export const SEPOLIA_CHAIN_ID_DEC = 11155111;
export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";

export const GREEN_BADGE_ABI = [
  "function owner() view returns (address)",
  "function mint(address account, uint256 id, uint256 amount, bytes data) external",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function uri(uint256 id) external view returns (string)",
  "function hasMintedBadge(uint256 id, address account) external view returns (bool)",
  "event BadgeMinted(address indexed recipient, uint256 indexed badgeId, string badgeName)"
];

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  isSepolia: boolean;
  balanceEth: string | null;
  error: string | null;
}

/**
 * Safely resolves the Ethereum provider, prioritizing MetaMask if multiple
 * providers (e.g. Coinbase, Phantom, Brave) are injected.
 */
export function getEthereumProvider(): any {
  if (typeof window === "undefined") return null;

  const anyWindow = window as any;
  if (!anyWindow.ethereum) return null;

  // Handle multiple injected providers (EIP-5749 / EIP-1193)
  if (Array.isArray(anyWindow.ethereum.providers) && anyWindow.ethereum.providers.length > 0) {
    const metamask = anyWindow.ethereum.providers.find((p: any) => p.isMetaMask);
    if (metamask) return metamask;
    return anyWindow.ethereum.providers[0];
  }

  return anyWindow.ethereum;
}

/**
 * Checks if MetaMask or an EIP-1193 Web3 provider is available.
 */
export function hasWeb3Provider(): boolean {
  return Boolean(getEthereumProvider());
}

/**
 * Connects user wallet and retrieves account and network state.
 */
export async function connectWallet(): Promise<WalletState> {
  const provider = getEthereumProvider();

  if (!provider) {
    return {
      isConnected: false,
      address: null,
      chainId: null,
      isSepolia: false,
      balanceEth: null,
      error: "MetaMask not detected. Please install the MetaMask extension to interact with Sepolia testnet."
    };
  }

  try {
    const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
    if (!accounts || accounts.length === 0) {
      return {
        isConnected: false,
        address: null,
        chainId: null,
        isSepolia: false,
        balanceEth: null,
        error: "No accounts authorized. Please unlock your wallet and approve the connection."
      };
    }

    const activeAddress = accounts[0];
    const chainIdHex = await provider.request({ method: "eth_chainId" });
    const chainId = parseInt(chainIdHex, 16);

    // Fetch balance safely without failing the entire connection if RPC fails
    let balanceEth: string | null = null;
    try {
      const browserProvider = new ethers.BrowserProvider(provider, "any");
      const balance = await browserProvider.getBalance(activeAddress);
      balanceEth = parseFloat(ethers.formatEther(balance)).toFixed(4);
    } catch (balErr) {
      console.warn("Could not retrieve ETH balance:", balErr);
    }

    return {
      isConnected: true,
      address: activeAddress,
      chainId,
      isSepolia: chainId === SEPOLIA_CHAIN_ID_DEC,
      balanceEth,
      error: null
    };
  } catch (err: any) {
    console.error("Wallet connection error:", err);
    let userMsg = err.message || "Failed to connect wallet";
    
    if (err.code === 4001) {
      userMsg = "Connection request was rejected in your wallet.";
    } else if (err.code === -32002) {
      userMsg = "Connection request already pending. Please open your MetaMask extension to approve it.";
    }

    return {
      isConnected: false,
      address: null,
      chainId: null,
      isSepolia: false,
      balanceEth: null,
      error: userMsg
    };
  }
}

/**
 * Prompts user to switch network to Ethereum Sepolia Testnet.
 */
export async function switchToSepolia(): Promise<boolean> {
  const provider = getEthereumProvider();
  if (!provider) return false;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }]
    });
    return true;
  } catch (switchError: any) {
    const isUnrecognized = 
      switchError.code === 4902 || 
      switchError.code === -32603 ||
      String(switchError?.message || "").toLowerCase().includes("unrecognized") ||
      String(switchError?.message || "").includes("4902");

    if (isUnrecognized) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID_HEX,
              chainName: "Ethereum Sepolia Testnet",
              nativeCurrency: { name: "Sepolia ETH", symbol: "SEP", decimals: 18 },
              rpcUrls: [
                "https://ethereum-sepolia-rpc.publicnode.com",
                "https://rpc.sepolia.org",
                "https://sepolia.drpc.org"
              ],
              blockExplorerUrls: [SEPOLIA_EXPLORER_URL]
            }
          ]
        });
        return true;
      } catch (addError) {
        console.error("Failed to add Sepolia network:", addError);
        return false;
      }
    }
    console.error("Failed to switch to Sepolia:", switchError);
    return false;
  }
}

/**
 * Client-side execution of GreenBadge minting function on Sepolia.
 */
export async function mintBadgeOnChain(
  tokenId: number,
  onStatusChange?: (status: string) => void
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const provider = getEthereumProvider();
  if (!provider) {
    return { success: false, error: "MetaMask not found" };
  }

  try {
    if (!CONTRACT_ADDRESS) {
      return { success: false, error: "Contract address is not configured; minting is unavailable." };
    }
    onStatusChange?.("Checking wallet network...");
    const chainIdHex = await provider.request({ method: "eth_chainId" });
    const chainId = parseInt(chainIdHex, 16);
    if (chainId !== SEPOLIA_CHAIN_ID_DEC) {
      onStatusChange?.("Switching to Sepolia testnet...");
      const switched = await switchToSepolia();
      if (!switched) {
        return { success: false, error: "Please switch network to Sepolia Testnet to proceed." };
      }
    }

    onStatusChange?.("Preparing transaction...");
    const browserProvider = new ethers.BrowserProvider(provider, "any");
    const signer = await browserProvider.getSigner();
    const userAddress = await signer.getAddress();

    const contract = new ethers.Contract(CONTRACT_ADDRESS, GREEN_BADGE_ABI, signer);

    const deployedCode = await browserProvider.getCode(CONTRACT_ADDRESS);
    if (deployedCode === "0x") {
      return { success: false, error: "No contract is deployed at the configured Sepolia address." };
    }
    if (deployedCode.startsWith("0xef0100")) {
      return { success: false, error: "The configured address is an EIP-7702 account, not a deployed GreenBadge contract. Deploy GreenBadge.sol and configure its contract address." };
    }

    let contractOwner: string;
    try {
      contractOwner = await contract.owner();
    } catch {
      return { success: false, error: "The configured Sepolia address does not expose the GreenBadge owner function. Configure the deployed GreenBadge contract address." };
    }
    if (contractOwner.toLowerCase() !== userAddress.toLowerCase()) {
      return {
        success: false,
        error: "This badge contract only permits its owner to mint. Connect the wallet that deployed the contract or configure an authorized minter."
      };
    }

    onStatusChange?.("Waiting for signature in wallet...");
    // Call contract mint(account, id, amount=1, data=0x)
    const tx = await contract.mint(userAddress, tokenId, 1, "0x");

    onStatusChange?.("Confirming on Sepolia testnet...");
    const receipt = await tx.wait(1);

    onStatusChange?.("Confirmed!");
    return {
      success: true,
      txHash: receipt.hash
    };
  } catch (err: any) {
    console.error("Mint error:", err);
    return {
      success: false,
      error: err.reason || err.message || "User rejected or transaction failed."
    };
  }
}

/**
 * Checks whether a given token ID has already been minted to the user's account on Sepolia.
 */
export async function checkBadgeMintedOnChain(
  tokenId: number,
  userAddress: string
): Promise<boolean> {
  const provider = getEthereumProvider();
  if (!provider || !CONTRACT_ADDRESS || !userAddress) return false;

  try {
    const browserProvider = new ethers.BrowserProvider(provider, "any");
    const contract = new ethers.Contract(CONTRACT_ADDRESS, GREEN_BADGE_ABI, browserProvider);

    try {
      const hasMinted = await contract.hasMintedBadge(tokenId, userAddress);
      if (hasMinted === true) return true;
    } catch {
      // Fallback to balanceOf
    }

    const balance = await contract.balanceOf(userAddress, tokenId);
    return Number(balance) > 0;
  } catch (err) {
    return false;
  }
}

