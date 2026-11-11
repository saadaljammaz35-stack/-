"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";

export function VersionForm({ t, modelId, providers, candidates }: { t: Dict; modelId: string; providers: { id: string; name: string; type: string }[]; candidates: { id: string; ollamaTag?: string }[] }) {
  const router = useRouter();
  const [base, setBase] = useState(candidates[0]?.id ?? "");
  const [prov, setProv] = useState(providers[0]?.id ?? "");
  const [pm, setPm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const ptype = providers.find((p) => p.id === prov)?.type;
  const suggested = ptype === "ollama" ? (candidates.find((c) => c.id === base)?.ollamaTag ?? base) : base;
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      try {
        await api("/api/ai/models/personal/versions", { body: { modelProfileId: modelId, providerId: prov, baseModel: base, providerModel: pm || suggested, bump: f.get("bump"), notes: String(f.get("notes") ?? "") || undefined } });
        router.refresh();
      } catch (er) { setErr(er instanceof ApiError ? er.message : t.common.error); }
    }}>
      <div className="grid grid-2">
        <label className="field"><span>{t.common.baseModel}</span><select className="select ltr" value={base} onChange={(e) => setBase(e.target.value)}>{candidates.map((c) => <option key={c.id}>{c.id}</option>)}</select></label>
        <label className="field"><span>{t.common.provider}</span><select className="select" value={prov} onChange={(e) => setProv(e.target.value)}>{providers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}</select></label>
        <label className="field"><span>Provider model</span><input className="input ltr mono" value={pm} placeholder={suggested} onChange={(e) => setPm(e.target.value)} /></label>
        <label className="field"><span>{t.versions.bump}</span><select className="select" name="bump" defaultValue="minor"><option value="major">major</option><option value="minor">minor</option><option value="patch">patch</option></select></label>
      </div>
      <label className="field"><span>Notes</span><input className="input" name="notes" maxLength={4000} /></label>
      {err && <div className="alert bad small">{err}</div>}
      <button className="btn">{t.common.create}</button>
    </form>
  );
}
