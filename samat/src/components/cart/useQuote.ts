'use client';
import { useEffect, useRef, useState } from 'react';
import type { CartLine } from './cart-store';

export interface QuoteLine {
  line: number;
  product_id: string;
  unit_price: number;
  line_total: number;
  quantity: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  coupon: { id: string; code: string | null; title_ar: string; title_en: string; automatic: boolean } | null;
  coupon_discount: number;
  coupon_error: string | null;
  points_redeemed: number;
  points_discount: number;
  loyalty_error: string | null;
  discount_total: number;
  vat_amount: number;
  vat_rate_bps: number;
  prices_include_vat: boolean;
  total: number;
  unavailable: { inventory_id: string; name_ar: string; name_en: string; available: number }[];
  store: { can_order: boolean; reason: string | null };
  can_order: boolean;
}

export function cartToItems(lines: CartLine[]) {
  return lines.map((l) => ({
    product_id: l.productId,
    quantity: l.quantity,
    bread_id: l.selection.breadId,
    ingredients: l.selection.ingredients,
    sauces: l.selection.sauces,
    options: l.selection.options,
    notes: l.selection.notes?.trim() || undefined,
  }));
}

/** Server-side quote for the cart (debounced). The server is the only source of truth for prices. */
export function useQuote(lines: CartLine[], extra: { coupon_code?: string; reward_id?: string; phone?: string } = {}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<{ code: string; line?: number; detail?: Record<string, unknown> } | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const key = JSON.stringify([cartToItems(lines), extra]);

  useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      setError(null);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cartToItems(lines), ...extra }),
        });
        const json = await res.json();
        if (id !== seq.current) return;
        if (!res.ok) {
          setQuote(null);
          setError({ code: json.error ?? 'unknown', line: json.detail?.line, detail: json.detail });
        } else {
          setQuote(json);
          setError(null);
        }
      } catch {
        if (id === seq.current) setError({ code: 'network' });
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { quote, error, loading };
}
