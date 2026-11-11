import Link from "next/link";
import { AutoRefresh } from "@/components/ApiButton";
import { CompareVersions, StartEval } from "@/components/EvalControls";
import { CreateModel } from "@/components/CreateModel";
import { Empty, PageHead, StatusBadge, fmtDate } from "@/components/ui";
import { SUITE, SUITE_VERSION } from "@/lib/ai/eval/suite";
import { withUser } from "@/lib/db/pool";
import { loadPrimaryModel } from "@/lib/server/data";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Evaluation" };

export default async function EvaluationsPage() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const m = await loadPrimaryModel(s);
  if (!m) return (<><PageHead title={t.evals.title} /><CreateModel t={t} /></>);
  const runs = await withUser(s.auth.userId, async (db) =>
    (await db.query(
      `SELECT r.id, r.status, r.score, r.passed_count, r.total_count, r.skipped_count, r.created_at, v.version
         FROM ai_evaluation_runs r JOIN ai_model_versions v ON v.id = r.model_version_id
        WHERE r.owner_id = $1 AND v.model_profile_id = $2 ORDER BY r.created_at DESC LIMIT 50`,
      [s.auth.userId, m.profile.id],
    )).rows,
  );
  const versions = m.versions.map((v) => ({ id: v.id, version: v.version, label: `v${v.version} · ${v.adapterName ? "LoRA" : v.baseModel.split("/").pop()}` }));
  return (
    <>
      <AutoRefresh active={runs.some((r) => r.status === "queued" || r.status === "running")} />
      <PageHead title={t.evals.title} subtitle={t.evals.subtitle} />
      <div className="alert info small" style={{ marginBottom: 16 }}>{t.evals.honesty} ({SUITE_VERSION}, {SUITE.length} {t.evals.cases})</div>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="card stack"><h2>{t.evals.run}</h2><StartEval t={t} versions={versions} /></section>
        <section className="card"><h2>{t.evals.compare}</h2><CompareVersions t={t} versions={versions} /></section>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t.evals.runs}</h2>
        {runs.length === 0 ? <Empty>{t.common.none}</Empty> : (
          <div className="list">
            {runs.map((r) => (
              <Link key={r.id} className="list-item" href={`/ai/evaluations/${r.id}`}>
                <div className="grow row">
                  <StatusBadge status={r.status} />
                  <strong>v{r.version}</strong>
                  <span className="num">{r.score === null ? "—" : `${Math.round(Number(r.score) * 100)}%`}</span>
                  <span className="muted small num">{r.passed_count}/{r.total_count - r.skipped_count} {t.evals.passed}{r.skipped_count ? ` · ${r.skipped_count} ${t.evals.skipped}` : ""}</span>
                </div>
                <span className="tiny muted">{fmtDate(r.created_at, locale)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
