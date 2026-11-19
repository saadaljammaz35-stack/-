'use client';
import { useState } from 'react';
import { CreditCard, Landmark } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { PaymentPanel } from './PaymentPanel';
import { BankTransferPanel, type BankDetails } from './BankTransferPanel';

export function PayTabs({ token, amount, failed, card, bank }: { token: string; amount: number; failed: boolean; card: boolean; bank: BankDetails | null }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'bank' | 'card'>(bank ? 'bank' : 'card');
  if (!card && !bank) return <p role="alert" className="rounded-2xl bg-warn-500/15 p-4 text-sm" data-testid="payment-error">{t.pay.noMethods}</p>;
  return (
    <div className="space-y-5">
      {card && bank && (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-sand-300/60 p-1" role="tablist">
          {(['bank', 'card'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`}
              className={`btn btn-sm ${tab === k ? 'bg-white shadow-soft' : ''}`}>
              {k === 'bank' ? <Landmark className="size-4" /> : <CreditCard className="size-4" />} {k === 'bank' ? t.pay.methodTransfer : t.pay.methodCard}
            </button>
          ))}
        </div>
      )}
      {tab === 'bank' && bank && <BankTransferPanel token={token} amount={amount} bank={bank} />}
      {tab === 'card' && card && <PaymentPanel token={token} failed={failed} />}
    </div>
  );
}
