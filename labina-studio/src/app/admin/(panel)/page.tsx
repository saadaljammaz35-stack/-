import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpLeft, CircleCheck, CircleDashed } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth";
import { AdminPage, Card, EmptyState, StatCard, StatusBadge } from "@/components/admin/ui";
import { QuickStatus } from "@/components/admin/QuickStatus";
import { formatNumber, formatShortDate, formatTime, todayInTimeZone } from "@/lib/format";
import { parseBooking, parseContact } from "@/lib/settings";
import { cn } from "@/lib/cn";
import type { BookingStatus } from "@/lib/types";

export const metadata: Metadata = { title: "نظرة عامة" };

type Stats = {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  today: number;
  upcoming_week: number;
  created_this_month: number;
  customers: number;
  unread_messages: number;
  weekly: { week: string; count: number }[];
};

export default async function OverviewPage() {
  const supabase = (await getServerClient())!;
  const ctx = (await getStaffContext())!;
  const { data: settingsRows } = await supabase.from("site_settings").select("key, value").in("key", ["booking", "contact"]);
  const settings = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value]));
  const booking = parseBooking(settings.booking);
  const contact = parseContact(settings.contact);
  const today = todayInTimeZone(booking.timezone);

  const [statsRes, upcomingRes, pendingRes, servicesRes, galleryRes, testimonialsRes] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase
      .from("bookings")
      .select("id, reference, customer_name, service_name, booking_date, start_time, status")
      .in("status", ["pending", "confirmed"])
      .gte("booking_date", today)
      .order("booking_date")
      .order("start_time")
      .limit(8),
    supabase
      .from("bookings")
      .select("id, reference, customer_name, customer_phone, service_name, booking_date, start_time, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("services").select("id, price").eq("is_active", true),
    supabase.from("gallery_items").select("id", { count: "exact", head: true }),
    supabase.from("testimonials").select("id", { count: "exact", head: true }),
  ]);

  const stats = (statsRes.data ?? {}) as unknown as Stats;
  const maxWeek = Math.max(1, ...(stats.weekly ?? []).map((w) => w.count));
  const services = servicesRes.data ?? [];

  const checklist = [
    { done: Boolean(contact.phone || contact.whatsapp || contact.email), label: "أضف بيانات التواصل", href: "/admin/contact" },
    { done: services.length > 0 && services.every((s) => s.price !== null), label: "حدد أسعار الخدمات", href: "/admin/pricing" },
    { done: (galleryRes.count ?? 0) > 0, label: "ارفع صوراً إلى المعرض", href: "/admin/gallery" },
    { done: (testimonialsRes.count ?? 0) > 0, label: "أضف آراء عملاء حقيقية", href: "/admin/testimonials" },
    { done: false, label: "راجع ساعات العمل وإعدادات الحجز", href: "/admin/hours", optional: true },
  ];
  const showChecklist = ctx.role === "admin" && checklist.some((c) => !c.done && !c.optional);

  return (
    <AdminPage title={`أهلاً ${ctx.displayName}`} description="ملخص الحجوزات والنشاط في الاستوديو.">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard label="حجوزات جديدة" value={formatNumber(stats.pending ?? 0)} tone="sun" hint="بانتظار التأكيد" />
        <StatCard label="مؤكدة" value={formatNumber(stats.confirmed ?? 0)} tone="teal" />
        <StatCard label="ملغاة" value={formatNumber(stats.cancelled ?? 0)} tone="coral" />
        <StatCard label="إجمالي الحجوزات" value={formatNumber(stats.total ?? 0)} tone="plum" hint={`${formatNumber(stats.completed ?? 0)} مكتملة`} />
        <StatCard label="جلسات اليوم" value={formatNumber(stats.today ?? 0)} />
        <StatCard label="خلال 7 أيام" value={formatNumber(stats.upcoming_week ?? 0)} />
        <StatCard label="حجوزات هذا الشهر" value={formatNumber(stats.created_this_month ?? 0)} />
        <StatCard label="العملاء" value={formatNumber(stats.customers ?? 0)} hint={stats.unread_messages ? `${stats.unread_messages} رسائل غير مقروءة` : undefined} />
      </div>

      {showChecklist && (
        <Card title="خطوات قبل الإطلاق" description="أكمل هذه الخطوات ليظهر الموقع بمعلوماتك الحقيقية." className="mt-6">
          <ul className="grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link href={c.href} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors", c.done ? "bg-teal-soft/60 text-teal-ink" : "bg-cream hover:bg-cream-2")}>
                  {c.done ? <CircleCheck className="size-5 shrink-0" /> : <CircleDashed className="size-5 shrink-0 text-ink-soft" />}
                  <span className={cn("flex-1 text-sm font-medium", c.done && "line-through decoration-teal/50")}>{c.label}</span>
                  {!c.done && <ArrowUpLeft className="size-4 text-ink-soft" />}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title="بانتظار التأكيد" className="lg:col-span-3" actions={<Link href="/admin/bookings?status=pending" className="text-sm font-semibold text-coral-ink">عرض الكل</Link>}>
          {pendingRes.data?.length ? (
            <ul className="divide-y divide-line">
              {pendingRes.data.map((b) => (
                <li key={b.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  <Link href={`/admin/bookings/${b.id}`} className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{b.customer_name} <span className="text-xs font-normal text-ink-soft" dir="ltr">{b.reference}</span></p>
                    <p className="text-sm text-ink-soft">{b.service_name} · {formatShortDate(b.booking_date)} · {formatTime(b.start_time)}</p>
                  </Link>
                  <QuickStatus id={b.id} status={b.status as BookingStatus} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد حجوزات جديدة" text="ستظهر هنا الطلبات التي تحتاج تأكيداً." />
          )}
        </Card>

        <Card title="الحجوزات الأسبوعية" description="عدد الطلبات الجديدة في آخر 8 أسابيع" className="lg:col-span-2">
          <div className="flex h-44 items-end gap-2" role="img" aria-label="رسم بياني للحجوزات الأسبوعية">
            {(stats.weekly ?? []).map((w, i) => (
              <div key={w.week} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-xs font-semibold text-ink-soft">{w.count}</span>
                <span
                  className={cn("w-full rounded-lg", i === (stats.weekly?.length ?? 0) - 1 ? "bg-coral" : "bg-lavender")}
                  style={{ height: `${Math.max(4, (w.count / maxWeek) * 100)}%` }}
                  title={`${w.week}: ${w.count}`}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="المواعيد القادمة" className="mt-6" actions={<Link href="/admin/bookings" className="text-sm font-semibold text-coral-ink">كل الحجوزات</Link>}>
        {upcomingRes.data?.length ? (
          <ul className="grid gap-2 md:grid-cols-2">
            {upcomingRes.data.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-4 rounded-2xl bg-cream px-4 py-3 transition-colors hover:bg-cream-2">
                  <span className="grid w-14 shrink-0 text-center">
                    <span className="font-display text-lg font-bold text-plum">{formatTime(b.start_time).split(" ")[0]}</span>
                    <span className="text-[0.7rem] text-ink-soft">{formatShortDate(b.booking_date)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.customer_name}</span>
                    <span className="block truncate text-sm text-ink-soft">{b.service_name}</span>
                  </span>
                  <StatusBadge status={b.status as BookingStatus} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="لا توجد مواعيد قادمة" />
        )}
      </Card>
    </AdminPage>
  );
}
