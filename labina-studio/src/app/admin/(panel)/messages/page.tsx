import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { AdminPage, EmptyState } from "@/components/admin/ui";
import { MessageItem } from "@/components/admin/MessageItem";
import { parseBooking } from "@/lib/settings";

export const metadata: Metadata = { title: "الرسائل" };

export default async function MessagesPage() {
  const supabase = (await getServerClient())!;
  const [{ data }, { data: s }] = await Promise.all([
    supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("site_settings").select("value").eq("key", "booking").maybeSingle(),
  ]);
  const tz = parseBooking(s?.value).timezone;
  return (
    <AdminPage title="الرسائل" description="رسائل نموذج «تواصل معنا».">
      {!data?.length ? (
        <EmptyState title="لا توجد رسائل" text="ستظهر هنا الرسائل المرسلة من صفحة التواصل." />
      ) : (
        <ul className="space-y-3">
          {data.map((m) => (
            <MessageItem key={m.id} message={m} timeZone={tz} />
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
