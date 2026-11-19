import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { asUser, available, createStaff, createStockedProduct, createUser, markPaid, orderPayload, placeOrder, pool, q } from './helpers';

afterAll(() => pool.end());

describe('pricing is decided by the database', () => {
  it('ignores any price sent by the client', async () => {
    const { productId } = await createStockedProduct(10, 1500);
    const r = await placeOrder(orderPayload([{ product_id: productId, quantity: 2, unit_price: 1, line_total: 1 }]));
    expect(r.total).toBe(3000);
  });

  it('refuses to remove the burger bun and requires a shawarma bread', async () => {
    const burger = await q<{ id: string }>(`select id from products where slug = 'samat-burger'`);
    const bun = await q<{ id: string }>(`select id from ingredients where slug = 'brioche-bun'`);
    await expect(placeOrder(orderPayload([{ product_id: burger[0].id, quantity: 1, ingredients: { [bun[0].id]: 0 } }]))).rejects.toThrow('SAMAT:base_required');
    const shawarma = await q<{ id: string }>(`select id from products where slug = 'samat-shawarma'`);
    await expect(placeOrder(orderPayload([{ product_id: shawarma[0].id, quantity: 1 }]))).rejects.toThrow('SAMAT:bread_required');
  });

  it('rejects ingredients that do not belong to the product', async () => {
    const burger = await q<{ id: string }>(`select id from products where slug = 'samat-burger'`);
    const garlic = await q<{ id: string }>(`select id from ingredients where slug = 'chicken-shawarma'`);
    await expect(placeOrder(orderPayload([{ product_id: burger[0].id, quantity: 1, ingredients: { [garlic[0].id]: 1 } }]))).rejects.toThrow('SAMAT:invalid_ingredient');
  });
});

describe('stock under concurrency', () => {
  it('sells exactly the available quantity when 20 customers check out at once', async () => {
    const { productId, inventoryId } = await createStockedProduct(5);
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => placeOrder(orderPayload([{ product_id: productId, quantity: 1 }]))));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(5);
    expect(failed).toHaveLength(15);
    expect(failed.every((f) => String(f.reason.message).includes('SAMAT:out_of_stock'))).toBe(true);
    expect(await available(inventoryId)).toBe(0);
  });

  it('releases held stock when an unpaid order expires', async () => {
    const { productId, inventoryId } = await createStockedProduct(2);
    const r = await placeOrder(orderPayload([{ product_id: productId, quantity: 2 }]));
    expect(await available(inventoryId)).toBe(0);
    await q(`update orders set expires_at = now() - interval '1 minute' where id = $1`, [r.order_id]);
    await q('select expire_unpaid_orders()');
    expect((await q<{ status: string }>('select status from orders where id = $1', [r.order_id]))[0].status).toBe('expired');
    expect(await available(inventoryId)).toBe(2);
  });
});

describe('idempotency', () => {
  it('returns the same order for a repeated checkout, even when sent concurrently', async () => {
    const { productId } = await createStockedProduct(10);
    const payload = orderPayload([{ product_id: productId, quantity: 1 }]);
    const rs = await Promise.all(Array.from({ length: 5 }, () => placeOrder(payload)));
    expect(new Set(rs.map((r) => r.order_id)).size).toBe(1);
    expect((await q('select id from orders where idempotency_key = $1', [payload.idempotency_key]))).toHaveLength(1);
  });

  it('marks an order paid only once (callback + webhook)', async () => {
    const { productId } = await createStockedProduct(3);
    const r = await placeOrder(orderPayload([{ product_id: productId, quantity: 1 }]));
    const a = await markPaid(r.order_id as string, r.total as number);
    const b = await markPaid(r.order_id as string, r.total as number);
    expect(a.transitioned).toBe(true);
    expect(b.transitioned).toBe(false);
  });

  it('refuses a payment for the wrong amount', async () => {
    const { productId } = await createStockedProduct(3);
    const r = await placeOrder(orderPayload([{ product_id: productId, quantity: 1 }]));
    await expect(markPaid(r.order_id as string, 1)).rejects.toThrow('SAMAT:payment_amount_mismatch');
  });
});

describe('coupons', () => {
  it('never exceeds the usage limit under concurrent checkouts', async () => {
    const code = `T${randomUUID().slice(0, 6)}`.toUpperCase();
    await q(`insert into coupons (code, title_ar, title_en, kind, value, usage_limit) values ($1, 'اختبار', 'test', 'percent', 1000, 3)`, [code]);
    const { productId } = await createStockedProduct(50);
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) =>
      placeOrder({ ...orderPayload([{ product_id: productId, quantity: 1 }]), coupon_code: code, customer: { name: 'Coupon Test', phone: `+9665000001${String(i).padStart(2, '0')}` } })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect((results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]).every((r) => String(r.reason.message).includes('SAMAT:coupon_invalid'))).toBe(true);
  });
});

