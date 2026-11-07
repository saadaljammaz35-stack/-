import { LimitsForm } from "@/components/admin-client";
import { AdminShell } from "@/components/admin-nav";
import { config } from "@/lib/config";
import { pageAdmin } from "@/lib/page-auth";
import { getLimits } from "@/lib/settings";

export const metadata = { title: "Limits", robots: { index: false } };

export default async function AdminSettings() {
  await pageAdmin();
  const limits = await getLimits();
  const c = config();
  return (
    <AdminShell title="Limits and cost control">
      <p className="muted">The service is free to customers. Each analysis is billed to you by Anthropic, so these limits are your spending controls.
        Current model: <span className="mono">{c.AI_MODEL}</span> (effort {c.AI_EFFORT}). Watch actual spend on the Overview page.</p>
      <div className="card"><LimitsForm initial={limits} /></div>
    </AdminShell>
  );
}
