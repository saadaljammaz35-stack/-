'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, FileUp, Landmark, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { formatMoney } from '@/lib/money';

export interface BankDetails {
  bank_name: string | null;
  bank_account_name: string | null;
  bank_iban: string;
  bank_account_number: string | null;
  bank_swift: string | null;
  bank_qr_url: string | null;
}

function CopyRow({ label, value, display, testId }: { label: string; value: string; display?: string; testId?: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-cream-100/80 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-espresso-500">{label}</p>
        <p className="num truncate font-semibold" dir="ltr" data-testid={testId}>{display ?? value}</p>
      </div>
      <button type="button" className="btn btn-sm btn-ghost shrink-0"
        onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* clipboard blocked */ } }}>
        {done ? <Check className="size-4 text-ok-500" /> : <Copy className="size-4" />} {done ? t.pay.copied : t.pay.copy}
      </button>
    </div>
  );
}

export function BankTransferPanel({ token, amount, bank }: { token: string; amount: number; bank: BankDetails }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iban = bank.bank_iban.replace(/(.{4})/g, '$1 ').trim();

  const pick = (f: File | null) => {
    setError(null);
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return setError(t.errors.receipt_too_large);
    setFile(f);
    setPreview(f.type.startsWith('image/') && !/hei[cf]/i.test(f.type) ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set('token', token);
    fd.set('receipt', file);
    try {
      const res = await fetch('/api/payments/bank-transfer', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { setBusy(false); return setError(t.errors[json.error as keyof typeof t.errors] ?? t.common.error); }
      router.push(`/t/${token}`);
    } catch {
      setBusy(false);
      setError(t.common.offline);
    }
  };

  return (
    <div className="space-y-4" data-testid="bank-transfer">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-espresso-800 text-cream-100"><Landmark className="size-5" /></span>
        <div>
          <p className="font-bold">{t.pay.bankTitle}</p>
          <p className="text-sm text-espresso-600">{t.pay.bankText}</p>
        </div>
      </div>

      <div className="rounded-3xl bg-espresso-900 p-4 text-cream-100">
        <p className="text-xs text-cream-200/70">{t.pay.amountExact}</p>
        <p className="num text-3xl font-bold" data-testid="transfer-amount">{formatMoney(amount, locale)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          {bank.bank_account_name && <CopyRow label={t.pay.accountName} value={bank.bank_account_name} />}
          <CopyRow label={t.pay.iban} value={bank.bank_iban} display={iban} testId="iban" />
          {bank.bank_account_number && <CopyRow label={t.pay.accountNumber} value={bank.bank_account_number} />}
          <div className="flex gap-2 text-xs text-espresso-600">
            {bank.bank_name && <span className="chip bg-sand-300/70">{t.pay.bank}: {bank.bank_name}</span>}
            {bank.bank_swift && <span className="chip bg-sand-300/70" dir="ltr">SWIFT {bank.bank_swift}</span>}
          </div>
        </div>
        {bank.bank_qr_url && (
          <figure className="mx-auto w-40 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bank.bank_qr_url} alt={t.pay.scanQr} className="w-40 rounded-2xl bg-white p-2 shadow-soft" />
            <figcaption className="mt-1 text-xs text-espresso-500">{t.pay.scanQr}</figcaption>
          </figure>
        )}
      </div>

      <div className="rounded-3xl border-2 border-dashed border-sand-400 p-4">
        <p className="label">{t.pay.uploadReceipt}</p>
        <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} data-testid="receipt-input" />
        <button type="button" className="btn btn-ghost w-full" onClick={() => input.current?.click()}>
          <FileUp className="size-4" /> {file ? file.name : t.pay.chooseFile}
        </button>
        <p className="mt-1 text-xs text-espresso-500">{t.pay.fileHint}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="" className="mx-auto mt-3 max-h-56 rounded-2xl shadow-soft" />}
      </div>
      {error && <p role="alert" className="rounded-xl bg-danger-500/10 p-3 text-sm text-danger-500" data-testid="receipt-error">{error}</p>}
      <button type="button" className="btn btn-lg btn-accent w-full" disabled={!file || busy} onClick={submit} data-testid="send-receipt">
        {busy ? <><Loader2 className="size-4 animate-spin" /> {t.pay.uploading}</> : t.pay.sendReceipt}
      </button>
      <p className="text-xs text-espresso-500">{t.pay.transferNote}</p>
    </div>
  );
}
