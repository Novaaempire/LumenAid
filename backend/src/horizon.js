import { Horizon, NotFoundError } from '@stellar/stellar-sdk';
import 'dotenv/config';

const HORIZON_URL = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';

export const horizonServer = new Horizon.Server(HORIZON_URL);

// Known testnet asset issuers we recognize for donation purposes. Any other
// non-native asset a charity happens to hold a trustline for is ignored --
// this is a small allowlist, not an open invitation for arbitrary tokens.
export const KNOWN_TESTNET_ASSETS = {
  // Circle's official testnet USDC issuer:
  // https://developers.circle.com/stablecoins/docs/usdc-on-testing-networks
  // https://stellar.expert/explorer/testnet/asset/USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
  USDC: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
};

/**
 * Fetch incoming payments for a wallet address directly from Horizon. This
 * is the source of truth -- the Postgres cache only exists to avoid
 * re-querying Horizon on every page view.
 *
 * Returns { payments, accountExists }. An account that has never been
 * created on the ledger (never received its first XLM) is a normal state
 * for a freshly-onboarded charity, not an error -- callers should show
 * "no donations yet", not a failure.
 */
export async function fetchIncomingPayments(walletAddress, { limit = 50 } = {}) {
  try {
    const page = await horizonServer
      .payments()
      .forAccount(walletAddress)
      .order('desc')
      .limit(limit)
      .call();

    const payments = page.records
      .filter(
        (op) =>
          (op.type === 'payment' && op.to === walletAddress) ||
          // A donor's *first* payment to a not-yet-existing wallet is a
          // `create_account` operation, not a `payment` -- Stellar requires
          // it to establish the account. Horizon reports it in the same
          // /payments collection with different field names; without this,
          // a charity's very first donation would silently never appear.
          (op.type === 'create_account' && op.account === walletAddress)
      )
      .map((op) =>
        op.type === 'create_account'
          ? {
              txHash: op.transaction_hash,
              fromAddress: op.funder,
              amount: op.starting_balance,
              assetCode: 'XLM',
              createdAt: op.created_at,
            }
          : {
              txHash: op.transaction_hash,
              fromAddress: op.from,
              amount: op.amount,
              assetCode: op.asset_type === 'native' ? 'XLM' : op.asset_code,
              createdAt: op.created_at,
            }
      );

    return { payments, accountExists: true };
  } catch (err) {
    if (err instanceof NotFoundError) {
      return { payments: [], accountExists: false };
    }
    throw err;
  }
}

/**
 * Fetch which assets a wallet currently holds a trustline for (native is
 * always implicit). Used to decide which donation assets to offer for a
 * charity -- e.g. only show "Donate USDC" if the charity's wallet actually
 * has a USDC trustline, derived live from Horizon rather than a manual flag.
 */
export async function fetchAccountAssets(walletAddress) {
  try {
    const account = await horizonServer.loadAccount(walletAddress);
    const assets = account.balances.map((b) => {
      if (b.asset_type === 'native') return { code: 'XLM', issuer: null, balance: b.balance };
      return { code: b.asset_code, issuer: b.asset_issuer, balance: b.balance };
    });
    return { exists: true, assets };
  } catch (err) {
    if (err instanceof NotFoundError) {
      return { exists: false, assets: [] };
    }
    throw err;
  }
}