describe('order lifecycle, kitchen, pickup and loyalty', () => {
  it('runs accept → prepare → ready → handover once, and awards points only after handover', async () => {
    await q('update store_settings set loyalty_enabled = true, loyalty_points_per_sar = 1 where id = 1');
    const customer = await createUser(`c-${randomUUID().slice(0, 6)}@test.local`);
    const manager = await createStaff('orders_manager');
    const kitchen = await createStaff('kitchen');
    const { productId, inventoryId } = await createStockedProduct(5, 2000);
    const r = await placeOrder({ ...orderPayload([{ product_id: productId, quantity: 2 }]), customer: { name: 'Loyal', phone: '+966500000088', user_id: customer } });
    await markPaid(r.order_id as string, r.total as number);

    // the kitchen role may not accept orders
    await expect(asUser(kitchen, (c) => c.query('select staff_accept_order($1)', [r.order_id]))).rejects.toThrow('SAMAT:forbidden');
    await asUser(manager, (c) => c.query('select staff_accept_order($1)', [r.order_id]));
    const [inv] = await q<{ on_hand: string }>('select on_hand from inventory where id = $1', [inventoryId]);
    expect(Number(inv.on_hand)).toBe(3); // committed on acceptance
    expect(await q('select 1 from invoices where order_id = $1', [r.order_id])).toHaveLength(1);

    await asUser(kitchen, (c) => c.query(`select kitchen_set_status($1, 'preparing')`, [r.order_id]));
    let [acct] = await q<{ balance: number }>('select balance from loyalty_accounts where customer_id = $1', [customer]);
    expect(acct?.balance ?? 0).toBe(0); // nothing before handover
    await asUser(kitchen, (c) => c.query(`select kitchen_set_status($1, 'ready')`, [r.order_id]));

    const [{ pickup_code }] = await q<{ pickup_code: string }>('select pickup_code from orders where id = $1', [r.order_id]);
    const first = await asUser(kitchen, (c) => c.query('select pickup_deliver($1) as r', [pickup_code.toLowerCase()]));
    expect(first.rows[0].r.ok).toBe(true);
    const second = await asUser(kitchen, (c) => c.query('select pickup_deliver($1) as r', [pickup_code]));
    expect(second.rows[0].r).toMatchObject({ ok: false, reason: 'already_delivered' });

    [acct] = await q<{ balance: number }>('select balance from loyalty_accounts where customer_id = $1', [customer]);
    expect(acct.balance).toBe(40); // 40 SAR × 1 point
    // a duplicate earn attempt is ignored
    await q('select loyalty_earn_for_order($1)', [r.order_id]);
    [acct] = await q<{ balance: number }>('select balance from loyalty_accounts where customer_id = $1', [customer]);
    expect(acct.balance).toBe(40);
    // refund after pickup reverses the points
    await q('select loyalty_reverse_for_order($1)', [r.order_id]);
    [acct] = await q<{ balance: number }>('select balance from loyalty_accounts where customer_id = $1', [customer]);
    expect(acct.balance).toBe(0);
  });

  it('rejecting returns stock and redeemed points, and grants no points', async () => {
    const customer = await createUser(`r-${randomUUID().slice(0, 6)}@test.local`);
    await q(`insert into loyalty_accounts (customer_id) values ($1) on conflict do nothing`, [customer]);
    await q(`select loyalty_credit($1, 300, 'adjust', null, 'seed', null)`, [customer]);
    await q('update store_settings set loyalty_enabled = true, loyalty_min_redeem_points = 50, loyalty_point_value_halalas = 5 where id = 1');
    const manager = await createStaff('orders_manager');
    const { productId, inventoryId } = await createStockedProduct(4, 3000);
    const r = await placeOrder({ ...orderPayload([{ product_id: productId, quantity: 1 }]), redeem_points: 100, customer: { name: 'Reject Test', phone: '+966500000099', user_id: customer } });
    expect(r.total).toBe(3000 - 500);
    expect((await q<{ balance: number }>('select balance from loyalty_accounts where customer_id = $1', [customer]))[0].balance).toBe(200);
    await markPaid(r.order_id as string, r.total as number);
    await asUser(manager, (c) => c.query('select staff_reject_order($1, $2)', [r.order_id, 'نفد المخزون']));
    expect(await available(inventoryId)).toBe(4);
    expect((await q<{ balance: number }>('select balance from loyalty_accounts where customer_id = $1', [customer]))[0].balance).toBe(300);
    const [o] = await q<{ status: string; payment_status: string; points_earned: number }>('select status, payment_status, points_earned from orders where id = $1', [r.order_id]);
    expect(o).toMatchObject({ status: 'rejected', payment_status: 'refund_pending', points_earned: 0 });
  });

  it('a bank-transfer order cannot be accepted until the transfer is confirmed', async () => {
    const manager = await createStaff('orders_manager');
    const { productId } = await createStockedProduct(2, 1500);
    const r = await placeOrder(orderPayload([{ product_id: productId, quantity: 1 }]));
    const [pay] = await q<{ id: string }>(`insert into payments (order_id, provider, amount, status, receipt_path) values ($1, 'bank_transfer', $2, 'initiated', 'x/y.jpg') returning id`, [r.order_id, r.total]);
    await q('select submit_bank_transfer($1, $2)', [r.order_id, pay.id]);
    await expect(asUser(manager, (c) => c.query('select staff_accept_order($1)', [r.order_id]))).rejects.toThrow('SAMAT:payment_not_captured');
    await asUser(manager, async (c) => {
      await c.query('select staff_review_transfer($1, true, $2)', [r.order_id, 'arrived']);
      await c.query('select staff_accept_order($1)', [r.order_id]);
    });
    expect((await q<{ status: string; payment_status: string }>('select status, payment_status from orders where id = $1', [r.order_id]))[0]).toMatchObject({ status: 'accepted', payment_status: 'paid' });
  });
});

