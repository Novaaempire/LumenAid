import { Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import CharityProfile from './pages/CharityProfile.jsx';
import Admin from './pages/Admin.jsx';
import WalletConnectButton from './components/WalletConnectButton.jsx';

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl">🌍</span>
            <span className="text-lg font-bold text-slate-900">LumenAid</span>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              Testnet
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
              Charities
            </Link>
            <Link to="/admin" className="text-sm text-slate-600 hover:text-slate-900">
              Admin
            </Link>
            <WalletConnectButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/charities/:id" element={<CharityProfile />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  );
}
