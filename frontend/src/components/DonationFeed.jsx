import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fetchXlmUsdPrice } from '../lib/stellar.js';
import VerifyLink from './VerifyLink.jsx';

const POLL_MS = 15000;
const PAGE_SIZE = 20;

export default function DonationFeed({ charityId, refreshKey }) {
  const [summary, setSummary] = useState(null); // { totalReceivedXLM, totalsByAsset, walletFunded, source }
  const [donations, setDonations] = useState([]);
  const [nextBefore, setNextBefore] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [usdPrice, setUsdPrice] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initial load + poll for new donations at the top of the feed. Polling
  // always re-fetches the first page (no `before`), so it naturally picks
  // up new donations without disturbing anything the user has paged into.
  useEffect(() => {
    let cancelled = false;
    let timer;

    async function load() {
      try {
        const result = await api.getDonations(charityId, { limit: PAGE_SIZE });
        if (!cancelled) {
          setSummary(result);
          setDonations(result.donations);
          setNextBefore(result.nextBefore);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [charityId, refreshKey]);

  useEffect(() => {
    fetchXlmUsdPrice().then(setUsdPrice);
  }, []);

  async function loadMore() {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const result = await api.getDonations(charityId, { limit: PAGE_SIZE, before: nextBefore });
      setDonations((prev) => [...prev, ...result.donations]);
      setNextBefore(result.nextBefore);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading donation history from Horizon…</p>;
  if (error) return <p className="text-sm text-red-600">Couldn't load donation history: {error}</p>;

  if (summary && !summary.walletFunded) {
    return (
      <p className="text-sm text-slate-500">
        This charity's wallet hasn't received its first payment yet, so it doesn't exist on the Stellar
        ledger as an account. It will show up automatically once someone donates.
      </p>
    );
  }

  if (!donations.length) {
    return (
      <p className="text-sm text-slate-500">
        No on-chain donations yet. Once someone sends a donation to this charity's wallet, it will show
        up here automatically (polled from Horizon every 15s).
      </p>
    );
  }

  const totalXLM = summary?.totalReceivedXLM ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <span className="text-2xl font-bold text-slate-900">{totalXLM.toFixed(2)}</span>
          <span className="ml-1 text-sm text-slate-500">XLM received</span>
        </div>
        {usdPrice && (
          <span className="text-sm text-slate-400">≈ ${(totalXLM * usdPrice).toFixed(2)} USD</span>
        )}
        {summary?.totalsByAsset &&
          Object.entries(summary.totalsByAsset)
            .filter(([code]) => code !== 'XLM')
            .map(([code, total]) => (
              <span key={code} className="text-sm text-slate-500">
                {Number(total).toLocaleString()} {code}
              </span>
            ))}
        <span className="text-xs text-slate-400">Source: {summary?.source}</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {donations.map((d) => (
          <li key={d.txHash} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-mono text-sm text-slate-800">
                {Number(d.amount).toLocaleString(undefined, { maximumFractionDigits: 7 })} {d.assetCode}
                {usdPrice && d.assetCode === 'XLM' && (
                  <span className="ml-2 text-xs text-slate-400">
                    ≈ ${(Number(d.amount) * usdPrice).toFixed(2)}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                from <span className="font-mono">{d.fromAddress.slice(0, 6)}…{d.fromAddress.slice(-6)}</span>{' '}
                · {new Date(d.createdAt).toLocaleString()}
              </p>
            </div>
            <VerifyLink txHash={d.txHash} />
          </li>
        ))}
      </ul>

      {nextBefore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:border-lumen-300 hover:text-lumen-700 disabled:opacity-50"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
