-- SAMAT | سماط — bank transfer with receipt upload

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('moyasar', 'simulator', 'none', 'bank_transfer'));
alter table public.payments
  add column receipt_path text,          -- object path in the private "receipts" bucket
  add column receipt_mime text,
  add column reviewed_by uuid references auth.users(id),
  add column reviewed_at timestamptz,
  add column review_note text;

-- Bank details live in the database (editable by the owner), never in source code.
alter table public.store_settings
  add column bank_name text,
  add column bank_account_name text,
  add column bank_iban text check (bank_iban is null or bank_iban ~ '^SA[0-9]{22}$'),
  add column bank_account_number text,
  add column bank_swift text,
  add column bank_qr_url text;

update public.store_settings
   set payment_methods = payment_methods || '{"bank_transfer": false}'::jsonb
 where not payment_methods ? 'bank_transfer';
alter table public.store_settings alter column payment_methods
  set default '{"creditcard": false, "applepay": false, "stcpay": false, "bank_transfer": false}'::jsonb;

-- Private bucket for transfer receipts (bank details / names): staff read through signed URLs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608, array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

-- Public bucket for site assets uploaded from the admin (e.g. the bank QR image).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- The customer submitted a transfer receipt: order goes to the restaurant for review, stock stays held.
create or replace function public.submit_bank_transfer(p_order uuid, p_payment_row uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.samat_error('order_not_found'); end if;
  if not exists (select 1 from public.payments where id = p_payment_row and order_id = p_order and provider = 'bank_transfer') then
    perform public.samat_error('invalid_request');
  end if;
  update public.payments set status = 'pending_verification' where id = p_payment_row;
  if o.status = 'awaiting_approval' and o.payment_status = 'pending_verification' then
    -- a replacement receipt for an order still under review
    return jsonb_build_object('transitioned', false, 'status', o.status);
  end if;
  if o.status <> 'pending_payment' then
    perform public.samat_error('invalid_transition', jsonb_build_object('from', o.status));
  end if;
  if o.expires_at is not null and o.expires_at < now() then
    perform public.samat_error('invalid_transition', jsonb_build_object('from', 'expired'));
  end if;
  perform set_config('samat.actor_type', 'customer', true);
  update public.orders set status = 'awaiting_approval', payment_status = 'pending_verification', expires_at = null where id = p_order;
  update public.inventory_reservations set expires_at = null, updated_at = now() where order_id = p_order and status = 'held';
  update public.coupon_redemptions set status = 'confirmed', expires_at = null, updated_at = now() where order_id = p_order and status = 'reserved';
  return jsonb_build_object('transitioned', true, 'status', 'awaiting_approval');
end $$;

-- Staff confirm the transfer arrived (part of accepting) — or that it never arrived (part of rejecting).
create or replace function public.staff_review_transfer(p_order uuid, p_received boolean, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('orders.manage'); o public.orders; v_pay uuid;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.samat_error('order_not_found'); end if;
  if o.payment_status <> 'pending_verification' then
    perform public.samat_error('invalid_transition', jsonb_build_object('payment_status', o.payment_status));
  end if;
  select id into v_pay from public.payments where order_id = p_order and provider = 'bank_transfer'
   order by created_at desc limit 1;
  update public.payments set status = case when p_received then 'paid'::public.payment_status else 'failed'::public.payment_status end,
         captured_amount = case when p_received then amount else 0 end,
         reviewed_by = uid, reviewed_at = now(), review_note = left(p_note, 300)
   where id = v_pay;
  update public.orders set payment_status = case when p_received then 'paid'::public.payment_status else 'failed'::public.payment_status end
   where id = p_order;
  perform public.write_audit(case when p_received then 'transfer.confirmed' else 'transfer.not_received' end, 'orders', p_order::text, null, null,
    jsonb_build_object('order_number', o.order_number, 'note', p_note));
  return jsonb_build_object('payment_status', case when p_received then 'paid' else 'failed' end);
end $$;

-- Staff record that a manual bank refund was sent back to the customer.
create or replace function public.staff_mark_manual_refund(p_order uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('orders.manage'); o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.samat_error('order_not_found'); end if;
  if o.payment_status <> 'refund_pending' or o.status not in ('rejected', 'cancelled') then
    perform public.samat_error('invalid_transition', jsonb_build_object('payment_status', o.payment_status));
  end if;
  update public.payments set status = 'refunded', refunded_amount = amount, reviewed_by = uid, reviewed_at = now(),
         review_note = left(coalesce(p_note, 'Manual bank refund'), 300)
   where order_id = p_order and provider = 'bank_transfer' and status in ('paid', 'refund_pending');
  update public.orders set payment_status = 'refunded' where id = p_order;
  perform public.loyalty_reverse_for_order(p_order);
  perform public.write_audit('refund.manual', 'orders', p_order::text, null, null, jsonb_build_object('order_number', o.order_number, 'note', p_note));
  return jsonb_build_object('payment_status', 'refunded');
end $$;

-- Rejecting/cancelling a bank-transfer order whose money arrived => manual refund pending.
create or replace function public.staff_reject_order(p_order uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_permission('orders.manage'); o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then perform public.samat_error('order_not_found'); end if;
  if o.status <> 'awaiting_approval' then
    perform public.samat_error('invalid_transition', jsonb_build_object('from', o.status, 'to', 'rejected'));
  end if;
  if o.decision_lock_by is not null and o.decision_lock_by <> uid and o.decision_lock_at > now() - interval '2 minutes' then
    perform public.samat_error('decision_in_progress');
  end if;
  perform set_config('samat.event_note', left(coalesce(p_reason, ''), 300), true);
  update public.orders
     set status = 'rejected', rejected_at = now(), rejected_by = uid, reject_reason = nullif(left(btrim(coalesce(p_reason, '')), 300), ''),
         payment_status = case when payment_status in ('paid', 'authorized') then 'refund_pending'::public.payment_status else payment_status end
   where id = p_order;
  perform public.release_order_holds(p_order);
  perform public.write_audit('order.reject', 'orders', p_order::text, null, null,
    jsonb_build_object('order_number', o.order_number, 'reason', p_reason));
  return jsonb_build_object('status', 'rejected', 'payment_status', o.payment_status,
                            'refund_needed', o.payment_status in ('paid', 'authorized'));
end $$;

-- Acceptance also refuses when another manager holds the decision lock.
create or replace function public.guard_decision_lock() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status and old.status = 'awaiting_approval'
     and old.decision_lock_by is not null and old.decision_lock_at > now() - interval '2 minutes'
     and auth.uid() is not null and old.decision_lock_by <> auth.uid() then
    perform public.samat_error('decision_in_progress');
  end if;
  return new;
end $$;
create trigger orders_decision_guard before update of status on public.orders
  for each row execute function public.guard_decision_lock();

revoke execute on function public.submit_bank_transfer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.staff_review_transfer(uuid, boolean, text), public.staff_mark_manual_refund(uuid, text) to authenticated;
grant execute on function public.staff_reject_order(uuid, text) to authenticated;
