import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth";
import { AdminPage, NoAccess } from "@/components/admin/ui";
import { FaqManager } from "@/components/admin/FaqManager";
import type { Faq } from "@/lib/types";

export const metadata: Metadata = { title: "الأسئلة الشائعة" };

export default async function AdminFaqPage() {
  if ((await getStaffContext())?.role !== "admin") return <NoAccess />;
  const supabase = (await getServerClient())!;
  const { data } = await supabase.from("faqs").select("*").order("sort_order").order("created_at");
  return (
    <AdminPage title="الأسئلة الشائعة" description="تظهر في صفحة الأسئلة الشائعة، وأول أربعة منها في الصفحة الرئيسية.">
      <FaqManager items={(data ?? []) as Faq[]} />
    </AdminPage>
  );
}
