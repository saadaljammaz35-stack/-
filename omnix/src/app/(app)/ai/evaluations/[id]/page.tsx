import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/ApiButton";
import { PageHead, StatusBadge } from "@/components/ui";
import { withUser } from "@/lib/db/pool";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Evaluation run" };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await requireSession();
  const { t } = await getDict();
  const d = await withUser(s.auth.userId, async (db) => {
    const r = await db.query("SELECT r.*, v.version FROM ai_evaluation_runs r JOIN ai_model_versions v ON v.id = r.model_version_id WHERE r.id = $1", [id]);
    if (!r.rowCount) return null;
    const c = await db.query("SELECT * FROM ai_evaluation_cases WHERE evaluation_run_id = $1 ORDER BY created_at", [id]);
    return { run: r.rows[0], cases: c.rows };
  });
  if (!d) notFound();
  const { run, cases } = d;
  const cats = (run.results?.categories ?? {}) as Record<string, { passed: number; evaluated: number; skipped: number; rate: number | null; threshold: number; met: boolean | null }>;
  return (
    <>
      <AutoRefresh active={run.status === "queued" || run.status === "running"} />
      <PageHead title={`${t.evals.title} · v${run.version}`} subtitle={`${run.suite_version} · ${run.results?.provider ?? ""} ${run.results?.model ?? ""}`} actions={<><StatusBadge status={run.status} /><Link className="btn sm" href="/ai/evaluations">{t.common.back}</Link></>} />
      {run.error && <div className="alert bad" style={{ marginBottom: 16 }}>{run.error}</div>}
      <section className="card">
        <h2>{t.evals.score}: <span className="num">{run.score === null ? "—" : `${Math.round(Number(run.score) * 100)}%`}</span> <span className="muted small num">({run.passed_count}/{run.total_count - run.skipped_count})</span></h2>
        <table className="table responsive">
          <thead><tr><th>{t.evals.category}</th><th>{t.evals.passed}</th><th>{t.evals.threshold}</th><th>{t.common.status}</th></tr></thead>
          <tbody>{Object.entries(cats).map(([k, c]) => (
            <tr key={k}>
              <td data-label={t.evals.category}>{k.replace(/_/g, " ")}</td>
              <td data-label={t.evals.passed} className="num">{c.passed}/{c.evaluated}{c.skipped ? ` (+${c.skipped} ${t.evals.skipped})` : ""}</td>
              <td data-label={t.evals.threshold} className="num">{Math.round(c.threshold * 100)}%</td>
              <td data-label={t.common.status}>{c.met === null ? <span className="badge">{t.evals.skipped}</span> : <StatusBadge status={c.met ? "passed" : "failed"} />}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t.evals.cases} <span className="muted num">({cases.length})</span></h2>
        <div className="list">
          {cases.map((c) => (
            <details key={c.id} className="list-item" style={{ display: "block" }}>
              <summary className="row" style={{ cursor: "pointer" }}>
                {c.passed === null ? <span className="badge">{t.evals.skipped}</span> : <StatusBadge status={c.passed ? "passed" : "failed"} />}
                <span className="mono ltr small">{c.case_key}</span><span className="muted small">{c.category}</span>
                {c.latency_ms !== null && <span className="tiny muted num">{c.latency_ms} ms</span>}
              </summary>
              <div className="stack small" style={{ marginTop: 8 }}>
                <div dir="auto"><b>Input:</b> {c.input}</div>
                <div dir="auto"><b>{t.evals.expected}:</b> {c.expected_output}</div>
                <div dir="auto" style={{ whiteSpace: "pre-wrap" }}><b>{t.evals.actual}:</b> {c.actual_output || "—"}</div>
                <div className="muted">{c.detail?.reason ?? c.detail?.skipped ?? c.detail?.error ?? ""}</div>
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
