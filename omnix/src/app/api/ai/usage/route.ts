import { withUser } from "@/lib/db/pool";
import { route } from "@/lib/http/route";

export const runtime = "nodejs";

/** Usage analytics from recorded events. Token counts say whether they came from the provider or an estimate. */
export const GET = route.auth({ scope: "usage:read" }, async ({ auth, url }) => {
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 30) || 30, 1), 365);
  return withUser(auth.userId, async (db) => {
    const totals = await db.query(
      `SELECT operation, count(*)::int AS requests, sum(input_tokens)::bigint AS input_tokens, sum(output_tokens)::bigint AS output_tokens,
              round(avg(latency_ms))::int AS avg_latency_ms,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS p95_latency_ms,
              sum(estimated_cost) AS estimated_cost, count(estimated_cost)::int AS priced_events,
              count(*) FILTER (WHERE usage_source = 'estimate')::int AS estimated_events
         FROM ai_usage_events WHERE owner_id = $1 AND workspace_id = $2 AND created_at > now() - make_interval(days => $3)
        GROUP BY operation ORDER BY operation`,
      [auth.userId, auth.workspaceId, days],
    );
    const daily = await db.query(
      `SELECT date_trunc('day', created_at)::date AS day, count(*)::int AS requests,
              sum(input_tokens + output_tokens)::bigint AS tokens
         FROM ai_usage_events WHERE owner_id = $1 AND workspace_id = $2 AND created_at > now() - make_interval(days => $3)
        GROUP BY 1 ORDER BY 1`,
      [auth.userId, auth.workspaceId, days],
    );
    const byModel = await db.query(
      `SELECT p.display_name, v.version, count(*)::int AS requests, sum(e.output_tokens)::bigint AS output_tokens
         FROM ai_usage_events e LEFT JOIN ai_model_profiles p ON p.id = e.model_profile_id LEFT JOIN ai_model_versions v ON v.id = e.model_version_id
        WHERE e.owner_id = $1 AND e.workspace_id = $2 AND e.operation = 'chat' AND e.created_at > now() - make_interval(days => $3)
        GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20`,
      [auth.userId, auth.workspaceId, days],
    );
    const fmt = (r: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v]));
    return { days, totals: totals.rows.map(fmt), daily: daily.rows.map(fmt), byModel: byModel.rows.map(fmt) };
  });
});
