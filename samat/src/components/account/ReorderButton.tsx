'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { cart, type CartLine } from '@/components/cart/cart-store';

export function ReorderButton({ token, orderId }: { token?: string; orderId?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button type="button" className="btn btn-sm btn-primary" disabled={busy} data-testid="reorder"
        onClick={async () => {
          setBusy(true);
          const res = await fetch('/api/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(token ? { token } : { order_id: orderId }) });
          const json = (await res.json()) as { lines?: Omit<CartLine, 'key' | 'addedAt'>[]; changed?: boolean };
          setBusy(false);
          if (!res.ok || !json.lines) return setMsg(t.common.error);
          json.lines.forEach((l) => cart.add(l));
          sessionStorage.setItem('samat_reorder_msg', json.changed ? t.account.reorderChanged : t.account.reorderDone);
          router.push('/cart');
        }}>
        <RotateCcw className="size-4" /> {t.account.reorder}
      </button>
      {msg && <span className="mt-1 text-xs text-danger-500">{msg}</span>}
    </span>
  );
}
