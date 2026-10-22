import { Settings2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/**
 * Shown instead of the app when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * are missing or invalid. Deliberately has no dependencies on providers.
 */
export function NotConfigured({ missing }: { missing: readonly string[] }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 pt-[max(2.5rem,env(safe-area-inset-top,0px))] pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <span className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Settings2 className="size-6" aria-hidden="true" />
          </span>
        </div>

        <section lang="ar" dir="rtl" className="mt-7 text-start">
          <h1 className="text-xl font-extrabold text-slate-900">التطبيق غير مهيأ بعد</h1>
          <p className="mt-2 leading-relaxed text-slate-700">
            لم يتم ضبط إعدادات الاتصال بالخادم لهذه النسخة من CliniBot. إذا كنت مسؤولاً عن النشر،
            أضف المتغيرات التالية ثم أعد بناء التطبيق. إذا كنت مستخدماً، يُرجى المحاولة لاحقاً.
          </p>
        </section>

        <hr className="my-6 border-slate-100" />

        <section lang="en" dir="ltr" className="text-start">
          <h2 className="text-xl font-extrabold text-slate-900">CliniBot isn't configured yet</h2>
          <p className="mt-2 leading-relaxed text-slate-700">
            This build has no server connection settings. If you deploy this app, set the variables
            below and rebuild. If you're a user, please try again later.
          </p>
        </section>

        <ul dir="ltr" className="mt-6 flex flex-col gap-2">
          {missing.map((name) => (
            <li key={name}>
              <code className="block rounded-xl bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800">
                {name}
              </code>
            </li>
          ))}
        </ul>
        <p dir="ltr" className="mt-4 text-sm text-slate-500">
          See <code className="font-mono">web/.env.example</code>.
        </p>
      </div>
    </main>
  );
}
