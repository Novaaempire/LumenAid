import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import CharityCard from '../components/CharityCard.jsx';

export default function Home() {
  const [charities, setCharities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .listCharities()
      .then(setCharities)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Verified charities on Stellar</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Every donation below is a direct wallet-to-wallet payment on the Stellar testnet. No
          intermediary custodies your funds, and every transaction can be independently verified
          on the public ledger.
        </p>
      </div>

      {loading && <p className="text-slate-500">Loading charities…</p>}
      {error && (
        <p className="text-red-600">
          Couldn't reach the backend ({error}). Is it running on the URL in VITE_API_URL?
        </p>
      )}
      {!loading && !error && charities.length === 0 && (
        <p className="text-slate-500">
          No charities yet. Go to <span className="font-medium">Admin</span> to add one.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {charities.map((c) => (
          <CharityCard key={c.id} charity={c} />
        ))}
      </div>
    </div>
  );
}
