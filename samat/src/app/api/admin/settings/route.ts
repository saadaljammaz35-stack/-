import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { AppError, errorResponse, fromDbError } from '@/lib/errors';
import { normalizeSaudiPhone } from '@/lib/phone';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const opt = (max: number) => z.string().max(max).nullable().optional().transform((v) => (v ? v.trim() || null : null));
const Settings = z.object({
  branch_name_ar: z.string().min(1).max(80), branch_name_en: z.string().min(1).max(80),
  address_ar: opt(200), address_en: opt(200), maps_url: opt(500).refine((v) => !v || v.startsWith('https://'), 'https'),
  latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(), phone: opt(30),
  whatsapp_number: opt(20).transform((v) => (v ? normalizeSaudiPhone(v) : null)),
  opening_hours: z.record(z.enum(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']), z.array(z.object({ open: hhmm, close: hhmm })).max(3)),
  pickup_instructions_ar: opt(300), pickup_instructions_en: opt(300),
  base_prep_minutes: z.number().int().min(1).max(240), kitchen_late_minutes: z.number().int().min(1).max(240),
  unpaid_order_ttl_minutes: z.number().int().min(5).max(120), pickup_screen_enabled: z.boolean(),
  admin_notification_emails: z.array(z.string().email()).max(10), low_stock_alerts: z.boolean(),
  legal_name: opt(120), vat_number: opt(15).refine((v) => !v || /^3\d{13}3$/.test(v), 'vat'), cr_number: opt(20),
  vat_enabled: z.boolean(), vat_rate_bps: z.number().int().min(0).max(10000), prices_include_vat: z.boolean(),
  invoice_footer_ar: opt(300), invoice_footer_en: opt(300),
  payment_methods: z.object({ creditcard: z.boolean(), applepay: z.boolean(), stcpay: z.boolean(), bank_transfer: z.boolean() }),
  manual_capture: z.boolean(),
  bank_name: opt(80), bank_account_name: opt(120), bank_iban: opt(34).transform((v) => (v ? v.replace(/\s+/g, '').toUpperCase() : null)).refine((v) => !v || /^SA\d{22}$/.test(v), 'iban'),
  bank_account_number: opt(40), bank_swift: opt(20), bank_qr_url: opt(500),
  demo_banner: z.boolean(),
});

export async function POST(req: Request) {
  try {
    await requireStaff('settings.manage');
    const r = Settings.safeParse(await req.json());
    if (!r.success) throw new AppError('invalid_request', 400, { issues: r.error.issues.map((i) => i.path.join('.')).slice(0, 6) });
    if (r.data.payment_methods.bank_transfer && !r.data.bank_iban) throw new AppError('invalid_request', 400, { issues: ['bank_iban'] });
    const { error } = await (await userDb()).from('store_settings').update(r.data).eq('id', 1);
    if (error) throw fromDbError(error);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
