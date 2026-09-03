"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { 
  WalletState, 
  connectWallet, 
  switchToSepolia, 
  getEthereumProvider, 
  hasWeb3Provider 
} from "../lib/web3";

interface WalletContextType {
  wallet: WalletState;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<boolean>;
  clearError: () => void;
}

const initialWalletState: WalletState = {
  isConnected: false,
  address: null,
  chainId: null,
  isSepolia: false,
  balanceEth: null,
  error: null
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<WalletState>(initialWalletState);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Synchronize active account and network
  const syncWallet = useCallback(async () => {
    const provider = getEthereumProvider();
    if (!provider) return;

    try {
      const accounts: string[] = await provider.request({ method: "eth_accounts" });
      if (accounts && accounts.length > 0) {
        const res = await connectWallet();
        setWallet(res);
      }
    } catch (err) {
      console.warn("Error checking connected accounts:", err);
    }
  }, []);

  // Connect wallet action with loading state
  const connect = useCallback(async () => {
    if (!hasWeb3Provider()) {
      setWallet({
        ...initialWalletState,
        error: "MetaMask not detected. Please install MetaMask to interact with Sepolia testnet."
      });
      // Optionally open MetaMask download page if not installed
      if (typeof window !== "undefined") {
        window.open("https://metamask.io/download/", "_blank");
      }
      return;
    }

    setIsConnecting(true);
    try {
      const res = await connectWallet();
      setWallet(res);
    } catch (err: any) {
      setWallet({
        ...initialWalletState,
        error: err.message || "Failed to connect wallet"
      });
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect / reset local wallet state
  const disconnect = useCallback(() => {
    setWallet(initialWalletState);
  }, []);

  // Switch network to Sepolia and refresh state
  const switchNetwork = useCallback(async (): Promise<boolean> => {
    const success = await switchToSepolia();
    if (success) {
      const res = await connectWallet();
      setWallet(res);
    }
    return success;
  }, []);

  const clearError = useCallback(() => {
    setWallet((prev) => ({ ...prev, error: null }));
  }, []);

  // Setup EIP-1193 event listeners for real-time synchronization
  useEffect(() => {
    syncWallet();

    const provider = getEthereumProvider();
    if (!provider || !provider.on) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setWallet(initialWalletState);
      } else {
        connectWallet().then(setWallet);
      }
    };

    const handleChainChanged = () => {
      connectWallet().then(setWallet);
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [syncWallet]);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        isConnecting,
        connect,
        disconnect,
        switchNetwork,
        clearError
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
