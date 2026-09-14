import { Link } from 'react-router-dom';

export default function CharityCard({ charity }) {
  return (
    <Link
      to={`/charities/${charity.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{charity.name}</h3>
        {charity.verified ? (
          <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            ✅ Verified
          </span>
        ) : (
          <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            ⏳ Unverified
          </span>
        )}
      </div>
      <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{charity.category}</p>
      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{charity.mission}</p>
      <p className="mt-3 truncate font-mono text-xs text-slate-400">{charity.wallet_address}</p>
    </Link>
  );
}
