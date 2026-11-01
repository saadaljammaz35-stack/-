import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { AdminPage, Card, EmptyState, StatusBadge } from "@/components/admin/ui";
import { QuickStatus } from "@/components/admin/QuickStatus";
import { inputClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import { STATUS_META } from "@/lib/constants";
import { formatShortDate, formatTime } from "@/lib/format";
import { normalizeDigits } from "@/lib/validation";
import { cn } from "@/lib/cn";
import type { BookingStatus } from "@/lib/types";

export const metadata: Metadata = { title: "الحجوزات" };

const PAGE_SIZE = 20;
const STATUSES: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled"];

type SP = { status?: string; q?: string; from?: string; to?: string; page?: string; sort?: string };

function qs(base: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  const merged = { ...base, ...patch };
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/admin/bookings?${s}` : "/admin/bookings";
}

export default async function BookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const supabase = (await getServerClient())!;
  const status = STATUSES.includes(sp.status as BookingStatus) ? (sp.status as BookingStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = normalizeDigits(sp.q ?? "").trim().slice(0, 60);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to : undefined;
  const sortByCreated = sp.sort === "created";

  let query = supabase
    .from("bookings")
    .select("id, reference, customer_name, customer_phone, service_name, booking_date, start_time, end_time, children_count, status, created_at", { count: "exact" });
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("booking_date", from);
  if (to) query = query.lte("booking_date", to);
  if (q) {
    const safe = q.replace(/[,()%*\\]/g, " ");
    query = query.or(`customer_name.ilike.%${safe}%,customer_phone.ilike.%${safe}%,reference.ilike.%${safe.toUpperCase()}%`);
  }
  query = sortByCreated
    ? query.order("created_at", { ascending: false })
    : query.order("booking_date", { ascending: false }).order("start_time", { ascending: false });
  const { data, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const counts = await Promise.all(
    STATUSES.map((s) => supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", s)),
  );
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <AdminPage title="الحجوزات" description="كل الطلبات مع حالاتها. اضغط على أي حجز لعرض تفاصيله وسجلّه.">
      <div className="no-scrollbar -mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="flex w-max gap-2">
          <Link href={qs({ ...sp, page: undefined }, { status: undefined })} className={cn("rounded-2xl px-4 py-2.5 text-sm font-semibold", !status ? "bg-plum text-cream" : "bg-paper text-ink-soft")}>
            الكل
          </Link>
          {STATUSES.map((s, i) => (
            <Link
              key={s}
              href={qs({ ...sp, page: undefined }, { status: s })}
              className={cn("rounded-2xl px-4 py-2.5 text-sm font-semibold", status === s ? "bg-plum text-cream" : "bg-paper text-ink-soft")}
            >
              {STATUS_META[s].label}
              <span className="ms-2 opacity-70">{counts[i].count ?? 0}</span>
            </Link>
          ))}
        </div>
      </div>

      <form className="mb-6 grid gap-3 rounded-3xl bg-paper p-4 shadow-soft md:grid-cols-[1fr_auto_auto_auto_auto]" action="/admin/bookings">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="relative">
          <span className="sr-only">بحث</span>
          <Search className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
          <input name="q" defaultValue={sp.q} placeholder="الاسم أو الجوال أو رقم الحجز" className={cn(inputClass, "h-11 pr-11")} />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          من
          <input type="date" name="from" defaultValue={from} className={cn(inputClass, "h-11 py-0")} />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          إلى
          <input type="date" name="to" defaultValue={to} className={cn(inputClass, "h-11 py-0")} />
        </label>
        <select name="sort" defaultValue={sp.sort ?? ""} className={cn(inputClass, "h-11 py-0")} aria-label="الترتيب">
          <option value="">حسب موعد الجلسة</option>
          <option value="created">الأحدث طلباً</option>
        </select>
        <button className={buttonClass("dark", "md", "h-11")}>تطبيق</button>
      </form>

      <Card>
        {error && <p className="text-coral-ink">تعذر تحميل الحجوزات.</p>}
        {!error && !data?.length ? (
          <EmptyState title="لا توجد حجوزات مطابقة" text="جرّب تغيير الفلاتر أو البحث." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-right text-ink-soft">
                    <th className="pb-3 font-medium">العميل</th>
                    <th className="pb-3 font-medium">الجلسة</th>
                    <th className="pb-3 font-medium">الموعد</th>
                    <th className="pb-3 font-medium">الأطفال</th>
                    <th className="pb-3 font-medium">الحالة</th>
                    <th className="pb-3 font-medium"><span className="sr-only">إجراءات</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data!.map((b) => (
                    <tr key={b.id} className="align-middle">
                      <td className="py-3">
                        <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-plum hover:underline">{b.customer_name}</Link>
                        <p className="text-xs text-ink-soft" dir="ltr" style={{ textAlign: "right" }}>{b.reference} · {b.customer_phone}</p>
                      </td>
                      <td className="py-3">{b.service_name}</td>
                      <td className="py-3 whitespace-nowrap">
                        {formatShortDate(b.booking_date)}
                        <p className="text-xs text-ink-soft">{formatTime(b.start_time)} – {formatTime(b.end_time)}</p>
                      </td>
                      <td className="py-3 text-center">{b.children_count}</td>
                      <td className="py-3"><StatusBadge status={b.status as BookingStatus} /></td>
                      <td className="py-3"><QuickStatus id={b.id} status={b.status as BookingStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-3 md:hidden">
              {data!.map((b) => (
                <li key={b.id} className="rounded-2xl bg-cream p-4">
                  <Link href={`/admin/bookings/${b.id}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-plum">{b.customer_name}</p>
                        <p className="text-xs text-ink-soft" dir="ltr" style={{ textAlign: "right" }}>{b.reference}</p>
                      </div>
                      <StatusBadge status={b.status as BookingStatus} />
                    </div>
                    <p className="mt-2 text-sm">{b.service_name}</p>
                    <p className="text-sm text-ink-soft">{formatShortDate(b.booking_date)} · {formatTime(b.start_time)}</p>
                  </Link>
                  <div className="mt-3"><QuickStatus id={b.id} status={b.status as BookingStatus} /></div>
                </li>
              ))}
            </ul>
          </>
        )}
        {totalPages > 1 && (
          <nav className="mt-6 flex items-center justify-between" aria-label="الصفحات">
            <Link aria-disabled={page <= 1} className={cn(buttonClass("ghost", "sm"), page <= 1 && "pointer-events-none opacity-40")} href={qs(sp, { page: String(page - 1) })}>
              <ChevronRight className="size-4" /> السابق
            </Link>
            <span className="text-sm text-ink-soft">صفحة {page} من {totalPages}</span>
            <Link aria-disabled={page >= totalPages} className={cn(buttonClass("ghost", "sm"), page >= totalPages && "pointer-events-none opacity-40")} href={qs(sp, { page: String(page + 1) })}>
              التالي <ChevronLeft className="size-4" />
            </Link>
          </nav>
        )}
      </Card>
    </AdminPage>
  );
}
