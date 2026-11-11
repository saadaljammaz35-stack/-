import { Chat, type UiMessage } from "@/components/Chat";
import { CreateModel } from "@/components/CreateModel";
import { PageHead } from "@/components/ui";
import { withUser } from "@/lib/db/pool";
import { loadPrimaryModel } from "./data";
import { getDict, requireSession } from "./session";

export async function ChatPage({ conversationId }: { conversationId: string | null }) {
  const s = await requireSession();
  const { t } = await getDict();
  const data = await withUser(s.auth.userId, async (db) => {
    const conv = await db.query(
      "SELECT id, title, model_profile_id FROM ai_conversations WHERE owner_id = $1 AND workspace_id = $2 AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 100",
      [s.auth.userId, s.auth.workspaceId],
    );
    const ds = await db.query("SELECT id, name FROM ai_datasets WHERE owner_id = $1 AND status <> 'archived' ORDER BY created_at DESC", [s.auth.userId]);
    let messages: UiMessage[] = [];
    let profileId: string | undefined;
    if (conversationId && /^[0-9a-f-]{36}$/.test(conversationId)) {
      const c = conv.rows.find((x) => x.id === conversationId);
      profileId = c?.model_profile_id;
      if (c) {
        const m = await db.query(
          `SELECT m.id, m.role, m.content, m.status, m.sources, m.usage_metadata, m.rating, v.version FROM ai_messages m
             LEFT JOIN ai_model_versions v ON v.id = m.model_version_id
            WHERE m.conversation_id = $1 AND m.role IN ('user','assistant')
              AND NOT EXISTS (SELECT 1 FROM ai_messages x WHERE x.parent_message_id = m.id)
            ORDER BY m.created_at`,
          [conversationId],
        );
        messages = m.rows.map((r) => ({
          id: r.id, role: r.role, content: r.content, status: r.status === "streaming" ? "cancelled" : r.status, sources: r.sources ?? [],
          version: r.version, usage: r.usage_metadata, rating: r.rating,
        }));
      }
    }
    return { conversations: conv.rows.map((c) => ({ id: c.id, title: c.title })), datasets: ds.rows, messages, profileId };
  });
  const model = await loadPrimaryModel(s, data.profileId);
  if (!model) return (<><PageHead title={t.nav.chat} /><CreateModel t={t} /></>);
  return (
    <Chat
      key={conversationId ?? "new"}
      t={t}
      model={{ id: model.profile.id, displayName: model.profile.displayName, versions: model.versions.map((v) => ({ id: v.id, version: v.version, status: v.status, adapterName: v.adapterName })) }}
      conversations={data.conversations}
      datasets={data.datasets}
      conversationId={conversationId && data.messages.length ? conversationId : null}
      initial={data.messages}
    />
  );
}