describe('row level security and permissions', () => {
  it('hides orders from the public but shows the PII-free board', async () => {
    const orders = await asUser(null, (c) => c.query('select count(*)::int as n from orders'));
    expect(orders.rows[0].n).toBe(0);
    const board = await asUser(null, (c) => c.query('select * from order_board limit 1'));
    expect(Object.keys(board.rows[0] ?? { order_id: 1 })).not.toContain('customer_phone');
  });

  it('lets a customer see only their own orders', async () => {
    const a = await createUser(`a-${randomUUID().slice(0, 6)}@test.local`);
    const b = await createUser(`b-${randomUUID().slice(0, 6)}@test.local`);
    const { productId } = await createStockedProduct(5);
    const r = await placeOrder({ ...orderPayload([{ product_id: productId, quantity: 1 }]), customer: { name: 'Alice Test', phone: '+966500000011', user_id: a } });
    const asA = await asUser(a, (c) => c.query('select id from orders where id = $1', [r.order_id]));
    const asB = await asUser(b, (c) => c.query('select id from orders where id = $1', [r.order_id]));
    expect(asA.rows).toHaveLength(1);
    expect(asB.rows).toHaveLength(0);
  });

  it('blocks writes outside a role and honours per-person overrides', async () => {
    const kitchen = await createStaff('kitchen');
    const { productId } = await createStockedProduct(1, 1000);
    const res = await asUser(kitchen, (c) => c.query('update products set base_price = 1 where id = $1 returning id', [productId]));
    expect(res.rows).toHaveLength(0); // RLS: no menu.manage → nothing updated
    await q(`insert into staff_permission_overrides (user_id, permission_key, allow) values ($1, 'menu.manage', true)`, [kitchen]);
    const res2 = await asUser(kitchen, (c) => c.query('update products set base_price = 1200 where id = $1 returning id', [productId]));
    expect(res2.rows).toHaveLength(1);
    const manager = await createStaff('orders_manager');
    await q(`insert into staff_permission_overrides (user_id, permission_key, allow) values ($1, 'orders.manage', false)`, [manager]);
    const { productId: p2 } = await createStockedProduct(1);
    const r = await placeOrder(orderPayload([{ product_id: p2, quantity: 1 }]));
    await markPaid(r.order_id as string, r.total as number);
    await expect(asUser(manager, (c) => c.query('select staff_accept_order($1)', [r.order_id]))).rejects.toThrow('SAMAT:forbidden');
  });

  it('stock quantities cannot be edited directly, only through movements', async () => {
    const admin = await createStaff('admin');
    const { inventoryId } = await createStockedProduct(5);
    await expect(asUser(admin, (c) => c.query('update inventory set on_hand = 999 where id = $1', [inventoryId]))).rejects.toThrow('SAMAT:use_inventory_movements');
    await asUser(admin, (c) => c.query(`select inventory_move($1, 'purchase', 10, 'delivery')`, [inventoryId]));
    expect((await q<{ on_hand: string }>('select on_hand from inventory where id = $1', [inventoryId]))[0].on_hand).toBe('15.000');
  });

  it('protects internal functions from the public API', async () => {
    await expect(asUser(null, (c) => c.query(`select place_order('{}'::jsonb, false)`))).rejects.toThrow(/permission denied/);
    const u = await createUser(`x-${randomUUID().slice(0, 6)}@test.local`);
    await expect(asUser(u, (c) => c.query(`select loyalty_credit($1, 1000000, 'earn', null, 'hack', null)`, [u]))).rejects.toThrow(/permission denied/);
  });

  it('keeps at least one owner', async () => {
    const c = await pool.connect();
    try {
      await c.query('begin'); // rolled back: no lasting change to staff data
      const solo = await createStaff('owner');
      await c.query(`update staff_members set is_active = false where role_key = 'owner' and user_id <> $1`, [solo]);
      await expect(c.query(`update staff_members set is_active = false where user_id = $1`, [solo])).rejects.toThrow('SAMAT:last_owner');
    } finally {
      await c.query('rollback');
      c.release();
    }
  });
});
