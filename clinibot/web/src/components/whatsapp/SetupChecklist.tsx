import { ChevronDown, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n, type MessageKey } from "@/i18n";

const STEPS: ReadonlyArray<{ title: MessageKey; text: MessageKey }> = [
  { title: "whatsapp.checkPortfolio", text: "whatsapp.checkPortfolioText" },
  { title: "whatsapp.checkNumber", text: "whatsapp.checkNumberText" },
  { title: "whatsapp.checkDisplayName", text: "whatsapp.checkDisplayNameText" },
  { title: "whatsapp.checkApp", text: "whatsapp.checkAppText" },
  { title: "whatsapp.checkIds", text: "whatsapp.checkIdsText" },
  { title: "whatsapp.checkToken", text: "whatsapp.checkTokenText" },
  { title: "whatsapp.checkSecret", text: "whatsapp.checkSecretText" },
];

function External({ href, children }: { href: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-bold text-primary underline underline-offset-2"
    >
      <span dir="ltr">{children}</span>
      <ExternalLink className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{t("common.opensInNewTab")}</span>
    </a>
  );
}

/**
 * What the clinic needs from Meta before connecting (condensed from
 * docs/WHATSAPP-SETUP.md). Collapsible; open by default until connected.
 */
export function SetupChecklist({ defaultOpen }: { defaultOpen: boolean }) {
  const { t, tRich } = useI18n();
  const links = {
    business: <External href="https://business.facebook.com">business.facebook.com</External>,
    developers: (
      <External href="https://developers.facebook.com/apps">developers.facebook.com/apps</External>
    ),
  };

  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-slate-200 bg-white shadow-card"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-3 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-base font-extrabold text-slate-900">
            {t("whatsapp.checklistTitle")}
          </span>
          <span className="mt-0.5 block text-sm text-slate-600">
            {t("whatsapp.checklistDescription")}
          </span>
        </span>
        <ChevronDown
          className="size-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
        <p className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-950">
          {t("whatsapp.checklistOfficialOnly")}
        </p>
        <ol className="flex flex-col gap-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-extrabold text-primary"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="min-w-0 text-sm leading-relaxed">
                <p className="font-bold text-slate-900">{t(step.title)}</p>
                <p className="mt-0.5 text-slate-700">{tRich(step.text, links)}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-slate-600">
          {tRich("whatsapp.checklistCosts", {
            doc: (
              <code dir="ltr" className="font-mono">
                docs/WHATSAPP-SETUP.md
              </code>
            ),
          })}
        </p>
      </div>
    </details>
  );
}
