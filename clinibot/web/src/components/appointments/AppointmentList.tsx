import { useState } from "react";
import { CalendarClock, Plus, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import {
  Button,
  Card,
  DataList,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  TabList,
  TabPanel,
  Tabs,
  type DataColumn,
} from "@/components/ui";
import { QueryError } from "@/components/layout/QueryError";
import { useI18n, type MessageKey } from "@/i18n";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useCurrentOrg } from "@/org/useOrg";
import { usePollInterval, useNow, useSearchDraft } from "@/components/dashboard/hooks";
import { memberLabel, memberNameMap, useOrgMembers } from "@/components/dashboard/members";
import { MembersError } from "@/components/dashboard/MembersError";
import { formatDateTime, formatRelativeTime } from "@/components/dashboard/time";
import { AppointmentStatusBadge, SourceBadge } from "./badges";
import {
  isListTab,
  isTimeWindow,
  LIST_TABS,
  serviceName,
  STATUS_LABELS,
  TIME_WINDOW_LABELS,
  type AppointmentListRow,
  type ListTab,
} from "./model";
import { NewAppointmentDialog } from "./NewAppointmentDialog";
import { LIST_LIMIT, POLL_MS, useAppointmentList } from "./queries";

const DEFAULT_TAB: ListTab = "new";

const EMPTY: Record<ListTab, { title: MessageKey; text: MessageKey }> = {
  new: { title: "appointments.emptyNewTitle", text: "appointments.emptyNewText" },
  contacted: { title: "appointments.emptyContactedTitle", text: "appointments.emptyContactedText" },
  confirmed: { title: "appointments.emptyConfirmedTitle", text: "appointments.emptyConfirmedText" },
  completed: { title: "appointments.emptyCompletedTitle", text: "appointments.emptyCompletedText" },
  cancelled: { title: "appointments.emptyCancelledTitle", text: "appointments.emptyCancelledText" },
  all: { title: "appointments.emptyAllTitle", text: "appointments.emptyAllText" },
};

