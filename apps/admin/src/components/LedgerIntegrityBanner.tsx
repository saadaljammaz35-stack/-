/**
 * Ledger integrity, shown before anything else.
 *
 * Any non-zero drift or trial-balance imbalance is a SEV1 by definition,
 * regardless of the amount — a one-halala discrepancy and a one-million-riyal
 * discrepancy have the same cause: the books are wrong. So this renders as an
 * unmissable red banner rather than a number in a table, and it says what to do
 * rather than only what is wrong.
 */

export interface LedgerIntegrityBannerProps {
  driftingAccounts: number;
  trialBalanceImbalanceMinor: string;
  checkedAt: string;
}

export function LedgerIntegrityBanner(
  props: LedgerIntegrityBannerProps,
): React.JSX.Element {
  const imbalance = BigInt(props.trialBalanceImbalanceMinor);
  const healthy = props.driftingAccounts === 0 && imbalance === 0n;

  if (healthy) {
    return (
      <div className="banner banner--ok" role="status">
        <span className="banner__mark" aria-hidden="true">
          ✓
        </span>
        <div>
          <strong>Ledger integrity: OK</strong>
          <p className="banner__detail">
            Balances match the entries they summarise; debits equal credits in every
            currency. Last checked {new Date(props.checkedAt).toLocaleString('en-GB')}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="banner banner--critical" role="alert">
      <span className="banner__mark" aria-hidden="true">
        !
      </span>
      <div>
        <strong>LEDGER INTEGRITY VIOLATION — escalate now</strong>
        <p className="banner__detail">
          {props.driftingAccounts > 0 && (
            <>
              {props.driftingAccounts} account(s) whose cached balance no longer matches
              their entries.{' '}
            </>
          )}
          {imbalance !== 0n && (
            <>Trial balance is out by {imbalance.toString()} minor units. </>
          )}
          Stop writes and follow the funds playbook in the incident response plan. Do not
          post correcting entries before the scope is established.
        </p>
      </div>
    </div>
  );
}
