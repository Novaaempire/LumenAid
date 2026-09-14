import { stellarExpertTxUrl } from '../lib/stellar.js';

export default function VerifyLink({ txHash, label = 'Verify on Stellar' }) {
  return (
    <a
      href={stellarExpertTxUrl(txHash)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-lumen-600 hover:underline"
    >
      {label} ↗
    </a>
  );
}
