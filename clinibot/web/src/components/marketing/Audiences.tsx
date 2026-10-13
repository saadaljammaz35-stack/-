import type { LucideIcon } from "lucide-react";
import { Building2, HeartPulse, Smile, Sparkles, Stethoscope } from "lucide-react";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { revealStyle } from "./motion";
import { Reveal } from "./Reveal";
import { Section, SectionHeading } from "./Section";
import { container } from "./styles";

// Audiences the product is designed for. These are not customers.
const AUDIENCES: ReadonlyArray<{ icon: LucideIcon; name: MessageKey; note: MessageKey }> = [
  { icon: Smile, name: "marketing.audDental", note: "marketing.audDentalNote" },
  { icon: HeartPulse, name: "marketing.audDerma", note: "marketing.audDermaNote" },
  { icon: Sparkles, name: "marketing.audCosmetic", note: "marketing.audCosmeticNote" },
  { icon: Stethoscope, name: "marketing.audGeneral", note: "marketing.audGeneralNote" },
  { icon: Building2, name: "marketing.audCenters", note: "marketing.audCentersNote" },
];

export function Audiences() {
  const { t } = useI18n();
  return (
    <Section id="clinics" labelledBy="audiences-title" className="py-6 sm:py-10">
      <div className={container}>
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-mint px-5 py-12 sm:px-10 sm:py-16">
          <div
            className="mk-live mk-live--drift absolute -top-1/3 end-[-12%] -z-10 aspect-square w-[60%] rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.75),rgb(255_255_255/0))]"
            aria-hidden="true"
          />
          <SectionHeading
            id="audiences-title"
            align="center"
            kicker={t("marketing.audKicker")}
            title={t("marketing.audTitle")}
            intro={t("marketing.audIntro")}
            className="mx-auto"
          />
          <Reveal
            as="ul"
            items={AUDIENCES.length}
            className="mt-10 flex flex-wrap justify-center gap-3"
          >
            {AUDIENCES.map(({ icon: Icon, name, note }, index) => (
              <li
                key={name}
                data-reveal=""
                style={revealStyle(index)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl bg-white/85 p-4 ring-1 ring-emerald-100",
                  "sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)]",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint text-accent-strong">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-slate-900">{t(name)}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-600">
                    {t(note)}
                  </span>
                </span>
              </li>
            ))}
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
