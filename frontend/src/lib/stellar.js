import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  NotFoundError,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_STELLAR_NETWORK === 'public' ? Networks.PUBLIC : Networks.TESTNET;

const HORIZON_URL = import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org';

export const horizonServer = new Horizon.Server(HORIZON_URL, { allowHttp: HORIZON_URL.startsWith('http://') });

// Mirrors backend/src/horizon.js's allowlist. Kept in sync manually since
// each side needs its own SDK Asset instance.
export const KNOWN_TESTNET_ASSETS = {
  // Circle's official testnet USDC issuer:
  // https://developers.circle.com/stablecoins/docs/usdc-on-testing-networks
  // https://stellar.expert/explorer/testnet/asset/USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
  USDC: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
};

// Stellar's base reserve: every account must hold a minimum XLM balance,
// and creating a brand-new account requires funding it with at least this
// much up front.
export const MIN_ACCOUNT_RESERVE_XLM = 1;

export function toStellarAsset({ code, issuer }) {
  if (!code || code === 'XLM') return Asset.native();
  return new Asset(code, issuer);
}

/**
 * True if the given account exists on the ledger yet (has received its
 * first XLM). A never-funded account is a normal state, not an error.
 */
export async function accountExists(address) {
  try {
    await horizonServer.loadAccount(address);
    return true;
  } catch (err) {
    if (err instanceof NotFoundError) return false;
    throw err;
  }
}

/**
 * True if `address` already holds a trustline for `asset` (native is
 * always trusted implicitly). Used to decide whether a donor needs to
 * establish a trustline before they can send a non-native asset like USDC.
 */
export async function hasTrustline(address, asset) {
  const stellarAsset = toStellarAsset(asset);
  if (stellarAsset.isNative()) return true;
  try {
    const account = await horizonServer.loadAccount(address);
    return account.balances.some(
      (b) => b.asset_code === stellarAsset.getCode() && b.asset_issuer === stellarAsset.getIssuer()
    );
  } catch (err) {
    if (err instanceof NotFoundError) return false;
    throw err;
  }
}

/**
 * Builds an unsigned payment transaction XDR. Handles the case where the
 * destination account doesn't exist on the ledger yet -- Stellar requires a
 * `createAccount` operation (funded with XLM) instead of `payment` for a
 * brand-new account. Non-native assets can't fund account creation, so
 * donating USDC to a not-yet-existing wallet is rejected with a clear
 * message rather than a cryptic Horizon error.
 *
 * The caller is responsible for getting the returned XDR signed by the
 * connected wallet (Freighter) -- this app never holds or touches a
 * private key.
 */
export async function buildPaymentTransaction({ fromAddress, toAddress, amount, asset = { code: 'XLM' }, memo }) {
  const sourceAccount = await horizonServer.loadAccount(fromAddress);
  const stellarAsset = toStellarAsset(asset);
  const destinationExists = await accountExists(toAddress);

  if (!destinationExists && !stellarAsset.isNative()) {
    throw new Error(
      "This charity's wallet hasn't been created on the ledger yet, so it can't receive USDC directly. Someone needs to send it XLM first."
    );
  }

  const builder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (!destinationExists) {
    if (Number(amount) < MIN_ACCOUNT_RESERVE_XLM) {
      throw new Error(
        `This is the first donation to a brand-new wallet, so it needs at least ${MIN_ACCOUNT_RESERVE_XLM} XLM to cover Stellar's minimum account reserve.`
      );
    }
    builder.addOperation(Operation.createAccount({ destination: toAddress, startingBalance: String(amount) }));
  } else {
    builder.addOperation(
      Operation.payment({ destination: toAddress, asset: stellarAsset, amount: String(amount) })
    );
  }

  if (memo) builder.addMemo(Memo.text(memo.slice(0, 28)));

  return builder.setTimeout(180).build().toXDR();
}

/**
 * Builds an unsigned changeTrust transaction so a donor can establish a
 * trustline for a non-native asset (e.g. USDC) before donating it. Also
 * signed client-side, never by the backend.
 */
export async function buildTrustlineTransaction({ fromAddress, asset }) {
  const sourceAccount = await horizonServer.loadAccount(fromAddress);
  const builder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(Operation.changeTrust({ asset: toStellarAsset(asset) }));

  return builder.setTimeout(180).build().toXDR();
}

/**
 * Submits an already-signed transaction XDR to Horizon.
 */
export async function submitSignedTransaction(signedXdr) {
  const tx = new Transaction(signedXdr, NETWORK_PASSPHRASE);
  return horizonServer.submitTransaction(tx);
}

const RESULT_CODE_MESSAGES = {
  op_underfunded: "Your wallet doesn't have enough XLM to cover this payment plus the network fee.",
  op_low_reserve:
    'Sending this would drop your wallet below the minimum XLM reserve Stellar requires accounts to hold.',
  op_no_destination: "The destination account doesn't exist on the ledger yet.",
  op_no_trust: "The destination hasn't established a trustline for this asset yet, so it can't receive it.",
  op_src_no_trust: "Your wallet hasn't established a trustline for this asset yet.",
  op_not_authorized: 'The asset issuer has not authorized this account to hold or receive this asset.',
  tx_insufficient_balance: "Your wallet doesn't have enough XLM to cover this payment plus the network fee.",
  tx_bad_seq: 'Your wallet had a stale transaction queued. Please try again.',
  tx_too_late: 'The transaction expired before it was submitted. Please try again.',
};

/**
 * Turns a Horizon submission failure into a message a donor can act on,
 * instead of a raw XDR result-code dump.
 */
export function decodeHorizonError(err) {
  const codes = err?.response?.data?.extras?.result_codes;
  if (!codes) return err?.message || 'Something went wrong submitting the transaction.';

  const opCode = codes.operations?.[0];
  const txCode = codes.transaction;
  const friendly = RESULT_CODE_MESSAGES[opCode] || RESULT_CODE_MESSAGES[txCode];
  if (friendly) return friendly;

  return `Transaction failed (${[txCode, opCode].filter(Boolean).join(' / ')}).`;
}

/**
 * Fetches the current XLM/USD price for display purposes only.
 * Never used for settlement -- the actual donation always settles in the
 * native asset amount the donor signed.
 */
export async function fetchXlmUsdPrice() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd'
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.stellar?.usd ?? null;
  } catch {
    return null;
  }
}

export function stellarExpertTxUrl(txHash) {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}

export function stellarExpertAccountUrl(address) {
  return `https://stellar.expert/explorer/testnet/account/${address}`;
}

export async function fundWithFriendbot(address) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error('Friendbot funding failed (address may already be funded)');
  return res.json();
}
