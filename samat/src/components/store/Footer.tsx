import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import type { Dict, Locale } from '@/lib/i18n';
import type { PublicSettings } from '@/lib/catalog';
import { HoursTable } from './HoursTable';

export function Footer({ t, locale, settings }: { t: Dict; locale: Locale; settings: PublicSettings }) {
  return (
    <footer className="mt-24 bg-espresso-900 text-cream-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-3 sm:px-8">
        <div className="space-y-4">
          <Logo variant="full" height={120} className="text-cream-100" />
          <p className="max-w-xs text-sm text-cream-300/80">{t.footer.tagline}</p>
        </div>
        <div>
          <h3 className="eyebrow mb-4 text-gold-400">{t.nav.branch}</h3>
          <p className="font-semibold">{locale === 'ar' ? settings.branch_name_ar : settings.branch_name_en}</p>
          {(locale === 'ar' ? settings.address_ar : settings.address_en) && (
            <p className="mt-1 text-sm text-cream-300/80">{locale === 'ar' ? settings.address_ar : settings.address_en}</p>
          )}
          {settings.phone && <p className="num mt-1 text-sm text-cream-300/80" dir="ltr">{settings.phone}</p>}
          {settings.maps_url && (
            <a href={settings.maps_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-cream mt-4">
              {locale === 'ar' ? 'افتح الموقع على الخريطة' : 'Open in Maps'}
            </a>
          )}
        </div>
        <div>
          <h3 className="eyebrow mb-4 text-gold-400">{t.footer.hours}</h3>
          <HoursTable hours={settings.opening_hours} t={t} />
        </div>
      </div>
      <div className="border-t border-cream-100/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-cream-300/60 sm:px-8">
          <span>© {new Date().getFullYear()} SAMAT · سماط — {t.footer.rights}</span>
          <Link href="/admin" className="hover:text-cream-100">{t.footer.staff}</Link>
        </div>
      </div>
    </footer>
  );
}
