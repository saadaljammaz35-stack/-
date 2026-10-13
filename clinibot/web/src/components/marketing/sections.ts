import type { MessageKey } from "@/i18n";

/** Landing-page sections linked from the header, in page order. */
export const NAV_SECTIONS = [
  { id: "home", label: "marketing.navHome" },
  { id: "features", label: "marketing.navFeatures" },
  { id: "how-it-works", label: "marketing.navHowItWorks" },
  { id: "pricing", label: "marketing.navPricing" },
  { id: "faq", label: "marketing.navFaq" },
  { id: "contact", label: "marketing.navContact" },
] as const satisfies ReadonlyArray<{ id: string; label: MessageKey }>;

export type SectionId = (typeof NAV_SECTIONS)[number]["id"];

/** "#pricing" → "pricing"; anything that is not a plain fragment id → null. */
export function sectionIdFromHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const id = decodeURIComponentSafe(hash.replace(/^#/, ""));
  return /^[A-Za-z][\w-]{0,63}$/.test(id) ? id : null;
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Scrolls to an in-page section (smoothly unless motion is reduced), moves
 * keyboard focus to its heading so screen readers follow, and records the
 * fragment in the address bar without adding a history entry.
 */
export function scrollToSection(
  id: string,
  {
    reduced,
    focus = true,
    updateHash = true,
  }: { reduced: boolean; focus?: boolean; updateHash?: boolean },
): boolean {
  const target = document.getElementById(id);
  if (!target) return false;
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }
  if (focus) {
    const heading =
      target.querySelector<HTMLElement>("[data-focus-target]") ??
      (target.hasAttribute("data-focus-target") ? target : null);
    heading?.focus({ preventScroll: true });
  }
  if (updateHash && window.location.hash !== `#${id}`) {
    // Keep React Router's state object so its history bookkeeping stays intact.
    window.history.replaceState(window.history.state, "", `#${id}`);
  }
  return true;
}
