import { Horizon } from '@stellar/stellar-sdk';
import 'dotenv/config';

const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';

export const horizonServer = new Horizon.Server(HORIZON_URL);

/**
 * Fetch incoming native-asset (and any) payments for a wallet address directly
 * from Horizon. This is the source of truth -- the Postgres cache only exists
 * to avoid re-querying Horizon on every page view.
 */
export async function fetchIncomingPayments(walletAddress, { limit = 50 } = {}) {
  const page = await horizonServer
    .payments()
    .forAccount(walletAddress)
    .order('desc')
    .limit(limit)
    .call();

  return page.records
    .filter((op) => op.type === 'payment' && op.to === walletAddress)
    .map((op) => ({
      txHash: op.transaction_hash,
      fromAddress: op.from,
      amount: op.amount,
      assetCode: op.asset_type === 'native' ? 'XLM' : op.asset_code,
      createdAt: op.created_at,
    }));
}
