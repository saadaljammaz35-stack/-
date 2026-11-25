import { env } from '@/lib/env';
import { json, num, withOrg, type OrgContext, type Queryable } from '@/lib/db';
import { audit } from '@/lib/audit';
import { can } from '@/lib/auth/permissions';
import { conflict, forbidden, notFound } from '@/lib/http';
import { notify } from '@/lib/notifications';

/**
 * The approval center. These actions can NEVER be executed by an agent directly:
 * agent tools for them only create a pending approval. Execution happens here, after an
 * explicit decision by the founder (role `owner`), and only for the parts WARD OS can
 * genuinely perform. Anything that needs an integration that is not configured is marked
 * "manual" — the system never pretends it published, sent, paid or signed something.
 */
export const APPROVAL_ACTIONS = [
  'publish_content',
  'send_external_message',
  'sign_agreement',
  'spend_money',
  'delete_data',
  'modify_live_site',
  'share_private_file',
  'change_permissions',
] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export interface ApprovalInput {
  action: ApprovalAction;
  title: string;
  summary: string;
  target: string;
  payload: Record<string, unknown>;
  estimatedCost?: number | null;
  currency?: string;
  agentId?: string | null;
  workflowId?: string | null;
  agentRunId?: string | null;
}

export async function createApproval(q: Queryable, ctx: OrgContext, input: ApprovalInput): Promise<string> {
  const rows = await q.query<{ id: string }>(
    `insert into ward.approvals (org_id, action_type, title, summary, target, payload, estimated_cost, currency,
                                 requested_by_agent_id, requested_by_user_id, workflow_id, agent_run_id)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12) returning id`,
    [
      ctx.orgId, input.action, input.title.slice(0, 300), input.summary.slice(0, 4000), input.target.slice(0, 500),
      json(input.payload), input.estimatedCost ?? null, input.currency ?? 'SAR', input.agentId ?? null,
      input.agentId ? null : ctx.userId, input.workflowId ?? null, input.agentRunId ?? null,
    ],
  );
  const id = rows[0]!.id;
  await notify(q, ctx.orgId, {
    kind: 'approval',
    severity: 'warning',
    title: `طلب موافقة: ${input.title}`.slice(0, 300),
    body: input.summary.slice(0, 500),
    link: `/os/approvals#${id}`,
  });
  await audit(q, ctx, 'approval.requested', { type: 'approval', id }, { action: input.action, target: input.target }, input.agentId);
  return id;
}

interface ApprovalRow {
  id: string;
  action_type: ApprovalAction;
  title: string;
  target: string;
  payload: Record<string, unknown>;
  workflow_id: string | null;
  estimated_cost: string | number | null;
}

type Execution = { status: 'executed' | 'approved' | 'failed'; result: Record<string, unknown> };

const DELETABLE: Record<string, string> = {
  task: 'ward.tasks',
  knowledge_document: 'ward.knowledge_documents',
  calendar_item: 'ward.content_calendar',
  memory: 'ward.agent_memories',
};

async function executeInternal(q: Queryable, ctx: OrgContext, a: ApprovalRow): Promise<Execution | null> {
  const p = a.payload;
  switch (a.action_type) {
    case 'spend_money': {
      if (typeof p.expense_id === 'string') {
        await q.query(`update ward.expenses set status = 'approved', approval_id = $2 where id = $1`, [p.expense_id, a.id]);
      }
      return {
        status: 'executed',
        result: { mode: 'recorded', note: 'اعتُمد المصروف وسُجّل. WARD OS لا يحوّل أموالًا؛ نفّذ الدفع من حسابك ثم علّمه مدفوعًا.' },
      };
    }
    case 'delete_data': {
      const table = DELETABLE[String(p.entity_type)];
      if (!table || typeof p.entity_id !== 'string') return { status: 'failed', result: { error: 'unsupported_entity' } };
      const deleted = await q.query(`delete from ${table} where id = $1 returning id`, [p.entity_id]);
      return { status: deleted.length ? 'executed' : 'failed', result: { deleted: deleted.length } };
    }
    case 'change_permissions': {
      const role = String(p.new_role);
      if (!['admin', 'editor', 'viewer'].includes(role)) return { status: 'failed', result: { error: 'role_not_allowed' } };
      const updated = await q.query(
        `update ward.organization_members m set role = $2
           from ward.users u
          where u.id = m.user_id and u.email = lower($1) and m.org_id = $3 and m.role <> 'owner'
        returning m.user_id`,
        [String(p.user_email ?? ''), role, ctx.orgId],
      );
      return { status: updated.length ? 'executed' : 'failed', result: { updated: updated.length } };
    }
    case 'sign_agreement': {
      if (typeof p.sponsor_id !== 'string') return { status: 'failed', result: { error: 'sponsor_required' } };
      const rows = await q.query<{ id: string }>(
        `insert into ward.sponsorship_agreements (org_id, sponsor_id, title, status, terms, value_amount)
         values ($1, $2, $3, 'approved', $4, $5) returning id`,
        [ctx.orgId, p.sponsor_id, String(p.agreement_title ?? a.title).slice(0, 300), String(p.terms_summary ?? ''), p.value ?? null],
      );
      return {
        status: 'executed',
        result: {
          mode: 'manual_followup',
          agreement_id: rows[0]!.id,
          note: 'اعتُمدت المسودة داخليًا فقط. التوقيع الفعلي يتم خارج النظام (عبر ولي الأمر أو الممثل المخول إن كان المؤسس قاصرًا)، ثم ارفع العقد وعلّمه موقّعًا.',
        },
      };
    }
    case 'publish_content': {
      if (typeof p.episode_id === 'string') {
        await q.query(`update ward.episodes set approval_status = 'approved' where id = $1`, [p.episode_id]);
      }
      return null; // publication itself happens outside (manual) unless an integration exists
    }
    default:
      return null;
  }
}

