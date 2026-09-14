import { Router } from 'express';
import { query } from '../db.js';
import { fetchIncomingPayments } from '../horizon.js';
import { asyncHandler } from '../asyncHandler.js';

export const donationsRouter = Router();

// GET /api/charities/:id/donations
// Live-queries Horizon for the charity's wallet, upserts into the cache
// table, and returns the merged, sorted result. Every row includes the
// tx hash so the frontend can link straight to a block explorer -- the
// numbers shown are never "trust me", they're always re-derivable from
// Horizon.
donationsRouter.get('/:id/donations', asyncHandler(async (req, res) => {
  const { rows: charityRows } = await query('SELECT * FROM charities WHERE id = $1', [
    req.params.id,
  ]);
  if (!charityRows.length) return res.status(404).json({ error: 'Charity not found' });
  const charity = charityRows[0];

  let payments = [];
  try {
    payments = await fetchIncomingPayments(charity.wallet_address, { limit: 50 });
  } catch (err) {
    console.error('Horizon fetch failed, falling back to cache only:', err.message);
  }

  for (const p of payments) {
    await query(
      `INSERT INTO donation_cache (charity_id, tx_hash, from_address, amount, asset_code, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (charity_id, tx_hash) DO NOTHING`,
      [charity.id, p.txHash, p.fromAddress, p.amount, p.assetCode, p.createdAt]
    );
  }

  const { rows: cached } = await query(
    `SELECT tx_hash, from_address, amount, asset_code, created_at
     FROM donation_cache WHERE charity_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [charity.id]
  );

  const total = cached
    .filter((r) => r.asset_code === 'XLM')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  res.json({
    charity: { id: charity.id, name: charity.name, walletAddress: charity.wallet_address },
    totalReceivedXLM: total,
    donations: cached.map((r) => ({
      txHash: r.tx_hash,
      fromAddress: r.from_address,
      amount: r.amount,
      assetCode: r.asset_code,
      createdAt: r.created_at,
    })),
    source: 'Stellar Horizon (testnet), cached',
  });
}));
