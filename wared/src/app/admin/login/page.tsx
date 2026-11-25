import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/LoginForm';
import { Logo } from '@/components/site/Logo';
import { getStaff } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { staff } = await getStaff();
  if (staff) redirect('/admin');
  const { next } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-10 h-10 w-auto" />
        <h1 className="display mb-2 text-3xl">لوحة تحكم وارد</h1>
        <p className="mb-10 text-muted">للفريق فقط.</p>
        {isSupabaseConfigured() ? (
          <LoginForm next={next} />
        ) : (
          <p className="rounded-2xl border border-line p-5 leading-7 text-muted">
            لم يتم ربط Supabase بعد. أضف متغيرات البيئة الموضحة في <code dir="ltr">.env.example</code> ثم أعد تشغيل الخادم.
          </p>
        )}
      </div>
    </main>
  );
}
