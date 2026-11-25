import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CreditCard, MapPin, QrCode, Sparkles } from 'lucide-react';
import { fill, type Dict, type Locale } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { STUDIO, studioImage } from '@/lib/studio-media';
import { HoursTable } from '@/components/store/HoursTable';
import { Reveal } from '@/components/ui/Reveal';
import type { PublicSettings } from '@/lib/catalog';
import type { Category, Product, StoreState } from '@/lib/catalog-types';
import { StudioMenu } from './StudioMenu';

interface Props {
  t: Dict; locale: Locale; settings: PublicSettings; state: StoreState;
  categories: Category[]; products: Product[]; statusMessage: string | null;
}

/** The new home page: a calm hero, one dark showcase, light product tiles, the packaging story, then the menu. */
export function StudioHome({ t, locale, settings, state, categories, products, statusMessage }: Props) {
  const s = t.studio;
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;
  const name = (p: { name_ar: string; name_en: string }) => (locale === 'ar' ? p.name_ar : p.name_en);
  const desc = (p: Product) => (locale === 'ar' ? p.description_ar : p.description_en);
  const price = (p: Product) => (p.base_price > 0 ? fill(s.from, { price: formatMoney(p.base_price, locale) }) : t.menu.notPriced);
  const burger = products.find((p) => p.builder === 'burger' && p.available) ?? products.find((p) => p.builder === 'burger');
  // the showcase stays short: featured first, then menu order (the full list lives in the menu below)
  const others = products.filter((p) => p !== burger).sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order).slice(0, 3);
  const catName = (p: Product) => { const c = categories.find((x) => x.kind === p.category_kind); return c ? name(c) : ''; };
  // shawarma and fries get a short line; anything else (combos, new items) shows its own name, with the category above it
  const tileText = (p: Product) => p.builder === 'shawarma' ? { eyebrow: name(p), title: s.shawarmaTitle, sub: null }
    : p.category_kind === 'fries' && p.builder === 'simple' && !/combo/.test(p.slug) ? { eyebrow: name(p), title: s.friesTitle, sub: null }
    : { eyebrow: catName(p), title: name(p), sub: desc(p) };

  return (
    <>
      {/* ------------------------------------------------------------------ hero */}
      <section className="overflow-hidden text-center" style={{ backgroundColor: STUDIO.heroBg }} aria-labelledby="s-hero">
        <div className="relative z-10 mx-auto max-w-[980px] px-5 pt-12 sm:pt-16">
          <p className="animate-rise text-[15px] font-semibold text-terracotta-500 sm:text-[17px]">{s.heroEyebrow}</p>
          <h1 id="s-hero" className="s-display mt-2 animate-rise text-[2.6rem] [animation-delay:60ms] sm:text-[4.5rem]">{s.heroTitle}</h1>
          <p className="mx-auto mt-3 max-w-xl animate-rise text-[1.2rem] leading-snug text-espresso-600 [animation-delay:120ms] sm:text-[1.6rem]">{s.heroSubtitle}</p>
          <div className="mt-6 flex animate-rise flex-wrap items-center justify-center gap-x-6 gap-y-3 [animation-delay:180ms]">
            <Link href="#menu" className="s-btn" data-testid="order-now">{s.heroCta}</Link>
            {burger && <Link href={`/p/${burger.slug}`} className="s-link">{s.heroLink} <Chevron className="size-4" /></Link>}
          </div>
          <p className="mt-5 text-[13px] text-espresso-500">
            {t.store.pickupOnly}{state.can_order ? ` · ${fill(t.store.prepTime, { n: state.prep_minutes })}` : ''}
          </p>
          {statusMessage && (
            <p role="status" className="mx-auto mt-4 inline-block rounded-full bg-white px-4 py-2 text-[14px] text-espresso-700 shadow-[var(--shadow-soft)]" data-testid="store-message">{statusMessage}</p>
          )}
        </div>
        <div className="relative mx-auto -mt-[14%] max-w-[1440px] sm:-mt-[20%]">
          <Image src={STUDIO.hero} alt={s.packagingTitle} width={2400} height={1357} priority sizes="(min-width:1440px) 1440px, 100vw" className="h-auto w-full" />
        </div>
      </section>

      {/* ------------------------------------------------------------ showcase */}
      <section className="mx-auto max-w-[1440px] space-y-3 p-3" aria-label={t.home.categoriesTitle}>
        {burger && (
          <Reveal>
            <article className="s-tile flex flex-col bg-black text-white lg:block lg:min-h-[38rem]" data-testid="tile-burger">
              <div className="relative z-10 px-6 pt-12 text-center lg:absolute lg:inset-y-0 lg:left-0 lg:flex lg:w-[46%] lg:flex-col lg:justify-center lg:px-14 lg:pt-0 lg:text-start">
                <p className="text-[17px] font-semibold text-gold-400">{name(burger)}</p>
                <h2 className="s-display mt-1 text-[2.4rem] sm:text-[3.5rem]">{s.burgerTitle}</h2>
                <p className="mx-auto mt-3 max-w-md text-[1.1rem] text-white/70 lg:mx-0">{s.burgerText}</p>
                <p className="num mt-3 text-[15px] text-white/55">{price(burger)}</p>
                <div className="mt-5 flex items-center justify-center gap-6 lg:justify-start">
                  <Link href={`/p/${burger.slug}`} className="s-btn s-btn-light">{s.build}</Link>
                  <Link href="#menu" className="s-link s-link-light">{t.studio.navMenu} <Chevron className="size-4" /></Link>
                </div>
              </div>
              <Image src={STUDIO.burgerDark} alt={name(burger)} width={2400} height={1357} sizes="(min-width:1440px) 1440px, 100vw"
                className="mt-6 h-auto w-full lg:absolute lg:inset-0 lg:mt-0 lg:h-full lg:object-cover lg:object-right" />
            </article>
          </Reveal>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {others.map((p, i) => {
            const wide = others.length % 2 === 1 && i === others.length - 1;
            return (
              <Reveal key={p.id} delay={(i % 2) * 80} className={wide ? 'sm:col-span-2' : ''}>
                <article className={`s-tile flex h-full flex-col items-center px-6 pt-12 text-center ${wide ? 'sm:flex-row sm:px-14 sm:pt-0 sm:text-start' : ''}`} data-testid={`tile-${p.slug}`}>
                  <div className={wide ? 'sm:flex-1 sm:py-14' : ''}>
                    <p className="text-[17px] font-semibold text-terracotta-500">{tileText(p).eyebrow}</p>
                    <h2 className="s-display mt-1 text-[2rem] sm:text-[2.6rem]">{tileText(p).title}</h2>
                    {tileText(p).sub && <p className="mx-auto mt-2 max-w-sm text-[15px] text-espresso-600">{tileText(p).sub}</p>}
                    <p className="num mt-2 text-[15px] text-espresso-500">{price(p)}</p>
                    <div className={`mt-5 flex items-center justify-center gap-6 ${wide ? 'sm:justify-start' : ''}`}>
                      {p.available
                        ? <Link href={`/p/${p.slug}`} className="s-btn s-btn-sm">{p.builder === 'simple' ? s.order : s.build}</Link>
                        : <span className="text-[15px] text-danger-500">{t.menu.unavailable}</span>}
                    </div>
                  </div>
                  <div className={`relative mt-8 aspect-square w-full max-w-[22rem] ${wide ? 'sm:mt-0 sm:max-w-[26rem] sm:flex-1' : ''}`}>
                    <Image src={studioImage(p.slug, p.category_kind, p.image_url)} alt={name(p)} fill sizes="(min-width:640px) 40vw, 90vw"
                      className="object-contain object-bottom drop-shadow-[0_24px_30px_rgba(0,0,0,0.14)]" />
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------ packaging */}
      <section id="packaging" className="scroll-mt-16 px-5 pt-20 text-center sm:pt-28" aria-labelledby="s-pack">
        <Reveal>
          <p className="text-[17px] font-semibold text-terracotta-500">{s.packagingEyebrow}</p>
          <h2 id="s-pack" className="s-display mt-1 text-[2.5rem] sm:text-[4rem]">{s.packagingTitle}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[1.15rem] text-espresso-600 sm:text-[1.35rem]">{s.packagingText}</p>
        </Reveal>
        <Reveal className="mx-auto mt-10 max-w-[1200px]">
          <Image src={STUDIO.packaging} alt={s.packagingTitle} width={2000} height={1493} sizes="(min-width:1200px) 1200px, 100vw" className="h-auto w-full rounded-[1.75rem]" />
        </Reveal>
        <div className="mx-auto mt-3 grid max-w-[1200px] gap-3 sm:grid-cols-2">
          <Reveal>
            <div className="s-tile relative aspect-[4/3]">
              <Image src={STUDIO.detail} alt="" fill sizes="(min-width:640px) 600px, 100vw" className="object-cover" />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="s-tile relative grid aspect-[4/3] place-items-center p-8">
              <Image src={STUDIO.bag} alt="" width={639} height={900} sizes="300px" className="h-full w-auto object-contain drop-shadow-[0_24px_30px_rgba(0,0,0,0.14)]" />
            </div>
          </Reveal>
        </div>
        <ul className="mx-auto mt-12 grid max-w-[980px] gap-8 text-start sm:grid-cols-3">
          {[[s.packagingPoint1, s.packagingPoint1Text], [s.packagingPoint2, s.packagingPoint2Text], [s.packagingPoint3, s.packagingPoint3Text]].map(([h, p], i) => (
            <Reveal key={h} delay={i * 70}>
              <li className="border-t hairline pt-4">
                <p className="text-[17px] font-semibold">{h}</p>
                <p className="mt-1 text-[15px] text-espresso-500">{p}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------------ menu */}
      <StudioMenu categories={categories} products={products} />

      {/* ---------------------------------------------------------------- steps */}
      <section className="mx-auto max-w-[980px] px-5 pt-24 text-center" aria-labelledby="s-how">
        <h2 id="s-how" className="s-display text-[2.2rem] sm:text-[3rem]">{s.howTitle}</h2>
        <ol className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Sparkles, title: t.home.how1, text: t.home.how1Text },
            { icon: CreditCard, title: t.home.how2, text: t.home.how2Text },
            { icon: QrCode, title: t.home.how3, text: t.home.how3Text },
          ].map((x, i) => (
            <Reveal key={x.title} delay={i * 70}>
              <li className="s-tile h-full p-7 text-start">
                <x.icon className="size-7 text-terracotta-500" strokeWidth={1.6} />
                <p className="mt-6 text-[13px] font-semibold text-espresso-500 num">0{i + 1}</p>
                <p className="mt-1 text-[1.3rem] font-semibold">{x.title}</p>
                <p className="mt-1 text-[15px] text-espresso-500">{x.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* -------------------------------------------------------------- loyalty */}
      {settings.loyalty_enabled && (
        <section className="mx-auto max-w-[1440px] px-3 pt-24">
          <Reveal>
            <div className="s-tile bg-espresso-800 px-6 py-14 text-center text-white sm:py-20">
              <p className="text-[17px] font-semibold text-gold-400">{s.loyaltyEyebrow}</p>
              <h2 className="s-display mx-auto mt-1 max-w-2xl text-[2.2rem] sm:text-[3.2rem]">{t.home.loyaltyTitle}</h2>
              <p className="mx-auto mt-3 max-w-xl text-[1.1rem] text-white/70">{t.home.loyaltyText}</p>
              <ul className="num mt-6 flex flex-wrap justify-center gap-2 text-[14px]">
                <li className="rounded-full bg-white/10 px-4 py-2">{fill(t.home.loyaltyEarn, { n: settings.loyalty_points_per_sar })}</li>
                <li className="rounded-full bg-white/10 px-4 py-2">{fill(t.home.loyaltyBurn, { n: settings.loyalty_min_redeem_points, value: formatMoney(settings.loyalty_min_redeem_points * settings.loyalty_point_value_halalas, locale) })}</li>
              </ul>
              <Link href="/account" className="s-btn s-btn-light mt-7">{t.home.loyaltyCta}</Link>
            </div>
          </Reveal>
        </section>
      )}

      {/* --------------------------------------------------------------- branch */}
      <section id="branch" className="mx-auto max-w-[980px] scroll-mt-16 px-5 pt-24" aria-labelledby="s-branch">
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <p className="text-[17px] font-semibold text-terracotta-500">{t.nav.branch}</p>
            <h2 id="s-branch" className="s-display mt-1 text-[2.2rem] sm:text-[3rem]">{s.branchTitle}</h2>
            <p className="mt-3 text-[1.1rem] font-semibold">{locale === 'ar' ? settings.branch_name_ar : settings.branch_name_en}</p>
            {(locale === 'ar' ? settings.address_ar : settings.address_en) && (
              <p className="mt-1 flex items-start gap-2 text-[15px] text-espresso-500"><MapPin className="mt-0.5 size-4 shrink-0" />{locale === 'ar' ? settings.address_ar : settings.address_en}</p>
            )}
            <p className="mt-4 text-[15px] text-espresso-500">{(locale === 'ar' ? settings.pickup_instructions_ar : settings.pickup_instructions_en) || t.checkout.pickupText}</p>
            {settings.maps_url && (
              <a href={settings.maps_url} target="_blank" rel="noopener noreferrer" className="s-link mt-5">{t.track.directions} <Chevron className="size-4" /></a>
            )}
          </div>
          <div className="s-tile p-6">
            <h3 className="mb-4 text-[13px] font-semibold text-espresso-500">{t.footer.hours}</h3>
            <HoursTable hours={settings.opening_hours} t={t} dark={false} />
          </div>
        </div>
      </section>
    </>
  );
}
