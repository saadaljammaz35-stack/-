import { z } from 'zod';
import { notFound, readBody, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { enforce, LIMITS } from '@/lib/security/rate-limit';
import { streamAgentChat } from '@/lib/agents/runner';
import { AGENT_BY_SLUG, type AgentSlug } from '@/lib/agents/definitions';
import type { Params } from '@/lib/api';

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(8000) })).min(1).max(30),
});

/** Streams the agent's reply as plain text chunks (no tools: chat never acts). */
export const POST = route<Params<'slug'>>(async (req, ctx) => {
  const s = await requireApi(req, 'agents.run');
  await enforce(`ai:${s.userId}`, LIMITS.aiPerUser.limit, LIMITS.aiPerUser.windowSec);
  const { slug } = await ctx.params;
  if (!AGENT_BY_SLUG[slug as AgentSlug]) throw notFound();
  const { messages } = Body.parse(await readBody(req));
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of streamAgentChat(s, slug as AgentSlug, messages)) controller.enqueue(encoder.encode(delta));
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n⚠️ ${err instanceof Error ? err.message.split('\n')[0] : 'error'}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
});
