"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";

type V = { id: string; version: string; label: string };

export function StartEval({ t, versions }: { t: Dict; versions: V[] }) {
  const router = useRouter();
  const [v, setV] = useState(versions[0]?.id ?? "");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="row">
      <select className="select" style={{ width: "auto" }} value={v} onChange={(e) => setV(e.target.value)}>
        {versions.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      <button className="btn primary" disabled={!v} onClick={async () => {
        try {
          const r = await api<{ run: { id: string } }>("/api/ai/evaluations", { body: { modelVersionId: v, evaluationType: "full" } });
          router.push(`/ai/evaluations/${r.run.id}`);
        } catch (er) { setErr(er instanceof ApiError ? er.message : t.common.error); }
      }}>{t.evals.run}</button>
      {err && <span className="small" style={{ color: "var(--bad)" }}>{err}</span>}
    </div>
  );
}

type Cmp = { categories: { category: string; baseline: number | null; candidate: number | null; delta: number | null }[]; cases: { caseKey: string; change: string }[]; baseline: { score: number | null }; candidate: { score: number | null } };

export function CompareVersions({ t, versions }: { t: Dict; versions: V[] }) {
  const [a, setA] = useState(versions.at(-1)?.id ?? "");
  const [b, setB] = useState(versions[0]?.id ?? "");
  const [res, setRes] = useState<Cmp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
  return (
    <div className="stack">
      <div className="row">
        <label className="field"><span>{t.evals.baseline}</span><select className="select" value={a} onChange={(e) => setA(e.target.value)}>{versions.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
        <label className="field"><span>{t.evals.candidate}</span><select className="select" value={b} onChange={(e) => setB(e.target.value)}>{versions.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
        <button className="btn" style={{ alignSelf: "end" }} onClick={async () => {
          setErr(null);
          try { setRes(await api<Cmp>(`/api/ai/evaluations/compare?baseline=${a}&candidate=${b}`)); } catch (er) { setRes(null); setErr(er instanceof ApiError ? er.message : t.common.error); }
        }}>{t.evals.compare}</button>
      </div>
      {err && <div className="alert warn small">{err}</div>}
      {res && (
        <>
          <div className="row"><span className="badge plain">{t.evals.baseline} {pct(res.baseline.score)}</span><span className="badge accent plain">{t.evals.candidate} {pct(res.candidate.score)}</span>
            <span className="badge ok plain">{res.cases.filter((c) => c.change === "improved").length} {t.evals.improved}</span>
            <span className="badge bad plain">{res.cases.filter((c) => c.change === "regressed").length} {t.evals.regressed}</span></div>
          <table className="table responsive">
            <thead><tr><th>{t.evals.category}</th><th>{t.evals.baseline}</th><th>{t.evals.candidate}</th><th>Δ</th></tr></thead>
            <tbody>{res.categories.map((c) => (
              <tr key={c.category}><td data-label={t.evals.category}>{c.category.replace(/_/g, " ")}</td><td data-label={t.evals.baseline} className="num">{pct(c.baseline)}</td><td data-label={t.evals.candidate} className="num">{pct(c.candidate)}</td>
                <td data-label="Δ" className="num" style={{ color: c.delta === null ? undefined : c.delta > 0 ? "var(--ok)" : c.delta < 0 ? "var(--bad)" : undefined }}>{c.delta === null ? "—" : `${c.delta > 0 ? "+" : ""}${Math.round(c.delta * 100)}`}</td></tr>
            ))}</tbody>
          </table>
        </>
      )}
    </div>
  );
}
