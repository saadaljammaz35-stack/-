import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { withOrg, type OrgContext } from '@/lib/db';
import { audit } from '@/lib/audit';
import { getSettings } from '@/lib/settings';
import { badRequest, conflict, forbidden, notFound } from '@/lib/http';
import { notify } from '@/lib/notifications';
import { searchKnowledge } from '@/lib/knowledge';
import { cancelJobsFor, enqueue } from '@/lib/queue';
import { wrapUntrusted } from '@/lib/security/untrusted';
import { AGENTS, AGENT_BY_SLUG, type AgentSlug } from '@/lib/agents/definitions';
import { runAgent, runAgentStructured } from '@/lib/agents/runner';

const SLUGS = AGENTS.map((a) => a.slug) as [AgentSlug, ...AgentSlug[]];

export const SynthesisSchema = z.object({
  summary: z.string().min(10).max(5000),
  recommendations: z.array(z.string().max(900)).max(12),
  disagreements: z
    .array(z.object({ topic: z.string().max(300), positions: z.array(z.object({ agent: z.enum(SLUGS), position: z.string().max(700) })).max(9) }))
    .max(10),
  proposed_decisions: z.array(z.object({ title: z.string().min(3).max(300), rationale: z.string().max(1200) })).max(10),
  tasks: z
    .array(
      z.object({
        title: z.string().min(3).max(200),
        description: z.string().max(1500),
        owner: z.enum(SLUGS),
        priority: z.enum(['low', 'medium', 'high', 'urgent']),
        due_in_days: z.number().int().min(0).max(120).nullable(),
      }),
    )
    .max(15),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;

export async function startMeeting(ctx: OrgContext, input: { topic: string; agents: AgentSlug[]; rounds: number }): Promise<string> {
  const agents = [...new Set(input.agents)];
  if (agents.length < 2 || agents.length > 9) throw badRequest('meeting_needs_2_to_9_agents');
  if (input.rounds < 1 || input.rounds > 3) throw badRequest('rounds_1_to_3');
  return withOrg(ctx, async (q) => {
    const s = await getSettings(q, ctx.orgId);
    if (s.agents_paused) throw forbidden('agents_paused');
    const ids = await q.query<{ id: string; slug: AgentSlug }>(`select id, slug from ward.ai_agents where slug = any($1::text[])`, [`{${agents.join(',')}}`]);
    const ordered = agents.map((slug) => ids.find((r) => r.slug === slug)?.id).filter((x): x is string => Boolean(x));
    const rows = await q.query<{ id: string }>(
      `insert into ward.meetings (org_id, topic, agent_ids, rounds, cost_limit_usd, created_by) values ($1,$2,$3::uuid[],$4,$5,$6) returning id`,
      [ctx.orgId, input.topic.trim(), `{${ordered.join(',')}}`, input.rounds, s['limits.meeting_usd'], ctx.userId],
    );
    const id = rows[0]!.id;
    await enqueue(q, ctx.orgId, 'meeting.run', { meetingId: id }, { idempotencyKey: `mt:${id}:start` });
    await audit(q, ctx, 'meeting.started', { type: 'meeting', id }, { topic: input.topic.slice(0, 200), agents, rounds: input.rounds });
    return id;
  });
}

export async function cancelMeeting(ctx: OrgContext, id: string): Promise<void> {
  await withOrg(ctx, async (q) => {
    const rows = await q.query(`update ward.meetings set status = 'cancelled', finished_at = now() where id = $1 and status in ('queued','running') returning id`, [id]);
    if (!rows.length) {
      if (!(await q.query('select 1 from ward.meetings where id = $1', [id])).length) throw notFound();
      throw conflict('not_cancellable');
    }
    await cancelJobsFor(q, 'meetingId', id);
    await audit(q, ctx, 'meeting.cancelled', { type: 'meeting', id });
  });
}

interface MeetingRow {
  id: string;
  topic: string;
  rounds: number;
  status: string;
  agent_ids: string[];
}

export async function runMeeting(orgId: string, id: string): Promise<void> {
  const ctx: OrgContext = { orgId, userId: null, role: 'system' };
  const owner = randomUUID();
  const meeting = await withOrg(ctx, async (q) => {
    const rows = await q.query<MeetingRow>(
      `update ward.meetings set status = 'running', lease_owner = $2, lease_until = now() + interval '15 minutes'
        where id = $1 and status in ('queued','running') and (lease_until is null or lease_until < now())
        returning id, topic, rounds, status, agent_ids`,
      [id, owner],
    );
    return rows[0] ?? null;
  });
  if (!meeting) return;

  const isCancelled = async () =>
    (await withOrg(ctx, (q) => q.query<{ status: string }>('select status from ward.meetings where id = $1', [id])))[0]?.status === 'cancelled';

  try {
    const { participants, grounding, transcript } = await withOrg(ctx, async (q) => {
      const participants = await q.query<{ id: string; slug: AgentSlug }>(`select id, slug from ward.ai_agents where id = any($1::uuid[])`, [`{${meeting.agent_ids.join(',')}}`]);
      const hits = await searchKnowledge(q, meeting.topic, 5);
      const transcript = await q.query<{ agent_id: string; round: number; content: string }>(
        'select agent_id, round, content from ward.meeting_messages where meeting_id = $1 order by id',
        [id],
      );
      return {
        participants: meeting.agent_ids.map((aid) => participants.find((p) => p.id === aid)!).filter(Boolean),
        grounding: hits.map((h) => `- [${h.title}] ${h.content.slice(0, 600)}`).join('\n'),
        transcript,
      };
    });
    const slugOf = new Map(participants.map((p) => [p.id, p.slug]));
    const render = () =>
      transcript.map((m) => `[جولة ${m.round}] ${AGENT_BY_SLUG[slugOf.get(m.agent_id)!]?.name ?? 'agent'}:\n${wrapUntrusted(`meeting:${slugOf.get(m.agent_id)}`, m.content, 2500)}`).join('\n\n');

    for (let round = 1; round <= meeting.rounds; round++) {
      for (const p of participants) {
        if (transcript.some((m) => m.round === round && m.agent_id === p.id)) continue; // resumed meeting
        if (await isCancelled()) return;
        const task = [
          `اجتماع وارد — الموضوع: ${meeting.topic}`,
          `من الذاكرة المؤسسية:\n${grounding || '- لا شيء ذو صلة'}`,
          transcript.length ? `ما قيل حتى الآن:\n${render()}` : '',
          round === 1
            ? 'قدّم رأيك من منظور تخصصك فقط: موقفك، مقترحاتك المحددة، والمخاطر. 200 كلمة كحد أقصى.'
            : `الجولة ${round} من ${meeting.rounds}: ناقش آراء الزملاء بالاسم — اتفق أو اختلف مع الأسباب، وعدّل موقفك إن اقتنعت. 150 كلمة كحد أقصى.`,
          'لا تختلق حقائق؛ إن احتجت معلومة غير متوفرة فقل ذلك.',
        ].filter(Boolean).join('\n\n');
        const result = await runAgent({ ctx, agent: p.slug, purpose: 'meeting', task, tier: 'economy', useTools: false, meetingId: id, isCancelled });
        await withOrg(ctx, (q) =>
          q.query('insert into ward.meeting_messages (org_id, meeting_id, agent_id, round, content) values ($1,$2,$3,$4,$5)', [orgId, id, p.id, round, result.output]),
        );
        transcript.push({ agent_id: p.id, round, content: result.output });
      }
    }
    if (await isCancelled()) return;

    const { data } = await runAgentStructured({
      ctx,
      agent: 'chief',
      purpose: 'meeting_synthesis',
      task: [
        `الموضوع: ${meeting.topic}`,
        `محضر الاجتماع:\n${render()}`,
        'لخص الاجتماع للمؤسس: الملخص، التوصيات، نقاط الاختلاف ومواقف كل وكيل، القرارات المقترحة (تحتاج اعتماد المؤسس)، والمهام الناتجة مع المسؤول (owner = slug الوكيل) والأولوية. لا تضف ما لم يُقل في الاجتماع.',
      ].join('\n\n'),
      name: 'meeting_synthesis',
      schema: SynthesisSchema,
      meetingId: id,
    });

    await withOrg(ctx, async (q) => {
      const agentIds = new Map((await q.query<{ id: string; slug: AgentSlug }>('select id, slug from ward.ai_agents')).map((a) => [a.slug, a.id]));
      await q.query(
        `update ward.meetings set status = 'completed', summary = $2, recommendations = $3::jsonb, disagreements = $4::jsonb,
                proposed_decisions = $5::jsonb, finished_at = now(), lease_until = null where id = $1 and status = 'running'`,
        [id, data.summary, JSON.stringify(data.recommendations), JSON.stringify(data.disagreements), JSON.stringify(data.proposed_decisions)],
      );
      for (const d of data.proposed_decisions) {
        await q.query(`insert into ward.decisions (org_id, title, details, status, source, meeting_id) values ($1,$2,$3,'proposed','meeting',$4)`, [orgId, d.title, d.rationale, id]);
      }
      for (const t of data.tasks) {
        await q.query(
          `insert into ward.tasks (org_id, title, description, priority, due_at, assignee_agent_id, meeting_id, created_by_agent_id)
           values ($1,$2,$3,$4, case when $5::int is null then null else now() + make_interval(days => $5::int) end, $6, $7, $8)`,
          [orgId, t.title, t.description, t.priority, t.due_in_days, agentIds.get(t.owner) ?? null, id, agentIds.get('chief') ?? null],
        );
      }
      await notify(q, orgId, { kind: 'meeting', title: 'اكتمل الاجتماع', body: meeting.topic.slice(0, 200), link: `/os/meetings/${id}` });
    });
  } catch (err) {
    await withOrg(ctx, async (q) => {
      await q.query(`update ward.meetings set status = 'failed', error = $2, finished_at = now(), lease_until = null where id = $1 and status = 'running'`, [
        id, err instanceof Error ? err.message.slice(0, 1000) : String(err),
      ]);
      await notify(q, orgId, { kind: 'meeting', severity: 'warning', title: 'تعذر إكمال الاجتماع', body: err instanceof Error ? err.message.slice(0, 300) : '', link: `/os/meetings/${id}` });
    });
  }
}
