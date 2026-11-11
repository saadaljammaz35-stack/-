import { BarChart } from "@/components/LossChart";
import { Empty, PageHead, Stat, fmtNumber } from "@/components/ui";
import { withUser } from "@/lib/db/pool";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Usage" };

export default async function UsagePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const s = await requireSession();
  const { t, locale } = await getDict();
  const d = await withUser(s.auth.userId, async (db) => {
    const p = [s.auth.userId, s.auth.workspaceId, days];
    const totals = (await db.query(
      `SELECT operation, count(*)::int AS requests, coalesce(sum(input_tokens),0)::bigint AS input_tokens, coalesce(sum(output_tokens),0)::bigint AS output_tokens,
              round(avg(latency_ms))::int AS avg_latency, percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS p95,
              sum(estimated_cost) AS cost, count(*) FILTER (WHERE usage_source = 'estimate')::int AS estimated
         FROM ai_usage_events WHERE owner_id = $1 AND workspace_id = $2 AND created_at > now() - make_interval(days => $3) GROUP BY 1 ORDER BY 1`, p)).rows;
    const daily = (await db.query(
      `SELECT to_char(date_trunc('day', created_at), 'MM-DD') AS day, sum(input_tokens + output_tokens)::bigint AS tokens
         FROM ai_usage_events WHERE owner_id = $1 AND workspace_id = $2 AND created_at > now() - make_interval(days => $3) GROUP BY date_trunc('day', created_at) ORDER BY date_trunc('day', created_at)`, p)).rows;
    const byModel = (await db.query(
      `SELECT p.display_name, v.version, count(*)::int AS requests, coalesce(sum(e.output_tokens),0)::bigint AS output_tokens
         FROM ai_usage_events e LEFT JOIN ai_model_profiles p ON p.id = e.model_profile_id LEFT JOIN ai_model_versions v ON v.id = e.model_version_id
        WHERE e.owner_id = $1 AND e.workspace_id = $2 AND e.operation = 'chat' AND e.created_at > now() - make_interval(days => $3) GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20`, p)).rows;
    return { totals, daily, byModel };
  });
  const chat = d.totals.find((x) => x.operation === "chat");
  const anyCost = d.totals.some((x) => x.cost !== null);
  return (
    <>
      <PageHead title={t.usage.title} subtitle={t.usage.subtitle} actions={<div className="segmented">{[7, 30, 90].map((n) => <a key={n} href={`?days=${n}`} className="btn sm ghost" aria-current={days === n ? "page" : undefined} style={days === n ? { background: "var(--surface)" } : undefined}>{n}d</a>)}</div>} />
      <div className="grid grid-4">
        <Stat label={t.usage.requests} value={fmtNumber(chat?.requests ?? 0, locale)} hint="chat" />
        <Stat label={t.usage.inputTokens} value={fmtNumber(Number(chat?.input_tokens ?? 0), locale)} />
        <Stat label={t.usage.outputTokens} value={fmtNumber(Number(chat?.output_tokens ?? 0), locale)} />
        <Stat label={t.usage.latency} value={chat?.avg_latency ? `${(chat.avg_latency / 1000).toFixed(1)}s` : "—"} hint={chat?.p95 ? `${t.usage.p95} ${(chat.p95 / 1000).toFixed(1)}s` : undefined} />
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t.usage.daily}</h2>
        <BarChart data={d.daily.map((x) => ({ label: x.day, value: Number(x.tokens) }))} />
      </section>
      <div className="grid grid-2" style={{ marginTop: 16, alignItems: "start" }}>
        <section className="card">
          <h2>{t.common.actions}</h2>
          {d.totals.length === 0 ? <Empty>{t.common.none}</Empty> : (
            <table className="table responsive">
              <thead><tr><th>op</th><th>{t.usage.requests}</th><th>{t.usage.inputTokens}</th><th>{t.usage.outputTokens}</th><th>{t.usage.cost}</th></tr></thead>
              <tbody>{d.totals.map((x) => (
                <tr key={x.operation}>
                  <td data-label="op">{x.operation}{x.estimated ? <span className="tiny muted"> ({x.estimated} {t.usage.estimated})</span> : null}</td>
                  <td data-label={t.usage.requests} className="num">{fmtNumber(x.requests, locale)}</td>
                  <td data-label={t.usage.inputTokens} className="num">{fmtNumber(Number(x.input_tokens), locale)}</td>
                  <td data-label={t.usage.outputTokens} className="num">{fmtNumber(Number(x.output_tokens), locale)}</td>
                  <td data-label={t.usage.cost} className="num">{x.cost === null ? <span className="muted">—</span> : Number(x.cost).toFixed(4)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {!anyCost && <p className="tiny muted">{t.usage.cost}: {t.usage.costUnknown}</p>}
        </section>
        <section className="card">
          <h2>{t.usage.byModel}</h2>
          {d.byModel.length === 0 ? <Empty>{t.common.none}</Empty> : (
            <div className="list">{d.byModel.map((x, i) => (
              <div key={i} className="list-item"><div className="grow">{x.display_name ?? "—"} <span className="muted">v{x.version ?? "?"}</span></div><span className="num small">{fmtNumber(x.requests, locale)} · {fmtNumber(Number(x.output_tokens), locale)} tok</span></div>
            ))}</div>
          )}
        </section>
      </div>
    </>
  );
}
