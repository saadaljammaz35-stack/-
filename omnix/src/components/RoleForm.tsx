"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Dict } from "@/lib/i18n";

export function RoleRow({ t, role, modelId, versions, current }: {
  t: Dict;
  role: "default" | "coding" | "reasoning" | "arabic" | "personal_assistant";
  modelId: string;
  versions: { id: string; version: string }[];
  current: { modelVersionId: string | null; temperature: number | null } | null;
}) {
  const router = useRouter();
  const [v, setV] = useState(current?.modelVersionId ?? "");
  const [temp, setTemp] = useState(current?.temperature?.toString() ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <tr>
      <td data-label={t.deploy.roles}><strong>{t.deploy.roleNames[role]}</strong> <span className="mono ltr tiny muted">{role}</span></td>
      <td data-label={t.deploy.pin}><select className="select" value={v} onChange={(e) => setV(e.target.value)}><option value="">{t.deploy.latest}</option>{versions.map((x) => <option key={x.id} value={x.id}>v{x.version}</option>)}</select></td>
      <td data-label={t.model.temperature}><input className="input num ltr" style={{ width: 90 }} type="number" min={0} max={2} step={0.05} value={temp} placeholder="—" onChange={(e) => setTemp(e.target.value)} /></td>
      <td data-label={t.common.actions}>
        <button className="btn sm" onClick={async () => {
          try {
            await api("/api/ai/roles", { method: "PUT", body: { role, modelProfileId: modelId, modelVersionId: v || null, temperature: temp === "" ? null : Number(temp) } });
            setMsg(t.common.saved);
            router.refresh();
          } catch (er) { setMsg(er instanceof ApiError ? er.message : t.common.error); }
        }}>{t.common.save}</button>
        {msg && <span className="tiny muted"> {msg}</span>}
      </td>
    </tr>
  );
}
