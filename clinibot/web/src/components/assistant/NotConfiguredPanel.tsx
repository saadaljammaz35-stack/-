import { useId } from "react";
import { KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n";

/**
 * Shown when the server has no ANTHROPIC_API_KEY. The clinic cannot fix this
 * itself: the platform operator adds the secret, then the clinic runs a test.
 */
export function NotConfiguredPanel({
  onRefresh,
  refreshing = false,
  headingLevel = 2,
}: {
  onRefresh?: () => void;
  refreshing?: boolean;
  headingLevel?: 2 | 3;
}) {
  const { t, tRich } = useI18n();
  const titleId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const code = (text: string) => (
    <code
      dir="ltr"
      className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-[0.8125rem] font-bold text-slate-900"
    >
      {text}
    </code>
  );

  return (
    <section
      className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-5 text-amber-950 sm:px-6"
      aria-labelledby={titleId}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <Heading id={titleId} className="text-lg font-extrabold">
            {t("assistant.notConfiguredTitle")}
          </Heading>
          <p className="mt-1 text-sm leading-relaxed">{t("assistant.notConfiguredText")}</p>
        </div>
      </div>

      <ol className="mt-4 flex list-decimal flex-col gap-2 ps-6 text-sm leading-relaxed marker:font-bold">
        <li>
          {tRich("assistant.notConfiguredStep1", {
            secret: code("ANTHROPIC_API_KEY"),
            path: <strong>{t("assistant.notConfiguredPath")}</strong>,
          })}
        </li>
        <li>{tRich("assistant.notConfiguredStep2", { doc: code("docs/DEPLOYMENT.md") })}</li>
        <li>{t("assistant.notConfiguredStep3")}</li>
        <li>{t("assistant.notConfiguredStep4")}</li>
      </ol>

      <p className="mt-4 text-[0.8125rem] leading-relaxed">
        {t("assistant.notConfiguredMeanwhile")}
      </p>

      {onRefresh && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            loading={refreshing}
            icon={<RefreshCw className="size-4" aria-hidden="true" />}
          >
            {t("assistant.refreshStatus")}
          </Button>
        </div>
      )}
    </section>
  );
}
