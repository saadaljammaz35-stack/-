import type { ContactSettings } from "@/lib/settings";
import { whatsappHref } from "@/lib/format";

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ICONS: Record<string, React.ReactNode> = {
  instagram: (
    <>
      <rect {...s} x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle {...s} cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </>
  ),
  tiktok: <path {...s} d="M14 3.5v11a3.5 3.5 0 1 1-3.5-3.5M14 3.5c.4 2.6 2.1 4.3 4.8 4.6" />,
  snapchat: (
    <path {...s} d="M12 3.6c-3 0-5 2.2-5 5v2.2l-1.8.5c.4 1 1.3 1.4 1.9 1.6-.6 1.6-1.8 2.8-3.4 3.4.6.8 1.8.9 2.6 1 .2.8.6 1.3 1.6 1.2 1.2-.1 2 .9 4.1.9s2.9-1 4.1-.9c1 .1 1.4-.4 1.6-1.2.8-.1 2-.2 2.6-1-1.6-.6-2.8-1.8-3.4-3.4.6-.2 1.5-.6 1.9-1.6l-1.8-.5V8.6c0-2.8-2-5-5-5z" />
  ),
  x: <path {...s} d="M4.5 4.5l15 15M19.5 4.5l-15 15" />,
  youtube: (
    <>
      <rect {...s} x="2.8" y="5.8" width="18.4" height="12.4" rx="4" />
      <path d="M10.2 9.4v5.2l4.6-2.6z" fill="currentColor" />
    </>
  ),
  facebook: <path {...s} d="M14.5 7.5h2V4.2h-2.4c-2.4 0-3.8 1.5-3.8 4v2.1H8v3.2h2.3v6.3h3.3v-6.3h2.4l.4-3.2h-2.8V8.6c0-.7.3-1.1.9-1.1z" />,
  whatsapp: (
    <>
      <path {...s} d="M4.5 19.5l1.2-3.6A8 8 0 1 1 8.6 18.6z" />
      <path {...s} d="M9.3 8.8c.2 2.6 2.4 4.9 5 5.2l1-1.2-1.6-.9-.7.6c-1-.4-1.8-1.2-2.2-2.2l.6-.7-.9-1.6z" />
    </>
  ),
};

const LABELS: Record<string, string> = {
  instagram: "إنستغرام",
  tiktok: "تيك توك",
  snapchat: "سناب شات",
  x: "إكس",
  youtube: "يوتيوب",
  facebook: "فيسبوك",
  whatsapp: "واتساب",
};

export function SocialIcon({ name, className = "size-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

/** Builds the list of social links that are actually filled in */
export function socialLinks(contact: ContactSettings) {
  const links: { name: string; label: string; href: string }[] = [];
  for (const key of ["instagram", "tiktok", "snapchat", "x", "youtube", "facebook"] as const) {
    const value = contact[key];
    if (value) links.push({ name: key, label: LABELS[key], href: value.startsWith("http") ? value : `https://${value}` });
  }
  if (contact.whatsapp) links.push({ name: "whatsapp", label: LABELS.whatsapp, href: whatsappHref(contact.whatsapp) });
  return links;
}
