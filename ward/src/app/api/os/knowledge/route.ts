import { z } from 'zod';
import { withOrg } from '@/lib/db';
import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { createDocument, KNOWLEDGE_CATEGORIES } from '@/lib/knowledge';

const Body = z.object({
  title: z.string().trim().min(1).max(300),
  category: z.enum(KNOWLEDGE_CATEGORIES),
  content: z.string().trim().min(1).max(200_000),
});

/** Founder-written facts are verified by definition. */
export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'content.write');
  const b = Body.parse(await readBody(req));
  const id = await withOrg(s, (q) => createDocument(q, s, { ...b, source: 'manual', verified: s.role === 'owner' }));
  return respond(req, { id }, { redirect: `/os/knowledge/${id}` });
});
