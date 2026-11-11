"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";

export function TrainingForm({ t, modelId, datasets, baseModels, defaultBase }: {
  t: Dict;
  modelId: string;
  datasets: { id: string; name: string; status: string; ready: boolean }[];
  baseModels: { id: string; params: number; cpuOk: boolean }[];
  defaultBase: string;
}) {
  const router = useRouter();
  const [base, setBase] = useState(defaultBase);
  const [method, setMethod] = useState<"lora" | "qlora">("qlora");
  const [cpu, setCpu] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const cpuOk = baseModels.find((b) => b.id === base)?.cpuOk ?? false;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => Number(f.get(k));
    try {
      const r = await api<{ job: { id: string }; infrastructure: { message: string | null } }>("/api/ai/training/jobs", {
        body: {
          modelProfileId: modelId, datasetId: f.get("dataset"), baseModel: base, method: cpu ? "lora" : method, allowCpu: cpu,
          hyperparameters: {
            epochs: n("epochs"), learningRate: n("lr"), batchSize: n("batch"), gradientAccumulationSteps: n("gradAcc"),
            maxSeqLength: n("seq"), loraR: n("loraR"), loraAlpha: n("loraAlpha"), loraDropout: 0.05, warmupRatio: 0.03, seed: 42,
            ...(f.get("maxSteps") ? { maxSteps: n("maxSteps") } : {}),
          },
        },
      });
      router.push(`/ai/training/${r.job.id}`);
    } catch (err) {
      setMsg({ text: err instanceof ApiError ? err.message : t.common.error, bad: true });
    }
  }

  const num = (name: string, label: string, def: number, step: string | number = 1) => (
    <label className="field"><span>{label}</span><input className="input num ltr" name={name} type="number" defaultValue={def} step={step} required /></label>
  );

  return (
    <form className="stack" onSubmit={submit}>
      <div className="grid grid-2">
        <label className="field"><span>{t.training.dataset}</span>
          <select className="select" name="dataset" required>
            {datasets.map((d) => <option key={d.id} value={d.id} disabled={!d.ready}>{d.name}{d.ready ? "" : ` (${d.status})`}</option>)}
          </select>
        </label>
        <label className="field"><span>{t.common.baseModel}</span>
          <select className="select ltr" value={base} onChange={(e) => { setBase(e.target.value); setCpu(false); }}>
            {baseModels.map((b) => <option key={b.id} value={b.id}>{b.id} · {(b.params / 1e9).toFixed(1)}B</option>)}
          </select>
        </label>
      </div>
      <div className="field"><span>{t.training.method}</span>
        <div className="segmented">
          {(["qlora", "lora"] as const).map((m) => <button key={m} type="button" aria-pressed={(cpu ? "lora" : method) === m} disabled={cpu && m === "qlora"} onClick={() => setMethod(m)}>{m.toUpperCase()}</button>)}
        </div>
      </div>
      <div className="grid grid-4">
        {num("epochs", t.training.epochs, 3, 0.1)}
        {num("lr", t.training.lr, 0.0002, "any")}
        {num("batch", t.training.batch, 4)}
        {num("gradAcc", t.training.gradAcc, 4)}
        {num("seq", t.training.seq, 2048)}
        {num("loraR", t.training.loraR, 16)}
        {num("loraAlpha", t.training.loraAlpha, 32)}
        <label className="field"><span>{t.training.steps} (max)</span><input className="input num ltr" name="maxSteps" type="number" min={1} placeholder="—" /></label>
      </div>
      <label className="check" style={{ opacity: cpuOk ? 1 : 0.5 }}>
        <input type="checkbox" checked={cpu} disabled={!cpuOk} onChange={(e) => setCpu(e.target.checked)} />
        <span>{t.training.allowCpu}</span>
      </label>
      {msg && <div className={`alert ${msg.bad ? "bad" : "ok"} small`}>{msg.text}</div>}
      <button className="btn primary" disabled={!datasets.some((d) => d.ready)}>{t.training.start}</button>
    </form>
  );
}
