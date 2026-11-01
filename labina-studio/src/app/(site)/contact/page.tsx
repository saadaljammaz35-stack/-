import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getSiteData } from "@/lib/data/public";
import { PageHeader } from "@/components/site/PageHeader";
import { ContactForm } from "@/components/site/ContactForm";
import { HoursList } from "@/components/site/HoursList";
import { SocialIcon, socialLinks } from "@/components/site/SocialIcons";
import { Reveal } from "@/components/ui/Motion";
import { phoneHref, whatsappHref } from "@/lib/format";

export const metadata: Metadata = {
  title: "تواصل معنا",
  description: "تواصل مع استوديو لَبِنة للاستفسار عن الجلسات والحجوزات.",
};

export default async function ContactPage() {
  const { contact, hours, connected } = await getSiteData();
  const location = [contact.address, contact.city].filter(Boolean).join("، ");
  const socials = socialLinks(contact).filter((s) => s.name !== "whatsapp");

  const cards = [
    contact.phone && { icon: Phone, label: "اتصل بنا", value: contact.phone, href: `tel:${phoneHref(contact.phone)}`, color: "bg-coral", ltr: true },
    contact.whatsapp && { icon: MessageCircle, label: "واتساب", value: contact.whatsapp, href: whatsappHref(contact.whatsapp), color: "bg-teal", ltr: true },
    contact.email && { icon: Mail, label: "البريد الإلكتروني", value: contact.email, href: `mailto:${contact.email}`, color: "bg-sun", ltr: true },
    location && { icon: MapPin, label: "موقعنا", value: location, href: contact.map_url || undefined, color: "bg-lavender", ltr: false },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string; color: string; ltr: boolean }[];

  return (
    <>
      <PageHeader eyebrow="تواصل معنا" title="يسعدنا أن نسمع منكم" text="اسألونا عن الجلسات أو المواعيد أو أي فكرة تحبون تنفيذها." />
      <div className="container-x grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          {cards.length > 0 && (
            <Reveal className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {cards.map((c) => {
                const inner = (
                  <>
                    <span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-ink ${c.color}`}>
                      <c.icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-ink-soft">{c.label}</span>
                      <span className="block break-words font-semibold text-plum" dir={c.ltr ? "ltr" : undefined}>{c.value}</span>
                    </span>
                  </>
                );
                return c.href ? (
                  <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-4 rounded-3xl bg-paper p-4 shadow-soft transition-transform hover:-translate-y-0.5">
                    {inner}
                  </a>
                ) : (
                  <div key={c.label} className="flex items-center gap-4 rounded-3xl bg-paper p-4 shadow-soft">{inner}</div>
                );
              })}
            </Reveal>
          )}
          <Reveal className="rounded-[1.75rem] bg-plum p-6 text-cream md:p-7">
            <h2 className="mb-3 font-display text-lg font-semibold text-sun">ساعات العمل</h2>
            <HoursList hours={hours} light />
          </Reveal>
          {socials.length > 0 && (
            <Reveal className="rounded-[1.75rem] bg-paper p-6 shadow-soft">
              <h2 className="mb-4 font-display text-lg font-semibold text-plum">تابعونا</h2>
              <ul className="flex flex-wrap gap-2">
                {socials.map((s) => (
                  <li key={s.name}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-cream px-4 py-2.5 font-medium text-plum hover:bg-cream-2">
                      <SocialIcon name={s.name} /> {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>
        <Reveal className="lg:col-span-7" delay={0.1}>
          <ContactForm connected={connected} />
        </Reveal>
      </div>
    </>
  );
}
