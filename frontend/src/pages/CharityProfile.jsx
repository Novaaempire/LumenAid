import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import freighterApi from '@stellar/freighter-api';
import { api } from '../lib/api.js';
import { useWallet } from '../context/WalletContext.jsx';
import {
  buildPaymentTransaction,
  buildTrustlineTransaction,
  submitSignedTransaction,
  stellarExpertAccountUrl,
  decodeHorizonError,
  hasTrustline,
  NETWORK_PASSPHRASE,
} from '../lib/stellar.js';
import DonationFeed from '../components/DonationFeed.jsx';
import VerifyLink from '../components/VerifyLink.jsx';

const PRESET_AMOUNTS = [5, 20, 100];

export default function CharityProfile() {
  const { id } = useParams();
  const { address, connect, ensureTestnet } = useWallet();

  const [charity, setCharity] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [acceptedAssets, setAcceptedAssets] = useState([{ code: 'XLM', issuer: null }]);
  const [asset, setAsset] = useState({ code: 'XLM', issuer: null });

  const [amount, setAmount] = useState('20');
  // idle | checking-trustline | needs-trustline | establishing-trustline | signing | submitting | success | error
  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState(null);
  const [lastTxHash, setLastTxHash] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api
      .getCharity(id)
      .then(setCharity)
      .catch((e) => setLoadError(e.message));
    api
      .getAcceptedAssets(id)
      .then((res) => setAcceptedAssets(res.acceptedAssets))
      .catch(() => {
        /* non-fatal: donation still works with XLM as the default */
      });
  }, [id]);

  async function ensureDonorTrustline(donorAddress) {
    if (asset.code === 'XLM') return;
    setStatus('checking-trustline');
    const trusted = await hasTrustline(donorAddress, asset);
    if (trusted) return;

    setStatus('needs-trustline');
    throw new NeedsTrustlineSignal();
  }

  async function establishTrustline() {
    setStatus('establishing-trustline');
    setStatusMessage(null);
    try {
      const donorAddress = address || (await connect());
      await ensureTestnet();

      const unsignedXdr = await buildTrustlineTransaction({ fromAddress: donorAddress, asset });
      const { signedTxXdr, error: signErr } = await freighterApi.signTransaction(unsignedXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: donorAddress,
      });
      if (signErr) throw new Error(signErr.message || 'Signing was cancelled.');

      await submitSignedTransaction(signedTxXdr);
      setStatus('idle');
      setStatusMessage(`Trustline for ${asset.code} established. You can now donate.`);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setStatusMessage(decodeHorizonError(err));
    }
  }

  async function handleDonate(e) {
    e.preventDefault();
    setStatusMessage(null);
    setLastTxHash(null);

    try {
      let donorAddress = address;
      if (!donorAddress) donorAddress = await connect();

      await ensureTestnet();

      const numericAmount = Number(amount);
      if (!numericAmount || numericAmount <= 0) {
        throw new Error('Enter a donation amount greater than 0.');
      }

      await ensureDonorTrustline(donorAddress);

      setStatus('signing');
      const unsignedXdr = await buildPaymentTransaction({
        fromAddress: donorAddress,
        toAddress: charity.wallet_address,
        amount: numericAmount.toFixed(7),
        asset,
        memo: `LumenAid:${charity.id}`,
      });

      const { signedTxXdr, error: signErr } = await freighterApi.signTransaction(unsignedXdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: donorAddress,
      });
      if (signErr) throw new Error(signErr.message || 'Signing was cancelled.');

      setStatus('submitting');
      const result = await submitSignedTransaction(signedTxXdr);

      setLastTxHash(result.hash);
      setStatus('success');
      setStatusMessage(`Sent ${numericAmount} ${asset.code}. It should appear below within a few seconds.`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      if (err instanceof NeedsTrustlineSignal) return; // status already set to 'needs-trustline'
      console.error(err);
      setStatus('error');
      setStatusMessage(decodeHorizonError(err));
    }
  }

  if (loadError) return <p className="text-red-600">Couldn't load charity: {loadError}</p>;
  if (!charity) return <p className="text-slate-500">Loading…</p>;

  const isBusy = ['checking-trustline', 'establishing-trustline', 'signing', 'submitting'].includes(status);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{charity.name}</h1>
          {charity.verified ? (
            <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
              ✅ Admin-verified
            </span>
          ) : (
            <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
              ⏳ Not yet verified
            </span>
          )}
        </div>
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{charity.category}</p>
        <p className="mt-3 text-slate-700">{charity.mission}</p>

        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <span className="font-mono">{charity.wallet_address}</span>
          <a
            href={stellarExpertAccountUrl(charity.wallet_address)}
            target="_blank"
            rel="noreferrer"
            className="text-lumen-600 hover:underline"
          >
            View account ↗
          </a>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Donation history (live from Horizon)</h2>
          <DonationFeed charityId={id} refreshKey={refreshKey} />
        </div>
      </div>

      <div className="lg:col-span-1">
        <form
          onSubmit={handleDonate}
          className="sticky top-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-900">Donate</h2>

          {acceptedAssets.length > 1 && (
            <div className="mt-3 flex gap-2">
              {acceptedAssets.map((a) => (
                <button
                  type="button"
                  key={a.code}
                  onClick={() => {
                    setAsset(a);
                    setStatus('idle');
                    setStatusMessage(null);
                  }}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${
                    asset.code === a.code
                      ? 'border-lumen-600 bg-lumen-50 text-lumen-700'
                      : 'border-slate-200 text-slate-600 hover:border-lumen-300'
                  }`}
                >
                  {a.code}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {PRESET_AMOUNTS.map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setAmount(String(v))}
                className={`flex-1 rounded-lg border px-2 py-2 text-sm font-medium ${
                  amount === String(v)
                    ? 'border-lumen-600 bg-lumen-50 text-lumen-700'
                    : 'border-slate-200 text-slate-600 hover:border-lumen-300'
                }`}
              >
                {v} {asset.code}
              </button>
            ))}
          </div>

          <label className="mt-3 block text-sm font-medium text-slate-700">
            Custom amount
            <input
              type="number"
              min="0.0000001"
              step="0.0000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          {status === 'needs-trustline' ? (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <p>
                Your wallet doesn't have a trustline for {asset.code} yet — Stellar requires one before it
                can receive a non-native asset. This is a one-time setup transaction, signed the same way as
                a donation.
              </p>
              <button
                type="button"
                onClick={establishTrustline}
                disabled={isBusy}
                className="mt-2 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {status === 'establishing-trustline' ? 'Establishing trustline…' : `Establish ${asset.code} trustline`}
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={isBusy}
              className="mt-4 w-full rounded-lg bg-lumen-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-lumen-700 disabled:opacity-50"
            >
              {status === 'checking-trustline' && 'Checking wallet…'}
              {status === 'signing' && 'Waiting for wallet signature…'}
              {status === 'submitting' && 'Submitting to Stellar…'}
              {!isBusy && (address ? `Donate ${amount || 0} ${asset.code}` : 'Connect wallet & donate')}
            </button>
          )}

          {status === 'success' && (
            <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
              <p className="font-medium">✅ Donation confirmed on-ledger</p>
              <p className="mt-1">{statusMessage}</p>
              {lastTxHash && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="truncate font-mono text-xs">{lastTxHash}</span>
                  <VerifyLink txHash={lastTxHash} />
                </div>
              )}
            </div>
          )}
          {status === 'error' && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{statusMessage}</p>
          )}
          {status === 'idle' && statusMessage && (
            <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{statusMessage}</p>
          )}

          <p className="mt-4 text-xs text-slate-400">
            Payments are signed in your Freighter wallet and sent directly to the charity's testnet
            address. This app never has access to your keys or funds.
          </p>
        </form>
      </div>
    </div>
  );
}

// Internal control-flow signal (not a real error) used to bail out of
// handleDonate when a trustline needs to be set up first, without
// triggering the generic error-message path.
class NeedsTrustlineSignal extends Error {}
