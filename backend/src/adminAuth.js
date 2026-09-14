// Deliberately minimal for the MVP: a shared secret header, nothing more.
// This gates the "add/verify charity" endpoints only -- it never touches
// wallets, keys, or funds. Swap for real auth before this goes anywhere
// near production.
export function requireAdmin(req, res, next) {
  const key = req.header('x-admin-key');
  if (!process.env.ADMIN_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: ADMIN_KEY not set' });
  }
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid x-admin-key header' });
  }
  next();
}
