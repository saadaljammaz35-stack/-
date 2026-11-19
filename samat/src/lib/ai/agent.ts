import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { daysAgo, riyadhStartOfDay } from '@/lib/time';
import type { StaffSession } from '@/lib/auth/staff';

// SAMAT AI — the restaurant's assistant. Every number it states comes from a tool that reads the
// live database with the staff member's own permissions (RLS + permission checks in SQL). It never
// changes anything directly: "propose_*" tools only queue an action that the staff member must
// confirm in the UI, and the confirmation is executed (and permission-checked) again server-side.

const sar = (h: number | null | undefined) => (h == null ? null : Math.round(h) / 100);
const Period = z.enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'this_month', 'previous_30_days']);

function range(p: z.infer<typeof Period>): { from: string; to: string; label: string } {
  const now = new Date();
  const tomorrow = new Date(riyadhStartOfDay(now).getTime() + 86400_000);
  switch (p) {
    case 'today': return { from: riyadhStartOfDay(now).toISOString(), to: tomorrow.toISOString(), label: 'today' };
    case 'yesterday': return { from: daysAgo(1).toISOString(), to: riyadhStartOfDay(now).toISOString(), label: 'yesterday' };
    case 'last_7_days': return { from: daysAgo(6).toISOString(), to: tomorrow.toISOString(), label: 'last 7 days incl. today' };
    case 'this_month': {
      const local = new Date(now.getTime() + 3 * 3600_000);
      const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 3 * 3600_000);
      return { from: start.toISOString(), to: tomorrow.toISOString(), label: 'this calendar month' };
    }
    case 'previous_30_days': return { from: daysAgo(59).toISOString(), to: daysAgo(29).toISOString(), label: 'the 30 days before the last 30 days' };
    default: return { from: daysAgo(29).toISOString(), to: tomorrow.toISOString(), label: 'last 30 days incl. today' };
  }
}

async function rpc<T>(db: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(/SAMAT:forbidden/.test(error.message) ? 'FORBIDDEN: the current staff member lacks permission for this data.' : error.message);
  return data as T;
}

async function propose(staff: StaffSession, action: string, params: Record<string, unknown>, permission: string, summaryAr: string, summaryEn: string) {
  if (!staff.permissions.has(permission as never)) return `FORBIDDEN: ${permission} is required for this action. Tell the user they do not have this permission.`;
  const { data, error } = await adminDb().from('ai_pending_actions')
    .insert({ requested_by: staff.userId, action, params, summary_ar: summaryAr, summary_en: summaryEn, required_permission: permission })
    .select('id').single();
  if (error) throw error;
  return `PENDING_CONFIRMATION id=${data.id}. Nothing has been changed yet. The user sees a confirmation card ("${summaryAr}") and must press Confirm. Tell them that.`;
}

async function findProduct(db: SupabaseClient, name: string) {
  const { data } = await db.from('products').select('id, name_ar, name_en, base_price, is_available, is_active').is('deleted_at', null);
  const q = name.trim().toLowerCase();
  const list = data ?? [];
  return list.find((p) => p.name_ar === name.trim() || p.name_en.toLowerCase() === q)
    ?? list.find((p) => p.name_ar.includes(name.trim()) || p.name_en.toLowerCase().includes(q)) ?? null;
}

