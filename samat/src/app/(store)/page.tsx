import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clock, CreditCard, Landmark, MapPin, QrCode, Sparkles, Store } from 'lucide-react';
import { paymentsConfigured } from '@/lib/payments';
import { getDict } from '@/lib/i18n/server';
import { fill } from '@/lib/i18n';
import { getActiveOffers, getMenu, getPublicSettings, getStoreState } from '@/lib/catalog';
import { formatMoney } from '@/lib/money';
import { ProductCard } from '@/components/store/ProductCard';
import { HoursTable } from '@/components/store/HoursTable';
import { Reveal } from '@/components/ui/Reveal';
import type { CategoryKind } from '@/lib/catalog-types';

const CUTOUT: Record<CategoryKind, string> = {
  burger: '/media/menu/burger.webp',
  shawarma: '/media/menu/shawarma.webp',
  fries: '/media/menu/fries.webp',
};

export default async function HomePage() {
  const [{ t, locale }, menu, settings, state, offers] = await Promise.all([getDict(), getMenu(), getPublicSettings(), getStoreState(), getActiveOffers()]);
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  const cardsLive = paymentsConfigured() && settings.payment_methods.creditcard;
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  const statusMessage = !state.accepting_orders
    ? (locale === 'ar' ? state.pause_message_ar : state.pause_message_en) || t.store.pausedDefault
    : !state.open_now ? t.store.closedDefault
    : state.reason === 'capacity' ? t.store.capacity
    : state.busy_mode ? (locale === 'ar' ? state.busy_message_ar : state.busy_message_en) || t.store.busyDefault
    : null;

  return (
    <>
      {/* ----------------------------------------------------------------- hero */}
      <section className="relative -mt-24 overflow-hidden bg-espresso-900 pt-24 text-cream-100">
        <Image src="/media/banner.jpg" alt="" fill priority sizes="100vw" className="object-cover object-[70%_center] opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-b from-espresso-950/70 via-espresso-950/30 to-espresso-950/90" />
        {/* the photo keeps its empty space on the left, so the copy sits on the left in both languages */}
        <div className="absolute inset-0 bg-gradient-to-r from-espresso-950/90 via-espresso-950/45 to-transparent" />
        {/* phones: the copy sits over the white packaging, so the photo is dimmed a little more there */}
        <div className="absolute inset-0 bg-espresso-950/45 sm:hidden" />
        <div className="relative mx-auto flex min-h-[86svh] max-w-6xl flex-col justify-end px-5 pb-14 pt-24 sm:px-8 sm:pb-20">
          <div className="max-w-xl animate-rise sm:mr-auto sm:ml-0 sm:max-w-[25rem] lg:-ml-6">
            <p className="eyebrow mb-4 text-gold-400">{t.home.eyebrow}</p>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">{t.home.heroTitle}</h1>
            <p className="mt-5 max-w-md text-lg text-cream-200/85">{t.home.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="#menu" className="btn btn-lg btn-accent" data-testid="order-now">
                {t.home.heroCta} <Arrow className="size-5" />
              </Link>
              <Link href={`/#branch`} className="btn btn-lg glass-dark text-cream-100">{t.nav.branch}</Link>
            </div>
          </div>
          <div className="mt-10 flex max-w-xl flex-wrap gap-2.5 [animation-delay:200ms] animate-rise sm:mr-auto sm:ml-0 sm:max-w-[25rem] lg:-ml-6">
            <span className="chip glass-dark"><Store className="size-4" /> {t.store.pickupOnly}</span>
            {state.can_order && <span className="chip glass-dark"><Clock className="size-4" /> {fill(t.store.prepTime, { n: state.prep_minutes })}</span>}
            {cardsLive && <span className="chip glass-dark"><CreditCard className="size-4" /> mada · Visa · Mastercard</span>}
            {settings.payment_methods.bank_transfer && settings.bank_iban && <span className="chip glass-dark"><Landmark className="size-4" /> {locale === 'ar' ? 'تحويل بنكي' : 'Bank transfer'}</span>}
          </div>
          {statusMessage && (
            <div role="status" className="glass-dark mt-6 max-w-xl rounded-2xl px-4 py-3 text-sm text-cream-100 sm:mr-auto sm:ml-0" data-testid="store-message">
              {statusMessage}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ categories */}
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24" aria-labelledby="cats">
        <Reveal>
          <h2 id="cats" className="text-3xl font-bold sm:text-4xl">{t.home.categoriesTitle}</h2>
          <p className="mt-2 text-espresso-600">{t.home.categoriesSubtitle}</p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {menu.categories.map((c, i) => (
            <Reveal key={c.id} delay={i * 90}>
              <Link href={`#cat-${c.slug}`} className="group relative block h-56 overflow-hidden rounded-[1.75rem] bg-espresso-800 p-6 text-cream-100 shadow-lift transition-transform duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1.5 sm:h-72">
                <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_100%,rgba(201,166,107,0.35),transparent_60%)]" />
                <Image src={c.image_url ?? CUTOUT[c.kind]} alt="" width={320} height={320}
                  className="absolute -bottom-6 end-[-1.5rem] w-52 drop-shadow-[0_30px_30px_rgba(0,0,0,0.45)] transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:-translate-y-2 group-hover:scale-105 group-hover:-rotate-3 sm:w-60" />
                <div className="relative">
                  <p className="eyebrow text-gold-400">{c.kind}</p>
                  <h3 className="mt-1 text-3xl font-bold">{n(c)}</h3>
                  <p className="mt-1 max-w-[12rem] text-sm text-cream-200/75">{locale === 'ar' ? c.tagline_ar : c.tagline_en}</p>
                </div>
                <span className="glass-dark absolute bottom-5 start-5 chip">{t.home.buildYours} <Arrow className="size-4" /></span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- offers */}
      {offers.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-14 sm:px-8" aria-labelledby="offers">
          <h2 id="offers" className="text-2xl font-bold">{t.home.offersTitle}</h2>
          <div className="scrollbar-none mt-5 flex snap-x gap-3 overflow-x-auto pb-2">
            {offers.map((o) => (
              <div key={o.id} className="glass min-w-72 snap-start rounded-3xl p-5">
                <Sparkles className="size-5 text-terracotta-500" />
                <p className="mt-3 text-lg font-bold">{locale === 'ar' ? o.title_ar : o.title_en}</p>
                <p className="num mt-1 text-sm text-espresso-600">
                  {o.kind === 'percent' ? `${o.value / 100}%` : formatMoney(o.value, locale)}
                  {o.min_order > 0 && ` · ${locale === 'ar' ? 'للطلبات من' : 'on orders from'} ${formatMoney(o.min_order, locale)}`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ menu */}
      <section id="menu" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-16 sm:px-8 sm:pt-24" aria-labelledby="menu-title">
        <h2 id="menu-title" className="text-3xl font-bold sm:text-4xl">{t.menu.title}</h2>
        <nav className="scrollbar-none sticky top-[5.2rem] z-30 -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 py-2 sm:mx-0 sm:px-0" aria-label={t.menu.title}>
          {menu.categories.map((c) => (
            <a key={c.id} href={`#cat-${c.slug}`} className="chip glass whitespace-nowrap px-4 py-2 text-sm">{n(c)}</a>
          ))}
        </nav>
        {menu.categories.map((c) => {
          const items = menu.products.filter((p) => p.category_kind === c.kind);
          return (
            <div key={c.id} id={`cat-${c.slug}`} className="scroll-mt-32 pt-10">
              <h3 className="mb-5 flex items-baseline gap-3 text-2xl font-bold">
                {n(c)} <span className="text-sm font-medium text-espresso-500">{locale === 'ar' ? c.tagline_ar : c.tagline_en}</span>
              </h3>
              {items.length === 0 ? (
                <p className="paper rounded-3xl p-6 text-espresso-600">{t.home.emptyCategory}</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p, i) => (
                    <Reveal key={p.id} delay={(i % 3) * 70}>
                      <ProductCard product={p} fallbackImage={CUTOUT[p.category_kind]} />
                    </Reveal>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* ---------------------------------------------------------- how it works */}
      <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8" aria-labelledby="how">
        <h2 id="how" className="text-3xl font-bold">{t.home.howTitle}</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Sparkles, title: t.home.how1, text: t.home.how1Text },
            { icon: CreditCard, title: t.home.how2, text: t.home.how2Text },
            { icon: QrCode, title: t.home.how3, text: t.home.how3Text },
          ].map((s, i) => (
            <Reveal key={s.title} delay={i * 90}>
              <li className="paper h-full rounded-3xl p-6">
                <span className="num grid size-10 place-items-center rounded-full bg-espresso-800 text-cream-100">{i + 1}</span>
                <s.icon className="mt-5 size-6 text-terracotta-500" />
                <p className="mt-2 text-lg font-bold">{s.title}</p>
                <p className="mt-1 text-sm text-espresso-600">{s.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------------- loyalty */}
      {settings.loyalty_enabled && (
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-terracotta-500 p-8 text-white sm:p-12">
            <div className="absolute -end-10 -top-10 size-56 rounded-full bg-white/10 blur-2xl" />
            <h2 className="relative max-w-lg text-3xl font-bold">{t.home.loyaltyTitle}</h2>
            <p className="relative mt-3 max-w-lg text-white/85">{t.home.loyaltyText}</p>
            <ul className="num relative mt-5 flex flex-wrap gap-2 text-sm font-semibold">
              <li className="rounded-full bg-white/15 px-4 py-2">{fill(t.home.loyaltyEarn, { n: settings.loyalty_points_per_sar })}</li>
              <li className="rounded-full bg-white/15 px-4 py-2">{fill(t.home.loyaltyBurn, { n: settings.loyalty_min_redeem_points, value: formatMoney(settings.loyalty_min_redeem_points * settings.loyalty_point_value_halalas, locale) })}</li>
            </ul>
            <Link href="/account" className="btn btn-cream relative mt-6">{t.home.loyaltyCta} <Arrow className="size-4" /></Link>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- branch */}
      <section id="branch" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-16 sm:px-8" aria-labelledby="branch-title">
        <div className="paper grid gap-8 rounded-[2rem] p-7 sm:grid-cols-2 sm:p-10">
          <div>
            <p className="eyebrow text-terracotta-500">{t.nav.branch}</p>
            <h2 id="branch-title" className="mt-2 text-3xl font-bold">{locale === 'ar' ? settings.branch_name_ar : settings.branch_name_en}</h2>
            {(locale === 'ar' ? settings.address_ar : settings.address_en) && (
              <p className="mt-3 flex items-start gap-2 text-espresso-600"><MapPin className="mt-0.5 size-5 shrink-0" />{locale === 'ar' ? settings.address_ar : settings.address_en}</p>
            )}
            <p className="mt-4 text-sm text-espresso-600">{(locale === 'ar' ? settings.pickup_instructions_ar : settings.pickup_instructions_en) || t.checkout.pickupText}</p>
            {settings.maps_url && (
              <a href={settings.maps_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-6"><MapPin className="size-4" /> {t.track.directions}</a>
            )}
          </div>
          <div>
            <h3 className="eyebrow mb-4 text-espresso-500">{t.footer.hours}</h3>
            <HoursTable hours={settings.opening_hours} t={t} dark={false} />
          </div>
        </div>
      </section>
    </>
  );
}
