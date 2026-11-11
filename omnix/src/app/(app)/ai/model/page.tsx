import { CreateModel } from "@/components/CreateModel";
import { ModelSettings } from "@/components/ModelSettings";
import { PageHead, StatusBadge } from "@/components/ui";
import { loadPrimaryModel } from "@/lib/server/data";
import { getDict, requireSession } from "@/lib/server/session";

export const metadata = { title: "Model" };

export default async function ModelPage() {
  const s = await requireSession();
  const { t } = await getDict();
  const m = await loadPrimaryModel(s);
  if (!m) return (<><PageHead title={t.model.title} /><CreateModel t={t} /></>);
  const v = m.deployed ?? m.versions[0]!;
  return (
    <>
      <PageHead
        title={t.model.title}
        subtitle={`${m.profile.displayName} · ${t.common.version} ${v.version} · ${v.baseModel}${v.adapterName ? ` + LoRA` : ""}`}
        actions={<StatusBadge status={m.deployed ? "deployed" : "draft"} label={m.deployed ? `live v${m.deployed.version}` : t.chat.preview} />}
      />
      <ModelSettings t={t} profile={m.profile} />
    </>
  );
}
