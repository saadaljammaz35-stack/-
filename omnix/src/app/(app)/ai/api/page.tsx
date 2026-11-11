import { ApiButton } from "@/components/ApiButton";
import { NewApiKey, NewProvider } from "@/components/ApiSettings";
import { Empty, PageHead, StatusBadge, fmtDate } from "@/components/ui";
import { providerFromRow, syncPlatformProviders } from "@/lib/ai/providers/registry";
import { withUser } from "@/lib/db/pool";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "API" };

export default async function ApiPage() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const { keys, providers } = await withUser(s.auth.userId, async (db) => {
    await syncPlatformProviders(db);
    return {
      keys: (await db.query("SELECT id, name, prefix, scopes, last_used_at, expires_at, revoked_at, created_at FROM ai_api_keys WHERE owner_id = $1 ORDER BY created_at DESC", [s.auth.userId])).rows,
      providers: (await db.query(
        "SELECT p.*, c.secret_hint FROM ai_model_providers p LEFT JOIN ai_model_connections c ON c.provider_id = p.id AND c.owner_id = $1 ORDER BY p.owner_id NULLS FIRST, p.provider_name",
        [s.auth.userId],
      )).rows.map((r) => ({ ...providerFromRow(r), hint: r.secret_hint as string | null })),
    };
  });
  const curl = `curl -N https://YOUR-OMNIX-HOST/api/ai/chat/stream \\
  -H "Authorization: Bearer omx_xxxxxxxx_…" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"مرحبا","role":"default"}'`;
  return (
    <>
      <PageHead title={t.api.title} subtitle={t.api.subtitle} actions={<a className="btn sm" href="/api/ai/openapi.json" target="_blank" rel="noreferrer">{t.api.docs}</a>} />
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="card"><h2>{t.api.newKey}</h2><NewApiKey t={t} /></section>
        <section className="card">
          <h2>{t.api.keys}</h2>
          {keys.length === 0 ? <Empty>{t.common.none}</Empty> : (
            <div className="list">
              {keys.map((k) => (
                <div key={k.id} className="list-item">
                  <div className="grow">
                    <div className="row"><strong>{k.name}</strong><span className="mono ltr small">{k.prefix}_…</span>{k.revoked_at ? <StatusBadge status="retired" label="revoked" /> : <StatusBadge status="ok" label="active" />}</div>
                    <div className="tiny muted">{(k.scopes as string[]).join(" · ")} · {t.api.lastUsed}: {fmtDate(k.last_used_at, locale)}{k.expires_at ? ` · ⏳ ${fmtDate(k.expires_at, locale)}` : ""}</div>
                  </div>
                  {!k.revoked_at && <ApiButton path={`/api/ai/api-keys/${k.id}`} method="DELETE" confirm={`${t.api.revoke}?`} className="btn sm ghost danger">{t.api.revoke}</ApiButton>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t.api.example}</h2>
        <pre className="mono small ltr" style={{ overflowX: "auto", margin: 0 }}>{curl}</pre>
        <p className="tiny muted">SSE events: meta → delta* → done | error. API keys can only reach deployed versions.</p>
      </section>
      <div className="grid grid-2" style={{ marginTop: 16, alignItems: "start" }}>
        <section className="card">
          <h2>{t.api.providers}</h2>
          <div className="list">
            {providers.map((p) => (
              <div key={p.id} className="list-item">
                <div className="grow">
                  <div className="row"><strong>{p.providerName}</strong><span className="badge plain">{p.providerType}</span><span className="badge plain">{p.ownerId ? "personal" : "platform"}</span><StatusBadge status={p.status} /></div>
                  <div className="tiny muted mono ltr truncate">{p.endpoint ?? "in-process"}{p.hint ? ` · key ${p.hint}` : ""}{p.lastLatencyMs !== null ? ` · ${p.lastLatencyMs} ms` : ""}</div>
                  {p.lastHealthError && <div className="tiny" style={{ color: "var(--bad)" }}>{p.lastHealthError.slice(0, 160)}</div>}
                </div>
                <ApiButton path={`/api/ai/providers/${p.id}/health`} className="btn sm">{t.api.health}</ApiButton>
              </div>
            ))}
          </div>
        </section>
        <section className="card"><h2>{t.api.addProvider}</h2><NewProvider t={t} /></section>
      </div>
    </>
  );
}
