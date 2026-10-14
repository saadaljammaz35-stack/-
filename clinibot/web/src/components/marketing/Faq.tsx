import { ChevronDown } from "lucide-react";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { revealStyle } from "./motion";
import { Reveal } from "./Reveal";
import { Section, SectionHeading } from "./Section";
import { SectionLink } from "./SectionLink";
import { container, inlineLink } from "./styles";

const QUESTIONS: ReadonlyArray<{ q: MessageKey; a: MessageKey }> = [
  { q: "marketing.faq1Q", a: "marketing.faq1A" },
  { q: "marketing.faq2Q", a: "marketing.faq2A" },
  { q: "marketing.faq3Q", a: "marketing.faq3A" },
  { q: "marketing.faq4Q", a: "marketing.faq4A" },
  { q: "marketing.faq5Q", a: "marketing.faq5A" },
  { q: "marketing.faq6Q", a: "marketing.faq6A" },
  { q: "marketing.faq7Q", a: "marketing.faq7A" },
  { q: "marketing.faq8Q", a: "marketing.faq8A" },
];

/** Native <details> disclosures: keyboard and screen-reader support for free. */
export function Faq() {
  const { t, tRich } = useI18n();
  return (
    <Section id="faq" labelledBy="faq-title" className="py-16 sm:py-24">
      <div className={cn(container, "flex flex-col items-center")}>
        <SectionHeading
          id="faq-title"
          align="center"
          kicker={t("marketing.faqKicker")}
          title={t("marketing.faqTitle")}
        />

        <Reveal
          items={QUESTIONS.length}
          className="mk-faq mt-10 flex w-full max-w-3xl flex-col gap-3"
        >
          {QUESTIONS.map(({ q, a }, index) => (
            <details
              key={q}
              data-reveal=""
              style={revealStyle(index)}
              className="group rounded-2xl bg-white/90 ring-1 ring-slate-200 open:ring-navy-200"
            >
              <summary className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl px-5 py-3 text-start text-base font-bold text-slate-900 sm:text-lg">
                <span className="flex-1">{t(q)}</span>
                <ChevronDown
                  className="mk-faq__chevron size-5 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
              </summary>
              <div className="mk-faq__answer px-5 pb-5">
                <p className="max-w-[65ch] leading-relaxed text-slate-700">{t(a)}</p>
              </div>
            </details>
          ))}
        </Reveal>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2.5 text-center text-slate-700">
          <span className="relative flex size-2" aria-hidden="true">
            <span className="mk-live mk-live--pulse absolute inset-0 rounded-full bg-accent" />
            <span className="relative size-2 rounded-full bg-accent" />
          </span>
          <span>
            {tRich("marketing.faqMore", {
              link: (
                <SectionLink
                  to="contact"
                  className={cn(inlineLink, "inline-flex min-h-11 items-center")}
                >
                  {t("marketing.faqMoreLink")}
                </SectionLink>
              ),
            })}
          </span>
        </p>
      </div>
    </Section>
  );
}
