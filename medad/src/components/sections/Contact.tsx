import { Mail, MessageCircle, Phone } from 'lucide-react';
import { SectionLabel } from '@/components/ui/SectionHead';
import { SplitWords } from '@/components/motion/SplitWords';
import { siteConfig } from '@/config/site';
import type { Dictionary } from '@/content/types';
import type { Locale } from '@/lib/i18n';
import { ContactForm } from './ContactForm';

export function Contact({ t, locale }: { t: Dictionary['contact']; locale: Locale }) {
  const direct = [
    siteConfig.email && { icon: Mail, label: t.email, href: `mailto:${siteConfig.email}`, text: siteConfig.email },
    siteConfig.phone && { icon: Phone, label: t.phone, href: `tel:${siteConfig.phone}`, text: siteConfig.phone },
    siteConfig.whatsapp && {
      icon: MessageCircle,
      label: t.whatsapp,
      href: `https://wa.me/${siteConfig.whatsapp}`,
      text: `+${siteConfig.whatsapp}`,
    },
  ].filter(Boolean) as { icon: typeof Mail; label: string; href: string; text: string }[];

  return (
    <section id="contact" aria-labelledby="contact-title" className="relative overflow-x-clip py-24 sm:py-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 h-[34rem] w-[34rem] rounded-full bg-electric/[0.1] blur-[150px] ltr:-right-40 rtl:-left-40"
      />
      <div className="container-medad relative grid gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <SectionLabel index={t.index} label={t.label} labelEn={t.labelEn} className="reveal mb-10 sm:mb-14" />
          <SplitWords as="h2" id="contact-title" text={t.heading} className="block text-h2 text-balance-pretty" />
          <p className="reveal mt-8 max-w-md text-lead text-cool">{t.intro}</p>

          <div className="reveal mt-12">
            <h3 className="text-label text-mist">{t.direct}</h3>
            {direct.length > 0 ? (
              <ul className="mt-5 flex flex-col gap-3">
                {direct.map((d) => (
                  <li key={d.href}>
                    <a
                      href={d.href}
                      {...(d.href.startsWith('https') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="group inline-flex items-center gap-4 text-lg text-white transition-colors hover:text-icy"
                    >
                      <span className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.03]">
                        <d.icon className="size-4 text-icy" aria-hidden="true" />
                      </span>
                      <span className="sr-only">{d.label}: </span>
                      <span dir="ltr">{d.text}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 max-w-sm text-body text-cool">{t.noDirect}</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-7">
          <ContactForm t={t} locale={locale} fallbackEmail={siteConfig.email} />
        </div>
      </div>
    </section>
  );
}
