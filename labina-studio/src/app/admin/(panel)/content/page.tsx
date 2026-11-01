import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth";
import { AdminPage, NoAccess } from "@/components/admin/ui";
import { HomeContentForm } from "@/components/admin/HomeContentForm";
import { parseHome } from "@/lib/settings";

export const metadata: Metadata = { title: "محتوى الصفحة الرئيسية" };

export default async function ContentPage() {
  if ((await getStaffContext())?.role !== "admin") return <NoAccess />;
  const supabase = (await getServerClient())!;
  const { data } = await supabase.from("site_settings").select("value").eq("key", "home").maybeSingle();
  return (
    <AdminPage title="محتوى الصفحة الرئيسية" description="النصوص والصور في الواجهة وقسم «من نحن».">
      <HomeContentForm initial={parseHome(data?.value)} />
    </AdminPage>
  );
}
