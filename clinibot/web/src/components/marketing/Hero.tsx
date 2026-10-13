import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { revealStyle } from "./motion";
import { PhoneMock } from "./PhoneMock";
import { Reveal } from "./Reveal";
import { Section } from "./Section";
import { SectionLink } from "./SectionLink";
import { container, mkButton } from "./styles";

const POINTS: readonly MessageKey[] = [
  "marketing.heroPoint1",
  "marketing.heroPoint2",
  "marketing.heroPoint3",
];

export function Hero() {
  const { t, tRich } = useI18n();

  const emphasis = (
    <span className="relative inline-block whitespace-nowrap text-accent-hover">
      {t("marketing.heroTitleEmphasis")}
      <svg
        className="absolute inset-x-0 -bottom-2 h-3 w-full"
        viewBox="0 0 200 12"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M3 8.5C48 3.5 120 2.5 197 7"
          fill="none"
          stroke="#10B981"
          strokeOpacity="0.55"
          strokeWidth="4"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );

  return (
    <Section id="home" labelledBy="hero-title" className="pt-8 pb-16 sm:pt-14 lg:pt-20 lg:pb-24">
      <div
        className={cn(
          container,
          "grid items-center gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-16",
        )}
      >
        <Reveal items={5} className="flex min-w-0 flex-col items-start gap-6">
          <p
            data-reveal=""
            style={revealStyle(0)}
            className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-bold text-primary ring-1 ring-navy-100"
          >
            <Sparkles className="size-4 text-accent-hover" aria-hidden="true" />
            {t("marketing.heroBadge")}
          </p>

          <h1
            id="hero-title"
            tabIndex={-1}
            data-focus-target=""
            data-reveal=""
            style={revealStyle(1)}
            className="max-w-[15ch] text-[2.375rem] leading-[1.2] font-extrabold text-balance text-slate-900 sm:text-5xl lg:text-[3.5rem]"
          >
            {tRich("marketing.heroTitle", { clinic: emphasis })}
          </h1>

          <p
            data-reveal=""
            style={revealStyle(2)}
            className="max-w-[52ch] text-lg leading-relaxed text-slate-600"
          >
            {t("marketing.heroSubtitle")}
          </p>

          <div
            data-reveal=""
            style={revealStyle(3)}
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
          >
            <Link to="/register" className={mkButton("cta", "lg", "w-full sm:w-auto")}>
              {t("marketing.ctaStart")}
              <ArrowRight className="flip-rtl size-5" aria-hidden="true" />
            </Link>
            <SectionLink to="contact" className={mkButton("quiet", "lg", "w-full sm:w-auto")}>
              {t("marketing.heroCtaDemo")}
            </SectionLink>
          </div>

          <ul
            data-reveal=""
            style={revealStyle(4)}
            aria-label={t("marketing.heroPointsLabel")}
            className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:gap-x-6"
          >
            {POINTS.map((point) => (
              <li
                key={point}
                className="flex items-center gap-2 text-[0.9375rem] font-medium text-slate-700"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mint">
                  <Check
                    className="size-3.5 text-accent-strong"
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                </span>
                {t(point)}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal items={1}>
          <div data-reveal="" style={revealStyle(1)}>
            <PhoneMock />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
