import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import freighterApi from '@stellar/freighter-api';
import { NETWORK_PASSPHRASE } from '../lib/stellar.js';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [network, setNetwork] = useState(null);
  const [networkPassphrase, setNetworkPassphrase] = useState(null);
  const [isFreighterInstalled, setIsFreighterInstalled] = useState(null);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);

  // On load, check whether Freighter is installed and whether this site is
  // already allowed -- so returning users don't have to reconnect.
  useEffect(() => {
    (async () => {
      try {
        const { isConnected } = await freighterApi.isConnected();
        setIsFreighterInstalled(isConnected);
        if (!isConnected) return;

        const { isAllowed } = await freighterApi.isAllowed();
        if (isAllowed) {
          const { address: addr, error: addrErr } = await freighterApi.getAddress();
          if (!addrErr && addr) setAddress(addr);
          const netInfo = await freighterApi.getNetwork();
          if (!netInfo.error) {
            setNetwork(netInfo.network);
            setNetworkPassphrase(netInfo.networkPassphrase);
          }
        }
      } catch {
        setIsFreighterInstalled(false);
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const { isConnected } = await freighterApi.isConnected();
      if (!isConnected) {
        setIsFreighterInstalled(false);
        throw new Error('Freighter extension not detected. Install it from freighter.app to donate.');
      }
      setIsFreighterInstalled(true);

      const { address: addr, error: accessErr } = await freighterApi.requestAccess();
      if (accessErr) throw new Error(accessErr.message || 'Wallet access was denied.');

      const netInfo = await freighterApi.getNetwork();
      if (netInfo.error) throw new Error(netInfo.error.message || 'Could not read wallet network.');

      setAddress(addr);
      setNetwork(netInfo.network);
      setNetworkPassphrase(netInfo.networkPassphrase);

      if (netInfo.networkPassphrase !== NETWORK_PASSPHRASE) {
        setError(
          `Freighter is set to "${netInfo.network}", but this app uses Stellar Testnet. Switch networks in Freighter.`
        );
      }
      return addr;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // Freighter has no programmatic "disconnect" -- this only clears local
    // app state. Revoking access happens in the Freighter extension itself.
    setAddress(null);
    setNetwork(null);
    setNetworkPassphrase(null);
  }, []);

  // Re-checks Freighter's *live* active network right before something
  // security-sensitive (signing a payment). The user can switch networks in
  // the extension at any time after connecting, so the state captured at
  // connect-time isn't trustworthy for this -- always re-verify live.
  const ensureTestnet = useCallback(async () => {
    const netInfo = await freighterApi.getNetwork();
    if (netInfo.error) throw new Error(netInfo.error.message || 'Could not read wallet network.');
    setNetwork(netInfo.network);
    setNetworkPassphrase(netInfo.networkPassphrase);
    if (netInfo.networkPassphrase !== NETWORK_PASSPHRASE) {
      throw new Error(
        `Freighter is set to "${netInfo.network}", but this app only supports Stellar Testnet. Switch networks in Freighter and try again.`
      );
    }
  }, []);

  const value = {
    address,
    network,
    networkPassphrase,
    isFreighterInstalled,
    connecting,
    error,
    connect,
    disconnect,
    ensureTestnet,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
