import { getDict } from '@/lib/i18n/server';
import { getPublicSettings, getStoreState } from '@/lib/catalog';
import { Header } from '@/components/store/Header';
import { Footer } from '@/components/store/Footer';
import { OfflineBanner } from '@/components/ui/OfflineBanner';

export const dynamic = 'force-dynamic';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [{ t, locale }, settings, state] = await Promise.all([getDict(), getPublicSettings(), getStoreState()]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 btn btn-primary">{t.common.skipToContent}</a>
      <OfflineBanner />
      <Header state={state} demoBanner={settings.demo_banner ? t.common.demoBanner : null} />
      <main id="main" className="pt-24">{children}</main>
      <Footer t={t} locale={locale} settings={settings} />
    </>
  );
}
