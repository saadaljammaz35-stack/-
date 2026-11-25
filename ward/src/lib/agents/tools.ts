import { z, type ZodType } from 'zod';
import { env } from '@/lib/env';
import { json, withOrg, type OrgContext } from '@/lib/db';
import { audit } from '@/lib/audit';
import { createApproval, type ApprovalAction } from '@/lib/approvals';
import { createDocument, KNOWLEDGE_CATEGORIES, searchKnowledge } from '@/lib/knowledge';
import { wrapUntrusted } from '@/lib/security/untrusted';
import { jsonSchemaOf } from '@/lib/ai/gateway';
import type { ToolSpec } from '@/lib/ai/types';
import type { AgentSlug } from '@/lib/agents/definitions';

export interface ToolEnv {
  ctx: OrgContext;
  agentId: string;
  agentSlug: AgentSlug;
  agentRunId: string;
  workflowId: string | null;
}

export interface ToolDef<A = Record<string, unknown>> {
  name: string;
  description: string;
  schema: ZodType<A>;
  /** Sensitive tools never act: they only file an approval request for the founder. */
  approval?: ApprovalAction;
  run(env: ToolEnv, args: A): Promise<unknown>;
}

const uuid = z.string().uuid();
const agentCtx = (e: ToolEnv) => e.ctx;

function define<A>(def: ToolDef<A>): ToolDef<A> {
  return def;
}

/** Turns a sensitive request into a pending approval and tells the model plainly that nothing happened yet. */
async function fileApproval(e: ToolEnv, action: ApprovalAction, title: string, summary: string, target: string, payload: Record<string, unknown>, cost?: number | null) {
  const id = await withOrg(agentCtx(e), (q) =>
    createApproval(q, e.ctx, { action, title, summary, target, payload, estimatedCost: cost ?? null, agentId: e.agentId, workflowId: e.workflowId, agentRunId: e.agentRunId }),
  );
  return {
    approval_requested: true,
    approval_id: id,
    executed: false,
    message: 'تم إنشاء طلب موافقة للمؤسس. لم يُنفذ الإجراء، ولا تقل إنه نُفذ.',
  };
}

