"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ModelProfile } from "@/lib/ai/identity/model-config";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";

const TOOLS = ["knowledge_search", "current_time", "fetch_url"] as const;

export function ModelSettings({ t, profile }: { t: Dict; profile: ModelProfile }) {
  const router = useRouter();
  const [p, setP] = useState(profile);
  const [state, setState] = useState<{ busy?: boolean; ok?: boolean; error?: string }>({});
  const set = <K extends keyof ModelProfile>(k: K, v: ModelProfile[K]) => setP((x) => ({ ...x, [k]: v }));

  async function save() {
    setState({ busy: true });
    try {
      await api(`/api/ai/models/${p.id}`, {
        method: "PATCH",
        body: {
          displayName: p.displayName, description: p.description, defaultLanguage: p.defaultLanguage, personality: p.personality,
          systemPrompt: p.systemPrompt, temperature: p.temperature, precisionMode: p.precisionMode, responseLength: p.responseLength,
          maxOutputTokens: p.maxOutputTokens, knowledgeMode: p.knowledgeMode, memoryEnabled: p.memoryEnabled, maxToolCalls: p.maxToolCalls,
          configuration: p.configuration,
        },
      });
      setState({ ok: true });
      router.refresh();
    } catch (err) {
      setState({ error: err instanceof ApiError ? `${err.message}${err.details ? `: ${JSON.stringify(err.details)}` : ""}` : t.common.error });
    }
  }

  const seg = <T extends string>(value: T, options: [T, string][], on: (v: T) => void) => (
    <div className="segmented" role="group">
      {options.map(([v, label]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => on(v)}>{label}</button>
      ))}
    </div>
  );

  return (
    <div className="grid grid-2">
      <section className="card stack">
        <h2>{t.model.identity}</h2>
        <label className="field"><span>{t.create.displayName}</span><input className="input" value={p.displayName} maxLength={80} onChange={(e) => set("displayName", e.target.value)} /></label>
        <div className="small muted">slug: <span className="mono ltr">{p.slug}</span> · {t.model.family}: {p.modelFamily}</div>
        <label className="field"><span>{t.create.description}</span><textarea className="textarea" value={p.description} maxLength={2000} onChange={(e) => set("description", e.target.value)} /></label>
        <label className="field"><span>{t.model.personality}</span><textarea className="textarea" dir="auto" value={p.personality} maxLength={4000} placeholder="ذكي، مباشر، دقيق… / Intelligent, direct, accurate…" onChange={(e) => set("personality", e.target.value)} /></label>
        <label className="field"><span>{t.model.systemPrompt}</span><textarea className="textarea" dir="auto" style={{ minHeight: 160 }} value={p.systemPrompt} maxLength={16000} onChange={(e) => set("systemPrompt", e.target.value)} /></label>
        <div className="field"><span>{t.create.language}</span>{seg(p.defaultLanguage, [["ar", "العربية"], ["en", "English"], ["auto", "Auto"]], (v) => set("defaultLanguage", v))}</div>
      </section>
      <section className="card stack">
        <h2>{t.model.behaviour}</h2>
        <label className="field">
          <span>{t.model.temperature}: <span className="num">{p.temperature.toFixed(2)}</span></span>
          <input className="range" type="range" min={0} max={1.5} step={0.05} value={p.temperature} onChange={(e) => set("temperature", Number(e.target.value))} />
        </label>
        <div className="field"><span>{t.model.precision}</span>{seg(p.precisionMode, [["strict", t.model.strict], ["balanced", t.model.balanced], ["creative", t.model.creative]], (v) => set("precisionMode", v))}</div>
        <div className="field"><span>{t.model.length}</span>{seg(p.responseLength, [["short", t.model.short], ["balanced", t.model.balanced], ["detailed", t.model.detailed]], (v) => set("responseLength", v))}</div>
        <label className="field"><span>{t.model.maxTokens}</span><input className="input num" type="number" min={16} max={32768} value={p.maxOutputTokens} onChange={(e) => set("maxOutputTokens", Number(e.target.value))} /></label>
        <div className="field"><span>{t.model.knowledgeMode}</span>{seg(p.knowledgeMode, [["off", t.model.off], ["assist", t.model.assist], ["strict", t.model.strictKnowledge]], (v) => set("knowledgeMode", v))}</div>
        <label className="field"><span>{t.model.retrievalTopK}</span><input className="input num" type="number" min={1} max={20} value={p.configuration.retrieval.topK} onChange={(e) => set("configuration", { ...p.configuration, retrieval: { ...p.configuration.retrieval, topK: Number(e.target.value) } })} /></label>
        <label className="check"><input type="checkbox" checked={p.memoryEnabled} onChange={(e) => set("memoryEnabled", e.target.checked)} /><span>{t.model.memory}</span></label>
        <div className="field">
          <span>{t.model.tools}</span>
          {TOOLS.map((tool) => (
            <label key={tool} className="check">
              <input
                type="checkbox"
                checked={p.configuration.tools.allowed.includes(tool)}
                onChange={(e) => {
                  const allowed = e.target.checked ? [...p.configuration.tools.allowed, tool] : p.configuration.tools.allowed.filter((x) => x !== tool);
                  set("configuration", { ...p.configuration, tools: { allowed } });
                }}
              />
              <span className="mono ltr">{tool}</span>
            </label>
          ))}
        </div>
        <label className="field"><span>{t.model.maxTools}</span><input className="input num" type="number" min={0} max={10} value={p.maxToolCalls} onChange={(e) => set("maxToolCalls", Number(e.target.value))} /></label>
      </section>
      <div className="row" style={{ gridColumn: "1 / -1" }}>
        <button className="btn primary" onClick={save} disabled={state.busy}>{state.busy ? t.common.loading : t.common.save}</button>
        {state.ok && <span className="badge ok">{t.common.saved}</span>}
        {state.error && <span className="alert bad small">{state.error}</span>}
      </div>
    </div>
  );
}
