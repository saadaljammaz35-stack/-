/**
 * Admin overview.
 *
 * The layout is opinionated about priority: **ledger integrity sits at the top,
 * alone, before any business metric.** Transaction volume is interesting;
 * reconciliation drift means the books may be wrong, and that is the one
 * condition a financial platform cannot sit on. Putting it below a revenue
 * chart would be putting it where nobody looks.
 */

import { Money } from '@nabd/shared';

import { LedgerIntegrityBanner } from '../components/LedgerIntegrityBanner.js';
import { StatTile } from '../components/StatTile.js';
import { QueueCard } from '../components/QueueCard.js';

export interface OverviewData {
  integrity: {
    driftingAccounts: number;
    trialBalanceImbalanceMinor: string;
    checkedAt: string;
  };
  totals: {
    customerLiabilityMinor: string;
    settlementAssetMinor: string;
    currency: 'SAR';
  };
  today: {
    transferCount: number;
    transferVolumeMinor: string;
    failedCount: number;
  };
  queues: {
    kycPending: number;
    fraudOpen: number;
    complianceOpen: number;
    supportOpen: number;
    webhookDeadLetter: number;
  };
}

async function loadOverview(): Promise<OverviewData> {
  // Replaced by a call to /v1/admin/overview once the API client is wired.
  return {
    integrity: {
      driftingAccounts: 0,
      trialBalanceImbalanceMinor: '0',
      checkedAt: new Date().toISOString(),
    },
    totals: {
      customerLiabilityMinor: '0',
      settlementAssetMinor: '0',
      currency: 'SAR',
    },
    today: { transferCount: 0, transferVolumeMinor: '0', failedCount: 0 },
    queues: {
      kycPending: 0,
      fraudOpen: 0,
      complianceOpen: 0,
      supportOpen: 0,
      webhookDeadLetter: 0,
    },
  };
}

export default async function OverviewPage(): Promise<React.JSX.Element> {
  const data = await loadOverview();
  const currency = data.totals.currency;

  const liability = Money.fromMinor(data.totals.customerLiabilityMinor, currency);
  const asset = Money.fromMinor(data.totals.settlementAssetMinor, currency);
  // Safeguarding, made visible: what NABD owes customers must be matched by
  // what it holds on their behalf. A non-zero gap is an immediate escalation.
  const safeguardingGap = asset.subtract(liability);

  return (
    <main className="page">
      <h1 className="page-title">Overview</h1>

      <LedgerIntegrityBanner
        driftingAccounts={data.integrity.driftingAccounts}
        trialBalanceImbalanceMinor={data.integrity.trialBalanceImbalanceMinor}
        checkedAt={data.integrity.checkedAt}
      />

      <section aria-label="Safeguarding" className="tile-grid">
        <StatTile
          label="Owed to customers"
          value={liability.format('en')}
          hint="Total customer liability"
        />
        <StatTile
          label="Held at partner"
          value={asset.format('en')}
          hint="Settlement asset"
        />
        <StatTile
          label="Safeguarding gap"
          value={safeguardingGap.format('en')}
          hint="Must be zero"
          tone={safeguardingGap.isZero ? 'ok' : 'critical'}
        />
      </section>

      <section aria-label="Today" className="tile-grid">
        <StatTile label="Transfers today" value={String(data.today.transferCount)} />
        <StatTile
          label="Volume today"
          value={Money.fromMinor(data.today.transferVolumeMinor, currency).format('en')}
        />
        <StatTile
          label="Failed today"
          value={String(data.today.failedCount)}
          tone={data.today.failedCount > 0 ? 'warning' : 'ok'}
        />
      </section>

      <section aria-label="Work queues">
        <h2 className="section-title">Queues</h2>
        <div className="tile-grid">
          <QueueCard
            label="KYC pending review"
            count={data.queues.kycPending}
            href="/kyc"
          />
          <QueueCard
            label="Fraud cases open"
            count={data.queues.fraudOpen}
            href="/fraud"
            tone={data.queues.fraudOpen > 0 ? 'warning' : 'ok'}
          />
          <QueueCard
            label="Compliance cases open"
            count={data.queues.complianceOpen}
            href="/compliance"
          />
          <QueueCard
            label="Support tickets"
            count={data.queues.supportOpen}
            href="/support"
          />
          <QueueCard
            label="Webhook dead letters"
            count={data.queues.webhookDeadLetter}
            href="/reconciliation"
            // Anything in the dead-letter queue means an event from a provider
            // was never processed — money may have moved without us recording it.
            tone={data.queues.webhookDeadLetter > 0 ? 'critical' : 'ok'}
          />
        </div>
      </section>
    </main>
  );
}
