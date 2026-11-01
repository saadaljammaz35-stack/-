import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminShell";
import { LogoMark } from "@/components/brand/Logo";
import { signOut } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/admin/login");

  if (!ctx.role) {
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <div className="max-w-md rounded-3xl bg-paper p-8 text-center shadow-soft">
          <LogoMark className="mx-auto h-14 w-16" />
          <h1 className="mt-6 text-2xl font-bold text-plum">لا توجد صلاحية للوحة التحكم</h1>
          <p className="mt-3 leading-8 text-ink-soft">
            تم تسجيل دخولك بالحساب <span dir="ltr" className="font-semibold">{ctx.email}</span>، لكنه غير مضاف كمسؤول. اطلب من مسؤول الاستوديو إضافتك.
          </p>
          <form action={signOut} className="mt-6">
            <button className="rounded-2xl bg-plum px-5 py-3 font-semibold text-cream">تسجيل الخروج</button>
          </form>
        </div>
      </main>
    );
  }

  const supabase = await getServerClient();
  const [pending, messages] = await Promise.all([
    supabase!.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase!.from("contact_messages").select("id", { count: "exact", head: true }).eq("is_read", false),
  ]);

  return (
    <AdminShell role={ctx.role} name={ctx.displayName} email={ctx.email} counts={{ pending: pending.count ?? 0, messages: messages.count ?? 0 }}>
      {children}
    </AdminShell>
  );
}
