import Link from "next/link";
import { CreateModel } from "@/components/CreateModel";
import { PageHead, Stat, StatusBadge, fmtNumber } from "@/components/ui";
import { getInfrastructure } from "@/lib/ai/training/jobs";
import { withUser } from "@/lib/db/pool";
import { loadPrimaryModel } from "@/lib/server/data";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const model = await loadPrimaryModel(s);
  if (!model) {
    return (
      <>
        <PageHead title={t.dashboard.title} subtitle={t.dashboard.noModel} />
        <CreateModel t={t} />
      </>
    );
  }
  const stats = await withUser(s.auth.userId, async (db) => {
    const q = async (sql: string, p: unknown[]) => (await db.query(sql, p)).rows[0];
    const docs = await q("SELECT count(*)::int AS n FROM ai_knowledge_documents WHERE workspace_id = $1", [s.auth.workspaceId]);
    const conv = await q("SELECT count(*)::int AS n FROM ai_conversations WHERE owner_id = $1 AND workspace_id = $2", [s.auth.userId, s.auth.workspaceId]);
    const tokens = await q(
      "SELECT coalesce(sum(input_tokens + output_tokens), 0)::bigint AS n FROM ai_usage_events WHERE owner_id = $1 AND created_at > now() - interval '7 days'",
      [s.auth.userId],
    );
    const evalRun = await q(
      `SELECT r.status, r.score, v.version FROM ai_evaluation_runs r JOIN ai_model_versions v ON v.id = r.model_version_id
        WHERE r.owner_id = $1 AND r.evaluation_type = 'full' AND r.status IN ('passed','failed','error') ORDER BY r.completed_at DESC LIMIT 1`,
      [s.auth.userId],
    );
    const jobs = await q("SELECT count(*) FILTER (WHERE status IN ('queued','claimed','running'))::int AS active FROM ai_training_jobs WHERE owner_id = $1", [s.auth.userId]);
    return { docs: docs.n, conv: conv.n, tokens: Number(tokens.n), evalRun, activeJobs: jobs.active, infra: await getInfrastructure(db) };
  });
  const latest = model.versions[0]!;
  return (
    <>
      <PageHead
        title={model.profile.displayName}
        subtitle={`${model.profile.modelFamily} · ${t.common.version} ${(model.deployed ?? latest).version} · ${(model.deployed ?? latest).baseModel}`}
        actions={
          <>
            <Link className="btn primary" href="/ai/chat">{t.nav.chat}</Link>
            <Link className="btn" href="/hub">{t.nav.hub}</Link>
          </>
        }
      />
      <div className="grid grid-4">
        <Stat label={t.dashboard.deployed} value={model.deployed ? model.deployed.version : "—"} hint={model.deployed ? <StatusBadge status="deployed" /> : <StatusBadge status="not_evaluated" label={t.dashboard.notDeployed} />} />
        <Stat label={t.dashboard.documents} value={fmtNumber(stats.docs, locale)} />
        <Stat label={t.dashboard.conversations} value={fmtNumber(stats.conv, locale)} />
        <Stat label={t.dashboard.tokens7d} value={fmtNumber(stats.tokens, locale)} />
      </div>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>{t.dashboard.lastEval}</h2>
          {stats.evalRun ? (
            <div className="row">
              <StatusBadge status={stats.evalRun.status} />
              <span className="num" style={{ fontSize: 28, fontWeight: 650 }}>{stats.evalRun.score === null ? "—" : `${Math.round(Number(stats.evalRun.score) * 100)}%`}</span>
              <span className="muted">{t.common.version} {stats.evalRun.version}</span>
            </div>
          ) : (
            <p className="muted">{t.common.none}</p>
          )}
          <div className="divider" />
          <Link className="btn sm" href="/ai/evaluations">{t.nav.evaluations}</Link>
        </div>
        <div className="card">
          <h2>{t.dashboard.gpu}</h2>
          {stats.infra.gpuAvailable ? (
            <div className="alert ok">{t.dashboard.gpuOk}</div>
          ) : (
            <div className="alert warn">{t.dashboard.gpuNone}</div>
          )}
          <p className="small muted">
            {t.training.workers}: {stats.infra.workers.filter((w) => w.online).length} · {t.training.jobs}: {stats.activeJobs}
          </p>
          <Link className="btn sm" href="/ai/training">{t.nav.training}</Link>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>{t.dashboard.quick}</h2>
        <div className="actions-grid">
          <Link className="btn" href="/ai/knowledge">{t.hub.manageKnowledge}</Link>
          <Link className="btn" href="/ai/datasets">{t.nav.datasets}</Link>
          <Link className="btn" href="/ai/model">{t.nav.model}</Link>
          <Link className="btn" href="/ai/deploy">{t.hub.deployModel}</Link>
          <Link className="btn" href="/ai/api">{t.hub.configureApi}</Link>
          <Link className="btn" href="/ai/usage">{t.nav.usage}</Link>
        </div>
      </div>
    </>
  );
}