export function buildTools(db: SupabaseClient, staff: StaffSession) {
  const can = (p: string) => staff.permissions.has(p as never);
  const tools = [];

  if (can('reports.view') || can('dashboard.view')) {
    tools.push(
      betaZodTool({
        name: 'get_sales_summary',
        description: 'Actual sales figures for a period from the database: revenue (SAR, accepted orders only), number of sales orders, average order value, VAT, discounts, and order counts by status (awaiting approval, preparing, ready, delivered, rejected, cancelled). Use for "how many orders today", "sales summary", "how many still being prepared".',
        inputSchema: z.object({ period: Period }),
        run: async ({ period }) => {
          const r = range(period);
          const o = await rpc<Record<string, number>>(db, 'report_overview', { p_from: r.from, p_to: r.to });
          return JSON.stringify({ period: r.label, revenue_sar: sar(o.revenue), sales_orders: o.sales_orders, avg_order_sar: sar(o.avg_order_value), vat_sar: sar(o.vat),
            discounts_sar: sar(o.discounts), awaiting_approval: o.awaiting_approval, accepted: o.accepted, preparing: o.preparing, ready: o.ready, delivered: o.delivered,
            rejected: o.rejected, cancelled: o.cancelled, unpaid_abandoned: o.unpaid_abandoned, unique_customers: o.unique_customers });
        },
      }),
      betaZodTool({
        name: 'get_product_performance',
        description: 'Units sold and revenue per product for a period (actual data), sorted best to worst. Includes products with zero sales. Use for best sellers, weak products, "which burger sold most".',
        inputSchema: z.object({ period: Period, category: z.enum(['burger', 'shawarma', 'fries']).optional() }),
        run: async ({ period, category }) => {
          const r = range(period);
          const rows = await rpc<{ name_ar: string; name_en: string; category: string; quantity: number; revenue: number; is_active: boolean; is_available: boolean }[]>(db, 'report_products', { p_from: r.from, p_to: r.to });
          return JSON.stringify({ period: r.label, products: rows.filter((p) => !category || p.category === category)
            .map((p) => ({ name_ar: p.name_ar, name_en: p.name_en, category: p.category, units: p.quantity, revenue_sar: sar(p.revenue), published: p.is_active, available: p.is_available })) });
        },
      }),
      betaZodTool({
        name: 'get_sales_trend',
        description: 'Revenue and order counts per day / week / month bucket (Riyadh time), actual data. Use for trends and comparing days.',
        inputSchema: z.object({ period: Period, bucket: z.enum(['day', 'week', 'month']) }),
        run: async ({ period, bucket }) => {
          const r = range(period);
          const rows = await rpc<{ bucket: string; revenue: number; orders: number }[]>(db, 'report_timeseries', { p_from: r.from, p_to: r.to, p_bucket: bucket });
          return JSON.stringify({ period: r.label, series: rows.map((x) => ({ bucket: x.bucket.slice(0, 10), revenue_sar: sar(x.revenue), orders: x.orders })) });
        },
      }),
      betaZodTool({
        name: 'get_peak_hours',
        description: 'Orders and revenue by hour of day (0-23, Riyadh time) over a period — the busiest times. Actual data.',
        inputSchema: z.object({ period: Period }),
        run: async ({ period }) => {
          const r = range(period);
          const rows = await rpc<{ hour: number; orders: number; revenue: number }[]>(db, 'report_hours', { p_from: r.from, p_to: r.to });
          return JSON.stringify({ period: r.label, hours: rows.map((x) => ({ hour: x.hour, orders: x.orders, revenue_sar: sar(x.revenue) })) });
        },
      }),
      betaZodTool({
        name: 'get_customization_stats',
        description: 'Most used sauces, most added extras, most removed ingredients and bread choices over a period. Actual data.',
        inputSchema: z.object({ period: Period }),
        run: async ({ period }) => {
          const r = range(period);
          return JSON.stringify({ period: r.label, ...(await rpc<object>(db, 'report_customizations', { p_from: r.from, p_to: r.to })) });
        },
      }),
    );
  }

  if (can('inventory.manage') || can('reports.view') || can('dashboard.view')) {
    tools.push(betaZodTool({
      name: 'get_inventory',
      description: 'Current stock: on hand, reserved by open orders, available, alert threshold, units sold in the last 30 days, low-stock flag. Optionally filter by a name fragment (Arabic or English), e.g. "ثومية" or "garlic".',
      inputSchema: z.object({ name_contains: z.string().max(40).optional() }),
      run: async ({ name_contains }) => {
        const rows = await rpc<{ name_ar: string; name_en: string; unit: string; on_hand: number; reserved: number; available: number; low_threshold: number; sold_30d: number; is_low: boolean; is_active: boolean }[]>(db, 'inventory_status');
        const q = name_contains?.toLowerCase();
        return JSON.stringify(rows.filter((r) => !q || r.name_ar.includes(name_contains!) || r.name_en.toLowerCase().includes(q))
          .map((r) => ({ name_ar: r.name_ar, name_en: r.name_en, unit: r.unit, on_hand: Number(r.on_hand), reserved: Number(r.reserved), available: Number(r.available),
            alert_at: Number(r.low_threshold), sold_last_30_days: Number(r.sold_30d), low: r.is_low, active: r.is_active })));
      },
    }));
  }

  if (can('orders.view')) {
    tools.push(betaZodTool({
      name: 'get_live_orders',
      description: 'Orders that are open right now (awaiting approval, accepted, preparing, ready) with order number, status and minutes since placed. No customer phone numbers.',
      inputSchema: z.object({}),
      run: async () => {
        const { data } = await db.from('orders').select('order_number, status, payment_status, created_at, total')
          .in('status', ['awaiting_approval', 'accepted', 'preparing', 'ready']).order('created_at');
        return JSON.stringify((data ?? []).map((o) => ({ order: o.order_number, status: o.status, payment: o.payment_status, total_sar: sar(o.total),
          minutes_ago: Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000) })));
      },
    }));
  }

  if (can('menu.manage') || can('reports.view')) {
    tools.push(betaZodTool({
      name: 'get_menu',
      description: 'Products on the menu with category, current price (SAR), published and available flags.',
      inputSchema: z.object({}),
      run: async () => {
        const { data } = await db.from('products').select('name_ar, name_en, base_price, is_active, is_available, category:categories(kind)').is('deleted_at', null).order('sort_order');
        return JSON.stringify((data ?? []).map((p) => ({ name_ar: p.name_ar, name_en: p.name_en, category: (p.category as unknown as { kind: string })?.kind,
          price_sar: sar(p.base_price), published: p.is_active, available: p.is_available })));
      },
    }));
  }

  // ---------------------------------------------------------------- write proposals (need confirmation)
  if (can('menu.manage')) {
    tools.push(
      betaZodTool({
        name: 'propose_product_availability',
        description: 'Propose pausing or resuming a product (temporary availability). Does NOT change anything until the user confirms in the UI.',
        inputSchema: z.object({ product_name: z.string().min(1).max(80), available: z.boolean() }),
        run: async ({ product_name, available }) => {
          const p = await findProduct(db, product_name);
          if (!p) return `NOT_FOUND: no product matches "${product_name}". Ask the user which product they mean (use get_menu).`;
          return propose(staff, 'set_product_availability', { product_id: p.id, available }, 'menu.manage',
            `${available ? 'إعادة تفعيل' : 'إيقاف مؤقت لـ'} «${p.name_ar}»`, `${available ? 'Resume' : 'Pause'} “${p.name_en}”`);
        },
      }),
      betaZodTool({
        name: 'propose_product_price',
        description: 'Propose changing a product base price (SAR). Does NOT change anything until the user confirms in the UI. Only when the user explicitly asked for a price change and gave the new price.',
        inputSchema: z.object({ product_name: z.string().min(1).max(80), new_price_sar: z.number().positive().max(10000) }),
        run: async ({ product_name, new_price_sar }) => {
          const p = await findProduct(db, product_name);
          if (!p) return `NOT_FOUND: no product matches "${product_name}".`;
          const old = sar(p.base_price);
          return propose(staff, 'set_product_price', { product_id: p.id, price_halalas: Math.round(new_price_sar * 100) }, 'menu.manage',
            `تغيير سعر «${p.name_ar}» من ${old ?? '—'} إلى ${new_price_sar.toFixed(2)} ر.س`, `Change “${p.name_en}” price from ${old ?? '—'} to SAR ${new_price_sar.toFixed(2)}`);
        },
      }),
    );
  }
  if (can('inventory.manage')) {
    tools.push(betaZodTool({
      name: 'propose_stock_movement',
      description: 'Propose a stock movement: delivery (purchase, adds), waste (removes), or count (sets the actual on-hand quantity). Does NOT change anything until confirmed.',
      inputSchema: z.object({ item_name: z.string().min(1).max(60), movement: z.enum(['purchase', 'waste', 'count']), quantity: z.number().min(0).max(100000) }),
      run: async ({ item_name, movement, quantity }) => {
        const { data } = await db.from('inventory').select('id, name_ar, name_en, unit');
        const it = (data ?? []).find((i) => i.name_ar.includes(item_name) || i.name_en.toLowerCase().includes(item_name.toLowerCase()));
        if (!it) return `NOT_FOUND: no stock item matches "${item_name}".`;
        const verbAr = movement === 'purchase' ? 'توريد' : movement === 'waste' ? 'تسجيل تالف' : 'جرد (تعيين الكمية إلى)';
        return propose(staff, 'stock_movement', { inventory_id: it.id, movement, quantity }, 'inventory.manage',
          `${verbAr} ${quantity} ${it.unit} — ${it.name_ar}`, `${movement} ${quantity} ${it.unit} — ${it.name_en}`);
      },
    }));
  }
  if (can('busy.manage')) {
    tools.push(betaZodTool({
      name: 'propose_ordering_status',
      description: 'Propose pausing/reopening online orders or switching busy mode (with extra prep minutes). Does NOT change anything until confirmed.',
      inputSchema: z.object({ accepting_orders: z.boolean().optional(), busy_mode: z.boolean().optional(), busy_extra_minutes: z.number().int().min(0).max(240).optional() }),
      run: async (p) => propose(staff, 'ordering_status', p, 'busy.manage',
        [p.accepting_orders === false ? 'إيقاف استقبال الطلبات' : p.accepting_orders ? 'إعادة فتح الطلبات' : null,
         p.busy_mode === true ? `تشغيل وضع الزحمة${p.busy_extra_minutes ? ` (+${p.busy_extra_minutes} د)` : ''}` : p.busy_mode === false ? 'إيقاف وضع الزحمة' : null].filter(Boolean).join(' · '),
        JSON.stringify(p)),
    }));
  }
  if (can('coupons.manage')) {
    tools.push(betaZodTool({
      name: 'propose_offer',
      description: 'Propose creating a promotion (an automatic offer, or a coupon code) after the user agreed to a suggestion. Does NOT create it until confirmed. Percent is 1-90.',
      inputSchema: z.object({ title_ar: z.string().min(2).max(80), title_en: z.string().min(2).max(80), percent: z.number().min(1).max(90),
        code: z.string().regex(/^[A-Za-z0-9_-]{3,32}$/).optional(), category: z.enum(['burger', 'shawarma', 'fries']).optional(), days: z.number().int().min(1).max(60) }),
      run: async (p) => propose(staff, 'create_offer', p, 'coupons.manage',
        `إنشاء ${p.code ? `كوبون ${p.code}` : 'عرض تلقائي'}: «${p.title_ar}» خصم ${p.percent}% لمدة ${p.days} يوم${p.category ? ` على ${p.category}` : ''}`,
        `Create ${p.code ? `coupon ${p.code}` : 'automatic offer'}: “${p.title_en}” ${p.percent}% for ${p.days} days`),
    }));
  }
  return tools;
}

