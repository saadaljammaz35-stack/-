import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import type { Dict, Locale } from '@/lib/i18n';
import type { PublicSettings } from '@/lib/catalog';

/** Apple-style footer: quiet grey, small type, tidy columns. */
export function StudioFooter({ t, locale, settings }: { t: Dict; locale: Locale; settings: PublicSettings }) {
  const s = t.studio;
  const col = 'space-y-2.5 text-[12px] text-espresso-500 [&_a:hover]:text-espresso-800 [&_a:hover]:underline';
  return (
    <footer className="mt-24 bg-cream-200 text-espresso-500">
      <div className="mx-auto max-w-[980px] px-5 pb-8 pt-10">
        <div className="flex items-center gap-2 text-espresso-800">
          <Logo variant="icon" height={26} />
          <Logo variant="wordmark" height={20} />
        </div>
        <p className="mt-3 max-w-md text-[12px]">{t.footer.tagline}</p>
        <div className="mt-8 grid grid-cols-2 gap-8 border-t hairline pt-8 sm:grid-cols-4">
          <div>
            <h3 className="mb-3 text-[12px] font-semibold text-espresso-800">{s.footerShop}</h3>
            <ul className={col}>
              <li><Link href="/#menu">{t.nav.menu}</Link></li>
              <li><Link href="/p/samat-burger">{s.heroLink}</Link></li>
              <li><Link href="/cart">{t.nav.cart}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-[12px] font-semibold text-espresso-800">{s.footerAccount}</h3>
            <ul className={col}>
              <li><Link href="/account">{t.nav.account}</Link></li>
              <li><Link href="/#packaging">{s.navPackaging}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-[12px] font-semibold text-espresso-800">{t.nav.branch}</h3>
            <ul className={col}>
              <li className="text-espresso-800">{locale === 'ar' ? settings.branch_name_ar : settings.branch_name_en}</li>
              {(locale === 'ar' ? settings.address_ar : settings.address_en) && <li>{locale === 'ar' ? settings.address_ar : settings.address_en}</li>}
              {settings.phone && <li className="num" dir="ltr">{settings.phone}</li>}
              {settings.maps_url && <li><a href={settings.maps_url} target="_blank" rel="noopener noreferrer">{t.track.directions}</a></li>}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-[12px] font-semibold text-espresso-800">{s.footerAbout}</h3>
            <ul className={col}>
              <li><Link href="/privacy">{t.footer.privacy}</Link></li>
              <li><Link href="/terms">{t.footer.terms}</Link></li>
              <li><Link href="/admin">{t.footer.staff}</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t hairline pt-5 text-[12px]">© {new Date().getFullYear()} SAMAT · سماط — {t.footer.rights}</p>
      </div>
    </footer>
  );
}
