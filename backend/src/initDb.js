// One-off script: creates tables from schema.sql if they don't exist yet.
// Run with `npm run db:init`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import 'dotenv/config';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('✅ Database schema is up to date.');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Failed to initialize database:', err.message);
  process.exit(1);
});
