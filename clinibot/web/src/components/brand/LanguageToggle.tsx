import { Languages } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";

export interface LanguageToggleProps {
  /** "inverse" for navy backgrounds. */
  tone?: "default" | "inverse";
  /** Icon only (the label is still read by screen readers). */
  compact?: boolean;
  className?: string;
}

/** Switches between العربية and English; the button names the language you switch TO. */
export function LanguageToggle({
  tone = "default",
  compact = false,
  className,
}: LanguageToggleProps) {
  const { lang, setLang, t } = useI18n();
  const next = lang === "ar" ? "en" : "ar";
  const nextLabel = next === "ar" ? "العربية" : "English";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors",
        tone === "inverse"
          ? "text-white/90 hover:bg-white/10 hover:text-white"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        compact && "w-11 px-0",
        className,
      )}
      title={t("common.changeLanguage")}
    >
      <Languages className="size-5 shrink-0" aria-hidden="true" />
      <span lang={next} className={cn(compact && "sr-only")}>
        {nextLabel}
      </span>
    </button>
  );
}
