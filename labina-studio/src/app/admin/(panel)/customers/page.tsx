import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { AdminPage, Card, EmptyState } from "@/components/admin/ui";
import { inputClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import { formatShortDate } from "@/lib/format";
import { normalizeDigits } from "@/lib/validation";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "العملاء" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw } = await searchParams;
  const supabase = (await getServerClient())!;
  const q = normalizeDigits(raw ?? "").trim().slice(0, 60).replace(/[,()%*\\]/g, " ");

  let query = supabase.from("customers").select("id, full_name, phone, email, created_at, bookings(count)").order("created_at", { ascending: false }).limit(200);
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, error } = await query;

  return (
    <AdminPage title="العملاء" description="يُنشأ ملف العميل تلقائياً من أول حجز، ويُعرف برقم جواله.">
      <form className="mb-6 flex gap-2" action="/admin/customers">
        <label className="relative flex-1">
          <span className="sr-only">بحث</span>
          <Search className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
          <input name="q" defaultValue={raw} placeholder="الاسم أو الجوال أو البريد" className={cn(inputClass, "h-11 pr-11")} />
        </label>
        <button className={buttonClass("dark", "md", "h-11")}>بحث</button>
      </form>
      <Card>
        {error && <p className="text-coral-ink">تعذر تحميل العملاء.</p>}
        {!data?.length ? (
          <EmptyState title={q ? "لا نتائج" : "لا يوجد عملاء بعد"} text={q ? undefined : "سيظهر العملاء هنا بعد أول حجز."} />
        ) : (
          <ul className="divide-y divide-line">
            {data.map((c) => {
              const count = (c.bookings as unknown as { count: number }[])?.[0]?.count ?? 0;
              return (
                <li key={c.id}>
                  <Link href={`/admin/customers/${c.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl px-2 py-3 hover:bg-cream">
                    <span className="min-w-40 flex-1 font-semibold text-plum">{c.full_name}</span>
                    <span className="text-sm text-ink-soft" dir="ltr">{c.phone}</span>
                    {c.email && <span className="hidden text-sm text-ink-soft md:inline" dir="ltr">{c.email}</span>}
                    <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-plum">{count} حجز</span>
                    <span className="text-xs text-ink-soft">منذ {formatShortDate(c.created_at.slice(0, 10))}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </AdminPage>
  );
}
