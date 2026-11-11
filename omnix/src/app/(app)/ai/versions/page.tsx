import Link from "next/link";
import { ApiButton } from "@/components/ApiButton";
import { CreateModel } from "@/components/CreateModel";
import { VersionForm } from "@/components/VersionForm";
import { PageHead, StatusBadge, fmtDate } from "@/components/ui";
import { BASE_MODEL_CANDIDATES } from "@/lib/ai/models/catalog";
import { providerFromRow, syncPlatformProviders } from "@/lib/ai/providers/registry";
import { withUser } from "@/lib/db/pool";
import { loadPrimaryModel } from "@/lib/server/data";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Versions" };

export default async function VersionsPage() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const m = await loadPrimaryModel(s);
  if (!m) return (<><PageHead title={t.versions.title} /><CreateModel t={t} /></>);
  const providers = await withUser(s.auth.userId, async (db) => {
    await syncPlatformProviders(db);
    return (await db.query("SELECT * FROM ai_model_providers WHERE status <> 'disabled' ORDER BY owner_id NULLS FIRST, provider_name")).rows.map(providerFromRow);
  });
  const pname = new Map(providers.map((p) => [p.id, p.providerName]));
  return (
    <>
      <PageHead title={t.versions.title} subtitle={t.versions.subtitle} />
      <section className="card">
        <div className="table-wrap">
          <table className="table responsive">
            <thead><tr><th>{t.common.version}</th><th>{t.common.status}</th><th>{t.versions.evaluation}</th><th>{t.common.baseModel}</th><th>{t.versions.adapter}</th><th>{t.common.provider}</th><th>{t.common.created}</th><th>{t.common.actions}</th></tr></thead>
            <tbody>
              {m.versions.map((v) => (
                <tr key={v.id}>
                  <td data-label={t.common.version}><strong className="num">v{v.version}</strong></td>
                  <td data-label={t.common.status}><StatusBadge status={v.status} /></td>
                  <td data-label={t.versions.evaluation}><StatusBadge status={v.evaluationStatus} /></td>
                  <td data-label={t.common.baseModel} className="mono ltr small">{v.baseModel}</td>
                  <td data-label={t.versions.adapter}>{v.adapterName ? <span className="badge accent plain mono ltr">{v.adapterName}</span> : <span className="muted small">{t.versions.base}</span>}</td>
                  <td data-label={t.common.provider} className="small">{pname.get(v.providerId) ?? "—"} <span className="mono ltr tiny muted">{v.providerModel}</span></td>
                  <td data-label={t.common.created} className="small">{fmtDate(v.createdAt, locale)}</td>
                  <td data-label={t.common.actions}>
                    <div className="row">
                      <ApiButton path="/api/ai/evaluations" body={{ modelVersionId: v.id, evaluationType: "full" }} className="btn sm" then="/ai/evaluations">{t.hub.evaluate}</ApiButton>
                      {v.status === "ready" && <ApiButton path={`/api/ai/models/${m.profile.id}/deploy`} body={{ versionId: v.id }} className="btn sm primary">{t.deploy.deploy}</ApiButton>}
                      {v.trainingJobId && <Link className="btn sm ghost" href={`/ai/training/${v.trainingJobId}`}>{t.nav.training}</Link>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t.versions.newVersion}</h2>
        <VersionForm t={t} modelId={m.profile.id} providers={providers.map((p) => ({ id: p.id, name: p.providerName, type: p.providerType }))} candidates={BASE_MODEL_CANDIDATES.map((c) => ({ id: c.id, ollamaTag: c.ollamaTag }))} />
      </section>
    </>
  );
}
