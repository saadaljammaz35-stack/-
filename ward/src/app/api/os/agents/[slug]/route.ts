import { respond, readBody, route, notFound } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { updateAgent } from '@/lib/services/admin';
import { AGENT_BY_SLUG, type AgentSlug } from '@/lib/agents/definitions';
import type { Params } from '@/lib/api';

export const POST = route<Params<'slug'>>(async (req, ctx) => {
  const s = await requireApi(req, 'agents.configure');
  const { slug } = await ctx.params;
  if (!AGENT_BY_SLUG[slug as AgentSlug]) throw notFound();
  const body = await readBody(req);
  if (body.tools_form === '1' && body.allowed_tools === undefined) body.allowed_tools = []; // all boxes unchecked
  await updateAgent(s, slug as AgentSlug, body);
  return respond(req, { ok: true }, { redirect: `/os/agents/${slug}?saved=1` });
});
