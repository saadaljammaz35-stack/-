import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth";
import { AdminPage, EmptyState, NoAccess } from "@/components/admin/ui";
import { ServiceRow } from "@/components/admin/ServiceRow";
import { ButtonLink } from "@/components/ui/Button";
import type { Service } from "@/lib/types";

export const metadata: Metadata = { title: "الخدمات" };

export default async function AdminServicesPage() {
  if ((await getStaffContext())?.role !== "admin") return <NoAccess />;
  const supabase = (await getServerClient())!;
  const { data } = await supabase.from("services").select("*").order("sort_order").order("created_at");
  const services = (data ?? []).map((s) => ({ ...s, price: s.price === null ? null : Number(s.price) })) as Service[];

  return (
    <AdminPage
      title="الخدمات"
      description="أضف الخدمات وعدّلها، وتحكم في ظهورها وإتاحتها للحجز."
      actions={<ButtonLink href="/admin/services/new" icon={<Plus className="size-4" />}>خدمة جديدة</ButtonLink>}
    >
      {services.length === 0 ? (
        <EmptyState title="لا توجد خدمات" action={<ButtonLink href="/admin/services/new">أضف أول خدمة</ButtonLink>} />
      ) : (
        <ul className="space-y-3">
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} />
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm text-ink-soft">
        لتعديل الأسعار دفعة واحدة استخدم صفحة <Link href="/admin/pricing" className="font-semibold text-coral-ink underline">الأسعار</Link>.
      </p>
    </AdminPage>
  );
}