async function sendEmail(to: string, subject: string, text: string): Promise<Execution> {
  const e = env();
  if (!e.RESEND_API_KEY || !e.WARD_EMAIL_FROM) {
    return { status: 'approved', result: { mode: 'manual', note: 'لا يوجد تكامل بريد مُعد (RESEND_API_KEY). أرسل الرسالة يدويًا.' } };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: e.WARD_EMAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return { status: 'failed', result: { error: `resend_http_${res.status}` } };
  const data = (await res.json()) as { id?: string };
  return { status: 'executed', result: { mode: 'sent', provider: 'resend', message_id: data.id ?? null } };
}

const MANUAL_NOTES: Partial<Record<ApprovalAction, string>> = {
  publish_content: 'تمت الموافقة. لا يوجد تكامل نشر مباشر؛ انشر المحتوى بنفسك ثم أضف رابط النشر في الحلقة.',
  modify_live_site: 'تمت الموافقة. لا يعدّل WARD OS الموقع المنشور تلقائيًا؛ نفّذ التغيير عبر مستودع الكود والنشر المعتاد.',
  share_private_file: 'تمت الموافقة. شارك الملف يدويًا مع الجهة المحددة فقط.',
  send_external_message: 'تمت الموافقة. أرسل الرسالة يدويًا.',
};

export async function decideApproval(
  ctx: OrgContext,
  id: string,
  decision: 'approve' | 'reject',
  note: string | null,
): Promise<{ status: string; result: Record<string, unknown> | null }> {
  if (!can(ctx.role, 'approvals.decide')) throw forbidden('missing_permission:approvals.decide');

  // 1) Atomically claim the pending approval (double-clicks and races cannot decide twice).
  const claimed = await withOrg(ctx, async (q) => {
    const rows = await q.query<ApprovalRow>(
      `update ward.approvals set status = $2, decided_by = $3, decided_at = now(), decision_note = $4
        where id = $1 and status = 'pending'
        returning id, action_type, title, target, payload, workflow_id, estimated_cost`,
      [id, decision === 'approve' ? 'approved' : 'rejected', ctx.userId, note],
    );
    const row = rows[0];
    if (!row) {
      const exists = await q.query('select 1 from ward.approvals where id = $1', [id]);
      throw exists.length ? conflict('already_decided') : notFound();
    }
    if (decision === 'reject') {
      if (row.action_type === 'spend_money' && typeof row.payload.expense_id === 'string') {
        await q.query(`update ward.expenses set status = 'rejected' where id = $1`, [row.payload.expense_id]);
      }
      await audit(q, ctx, 'approval.rejected', { type: 'approval', id }, { action: row.action_type, note });
      await settleWorkflow(q, row.workflow_id);
      return { row, execution: null as Execution | null };
    }
    const internal = await executeInternal(q, ctx, row);
    await audit(q, ctx, 'approval.approved', { type: 'approval', id }, { action: row.action_type, cost: num(row.estimated_cost), note });
    return { row, execution: internal };
  });

  if (decision === 'reject') return { status: 'rejected', result: null };

  // 2) External side effects run outside the transaction.
  let execution = claimed.execution;
  if (!execution && claimed.row.action_type === 'send_external_message' && claimed.row.payload.channel === 'email') {
    try {
      execution = await sendEmail(String(claimed.row.payload.recipient ?? ''), String(claimed.row.payload.subject ?? claimed.row.title), String(claimed.row.payload.body ?? ''));
    } catch (err) {
      execution = { status: 'failed', result: { error: err instanceof Error ? err.message : String(err) } };
    }
  }
  execution ??= { status: 'approved', result: { mode: 'manual', note: MANUAL_NOTES[claimed.row.action_type] ?? 'تمت الموافقة؛ التنفيذ يدوي.' } };

  await withOrg(ctx, async (q) => {
    await q.query('update ward.approvals set status = $2, execution_result = $3::jsonb where id = $1', [id, execution.status, json(execution.result)]);
    await audit(q, ctx, `approval.${execution.status}`, { type: 'approval', id }, execution.result);
    await settleWorkflow(q, claimed.row.workflow_id);
  });
  return { status: execution.status, result: execution.result };
}

/** When the last pending approval of a workflow is decided, the workflow can complete. */
export async function settleWorkflow(q: Queryable, workflowId: string | null): Promise<void> {
  if (!workflowId) return;
  const pending = await q.query(`select 1 from ward.approvals where workflow_id = $1 and status = 'pending' limit 1`, [workflowId]);
  if (pending.length) return;
  const rows = await q.query<{ org_id: string }>(
    `update ward.workflows set status = 'completed', finished_at = now()
      where id = $1 and status = 'awaiting_approval' returning org_id`,
    [workflowId],
  );
  if (rows[0]) {
    await q.query(
      `insert into ward.workflow_events (org_id, workflow_id, kind, message) values ($1, $2, 'status', 'completed: all approvals decided')`,
      [rows[0].org_id, workflowId],
    );
  }
}
