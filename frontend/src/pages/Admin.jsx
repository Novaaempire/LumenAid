import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const CATEGORIES = ['humanitarian', 'health', 'education', 'environment', 'disaster-relief', 'general'];

function useAdminKey() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('lumenaid_admin_key') || '');

  function save(key) {
    sessionStorage.setItem('lumenaid_admin_key', key);
    setAdminKey(key);
  }

  return [adminKey, save];
}

export default function Admin() {
  const [adminKey, setAdminKey] = useAdminKey();
  const [charities, setCharities] = useState([]);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    mission: '',
    category: CATEGORIES[0],
    walletAddress: '',
    verified: false,
  });

  function loadCharities() {
    api.listCharities().then(setCharities).catch((e) => setError(e.message));
  }

  useEffect(loadCharities, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.createCharity(form, adminKey);
      setForm({ name: '', mission: '', category: CATEGORIES[0], walletAddress: '', verified: false });
      loadCharities();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleVerified(charity) {
    try {
      await api.setVerified(charity.id, !charity.verified, adminKey);
      loadCharities();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="mt-1 text-sm text-slate-500">
          MVP-only: manual verification, no KYC. Protected by a shared admin key sent as a header —
          not real auth. Don't reuse this for anything beyond local development.
        </p>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Admin key
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="matches backend ADMIN_KEY"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Add a charity</h2>

          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Mission statement
            <textarea
              required
              value={form.mission}
              onChange={(e) => setForm({ ...form, mission: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={3}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Category
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Stellar wallet address (testnet, G…)
            <input
              required
              value={form.walletAddress}
              onChange={(e) => setForm({ ...form, walletAddress: e.target.value })}
              placeholder="G..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.verified}
              onChange={(e) => setForm({ ...form, verified: e.target.checked })}
            />
            Mark verified immediately
          </label>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-lumen-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-lumen-700 disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add charity'}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">All charities</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ul className="mt-3 space-y-3">
          {charities.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{c.name}</p>
                <p className="truncate font-mono text-xs text-slate-400">{c.wallet_address}</p>
              </div>
              <button
                onClick={() => toggleVerified(c)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                  c.verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {c.verified ? '✅ Verified — click to unverify' : '⏳ Unverified — click to verify'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
