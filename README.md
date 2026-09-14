# 🌍 LumenAid — Crypto-Powered Donation Platform (MVP)

A transparent, borderless donation platform on the **Stellar Network**. Donors send funds
straight to verified charities' wallets; every donation is publicly traceable on the Stellar
ledger via the Horizon API — no "trust me" numbers from a backend.

Currently wired up end-to-end against **Stellar Testnet**.

## How it works

```
Donor's Freighter wallet ──sign──► Stellar Testnet ──payment──► Charity wallet
                                          │
                                          ▼
                                   Horizon API (public ledger data)
                                          │
                                          ▼
                     Backend (cache only) ──► Frontend (charity pages, live feed)
```

The backend **never holds funds or private keys**. Every payment is built client-side,
signed in the donor's Freighter wallet, and submitted directly to Horizon. The backend's
only jobs are (1) storing public charity metadata (name, mission, wallet address, verified
flag) and (2) caching Horizon query results so pages don't re-hit Horizon on every load.

## Repo layout

```
backend/    Node.js + Express + PostgreSQL — charity metadata & Horizon cache
frontend/   React + Vite + Tailwind — wallet connect, donate flow, charity profiles, admin
```

## Prerequisites

- Node.js >= 18
- PostgreSQL (or Docker, to run one locally — see below)
- [Freighter wallet](https://www.freighter.app/) browser extension, set to **Testnet**,
  funded via [Friendbot](https://laboratory.stellar.org/#account-creator?network=test)

## Setup

### 1. Database

```bash
docker run --name lumenaid-db -e POSTGRES_PASSWORD=lumenaid -e POSTGRES_DB=lumenaid -p 5432:5432 -d postgres:16
```

(Or point `DATABASE_URL` at any Postgres instance you already have.)

### 2. Backend

```bash
cd backend
cp .env.example .env      # defaults match the docker command above
npm install
npm run db:init           # creates tables
npm run dev                # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                # http://localhost:5173
```

Open http://localhost:5173.

### 4. Try the full loop

1. Go to **Admin** (`/admin`), enter the admin key from `backend/.env` (`ADMIN_KEY`), and
   add a charity with a real testnet wallet address (a `G...` public key funded via
   [Friendbot](https://laboratory.stellar.org/#account-creator?network=test)).
2. Go to that charity's profile, click **Connect Freighter Wallet** (make sure Freighter is
   set to Testnet and funded), pick an amount, and donate.
3. Approve the transaction in the Freighter popup. Once submitted, the confirmation shows
   the transaction hash immediately, and the donation appears in the live history feed below
   (polled from Horizon every 15s) with a **Verify on Stellar** link to Stellar Expert.

This loop (wallet connect → build tx → sign in Freighter → submit to Horizon → read back via
Horizon → link to a public explorer) has been verified against live Stellar Testnet as part
of building this MVP — see [Feature status](#feature-status) below.

## Environment variables

### `backend/.env`

| Variable | Description |
|---|---|
| `STELLAR_NETWORK` | `testnet` for MVP. Do not point at `public` (mainnet). |
| `HORIZON_URL` | `https://horizon-testnet.stellar.org` |
| `DATABASE_URL` | Postgres connection string |
| `PORT` | Backend port (default `4000`) |
| `CORS_ORIGIN` | Frontend origin allowed to call the API (default `http://localhost:5173`) |
| `ADMIN_KEY` | Shared secret required (as `x-admin-key` header) to add/verify charities. **Not real auth** — good enough for an MVP admin gate, nothing more. Change it before showing this to anyone. |

### `frontend/.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL, e.g. `http://localhost:4000` |
| `VITE_STELLAR_NETWORK` | `testnet` |
| `VITE_HORIZON_URL` | `https://horizon-testnet.stellar.org` |

There is intentionally no `VITE_ADMIN_KEY` — baking the admin secret into the frontend build
would ship it in the public JS bundle. The Admin page asks for the key at runtime instead and
keeps it only in `sessionStorage`.

## Feature status

| Feature | Status |
|---|---|
| Charity onboarding (name, mission, wallet, category) via Admin UI | ✅ Working |
| Manual admin verification flag (no KYC) | ✅ Working |
| Public charity profile (wallet address, total received, history) | ✅ Working |
| Freighter wallet connect | ✅ Working |
| Send XLM payment, signed client-side, submitted to testnet | ✅ Working, verified end-to-end against live testnet |
| Live donation feed from Horizon, cached in Postgres | ✅ Working |
| "Verify on Stellar" link (Stellar Expert) per transaction | ✅ Working |
| USD-equivalent display (CoinGecko price feed, display only) | ✅ Working |
| Albedo wallet support | ⏳ Not built (Freighter only for MVP) |
| USDC / Stellar anchor support | ⏳ Not built (XLM only for MVP) |
| Soroban escrow/disbursement contracts | ⏳ Not built — direct payment flow is sufficient for MVP |
| Mainnet deployment | ❌ Out of scope — testnet only |

## Design constraints (by intent, not oversight)

- **No custody.** The backend never sees a private key and never signs a transaction. All
  signing happens in the donor's Freighter extension.
- **No trust-me numbers.** Every stat shown (totals, history) is derived from a live Horizon
  query; the Postgres table is a cache with a `UNIQUE (charity_id, tx_hash)` constraint, not
  a system of record. If you truncate it, the next page load rebuilds it from Horizon.
- **Testnet only.** `HORIZON_URL`/`VITE_HORIZON_URL` point at
  `horizon-testnet.stellar.org`; switching to mainnet is a deliberate, separate step this MVP
  does not take.

## What's next

- Albedo as a second wallet option for donors without the Freighter extension
- USDC donations via a Stellar anchor
- Pagination / infinite scroll on the donation feed for high-volume charities
- Real admin auth (the current shared-key header is MVP-only)
