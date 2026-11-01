import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth";
import { AdminPage, NoAccess } from "@/components/admin/ui";
import { PricingTable } from "@/components/admin/PricingTable";
import { parseBooking } from "@/lib/settings";

export const metadata: Metadata = { title: "الأسعار" };

export default async function PricingPage() {
  if ((await getStaffContext())?.role !== "admin") return <NoAccess />;
  const supabase = (await getServerClient())!;
  const [{ data }, { data: s }] = await Promise.all([
    supabase.from("services").select("id, name, price, price_note, duration_minutes, is_active").order("sort_order"),
    supabase.from("site_settings").select("value").eq("key", "booking").maybeSingle(),
  ]);
  const rows = (data ?? []).map((r) => ({ ...r, price: r.price === null ? null : Number(r.price) }));
  return (
    <AdminPage title="الأسعار والمدد" description={`عدّل أسعار كل الخدمات ومددها في مكان واحد. العملة: ${parseBooking(s?.value).currency} (تُغيَّر من مواعيد العمل).`}>
      <PricingTable rows={rows} />
    </AdminPage>
  );
}
