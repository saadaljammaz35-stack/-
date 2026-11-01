import type { Metadata } from "next";
import { LogoMark } from "@/components/brand/Logo";
import { LoginForm } from "@/components/admin/LoginForm";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = typeof next === "string" && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
  const configured = isSupabaseConfigured();

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-plum lg:block">
        <LogoMark className="absolute right-1/2 top-1/2 w-2/3 -translate-y-1/2 translate-x-1/2 opacity-90" light />
        <p className="absolute bottom-10 right-10 left-10 font-display text-2xl font-semibold text-cream/85">لوحة تحكم لَبِنة</p>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <LogoMark className="h-12 w-14 lg:hidden" />
          <h1 className="mt-6 text-3xl font-bold text-plum">تسجيل الدخول</h1>
          <p className="mt-2 text-ink-soft">للمسؤولين وفريق الاستوديو فقط.</p>
          {configured ? (
            <LoginForm next={safeNext} />
          ) : (
            <div className="mt-8 rounded-2xl bg-sun-soft p-5 text-sm leading-7 text-ink">
              <p className="font-semibold">لم يتم ربط Supabase بعد.</p>
              <p className="mt-1">
                أضف <code dir="ltr">NEXT_PUBLIC_SUPABASE_URL</code> و<code dir="ltr">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> إلى متغيرات البيئة ثم أعد تشغيل الموقع. التفاصيل في ملف README.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
