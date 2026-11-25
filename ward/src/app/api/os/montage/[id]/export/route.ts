import { badRequest, notFound, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import { withOrg } from '@/lib/db';
import type { Params } from '@/lib/api';
import { exportText, loadProject } from '@/lib/media/montage';

const FORMATS = ['srt', 'chapters', 'cuts', 'source-srt'] as const;

/** Subtitles for the edited episode, YouTube chapters, and the cut list. */
export const GET = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'read');
  const { id } = await ctx.params;
  const f = new URL(req.url).searchParams.get('f') as (typeof FORMATS)[number];
  if (!FORMATS.includes(f)) throw badRequest('unknown_format');
  const p = await withOrg(s, (q) => loadProject(q, id));
  if (!p) throw notFound();
  const out = exportText(p, f);
  return new Response(out.body, {
    headers: {
      'content-type': out.type,
      'content-disposition': `attachment; filename="${out.name}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
});
