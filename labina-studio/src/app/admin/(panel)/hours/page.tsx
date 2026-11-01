import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/auth";
import { AdminPage, NoAccess } from "@/components/admin/ui";
import { HoursForm, BookingSettingsForm, BlockedDates } from "@/components/admin/HoursForms";
import { DEFAULT_HOURS } from "@/lib/defaults";
import { parseBooking } from "@/lib/settings";
import { isEmailConfigured } from "@/lib/email";
import type { WorkingHour } from "@/lib/types";

export const metadata: Metadata = { title: "مواعيد العمل" };

export default async function HoursPage() {
  if ((await getStaffContext())?.role !== "admin") return <NoAccess />;
  const supabase = (await getServerClient())!;
  const [{ data: hours }, { data: s }, { data: blocked }] = await Promise.all([
    supabase.from("working_hours").select("*").order("weekday"),
    supabase.from("site_settings").select("value").eq("key", "booking").maybeSingle(),
    supabase.from("blocked_dates").select("*").gte("day", new Date().toISOString().slice(0, 10)).order("day"),
  ]);
  const map = new Map((hours ?? []).map((h) => [h.weekday, h]));
  const full = DEFAULT_HOURS.map((d) => (map.get(d.weekday) as WorkingHour | undefined) ?? d);

  return (
    <AdminPage title="مواعيد العمل والحجز" description="تتحكم هذه الإعدادات في الأيام والأوقات التي تظهر للعملاء في صفحة الحجز.">
      <div className="grid gap-6 xl:grid-cols-2">
        <HoursForm hours={full} />
        <div className="space-y-6">
          <BookingSettingsForm settings={parseBooking(s?.value)} emailReady={isEmailConfigured()} />
          <BlockedDates items={blocked ?? []} />
        </div>
      </div>
    </AdminPage>
  );
}
