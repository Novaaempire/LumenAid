import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_STELLAR_NETWORK === 'public' ? Networks.PUBLIC : Networks.TESTNET;

const HORIZON_URL = import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org';

export const horizonServer = new Horizon.Server(HORIZON_URL, { allowHttp: HORIZON_URL.startsWith('http://') });

/**
 * Builds an unsigned XLM payment transaction XDR. The caller is
 * responsible for getting it signed by the connected wallet (Freighter) --
 * this app never holds or touches a private key.
 */
export async function buildPaymentTransaction({ fromAddress, toAddress, amount, memo }) {
  const sourceAccount = await horizonServer.loadAccount(fromAddress);

  const builder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({
      destination: toAddress,
      asset: Asset.native(),
      amount: String(amount),
    })
  );

  if (memo) builder.addMemo(Memo.text(memo.slice(0, 28)));

  return builder.setTimeout(180).build().toXDR();
}

/**
 * Submits an already-signed transaction XDR to Horizon.
 */
export async function submitSignedTransaction(signedXdr) {
  const tx = new Transaction(signedXdr, NETWORK_PASSPHRASE);
  return horizonServer.submitTransaction(tx);
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
