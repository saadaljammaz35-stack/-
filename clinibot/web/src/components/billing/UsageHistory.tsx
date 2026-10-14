import { ChartNoAxesColumn } from "lucide-react";
import { QueryError } from "@/components/layout/QueryError";
import { Card, CardHeader, DataList, EmptyState, type DataColumn } from "@/components/ui";
import { useI18n } from "@/i18n";

export interface UsageRow {
  month: string;
  replies: number;
  test_replies: number;
  input_tokens: number;
  output_tokens: number;
}

interface UsageHistoryProps {
  rows: readonly UsageRow[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

/** ai_usage_monthly, newest month first. */
export function UsageHistory({ rows, loading, error, onRetry }: UsageHistoryProps) {
  const { t, formatDate, formatNumber } = useI18n();

  const columns: DataColumn<UsageRow>[] = [
    {
      key: "month",
      header: t("billing.colMonth"),
      primary: true,
      cell: (row) => formatDate(row.month, { month: "long", year: "numeric" }),
    },
    {
      key: "replies",
      header: t("billing.colReplies"),
      cell: (row) => <span className="tabular-nums">{formatNumber(row.replies)}</span>,
    },
    {
      key: "test",
      header: t("billing.colTestReplies"),
      cell: (row) => <span className="tabular-nums">{formatNumber(row.test_replies)}</span>,
    },
    {
      key: "input",
      header: t("billing.colInputTokens"),
      cell: (row) => <span className="tabular-nums">{formatNumber(row.input_tokens)}</span>,
    },
    {
      key: "output",
      header: t("billing.colOutputTokens"),
      cell: (row) => <span className="tabular-nums">{formatNumber(row.output_tokens)}</span>,
    },
  ];

  return (
    <Card as="section" aria-labelledby="usage-history-title">
      <CardHeader
        title={<span id="usage-history-title">{t("billing.historyTitle")}</span>}
        description={t("billing.historyDescription")}
      />
      {error ? (
        <div className="p-5 sm:p-6">
          <QueryError error={error} onRetry={onRetry} />
        </div>
      ) : (
        <DataList
          items={rows ?? []}
          columns={columns}
          getKey={(row) => row.month}
          caption={t("billing.historyCaption")}
          loading={loading}
          empty={
            <EmptyState
              icon={ChartNoAxesColumn}
              title={t("billing.historyEmptyTitle")}
              text={t("billing.historyEmptyText")}
            />
          }
        />
      )}
    </Card>
  );
}
