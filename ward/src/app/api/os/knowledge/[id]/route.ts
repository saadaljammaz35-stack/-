import { z } from 'zod';
import { withOrg } from '@/lib/db';
import { forbidden, notFound, readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { can } from '@/lib/auth/permissions';
import { deleteDocument, KNOWLEDGE_CATEGORIES, updateDocument } from '@/lib/knowledge';
import type { Params } from '@/lib/api';

const Patch = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  category: z.enum(KNOWLEDGE_CATEGORIES).optional(),
  content: z.string().max(200_000).optional(),
  verified: z.preprocess((v) => (v === undefined ? undefined : v === true || v === 'on' || v === 'true'), z.boolean().optional()),
  status: z.enum(['active', 'archived']).optional(),
});

export const POST = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'content.write');
  const { id } = await ctx.params;
  const body = await readBody(req);
  if (body._action === 'delete') {
    if (!can(s.role, 'knowledge.delete')) throw forbidden();
    if (!(await withOrg(s, (q) => deleteDocument(q, s, id)))) throw notFound();
    return respond(req, { ok: true }, { redirect: '/os/knowledge' });
  }
  const patch = Patch.parse(body);
  if (patch.verified !== undefined && s.role !== 'owner') throw forbidden('only_the_founder_verifies_facts');
  if (!(await withOrg(s, (q) => updateDocument(q, s, id, patch)))) throw notFound();
  return respond(req, { ok: true }, { redirect: `/os/knowledge/${id}?saved=1` });
});
