import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fetchXlmUsdPrice } from '../lib/stellar.js';
import VerifyLink from './VerifyLink.jsx';

const POLL_MS = 15000;

export default function DonationFeed({ charityId, refreshKey }) {
  const [data, setData] = useState(null);
  const [usdPrice, setUsdPrice] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function load() {
      try {
        const result = await api.getDonations(charityId);
        if (!cancelled) {
          setData(result);
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

  if (loading) return <p className="text-sm text-slate-500">Loading donation history from Horizon…</p>;
  if (error) return <p className="text-sm text-red-600">Couldn't load donation history: {error}</p>;
  if (!data?.donations?.length) {
    return (
      <p className="text-sm text-slate-500">
        No on-chain donations yet. Once someone sends XLM to this charity's wallet, it will show up
        here automatically (polled from Horizon every 15s).
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <span className="text-2xl font-bold text-slate-900">{data.totalReceivedXLM.toFixed(2)}</span>
          <span className="ml-1 text-sm text-slate-500">XLM received</span>
        </div>
        {usdPrice && (
          <span className="text-sm text-slate-400">
            ≈ ${(data.totalReceivedXLM * usdPrice).toFixed(2)} USD
          </span>
        )}
        <span className="text-xs text-slate-400">Source: {data.source}</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {data.donations.map((d) => (
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
    </div>
  );
}