export const TOOLS: ToolDef<never>[] = [
  define({
    name: 'search_knowledge',
    description: 'Search WARD institutional memory (identity, goals, decisions, policies, past episodes, guests, sponsorships, meetings, uploaded files). Returns cited excerpts.',
    schema: z.object({ query: z.string().min(2).max(300), category: z.enum(KNOWLEDGE_CATEGORIES).optional(), limit: z.number().int().min(1).max(10).optional() }),
    async run(e, a) {
      const hits = await withOrg(agentCtx(e), (q) => searchKnowledge(q, a.query, a.limit ?? 5, a.category));
      if (!hits.length) return { results: [], note: 'لا توجد نتائج في الذاكرة المؤسسية لهذا الاستعلام. لا تفترض معلومات غير موجودة.' };
      return {
        results: hits.map((h) => ({
          source: h.title,
          category: h.category,
          verified_by_founder: h.verified,
          // Uploaded and agent-written material is data, not instructions.
          excerpt: h.source === 'manual' || h.source === 'system' ? h.content : wrapUntrusted(`knowledge:${h.title}`, h.content, 3000),
        })),
      };
    },
  }),
  define({
    name: 'list_episodes',
    description: 'List episodes with status, guest (and whether the guest is confirmed by the founder), shoot date.',
    schema: z.object({ status: z.string().max(40).optional() }),
    async run(e, a) {
      return withOrg(agentCtx(e), (q) =>
        q.query(
          `select e.id, e.number, e.title, e.topic, e.status, e.approval_status, e.guest_confirmed, e.shoot_at, g.name as guest_name, g.status as guest_status
             from ward.episodes e left join ward.guests g on g.id = e.guest_id
            where ($1::text is null or e.status = $1) order by e.created_at desc limit 50`,
          [a.status ?? null],
        ),
      );
    },
  }),
  define({
    name: 'get_episode',
    description: 'Full details of one episode: description, questions, script, marketing notes, linked sponsors, tasks. Guest contact details are never included.',
    schema: z.object({ episode_id: uuid }),
    async run(e, a) {
      return withOrg(agentCtx(e), async (q) => {
        const ep = (await q.query(
          `select e.*, g.name as guest_name, g.channel as guest_channel, g.bio as guest_bio, g.status as guest_status, g.is_minor as guest_is_minor
             from ward.episodes e left join ward.guests g on g.id = e.guest_id where e.id = $1`,
          [a.episode_id],
        ))[0];
        if (!ep) return { error: 'not_found' };
        const sponsors = await q.query(
          `select s.name, s.status, es.placement from ward.episode_sponsors es join ward.sponsors s on s.id = es.sponsor_id where es.episode_id = $1`,
          [a.episode_id],
        );
        const tasks = await q.query(`select title, status, priority, due_at from ward.tasks where episode_id = $1 order by created_at limit 30`, [a.episode_id]);
        return { episode: ep, sponsors, tasks };
      });
    },
  }),
  define({
    name: 'list_guests',
    description: 'List guests (name, channel, topics, status). Contact details are private and not returned.',
    schema: z.object({}),
    async run(e) {
      return withOrg(agentCtx(e), (q) => q.query(`select id, name, channel, bio, topics, status, is_minor, guardian_consent from ward.guests order by created_at desc limit 50`));
    },
  }),
  define({
    name: 'list_sponsors',
    description: 'List sponsors with verification status, category, agreement dates and recorded value (null means not agreed/unknown).',
    schema: z.object({}),
    async run(e) {
      return withOrg(agentCtx(e), (q) =>
        q.query(
          `select s.id, s.name, s.name_pending, s.status, s.category, s.sponsorship_type, s.agreement_start, s.agreement_end,
                  s.value_amount, s.currency, s.visibility_rights, s.logo_use_approved,
                  (select count(*)::int from ward.sponsorship_deliverables d where d.sponsor_id = s.id) as deliverables,
                  (select count(*)::int from ward.sponsorship_deliverables d where d.sponsor_id = s.id and d.status = 'pending' and d.due_at < now()) as overdue
             from ward.sponsors s order by s.created_at`,
        ),
      );
    },
  }),
  define({
    name: 'list_tasks',
    description: 'List tasks, optionally filtered by status.',
    schema: z.object({ status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'blocked']).optional() }),
    async run(e, a) {
      return withOrg(agentCtx(e), (q) =>
        q.query(
          `select t.id, t.title, t.status, t.priority, t.due_at, ag.name as assignee_agent
             from ward.tasks t left join ward.ai_agents ag on ag.id = t.assignee_agent_id
            where ($1::text is null or t.status = $1) order by t.due_at nulls last, t.created_at desc limit 60`,
          [a.status ?? null],
        ),
      );
    },
  }),
  define({
    name: 'get_finance_summary',
    description: 'Budgets, approved/pending expenses, cash vs in-kind revenue and AI spend for the current month. Only recorded figures.',
    schema: z.object({}),
    async run(e) {
      return withOrg(agentCtx(e), async (q) => {
        const budgets = await q.query(`select name, category, period_start, period_end, amount::float8, currency from ward.budgets order by period_start desc limit 20`);
        const expenses = (await q.query<Record<string, unknown>>(
          `select coalesce(sum(amount) filter (where status in ('approved','paid')), 0)::float8 as approved,
                  coalesce(sum(amount) filter (where status = 'pending_approval'), 0)::float8 as pending,
                  count(*)::int as count from ward.expenses where incurred_on >= date_trunc('month', now())`,
        ))[0];
        const revenue = (await q.query<Record<string, unknown>>(
          `select coalesce(sum(amount) filter (where is_cash and status = 'received'), 0)::float8 as cash_received,
                  coalesce(sum(amount) filter (where is_cash and status = 'expected'), 0)::float8 as cash_expected,
                  coalesce(sum(amount) filter (where not is_cash), 0)::float8 as in_kind_value from ward.revenues`,
        ))[0];
        const ai = (await q.query<Record<string, unknown>>(
          `select coalesce(sum(cost_usd), 0)::float8 as usd, count(*)::int as calls from ward.model_usage where created_at >= date_trunc('month', now())`,
        ))[0];
        const perEpisode = await q.query(
          `select e.title, coalesce(sum(x.amount), 0)::float8 as spent, e.estimated_cost::float8 as estimated
             from ward.episodes e left join ward.expenses x on x.episode_id = e.id and x.status in ('approved','paid')
            group by e.id order by e.created_at`,
        );
        return { budgets, month_expenses_sar: expenses, revenue_sar: revenue, ai_cost_this_month: ai, episode_costs: perEpisode };
      });
    },
  }),
  define({
    name: 'list_calendar',
    description: 'List content calendar items.',
    schema: z.object({}),
    async run(e) {
      return withOrg(agentCtx(e), (q) => q.query(`select id, title, platform, scheduled_at, status from ward.content_calendar order by scheduled_at nulls last limit 60`));
    },
  }),
  define({
    name: 'get_system_health',
    description: 'Operational health from real records: failed jobs/workflows in the last 24h, provider errors, pending approvals.',
    schema: z.object({}),
    async run(e) {
      return withOrg(agentCtx(e), async (q) => {
        const r = (await q.query<Record<string, unknown>>(
          `select (select count(*)::int from ward.workflows where status = 'failed' and updated_at > now() - interval '24 hours') as failed_workflows,
                  (select count(*)::int from ward.jobs where status in ('failed','dead') and created_at > now() - interval '24 hours') as failed_jobs,
                  (select count(*)::int from ward.model_usage where not ok and created_at > now() - interval '24 hours') as provider_errors,
                  (select count(*)::int from ward.approvals where status = 'pending') as pending_approvals`,
        ))[0];
        const recentErrors = await q.query(`select provider, model, error, created_at from ward.model_usage where not ok order by created_at desc limit 5`);
        return { ...r, recent_provider_errors: recentErrors };
      });
    },
  }),
  define({
    name: 'site_health_check',
    description: 'Fetch the public WARD site (WARD_SITE_URL) and report HTTP status, response time and basic SEO/security headers. Read-only.',
    schema: z.object({ path: z.string().regex(/^\/[\w\-./]*$/).max(200).optional() }),
    async run(_e, a) {
      const base = env().WARD_SITE_URL;
      if (!base) return { configured: false, note: 'WARD_SITE_URL غير مُعد؛ لا يمكن فحص الموقع.' };
      const url = new URL(a.path ?? '/', base);
      if (url.origin !== new URL(base).origin) return { error: 'outside_site' };
      const started = Date.now();
      try {
        const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'WARD-OS-HealthCheck/1.0' } });
        const body = (await res.text()).slice(0, 20_000);
        const title = body.match(/<title[^>]*>([^<]{0,200})<\/title>/i)?.[1] ?? null;
        return {
          url: url.toString(),
          status: res.status,
          ms: Date.now() - started,
          bytes: body.length,
          title: title ? wrapUntrusted('site:title', title, 200) : null,
          headers: {
            hsts: res.headers.get('strict-transport-security') !== null,
            csp: res.headers.get('content-security-policy') !== null,
            x_frame_options: res.headers.get('x-frame-options'),
            cache_control: res.headers.get('cache-control'),
          },
        };
      } catch (err) {
        return { url: url.toString(), error: err instanceof Error ? err.message : String(err), ms: Date.now() - started };
      }
    },
  }),

  // ── internal writes: safe, logged, reversible by the founder ──
  define({
    name: 'create_task',
    description: 'Create a task on the WARD board, optionally assigned to an agent and linked to an episode.',
    schema: z.object({
      title: z.string().min(3).max(200),
      description: z.string().max(3000).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      due_in_days: z.number().int().min(0).max(365).optional(),
      assignee_agent: z.enum(['chief', 'editorial', 'production', 'marketing', 'business', 'finance', 'relations', 'tech', 'review']).optional(),
      episode_id: uuid.optional(),
    }),
    async run(e, a) {
      return withOrg(agentCtx(e), async (q) => {
        const rows = await q.query<{ id: string }>(
          `insert into ward.tasks (org_id, title, description, priority, due_at, assignee_agent_id, episode_id, workflow_id, created_by_agent_id)
           values ($1,$2,$3,$4, case when $5::int is null then null else now() + make_interval(days => $5::int) end,
                   (select id from ward.ai_agents where slug = $6), $7, $8, $9) returning id`,
          [e.ctx.orgId, a.title, a.description ?? '', a.priority ?? 'medium', a.due_in_days ?? null, a.assignee_agent ?? null, a.episode_id ?? null, e.workflowId, e.agentId],
        );
        await audit(q, e.ctx, 'task.created', { type: 'task', id: rows[0]!.id }, { title: a.title }, e.agentId);
        return { task_id: rows[0]!.id };
      });
    },
  }),
  define({
    name: 'add_task_comment',
    description: 'Comment on a task (e.g. review findings).',
    schema: z.object({ task_id: uuid, body: z.string().min(1).max(3000) }),
    async run(e, a) {
      return withOrg(agentCtx(e), async (q) => {
        await q.query(`insert into ward.task_comments (org_id, task_id, author_agent_id, body) values ($1,$2,$3,$4)`, [e.ctx.orgId, a.task_id, e.agentId, a.body]);
        return { ok: true };
      });
    },
  }),
  define({
    name: 'update_episode_draft',
    description: 'Write a DRAFT field of an unpublished episode: description, questions (list), script or marketing notes. The founder reviews every draft.',
    schema: z.object({
      episode_id: uuid,
      field: z.enum(['description', 'questions', 'script', 'marketing']),
      content: z.union([z.string().max(20_000), z.array(z.string().max(500)).max(60)]),
    }),
    async run(e, a) {
      return withOrg(agentCtx(e), async (q) => {
        const ep = (await q.query<{ status: string }>('select status from ward.episodes where id = $1', [a.episode_id]))[0];
        if (!ep) return { error: 'not_found' };
        if (ep.status === 'published') return { error: 'episode_published_read_only' };
        const value = a.content;
        if (a.field === 'questions') {
          const list = Array.isArray(value) ? value : value.split('\n').map((s) => s.replace(/^[\s\-*\d.)]+/, '').trim()).filter(Boolean);
          await q.query('update ward.episodes set questions = $2::jsonb where id = $1', [a.episode_id, json(list)]);
        } else if (a.field === 'marketing') {
          await q.query(`update ward.episodes set marketing = marketing || jsonb_build_object('notes', $2::text) where id = $1`, [a.episode_id, Array.isArray(value) ? value.join('\n') : value]);
        } else {
          await q.query(`update ward.episodes set ${a.field === 'script' ? 'script' : 'description'} = $2 where id = $1`, [a.episode_id, Array.isArray(value) ? value.join('\n') : value]);
        }
        await audit(q, e.ctx, 'episode.draft_updated', { type: 'episode', id: a.episode_id }, { field: a.field }, e.agentId);
        return { ok: true, note: 'حُفظت كمسودة للمراجعة.' };
      });
    },
  }),
  define({
    name: 'propose_guest',
    description: 'Add a guest as a PROPOSAL (status proposed). Never marks a guest as confirmed.',
    schema: z.object({ name: z.string().min(2).max(200), channel: z.string().max(200).optional(), bio: z.string().max(2000).optional(), topics: z.array(z.string().max(80)).max(10).optional() }),
    async run(e, a) {
      return withOrg(agentCtx(e), async (q) => {
        const rows = await q.query<{ id: string }>(
          `insert into ward.guests (org_id, name, channel, bio, topics, status, notes) values ($1,$2,$3,$4,$5::text[],'proposed',$6) returning id`,
          [e.ctx.orgId, a.name, a.channel ?? null, a.bio ?? '', `{${(a.topics ?? []).map((t) => `"${t.replace(/"/g, '')}"`).join(',')}}`, `اقترحه ${e.agentSlug}`],
        );
        await audit(q, e.ctx, 'guest.proposed', { type: 'guest', id: rows[0]!.id }, { name: a.name }, e.agentId);
        return { guest_id: rows[0]!.id, status: 'proposed' };
      });
    },
  }),
  define({
    name: 'add_calendar_draft',
    description: 'Add a DRAFT item to the content calendar (never published automatically).',
    schema: z.object({
      title: z.string().min(2).max(200),
      platform: z.enum(['youtube', 'podcast', 'instagram', 'tiktok', 'x', 'website', 'other']),
      scheduled_at: z.string().datetime({ offset: true }).optional(),
      content: z.string().max(5000),
      episode_id: uuid.optional(),
    }),
    async run(e, a) {
      return withOrg(agentCtx(e), async (q) => {
        const rows = await q.query<{ id: string }>(
          `insert into ward.content_calendar (org_id, title, platform, scheduled_at, status, content, episode_id, created_by_agent_id)
           values ($1,$2,$3,$4,'draft',$5,$6,$7) returning id`,
          [e.ctx.orgId, a.title, a.platform, a.scheduled_at ?? null, a.content, a.episode_id ?? null, e.agentId],
        );
        return { calendar_item_id: rows[0]!.id, status: 'draft' };
      });
    },
  }),
  define({
    name: 'add_sponsor_note',
    description: 'Append a dated note to a sponsor record. Does not change verification status, value or dates.',
    schema: z.object({ sponsor_id: uuid, note: z.string().min(2).max(2000) }),
    async run(e, a) {
      return withOrg(agentCtx(e), async (q) => {
        const rows = await q.query(
          `update ward.sponsors set notes = trim(notes || E'\n' || $2) where id = $1 returning id`,
          [a.sponsor_id, `[${new Date().toISOString().slice(0, 10)} ${e.agentSlug}] ${a.note}`],
        );
        return rows.length ? { ok: true } : { error: 'not_found' };
      });
    },
  }),
  define({
    name: 'add_deliverable',
    description: 'Track a sponsor right/deliverable (e.g. logo in episode 1) with an optional due date.',
    schema: z.object({ sponsor_id: uuid, title: z.string().min(2).max(300), due_at: z.string().datetime({ offset: true }).optional(), episode_id: uuid.optional() }),
    async run(e, a) {
      return withOrg(agentCtx(e), async (q) => {
        const rows = await q.query<{ id: string }>(
          `insert into ward.sponsorship_deliverables (org_id, sponsor_id, title, due_at, episode_id) values ($1,$2,$3,$4,$5) returning id`,
          [e.ctx.orgId, a.sponsor_id, a.title, a.due_at ?? null, a.episode_id ?? null],
        );
        return { deliverable_id: rows[0]!.id };
      });
    },
  }),
  define({
    name: 'save_document',
    description: 'Save a written deliverable (plan, script, article, offer, report) to institutional memory as an UNVERIFIED agent document.',
    schema: z.object({ title: z.string().min(3).max(200), category: z.enum(KNOWLEDGE_CATEGORIES), content: z.string().min(10).max(40_000) }),
    async run(e, a) {
      const id = await withOrg(agentCtx(e), (q) => createDocument(q, e.ctx, { title: a.title, category: a.category, content: a.content, source: 'agent', verified: false }, e.agentId));
      return { document_id: id, verified: false };
    },
  }),
  define({
    name: 'remember',
    description: 'Store a short memory for yourself for future tasks (a lesson, preference or fact with its source).',
    schema: z.object({ content: z.string().min(5).max(1000), kind: z.enum(['fact', 'preference', 'lesson', 'context']).optional() }),
    async run(e, a) {
      return withOrg(agentCtx(e), async (q) => {
        await q.query(
          `insert into ward.agent_memories (org_id, agent_id, kind, content, source_run_id) values ($1,$2,$3,$4,$5)`,
          [e.ctx.orgId, e.agentId, a.kind ?? 'lesson', a.content, e.agentRunId],
        );
        return { ok: true };
      });
    },
  }),

  // ── sensitive: approval requests only ──
  define({
    name: 'request_publish',
    description: 'Ask the founder to approve publishing content (episode, post, article). Nothing is published by this tool.',
    schema: z.object({ platform: z.string().min(2).max(60), content_summary: z.string().min(5).max(3000), episode_id: uuid.optional(), target_url: z.string().url().optional() }),
    approval: 'publish_content',
    async run(e, a) {
      return fileApproval(e, 'publish_content', `نشر على ${a.platform}`, a.content_summary, a.target_url ?? a.platform, a);
    },
  }),
  define({
    name: 'request_send_message',
    description: 'Ask the founder to approve sending an external message (email, DM, invitation). Nothing is sent by this tool.',
    schema: z.object({
      channel: z.enum(['email', 'whatsapp', 'instagram', 'x', 'phone', 'other']),
      recipient: z.string().min(2).max(300),
      subject: z.string().max(200).optional(),
      body: z.string().min(5).max(8000),
    }),
    approval: 'send_external_message',
    async run(e, a) {
      return fileApproval(e, 'send_external_message', `رسالة ${a.channel} إلى ${a.recipient}`, a.body.slice(0, 1500), a.recipient, a);
    },
  }),
  define({
    name: 'request_sign_agreement',
    description: 'Ask the founder to approve accepting a sponsorship agreement draft. Nothing is signed by this tool.',
    schema: z.object({ sponsor_id: uuid, agreement_title: z.string().min(3).max(300), terms_summary: z.string().min(10).max(5000), value: z.number().min(0).optional() }),
    approval: 'sign_agreement',
    async run(e, a) {
      const sponsor = await withOrg(agentCtx(e), (q) => q.query<{ name: string }>('select name from ward.sponsors where id = $1', [a.sponsor_id]));
      if (!sponsor[0]) return { error: 'sponsor_not_found' };
      return fileApproval(e, 'sign_agreement', a.agreement_title, a.terms_summary, sponsor[0].name, a, a.value ?? null);
    },
  }),
  define({
    name: 'request_spend',
    description: 'Ask the founder to approve an expense. Records it as pending; no money moves.',
    schema: z.object({ amount: z.number().positive().max(1_000_000), currency: z.string().length(3).optional(), purpose: z.string().min(5).max(1000), category: z.string().max(60).optional(), episode_id: uuid.optional() }),
    approval: 'spend_money',
    async run(e, a) {
      const expenseId = await withOrg(agentCtx(e), async (q) => {
        const rows = await q.query<{ id: string }>(
          `insert into ward.expenses (org_id, episode_id, amount, currency, category, description, status, created_by_agent_id)
           values ($1,$2,$3,$4,$5,$6,'pending_approval',$7) returning id`,
          [e.ctx.orgId, a.episode_id ?? null, a.amount, a.currency ?? 'SAR', a.category ?? 'general', a.purpose, e.agentId],
        );
        return rows[0]!.id;
      });
      return fileApproval(e, 'spend_money', `صرف ${a.amount} ${a.currency ?? 'SAR'}`, a.purpose, a.category ?? 'general', { ...a, expense_id: expenseId }, a.amount);
    },
  }),
  define({
    name: 'request_delete',
    description: 'Ask the founder to approve deleting a record (task, knowledge document, calendar item, memory).',
    schema: z.object({ entity_type: z.enum(['task', 'knowledge_document', 'calendar_item', 'memory']), entity_id: uuid, reason: z.string().min(5).max(1000) }),
    approval: 'delete_data',
    async run(e, a) {
      return fileApproval(e, 'delete_data', `حذف ${a.entity_type}`, a.reason, `${a.entity_type}:${a.entity_id}`, a);
    },
  }),
  define({
    name: 'request_site_change',
    description: 'Ask the founder to approve a change to the live website. Describe it; nothing is deployed by this tool.',
    schema: z.object({ description: z.string().min(10).max(5000), urgency: z.enum(['low', 'normal', 'high']) }),
    approval: 'modify_live_site',
    async run(e, a) {
      return fileApproval(e, 'modify_live_site', `تعديل الموقع (${a.urgency})`, a.description, env().WARD_SITE_URL ?? 'website', a);
    },
  }),
  define({
    name: 'request_share_file',
    description: 'Ask the founder to approve sharing a private file with an external party.',
    schema: z.object({ file_id: uuid, recipient: z.string().min(2).max(300), reason: z.string().min(5).max(1000) }),
    approval: 'share_private_file',
    async run(e, a) {
      return fileApproval(e, 'share_private_file', `مشاركة ملف مع ${a.recipient}`, a.reason, a.recipient, a);
    },
  }),
  define({
    name: 'request_permission_change',
    description: 'Ask the founder to approve changing a team member role (admin/editor/viewer).',
    schema: z.object({ user_email: z.string().email(), new_role: z.enum(['admin', 'editor', 'viewer']), reason: z.string().min(5).max(1000) }),
    approval: 'change_permissions',
    async run(e, a) {
      return fileApproval(e, 'change_permissions', `تغيير صلاحية ${a.user_email} إلى ${a.new_role}`, a.reason, a.user_email, a);
    },
  }),
] as unknown as ToolDef<never>[];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t as unknown as ToolDef<Record<string, unknown>>]));

