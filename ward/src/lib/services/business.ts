import { z } from 'zod';
import { withOrg, type OrgContext } from '@/lib/db';
import { audit } from '@/lib/audit';
import { can } from '@/lib/auth/permissions';
import { badRequest, forbidden, notFound } from '@/lib/http';
import { checkbox, optDate, optDay, optNumber, optText, optUuid, reqText } from '@/lib/services/forms';

// ───────── sponsors ─────────

export const SponsorInput = z.object({
  name: reqText(1, 200),
  category: optText(120),
  sponsorship_type: z.preprocess((v) => (v === '' ? null : v), z.enum(['cash', 'in_kind', 'mixed']).nullable()).optional(),
  contact_name: optText(200),
  contact_email: z.preprocess((v) => (v === '' ? null : v), z.string().email().nullable()).optional(),
  contact_phone: optText(40),
  agreement_start: optDay,
  agreement_end: optDay,
  value_amount: optNumber(0, 1e9),
  currency: z.string().length(3).optional(),
  visibility_rights: optText(5000),
  logo_use_approved: checkbox.optional(),
  status: z.enum(['pending_verification', 'in_discussion', 'verified', 'active', 'ended', 'declined']).optional(),
  notes: optText(10_000),
});

export async function saveSponsor(ctx: OrgContext, id: string | null, raw: unknown): Promise<string> {
  if (!can(ctx.role, 'sponsors.write')) throw forbidden();
  const s = (id ? SponsorInput.partial() : SponsorInput).parse(raw);
  return withOrg(ctx, async (q) => {
    const contact = s.contact_name !== undefined || s.contact_email !== undefined || s.contact_phone !== undefined
      ? JSON.stringify({ name: s.contact_name ?? null, email: s.contact_email ?? null, phone: s.contact_phone ?? null })
      : null;
    if (!id) {
      const rows = await q.query<{ id: string }>(
        `insert into ward.sponsors (org_id, name, category, sponsorship_type, contact, agreement_start, agreement_end, value_amount, currency, visibility_rights, status, notes)
         values ($1,$2,$3,$4,coalesce($5::jsonb,'{}'::jsonb),$6,$7,$8,$9,$10,$11,$12) returning id`,
        [ctx.orgId, s.name, s.category ?? null, s.sponsorship_type ?? null, contact, s.agreement_start ?? null, s.agreement_end ?? null, s.value_amount ?? null, s.currency ?? 'SAR', s.visibility_rights ?? '', s.status ?? 'pending_verification', s.notes ?? ''],
      );
      await audit(q, ctx, 'sponsor.created', { type: 'sponsor', id: rows[0]!.id }, { name: s.name });
      return rows[0]!.id;
    }
    // Explicit field list: unspecified fields are left untouched, explicit nulls clear values.
    const map: Record<string, unknown> = {
      name: s.name, category: s.category, sponsorship_type: s.sponsorship_type, agreement_start: s.agreement_start, agreement_end: s.agreement_end,
      value_amount: s.value_amount, currency: s.currency, visibility_rights: s.visibility_rights, logo_use_approved: s.logo_use_approved, status: s.status, notes: s.notes,
    };
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const [col, val] of Object.entries(map)) {
      if (val === undefined) continue;
      params.push(col === 'visibility_rights' || col === 'notes' ? (val ?? '') : val);
      sets.push(`${col} = $${params.length}`);
    }
    if (contact) sets.push(`contact = $${params.push(contact)}::jsonb`);
    if (s.name !== undefined) sets.push('name_pending = false');
    if (!sets.length) return id;
    const rows = await q.query(`update ward.sponsors set ${sets.join(', ')} where id = $1 returning id`, params);
    if (!rows.length) throw notFound();
    await audit(q, ctx, 'sponsor.updated', { type: 'sponsor', id }, { fields: Object.keys(s) });
    return id;
  });
}

export const DeliverableInput = z.object({ title: reqText(2, 300), due_at: optDate, episode_id: optUuid, agreement_id: optUuid });

export async function addDeliverable(ctx: OrgContext, sponsorId: string, raw: unknown): Promise<void> {
  if (!can(ctx.role, 'sponsors.write')) throw forbidden();
  const d = DeliverableInput.parse(raw);
  await withOrg(ctx, async (q) => {
    await q.query(
      `insert into ward.sponsorship_deliverables (org_id, sponsor_id, title, due_at, episode_id, agreement_id) values ($1,$2,$3,$4,$5,$6)`,
      [ctx.orgId, sponsorId, d.title, d.due_at ?? null, d.episode_id ?? null, d.agreement_id ?? null],
    );
    await audit(q, ctx, 'deliverable.created', { type: 'sponsor', id: sponsorId }, { title: d.title });
  });
}

export async function setDeliverableStatus(ctx: OrgContext, id: string, status: string, proofUrl: string | null): Promise<void> {
  if (!can(ctx.role, 'sponsors.write')) throw forbidden();
  const s = z.enum(['pending', 'delivered', 'verified', 'missed']).parse(status);
  const proof = proofUrl ? z.string().url().parse(proofUrl) : null;
  await withOrg(ctx, async (q) => {
    await q.query('update ward.sponsorship_deliverables set status = $2, proof_url = coalesce($3, proof_url) where id = $1', [id, s, proof]);
    await audit(q, ctx, 'deliverable.updated', { type: 'deliverable', id }, { status: s });
  });
}

