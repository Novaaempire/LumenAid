// Fail fast on startup if required configuration is missing, rather than
// limping along and throwing confusing errors deep inside a request.
import 'dotenv/config';

const REQUIRED = ['DATABASE_URL', 'ADMIN_KEY'];

export function assertEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`❌ Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('   Copy backend/.env.example to backend/.env and fill them in.');
    process.exit(1);
  }

  if (process.env.STELLAR_NETWORK === 'public') {
    console.error('❌ STELLAR_NETWORK=public is not allowed. This MVP is testnet-only.');
    process.exit(1);
  }

  if (process.env.ADMIN_KEY === 'change-me-local-dev-only') {
    console.warn('⚠️  ADMIN_KEY is still the sample value from .env.example — fine for local dev, change it before sharing this deployment with anyone.');
  }
}
