import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="mx-auto max-w-xl text-center">
        <LogoMark className="mx-auto h-28 w-32 -rotate-6" />
        <p className="mt-10 font-display text-7xl font-extrabold text-coral md:text-8xl" dir="ltr">404</p>
        <h1 className="mt-4 text-3xl font-bold text-plum md:text-4xl">هذه اللَّبِنة ليست في مكانها</h1>
        <p className="mt-4 text-lg leading-8 text-ink-soft">لم نجد الصفحة التي تبحث عنها. ربما تغيّر الرابط أو حُذفت الصفحة.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/" variant="dark">العودة للرئيسية</ButtonLink>
          <ButtonLink href="/booking">احجز جلستك</ButtonLink>
        </div>
        <p className="mt-8 text-sm text-ink-soft">
          تحتاج مساعدة؟ <Link href="/contact" className="font-semibold text-plum underline">تواصل معنا</Link>
        </p>
      </div>
    </main>
  );
}
