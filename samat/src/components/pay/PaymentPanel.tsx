'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FlaskConical, ShieldCheck, XCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';

interface InitResponse {
  provider: 'moyasar' | 'simulator';
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  paymentRowId: string;
  publishableKey: string | null;
  callbackUrl: string;
  methods: ('creditcard' | 'applepay' | 'stcpay')[];
  networks: string[];
  manual: boolean;
  applePayLabel: string;
  validateMerchantUrl: string;
  error?: string;
}

declare global {
  interface Window { Moyasar?: { init: (cfg: Record<string, unknown>) => void } }
}

const MOYASAR_VERSION = '1.16.0';

function loadMoyasar(): Promise<void> {
  if (window.Moyasar) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `https://cdn.moyasar.com/mpf/${MOYASAR_VERSION}/moyasar.css`;
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = `https://cdn.moyasar.com/mpf/${MOYASAR_VERSION}/moyasar.js`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('moyasar script failed'));
    document.head.appendChild(s);
  });
}

export function PaymentPanel({ token, failed }: { token: string; failed: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [init, setInit] = useState<InitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [simFailed, setSimFailed] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    (async () => {
      const res = await fetch('/api/payments/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const json = (await res.json()) as InitResponse;
      if (!res.ok) {
        if (json.error === 'invalid_transition') return router.replace(`/t/${token}`);
        setError(json.error === 'payment_unavailable' ? t.pay.notConfigured : t.errors[json.error as keyof typeof t.errors] ?? t.common.error);
        return;
      }
      setInit(json);
      if (json.provider === 'moyasar') {
        if (!json.methods.length) return setError(t.pay.noMethods);
        try {
          await loadMoyasar();
          window.Moyasar!.init({
            element: '.mysr-form',
            amount: json.amount,
            currency: json.currency,
            description: json.description,
            publishable_api_key: json.publishableKey,
            callback_url: json.callbackUrl,
            language: locale,
            methods: json.methods,
            supported_networks: json.networks,
            metadata: json.metadata,
            fixed_width: false,
            credit_card: { manual: json.manual },
            apple_pay: { country: 'SA', label: json.applePayLabel, validate_merchant_url: json.validateMerchantUrl, manual: json.manual },
            // Link the payment to the order before any 3-D Secure redirect, so the webhook and the
            // callback page can both verify it even if the customer closes the tab.
            on_completed: (payment: { id: string }) =>
              fetch('/api/payments/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, payment_id: payment.id }) }).catch(() => undefined),
          });
        } catch {
          setError(t.pay.notConfigured);
        }
      }
    })();
  }, [token, locale, router, t]);

  const simulate = async (outcome: 'paid' | 'authorized' | 'failed') => {
    if (!init) return;
    setBusy(true);
    const res = await fetch('/api/payments/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, payment_row_id: init.paymentRowId, outcome }) });
    const json = await res.json();
    if (outcome === 'failed' || !res.ok) {
      setSimFailed(true);
      setBusy(false);
      // a new payment attempt needs a fresh payment row
      const again = await fetch('/api/payments/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      if (again.ok) setInit(await again.json());
      return;
    }
    router.push(`/t/${json.token ?? token}`);
  };

  return (
    <div className="space-y-4">
      {(failed || simFailed) && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl bg-danger-500/10 p-4 text-danger-500" data-testid="payment-failed">
          <XCircle className="mt-0.5 size-5 shrink-0" />
          <div><p className="font-bold">{t.pay.failed}</p><p className="text-sm">{t.pay.failedText}</p></div>
        </div>
      )}
      {error && <p role="alert" className="rounded-2xl bg-warn-500/15 p-4 text-sm" data-testid="payment-error">{error}</p>}
      {!init && !error && <div className="h-48 animate-pulse rounded-3xl bg-sand-300/50" aria-label={t.common.loading} />}
      {init?.provider === 'moyasar' && <div className="mysr-form min-h-48" dir={locale === 'ar' ? 'rtl' : 'ltr'} />}
      {init?.provider === 'simulator' && (
        <div className="rounded-3xl border-2 border-dashed border-warn-500/60 bg-warn-500/10 p-5" data-testid="simulator">
          <p className="flex items-center gap-2 font-bold"><FlaskConical className="size-5" /> {t.pay.simulatorTitle}</p>
          <p className="mt-1 text-sm text-espresso-600">{t.pay.simulatorText}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => simulate('paid')} data-testid="sim-paid"><CheckCircle2 className="size-4" /> {t.pay.simulatePaid}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => simulate('authorized')} data-testid="sim-authorized">{t.pay.simulateAuthorized}</button>
            <button type="button" className="btn btn-ghost text-danger-500" disabled={busy} onClick={() => simulate('failed')} data-testid="sim-failed">{t.pay.simulateFailed}</button>
          </div>
        </div>
      )}
      <p className="flex items-center gap-2 text-xs text-espresso-500"><ShieldCheck className="size-4 shrink-0" /> {t.pay.secure}</p>
    </div>
  );
}
