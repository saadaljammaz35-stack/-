import Link from 'next/link';
import { Mark } from '@/components/brand/Logo';

/** Shown for notFound() inside a language (bilingual, since params are not available here). */
export default function NotFound() {
  return (
    <section className="grid min-h-[80svh] place-items-center px-[var(--gutter)] pt-[var(--nav-h)] text-center">
      <div className="flex flex-col items-center">
        <Mark className="h-16 w-auto text-white/80" />
        <p className="mt-10 font-latin text-xs tracking-[0.3em] text-icy">404</p>
        <h1 className="mt-4 text-h2">هذه الصفحة لم تُكتب بعد.</h1>
        <p className="mt-4 text-lead text-cool" lang="en" dir="ltr">
          This page hasn’t been written yet.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/ar" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-obsidian">
            الصفحة الرئيسية
          </Link>
          <Link href="/en" lang="en" className="rounded-full border border-white/15 px-6 py-3 font-latin text-sm text-white">
            Home
          </Link>
        </div>
      </div>
    </section>
  );
}
