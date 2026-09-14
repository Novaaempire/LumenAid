import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

import { assertEnv } from './env.js';
import { charitiesRouter } from './routes/charities.js';
import { donationsRouter } from './routes/donations.js';
import { pool } from './db.js';

assertEnv();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '100kb' }));

// Generous general limit (this app also relies on Horizon's own rate limits
// downstream); a tighter limit specifically on the admin-gated write routes.
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

app.get('/api/health', (req, res) => {
  res.json({ ok: true, network: process.env.STELLAR_NETWORK || 'testnet' });
});

// Apply the tighter write limiter only to mutating admin routes, before
// the routers get a chance to handle (and respond to) the request.
app.use('/api/charities', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PATCH') return writeLimiter(req, res, next);
  next();
});

app.use('/api/charities', charitiesRouter);
// donation history + asset lookup nest under /api/charities/:id/*
app.use('/api/charities', donationsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Basic error handler so route exceptions return JSON, not an HTML stack trace.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

const server = app.listen(PORT, () => {
  console.log(`LumenAid backend listening on http://localhost:${PORT}`);
  console.log(`Stellar network: ${process.env.STELLAR_NETWORK || 'testnet'} via ${process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org'}`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down…`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  // Force-exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
