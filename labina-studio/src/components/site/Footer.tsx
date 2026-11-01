import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { NAV_LINKS } from "@/lib/constants";
import { phoneHref } from "@/lib/format";
import type { ContactSettings } from "@/lib/settings";
import { SocialIcon, socialLinks } from "./SocialIcons";

export function Footer({ contact }: { contact: ContactSettings }) {
  const socials = socialLinks(contact);
  const year = new Date().getFullYear();
  const location = [contact.address, contact.city].filter(Boolean).join("، ");

  return (
    <footer className="relative mt-24 overflow-hidden rounded-t-[2.5rem] bg-plum text-cream md:mt-32">
      <LogoMark className="pointer-events-none absolute -bottom-16 -left-10 h-72 w-80 opacity-[0.07] md:h-96 md:w-[26rem]" light />
      <div className="container-x relative grid gap-12 py-14 md:grid-cols-12 md:py-20">
        <div className="md:col-span-5">
          <Logo light />
          <p className="mt-6 max-w-sm leading-8 text-cream/75">
            استوديو متخصص في عالم الأطفال. نصوّر الطفولة بصبر ونحوّل لحظاتها الصغيرة إلى ذكريات تكبر معكم.
          </p>
          {socials.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2.5" aria-label="حساباتنا على وسائل التواصل">
              {socials.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="grid size-11 place-items-center rounded-2xl bg-cream/10 text-cream transition-colors hover:bg-sun hover:text-ink"
                  >
                    <SocialIcon name={s.name} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label="روابط الموقع" className="md:col-span-3">
          <h2 className="mb-5 font-display text-lg font-semibold text-sun">روابط</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-1">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-cream/80 transition-colors hover:text-cream">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/booking" className="text-cream/80 transition-colors hover:text-cream">
                احجز جلستك
              </Link>
            </li>
          </ul>
        </nav>

        <div className="md:col-span-4">
          <h2 className="mb-5 font-display text-lg font-semibold text-sun">تواصل معنا</h2>
          <ul className="space-y-4">
            {contact.phone && (
              <li>
                <a href={`tel:${phoneHref(contact.phone)}`} className="flex items-center gap-3 text-cream/85 hover:text-cream">
                  <span className="grid size-10 place-items-center rounded-xl bg-coral text-ink"><Phone className="size-4" aria-hidden /></span>
                  <span dir="ltr">{contact.phone}</span>
                </a>
              </li>
            )}
            {contact.email && (
              <li>
                <a href={`mailto:${contact.email}`} className="flex items-center gap-3 text-cream/85 hover:text-cream">
                  <span className="grid size-10 place-items-center rounded-xl bg-sun text-ink"><Mail className="size-4" aria-hidden /></span>
                  <span className="break-all">{contact.email}</span>
                </a>
              </li>
            )}
            {location && (
              <li>
                {contact.map_url ? (
                  <a href={contact.map_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-cream/85 hover:text-cream">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal text-ink"><MapPin className="size-4" aria-hidden /></span>
                    <span>{location}</span>
                  </a>
                ) : (
                  <span className="flex items-center gap-3 text-cream/85">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal text-ink"><MapPin className="size-4" aria-hidden /></span>
                    <span>{location}</span>
                  </span>
                )}
              </li>
            )}
            {!contact.phone && !contact.email && !location && (
              <li>
                <Link href="/contact" className="text-cream/80 underline decoration-sun underline-offset-4 hover:text-cream">
                  راسلنا من صفحة التواصل
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="container-x relative flex flex-col gap-3 border-t border-cream/10 py-6 text-sm text-cream/60 md:flex-row md:items-center md:justify-between">
        <p>© {year} لَبِنة. جميع الحقوق محفوظة.</p>
        <div className="flex gap-1.5" aria-hidden>
          {["bg-coral", "bg-sun", "bg-lavender", "bg-teal"].map((c) => (
            <span key={c} className={`size-2.5 rounded-[0.2rem] ${c}`} />
          ))}
        </div>
      </div>
    </footer>
  );
}
