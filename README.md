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

### Option A: Docker Compose

```bash
docker compose up --build
```

Starts Postgres, the backend, and the frontend together, wired up with matching defaults.
Open http://localhost:5173. The `ADMIN_KEY` defaults to `change-me-local-dev-only`
(override with `ADMIN_KEY=... docker compose up --build` for anything beyond a quick local
run). Verified end-to-end (DB persistence, backend ↔ Postgres, live Horizon queries all the
way through) — see [the networking note](#a-docker-networking-note) if you're curious why the
compose file uses `network_mode: bridge` + `links:` instead of the usual Compose-managed
network.

### Option B: Manual

**1. Database**

```bash
docker run --name lumenaid-db -e POSTGRES_PASSWORD=lumenaid -e POSTGRES_DB=lumenaid -p 5432:5432 -d postgres:16
```

(Or point `DATABASE_URL` at any Postgres instance you already have.)

**2. Backend**

```bash
cd backend
cp .env.example .env      # defaults match the docker command above
npm install
npm run db:init           # creates tables
npm run dev                # http://localhost:4000
```

**3. Frontend**

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                # http://localhost:5173
```

Open http://localhost:5173.

### Try the full loop

1. Go to **Admin** (`/admin`), enter the admin key from `backend/.env` (`ADMIN_KEY`), and
   add a charity with a real testnet wallet address (a `G...` public key — Friendbot-fund it
   at [laboratory.stellar.org](https://laboratory.stellar.org/#account-creator?network=test)
   if it doesn't exist on the ledger yet; if you skip this, LumenAid will create the account
   for you on the first donation — see [Handling a brand-new wallet](#handling-a-brand-new-wallet) below).
2. Go to that charity's profile, click **Connect Freighter Wallet** (make sure Freighter is
   set to Testnet and funded), pick an amount, and donate.
3. Approve the transaction in the Freighter popup. Once submitted, the confirmation shows
   the transaction hash immediately, and the donation appears in the live history feed below
   (polled from Horizon every 15s) with a **Verify on Stellar** link to Stellar Expert.

This loop (wallet connect → build tx → sign in Freighter → submit to Horizon → read back via
Horizon → link to a public explorer), plus every edge case documented below, has been
verified against **live Stellar testnet** — not mocked — as part of building this MVP.

## Environment variables

### `backend/.env`

| Variable | Description |
|---|---|
| `STELLAR_NETWORK` | `testnet` for MVP. The backend refuses to start if this is `public`. |
| `HORIZON_URL` | `https://horizon-testnet.stellar.org` |
| `DATABASE_URL` | Postgres connection string. Required — the backend fails fast at startup if missing. |
| `PORT` | Backend port (default `4000`) |
| `CORS_ORIGIN` | Frontend origin allowed to call the API (default `http://localhost:5173`) |
| `ADMIN_KEY` | Shared secret required (as `x-admin-key` header, compared in constant time) to add/verify charities. **Not real auth** — good enough for an MVP admin gate, nothing more. Change it before showing this to anyone. Required — the backend fails fast at startup if missing. |

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
| Freighter wallet connect, with a live network re-check before every signature | ✅ Working |
| Send XLM payment, signed client-side, submitted to testnet | ✅ Working, verified end-to-end against live testnet |
| First-ever donation to a brand-new charity wallet (Stellar `createAccount`) | ✅ Working, verified against live testnet |
| USDC donations, gated on a live trustline check (backend detects it via Horizon; donor can establish one in-app) | ✅ Working, verified against live testnet using the real Circle testnet USDC issuer + a self-issued test asset for the transfer mechanics |
| Live donation feed from Horizon, cached in Postgres, cursor-paginated | ✅ Working, verified with 5+ donations across 2 pages |
| Human-readable errors for failed transactions (underfunded, no trustline, etc.) instead of raw XDR codes | ✅ Working |
| "Verify on Stellar" link (Stellar Expert) per transaction | ✅ Working |
| USD-equivalent display (CoinGecko price feed, display only) | ✅ Working |
| Input validation (zod), rate limiting, security headers (helmet), timing-safe admin auth | ✅ Working |
| Docker Compose for one-command local dev | ✅ Working, verified end-to-end (DB persistence, backend ↔ Postgres, live Horizon queries through the compose network) |
| Albedo wallet support | ⏳ Not built (Freighter only for MVP) |
| Soroban escrow/disbursement contracts | ⏳ Not built — direct payment flow is sufficient for MVP |
| Automated test suite | ⏳ Not built — verification so far is manual, scripted runs against live testnet (see below) |
| Mainnet deployment | ❌ Out of scope — testnet only |

## Handling real Stellar conditions

A few things that are easy to get wrong on Stellar specifically, and how this MVP handles
each one — all verified against live testnet, not assumed from documentation:

- **A brand-new wallet doesn't exist as a ledger account yet.** Stellar requires a
  `createAccount` operation (funded with a minimum ~1 XLM reserve), not a `payment`, to send
  XLM to an address that's never received funds. `buildPaymentTransaction` checks whether the
  destination exists first and uses the right operation automatically; donating a non-native
  asset to a brand-new address is rejected client-side with a clear message, since a
  never-funded account can't hold a trustline yet.
- **A charity's very first "donation" may not be a real donor.** On testnet, Friendbot funds
  accounts by literally sending them XLM via `createAccount` — which is indistinguishable
  on-chain from a real donation. LumenAid intentionally shows it anyway rather than filtering
  it out: doing otherwise would mean deciding which real on-chain transactions to hide, which
  is exactly the kind of "trust me" behavior this app is built to avoid. This artifact
  disappears on mainnet, where wallets are normally funded before being listed.
- **Non-native assets (USDC) require a trustline on both sides.** The backend's
  `/api/charities/:id/assets` endpoint reports which assets a charity's wallet can currently
  receive, derived live from its actual Horizon trustlines (never a manual flag) — the UI
  only offers USDC as a donation option when the charity's own wallet already trusts it. If
  the donor's wallet lacks the trustline, the UI walks them through establishing one
  (`changeTrust`, signed the same way as a donation) before letting them send.
- **Horizon errors are XDR result codes, not sentences.** `decodeHorizonError` maps the common
  ones (`op_underfunded`, `op_no_trust`, `tx_bad_seq`, etc.) to a message a donor can act on.
- **The donor's Freighter network can change after connecting.** `ensureTestnet()` re-checks
  Freighter's *live* active network immediately before every signature request, not just at
  connect time, since nothing stops a donor from switching networks mid-session.

### A Docker networking note

`docker-compose.yml` connects services with the classic `network_mode: bridge` + `links:`
instead of letting Compose create its usual user-defined network. This was forced by the
sandbox this MVP was built in: Docker's default `bridge` network worked fine, but any
custom/user-defined bridge network silently dropped all container-to-container traffic
(confirmed directly with `docker network create` + `ping`, independent of this compose file
or anything backend/frontend-specific). `network_mode: bridge` + `links:` is how Docker
networking worked before user-defined networks existed, so it's universally supported — you
lose per-network service aliases, which this file doesn't use anyway. If you're not hitting
that restriction, a standard `networks:` block works too.

## Design constraints (by intent, not oversight)

- **No custody.** The backend never sees a private key and never signs a transaction. All
  signing happens in the donor's Freighter extension.
- **No trust-me numbers.** Every stat shown (totals, history) is derived from a live Horizon
  query; the Postgres table is a cache with a `UNIQUE (charity_id, tx_hash)` constraint, not
  a system of record. If you truncate it, the next page load rebuilds it from Horizon.
- **Testnet only.** `HORIZON_URL`/`VITE_HORIZON_URL` point at
  `horizon-testnet.stellar.org`; switching to mainnet is a deliberate, separate step this MVP
  does not take, and the backend actively refuses to start with `STELLAR_NETWORK=public`.
- **Known-asset allowlist, not open mint support.** `KNOWN_TESTNET_ASSETS` only recognizes
  USDC by its real Circle-issued testnet address. A charity's wallet could hold trustlines for
  arbitrary other tokens; LumenAid doesn't surface those as donation options.

## What's next

- Albedo as a second wallet option for donors without the Freighter extension
- An automated test suite (current verification is manual scripted runs against live
  testnet — solid for catching real Stellar-integration bugs, as it did during this build,
  but no substitute for CI-run regression tests)
- Real admin auth (the current shared-key header is MVP-only)