export const SENSITIVE_TOOLS = TOOLS.filter((t) => t.approval).map((t) => t.name);

export function toolSpecs(names: string[]): ToolSpec[] {
  return names
    .map((n) => TOOL_BY_NAME.get(n))
    .filter((t): t is ToolDef<Record<string, unknown>> => Boolean(t))
    .map((t) => ({ name: t.name, description: t.description, parameters: jsonSchemaOf(t.schema) }));
}

export interface ToolOutcome {
  status: 'ok' | 'error' | 'denied' | 'approval_requested';
  result: unknown;
  approvalId: string | null;
}

/** Validate, enforce the allowlist, execute and log one tool call. */
export async function executeTool(e: ToolEnv, allowed: string[], name: string, rawArgs: Record<string, unknown>): Promise<ToolOutcome> {
  const started = Date.now();
  const tool = TOOL_BY_NAME.get(name);
  let outcome: ToolOutcome;
  if (!tool || !allowed.includes(name)) {
    outcome = { status: 'denied', result: { error: 'tool_not_permitted', message: `الأداة ${name} غير مسموحة لهذا الوكيل.` }, approvalId: null };
  } else {
    const parsed = tool.schema.safeParse(rawArgs);
    if (!parsed.success) {
      outcome = { status: 'error', result: { error: 'invalid_arguments', issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`) }, approvalId: null };
    } else {
      try {
        const result = (await tool.run(e, parsed.data)) as Record<string, unknown> | unknown;
        const approvalId = result && typeof result === 'object' && 'approval_id' in result ? String((result as { approval_id: unknown }).approval_id) : null;
        outcome = { status: approvalId ? 'approval_requested' : 'ok', result, approvalId };
      } catch (err) {
        outcome = { status: 'error', result: { error: err instanceof Error ? err.message.slice(0, 300) : 'tool_failed' }, approvalId: null };
      }
    }
  }
  await withOrg(e.ctx, (q) =>
    q.query(
      `insert into ward.agent_tool_calls (org_id, agent_run_id, agent_id, tool, args, result, status, approval_id, duration_ms)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)`,
      [e.ctx.orgId, e.agentRunId, e.agentId, name.slice(0, 80), json(rawArgs), json(outcome.result), outcome.status, outcome.approvalId, Date.now() - started],
    ),
  );
  return outcome;
}

