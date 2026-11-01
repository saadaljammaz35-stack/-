import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { AdminPage, Card, EmptyState, StatusBadge } from "@/components/admin/ui";
import { CustomerForm } from "@/components/admin/CustomerForm";
import { formatShortDate, formatTime } from "@/lib/format";
import type { BookingStatus } from "@/lib/types";

export const metadata: Metadata = { title: "ملف العميل" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = (await getServerClient())!;
  const [{ data: c }, { data: bookings }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("bookings").select("id, reference, service_name, booking_date, start_time, status").eq("customer_id", id).order("booking_date", { ascending: false }),
  ]);
  if (!c) notFound();

  return (
    <AdminPage title={c.full_name} description={<Link href="/admin/customers" className="inline-flex items-center gap-1 text-coral-ink"><ChevronRight className="size-4" /> كل العملاء</Link>}>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="البيانات" className="lg:col-span-2">
          <p className="mb-4 text-sm text-ink-soft">الجوال: <span dir="ltr" className="font-semibold text-ink">{c.phone}</span></p>
          <CustomerForm id={c.id} initial={{ full_name: c.full_name, email: c.email ?? "", notes: c.notes ?? "" }} />
        </Card>
        <Card title={`الحجوزات (${bookings?.length ?? 0})`} className="lg:col-span-3">
          {!bookings?.length ? (
            <EmptyState title="لا توجد حجوزات" />
          ) : (
            <ul className="divide-y divide-line">
              {bookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 hover:bg-cream">
                    <span>
                      <span className="block font-semibold">{b.service_name}</span>
                      <span className="text-sm text-ink-soft">{formatShortDate(b.booking_date)} · {formatTime(b.start_time)} · <span dir="ltr">{b.reference}</span></span>
                    </span>
                    <StatusBadge status={b.status as BookingStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminPage>
  );
}
