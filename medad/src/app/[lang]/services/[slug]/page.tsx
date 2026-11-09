import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getDictionary, isServiceSlug, serviceSlugs } from '@/content';
import { isLocale, locales } from '@/lib/i18n';
import { SplitWords } from '@/components/motion/SplitWords';
import { Magnetic } from '@/components/motion/Magnetic';
import { ButtonLink } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionHead';
import { ServiceArt } from '@/components/sections/ServiceArt';
import { InkMark } from '@/components/brand/InkMark';

type Params = Promise<{ lang: string; slug: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((lang) => serviceSlugs.map((slug) => ({ lang, slug })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !isServiceSlug(slug)) return {};
  const service = getDictionary(lang).services.items.find((s) => s.slug === slug)!;
  return {
    title: service.title,
    description: service.short,
    alternates: {
      canonical: `/${lang}/services/${slug}`,
      languages: { ar: `/ar/services/${slug}`, en: `/en/services/${slug}` },
    },
    openGraph: { title: service.title, description: service.short, url: `/${lang}/services/${slug}` },
  };
}

export default async function ServicePage({ params }: { params: Params }) {
  const { lang, slug } = await params;
  if (!isLocale(lang) || !isServiceSlug(slug)) notFound();
  const t = getDictionary(lang);
  const d = t.serviceDetail;
  const items = t.services.items;
  const index = items.findIndex((s) => s.slug === slug);
  const service = items[index]!;
  const next = items[(index + 1) % items.length]!;
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft;
  const Fwd = lang === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <article aria-labelledby="service-title">
      {/* intro */}
      <header className="relative isolate overflow-hidden pt-[calc(var(--nav-h)+4rem)] pb-20 sm:pt-[calc(var(--nav-h)+6rem)] sm:pb-28">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#101522_0%,#080a0f_65%)]" />
          <div className="hairline-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(60%_60%_at_50%_30%,#000,transparent)]" />
          <div className="absolute top-10 h-[30rem] w-[30rem] rounded-full bg-electric/20 blur-[140px] ltr:right-0 rtl:left-0" />
        </div>
        <div className="container-medad">
          <Link
            href={`/${lang}#services`}
            className="hero-in inline-flex items-center gap-2 text-sm text-cool transition-colors hover:text-white"
          >
            <Back className="size-4" aria-hidden="true" />
            {d.back}
          </Link>
          <div className="mt-12 grid items-end gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SectionLabel index={`0${index + 1}`} label={d.all} labelEn={service.titleAlt} className="hero-in mb-10" />
              <h1 id="service-title" className="text-h1 text-balance-pretty">
                <SplitWords text={service.title} hero className="block" delay={150} />
              </h1>
              <p className="hero-in mt-8 max-w-2xl text-lead text-cool" style={{ '--d': 450 } as CSSProperties}>
                {service.detail.lead}
              </p>
            </div>
            <div className="hero-in lg:col-span-5" style={{ '--d': 300 } as CSSProperties}>
              <div className="glass glass-rim relative aspect-[16/11] overflow-hidden rounded-[2rem]">
                <div aria-hidden="true" className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric/30 blur-3xl" />
                <ServiceArt slug={service.slug} className="relative size-full p-4" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* approach + includes */}
      <section className="py-20 sm:py-28" aria-labelledby="approach-title">
        <div className="container-medad grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 id="approach-title" className="reveal text-label text-icy">
              {d.approach}
            </h2>
            <div className="mt-8 flex flex-col gap-6">
              {service.detail.paragraphs.map((p, i) => (
                <p key={i} className="reveal text-lead text-white/90" style={{ '--d': i * 120 } as CSSProperties}>
                  {p}
                </p>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <h2 className="reveal text-label text-icy">{d.included}</h2>
            <ol className="mt-8 border-t border-white/10">
              {service.detail.includes.map((item, i) => (
                <li
                  key={item}
                  className="reveal flex items-center gap-5 border-b border-white/10 py-4"
                  style={{ '--d': i * 60 } as CSSProperties}
                >
                  <span className="font-latin text-xs font-semibold tracking-[0.2em] text-icy">0{i + 1}</span>
                  <span className="text-[1.05rem]">{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ideal for + outcome */}
      <section className="pb-20 sm:pb-28" aria-labelledby="ideal-title">
        <div className="container-medad grid gap-5 md:grid-cols-2">
          <div className="reveal rounded-[var(--radius-xl)] border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10">
            <h2 id="ideal-title" className="text-label text-icy">
              {d.idealFor}
            </h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {service.detail.idealFor.map((x) => (
                <li key={x} className="rounded-full border border-white/10 px-4 py-2 text-[0.95rem] text-cool">
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal glass glass-rim relative overflow-hidden rounded-[var(--radius-xl)] p-8 sm:p-10" style={{ '--d': 120 } as CSSProperties}>
            <div aria-hidden="true" className="absolute -top-16 h-48 w-48 rounded-full bg-electric/35 blur-[80px] ltr:-right-10 rtl:-left-10" />
            <h2 className="relative text-label text-icy">{d.outcome}</h2>
            <p className="relative mt-6 text-h3">{service.detail.outcome}</p>
          </div>
        </div>
      </section>

      {/* CTA + next */}
      <section className="relative isolate overflow-hidden border-t border-white/[0.07] py-24 sm:py-32" aria-labelledby="service-cta">
        <div aria-hidden="true" className="absolute top-1/2 left-1/2 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(65_105_255/0.25),transparent)]" />
        <div className="container-medad flex flex-col items-center text-center">
          <InkMark className="reveal float-y h-20 w-auto" />
          <SplitWords as="h2" id="service-cta" text={d.ctaTitle} className="mt-10 block max-w-3xl text-h2 text-balance-pretty" />
          <p className="reveal mt-6 max-w-xl text-lead text-cool">{d.ctaText}</p>
          <div className="reveal mt-10">
            <Magnetic>
              <ButtonLink href={`/${lang}#contact`} size="lg">
                {d.ctaButton}
              </ButtonLink>
            </Magnetic>
          </div>
        </div>
        <div className="container-medad mt-24">
          <Link
            href={`/${lang}/services/${next.slug}`}
            className="group flex flex-col gap-3 rounded-[var(--radius-xl)] border border-white/[0.08] p-8 transition-colors hover:border-icy/30 hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between sm:p-10"
          >
            <span className="text-label text-mist">{d.next}</span>
            <span className="flex items-center gap-4 text-h3">
              {next.title}
              <Fwd className="size-6 text-icy transition-transform duration-500 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>
    </article>
  );
}
