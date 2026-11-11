import Link from "next/link";
import { CreateModel } from "@/components/CreateModel";
import { PageHead, StatusBadge, fmtNumber } from "@/components/ui";
import { BASE_MODEL_CANDIDATES, VERIFIED_ON } from "@/lib/ai/models/catalog";
import { loadModels } from "@/lib/server/data";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Model Hub" };

export default async function Hub() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const models = await loadModels(s);
  return (
    <>
      <PageHead title={t.hub.title} subtitle={t.hub.subtitle} />
      {models.length === 0 && <CreateModel t={t} />}
      <div className="grid grid-2">
        {models.map((m) => {
          const v = m.deployed ?? m.versions[0]!;
          return (
            <article key={m.profile.id} className="card model-card stack">
              <div className="row between">
                <div>
                  <h2>{m.profile.displayName}</h2>
                  <div className="muted small">{t.hub.privateModel} · {m.profile.modelFamily}</div>
                </div>
                {m.deployed ? <StatusBadge status="deployed" label={`v${m.deployed.version}`} /> : <StatusBadge status="draft" label={t.chat.preview} />}
              </div>
              {m.profile.description && <p style={{ margin: 0 }}>{m.profile.description}</p>}
              <div className="row small muted">
                <span>{t.common.baseModel}: <span className="ltr">{v.baseModel}</span></span>
                <span>· {m.versions.length} {t.nav.versions}</span>
                {v.adapterName && <span className="badge accent plain">{t.versions.fineTuned}</span>}
              </div>
              <div className="actions-grid">
                <Link className="btn primary" href="/ai/chat">{t.hub.use}</Link>
                <Link className="btn" href="/ai/model">{t.hub.details}</Link>
                <Link className="btn" href="/ai/knowledge">{t.hub.manageKnowledge}</Link>
                <Link className="btn" href="/ai/training">{t.hub.train}</Link>
                <Link className="btn" href="/ai/evaluations">{t.hub.evaluate}</Link>
                <Link className="btn" href="/ai/versions">{t.hub.manageVersions}</Link>
                <Link className="btn" href="/ai/api">{t.hub.configureApi}</Link>
                <Link className="btn" href="/ai/deploy">{t.hub.deployModel}</Link>
              </div>
              <p className="tiny muted" style={{ margin: 0 }}>{t.hub.integrations}</p>
            </article>
          );
        })}
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t.hub.catalog}</h2>
        <p className="small muted">{t.hub.catalogNote} ({VERIFIED_ON})</p>
        <div className="table-wrap">
          <table className="table responsive">
            <thead>
              <tr>
                <th>Model</th><th>{t.hub.license}</th><th>{t.hub.params}</th><th>{t.hub.context}</th><th>{t.hub.arabicFirst}</th><th>VRAM bf16 / QLoRA*</th>
              </tr>
            </thead>
            <tbody>
              {BASE_MODEL_CANDIDATES.map((c) => (
                <tr key={c.id}>
                  <td data-label="Model"><span className="ltr mono">{c.id}</span>{c.role === "production_default" && <> <span className="badge ok plain">default</span></>}{c.role === "arabic_challenger" && <> <span className="badge accent plain">Arabic challenger</span></>}{c.role === "dev_ci" && <> <span className="badge plain">dev</span></>}</td>
                  <td data-label={t.hub.license}>{c.license}</td>
                  <td data-label={t.hub.params} className="num">{fmtNumber(Math.round(c.parameters / 1e8) / 10, locale)}B</td>
                  <td data-label={t.hub.context} className="num">{c.contextLength ? fmtNumber(c.contextLength, locale) : "—"}</td>
                  <td data-label={t.hub.arabicFirst}>{c.arabicFirst ? "✓" : "—"}</td>
                  <td data-label="VRAM" className="num"><span className="ltr">~{c.servingVramGbBf16} / ~{c.qloraVramGb} GB</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny muted">* Rule-of-thumb estimates derived from parameter count, not measurements.</p>
      </section>
    </>
  );
}
