import Link from "next/link";
import { AutoRefresh } from "@/components/ApiButton";
import { CreateModel } from "@/components/CreateModel";
import { TrainingForm } from "@/components/TrainingForm";
import { Empty, PageHead, StatusBadge, fmtDate } from "@/components/ui";
import { BASE_MODEL_CANDIDATES } from "@/lib/ai/models/catalog";
import { datasetFromRow } from "@/lib/ai/training/datasets";
import { getInfrastructure, jobFromRow } from "@/lib/ai/training/jobs";
import { withUser } from "@/lib/db/pool";
import { loadPrimaryModel } from "@/lib/server/data";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Training Lab" };

export default async function TrainingPage() {
  const s = await requireSession();
  const { t, locale } = await getDict();
  const m = await loadPrimaryModel(s);
  if (!m) return (<><PageHead title={t.training.title} /><CreateModel t={t} /></>);
  const { infra, jobs, datasets } = await withUser(s.auth.userId, async (db) => ({
    infra: await getInfrastructure(db),
    jobs: (await db.query("SELECT * FROM ai_training_jobs WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 50", [s.auth.userId])).rows.map(jobFromRow),
    datasets: (await db.query("SELECT * FROM ai_datasets WHERE owner_id = $1 AND status <> 'archived' ORDER BY created_at DESC", [s.auth.userId])).rows.map(datasetFromRow),
  }));
  const active = jobs.some((j) => ["queued", "claimed", "running"].includes(j.status));
  const textModels = BASE_MODEL_CANDIDATES.filter((c) => !c.architecture.includes("ConditionalGeneration"));
  return (
    <>
      <AutoRefresh active={active} ms={5000} />
      <PageHead title={t.training.title} subtitle={t.training.subtitle} actions={<Link className="btn sm" href="/ai/datasets">{t.nav.datasets}</Link>} />
      <section className="card">
        <h2>{t.training.infra}</h2>
        {infra.gpuAvailable ? <div className="alert ok">{t.dashboard.gpuOk}</div> : <div className="alert warn"><strong>{t.dashboard.gpuNone}</strong><span className="small"> — {infra.cpuWorkerAvailable ? t.training.cpuOnly : t.training.noWorker}</span></div>}
        {infra.workers.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table responsive">
              <thead><tr><th>{t.training.workers}</th><th>GPU</th><th>{t.common.status}</th><th>Software</th></tr></thead>
              <tbody>
                {infra.workers.map((w) => (
                  <tr key={w.workerId}>
                    <td data-label={t.training.workers} className="mono ltr">{w.workerId}</td>
                    <td data-label="GPU">{w.gpus.length ? w.gpus.map((g) => `${g.name} (${Math.round(g.memoryTotalMb / 1024)} GB${g.utilization !== undefined ? `, ${g.utilization}%` : ""})`).join(", ") : "CPU only"}</td>
                    <td data-label={t.common.status}><StatusBadge status={w.online ? "healthy" : "down"} label={w.online ? "online" : `offline · ${fmtDate(w.lastHeartbeatAt, locale)}`} /></td>
                    <td data-label="Software" className="tiny mono ltr">{Object.entries(w.software).map(([k, v]) => `${k} ${v}`).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="grid grid-2" style={{ marginTop: 16, alignItems: "start" }}>
        <section className="card">
          <h2>{t.training.newJob}</h2>
          {datasets.length === 0 ? <Empty><Link className="btn" href="/ai/datasets">{t.datasets.create}</Link></Empty> : (
            <TrainingForm
              t={t}
              modelId={m.profile.id}
              datasets={datasets.map((d) => ({ id: d.id, name: d.name, status: d.status, ready: d.status === "valid" && !!d.rightsConfirmedAt }))}
              baseModels={textModels.map((c) => ({ id: c.id, params: c.parameters, cpuOk: c.parameters < 1e9 }))}
              defaultBase={(m.deployed ?? m.versions[0]!).baseModel}
            />
          )}
        </section>
        <section className="card">
          <h2>{t.training.jobs}</h2>
          {jobs.length === 0 ? <Empty>{t.common.none}</Empty> : (
            <div className="list">
              {jobs.map((j) => (
                <Link key={j.id} href={`/ai/training/${j.id}`} className="list-item">
                  <div className="grow">
                    <div className="row"><StatusBadge status={j.status} /><span className="mono ltr small truncate">{j.baseModel}</span><span className="badge plain">{j.trainingMethod.toUpperCase()}</span></div>
                    <div className="progress" style={{ marginTop: 8 }}><i style={{ width: `${Math.round(j.progress * 100)}%` }} /></div>
                    <div className="tiny muted" style={{ marginTop: 4 }}>{fmtDate(j.createdAt, locale)} · {j.statusReason}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
