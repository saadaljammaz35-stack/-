'use client';

import { useEffect } from 'react';
import { useI18n } from '@/components/I18nProvider';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { dict } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="container-page pb-16 pt-20 md:pt-32">
      <h1 className="display text-[clamp(2.25rem,6vw,4.5rem)]">{dict.pages.error.title}</h1>
      <p className="mt-5 max-w-xl text-lg leading-8 text-muted">{dict.pages.error.body}</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-10">
        {dict.pages.error.retry}
      </button>
    </section>
  );
}
