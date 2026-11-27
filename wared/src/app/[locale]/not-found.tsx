'use client';

import Link from 'next/link';
import { useI18n } from '@/components/I18nProvider';
import { localePath } from '@/lib/i18n/config';

export default function NotFound() {
  const { dict, locale } = useI18n();
  return (
    <section className="container-page pb-16 pt-20 md:pt-32">
      <p className="display text-[clamp(6rem,22vw,16rem)] leading-none text-muted" dir="ltr" aria-hidden="true">
        404
      </p>
      <h1 className="display mt-6 text-[clamp(2.25rem,6vw,4.5rem)]">{dict.pages.notFound.title}</h1>
      <p className="mt-5 max-w-xl text-lg leading-8 text-muted">{dict.pages.notFound.body}</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={localePath(locale, '/')} className="btn btn-primary">
          {dict.pages.notFound.home}
        </Link>
        <Link href={localePath(locale, '/search')} className="btn btn-ghost">
          {dict.pages.notFound.search}
        </Link>
      </div>
    </section>
  );
}
