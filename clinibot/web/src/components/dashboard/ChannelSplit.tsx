import { Globe, MessageCircle } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { CHART } from "./chartColors";

export interface ChannelSplitProps {
  web: number;
  whatsapp: number;
  busy?: boolean;
}

/**
 * Conversations by channel: a two-part bar (part-to-whole) with a legend that
 * carries every number, so nothing depends on colour or hover alone.
 */
export function ChannelSplit({ web, whatsapp, busy = false }: ChannelSplitProps) {
  const { t, formatNumber } = useI18n();
  const total = web + whatsapp;
  const rows = [
    { key: "web", label: t("dashboard.channelWeb"), value: web, color: CHART.series1, Icon: Globe },
    {
      key: "whatsapp",
      label: t("dashboard.channelWhatsapp"),
      value: whatsapp,
      color: CHART.series2,
      Icon: MessageCircle,
    },
  ];
  const percent = (value: number) =>
    formatNumber(total > 0 ? value / total : 0, { style: "percent", maximumFractionDigits: 0 });

  return (
    <div className={cn("transition-opacity", busy && "opacity-55")} aria-busy={busy || undefined}>
      {total > 0 ? (
        // Segments sit side by side with a 2px gap; the order follows the reading direction.
        <div className="flex h-3 w-full gap-0.5" aria-hidden="true">
          {rows
            .filter((row) => row.value > 0)
            .map((row) => (
              <div
                key={row.key}
                className="h-full rounded"
                style={{ flexGrow: row.value, flexBasis: 0, backgroundColor: row.color }}
              />
            ))}
        </div>
      ) : (
        <p className="text-sm text-slate-600">{t("dashboard.channelEmpty")}</p>
      )}
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3">
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: row.color }}
              aria-hidden="true"
            />
            <row.Icon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm text-slate-700">{row.label}</span>
            <span className="text-sm font-extrabold text-slate-900 tabular-nums">
              {formatNumber(row.value)}
            </span>
            <span className="w-12 text-end text-xs text-slate-500 tabular-nums">
              {total > 0 ? percent(row.value) : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
