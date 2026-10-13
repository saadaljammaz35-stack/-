import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { Section } from "./Section";
import { SectionLink } from "./SectionLink";
import { container, mkButton } from "./styles";

export function FinalCta() {
  const { t } = useI18n();
  return (
    <Section id="start" labelledBy="final-title" className="pb-16 sm:pb-24">
      <div className={container}>
        <div className="mk-on-dark relative isolate overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-center sm:px-12 sm:py-20">
          <div
            className="mk-live mk-live--drift absolute -bottom-1/2 start-[-10%] -z-10 aspect-square w-[70%] rounded-full bg-[radial-gradient(closest-side,rgb(16_185_129/0.28),rgb(16_185_129/0))]"
            aria-hidden="true"
          />
          <h2
            id="final-title"
            tabIndex={-1}
            data-focus-target=""
            className="mx-auto max-w-[20ch] text-[1.75rem] leading-tight font-extrabold text-balance text-white sm:text-4xl"
          >
            {t("marketing.finalTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-lg text-white/85">
            {t("marketing.finalText")}
          </p>
          <div className={cn("mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row")}>
            <Link to="/register" className={mkButton("cta", "lg", "w-full sm:w-auto")}>
              {t("marketing.finalCta")}
              <ArrowRight className="flip-rtl size-5" aria-hidden="true" />
            </Link>
            <SectionLink to="contact" className={mkButton("on-dark", "lg", "w-full sm:w-auto")}>
              {t("marketing.heroCtaDemo")}
            </SectionLink>
          </div>
        </div>
      </div>
    </Section>
  );
}
