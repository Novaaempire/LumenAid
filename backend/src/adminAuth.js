// Deliberately minimal for the MVP: a shared secret header, nothing more.
// This gates the "add/verify charity" endpoints only -- it never touches
// wallets, keys, or funds. Swap for real auth before this goes anywhere
// near production.
import { timingSafeEqual } from 'node:crypto';

function safeEqual(a, b) {
  const bufA = Buffer.from(a || '', 'utf8');
  const bufB = Buffer.from(b || '', 'utf8');
  // timingSafeEqual throws on length mismatch, so pad rather than short-circuit
  // (short-circuiting on length would leak length via timing).
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // burn constant time, then fail
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function requireAdmin(req, res, next) {
  const key = req.header('x-admin-key');
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: ADMIN_KEY not set' });
  }
  if (!key || !safeEqual(key, process.env.ADMIN_KEY)) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid x-admin-key header' });
  }
  next();
}
