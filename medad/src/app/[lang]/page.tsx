import { notFound } from 'next/navigation';
import { getDictionary } from '@/content';
import { isLocale } from '@/lib/i18n';
import { Hero } from '@/components/hero/Hero';
import { Philosophy } from '@/components/sections/Philosophy';
import { Services } from '@/components/sections/Services';
import { Work } from '@/components/sections/Work';
import { Process } from '@/components/sections/Process';
import { Why } from '@/components/sections/Why';
import { FinalCta } from '@/components/sections/FinalCta';
import { Contact } from '@/components/sections/Contact';

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <>
      <Hero locale={lang} t={t} />
      <Philosophy t={t.philosophy} />
      <Services t={t.services} locale={lang} />
      <Work t={t.work} locale={lang} />
      <Process t={t.process} />
      <Why t={t.why} />
      <FinalCta t={t.cta} />
      <Contact t={t.contact} locale={lang} />
    </>
  );
}
