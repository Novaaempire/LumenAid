import { Router } from 'express';
import { query } from '../db.js';
import { fetchIncomingPayments, fetchAccountAssets, KNOWN_TESTNET_ASSETS } from '../horizon.js';
import { asyncHandler } from '../asyncHandler.js';
import { donationsQuerySchema, validateQuery } from '../validation.js';

export const donationsRouter = Router();

// GET /api/charities/:id/donations?limit=20&before=<ISO timestamp>
// Live-queries Horizon for the charity's wallet, upserts into the cache
// table, and returns the merged, sorted, paginated result. Every row
// includes the tx hash so the frontend can link straight to a block
// explorer -- the numbers shown are never "trust me", they're always
// re-derivable from Horizon.
donationsRouter.get('/:id/donations', validateQuery(donationsQuerySchema), asyncHandler(async (req, res) => {
  const { rows: charityRows } = await query('SELECT * FROM charities WHERE id = $1', [
    req.params.id,
  ]);
  if (!charityRows.length) return res.status(404).json({ error: 'Charity not found' });
  const charity = charityRows[0];
  const { limit, before } = req.validatedQuery;

  let accountExists = true;
  try {
    const result = await fetchIncomingPayments(charity.wallet_address, { limit: 100 });
    accountExists = result.accountExists;
    for (const p of result.payments) {
      await query(
        `INSERT INTO donation_cache (charity_id, tx_hash, from_address, amount, asset_code, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (charity_id, tx_hash) DO NOTHING`,
        [charity.id, p.txHash, p.fromAddress, p.amount, p.assetCode, p.createdAt]
      );
    }
  } catch (err) {
    console.error('Horizon fetch failed, falling back to cache only:', err.message);
  }

  const params = [charity.id];
  let beforeClause = '';
  if (before) {
    params.push(before.toISOString());
    beforeClause = `AND created_at < $${params.length}`;
  }
  params.push(limit + 1); // fetch one extra to know if there's a next page

  const { rows: page } = await query(
    `SELECT tx_hash, from_address, amount, asset_code, created_at
     FROM donation_cache WHERE charity_id = $1 ${beforeClause}
     ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );

  const hasMore = page.length > limit;
  const donations = page.slice(0, limit);

  const { rows: totalRows } = await query(
    `SELECT asset_code, COALESCE(SUM(amount), 0) AS total
     FROM donation_cache WHERE charity_id = $1 GROUP BY asset_code`,
    [charity.id]
  );
  const totals = Object.fromEntries(totalRows.map((r) => [r.asset_code, Number(r.total)]));

  res.json({
    charity: { id: charity.id, name: charity.name, walletAddress: charity.wallet_address },
    walletFunded: accountExists,
    totalReceivedXLM: totals.XLM || 0,
    totalsByAsset: totals,
    donations: donations.map((r) => ({
      txHash: r.tx_hash,
      fromAddress: r.from_address,
      amount: r.amount,
      assetCode: r.asset_code,
      createdAt: r.created_at,
    })),
    nextBefore: hasMore ? donations[donations.length - 1].created_at : null,
    source: 'Stellar Horizon (testnet), cached',
  });
}));

// GET /api/charities/:id/assets - which assets this charity's wallet can
// currently receive, derived live from its Horizon trustlines. Always
// includes XLM; a known asset like USDC only appears if the charity's
// wallet has actually established that trustline.
donationsRouter.get('/:id/assets', asyncHandler(async (req, res) => {
  const { rows: charityRows } = await query('SELECT * FROM charities WHERE id = $1', [
    req.params.id,
  ]);
  if (!charityRows.length) return res.status(404).json({ error: 'Charity not found' });
  const charity = charityRows[0];

  const { exists, assets } = await fetchAccountAssets(charity.wallet_address);

  const accepted = [{ code: 'XLM', issuer: null }];
  for (const [code, issuer] of Object.entries(KNOWN_TESTNET_ASSETS)) {
    if (assets.some((a) => a.code === code && a.issuer === issuer)) {
      accepted.push({ code, issuer });
    }
  }

  res.json({ walletFunded: exists, acceptedAssets: exists ? accepted : [{ code: 'XLM', issuer: null }] });
}));
