'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChefHat, PackageCheck, RotateCcw, Sparkles, X } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { useI18n } from '@/lib/i18n/client';

export function OrderActions({ id, status, paymentStatus, perms, compact = false, isTransfer = false }: {
  id: string; status: string; paymentStatus: string; perms: string[]; compact?: boolean; isTransfer?: boolean;
}) {
  const { a } = useAdmin();
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<'reject' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferOk, setTransferOk] = useState(false);
  const [arrived, setArrived] = useState(false);
  const verifying = paymentStatus === 'pending_verification';
  const can = (p: string) => perms.includes(p);

  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action); setError(null);
    const res = await fetch(`/api/admin/orders/${id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(t.errors[json.error as keyof typeof t.errors] ?? json.detail?.message ?? a.common.error);
    setMode(null);
    router.refresh();
  };
  const size = compact ? 'btn-sm' : '';

  return (
    <div className="space-y-2" data-testid="order-actions">
      <div className="flex flex-wrap gap-2">
        {status === 'awaiting_approval' && can('orders.manage') && compact && verifying && (
          <a href={`/admin/orders/${id}`} className="btn btn-sm btn-accent" data-testid="review-receipt">{a.orders.receipt} →</a>
        )}
        {status === 'awaiting_approval' && can('orders.manage') && !(compact && verifying) && (
          <>
            <button type="button" className={`btn ${size} btn-primary`} disabled={!!busy || (verifying && !transferOk)} onClick={() => run('accept', { transfer_received: verifying ? transferOk : undefined })} data-testid="accept"><Check className="size-4" /> {busy === 'accept' ? '…' : a.orders.accept}</button>
            <button type="button" className={`btn ${size} btn-ghost text-danger-500`} disabled={!!busy} onClick={() => setMode('reject')} data-testid="reject"><X className="size-4" /> {a.orders.reject}</button>
          </>
        )}
        {status === 'accepted' && can('kitchen.update') && <button type="button" className={`btn ${size} btn-accent`} disabled={!!busy} onClick={() => run('preparing')}><ChefHat className="size-4" /> {a.orders.startPrep}</button>}
        {['accepted', 'preparing'].includes(status) && can('kitchen.update') && <button type="button" className={`btn ${size} btn-primary`} disabled={!!busy} onClick={() => run('ready')}><Sparkles className="size-4" /> {a.orders.markReady}</button>}
        {status === 'ready' && (can('kitchen.update') || can('pickup.verify')) && <button type="button" className={`btn ${size} btn-primary`} disabled={!!busy} onClick={() => run('delivered')}><PackageCheck className="size-4" /> {a.orders.markDelivered}</button>}
        {!compact && ['accepted', 'preparing', 'ready'].includes(status) && can('orders.manage') && (
          <button type="button" className="btn btn-ghost text-danger-500" onClick={() => setMode('cancel')}>{a.orders.cancel}</button>
        )}
        {!compact && paymentStatus === 'refund_pending' && can('orders.manage') && !isTransfer && (
          <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => run('retry_refund')}><RotateCcw className="size-4" /> {a.orders.retryRefund}</button>
        )}
        {!compact && paymentStatus === 'refund_pending' && can('orders.manage') && isTransfer && (
          <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => run('manual_refund', { reason: 'Manual bank refund' })} data-testid="manual-refund"><RotateCcw className="size-4" /> {a.orders.manualRefund}</button>
        )}
      </div>
      {!compact && verifying && status === 'awaiting_approval' && can('orders.manage') && (
        <label className="flex items-start gap-2 rounded-2xl bg-warn-500/10 p-3 text-sm font-semibold">
          <input type="checkbox" className="mt-1 size-4" checked={transferOk} onChange={(e) => setTransferOk(e.target.checked)} data-testid="confirm-transfer" /> {a.orders.confirmTransfer}
        </label>
      )}
      {!compact && paymentStatus === 'refund_pending' && isTransfer && <p className="text-xs text-espresso-500">{a.orders.manualRefundHint}</p>}
      {status === 'awaiting_approval' && paymentStatus === 'authorized' && !compact && <p className="text-xs text-espresso-500">{a.orders.capture}</p>}
      {mode && (
        <div className="paper space-y-2 rounded-2xl p-3">
          <label className="label" htmlFor={`r-${id}`}>{mode === 'reject' ? a.orders.rejectReason : a.orders.cancelReason}</label>
          <textarea id={`r-${id}`} className="field min-h-16" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="reject-reason" />
          {mode === 'cancel' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> {a.orders.restock}</label>}
          {mode === 'reject' && verifying && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={arrived} onChange={(e) => setArrived(e.target.checked)} data-testid="transfer-arrived" /> {a.orders.transferArrived}</label>}
          {!verifying && !isTransfer && <p className="text-xs text-espresso-500">{a.orders.refundWillStart}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm btn-danger" disabled={!!busy} onClick={() => run(mode, { reason, restock, transfer_received: verifying ? arrived : undefined })} data-testid="confirm-reject">{a.orders.rejectConfirm}</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMode(null)}>{a.common.cancel}</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger-500" data-testid="action-error">{error}</p>}
    </div>
  );
}
