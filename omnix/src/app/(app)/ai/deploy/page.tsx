import { ApiButton } from "@/components/ApiButton";
import { CreateModel } from "@/components/CreateModel";
import { RoleRow } from "@/components/RoleForm";
import { PageHead, StatusBadge, fmtDate } from "@/components/ui";
import { listRoles, MODEL_ROLES } from "@/lib/ai/models/service";
import { withUser } from "@/lib/db/pool";
import { loadPrimaryModel } from "@/lib/server/data";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Deployment" };

export default async function DeployPage() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const m = await loadPrimaryModel(s);
  if (!m) return (<><PageHead title={t.deploy.title} /><CreateModel t={t} /></>);
  const { roles, gates } = await withUser(s.auth.userId, async (db) => {
    const g = await db.query(
      `SELECT DISTINCT ON (model_version_id) model_version_id, status, score FROM ai_evaluation_runs
        WHERE owner_id = $1 AND evaluation_type = 'full' AND status IN ('passed','failed','error') ORDER BY model_version_id, completed_at DESC`,
      [s.auth.userId],
    );
    return { roles: await listRoles(db, s.auth), gates: new Map(g.rows.map((r) => [r.model_version_id as string, r])) };
  });
  const usable = m.versions.filter((v) => v.status === "ready" || v.status === "deployed");
  return (
    <>
      <PageHead title={t.deploy.title} subtitle={t.deploy.subtitle} />
      <section className="card">
        <h2>{t.deploy.current}</h2>
        {m.deployed ? (
          <div className="row">
            <StatusBadge status="deployed" label={`v${m.deployed.version}`} />
            <span className="mono ltr small">{m.deployed.baseModel}{m.deployed.adapterName ? ` + ${m.deployed.adapterName}` : ""}</span>
            <span className="muted small">{fmtDate(m.deployed.deployedAt, locale)}</span>
            <span className="spacer" />
            <ApiButton path={`/api/ai/models/${m.profile.id}/deploy`} method="DELETE" confirm={`${t.deploy.undeploy}?`} className="btn sm danger">{t.deploy.undeploy}</ApiButton>
          </div>
        ) : <div className="alert warn">{t.deploy.noneLive}</div>}
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t.deploy.gate}</h2>
        <table className="table responsive">
          <thead><tr><th>{t.common.version}</th><th>{t.deploy.gate}</th><th>{t.evals.score}</th><th>{t.common.actions}</th></tr></thead>
          <tbody>{usable.map((v) => {
            const g = gates.get(v.id);
            const pass = g?.status === "passed";
            return (
              <tr key={v.id}>
                <td data-label={t.common.version}><strong>v{v.version}</strong> {v.adapterName && <span className="badge accent plain">LoRA</span>}</td>
                <td data-label={t.deploy.gate}>{pass ? <span className="badge ok">{t.deploy.gatePass}</span> : <span className="badge warn">{t.deploy.gateFail}</span>}</td>
                <td data-label={t.evals.score} className="num">{g?.score != null ? `${Math.round(Number(g.score) * 100)}%` : "—"}</td>
                <td data-label={t.common.actions}>
                  {v.status === "deployed" ? <StatusBadge status="deployed" /> : (
                    <ApiButton path={`/api/ai/models/${m.profile.id}/deploy`} body={{ versionId: v.id }} className={`btn sm ${pass ? "primary" : ""}`}>{t.deploy.deploy}</ApiButton>
                  )}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t.deploy.roles}</h2>
        <p className="small muted">{t.deploy.rolesHint}</p>
        <table className="table responsive">
          <thead><tr><th>{t.deploy.roles}</th><th>{t.deploy.pin}</th><th>{t.model.temperature}</th><th>{t.common.actions}</th></tr></thead>
          <tbody>{MODEL_ROLES.map((role) => {
            const cur = roles.find((r) => r.role === role && r.modelProfileId === m.profile.id) ?? null;
            return <RoleRow key={role} t={t} role={role} modelId={m.profile.id} versions={usable.map((v) => ({ id: v.id, version: v.version }))} current={cur ? { modelVersionId: cur.modelVersionId, temperature: cur.temperature } : null} />;
          })}</tbody>
        </table>
      </section>
    </>
  );
}
