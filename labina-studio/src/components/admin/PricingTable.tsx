"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePrices } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { toast } from "./Toaster";
import { cn } from "@/lib/cn";

type Row = { id: string; name: string; price: number | null; price_note: string | null; duration_minutes: number; is_active: boolean };

export function PricingTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState(() =>
    rows.map((r) => ({ id: r.id, price: r.price === null ? "" : String(r.price), price_note: r.price_note ?? "", duration: String(r.duration_minutes) })),
  );
  const dirty = values.some((v, i) => v.price !== (rows[i].price === null ? "" : String(rows[i].price)) || v.price_note !== (rows[i].price_note ?? "") || v.duration !== String(rows[i].duration_minutes));
  const update = (i: number, k: "price" | "price_note" | "duration", v: string) => setValues((vals) => vals.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const save = () =>
    start(async () => {
      const res = await savePrices(
        values.map((v) => ({ id: v.id, price: v.price.trim() === "" ? null : Number(v.price), price_note: v.price_note, duration_minutes: Number(v.duration) })),
      );
      toast.result(res);
      if (res.ok) router.refresh();
    });

  return (
    <div className="rounded-3xl bg-paper p-4 shadow-soft md:p-6">
      <div className="hidden grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-line pb-3 text-sm font-medium text-ink-soft md:grid">
        <span>الخدمة</span><span>قبل السعر</span><span>السعر</span><span>المدة (دقيقة)</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r, i) => (
          <li key={r.id} className="grid gap-3 py-4 md:grid-cols-[2fr_1fr_1fr_1fr] md:items-center">
            <span className={cn("font-semibold text-plum", !r.is_active && "opacity-60")}>
              {r.name}
              {!r.is_active && <span className="ms-2 text-xs font-normal text-ink-soft">(مخفية)</span>}
            </span>
            <label className="text-xs text-ink-soft md:text-base">
              <span className="md:sr-only">قبل السعر</span>
              <input className={cn(inputClass, "h-11 py-0")} placeholder="يبدأ من" value={values[i].price_note} maxLength={80} onChange={(e) => update(i, "price_note", e.target.value)} />
            </label>
            <label className="text-xs text-ink-soft md:text-base">
              <span className="md:sr-only">السعر</span>
              <input className={cn(inputClass, "h-11 py-0")} type="number" min={0} step="0.01" inputMode="decimal" placeholder="عند الاستفسار" value={values[i].price} onChange={(e) => update(i, "price", e.target.value)} />
            </label>
            <label className="text-xs text-ink-soft md:text-base">
              <span className="md:sr-only">المدة</span>
              <input className={cn(inputClass, "h-11 py-0")} type="number" min={15} max={600} step={15} value={values[i].duration} onChange={(e) => update(i, "duration", e.target.value)} />
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">السعر الفارغ يظهر للزوار «السعر عند الاستفسار». لا يتغير سعر الحجوزات السابقة.</p>
        <Button onClick={save} loading={pending} disabled={!dirty}>حفظ الأسعار</Button>
      </div>
    </div>
  );
}
