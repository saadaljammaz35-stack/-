import { useParams } from "react-router";
import { LanguageToggle } from "@/components/brand/LanguageToggle";
import { LogoMark } from "@/components/brand/Logo";
import { useI18n } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/**
 * Placeholder for the patient web chat at /c/:slug. Replace this file; it
 * talks to the `public-chat` Edge Function (docs/API.md) via callFunction().
 */
export default function PatientChatPage() {
  const { t } = useI18n();
  const { slug = "" } = useParams();
  useDocumentTitle(t("chat.title"));
  return (
    <div className="flex min-h-dvh flex-col bg-canvas pt-safe pb-safe">
      <header className="flex min-h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4">
        <span dir="ltr" className="truncate font-mono text-sm text-slate-500">
          /c/{slug}
        </span>
        <LanguageToggle compact />
      </header>
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <LogoMark size={56} title="" />
        <h1 className="mt-5 text-2xl font-extrabold text-slate-900">{t("chat.title")}</h1>
        <p className="mt-2 max-w-sm leading-relaxed text-slate-600">{t("chat.description")}</p>
        <p className="mt-8 text-xs text-slate-400">{t("chat.poweredBy")}</p>
      </main>
    </div>
  );
}
