import { useEffect } from "react";
import { useLocation } from "react-router";
import { Audiences } from "@/components/marketing/Audiences";
import { DemoRequest } from "@/components/marketing/DemoRequest";
import { Faq } from "@/components/marketing/Faq";
import { Features } from "@/components/marketing/Features";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { Pricing } from "@/components/marketing/Pricing";
import { RoutingDemo } from "@/components/marketing/RoutingDemo";
import { scrollToSection, sectionIdFromHash } from "@/components/marketing/sections";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Arabic-first public landing page. Section order follows the header links. */
export default function HomePage() {
  const { t } = useI18n();
  useDocumentTitle(t("marketing.metaTitle"));
  useScrollToHash();

  return (
    <MarketingLayout onHome>
      <Hero />
      <Features />
      <HowItWorks />
      <Audiences />
      <RoutingDemo />
      <Pricing />
      <Faq />
      <DemoRequest />
      <FinalCta />
    </MarketingLayout>
  );
}

/** Arriving at "/#pricing" (e.g. from a legal page) jumps to that section. */
function useScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    const id = sectionIdFromHash(hash);
    if (!id) return;
    const frame = window.requestAnimationFrame(() => {
      // An arrival, not a scroll within the page: jump without animating.
      scrollToSection(id, { reduced: true, updateHash: false });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash]);
}
