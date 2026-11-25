import { withOrg } from '@/lib/db';
import { readBody, respond, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';

export const POST = route(async (req: Request) => {
  const s = await requireApi(req, 'read');
  const b = await readBody(req);
  await withOrg(s, (q) =>
    typeof b.id === 'string' && b.id
      ? q.query('update ward.notifications set read_at = now() where id = $1 and read_at is null', [b.id])
      : q.query('update ward.notifications set read_at = now() where read_at is null'),
  );
  return respond(req, { ok: true });
});
