import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { contactEmail } from "./demoRequest";
import { MarketingLayout } from "./MarketingLayout";
import { useReducedMotion } from "./motion";
import { scrollToSection } from "./sections";
import { container, inlineLink } from "./styles";

export type LegalBlock =
  | { kind: "p"; key: MessageKey }
  | { kind: "list"; intro?: MessageKey; keys: readonly MessageKey[] }
  /** A paragraph whose {privacy} placeholder links to the privacy policy. */
  | { kind: "privacyRef"; key: MessageKey }
  /** {email} when VITE_CONTACT_EMAIL is set, otherwise {form} linking to the contact form. */
  | { kind: "contact"; emailKey: MessageKey; formKey: MessageKey };

export interface LegalSection {
  id: string;
  title: MessageKey;
  blocks: readonly LegalBlock[];
}

interface LegalDocumentProps {
  title: MessageKey;
  intro: MessageKey;
  /** ISO date of the last change, e.g. "2026-10-12". */
  updated: string;
  sections: readonly LegalSection[];
  /** The other legal page, linked at the end. */
  related: { to: string; label: MessageKey; sentence: MessageKey };
}

/** Long-form layout for the privacy policy and terms: title, date, contents, numbered sections. */
export function LegalDocument({ title, intro, updated, sections, related }: LegalDocumentProps) {
  const { t, tRich, formatDate } = useI18n();
  const reduced = useReducedMotion();

  function jump(id: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (scrollToSection(id, { reduced })) event.preventDefault();
    };
  }

  return (
    <MarketingLayout>
      <article className={cn(container, "py-10 sm:py-16")} aria-labelledby="legal-title">
        <header className="max-w-3xl">
          <h1
            id="legal-title"
            tabIndex={-1}
            data-focus-target=""
            className="text-[2rem] leading-tight font-extrabold text-slate-900 sm:text-5xl"
          >
            {t(title)}
          </h1>
          <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-slate-600">{t(intro)}</p>
          <p className="mt-4 text-sm font-bold text-slate-700">
            {tRich("legal.lastUpdated", {
              date: (
                <time dateTime={updated}>
                  {formatDate(updated, { day: "numeric", month: "long", year: "numeric" })}
                </time>
              ),
            })}
          </p>
          <p className="mt-2 max-w-[60ch] text-sm text-slate-600">{t("legal.languageNote")}</p>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14">
          <nav
            id="toc"
            aria-labelledby="toc-title"
            className="mk-anchor rounded-2xl bg-white/80 p-5 ring-1 ring-slate-200 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto"
          >
            <h2
              id="toc-title"
              tabIndex={-1}
              data-focus-target=""
              className="font-bold text-slate-900"
            >
              {t("legal.tocTitle")}
            </h2>
            <ol className="mt-3 flex flex-col">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={jump(section.id)}
                    className="mk-link flex min-h-11 items-center gap-2 rounded-lg py-1.5 text-[0.9375rem] leading-snug text-slate-700"
                  >
                    <span className="w-6 shrink-0 font-bold text-slate-500" aria-hidden="true">
                      {index + 1}.
                    </span>
                    <span>{t(section.title)}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className="mk-anchor border-t border-slate-200 py-8 first:border-t-0 first:pt-0"
              >
                <h2
                  id={`${section.id}-title`}
                  tabIndex={-1}
                  data-focus-target=""
                  className="text-xl leading-snug font-extrabold text-slate-900 sm:text-2xl"
                >
                  <span className="text-slate-500">{index + 1}. </span>
                  {t(section.title)}
                </h2>
                <div className="mt-4 flex flex-col gap-4 text-base leading-[1.85] text-slate-700">
                  {section.blocks.map((block, blockIndex) => (
                    <Block key={blockIndex} block={block} />
                  ))}
                </div>
                <a
                  href="#toc"
                  onClick={jump("toc")}
                  className="mk-link mt-4 inline-flex min-h-11 items-center text-sm font-bold text-primary"
                >
                  {t("legal.backToTop")}
                </a>
              </section>
            ))}

            <p className="mt-4 border-t border-slate-200 pt-6 text-slate-700">
              {tRich(related.sentence, {
                link: (
                  <Link
                    to={related.to}
                    className={cn(inlineLink, "inline-flex min-h-11 items-center")}
                  >
                    {t(related.label)}
                  </Link>
                ),
              })}
            </p>
          </div>
        </div>
      </article>
    </MarketingLayout>
  );
}

function Block({ block }: { block: LegalBlock }): ReactNode {
  const { t, tRich } = useI18n();
  const measure = "max-w-[68ch]";
  switch (block.kind) {
    case "p":
      return <p className={measure}>{t(block.key)}</p>;
    case "list":
      return (
        <div className={measure}>
          {block.intro && <p>{t(block.intro)}</p>}
          <ul
            className={cn(
              "flex list-disc flex-col gap-2 ps-6 marker:text-accent-strong",
              block.intro && "mt-2",
            )}
          >
            {block.keys.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      );
    case "privacyRef":
      return (
        <p className={measure}>
          {tRich(block.key, {
            privacy: (
              <Link to="/privacy" className={inlineLink}>
                {t("legal.privacyTitle")}
              </Link>
            ),
          })}
        </p>
      );
    case "contact": {
      const email = contactEmail();
      return (
        <p className={measure}>
          {email
            ? tRich(block.emailKey, {
                email: (
                  <a href={`mailto:${email}`} className={inlineLink} dir="ltr">
                    {email}
                  </a>
                ),
              })
            : tRich(block.formKey, {
                form: (
                  <Link to={{ pathname: "/", hash: "#contact" }} className={inlineLink}>
                    {t("legal.contactFormLink")}
                  </Link>
                ),
              })}
        </p>
      );
    }
  }
}
