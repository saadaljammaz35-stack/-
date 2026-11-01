import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth";
import { AdminPage, NoAccess } from "@/components/admin/ui";
import { ContactSettingsForm } from "@/components/admin/ContactSettingsForm";
import { parseContact } from "@/lib/settings";
import { isEmailConfigured } from "@/lib/email";

export const metadata: Metadata = { title: "بيانات التواصل" };

export default async function ContactSettingsPage() {
  if ((await getStaffContext())?.role !== "admin") return <NoAccess />;
  const supabase = (await getServerClient())!;
  const { data } = await supabase.from("site_settings").select("value").eq("key", "contact").maybeSingle();
  return (
    <AdminPage title="بيانات التواصل" description="تظهر في التذييل وصفحة التواصل. الحقول الفارغة لا تظهر للزوار.">
      <ContactSettingsForm initial={parseContact(data?.value)} emailReady={isEmailConfigured()} alertsTo={process.env.STUDIO_NOTIFY_EMAIL ?? ""} />
    </AdminPage>
  );
}
