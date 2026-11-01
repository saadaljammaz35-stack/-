import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth";
import { AdminPage, NoAccess } from "@/components/admin/ui";
import { TestimonialsManager } from "@/components/admin/TestimonialsManager";
import type { Testimonial } from "@/lib/types";

export const metadata: Metadata = { title: "آراء العملاء" };

export default async function AdminTestimonialsPage() {
  if ((await getStaffContext())?.role !== "admin") return <NoAccess />;
  const supabase = (await getServerClient())!;
  const [{ data }, { data: services }] = await Promise.all([
    supabase.from("testimonials").select("*").order("sort_order").order("created_at", { ascending: false }),
    supabase.from("services").select("id, name").order("sort_order"),
  ]);
  return (
    <AdminPage title="آراء العملاء" description="أضف آراء حقيقية وصلتكم من العائلات. لا يظهر القسم في الموقع حتى تضيف رأياً واحداً على الأقل.">
      <TestimonialsManager items={(data ?? []) as Testimonial[]} services={services ?? []} />
    </AdminPage>
  );
}
