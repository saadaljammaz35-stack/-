import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiButton, AutoRefresh } from "@/components/ApiButton";
import { LossChart } from "@/components/LossChart";
import { PageHead, Stat, StatusBadge, fmtDate, fmtNumber } from "@/components/ui";
import { getJobDetail } from "@/lib/ai/training/jobs";
import { withUser } from "@/lib/db/pool";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Training job" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  const { t, locale } = await getDict();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await withUser(s.auth.userId, (db) => getJobDetail(db, id)).catch(() => null);
  if (!d) notFound();
  const { job, metrics, logs } = d;
  const live = ["queued", "claimed", "running"].includes(job.status);
  const m = job.metrics as Record<string, number | string | undefined>;
  const hp = (job.configuration.hyperparameters ?? {}) as Record<string, number>;
  const byStep = new Map<number, { step: number; train: number | null; eval: number | null }>();
  for (const r of metrics) {
    const p = byStep.get(r.step) ?? { step: r.step, train: null, eval: null };
    if (r.train_loss !== null) p.train = Number(r.train_loss);
    if (r.eval_loss !== null) p.eval = Number(r.eval_loss);
    byStep.set(r.step, p);
  }
  const lastGpu = [...metrics].reverse().find((r) => r.gpu_memory_mb !== null || r.gpu_utilization !== null);
  return (
    <>
      <AutoRefresh active={live} />
      <PageHead
        title={`${t.training.title} · ${job.baseModel}`}
        subtitle={job.statusReason ?? undefined}
        actions={<>
          <StatusBadge status={job.status} />
          {live && <ApiButton path={`/api/ai/training/jobs/${job.id}/cancel`} confirm={t.training.cancelJob + "?"} className="btn sm danger">{t.training.cancelJob}</ApiButton>}
          <Link className="btn sm" href="/ai/training">{t.common.back}</Link>
        </>}
      />
      {job.status === "unavailable" && <div className="alert warn" style={{ marginBottom: 16 }}>{t.dashboard.gpuNone}</div>}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between"><span>{t.training.progress}</span><span className="num">{Math.round(job.progress * 100)}%</span></div>
        <div className="progress" style={{ marginTop: 8 }}><i style={{ width: `${Math.round(job.progress * 100)}%` }} /></div>
      </div>
      <div className="grid grid-4">
        <Stat label={t.training.trainLoss} value={m.trainLoss !== undefined ? Number(m.trainLoss).toFixed(4) : "—"} />
        <Stat label={t.training.evalLoss} value={m.validationLoss !== undefined ? Number(m.validationLoss).toFixed(4) : "—"} hint={m.testLoss !== undefined ? `test ${Number(m.testLoss).toFixed(4)}` : undefined} />
        <Stat label={t.training.steps} value={m.steps ?? "—"} hint={m.trainRuntimeSeconds !== undefined ? `${m.trainRuntimeSeconds}s` : undefined} />
        <Stat label="Tokens" value={fmtNumber(Number(m.trainTokens ?? NaN), locale)} hint={m.trainableParameters !== undefined ? `${fmtNumber(Number(m.trainableParameters), locale)} trainable params` : undefined} />
      </div>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <section className="card"><h2>{t.training.loss}</h2><LossChart points={[...byStep.values()]} labels={{ train: t.training.trainLoss, eval: t.training.evalLoss }} /></section>
        <section className="card stack">
          <h2>{t.training.hardware}</h2>
          <div className="small">{job.hardware ? ((job.hardware as { cuda_available?: boolean }).cuda_available ? "CUDA GPU" : "CPU (smoke run)") : "—"}{job.workerId ? <> · <span className="mono ltr">{job.workerId}</span></> : null}</div>
          {lastGpu && <div className="small num">GPU {lastGpu.gpu_utilization ?? "—"}% · {lastGpu.gpu_memory_mb ?? "—"} MB</div>}
          <div className="divider" />
          <div className="small"><b>{t.training.method}:</b> {job.trainingMethod.toUpperCase()} · r={hp.loraR} α={hp.loraAlpha} · lr={hp.learningRate} · {t.training.epochs} {hp.epochs} · batch {hp.batchSize}×{hp.gradientAccumulationSteps} · seq {hp.maxSeqLength}</div>
          <div className="small"><b>{t.training.dataset}:</b> {String(job.datasetSnapshot.name ?? "")} · <span className="mono ltr tiny">{job.datasetSnapshotHash.slice(0, 16)}…</span></div>
          {job.artifactUri && <div className="small"><b>{t.training.artifact}:</b> <span className="mono ltr tiny">{job.artifactUri}</span>{m.adapterSha256 ? <div className="mono ltr tiny muted">sha256 {String(m.adapterSha256).slice(0, 24)}…</div> : null}</div>}
          {job.resultVersionId && <Link className="btn sm primary" href="/ai/versions">{t.training.result}</Link>}
          <div className="tiny muted">{fmtDate(job.createdAt, locale)} → {fmtDate(job.completedAt, locale)}</div>
        </section>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t.training.logs}</h2>
        <pre className="mono small ltr" style={{ maxHeight: 320, overflow: "auto", margin: 0, whiteSpace: "pre-wrap" }}>
          {logs.map((l) => `${new Date(l.created_at).toISOString().slice(11, 19)} ${l.level.toUpperCase().padEnd(7)} ${l.message}`).join("\n") || "—"}
        </pre>
      </section>
    </>
  );
}
