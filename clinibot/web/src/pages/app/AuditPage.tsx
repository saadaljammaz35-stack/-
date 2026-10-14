import { useMemo } from "react";
import { ScrollText, ShieldAlert } from "lucide-react";
import { Navigate, Route, Routes, useSearchParams } from "react-router";
import {
  AUDIT_CATEGORIES,
  auditActionLabel,
  auditActor,
  auditDetails,
  isAuditCategory,
  type AuditCategory,
} from "@/components/audit/actions";
import { AuditDetails } from "@/components/audit/AuditDetails";
import { useAuditLog } from "@/components/audit/queries";
import { QueryError } from "@/components/layout/QueryError";
import { displayName, useTeamMembers } from "@/components/staff/queries";
import {
  Alert,
  Button,
  Card,
  DataList,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Skeleton,
  type DataColumn,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import type { Json } from "@/lib/database.types";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { canManage } from "@/org/roles";
import { useCurrentOrg } from "@/org/useOrg";

/** /app/audit (owners and admins): who changed what in the clinic, newest first. */
export default function AuditPage() {
  return (
    <Routes>
      <Route index element={<AuditLogPage />} />
      <Route path="*" element={<Navigate to="/app/audit" replace />} />
    </Routes>
  );
}

interface AuditEntry {
  id: number;
  created_at: string;
  actor_type: string;
  actor_user_id: string | null;
  action: string;
  details: Json;
}

function AuditLogPage() {
  const { t, formatDate, formatNumber } = useI18n();
  const org = useCurrentOrg();
  useDocumentTitle(t("audit.title"));
  const [params, setParams] = useSearchParams();
  const rawCategory = params.get("type");
  const category: AuditCategory | "all" = isAuditCategory(rawCategory) ? rawCategory : "all";
  const allowed = canManage(org.role);

  const log = useAuditLog(org.id, category, allowed);
  const members = useTeamMembers(org.id);
  // null until the team list is available, so nobody is shown as a former member by mistake.
  const names = useMemo(
    () =>
      members.data
        ? new Map(members.data.map((member) => [member.user_id, displayName(member)]))
        : null,
    [members.data],
  );
  const entries = useMemo(() => log.data?.pages.flatMap((page) => page.entries) ?? [], [log.data]);

  if (!allowed) {
    // The route is already limited to owners and admins; this is a second line.
    return (
      <>
        <PageHeader title={t("audit.title")} description={t("audit.description")} />
        <EmptyState
          icon={ShieldAlert}
          title={t("audit.noAccessTitle")}
          text={t("audit.noAccessText")}
        />
      </>
    );
  }

  function setCategory(next: string) {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (isAuditCategory(next)) updated.set("type", next);
        else updated.delete("type");
        return updated;
      },
      { replace: true },
    );
  }

  const columns: DataColumn<AuditEntry>[] = [
    {
      key: "time",
      header: t("audit.colTime"),
      className: "w-44 whitespace-nowrap",
      cell: (entry) => (
        <time dateTime={entry.created_at} className="tabular-nums">
          {formatDate(entry.created_at, { dateStyle: "medium", timeStyle: "short" })}
        </time>
      ),
    },
    {
      key: "actor",
      header: t("audit.colActor"),
      className: "w-40",
      cell: (entry) => {
        const actor = auditActor(entry, names);
        if (actor.kind === "member") return <span className="break-words">{actor.name}</span>;
        if (actor.kind === "unknown" && members.isPending) {
          return <Skeleton className="h-4 w-24" />;
        }
        return (
          <span className="text-slate-500">
            {actor.kind === "former"
              ? t("audit.actorFormer")
              : actor.kind === "unknown"
                ? t("audit.actorUnknown")
                : t("audit.actorSystem")}
          </span>
        );
      },
    },
    {
      key: "action",
      header: t("audit.colAction"),
      primary: true,
      cell: (entry) => {
        const label = auditActionLabel(entry.action);
        return label ? (
          t(label)
        ) : (
          <code dir="ltr" className="font-mono text-sm break-all">
            {entry.action}
          </code>
        );
      },
    },
    {
      key: "details",
      header: t("audit.colDetails"),
      cell: (entry) => (
        <AuditDetails details={auditDetails(entry.action, entry.details)} names={names} />
      ),
    },
  ];

  const filtered = category !== "all";

  return (
    <>
      <PageHeader title={t("audit.title")} description={t("audit.description")} />
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-slate-600">{t("audit.privacyNote")}</p>
        {members.error !== null && (
          <Alert
            tone="warning"
            action={
              <Button size="sm" variant="outline" onClick={() => void members.refetch()}>
                {t("common.retry")}
              </Button>
            }
          >
            {t("audit.membersError")}
          </Alert>
        )}
        <div className="sm:max-w-xs">
          <Field label={t("audit.filterLabel")}>
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">{t("audit.categoryAll")}</option>
              {AUDIT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t(`audit.category_${item}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {log.error && !log.data ? (
          <QueryError error={log.error} onRetry={() => void log.refetch()} />
        ) : (
          <Card aria-busy={log.isPending || undefined}>
            <DataList
              items={entries}
              columns={columns}
              getKey={(entry) => String(entry.id)}
              caption={t("audit.caption")}
              loading={log.isPending}
              empty={
                filtered ? (
                  <EmptyState
                    icon={ScrollText}
                    title={t("audit.emptyFilteredTitle")}
                    text={t("audit.emptyFilteredText")}
                    action={
                      <Button variant="outline" onClick={() => setCategory("all")}>
                        {t("audit.showAll")}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={ScrollText}
                    title={t("audit.emptyTitle")}
                    text={t("audit.emptyText")}
                  />
                )
              }
            />
          </Card>
        )}

        {entries.length > 0 && (
          <div className="flex flex-col items-center gap-3 pb-2">
            <p className="text-sm text-slate-600" aria-live="polite">
              {t("audit.shownCount", { count: formatNumber(entries.length) })}
            </p>
            {log.error && log.data && (
              <QueryError
                error={log.error}
                onRetry={() => void log.fetchNextPage()}
                className="w-full"
              />
            )}
            {log.hasNextPage ? (
              <Button
                variant="outline"
                onClick={() => void log.fetchNextPage()}
                loading={log.isFetchingNextPage}
              >
                {log.isFetchingNextPage ? t("audit.loadingMore") : t("audit.loadMore")}
              </Button>
            ) : (
              !log.isFetching && <p className="text-sm text-slate-500">{t("audit.endOfLog")}</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
