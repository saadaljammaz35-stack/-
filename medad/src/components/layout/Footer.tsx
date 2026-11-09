import { ArrowUp } from 'lucide-react';
import { Logo, Wordmark } from '@/components/brand/Logo';
import { activeSocial, siteConfig, type SocialPlatform } from '@/config/site';
import type { Dictionary } from '@/content/types';
import type { Locale } from '@/lib/i18n';
import { FooterLink, FooterNav } from './FooterNav';
import { Year } from './Year';

const SOCIAL_LABEL: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  x: 'X',
  linkedin: 'LinkedIn',
  behance: 'Behance',
  dribbble: 'Dribbble',
  tiktok: 'TikTok',
};

export function Footer({ locale, t }: { locale: Locale; t: Dictionary }) {
  const social = activeSocial();
  const contacts = [
    siteConfig.email && { label: t.contact.email, href: `mailto:${siteConfig.email}`, text: siteConfig.email },
    siteConfig.phone && { label: t.contact.phone, href: `tel:${siteConfig.phone}`, text: siteConfig.phone },
    siteConfig.whatsapp && {
      label: t.contact.whatsapp,
      href: `https://wa.me/${siteConfig.whatsapp}`,
      text: `+${siteConfig.whatsapp}`,
      external: true,
    },
  ].filter(Boolean) as { label: string; href: string; text: string; external?: boolean }[];

  return (
    <footer className="relative overflow-hidden border-t border-white/[0.07] pt-20 sm:pt-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-64 left-1/2 h-[30rem] w-[60rem] -translate-x-1/2 rounded-[100%] bg-electric/20 blur-[140px]"
      />
      <div className="container-medad relative">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo locale={locale} className="h-10 text-white" />
            <p className="mt-8 max-w-sm text-h3 text-white">{t.footer.statement}</p>
            <p className="mt-4 font-latin text-xs tracking-[0.22em] text-icy uppercase" dir="ltr" lang="en">
              {t.footer.tagline}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7">
            <div>
              <h2 className="text-label mb-5 text-mist">{t.footer.navTitle}</h2>
              <FooterNav locale={locale} labels={t.nav} ariaLabel={t.a11y.footerNav} />
            </div>

            <div>
              <h2 className="text-label mb-5 text-mist">{t.footer.contactTitle}</h2>
              <ul className="flex flex-col gap-3 text-[0.95rem]">
                {contacts.map((c) => (
                  <li key={c.href}>
                    <a
                      href={c.href}
                      dir="ltr"
                      className="text-cool transition-colors hover:text-white"
                      {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      <span className="sr-only">{c.label}: </span>
                      {c.text}
                    </a>
                  </li>
                ))}
                <li>
                  <FooterLink locale={locale} hash="contact" className="text-cool transition-colors hover:text-white">
                    {t.footer.formLink}
                  </FooterLink>
                </li>
                {siteConfig.location ? (
                  <li className="text-mist">{siteConfig.location[locale]}</li>
                ) : null}
              </ul>
            </div>

            {social.length > 0 ? (
              <div>
                <h2 className="text-label mb-5 text-mist">{t.footer.socialTitle}</h2>
                <ul className="flex flex-col gap-3 font-latin text-[0.95rem]">
                  {social.map((s) => (
                    <li key={s.platform}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cool transition-colors hover:text-white"
                      >
                        {SOCIAL_LABEL[s.platform]}
                        <span className="sr-only"> {t.a11y.newTab}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="reveal mt-20 sm:mt-28" aria-hidden="true">
          <Wordmark
            locale="en"
            className="block h-auto w-full text-white/[0.06] [mask-image:linear-gradient(to_bottom,#000_30%,transparent_100%)]"
          />
        </div>

        <div className="flex flex-col-reverse items-start justify-between gap-6 border-t border-white/[0.07] py-8 text-sm text-mist sm:flex-row sm:items-center">
          <p>
            © <Year /> {locale === 'ar' ? 'مِداد' : 'MEDAD'}. {t.footer.rights}
          </p>
          <a
            href="#top"
            className="group inline-flex items-center gap-3 text-cool transition-colors hover:text-white"
          >
            {t.footer.backToTop}
            <span className="grid size-9 place-items-center rounded-full border border-white/15 transition-transform duration-500 group-hover:-translate-y-1">
              <ArrowUp className="size-4" aria-hidden="true" />
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
