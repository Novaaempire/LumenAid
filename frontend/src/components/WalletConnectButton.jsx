import { useWallet } from '../context/WalletContext.jsx';

function shorten(address) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function WalletConnectButton() {
  const { address, connect, disconnect, connecting, error, isFreighterInstalled } = useWallet();

  if (address) {
    return (
      <button
        onClick={disconnect}
        className="rounded-full bg-lumen-50 px-4 py-2 text-sm font-medium text-lumen-700 hover:bg-lumen-100"
        title={address}
      >
        🟢 {shorten(address)}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={connect}
        disabled={connecting}
        className="rounded-full bg-lumen-600 px-4 py-2 text-sm font-medium text-white hover:bg-lumen-700 disabled:opacity-50"
      >
        {connecting ? 'Connecting…' : 'Connect Freighter Wallet'}
      </button>
      {isFreighterInstalled === false && (
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-lumen-600 underline"
        >
          Install Freighter
        </a>
      )}
      {error && <p className="max-w-xs text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
