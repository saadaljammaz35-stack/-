import type { LucideIcon } from "lucide-react";
import {
  BookCheck,
  CalendarClock,
  ChartColumn,
  Headset,
  Languages,
  MessageCircle,
} from "lucide-react";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { revealStyle } from "./motion";
import { Reveal } from "./Reveal";
import { Section, SectionHeading } from "./Section";
import { container } from "./styles";

const FEATURES: ReadonlyArray<{ icon: LucideIcon; title: MessageKey; text: MessageKey }> = [
  { icon: Languages, title: "marketing.feature1Title", text: "marketing.feature1Text" },
  { icon: MessageCircle, title: "marketing.feature2Title", text: "marketing.feature2Text" },
  { icon: BookCheck, title: "marketing.feature3Title", text: "marketing.feature3Text" },
  { icon: CalendarClock, title: "marketing.feature4Title", text: "marketing.feature4Text" },
  { icon: Headset, title: "marketing.feature5Title", text: "marketing.feature5Text" },
  { icon: ChartColumn, title: "marketing.feature6Title", text: "marketing.feature6Text" },
];

/** The feature whose icon carries the section's one living element. */
const LIVING_INDEX = 2;

export function Features() {
  const { t } = useI18n();
  return (
    <Section id="features" labelledBy="features-title" className="py-16 sm:py-24">
      <div className={container}>
        <SectionHeading
          id="features-title"
          kicker={t("marketing.featuresKicker")}
          title={t("marketing.featuresTitle")}
          intro={t("marketing.featuresIntro")}
        />

        <Reveal
          as="ul"
          items={FEATURES.length}
          className="mt-12 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              data-reveal=""
              style={revealStyle(index)}
              className="flex gap-4 border-t border-slate-200 py-7"
            >
              <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-card ring-1 ring-slate-200/70">
                {index === LIVING_INDEX && (
                  <span
                    className="mk-live mk-live--breathe absolute inset-0 rounded-xl bg-mint"
                    aria-hidden="true"
                  />
                )}
                <Icon className={cn("relative size-5")} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg leading-snug font-bold text-slate-900">{t(title)}</h3>
                <p className="mt-2 max-w-[40ch] leading-relaxed text-slate-600">{t(text)}</p>
              </div>
            </li>
          ))}
        </Reveal>
      </div>
    </Section>
  );
}