const SYSTEM = `You are SAMAT AI (مساعد سماط), the in-house assistant of SAMAT — a Saudi premium fast-casual restaurant selling burgers, shawarma and fries, pickup only, single branch, prices in SAR, time zone Asia/Riyadh.

Language: reply in the language the user writes in. In Arabic use natural Najdi Saudi dialect (e.g. "أبشر"، "وش"، "الحين"، "زين") while keeping numbers and business terms precise. Keep answers short and scannable; use bullet points for figures.

Facts: every number, product name, stock level or status you state must come from a tool result in this conversation. Never estimate, round up or invent figures. If a tool returns no data, say there is no data yet. When you give a forecast, recommendation or interpretation, label it clearly as a suggestion (e.g. "اقتراح:" / "توقع:") and keep it separate from the actual figures. Revenue counts accepted orders only.

Actions: you cannot change anything directly. When the user asks for a change (pause a product, change a price, adjust stock, busy mode, pause orders, create an offer), call the matching propose_* tool; then tell the user that a confirmation card appeared and nothing changes until they press confirm. If a tool says FORBIDDEN, tell the user they do not have that permission — do not try another way. Do not propose a price change unless the user gave the new price.

Suggesting promotions: base suggestions on product performance, peak hours and stock data from tools; explain the reasoning in one or two lines; only call propose_offer after the user agrees.`;

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export async function runAssistant(db: SupabaseClient, staff: StaffSession, history: ChatTurn[]) {
  if (!env.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const tools = buildTools(db, staff);
  const used: string[] = [];
  const wrapped = tools.map((t) => ({ ...t, run: async (input: never) => { used.push(t.name); return t.run(input); } }));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

  const final = await client.beta.messages.toolRunner({
    model: env.aiModel,
    max_tokens: 16000,
    // Opus 5.5 thinks adaptively by default; effort set explicitly (its default is medium).
    output_config: { effort: 'medium' },
    // If a request is declined by a safety classifier, the API retries it on a fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: `${SYSTEM}\n\nToday (Riyadh): ${today}. Staff member role: ${staff.role}.`,
    tools: wrapped,
    messages: history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    max_iterations: 8,
  });

  if (final.stop_reason === 'refusal') {
    return { text: 'ما أقدر أساعد في هذا الطلب. / I can’t help with that request.', tools: used };
  }
  const text = final.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n').trim();
  return { text, tools: [...new Set(used)] };
}
