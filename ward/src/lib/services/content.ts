import { z } from 'zod';
import { json, withOrg, type OrgContext } from '@/lib/db';
import { audit } from '@/lib/audit';
import { can } from '@/lib/auth/permissions';
import { badRequest, forbidden, notFound } from '@/lib/http';
import { createDocument } from '@/lib/knowledge';
import { checkbox, lines, optDate, optNumber, optText, optUuid, reqText } from '@/lib/services/forms';

export const EPISODE_STATUSES = ['idea', 'research', 'preparation', 'guest_confirmation', 'ready_to_shoot', 'shooting', 'editing', 'review', 'ready_to_publish', 'published'] as const;

const publishLinks = z.preprocess(
  (v) =>
    (Array.isArray(v) ? v : String(v ?? '').split('\n'))
      .map((line) => (typeof line === 'string' ? line.trim() : line))
      .filter(Boolean)
      .map((line) => {
        if (typeof line !== 'string') return line;
        const [platform, url] = line.includes('|') ? line.split('|').map((s) => s.trim()) : ['link', line];
        return { platform, url };
      }),
  z.array(z.object({ platform: z.string().max(40), url: z.string().url().refine((u) => /^https?:\/\//.test(u), 'http(s) only') })).max(12),
);

export const EpisodeInput = z.object({
  title: reqText(1, 200),
  number: optNumber(1, 10_000),
  topic: optText(500),
  description: optText(10_000),
  status: z.enum(EPISODE_STATUSES).optional(),
  guest_id: optUuid,
  guest_confirmed: checkbox.optional(),
  questions: lines(80, 600).optional(),
  script: optText(100_000),
  shoot_at: optDate,
  publish_at: optDate,
  estimated_cost: optNumber(0, 10_000_000),
  marketing_notes: optText(20_000),
  approval_status: z.enum(['draft', 'pending', 'approved', 'rejected']).optional(),
  publish_links: publishLinks.optional(),
});

export async function createEpisode(ctx: OrgContext, raw: unknown): Promise<string> {
  if (!can(ctx.role, 'content.write')) throw forbidden();
  const e = EpisodeInput.parse(raw);
  if (e.guest_confirmed || e.status === 'published' || e.approval_status) throw forbidden('use_update_for_founder_fields');
  return withOrg(ctx, async (q) => {
    const rows = await q.query<{ id: string }>(
      `insert into ward.episodes (org_id, number, title, topic, description, status, guest_id, shoot_at, estimated_cost)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [ctx.orgId, e.number ?? null, e.title, e.topic ?? '', e.description ?? '', e.status ?? 'idea', e.guest_id ?? null, e.shoot_at ?? null, e.estimated_cost ?? null],
    );
    await audit(q, ctx, 'episode.created', { type: 'episode', id: rows[0]!.id }, { title: e.title });
    return rows[0]!.id;
  });
}

/**
 * Founder-only rules, enforced here on the server (and by a DB constraint for publishing):
 *   - confirming the guest           → `episodes.confirm_guest` (owner)
 *   - approval status / publishing   → `episodes.publish` (owner); published requires approved
 */
export async function updateEpisode(ctx: OrgContext, id: string, raw: unknown): Promise<void> {
  if (!can(ctx.role, 'content.write')) throw forbidden();
  const e = EpisodeInput.partial().parse(raw);
  if (e.guest_confirmed !== undefined && !can(ctx.role, 'episodes.confirm_guest')) throw forbidden('missing_permission:episodes.confirm_guest');
  if ((e.approval_status !== undefined || e.status === 'published' || e.publish_links !== undefined) && !can(ctx.role, 'episodes.publish')) {
    throw forbidden('missing_permission:episodes.publish');
  }
  await withOrg(ctx, async (q) => {
    const cur = (await q.query<{ approval_status: string; status: string; guest_id: string | null }>('select approval_status, status, guest_id from ward.episodes where id = $1', [id]))[0];
    if (!cur) throw notFound();
    if (e.status === 'published' && (e.approval_status ?? cur.approval_status) !== 'approved') throw badRequest('publish_requires_founder_approval');
    if (e.guest_confirmed && !(e.guest_id ?? cur.guest_id)) throw badRequest('no_guest_to_confirm');
    const map: Record<string, unknown> = {
      title: e.title, number: e.number, topic: e.topic, description: e.description, status: e.status, guest_id: e.guest_id,
      guest_confirmed: e.guest_confirmed, script: e.script, shoot_at: e.shoot_at, publish_at: e.publish_at, estimated_cost: e.estimated_cost,
      approval_status: e.approval_status,
    };
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const [col, val] of Object.entries(map)) {
      if (val === undefined) continue;
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    }
    if (e.questions !== undefined) sets.push(`questions = $${params.push(json(e.questions))}::jsonb`);
    if (e.publish_links !== undefined) sets.push(`publish_links = $${params.push(json(e.publish_links))}::jsonb`);
    if (e.marketing_notes !== undefined) sets.push(`marketing = marketing || jsonb_build_object('notes', $${params.push(e.marketing_notes ?? '')}::text)`);
    if (!sets.length) return;
    await q.query(`update ward.episodes set ${sets.join(', ')} where id = $1`, params);
    if (e.guest_confirmed !== undefined) {
      const guestId = e.guest_id ?? cur.guest_id;
      if (guestId) await q.query(`update ward.guests set status = $2 where id = $1`, [guestId, e.guest_confirmed ? 'confirmed' : 'proposed']);
    }
    await audit(q, ctx, e.status === 'published' ? 'episode.published' : 'episode.updated', { type: 'episode', id }, { fields: Object.keys(e) });
  });
}

export async function linkSponsor(ctx: OrgContext, episodeId: string, sponsorId: string, placement: string, unlink = false): Promise<void> {
  if (!can(ctx.role, 'sponsors.write')) throw forbidden();
  await withOrg(ctx, async (q) => {
    if (unlink) await q.query('delete from ward.episode_sponsors where episode_id = $1 and sponsor_id = $2', [episodeId, sponsorId]);
    else {
      await q.query(
        `insert into ward.episode_sponsors (org_id, episode_id, sponsor_id, placement) values ($1,$2,$3,$4)
         on conflict (episode_id, sponsor_id) do update set placement = excluded.placement`,
        [ctx.orgId, episodeId, sponsorId, placement.slice(0, 300)],
      );
    }
    await audit(q, ctx, unlink ? 'episode.sponsor_unlinked' : 'episode.sponsor_linked', { type: 'episode', id: episodeId }, { sponsorId });
  });
}

export const GuestInput = z.object({
  name: reqText(1, 200),
  channel: optText(200),
  bio: optText(5000),
  topics: lines(12, 80).optional(),
  status: z.enum(['proposed', 'contacted', 'interested', 'confirmed', 'declined']).optional(),
  is_minor: z.preprocess((v) => (v === '' || v == null ? null : v === true || v === 'true' || v === 'yes'), z.boolean().nullable()).optional(),
  guardian_consent: checkbox.optional(),
  contact_email: z.preprocess((v) => (v === '' ? null : v), z.string().email().nullable()).optional(),
  contact_phone: optText(40),
  notes: optText(5000),
});

export async function saveGuest(ctx: OrgContext, id: string | null, raw: unknown): Promise<string> {
  if (!can(ctx.role, 'content.write')) throw forbidden();
  const g = (id ? GuestInput.partial() : GuestInput).parse(raw);
  if (g.status === 'confirmed' && !can(ctx.role, 'episodes.confirm_guest')) throw forbidden('missing_permission:episodes.confirm_guest');
  return withOrg(ctx, async (q) => {
    const contact = g.contact_email !== undefined || g.contact_phone !== undefined ? json({ email: g.contact_email ?? null, phone: g.contact_phone ?? null }) : null;
    if (!id) {
      const rows = await q.query<{ id: string }>(
        `insert into ward.guests (org_id, name, channel, bio, topics, status, is_minor, guardian_consent, contact, notes)
         values ($1,$2,$3,$4,$5::text[],$6,$7,$8,coalesce($9::jsonb,'{}'::jsonb),$10) returning id`,
        [ctx.orgId, g.name, g.channel ?? null, g.bio ?? '', `{${(g.topics ?? []).map((t) => `"${t.replace(/"/g, '')}"`).join(',')}}`, g.status ?? 'proposed', g.is_minor ?? null, g.guardian_consent ?? false, contact, g.notes ?? ''],
      );
      await audit(q, ctx, 'guest.created', { type: 'guest', id: rows[0]!.id });
      return rows[0]!.id;
    }
    await q.query(
      `update ward.guests set name = coalesce($2, name), channel = coalesce($3, channel), bio = coalesce($4, bio),
              status = coalesce($5, status), is_minor = case when $6::text = 'keep' then is_minor else $7::boolean end,
              guardian_consent = coalesce($8, guardian_consent), contact = coalesce($9::jsonb, contact), notes = coalesce($10, notes)
        where id = $1`,
      [id, g.name ?? null, g.channel ?? null, g.bio ?? null, g.status ?? null, g.is_minor === undefined ? 'keep' : 'set', g.is_minor ?? null, g.guardian_consent ?? null, contact, g.notes ?? null],
    );
    await audit(q, ctx, 'guest.updated', { type: 'guest', id }, { fields: Object.keys(g) });
    return id;
  });
}

export const CalendarInput = z.object({
  title: reqText(1, 200),
  platform: z.enum(['youtube', 'podcast', 'instagram', 'tiktok', 'x', 'website', 'other']),
  scheduled_at: optDate,
  status: z.enum(['idea', 'draft', 'ready', 'scheduled', 'published', 'cancelled']).optional(),
  content: optText(10_000),
  episode_id: optUuid,
});

export async function saveCalendarItem(ctx: OrgContext, id: string | null, raw: unknown): Promise<string> {
  if (!can(ctx.role, 'content.write')) throw forbidden();
  const c = (id ? CalendarInput.partial() : CalendarInput).parse(raw);
  if (c.status === 'published' && !can(ctx.role, 'episodes.publish')) throw forbidden('missing_permission:episodes.publish');
  return withOrg(ctx, async (q) => {
    if (!id) {
      const rows = await q.query<{ id: string }>(
        `insert into ward.content_calendar (org_id, title, platform, scheduled_at, status, content, episode_id) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [ctx.orgId, c.title, c.platform, c.scheduled_at ?? null, c.status ?? 'idea', c.content ?? '', c.episode_id ?? null],
      );
      return rows[0]!.id;
    }
    await q.query(
      `update ward.content_calendar set title = coalesce($2, title), platform = coalesce($3, platform), scheduled_at = coalesce($4, scheduled_at),
              status = coalesce($5, status), content = coalesce($6, content) where id = $1`,
      [id, c.title ?? null, c.platform ?? null, c.scheduled_at ?? null, c.status ?? null, c.content ?? null],
    );
    await audit(q, ctx, 'calendar.updated', { type: 'calendar_item', id }, { status: c.status });
    return id;
  });
}

/** Founder decisions also become verified institutional memory, so agents follow them. */
export async function decideDecision(ctx: OrgContext, id: string, approve: boolean): Promise<void> {
  if (!can(ctx.role, 'approvals.decide')) throw forbidden('missing_permission:approvals.decide');
  await withOrg(ctx, async (q) => {
    const rows = await q.query<{ title: string; details: string }>(
      `update ward.decisions set status = $2, decided_by = $3, decided_at = now() where id = $1 and status = 'proposed' returning title, details`,
      [id, approve ? 'approved' : 'rejected', ctx.userId],
    );
    if (!rows.length) throw notFound();
    if (approve) await createDocument(q, ctx, { title: `قرار المؤسس: ${rows[0]!.title}`, category: 'decisions', content: rows[0]!.details || rows[0]!.title, source: 'manual', verified: true });
    await audit(q, ctx, approve ? 'decision.approved' : 'decision.rejected', { type: 'decision', id });
  });
}

export async function createDecision(ctx: OrgContext, raw: unknown): Promise<string> {
  if (!can(ctx.role, 'approvals.decide')) throw forbidden();
  const d = z.object({ title: reqText(3, 300), details: optText(5000) }).parse(raw);
  return withOrg(ctx, async (q) => {
    const rows = await q.query<{ id: string }>(
      `insert into ward.decisions (org_id, title, details, status, source, decided_by, decided_at) values ($1,$2,$3,'approved','founder',$4,now()) returning id`,
      [ctx.orgId, d.title, d.details ?? '', ctx.userId],
    );
    await createDocument(q, ctx, { title: `قرار المؤسس: ${d.title}`, category: 'decisions', content: d.details || d.title, source: 'manual', verified: true });
    await audit(q, ctx, 'decision.recorded', { type: 'decision', id: rows[0]!.id });
    return rows[0]!.id;
  });
}
