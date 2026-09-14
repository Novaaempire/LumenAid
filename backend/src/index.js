import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { charitiesRouter } from './routes/charities.js';
import { donationsRouter } from './routes/donations.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, network: process.env.STELLAR_NETWORK || 'testnet' });
});

app.use('/api/charities', charitiesRouter);
// donation history nests under /api/charities/:id/donations
app.use('/api/charities', donationsRouter);

// Basic error handler so route exceptions return JSON, not an HTML stack trace.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`LumenAid backend listening on http://localhost:${PORT}`);
  console.log(`Stellar network: ${process.env.STELLAR_NETWORK || 'testnet'} via ${process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org'}`);
});