export const AgreementInput = z.object({
  title: reqText(3, 300),
  starts_on: optDay,
  ends_on: optDay,
  value_amount: optNumber(0, 1e9),
  terms: optText(20_000),
  status: z.enum(['draft', 'under_review', 'approved', 'signed', 'expired', 'cancelled']).optional(),
});

/** Drafts can be written by sponsor managers; marking an agreement signed is the founder's act. */
export async function saveAgreement(ctx: OrgContext, sponsorId: string, id: string | null, raw: unknown): Promise<void> {
  if (!can(ctx.role, 'sponsors.write')) throw forbidden();
  const a = (id ? AgreementInput.partial() : AgreementInput).parse(raw);
  if ((a.status === 'signed' || a.status === 'approved') && !can(ctx.role, 'approvals.decide')) throw forbidden('missing_permission:approvals.decide');
  await withOrg(ctx, async (q) => {
    if (!id) {
      if (a.status === 'signed') throw badRequest('create_as_draft_first');
      await q.query(
        `insert into ward.sponsorship_agreements (org_id, sponsor_id, title, starts_on, ends_on, value_amount, terms, status) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [ctx.orgId, sponsorId, a.title, a.starts_on ?? null, a.ends_on ?? null, a.value_amount ?? null, a.terms ?? '', a.status ?? 'draft'],
      );
    } else {
      await q.query(
        `update ward.sponsorship_agreements set status = coalesce($2, status), signed_at = case when $2 = 'signed' then now() else signed_at end,
                terms = coalesce($3, terms), value_amount = coalesce($4, value_amount) where id = $1 and sponsor_id = $5`,
        [id, a.status ?? null, a.terms ?? null, a.value_amount ?? null, sponsorId],
      );
    }
    await audit(q, ctx, `agreement.${id ? 'updated' : 'drafted'}`, { type: 'sponsor', id: sponsorId }, { status: a.status ?? 'draft' });
  });
}

// ───────── finance ─────────

export const BudgetInput = z.object({
  name: reqText(2, 200),
  category: optText(60),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().min(0).max(1e9),
  episode_id: optUuid,
});

export async function createBudget(ctx: OrgContext, raw: unknown): Promise<void> {
  if (!can(ctx.role, 'finance.write')) throw forbidden();
  const b = BudgetInput.parse(raw);
  await withOrg(ctx, async (q) => {
    await q.query(
      `insert into ward.budgets (org_id, name, category, period_start, period_end, amount, episode_id) values ($1,$2,$3,$4,$5,$6,$7)`,
      [ctx.orgId, b.name, b.category ?? 'general', b.period_start, b.period_end, b.amount, b.episode_id ?? null],
    );
    await audit(q, ctx, 'budget.created', { type: 'budget' }, { name: b.name, amount: b.amount });
  });
}

export const ExpenseInput = z.object({
  amount: z.coerce.number().positive().max(1e9),
  category: optText(60),
  description: reqText(2, 1000),
  incurred_on: optDay,
  episode_id: optUuid,
  budget_id: optUuid,
  sponsor_id: optUuid,
});

/** An expense the founder/admin records themselves is a human decision: it is approved on entry. */
export async function createExpense(ctx: OrgContext, raw: unknown): Promise<void> {
  if (!can(ctx.role, 'finance.write')) throw forbidden();
  const x = ExpenseInput.parse(raw);
  await withOrg(ctx, async (q) => {
    await q.query(
      `insert into ward.expenses (org_id, amount, category, description, incurred_on, episode_id, budget_id, sponsor_id, status, created_by_user_id)
       values ($1,$2,$3,$4,coalesce($5::date, current_date),$6,$7,$8,'approved',$9)`,
      [ctx.orgId, x.amount, x.category ?? 'general', x.description, x.incurred_on ?? null, x.episode_id ?? null, x.budget_id ?? null, x.sponsor_id ?? null, ctx.userId],
    );
    await audit(q, ctx, 'expense.recorded', { type: 'expense' }, { amount: x.amount, description: x.description });
  });
}

export async function markExpensePaid(ctx: OrgContext, id: string): Promise<void> {
  if (!can(ctx.role, 'approvals.decide')) throw forbidden('missing_permission:approvals.decide');
  await withOrg(ctx, async (q) => {
    const rows = await q.query(`update ward.expenses set status = 'paid' where id = $1 and status = 'approved' returning id`, [id]);
    if (!rows.length) throw badRequest('only_approved_expenses_can_be_marked_paid');
    await audit(q, ctx, 'expense.paid', { type: 'expense', id });
  });
}

export const RevenueInput = z.object({
  source: z.enum(['sponsorship', 'ads', 'services', 'other']),
  amount: z.coerce.number().positive().max(1e9),
  is_cash: checkbox,
  status: z.enum(['expected', 'received', 'cancelled']),
  received_on: optDay,
  sponsor_id: optUuid,
  episode_id: optUuid,
  description: optText(1000),
});

export async function createRevenue(ctx: OrgContext, raw: unknown): Promise<void> {
  if (!can(ctx.role, 'finance.write')) throw forbidden();
  const r = RevenueInput.parse(raw);
  await withOrg(ctx, async (q) => {
    await q.query(
      `insert into ward.revenues (org_id, source, amount, is_cash, status, received_on, sponsor_id, episode_id, description) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [ctx.orgId, r.source, r.amount, r.is_cash, r.status, r.received_on ?? null, r.sponsor_id ?? null, r.episode_id ?? null, r.description ?? ''],
    );
    await audit(q, ctx, 'revenue.recorded', { type: 'revenue' }, { amount: r.amount, cash: r.is_cash, status: r.status });
  });
}
