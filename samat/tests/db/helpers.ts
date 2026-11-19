import pg from 'pg';
import { randomUUID } from 'node:crypto';

export const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
export const pool = new pg.Pool({ connectionString: DB_URL, max: 30 });

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(sql, params)).rows as T[];
}

/** Run SQL as an authenticated Supabase user (RLS + auth.uid() apply), in one transaction. */
export async function asUser<T>(userId: string | null, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`set local role ${userId ? 'authenticated' : 'anon'}`);
    if (userId) await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })]);
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}

export async function createUser(email: string, opts: { phone?: string } = {}): Promise<string> {
  const id = randomUUID();
  await q(`insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, phone, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
           values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, now(), $3, now(), now(), '{}', '{}')`,
    [id, email, opts.phone ?? null]);
  return id;
}

export async function createStaff(role: 'owner' | 'admin' | 'orders_manager' | 'kitchen'): Promise<string> {
  const id = await createUser(`${role}-${randomUUID().slice(0, 8)}@test.local`);
  await q(`insert into staff_members (user_id, email, role_key) values ($1, (select email from auth.users where id = $1), $2)`, [id, role]);
  return id;
}

/** A fresh, isolated test product backed by its own stock item. */
export async function createStockedProduct(stock: number, price = 1000): Promise<{ productId: string; inventoryId: string }> {
  const [inv] = await q<{ id: string }>(`insert into inventory (name_ar, name_en, unit, on_hand) values ('اختبار', 'test-${randomUUID().slice(0, 6)}', 'piece', $1) returning id`, [stock]);
  const [p] = await q<{ id: string }>(`insert into products (category_id, slug, builder, name_ar, name_en, base_price, is_active, inventory_id)
     values ((select id from categories where kind = 'fries'), $1, 'simple', 'منتج اختبار', 'Test product', $2, true, $3) returning id`,
    [`test-${randomUUID().slice(0, 8)}`, price, inv.id]);
  return { productId: p.id, inventoryId: inv.id };
}

export function orderPayload(items: unknown[], extra: Record<string, unknown> = {}) {
  return {
    idempotency_key: randomUUID().replace(/-/g, ''),
    customer: { name: 'Test Customer', phone: '+966500000077', locale: 'ar' },
    items,
    ...extra,
  };
}

export async function placeOrder(p: unknown) {
  const [r] = await q<{ r: Record<string, unknown> }>('select place_order($1::jsonb, false) as r', [JSON.stringify(p)]);
  return r.r;
}

export async function markPaid(orderId: string, total: number, status: 'paid' | 'authorized' = 'paid') {
  const [row] = await q<{ id: string }>(`insert into payments (order_id, provider, amount, status) values ($1, 'simulator', $2, 'initiated') returning id`, [orderId, total]);
  const [r] = await q<{ r: Record<string, unknown> }>('select mark_order_paid($1, $2::jsonb) as r',
    [orderId, JSON.stringify({ provider: 'simulator', provider_payment_id: `sim_${row.id}`, payment_row_id: row.id, amount: total, status })]);
  return r.r;
}

export async function available(inventoryId: string): Promise<number> {
  const [r] = await q<{ a: string }>('select inventory_available($1) as a', [inventoryId]);
  return Number(r.a);
}