export function AppointmentList() {
  const { t, lang, formatDate } = useI18n();
  const org = useCurrentOrg();
  useDocumentTitle(t("appointments.title"));
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  const status: ListTab = isListTab(statusParam) ? statusParam : DEFAULT_TAB;
  const search = params.get("q") ?? "";
  const [creating, setCreating] = useState(false);
  const poll = usePollInterval(POLL_MS);
  const now = useNow();
  const members = useOrgMembers(org.id);
  const names = memberNameMap(members.data);
  const query = useAppointmentList(org.id, { status, search }, poll);
  const listSearch = params.toString() ? `?${params.toString()}` : "";

  function update(patch: Partial<Record<"status" | "q", string>>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          if (!value || (key === "status" && value === DEFAULT_TAB)) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  }
  // Typing is debounced into the address (and so into the query).
  const [searchDraft, setSearchDraft] = useSearchDraft(search, (q) => update({ q }));

  const columns: DataColumn<AppointmentListRow>[] = [
    {
      key: "customer",
      header: t("appointments.colCustomer"),
      primary: true,
      cell: (row) => (
        <Link
          to={{ pathname: `/app/appointments/${row.id}`, search: listSearch }}
          className="inline-flex min-h-11 items-center rounded font-bold text-slate-900 hover:text-primary hover:underline md:min-h-0"
        >
          {row.customer_name}
        </Link>
      ),
    },
    {
      key: "phone",
      header: t("appointments.colPhone"),
      cell: (row) => (
        <a
          href={`tel:${row.customer_phone}`}
          dir="ltr"
          className="inline-flex min-h-11 items-center font-medium text-primary hover:underline md:min-h-0"
        >
          {row.customer_phone}
        </a>
      ),
    },
    {
      key: "service",
      header: t("appointments.colService"),
      cell: (row) =>
        serviceName(row.service, lang) || (
          <span className="text-slate-500">{t("appointments.notSpecified")}</span>
        ),
    },
    {
      key: "preferred",
      header: t("appointments.colPreferred"),
      cell: (row) => (
        <span>
          {row.preferred_date
            ? formatDate(row.preferred_date, { weekday: "short", day: "numeric", month: "short" })
            : t("appointments.anyDay")}
          <span className="text-slate-500">
            {" · "}
            {t(
              TIME_WINDOW_LABELS[
                isTimeWindow(row.preferred_time_window) ? row.preferred_time_window : "any"
              ],
            )}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: t("appointments.colStatus"),
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <AppointmentStatusBadge status={row.status} />
          {row.status === "confirmed" && row.scheduled_for && (
            <span className="text-xs text-slate-700">
              {t("appointments.scheduledShort", { time: formatDateTime(lang, row.scheduled_for) })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "source",
      header: t("appointments.colSource"),
      cell: (row) => <SourceBadge source={row.source} />,
    },
    {
      key: "assignee",
      header: t("appointments.colAssignee"),
      cell: (row) => {
        if (!row.assigned_to) {
          return <span className="text-slate-500">{t("appointments.unassigned")}</span>;
        }
        const assignee = memberLabel(names, row.assigned_to);
        if (assignee.kind === "name") return assignee.name;
        if (assignee.kind === "former") return t("appointments.formerMember");
        // The team list is loading or failed: say so, never "former member".
        return members.isPending ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <span className="text-slate-500">{t("dashboard.nameUnavailable")}</span>
        );
      },
    },
    {
      key: "created",
      header: t("appointments.colCreated"),
      cell: (row) => (
        <time dateTime={row.created_at} title={formatDateTime(lang, row.created_at)}>
          {formatRelativeTime(lang, row.created_at, now)}
        </time>
      ),
    },
  ];

  const tabItems = LIST_TABS.map((tab) => ({
    value: tab,
    label: tab === "all" ? t("appointments.tabAll") : t(STATUS_LABELS[tab]),
  }));

  return (
    <>
      <PageHeader
        title={t("appointments.title")}
        description={t("appointments.description")}
        actions={
          <Button
            onClick={() => setCreating(true)}
            icon={<Plus className="size-4" aria-hidden="true" />}
          >
            {t("appointments.newButton")}
          </Button>
        }
      />
      <Card>
        <div className="border-b border-slate-100 p-4 sm:px-6">
          <Field label={t("appointments.searchLabel")} hideLabel className="sm:max-w-sm">
            <Input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={t("appointments.searchPlaceholder")}
              startAdornment={<Search className="size-5" aria-hidden="true" />}
              autoComplete="off"
              enterKeyHint="search"
            />
          </Field>
          {members.error && (
            <MembersError
              className="mt-3"
              onRetry={() => void members.refetch()}
              retrying={members.isFetching}
            />
          )}
        </div>
        <Tabs value={status} onValueChange={(value) => update({ status: value })}>
          <TabList label={t("appointments.tabsLabel")} items={tabItems} className="px-4 sm:px-5" />
          <TabPanel value={status} className="pt-1!">
            {query.error && !query.data ? (
              <div className="p-4">
                <QueryError error={query.error} onRetry={() => void query.refetch()} />
              </div>
            ) : (
              <>
                {query.error && (
                  <div className="p-4">
                    <QueryError error={query.error} onRetry={() => void query.refetch()} />
                  </div>
                )}
                <div className="md:overflow-x-auto">
                  <DataList
                    items={query.data ?? []}
                    columns={columns}
                    getKey={(row) => row.id}
                    caption={t("appointments.listCaption")}
                    loading={query.isPending}
                    empty={
                      <EmptyState
                        icon={CalendarClock}
                        title={search ? t("appointments.emptySearchTitle") : t(EMPTY[status].title)}
                        text={search ? t("appointments.emptySearchText") : t(EMPTY[status].text)}
                      />
                    }
                  />
                </div>
                {(query.data?.length ?? 0) >= LIST_LIMIT && (
                  <p className="px-4 pb-4 text-xs text-slate-500 sm:px-6">
                    {t("appointments.listLimited", { n: LIST_LIMIT })}
                  </p>
                )}
              </>
            )}
          </TabPanel>
        </Tabs>
      </Card>
      <NewAppointmentDialog open={creating} onClose={() => setCreating(false)} orgId={org.id} />
    </>
  );
}
