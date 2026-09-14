import { Router } from 'express';
import { StrKey } from '@stellar/stellar-sdk';
import { query } from '../db.js';
import { requireAdmin } from '../adminAuth.js';
import { asyncHandler } from '../asyncHandler.js';

export const charitiesRouter = Router();

function isValidStellarAddress(address) {
  return typeof address === 'string' && StrKey.isValidEd25519PublicKey(address);
}

// GET /api/charities - public list (query ?verified=true to filter)
charitiesRouter.get('/', asyncHandler(async (req, res) => {
  const { verified } = req.query;
  const clauses = [];
  const params = [];

  if (verified === 'true') clauses.push('verified = TRUE');
  if (verified === 'false') clauses.push('verified = FALSE');

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT * FROM charities ${where} ORDER BY created_at DESC`,
    params
  );
  res.json(rows);
}));

// GET /api/charities/:id - public profile
charitiesRouter.get('/:id', asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM charities WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Charity not found' });
  res.json(rows[0]);
}));

// POST /api/charities - admin only: onboard a new charity
charitiesRouter.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { name, mission, category, walletAddress, verified } = req.body || {};

  if (!name || !mission || !walletAddress) {
    return res.status(400).json({ error: 'name, mission, and walletAddress are required' });
  }
  if (!isValidStellarAddress(walletAddress)) {
    return res.status(400).json({ error: 'walletAddress is not a valid Stellar public key (G...)' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO charities (name, mission, category, wallet_address, verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, mission, category || 'general', walletAddress, !!verified]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A charity with this wallet address already exists' });
    }
    throw err;
  }
}));

// PATCH /api/charities/:id/verify - admin only: toggle manual verification flag
charitiesRouter.patch('/:id/verify', requireAdmin, asyncHandler(async (req, res) => {
  const { verified } = req.body || {};
  if (typeof verified !== 'boolean') {
    return res.status(400).json({ error: 'verified (boolean) is required' });
  }
  const { rows } = await query(
    'UPDATE charities SET verified = $1 WHERE id = $2 RETURNING *',
    [verified, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Charity not found' });
  res.json(rows[0]);
}));
