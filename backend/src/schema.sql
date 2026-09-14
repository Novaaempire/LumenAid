-- LumenAid MVP schema
-- Charities table stores ONLY public metadata. Never store private keys here.

CREATE TABLE IF NOT EXISTS charities (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  mission         TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'general',
  wallet_address  TEXT NOT NULL UNIQUE,   -- Stellar public key (G...), testnet
  verified        BOOLEAN NOT NULL DEFAULT FALSE, -- manual admin flag, no KYC in MVP
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lightweight cache of Horizon payment operations per charity, so the
-- frontend isn't hammering Horizon directly on every page load. This is a
-- CACHE, not a source of truth -- the source of truth is always Horizon /
-- the public ledger, and every row here carries the tx hash so it can be
-- independently re-verified at any time.
CREATE TABLE IF NOT EXISTS donation_cache (
  id              SERIAL PRIMARY KEY,
  charity_id      INTEGER NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
  tx_hash         TEXT NOT NULL,
  from_address    TEXT NOT NULL,
  amount          NUMERIC NOT NULL,
  asset_code      TEXT NOT NULL DEFAULT 'XLM',
  created_at      TIMESTAMPTZ NOT NULL, -- ledger close time from Horizon
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (charity_id, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_donation_cache_charity ON donation_cache(charity_id);
